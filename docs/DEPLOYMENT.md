# WhatsApp OTP Bot Deployment Guide

This guide covers various deployment options for the WhatsApp OTP Bot, from simple VPS deployment to enterprise-grade Docker setups.

## Quick Deployment Options

### 1. Automated VPS Deployment (Recommended)

The fastest way to deploy on a VPS:

```bash
# Run the automated installation script
curl -sSL https://raw.githubusercontent.com/mohamed-rady-web/whatsapp-otp-bot/main/deployment/scripts/install.sh | sudo bash

# Setup SSL certificate
sudo /opt/whatsapp-otp-bot/deployment/scripts/setup-ssl.sh your-domain.com admin@your-domain.com
```

### 2. Docker Deployment

For containerized deployment:

```bash
git clone https://github.com/mohamed-rady-web/whatsapp-otp-bot.git
cd whatsapp-otp-bot
cp .env.example .env
# Edit .env file with your configuration
docker-compose up -d
```

### 3. Manual Installation

For custom setups or when you need full control.

## Prerequisites

### System Requirements

**Minimum Requirements:**
- 1 GB RAM
- 1 CPU Core
- 10 GB Disk Space
- Linux Ubuntu 20.04+ / CentOS 8+ / Debian 11+

**Recommended for Production:**
- 2 GB RAM
- 2 CPU Cores  
- 20 GB SSD Storage
- Linux Ubuntu 22.04 LTS

### Software Dependencies

- **Node.js** 18.x or higher
- **Chrome/Chromium** browser
- **Git** for repository cloning
- **Nginx** (for reverse proxy)
- **Certbot** (for SSL certificates)

## VPS Deployment

### Step 1: Server Preparation

**Update System:**
```bash
sudo apt update && sudo apt upgrade -y
```

**Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Install Chrome/Chromium:**
```bash
sudo apt-get install -y chromium-browser
```

**Install Additional Dependencies:**
```bash
sudo apt-get install -y git nginx certbot python3-certbot-nginx ufw fail2ban
```

### Step 2: Application Setup

**Create Application User:**
```bash
sudo useradd -r -s /bin/bash -d /opt/whatsapp-otp-bot whatsapp
```

**Clone Repository:**
```bash
sudo git clone https://github.com/mohamed-rady-web/whatsapp-otp-bot.git /opt/whatsapp-otp-bot
sudo chown -R whatsapp:whatsapp /opt/whatsapp-otp-bot
```

**Install Dependencies:**
```bash
cd /opt/whatsapp-otp-bot
sudo -u whatsapp npm install --production
```

**Configure Environment:**
```bash
sudo -u whatsapp cp .env.example .env
sudo -u whatsapp nano .env
```

### Step 3: System Service Setup

**Install Systemd Service:**
```bash
sudo cp /opt/whatsapp-otp-bot/deployment/systemd/whatsapp-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-bot
sudo systemctl start whatsapp-bot
```

**Check Service Status:**
```bash
sudo systemctl status whatsapp-bot
sudo journalctl -u whatsapp-bot -f
```

### Step 4: Nginx Configuration

**Install Nginx Configuration:**
```bash
sudo cp /opt/whatsapp-otp-bot/deployment/nginx/nginx.conf /etc/nginx/
sudo cp /opt/whatsapp-otp-bot/deployment/nginx/default.conf /etc/nginx/sites-available/whatsapp-bot
sudo ln -sf /etc/nginx/sites-available/whatsapp-bot /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

**Test and Start Nginx:**
```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

### Step 5: SSL Certificate Setup

**Generate SSL Certificate:**
```bash
sudo /opt/whatsapp-otp-bot/deployment/scripts/setup-ssl.sh your-domain.com admin@your-domain.com
```

### Step 6: Firewall Configuration

**Configure UFW:**
```bash
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

### Step 7: Security Hardening

**Configure Fail2Ban:**
```bash
sudo cp /opt/whatsapp-otp-bot/deployment/fail2ban/jail.local /etc/fail2ban/
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
```

## Docker Deployment

### Single Container Deployment

**Dockerfile Deployment:**
```bash
# Build image
docker build -t whatsapp-otp-bot .

# Run container
docker run -d \
  --name whatsapp-otp-bot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v whatsapp_data:/app/data \
  -v whatsapp_logs:/app/logs \
  -v /dev/shm:/dev/shm \
  --cap-add=SYS_ADMIN \
  --security-opt seccomp=unconfined \
  whatsapp-otp-bot
```

### Docker Compose Deployment

**Basic Setup:**
```yaml
version: '3.8'

services:
  whatsapp-otp-bot:
    build: .
    container_name: whatsapp-otp-bot
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - whatsapp_data:/app/data
      - whatsapp_logs:/app/logs
      - /dev/shm:/dev/shm
    cap_add:
      - SYS_ADMIN
    security_opt:
      - seccomp:unconfined

volumes:
  whatsapp_data:
  whatsapp_logs:
