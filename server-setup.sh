#!/bin/bash
set -e

echo "🔧 Setting up server environment..."

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js (if not already installed)
if ! command -v node &> /dev/null; then
  echo "📥 Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Install pnpm (if not already installed)
if ! command -v pnpm &> /dev/null; then
  echo "📥 Installing pnpm..."
  npm install -g pnpm
fi

# Install PM2 globally
echo "📥 Installing PM2..."
sudo npm install -g pm2

# Create project directory
mkdir -p /home/ubuntu/contrail
cd /home/ubuntu/contrail

# Clone repository (first time only)
if [ ! -d ".git" ]; then
  echo "📥 Cloning repository..."
  git clone https://github.com/yourusername/contrail.git /tmp/contrail-tmp
  mv /tmp/contrail-tmp/* /home/ubuntu/contrail/
  rm -rf /tmp/contrail-tmp
fi

# Setup PM2 auto-restart on server reboot
sudo pm2 startup -u ubuntu --hp /home/ubuntu

echo "✅ Server setup complete!"
echo "📝 Next steps:"
echo "1. Copy deploy.sh to server: scp -P 24140 deploy.sh ubuntu@ssh.gsmsv.site:/home/ubuntu/contrail/"
echo "2. Create .env file on server with GITHUB_TOKEN"
echo "3. Run: bash /home/ubuntu/contrail/deploy.sh"
