#!/bin/bash
# ============================================
# Oklahoma Car Meets - VPS Setup Script
# Run this on a fresh Ubuntu VPS
# Usage: chmod +x setup.sh && sudo ./setup.sh
# ============================================

set -e
echo "🚗 Setting up Oklahoma Car Meets Backend..."

# 1. Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# 2. Install essential packages
echo "📦 Installing essentials..."
apt install -y python3 python3-pip python3-venv git nginx certbot python3-certbot-nginx curl gnupg ufw

# 3. Install MongoDB 7.0
echo "📦 Installing MongoDB..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod
echo "✅ MongoDB installed and running"

# 4. Clone the repo
echo "📦 Cloning repository..."
cd /opt
git clone https://github.com/jmaybes/okcarevents.git
cd okcarevents/backend

# 5. Setup Python virtual environment
echo "🐍 Setting up Python environment..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 6. Create .env file
echo "⚙️ Creating environment config..."
cat > .env << 'ENVFILE'
MONGO_URL=mongodb://localhost:27017/test_database
JWT_SECRET=your-super-secret-jwt-key-change-this-to-something-random
GOOGLE_CLIENT_ID=your-google-client-id
EMERGENT_LLM_KEY=your-emergent-llm-key
ENVFILE

echo ""
echo "⚠️  IMPORTANT: Edit /opt/okcarevents/backend/.env with your actual API keys!"
echo ""

# 7. Create systemd service for the backend
echo "🔧 Creating systemd service..."
cat > /etc/systemd/system/okcarevents.service << 'SERVICEFILE'
[Unit]
Description=Oklahoma Car Meets Backend API
After=network.target mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/okcarevents/backend
Environment=PATH=/opt/okcarevents/backend/venv/bin:/usr/bin
ExecStart=/opt/okcarevents/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEFILE

systemctl daemon-reload
systemctl enable okcarevents
systemctl start okcarevents
echo "✅ Backend service started on port 8001"

# 8. Configure Nginx as reverse proxy
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/okcarevents << 'NGINXFILE'
server {
    listen 80;
    server_name api.okccarmeets.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
NGINXFILE

ln -sf /etc/nginx/sites-available/okcarevents /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
echo "✅ Nginx configured"

# 9. Setup firewall
echo "🔒 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "✅ Firewall configured"

# 10. Setup SSL (run after DNS propagates)
echo ""
echo "============================================"
echo "✅ SETUP COMPLETE!"
echo "============================================"
echo ""
echo "Your backend is running at: http://api.okccarmeets.com"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Edit your API keys:"
echo "   nano /opt/okcarevents/backend/.env"
echo "   (Add your JWT_SECRET, GOOGLE_CLIENT_ID, EMERGENT_LLM_KEY)"
echo "   Then restart: systemctl restart okcarevents"
echo ""
echo "2. Once DNS propagates (5-30 min), add free SSL:"
echo "   certbot --nginx -d api.okccarmeets.com"
echo ""
echo "3. Import your database (upload db_export.tar.gz first):"
echo "   cd /tmp && tar xzf db_export.tar.gz"
echo "   mongorestore --db test_database /tmp/db_export/test_database/"
echo ""
echo "4. Update your Expo app's eas.json:"
echo "   Change EXPO_PUBLIC_BACKEND_URL to: https://api.okccarmeets.com"
echo ""
echo "5. Rebuild your app:"
echo "   eas build --platform ios"
echo "   eas build --platform android"
echo ""
echo "============================================"
