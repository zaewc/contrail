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

# Install Nginx (if not already installed)
if ! command -v nginx &> /dev/null; then
  echo "📥 Installing Nginx..."
  sudo apt-get install -y nginx
  sudo systemctl enable nginx
  sudo systemctl start nginx
fi

# Create project directory
mkdir -p /home/ubuntu/contrail
cd /home/ubuntu/contrail

# Create web root directory
echo "📁 Creating web root directory..."
sudo mkdir -p /var/www/contrail
sudo chown -R www-data:www-data /var/www/contrail
sudo chmod -R 755 /var/www/contrail

# Clone repository (first time only)
if [ ! -d ".git" ]; then
  echo "📥 Cloning repository..."
  git clone https://github.com/yourusername/contrail.git /tmp/contrail-tmp
  mv /tmp/contrail-tmp/* /home/ubuntu/contrail/
  rm -rf /tmp/contrail-tmp
fi

# Setup PM2 auto-restart on server reboot
echo "🔄 Setting up PM2 auto-startup..."
sudo pm2 startup -u ubuntu --hp /home/ubuntu
sudo pm2 save

# Configure sudoers for automated deployment (no password prompt)
echo "🔐 Configuring sudo access for deployment..."
echo "ubuntu ALL=(ALL) NOPASSWD: /bin/rm, /bin/cp, /usr/sbin/nginx, /bin/chown, /usr/bin/systemctl" | sudo tee /etc/sudoers.d/contrail-deploy > /dev/null

echo "✅ Server setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Create .env file on server:"
echo "   ssh -p 24140 ubuntu@ssh.gsmsv.site"
echo "   nano /home/ubuntu/contrail/apps/api/.env"
echo ""
echo "2. Initial deployment:"
echo "   ssh -p 24140 ubuntu@ssh.gsmsv.site 'cd /home/ubuntu/contrail && bash deploy.sh'"
echo ""
echo "3. Configure GitHub Secrets for auto-deployment (see DEPLOYMENT.md)"
