#!/bin/bash
# Exit on error
set -e

DEPLOY_DIR="/servers/retrosweeper"
REPO_DIR="/home/gemini/repos/kbs-cloud/retrosweeper"

# Find Node.js path (default to NVM directory if not in current PATH)
NODE_EXEC=$(which node || echo "/home/gemini/.nvm/versions/node/v24.16.0/bin/node")
NODE_BIN=$(dirname "$NODE_EXEC")

echo "=== Starting RetroSweeper Deployment ==="
echo "Node binary directory: $NODE_BIN"

# Ensure NVM node directory is at the front of PATH so npm works correctly
export PATH="$NODE_BIN:$PATH"

# Run tests first
echo "Running tests in $REPO_DIR..."
cd "$REPO_DIR"
npm run test:unit

# Build the project
echo "Building project in $REPO_DIR..."
npm run build

# Prepare deploy folder
echo "Preparing deploy folder at $DEPLOY_DIR..."
if [ ! -d "$DEPLOY_DIR" ]; then
    sudo mkdir -p "$DEPLOY_DIR"
    sudo chown -R gemini:gemini "$DEPLOY_DIR"
fi

# Copy built files and package files
echo "Copying files to $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR/src/game/dist"
mkdir -p "$DEPLOY_DIR/dist"

cp -R dist/* "$DEPLOY_DIR/dist/"
cp -R src/game/dist/* "$DEPLOY_DIR/src/game/dist/"
cp server.cjs "$DEPLOY_DIR/"
cp package.json package-lock.json "$DEPLOY_DIR/"
cp register_game.cjs "$DEPLOY_DIR/"

# Preserve SQLite database if it exists in repo but not in deploy dir
if [ -f "$REPO_DIR/retrosweeper.db" ] && [ ! -f "$DEPLOY_DIR/retrosweeper.db" ]; then
    echo "Copying existing database to $DEPLOY_DIR..."
    cp "$REPO_DIR/retrosweeper.db" "$DEPLOY_DIR/retrosweeper.db"
fi

# Install production dependencies
echo "Installing production node modules in $DEPLOY_DIR..."
cd "$DEPLOY_DIR"
npm ci --omit=dev

# Write systemd service file
echo "Configuring systemd service..."
SERVICE_FILE="/etc/systemd/system/retrosweeper.service"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=RetroSweeper Game Service
After=network.target

[Service]
Type=simple
User=gemini
WorkingDirectory=$DEPLOY_DIR
ExecStart=$NODE_BIN/node server.cjs
Restart=always
Environment=NODE_ENV=production BACKEND_PORT=20006 FRONTEND_PORT=19006 DATABASE_PATH=$DEPLOY_DIR/retrosweeper.db AUTH_SERVER_URL=http://localhost:20001 HUB_API_URL=http://localhost:20000 HUB_APP_TOKEN=retrosweeper_token_dev_777
Environment="PATH=$NODE_BIN:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[Install]
WantedBy=multi-user.target
EOF

# Reload and restart service
echo "Reloading systemd and restarting retrosweeper service..."
sudo systemctl daemon-reload
sudo systemctl enable retrosweeper
sudo systemctl restart retrosweeper

# Run the database registration utility
echo "Registering application and achievements in the Hub catalog..."
node register_game.cjs

echo "=== Deployment Finished Successfully ==="