```

**Production Setup with Nginx:**
```bash
cp docker-compose.yml docker-compose.prod.yml
# Edit docker-compose.prod.yml as needed
docker-compose -f docker-compose.prod.yml up -d
```

### Docker Security Considerations

**Security Best Practices:**
- Run containers as non-root user
- Use specific image tags, not `latest`
- Limit container capabilities
- Use Docker secrets for sensitive data
- Regularly update base images

## Cloud Platform Deployment

### AWS EC2 Deployment

**Launch EC2 Instance:**
1. Choose Ubuntu 22.04 LTS AMI
2. Select t3.medium instance type (minimum)
3. Configure security group (ports 22, 80, 443)
4. Launch with SSH key pair

**Setup on EC2:**
```bash
# Connect to instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Run installation script
curl -sSL https://raw.githubusercontent.com/mohamed-rady-web/whatsapp-otp-bot/main/deployment/scripts/install.sh | sudo bash

# Configure domain and SSL
sudo /opt/whatsapp-otp-bot/deployment/scripts/setup-ssl.sh your-domain.com
```

### DigitalOcean Droplet Deployment

**Create Droplet:**
1. Choose Ubuntu 22.04 x64
2. Select $10/month plan (2GB RAM)
3. Add SSH key
4. Create droplet

**Deploy Application:**
```bash
# Connect to droplet
ssh root@your-droplet-ip

# Run installation
curl -sSL https://raw.githubusercontent.com/mohamed-rady-web/whatsapp-otp-bot/main/deployment/scripts/install.sh | bash

# Setup SSL
/opt/whatsapp-otp-bot/deployment/scripts/setup-ssl.sh your-domain.com
```

### Google Cloud Platform (GCP)

**Create VM Instance:**
```bash
gcloud compute instances create whatsapp-otp-bot \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --machine-type=e2-medium \
    --zone=us-central1-a \
    --tags=http-server,https-server
```

**Deploy Application:**
```bash
# SSH to instance
gcloud compute ssh whatsapp-otp-bot

# Install application
curl -sSL https://raw.githubusercontent.com/mohamed-rady-web/whatsapp-otp-bot/main/deployment/scripts/install.sh | sudo bash
```

## Kubernetes Deployment

### Basic Kubernetes Deployment

**Namespace:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: whatsapp-otp-bot
```

**ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: whatsapp-config
  namespace: whatsapp-otp-bot
data:
  NODE_ENV: "production"
  PORT: "3000"
  CHROME_HEADLESS: "true"
```

**Secret:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: whatsapp-secrets
  namespace: whatsapp-otp-bot
type: Opaque
stringData:
  JWT_SECRET: "your-jwt-secret"
  API_KEY_SALT_ROUNDS: "12"
  DASHBOARD_USERNAME: "admin"
  DASHBOARD_PASSWORD: "secure-password"
```

**Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whatsapp-otp-bot
  namespace: whatsapp-otp-bot
spec:
  replicas: 1
  selector:
    matchLabels:
      app: whatsapp-otp-bot
  template:
    metadata:
      labels:
        app: whatsapp-otp-bot
    spec:
      containers:
      - name: whatsapp-otp-bot
        image: whatsapp-otp-bot:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: whatsapp-config
        - secretRef:
            name: whatsapp-secrets
        volumeMounts:
        - name: data
          mountPath: /app/data
        - name: logs
          mountPath: /app/logs
        - name: shm
          mountPath: /dev/shm
        securityContext:
          capabilities:
            add:
            - SYS_ADMIN
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: whatsapp-data-pvc
      - name: logs
        persistentVolumeClaim:
          claimName: whatsapp-logs-pvc
      - name: shm
        emptyDir:
          medium: Memory
          sizeLimit: 2Gi
```

**Service:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: whatsapp-otp-bot-service
  namespace: whatsapp-otp-bot
spec:
  selector:
    app: whatsapp-otp-bot
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

**Ingress:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: whatsapp-otp-bot-ingress
  namespace: whatsapp-otp-bot
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - your-domain.com
    secretName: whatsapp-tls
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: whatsapp-otp-bot-service
            port:
              number: 80
```

## Environment Configuration

### Production Environment Variables

**Required Variables:**
```bash
# Server
NODE_ENV=production
PORT=3000
API_BASE_URL=https://your-domain.com

# Database
DB_PATH=/app/data/database.sqlite
DB_BACKUP_PATH=/app/data/backups

# WhatsApp
WHATSAPP_SESSION_PATH=/app/data/sessions
WHATSAPP_TIMEOUT=30000
CHROME_HEADLESS=true
CHROME_USER_DATA_DIR=/app/data/chrome-user-data

# Security
JWT_SECRET=your-super-secret-jwt-key-here
API_KEY_SALT_ROUNDS=12
SESSION_SECRET=your-session-secret-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/app/logs/app.log
LOG_MAX_FILES=10
LOG_MAX_SIZE=10m

# CORS
CORS_ORIGIN=https://your-domain.com
CORS_CREDENTIALS=true

# Dashboard
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=very-secure-password-here
```

**Optional Variables:**
```bash
# Backup
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=30

# Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NOTIFICATION_EMAIL=admin@your-domain.com

# Webhooks
WEBHOOK_URL=https://your-app.com/webhook
WEBHOOK_SECRET=webhook-secret-key
```

