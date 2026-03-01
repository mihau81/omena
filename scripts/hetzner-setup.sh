#!/bin/bash
# One-time setup script for omena on Hetzner
# Run this manually on the server: bash /root/omena/scripts/hetzner-setup.sh
set -e

APP_DIR=/root/omena
NGINX_CONF=/etc/nginx/sites-enabled/bialek.pl

echo "=== Omena Hetzner Setup ==="

# 1. Check .env exists
if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: $APP_DIR/.env not found. Create it first with production values:"
  echo ""
  echo "  DATABASE_URL=postgresql://omena:\$DB_PASSWORD@db:5432/omena"
  echo "  DB_PASSWORD=<strong-password>"
  echo "  MINIO_ENDPOINT=http://minio:9000"
  echo "  MINIO_ACCESS_KEY=<minio-user>"
  echo "  MINIO_SECRET_KEY=<minio-password>"
  echo "  S3_BUCKET=omena-media"
  echo "  S3_PUBLIC_URL=https://bialek.pl/omena-media"
  echo "  NEXTAUTH_SECRET=<min-32-char-secret>"
  echo "  NEXTAUTH_URL=https://bialek.pl/omena"
  echo "  AUTH_TRUST_HOST=true"
  echo "  ENCRYPTION_KEY=<32-char-key>"
  echo "  STRIPE_SECRET_KEY=<stripe-sk>"
  echo "  STRIPE_PUBLISHABLE_KEY=<stripe-pk>"
  echo "  STRIPE_WEBHOOK_SECRET=<stripe-whsec>"
  echo ""
  exit 1
fi

# 2. Update nginx: replace static /omena/ block with reverse proxy
if grep -q "alias /var/www/static/omena/" "$NGINX_CONF" 2>/dev/null; then
  echo "Updating nginx config: static -> reverse proxy..."

  # Create backup
  cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%Y%m%d%H%M%S)"

  # Replace the static omena block with proxy
  python3 - "$NGINX_CONF" << 'PYTHON'
import sys, re

conf_path = sys.argv[1]
with open(conf_path, 'r') as f:
    content = f.read()

# Remove old static omena blocks (location /omena and location /omena/)
# Match the whole location block including nested content
old_patterns = [
    r'\n\s*# Redirect /omena to /omena/\n\s*location = /omena \{[^}]*\}\n',
    r'\n\s*location /omena/ \{[^}]*(?:\{[^}]*\}[^}]*)*\}\n',
]

for pattern in old_patterns:
    content = re.sub(pattern, '\n', content)

# Insert new proxy block before the default location /
new_block = """
    # Omena CMS (reverse proxy to Docker)
    location /omena/ {
        proxy_pass http://127.0.0.1:3080/omena/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
    }

"""

# Insert before 'location / {' (the default/Forgejo block)
content = content.replace('\n    location / {\n', new_block + '    location / {\n', 1)

with open(conf_path, 'w') as f:
    f.write(content)

print("Nginx config updated successfully")
PYTHON

  nginx -t && systemctl reload nginx
  echo "Nginx reloaded"
else
  echo "Nginx config already has proxy block or needs manual setup"
  # Check if proxy is already there
  if grep -q "proxy_pass.*3080" "$NGINX_CONF" 2>/dev/null; then
    echo "Proxy block already configured - OK"
  else
    echo "WARNING: Manual nginx configuration needed"
  fi
fi

# 3. Create MinIO bucket on first run
echo "Starting services..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml up -d

# Wait for MinIO
echo "Waiting for MinIO..."
sleep 5

# Create bucket if it doesn't exist
docker compose -f docker-compose.prod.yml exec -T minio sh -c '
  mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD 2>/dev/null
  mc mb local/omena-media 2>/dev/null || true
  mc anonymous set download local/omena-media 2>/dev/null || true
  echo "MinIO bucket ready"
' 2>/dev/null || echo "MinIO bucket setup skipped (configure manually via MinIO console at port 9002)"

# 4. Run DB migrations
echo "Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T app sh -c '
  cd /app && node -e "
    const { drizzle } = require(\"drizzle-orm/node-postgres\");
    const { migrate } = require(\"drizzle-orm/node-postgres/migrator\");
    const { Pool } = require(\"pg\");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool);
    migrate(db, { migrationsFolder: \"./db/migrations\" }).then(() => {
      console.log(\"Migrations complete\");
      pool.end();
    }).catch(e => {
      console.error(\"Migration error:\", e.message);
      pool.end();
      process.exit(1);
    });
  "
' 2>/dev/null || echo "Migration skipped (run manually: docker exec omena_app npx drizzle-kit migrate)"

echo ""
echo "=== Setup complete ==="
echo "App: https://bialek.pl/omena/"
echo "MinIO console: http://77.42.31.51:9002"
echo ""
echo "GitHub secrets needed:"
echo "  SERVER_HOST: 77.42.31.51"
echo "  SERVER_USER: root"
echo "  SERVER_SSH_KEY: (SSH private key)"
