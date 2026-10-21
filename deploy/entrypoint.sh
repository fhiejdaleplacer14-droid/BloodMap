#!/bin/sh
# Container start: validate config, render nginx, migrate, seed, cache, then run supervisord.
set -eu

cd /var/www/html

fail() { echo "[bloodmap] ERROR: $1" >&2; exit 1; }

[ -n "${APP_KEY:-}" ] || fail "APP_KEY is not set (generate one: php artisan key:generate --show)"
[ -n "${APP_URL:-}" ] || fail "APP_URL is not set (the public https URL of this site)"
[ -n "${DB_HOST:-}" ] || fail "DB_HOST is not set (see docs/deployment.md)"

# Single origin: the SPA lives at APP_URL, so the frontend URL and cookie host follow from it.
: "${FRONTEND_URL:=$APP_URL}"
host="${APP_URL#*://}"; host="${host%%/*}"
: "${SANCTUM_STATEFUL_DOMAINS:=$host}"
export FRONTEND_URL SANCTUM_STATEFUL_DOMAINS
case "$APP_URL" in https://*) export SESSION_SECURE_COOKIE="${SESSION_SECURE_COOKIE:-true}" ;; esac

# Only ${PORT} is substituted; nginx's own $variables stay intact.
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf

if [ "$(id -u)" = "0" ]; then
  chown -R www-data:www-data storage bootstrap/cache
fi

# Wait for the database (hosted Postgres can take a moment to wake).
i=0
until php artisan migrate --force --no-interaction >/tmp/migrate.log 2>&1; do
  i=$((i+1))
  if [ "$i" -ge 15 ]; then cat /tmp/migrate.log >&2; fail "could not migrate the database"; fi
  echo "[bloodmap] waiting for the database ($i/15)..."
  sleep 4
done
cat /tmp/migrate.log

php artisan app:first-run --no-interaction
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

exec "$@"
