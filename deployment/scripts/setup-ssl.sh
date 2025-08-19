#!/bin/bash

# WhatsApp OTP Bot - SSL Certificate Setup Script
# Sets up Let's Encrypt SSL certificate with auto-renewal

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Get domain name
get_domain() {
    if [ -z "$1" ]; then
        print_error "Usage: $0 <domain-name> [email]"
        print_status "Example: $0 bot.example.com admin@example.com"
        exit 1
    fi
    
    DOMAIN="$1"
    EMAIL="${2:-admin@$DOMAIN}"
    
    print_status "Setting up SSL for domain: $DOMAIN"
    print_status "Contact email: $EMAIL"
}

# Validate domain
validate_domain() {
    print_status "Validating domain configuration..."
    
    # Check if domain resolves to this server
    SERVER_IP=$(curl -s ifconfig.me)
    DOMAIN_IP=$(dig +short $DOMAIN)
    
    if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
        print_warning "Domain $DOMAIN does not resolve to this server ($SERVER_IP)"
        print_warning "Domain resolves to: $DOMAIN_IP"
        print_warning "Please update your DNS records before continuing"
        
        read -p "Continue anyway? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_success "Domain validation passed"
    fi
}

# Stop Nginx temporarily
stop_nginx() {
    print_status "Stopping Nginx temporarily..."
    systemctl stop nginx
}

# Generate SSL certificate
generate_certificate() {
    print_status "Generating SSL certificate..."
    
    certbot certonly \
        --standalone \
        --agree-tos \
        --no-eff-email \
        --email $EMAIL \
        -d $DOMAIN
    
    if [ $? -eq 0 ]; then
        print_success "SSL certificate generated successfully"
    else
        print_error "Failed to generate SSL certificate"
        exit 1
    fi
}

# Generate DH parameters
generate_dhparam() {
    print_status "Generating DH parameters (this may take a while)..."
    
    if [ ! -f /etc/ssl/certs/dhparam.pem ]; then
        openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048
        print_success "DH parameters generated"
    else
        print_warning "DH parameters already exist"
    fi
}

# Update Nginx configuration
update_nginx_config() {
    print_status "Updating Nginx configuration..."
    
    # Create SSL directory
    mkdir -p /etc/nginx/ssl
    
    # Copy certificates to Nginx SSL directory
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/nginx/ssl/cert.pem
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/nginx/ssl/key.pem
    cp /etc/ssl/certs/dhparam.pem /etc/nginx/ssl/dhparam.pem
    
    # Update server name in Nginx config
    sed -i "s/server_name _;/server_name $DOMAIN;/g" /etc/nginx/sites-available/whatsapp-bot
    
    # Test Nginx configuration
    nginx -t
    
    if [ $? -eq 0 ]; then
        print_success "Nginx configuration updated"
    else
        print_error "Nginx configuration test failed"
        exit 1
    fi
}

# Start Nginx
start_nginx() {
    print_status "Starting Nginx..."
    systemctl start nginx
    systemctl reload nginx
    print_success "Nginx started"
}

# Set up auto-renewal
setup_auto_renewal() {
    print_status "Setting up auto-renewal..."
    
    # Create renewal script
    cat > /etc/cron.d/certbot-renewal << EOF
# Renew Let's Encrypt certificates
0 2 * * * root /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
EOF
    
    # Create renewal hook script
    mkdir -p /etc/letsencrypt/renewal-hooks/post
    cat > /etc/letsencrypt/renewal-hooks/post/nginx-reload.sh << 'EOF'
#!/bin/bash
# Copy renewed certificates to Nginx
DOMAIN="$RENEWED_DOMAINS"
if [ -n "$DOMAIN" ]; then
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/nginx/ssl/cert.pem
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/nginx/ssl/key.pem
    systemctl reload nginx
fi
EOF
    
    chmod +x /etc/letsencrypt/renewal-hooks/post/nginx-reload.sh
    
    print_success "Auto-renewal configured"
}

# Test SSL configuration
test_ssl() {
    print_status "Testing SSL configuration..."
    
    # Wait a moment for Nginx to fully start
    sleep 5
    
    # Test HTTPS connection
    if curl -s -I https://$DOMAIN/health >/dev/null; then
        print_success "SSL configuration test passed"
    else
        print_warning "SSL test failed - check your configuration"
    fi
    
    # Display SSL grade
    print_status "You can test your SSL configuration at:"
    echo "https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
}

# Create security headers test
create_security_test() {
    print_status "Creating security headers test..."
    
    cat > /opt/test-security-headers.sh << EOF
#!/bin/bash
echo "Testing security headers for $DOMAIN..."
curl -I https://$DOMAIN/health | grep -E "(Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options|X-XSS-Protection|Referrer-Policy|Content-Security-Policy)"
EOF
    
    chmod +x /opt/test-security-headers.sh
    print_success "Security test script created at /opt/test-security-headers.sh"
}

# Display completion message
show_completion() {
    echo ""
    print_success "SSL certificate setup completed!"
    echo ""
    print_status "Certificate details:"
    echo "- Domain: $DOMAIN"
    echo "- Certificate: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    echo "- Private key: /etc/letsencrypt/live/$DOMAIN/privkey.pem"
    echo "- Auto-renewal: Configured"
    echo ""
    print_status "Your WhatsApp OTP Bot is now available at:"
    echo "https://$DOMAIN/dashboard"
    echo ""
    print_status "Useful commands:"
    echo "- Test renewal: sudo certbot renew --dry-run"
    echo "- Check certificate: sudo certbot certificates"
    echo "- Test security headers: sudo /opt/test-security-headers.sh"
    echo ""
    print_warning "Remember to:"
    echo "- Update your application configuration with the new domain"
    echo "- Test all functionality after SSL setup"
    echo "- Monitor certificate expiration"
}

# Main function
main() {
    echo "=============================================="
    echo "   WhatsApp OTP Bot - SSL Certificate Setup"
    echo "=============================================="
    echo ""
    
    check_root
    get_domain "$@"
    validate_domain
    stop_nginx
    generate_certificate
    generate_dhparam
    update_nginx_config
    start_nginx
    setup_auto_renewal
    test_ssl
    create_security_test
    show_completion
}

# Run main function
main "$@"