## Monitoring and Maintenance

### Health Checks

**Application Health Check:**
```bash
curl -f http://localhost:3000/health || exit 1
```

**Service Status Check:**
```bash
sudo systemctl is-active whatsapp-bot
```

**Nginx Status Check:**
```bash
sudo nginx -t && sudo systemctl is-active nginx
```

### Log Management

**View Application Logs:**
```bash
sudo journalctl -u whatsapp-bot -f
```

**View Nginx Logs:**
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

**Application Log Files:**
```bash
tail -f /opt/whatsapp-otp-bot/logs/app.log
tail -f /opt/whatsapp-otp-bot/logs/error.log
```

### Backup Strategy

**Database Backup Script:**
```bash
#!/bin/bash
BACKUP_DIR="/opt/whatsapp-otp-bot/backups"
DB_PATH="/opt/whatsapp-otp-bot/data/database.sqlite"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp $DB_PATH $BACKUP_DIR/database_backup_$DATE.sqlite

# Keep only last 30 days of backups
find $BACKUP_DIR -name "database_backup_*.sqlite" -mtime +30 -delete
```

**Automated Backup with Cron:**
```bash
# Add to crontab (sudo crontab -e)
0 2 * * * /opt/whatsapp-otp-bot/scripts/backup.sh
```

### Updates and Maintenance

**Update Application:**
```bash
cd /opt/whatsapp-otp-bot
sudo -u whatsapp git pull
sudo -u whatsapp npm install --production
sudo systemctl restart whatsapp-bot
```

**Update System:**
```bash
sudo apt update && sudo apt upgrade -y
sudo systemctl restart whatsapp-bot
```

## Scaling and Load Balancing

### Horizontal Scaling

For high-traffic scenarios, deploy multiple instances behind a load balancer:

**Nginx Load Balancer Configuration:**
```nginx
upstream whatsapp_backend {
    server 10.0.1.10:3000;
    server 10.0.1.11:3000;
    server 10.0.1.12:3000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://whatsapp_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Database Clustering

For production environments, consider:
- Database replication
- Shared file systems for session data
- Redis for session storage
- External database (PostgreSQL/MySQL)

## Troubleshooting

### Common Issues

**Service Won't Start:**
```bash
# Check service status
sudo systemctl status whatsapp-bot

# Check logs
sudo journalctl -u whatsapp-bot --no-pager

# Check port availability
sudo netstat -tulpn | grep :3000
```

**Chrome/Selenium Issues:**
```bash
# Check Chrome installation
chromium-browser --version

# Test Chrome in headless mode
chromium-browser --headless --no-sandbox --dump-dom https://google.com

# Check display server
echo $DISPLAY
```

**Permission Issues:**
```bash
# Fix ownership
sudo chown -R whatsapp:whatsapp /opt/whatsapp-otp-bot

# Fix permissions
sudo chmod 755 /opt/whatsapp-otp-bot
sudo chmod 750 /opt/whatsapp-otp-bot/data
```

**SSL Certificate Issues:**
```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew --dry-run

# Test SSL
openssl s_client -connect your-domain.com:443
```

### Performance Optimization

**System Optimization:**
```bash
# Increase file limits
echo "whatsapp soft nofile 65536" >> /etc/security/limits.conf
echo "whatsapp hard nofile 65536" >> /etc/security/limits.conf

# Optimize kernel parameters
echo "net.core.somaxconn = 65536" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65536" >> /etc/sysctl.conf
```

**Node.js Optimization:**
```bash
# Set Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=2048"
```

## Security Considerations

### Security Checklist

- [ ] Change default dashboard credentials
- [ ] Use strong JWT secrets
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure firewall (UFW/iptables)
- [ ] Set up fail2ban for intrusion prevention
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity
- [ ] Use API key authentication
- [ ] Implement rate limiting
- [ ] Secure file permissions
- [ ] Run application as non-root user
- [ ] Disable unnecessary services
- [ ] Configure security headers

### Security Hardening

**SSH Hardening:**
```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Recommended settings:
Port 2222
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
```

**Firewall Rules:**
```bash
# Allow only necessary ports
sudo ufw allow 2222/tcp  # SSH (custom port)
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 3000/tcp   # Block direct access to app
```

## Support and Maintenance

### Monitoring Tools

**System Monitoring:**
- Netdata for real-time monitoring
- Prometheus + Grafana for metrics
- ELK stack for log analysis
- Uptime Robot for external monitoring

**Application Monitoring:**
- PM2 for process monitoring
- Custom health check endpoints
- Application performance monitoring (APM)
- Error tracking (Sentry)

### Professional Support

For production deployments requiring professional support:
- Deployment consultation
- Performance optimization  
- Security hardening
- Custom feature development
- SLA-backed maintenance

Contact: support@your-domain.com

## Conclusion

This deployment guide covers everything from simple VPS setup to enterprise Kubernetes deployment. Choose the deployment method that best fits your requirements and infrastructure.

For additional help:
- GitHub Issues for bugs and feature requests
- Documentation for detailed configuration
- Community forums for general support