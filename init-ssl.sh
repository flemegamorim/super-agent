#!/bin/bash
set -e

DOMAIN="${1:?Usage: ./init-ssl.sh yourdomain.com your@email.com}"
EMAIL="${2:?Usage: ./init-ssl.sh yourdomain.com your@email.com}"

echo "==> Issuing SSL certificate for $DOMAIN ..."

# Step 1: Start Nginx with a temporary self-signed cert so it can serve the ACME challenge.
# Create a temporary nginx config that only serves HTTP (no SSL block).
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

# Step 2: Start nginx with HTTP-only config to serve the challenge
DOMAIN=$DOMAIN docker compose stop nginx 2>/dev/null || true
docker run -d --name certbot-nginx-tmp \
  -p 80:80 \
  -v "$(pwd)/nginx-http-only.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v super-agent-node_certbot-webroot:/var/www/certbot \
  nginx:alpine

# Step 3: Run certbot to obtain the certificate
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Step 4: Clean up temporary nginx
docker stop certbot-nginx-tmp && docker rm certbot-nginx-tmp
rm nginx-http-only.conf

# Step 5: Start the full stack with SSL
echo "==> Starting full stack with SSL ..."
DOMAIN=$DOMAIN docker compose up -d

echo ""
echo "=== SSL setup complete ==="
echo "Visit: https://$DOMAIN"
echo ""
echo "To auto-renew, add this cron job (crontab -e):"
echo "0 3 * * * cd $(pwd) && docker compose run --rm certbot renew && docker compose exec nginx nginx -s reload"
