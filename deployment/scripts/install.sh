#!/bin/bash

# WhatsApp OTP Bot Installation Script for Linux VPS
# This script installs and configures the WhatsApp OTP Bot on a Linux VPS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root"
        exit 1
    fi
}

# Check OS compatibility
check_os() {
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        log_error "This script is designed for Linux systems only"
        exit 1
    fi
    
    log_info "OS check passed"
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    sudo apt update && sudo apt upgrade -y
    log_success "System packages updated"
}

# Install required dependencies
install_dependencies() {
    log_info "Installing required dependencies..."
    
    # Install Node.js 18
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Install additional packages
    sudo apt-get install -y \
        curl \
        wget \
        git \
        nginx \
        ufw \
        fail2ban \
        htop \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release
    
    log_success "Dependencies installed"
}

# Install Docker
install_docker() {
    log_info "Installing Docker..."
    
    if ! command -v docker &> /dev/null; then
        # Add Docker's official GPG key
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        
        # Add the repository
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Install Docker
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        
        # Add user to docker group
        sudo usermod -aG docker $USER
        
        log_success "Docker installed"
    else
        log_info "Docker already installed"
    fi
}

# Install Google Chrome
install_chrome() {
    log_info "Installing Google Chrome..."
    
    if ! command -v google-chrome &> /dev/null; then
        wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
        sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
        sudo apt-get update
        sudo apt-get install -y google-chrome-stable
        
        log_success "Google Chrome installed"
    else
        log_info "Google Chrome already installed"
    fi
}

# Create application directory
create_app_directory() {
    log_info "Creating application directory..."
    
    APP_DIR="/opt/whatsapp-otp-bot"
    sudo mkdir -p $APP_DIR
    sudo chown $USER:$USER $APP_DIR
    
    log_success "Application directory created at $APP_DIR"
}

# Download and setup application
setup_application() {
    log_info "Setting up application..."
    
    cd /opt/whatsapp-otp-bot
    
    # If git repository URL is provided, clone it
    if [ ! -z "$REPO_URL" ]; then
        git clone $REPO_URL .
    else
        log_warning "No repository URL provided. Please manually copy application files to /opt/whatsapp-otp-bot"
        return
    fi
    
    # Install dependencies
    npm install --production
    
    # Copy environment file
    cp .env.example .env
    
    # Generate secure secrets
    API_SECRET=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    ADMIN_TOKEN=$(openssl rand -hex 16)
    
    # Update environment file
    sed -i "s/your-secret-key-here-change-me/$API_SECRET/" .env
    sed -i "s/your-jwt-secret-here-change-me/$JWT_SECRET/" .env
    sed -i "s/admin-demo-token/$ADMIN_TOKEN/" .env
    sed -i "s/development/production/" .env
    
    log_success "Application setup completed"
    log_info "Admin token: $ADMIN_TOKEN (save this securely)"
}

# Create systemd service
create_systemd_service() {
    log_info "Creating systemd service..."
    
    sudo tee /etc/systemd/system/whatsapp-otp-bot.service > /dev/null <<EOF
[Unit]
Description=WhatsApp OTP Bot
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=$USER
ExecStart=/usr/bin/node /opt/whatsapp-otp-bot/src/app.js
WorkingDirectory=/opt/whatsapp-otp-bot
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable whatsapp-otp-bot
    
    log_success "Systemd service created"
}

# Configure Nginx
configure_nginx() {
    log_info "Configuring Nginx..."
    
    sudo tee /etc/nginx/sites-available/whatsapp-otp-bot > /dev/null <<EOF
server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
EOF

    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/whatsapp-otp-bot /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    sudo nginx -t
    
    # Restart nginx
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    log_success "Nginx configured"
}

# Configure firewall
configure_firewall() {
    log_info "Configuring firewall..."
    
    sudo ufw --force reset
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Enable firewall
    sudo ufw --force enable
    
    log_success "Firewall configured"
}

# Configure fail2ban
configure_fail2ban() {
    log_info "Configuring fail2ban..."
    
    sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

    sudo systemctl restart fail2ban
    sudo systemctl enable fail2ban
    
    log_success "Fail2ban configured"
}

# Start services
start_services() {
    log_info "Starting services..."
    
    # Start the application
    sudo systemctl start whatsapp-otp-bot
    sudo systemctl status whatsapp-otp-bot --no-pager -l
    
    log_success "Services started"
}

# Print installation summary
print_summary() {
    log_success "Installation completed!"
    echo
    echo "==================================="
    echo "WhatsApp OTP Bot Installation Summary"
    echo "==================================="
    echo
    echo "Application Directory: /opt/whatsapp-otp-bot"
    echo "Service Status: sudo systemctl status whatsapp-otp-bot"
    echo "View Logs: sudo journalctl -u whatsapp-otp-bot -f"
    echo "Dashboard URL: http://$(curl -s ifconfig.me || echo 'YOUR_SERVER_IP')/dashboard"
    echo "API Documentation: http://$(curl -s ifconfig.me || echo 'YOUR_SERVER_IP')/api/docs"
    echo
    echo "Admin Token: $ADMIN_TOKEN"
    echo "(Save this token securely - you'll need it for admin access)"
    echo
    echo "Next steps:"
    echo "1. Update DNS records to point your domain to this server"
    echo "2. Configure SSL certificate (recommended: use certbot for Let's Encrypt)"
    echo "3. Generate API keys via the dashboard or API"
    echo "4. Test the WhatsApp connection"
    echo
    echo "For SSL setup with Let's Encrypt:"
    echo "sudo apt install certbot python3-certbot-nginx"
    echo "sudo certbot --nginx -d yourdomain.com"
    echo
}

# Main installation function
main() {
    log_info "Starting WhatsApp OTP Bot installation..."
    
    check_root
    check_os
    update_system
    install_dependencies
    install_docker
    install_chrome
    create_app_directory
    setup_application
    create_systemd_service
    configure_nginx
    configure_firewall
    configure_fail2ban
    start_services
    print_summary
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --repo)
            REPO_URL="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--repo REPOSITORY_URL]"
            echo "Options:"
            echo "  --repo URL    Git repository URL to clone the application from"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main installation
main