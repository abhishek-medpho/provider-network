# Production deploy — GCE VM with Docker

One-VM setup: Postgres + Next.js app in two containers, behind your own reverse proxy for HTTPS.

## 1. Provision the VM

- Debian/Ubuntu LTS, 2 vCPU / 4 GB RAM is plenty for the workload here.
- Open firewall: `22` (SSH from your IP), `80`, `443`. Do **not** expose `3000` or `5432` to the public internet.

Install Docker:
```sh
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out + back in
```

## 2. Get the code on the box

```sh
git clone <your-repo-url> care-provider-platform
cd care-provider-platform
```

## 3. Configure env

```sh
cp .env.production.example .env
# Generate secrets
openssl rand -base64 32   # use for NEXTAUTH_SECRET
openssl rand -base64 32   # use for CRON_SECRET
# Edit .env — fill in every CHANGE_ME and the real APP_BASE_URL / NEXTAUTH_URL.
nano .env
chmod 600 .env
```

## 4. First boot

```sh
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app
```

On the first boot, the entrypoint:
1. Runs `prisma migrate deploy` (applies every migration in `prisma/migrations/`).
2. Runs `prisma/seed.ts` (upserts: attributes, profile types, message templates, default admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`).

The seed is idempotent — re-running on every boot is safe and keeps the canonical data fresh. Set `SEED_ON_BOOT=false` in `.env` later if you want to freeze.

Confirm health:
```sh
curl -i http://localhost:3000/   # expect 200
docker compose -f docker-compose.prod.yml exec postgres psql -U cpp -d care_provider_platform -c "select count(*) from \"Attribute\";"
```

## 5. Reverse proxy + HTTPS

Run **Caddy** on the host (simplest — auto-TLS via Let's Encrypt):

```sh
sudo apt install -y caddy
sudo tee /etc/caddy/Caddyfile <<'EOF'
app.example.com {
    reverse_proxy localhost:3000
}
EOF
sudo systemctl reload caddy
```

Point your DNS A record at the VM's external IP. Caddy auto-provisions the cert.

## 6. Schedule the reminders cron

Add to host crontab (`crontab -e`):
```cron
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron/reminders > /dev/null 2>&1
```
Replace `$CRON_SECRET` with the literal value from `.env` (cron doesn't inherit it). Every 15 min matches the 0.5h minimum `delayHours` granularity.

## 7. Updates

```sh
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
Zero-downtime is not built in — there's a few seconds of restart. Acceptable for this app.

## 8. Backups

Daily Postgres dump:
```sh
mkdir -p ~/backups
sudo tee /etc/cron.daily/cpp-backup <<'EOF'
#!/bin/sh
docker compose -f /home/$SUDO_USER/care-provider-platform/docker-compose.prod.yml exec -T postgres \
  pg_dump -U cpp care_provider_platform | gzip > /home/$SUDO_USER/backups/cpp-$(date +%F).sql.gz
find /home/$SUDO_USER/backups -name "cpp-*.sql.gz" -mtime +14 -delete
EOF
sudo chmod +x /etc/cron.daily/cpp-backup
```

Also back up the uploads volume:
```sh
docker run --rm -v care-provider-platform_cpp_uploads:/data -v ~/backups:/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

## 9. Troubleshooting

- **`Authentication failed` on login** → `NEXTAUTH_URL` and `APP_BASE_URL` must exactly match the URL in the browser (scheme + host, no trailing slash).
- **Form invite links 404** → `NEXT_PUBLIC_APP_URL` was empty at build time. It's now passed as runtime env, but if you see this, rebuild: `docker compose -f docker-compose.prod.yml up -d --build`.
- **Reminder cron fires nothing** → check the rule is `Active`, then `docker compose -f docker-compose.prod.yml logs app | grep reminders`.
- **Reset everything** → `docker compose -f docker-compose.prod.yml down -v` (⚠️ wipes Postgres + uploads).
