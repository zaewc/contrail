#!/bin/bash
# Nginx reverse proxy setup for contrail

set -e

echo "🔧 Setting up Nginx reverse proxy..."

# Install Nginx
sudo apt-get update
sudo apt-get install -y nginx

# Create Nginx config
sudo tee /etc/nginx/sites-available/contrail > /dev/null <<EOF
upstream contrail_api {
    server 127.0.0.1:4000;
}

upstream contrail_web {
    server 127.0.0.1:80;
}

server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 10M;

    # API routes
    location /api/ {
        proxy_pass http://contrail_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://contrail_api;
        access_log off;
    }

    # Static files and Web UI
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/contrail /etc/nginx/sites-enabled/contrail

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
sudo nginx -t

# Start Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "✅ Nginx reverse proxy configured!"
echo "Port 80 will now route:"
echo "  - /api/* → API server (port 4000)"
echo "  - /* → Web UI (port 5173)"
