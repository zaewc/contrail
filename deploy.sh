#!/bin/bash
set -e


PROJECT_DIR="/home/ubuntu/contrail"
API_PORT=4000
WEB_ROOT="/var/www/contrail"

echo "[0/8] Starting deployment..."

if [ ! -d "$PROJECT_DIR" ]; then
  mkdir -p "$PROJECT_DIR"
  cd "$PROJECT_DIR"
  git init
fi

cd "$PROJECT_DIR"

echo "[1/8] Pulling latest code..."
git remote add origin https://github.com/yourusername/contrail.git 2>/dev/null || git remote set-url origin https://github.com/yourusername/contrail.git
git fetch origin main
git pull origin main

echo "[2/8] Installing dependencies..."
pnpm install

echo "[3/8] Building..."
pnpm build

echo "[4/8] Deploying web files to Nginx..."
sudo rm -rf "$WEB_ROOT"/*
sudo cp -r "$PROJECT_DIR/apps/web/dist"/* "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT"

echo "[5/8] Restarting API server..."
pm2 restart contrail-api || (cd "$PROJECT_DIR/apps/api" && pm2 start "pnpm run start" --name "contrail-api")

pm2 save

echo "[6/8] Testing Nginx configuration..."
sudo nginx -t

echo "[7/8] Reloading Nginx..."
sudo systemctl reload nginx

echo "[8/8] Deployment complete!"
echo ""
echo "🌐 Access your app:"
echo "Web UI: http://ssh.gsmsv.site:25140"
echo "API: http://ssh.gsmsv.site:25140/api"
