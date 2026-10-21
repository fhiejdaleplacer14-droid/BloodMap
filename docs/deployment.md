# Deploying BloodMap NIR

The repository builds **one Docker image** that serves both the React app and
the Laravel API from the same address. Because the app and the API share an
origin, Sanctum's cookie sign-in needs no shared-domain setup and works on
any host, including free `*.onrender.com`-style subdomains.

Inside the container, supervisord runs four processes:

| Process | What it does |
|---------|--------------|
| nginx | Serves the built app. It sends `/api`, `/sanctum`, `/up`, email links and form posts to PHP. |
| php-fpm | Runs Laravel. |
| `queue:work` | Sends emails and runs the automated listing checks. |
| `schedule:work` | Expires requests every 5 minutes, sends reminders, and sends the weekly summary. |

On every start, the entrypoint does the following, in order:

1. Checks that the required variables are set.
2. Runs the migrations. It retries while the database wakes up.
3. Upserts the NIR geography.
4. Seeds the demo data once (only when `SEED_DEMO_DATA=true` and the database has no accounts yet).
5. Caches the config and routes.

Restarts never duplicate or wipe data.

## What you need

1. **A PostgreSQL database.** Any hosted Postgres 15+ works (Supabase,
   Neon, Render, Railway or your own). PostGIS isn't needed.
2. **An email sender.** Sign-up verification, password resets and
   coordinator invites all depend on email. Any SMTP service works
   (Brevo, Resend, Mailgun, Postmark, or a Gmail app password for a small
   demo). Without one, nobody can verify a new account.
3. **A host that runs a Dockerfile** and terminates HTTPS: Render, Railway,
   Fly.io, Koyeb, or a VPS with Caddy or Traefik in front.

## Steps

1. **Generate an app key** locally and keep it secret:
   ```bash
   cd backend && php artisan key:generate --show
   ```
2. **Create the database** and note its host, port, database name, user and
   password.
3. **Create the web service** from this repository using the root
   `Dockerfile`. The container listens on `$PORT` (default `8080`), and most
   hosts set this for you. The health check path is `/up`.
4. **Set the environment variables** from
   [`deploy/production.env.example`](../deploy/production.env.example). At
   minimum, set `APP_KEY`, `APP_URL` (the public `https://` address),
   `DB_*`, `DB_SSLMODE=require` and the `MAIL_*` values.
5. **Deploy.** The first start runs the migrations and, with
   `SEED_DEMO_DATA=true`, creates the demo accounts.
6. **Check it:**
   - `https://your-app/up` returns 200.
   - The map loads.
   - You can sign in.
   - Register a new account with your real email, and confirm the
     verification email arrives and its link signs you in.
   - In System settings, the health card shows *Operational* for email.

### Example: Render

- New → **Web Service** → connect the repository → Runtime **Docker**.
- Health check path: `/up`.
- Add the variables under **Environment**.
- Free instances sleep when idle. The queue and scheduler pause too, so
  emails and expiry run when the service wakes. Expired requests still never
  show, because public lists filter on `expires_at`. Use a paid instance if
  reminders must go out on time.

## Before going public

- **Demo password.** Every seeded account, including the two administrators,
  uses `DEMO_PASSWORD`, and the README publishes the default. Keep the
  default only if you want visitors to try every role. Otherwise set your
  own password and share it privately.
- **Map tiles.** `tile.openstreetmap.org` is fine for a demo, but its
  [usage policy](https://operations.osmfoundation.org/policies/tiles/)
  doesn't allow heavy traffic. For real use, rebuild with
  `--build-arg VITE_MAP_TILE_URL=…` pointing at a tile provider whose terms
  allow your traffic. Also add that host to the `img-src` part of the
  Content-Security-Policy in `deploy/nginx.conf.template`.
- **AI guide.** It stays on help articles unless you set
  `ASSISTANT_DRIVER=gemini` and `GEMINI_API_KEY`. On Gemini's free tier,
  Google may use the questions to improve its products (decision #92).
- **Copy review.** Help articles, email text and the report and summary
  copy were written without frames. Have blood-service staff review them
  (decisions #79, #94, #96).
- **Backups.** Turn on your database host's automatic backups. The audit
  log is insert-only, so the backups are its only copy.

## Updating

Push to `main` and redeploy. Migrations run automatically on start, so
deploy additive migrations before code that depends on them.

## Running the image locally

```bash
docker build -t bloodmap .
docker run --rm -p 8080:8080 \
  -e APP_KEY=base64:… -e APP_URL=http://localhost:8080 \
  -e DB_HOST=host.docker.internal -e DB_DATABASE=bloodmap -e DB_USERNAME=bloodmap -e DB_PASSWORD=secret \
  -e SEED_DEMO_DATA=true bloodmap
```
