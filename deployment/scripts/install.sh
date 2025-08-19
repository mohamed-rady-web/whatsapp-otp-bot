#!/bin/bash

# WhatsApp OTP Bot - VPS Installation Script
# This script installs and configures the WhatsApp OTP Bot on a Linux VPS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="whatsapp-otp-bot"
APP_USER="whatsapp"
APP_DIR="/opt/$APP_NAME"
SERVICE_NAME="whatsapp-bot"
GITHUB_REPO="https://github.com/mohamed-rady-web/whatsapp-otp-bot.git"

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        exit 1
    fi
}

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VERSION=$VERSION_ID
    else
        print_error "Cannot detect OS"
        exit 1
    fi
    
    print_status "Detected OS: $OS $VERSION"
}

# Install system dependencies
install_dependencies() {
    print_status "Installing system dependencies..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        apt-get update
        apt-get install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates
        
        # Install Node.js
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
        
        # Install Chrome/Chromium
        apt-get install -y chromium-browser
        
        # Install other dependencies
        apt-get install -y git nginx certbot python3-certbot-nginx ufw fail2ban
        
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Rocky"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        yum update -y
        
        # Install Node.js
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
        
        # Install Chrome/Chromium
        yum install -y chromium
        
        # Install other dependencies
        yum install -y git nginx certbot python3-certbot-nginx firewalld fail2ban
        
    else
        print_error "Unsupported OS: $OS"
        exit 1
    fi
    
    print_success "System dependencies installed"
}

# Create application user
create_user() {
    print_status "Creating application user..."
    
    if ! id "$APP_USER" &>/dev/null; then
        useradd -r -s /bin/bash -d $APP_DIR $APP_USER
        print_success "User $APP_USER created"
    else
        print_warning "User $APP_USER already exists"
    fi
}

# Create application directory
create_directories() {
    print_status "Creating application directories..."
    
    mkdir -p $APP_DIR
    mkdir -p $APP_DIR/data
    mkdir -p $APP_DIR/logs
    mkdir -p $APP_DIR/backups
    
    chown -R $APP_USER:$APP_USER $APP_DIR
    chmod 755 $APP_DIR
    chmod 750 $APP_DIR/data $APP_DIR/logs $APP_DIR/backups
    
    print_success "Directories created"
}

# Clone and install application
install_application() {
    print_status "Installing WhatsApp OTP Bot..."
    
    # Clone repository
    if [ -d "$APP_DIR/.git" ]; then
        cd $APP_DIR
        sudo -u $APP_USER git pull
    else
        sudo -u $APP_USER git clone $GITHUB_REPO $APP_DIR
        cd $APP_DIR
    fi
    
    # Install dependencies
    sudo -u $APP_USER npm install --production
    
    # Copy environment file
    if [ ! -f "$APP_DIR/.env" ]; then
        sudo -u $APP_USER cp .env.example .env
        print_warning "Please edit $APP_DIR/.env with your configuration"
    fi
    
    print_success "Application installed"
}

# Install systemd service
install_service() {
    print_status "Installing systemd service..."
    
    cp $APP_DIR/deployment/systemd/whatsapp-bot.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    
    print_success "Systemd service installed"
}

# Configure Nginx
configure_nginx() {
    print_status "Configuring Nginx..."
    
    # Backup default config
    if [ -f /etc/nginx/sites-available/default ]; then
        mv /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
    fi
    
    # Copy Nginx configuration
    cp $APP_DIR/deployment/nginx/nginx.conf /etc/nginx/
    cp $APP_DIR/deployment/nginx/default.conf /etc/nginx/sites-available/whatsapp-bot
    
    # Enable site
    ln -sf /etc/nginx/sites-available/whatsapp-bot /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    nginx -t
    
    # Enable and start Nginx
    systemctl enable nginx
    systemctl restart nginx
    
    print_success "Nginx configured"
}

# Configure firewall
configure_firewall() {
    print_status "Configuring firewall..."
    
    if command -v ufw >/dev/null 2>&1; then
        # Ubuntu/Debian UFW
        ufw --force reset
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow ssh
        ufw allow 'Nginx Full'
        ufw --force enable
    elif command -v firewall-cmd >/dev/null 2>&1; then
        # CentOS/RHEL firewalld
        systemctl enable firewalld
        systemctl start firewalld
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload
    fi
    
    print_success "Firewall configured"
}

# Configure fail2ban
configure_fail2ban() {
    print_status "Configuring fail2ban..."
    
    # Create jail configuration
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/*.log
EOF
    
    systemctl enable fail2ban
    systemctl restart fail2ban
    
    print_success "Fail2ban configured"
}

# Start services
start_services() {
    print_status "Starting services..."
    
    systemctl start $SERVICE_NAME
    systemctl status $SERVICE_NAME --no-pager
    
    print_success "Services started"
}

# Display completion message
show_completion() {
    echo ""
    print_success "WhatsApp OTP Bot installation completed!"
    echo ""
    print_status "Next steps:"
    echo "1. Edit configuration: $APP_DIR/.env"
    echo "2. Set up SSL certificate: sudo ./setup-ssl.sh your-domain.com"
    echo "3. Restart the service: sudo systemctl restart $SERVICE_NAME"
    echo "4. Access dashboard: https://your-domain.com/dashboard"
    echo ""
    print_status "Useful commands:"
    echo "- Check status: sudo systemctl status $SERVICE_NAME"
    echo "- View logs: sudo journalctl -u $SERVICE_NAME -f"
    echo "- Restart service: sudo systemctl restart $SERVICE_NAME"
    echo ""
    print_warning "Don't forget to:"
    echo "- Configure your domain name in DNS"
    echo "- Set up SSL certificate"
    echo "- Update the .env file with your settings"
    echo "- Change default admin credentials"
}

# Main installation function
main() {
    echo "=================================================="
    echo "   WhatsApp OTP Bot - VPS Installation Script"
    echo "=================================================="
    echo ""
    
    check_root
    detect_os
    install_dependencies
    create_user
    create_directories
    install_application
    install_service
    configure_nginx
    configure_firewall
    configure_fail2ban
    start_services
    show_completion
}

# Run main function
main "$@"