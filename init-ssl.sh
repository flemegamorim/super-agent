#!/bin/bash
set -e

DOMAIN="${1:?Usage: ./init-ssl.sh yourdomain.com your@email.com}"
EMAIL="${2:?Usage: ./init-ssl.sh yourdomain.com your@email.com}"

cleanup() {
  echo "==> Cleaning up temporary containers ..."
  docker stop certbot-nginx-tmp 2>/dev/null || true
  docker rm certbot-nginx-tmp 2>/dev/null || true
  rm -f nginx-http-only.conf
}

trap cleanup EXIT

echo "==> Issuing SSL certificate for $DOMAIN ..."

# Stop anything that might be using port 80
DOMAIN=$DOMAIN docker compose down 2>/dev/null || true
cleanup

cat > nginx-http-only.conf <<'TMPCONF'
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'waiting for ssl';
        add_header Content-Type text/plain;
    }
}
TMPCONF

# Ensure the certbot volume exists
docker volume create super-agent_certbot-webroot 2>/dev/null || true

# Start temporary nginx to serve the ACME challenge on port 80
docker run -d --name certbot-nginx-tmp \
  -p 80:80 \
  -v "$(pwd)/nginx-http-only.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v super-agent_certbot-webroot:/var/www/certbot \
  nginx:alpine

echo "==> Waiting for nginx to start ..."
sleep 3

# Request certificate
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# cleanup runs automatically via trap

echo "==> Starting full stack with SSL ..."
DOMAIN=$DOMAIN docker compose up -d

echo ""
echo "=== SSL setup complete ==="
echo "Visit: https://$DOMAIN"
echo ""
echo "To auto-renew, add this cron job (crontab -e):"
echo "0 3 * * * cd $(pwd) && docker compose run --rm certbot renew && docker compose exec nginx nginx -s reload"
