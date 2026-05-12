#!/bin/bash
set -e

# Deploy script for contrail

PROJECT_DIR="/home/ubuntu/contrail"
PORT=4000
WEB_PORT=5173

echo "🚀 Starting deployment..."

# Create project directory if it doesn't exist
if [ ! -d "$PROJECT_DIR" ]; then
  mkdir -p "$PROJECT_DIR"
  cd "$PROJECT_DIR"
  git init
fi

cd "$PROJECT_DIR"

# Fetch latest from remote
echo "📥 Pulling latest code..."
git remote add origin https://github.com/yourusername/contrail.git 2>/dev/null || git remote set-url origin https://github.com/yourusername/contrail.git
git fetch origin main
git reset --hard origin/main

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Build
echo "🔨 Building project..."
pnpm build

# Create .env if not exists
if [ ! -f "apps/api/.env" ]; then
  echo "⚠️  Creating .env file - please add GITHUB_TOKEN manually"
  cp apps/api/.env.example apps/api/.env
fi

# Stop existing services
echo "🛑 Stopping existing services..."
pm2 delete contrail-api contrail-web 2>/dev/null || true

# Start API server
echo "🚀 Starting API server..."
cd "$PROJECT_DIR/apps/api"
pm2 start "pnpm run start" --name "contrail-api" --env "PORT=$PORT"

# Start Web server
echo "🚀 Starting Web server..."
cd "$PROJECT_DIR/apps/web"
pm2 start "pnpm run preview" --name "contrail-web" --env "PORT=$WEB_PORT"

# Save PM2 config
pm2 save

echo "✅ Deployment complete!"
echo "API: http://localhost:$PORT"
echo "Web: http://localhost:$WEB_PORT"
