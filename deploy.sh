#!/bin/bash
set -e

PROJECT_DIR="/home/ubuntu/contrail"
REPO_URL="https://github.com/zaewc/contrail.git"

echo "[0/5] Starting deployment..."

if [ ! -d "$PROJECT_DIR/.git" ]; then
  mkdir -p "$PROJECT_DIR"
  cd "$PROJECT_DIR"
  git init
  git remote add origin "$REPO_URL"
fi

cd "$PROJECT_DIR"

echo "[1/5] Syncing code from origin/main..."
git remote set-url origin "$REPO_URL"
git fetch origin main
# Build artifacts (dist/) are tracked in the repo, so a plain `git pull` conflicts
# with locally built files. Hard-reset to origin/main for a deterministic tree.
# Gitignored files such as apps/api/.env are untracked and survive this reset.
git reset --hard origin/main

echo "[2/5] Installing dependencies..."
pnpm install

echo "[3/5] Building..."
pnpm build

echo "[4/5] Restarting services (pm2)..."
# Web is served by the 'contrail-web' process (vite preview), not Nginx static files.
pm2 restart contrail-api --update-env \
  || (cd "$PROJECT_DIR/apps/api" && pm2 start "pnpm run start" --name contrail-api)
pm2 restart contrail-web --update-env \
  || (cd "$PROJECT_DIR/apps/web" && pm2 start "pnpm run preview" --name contrail-web)

echo "[5/5] Saving pm2 process list..."
pm2 save

echo "✅ Deployment complete!"
echo "🔌 API: http://0.0.0.0:4000"
echo "🌐 Web: served by pm2 'contrail-web' (vite preview)"
