#!/bin/bash
# ============================================
# Oklahoma Bike Meets - VPS Setup Script (ADD-ON)
# Run this on your EXISTING Car Meets VPS
# to add Bike Meets alongside it on the same machine.
#
# - Car Meets:  api.okccarmeets.com  -> port 8001 -> db test_database
# - Bike Meets: api.okcbikemeets.com -> port 8002 -> db okcbikemeets_db
#
# Usage: chmod +x vps-setup.sh && sudo ./vps-setup.sh
# ============================================

set -e

# ----- EDIT THIS LINE IF YOUR REPO URL CHANGES -----
REPO_URL="https://github.com/jmaybes/oklahoma-bike-meets.git"   # Oklahoma Bike Meets repo
DOMAIN="api.okcbikemeets.com"
# --------------------------------------------------

APP_NAME="okcbikemeets"
APP_DIR="/opt/${APP_NAME}"
BACKEND_DIR="${APP_DIR}/backend"
SERVICE_NAME="${APP_NAME}"
PORT="8002"                 # <-- different from Car Meets (8001)
DB_NAME="${APP_NAME}_db"    # <-- separate MongoDB database

echo "🏍️  Setting up Oklahoma Bike Meets Backend on existing VPS..."
echo "    Domain : ${DOMAIN}"
echo "    Port   : ${PORT}"
echo "    DB name: ${DB_NAME}"
echo ""

# 1. Sanity check — MongoDB & Nginx must already exist (from Car Meets setup)
if ! systemctl is-active --quiet mongod; then
    echo "❌ MongoDB is not running. Is Car Meets set up on this VPS?"
    exit 1
fi
if ! command -v nginx >/dev/null 2>&1; then
    echo "❌ Nginx is not installed. Is Car Meets set up on this VPS?"
    exit 1
fi
echo "✅ MongoDB and Nginx are already present"

# 2. Clone the Bike Meets repo
if [ -d "${APP_DIR}" ]; then
    echo "📦 Repo already cloned at ${APP_DIR}, pulling latest..."
    cd "${APP_DIR}"
    git pull
else
    echo "📦 Cloning repository to ${APP_DIR}..."
    cd /opt
    git clone "${REPO_URL}" "${APP_NAME}"
fi

# 3. Setup Python venv + install requirements
echo "🐍 Setting up Python environment..."
cd "${BACKEND_DIR}"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
# emergentintegrations is hosted on Emergent's private index — needs --extra-index-url
pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
deactivate

# 4. Create .env file (only if it doesn't exist yet)
if [ ! -f "${BACKEND_DIR}/.env" ]; then
    echo "⚙️  Creating environment config..."
    cat > "${BACKEND_DIR}/.env" << ENVFILE
MONGO_URL=mongodb://localhost:27017/${DB_NAME}
DB_NAME=${DB_NAME}
JWT_SECRET=CHANGE_ME_TO_A_RANDOM_STRING_FOR_BIKE_MEETS
GOOGLE_CLIENT_ID=your-google-client-id
EMERGENT_LLM_KEY=your-emergent-llm-key
ENVFILE
    echo ""
    echo "⚠️  IMPORTANT: edit ${BACKEND_DIR}/.env with your real values, THEN restart the service:"
    echo "    sudo systemctl restart ${SERVICE_NAME}"
    echo ""
else
    echo "✅ .env already exists at ${BACKEND_DIR}/.env — leaving it untouched"
fi

# 5. Create systemd service
echo "🔧 Creating systemd service ${SERVICE_NAME}..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << SERVICEFILE
[Unit]
Description=Oklahoma Bike Meets Backend API
After=network.target mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=${BACKEND_DIR}
Environment=PATH=${BACKEND_DIR}/venv/bin:/usr/bin
ExecStart=${BACKEND_DIR}/venv/bin/uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEFILE

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
echo "✅ Backend service running on port ${PORT}"

# 6. Configure Nginx as reverse proxy for api.okcbikemeets.com
echo "🌐 Configuring Nginx for ${DOMAIN}..."
cat > "/etc/nginx/sites-available/${APP_NAME}" << NGINXFILE
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
NGINXFILE

ln -sf "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
nginx -t
systemctl reload nginx
echo "✅ Nginx configured for ${DOMAIN}"

# 7. Firewall — already configured by Car Meets setup, but make sure 80/443 are open
ufw allow 80/tcp  >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true

# 8. Done — print SSL + next-steps instructions
echo ""
echo "============================================"
echo "✅ BIKE MEETS BACKEND SETUP COMPLETE!"
echo "============================================"
echo ""
echo "Your Bike Meets backend is live at:"
echo "    http://${DOMAIN}"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Edit your API keys in:"
echo "     nano ${BACKEND_DIR}/.env"
echo "   Then restart: sudo systemctl restart ${SERVICE_NAME}"
echo ""
echo "2. Verify it's running:"
echo "     systemctl status ${SERVICE_NAME}"
echo "     curl http://127.0.0.1:${PORT}/api/"
echo ""
echo "3. Wait for DNS for ${DOMAIN} to propagate (5-30 min)"
echo "   Then add free SSL:"
echo "     sudo certbot --nginx -d ${DOMAIN}"
echo ""
echo "4. After SSL, test from outside:"
echo "     curl -I https://${DOMAIN}/api/"
echo ""
echo "5. Your Expo app already points to https://${DOMAIN}"
echo "   (configured in eas.json). Just rebuild:"
echo "     eas build --profile preview --platform android"
echo "     eas build --profile preview --platform ios"
echo ""
echo "USEFUL COMMANDS:"
echo "    Logs:     journalctl -u ${SERVICE_NAME} -f"
echo "    Restart:  systemctl restart ${SERVICE_NAME}"
echo "    Stop:     systemctl stop ${SERVICE_NAME}"
echo "    Mongo:    mongosh ${DB_NAME}"
echo ""
echo "============================================"
