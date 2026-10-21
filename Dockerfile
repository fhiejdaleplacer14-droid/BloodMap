# BloodMap NIR: one image serving the SPA and the API on a single origin
# (Sanctum cookie auth then needs no shared-domain setup). See docs/deployment.md.

# ── 1. Frontend build ───────────────────────────────────────────────────
FROM node:24-alpine AS spa
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Empty API URL = same origin. Tiles can be swapped for a provider that allows your traffic.
ARG VITE_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
ENV VITE_API_URL="" \
    VITE_MAP_TILE_URL=${VITE_MAP_TILE_URL}
RUN npm run build

# ── 2. PHP dependencies ─────────────────────────────────────────────────
FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction
COPY backend/ ./
RUN composer dump-autoload --no-dev --classmap-authoritative --no-interaction

# ── 3. Runtime ──────────────────────────────────────────────────────────
FROM php:8.2-fpm-alpine AS runtime
RUN apk add --no-cache nginx supervisor gettext libpq \
    && apk add --no-cache --virtual .build-deps libpq-dev $PHPIZE_DEPS \
    && docker-php-ext-install pdo_pgsql opcache \
    && apk del .build-deps \
    && rm -rf /var/cache/apk/*

COPY deploy/php.ini /usr/local/etc/php/conf.d/zz-bloodmap.ini
COPY deploy/php-fpm.conf /usr/local/etc/php-fpm.d/zz-bloodmap.conf
COPY deploy/nginx.conf.template /etc/nginx/nginx.conf.template
COPY deploy/supervisord.conf /etc/supervisord.conf
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh

WORKDIR /var/www/html
COPY --from=vendor --chown=www-data:www-data /app ./
COPY --from=spa /app/dist /var/www/spa
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

ENV APP_ENV=production \
    APP_DEBUG=false \
    DB_CONNECTION=pgsql \
    LOG_CHANNEL=stderr \
    PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/up" >/dev/null || exit 1
ENTRYPOINT ["entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
