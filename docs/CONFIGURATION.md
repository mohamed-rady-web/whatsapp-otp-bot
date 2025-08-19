# Configuration Guide

Complete configuration reference for the WhatsApp OTP Bot system.

## Environment Variables

### Required Configuration

#### Server Settings
```bash
# Port for the application to listen on
PORT=3000

# Environment mode (development, production)
NODE_ENV=production

# Base URL for API responses and links
API_BASE_URL=https://your-domain.com
```

#### Database Configuration
```bash
# SQLite database file path
DB_PATH=./data/database.sqlite

# Database backup directory
DB_BACKUP_PATH=./data/backups
```

#### WhatsApp Settings
```bash
# Session storage directory
WHATSAPP_SESSION_PATH=./data/sessions

# Connection timeout in milliseconds
WHATSAPP_TIMEOUT=30000

# Run Chrome in headless mode (true for production)
CHROME_HEADLESS=true

# Chrome user data directory for session persistence
CHROME_USER_DATA_DIR=./data/chrome-user-data

# Chrome binary path (optional, auto-detected)
CHROME_BIN=/usr/bin/chromium-browser
```

#### Security Configuration
```bash
# JWT secret for token signing (use a long, random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars

# Bcrypt salt rounds for API key hashing (10-15 recommended)
API_KEY_SALT_ROUNDS=12

# Session secret for Express sessions
SESSION_SECRET=your-session-secret-change-this-min-32-chars
```

### Optional Configuration

#### Rate Limiting
```bash
# Rate limit window in milliseconds (default: 15 minutes)
RATE_LIMIT_WINDOW_MS=900000

# Maximum requests per window per IP
RATE_LIMIT_MAX_REQUESTS=100
```

#### Logging Configuration
```bash
# Log level (error, warn, info, debug)
LOG_LEVEL=info

# Main log file path
LOG_FILE_PATH=./logs/app.log

# Maximum number of log files to keep
LOG_MAX_FILES=10

# Maximum size per log file
LOG_MAX_SIZE=10m
```

#### CORS Configuration
```bash
# Allowed CORS origins (comma-separated)
CORS_ORIGIN=https://your-domain.com

# Allow credentials in CORS requests
CORS_CREDENTIALS=true
```

#### Dashboard Authentication
```bash
# Dashboard admin username
DASHBOARD_USERNAME=admin

# Dashboard admin password (use a strong password)
DASHBOARD_PASSWORD=secure-admin-password-here
```

#### Backup Settings
```bash
# Automatic backup interval in hours
BACKUP_INTERVAL_HOURS=24

# Number of days to retain backups
BACKUP_RETENTION_DAYS=30
```

#### Email Notifications (Optional)
```bash
# SMTP server settings for notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password

# Email address for system notifications
NOTIFICATION_EMAIL=admin@your-domain.com
```

#### Webhook Configuration (Optional)
```bash
# Webhook URL for event notifications
WEBHOOK_URL=https://your-app.com/webhook

# Webhook secret for request verification
WEBHOOK_SECRET=webhook-secret-key-here
```

## Configuration Files

### Environment File (.env)

Create a `.env` file in the project root:

```bash
# Copy from template
cp .env.example .env

# Edit configuration
nano .env
```

Example production `.env`:
```bash
# Server Configuration
PORT=3000
NODE_ENV=production
API_BASE_URL=https://bot.example.com

# Database
DB_PATH=/opt/whatsapp-otp-bot/data/database.sqlite
DB_BACKUP_PATH=/opt/whatsapp-otp-bot/data/backups

# WhatsApp
WHATSAPP_SESSION_PATH=/opt/whatsapp-otp-bot/data/sessions
WHATSAPP_TIMEOUT=30000
CHROME_HEADLESS=true
CHROME_USER_DATA_DIR=/opt/whatsapp-otp-bot/data/chrome-user-data

# Security
JWT_SECRET=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
API_KEY_SALT_ROUNDS=12
SESSION_SECRET=xyz987wvu654tsr321qpo098nml765kji432hgf210edc

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/opt/whatsapp-otp-bot/logs/app.log
LOG_MAX_FILES=10
LOG_MAX_SIZE=10m

# CORS
CORS_ORIGIN=https://bot.example.com
CORS_CREDENTIALS=true

# Dashboard
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=VerySecurePassword123!
```

### Application Configuration

The application supports JSON configuration files in the `config/` directory:

#### config/default.json
```json
{
  "server": {
    "port": 3000,
    "timeout": 30000
  },
  "whatsapp": {
    "timeout": 30000,
    "retryAttempts": 3,
    "retryDelay": 5000
  },
  "otp": {
    "defaultLength": 6,
    "defaultExpiration": 10,
    "maxAttempts": 3,
    "cleanupInterval": 300000
  },
  "rateLimit": {
    "windowMs": 900000,
    "max": 100,
    "skipSuccessfulRequests": false
  },
  "logging": {
    "level": "info",
    "maxFiles": 10,
    "maxSize": "10m"
  }
}
```

#### config/production.json
```json
{
  "server": {
    "timeout": 60000
  },
  "whatsapp": {
    "timeout": 45000,
    "retryAttempts": 5
  },
  "logging": {
    "level": "warn"
  },
  "security": {
    "enforceHttps": true,
    "trustProxy": true
  }
}
```

#### config/development.json
```json
{
  "logging": {
    "level": "debug"
  },
  "whatsapp": {
    "timeout": 15000
  },
  "security": {
    "enforceHttps": false
  }
}
```

## Security Configuration

### API Key Security

#### Strong API Key Generation
```javascript
// API keys are automatically generated with format: wab_[32-char-random-string]
// Example: wab_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

#### API Key Permissions
```javascript
// Available permissions:
[
  "send_otp",        // Send OTP messages
  "send_message",    // Send custom messages  
  "manage_sessions", // Manage WhatsApp sessions
  "view_stats",      // View statistics and logs
  "*"                // Full admin access
]
```

### Password Security

#### Strong Password Requirements
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- No common dictionary words
- Unique for each service

#### JWT Secret Generation
```bash
# Generate secure JWT secret (32+ characters)
openssl rand -base64 32
```

#### Session Secret Generation
```bash
# Generate secure session secret
openssl rand -hex 32
```

### HTTPS Configuration

#### SSL Certificate Setup
```bash
# Using Let's Encrypt (automated)
sudo /opt/whatsapp-otp-bot/deployment/scripts/setup-ssl.sh your-domain.com

# Using custom certificate
# Copy cert.pem and key.pem to /etc/nginx/ssl/
```

#### Security Headers
```nginx
# Nginx security headers (included in default config)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

## Database Configuration

### SQLite Settings

#### Database Location
```bash
# Production path
DB_PATH=/opt/whatsapp-otp-bot/data/database.sqlite

# Development path
DB_PATH=./data/database.sqlite
```

#### Performance Tuning
```javascript
// Automatic optimizations applied:
PRAGMA journal_mode = WAL;      // Write-Ahead Logging
PRAGMA synchronous = NORMAL;    // Balance safety/performance
PRAGMA foreign_keys = ON;       // Enforce relationships
```

#### Backup Configuration
```bash
# Automatic backup schedule
BACKUP_INTERVAL_HOURS=24        # Daily backups
BACKUP_RETENTION_DAYS=30        # Keep 30 days of backups

# Manual backup
npm run backup
```

### External Database Support

For high-traffic environments, you can configure external databases:

#### PostgreSQL Configuration
```javascript
// config/production.json
{
  "database": {
    "type": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "whatsapp_otp_bot",
    "username": "whatsapp",
    "password": "secure_password"
  }
}
```

#### MySQL Configuration
```javascript
// config/production.json
{
  "database": {
    "type": "mysql",
    "host": "localhost",
    "port": 3306,
    "database": "whatsapp_otp_bot",
    "username": "whatsapp",
    "password": "secure_password"
  }
}
```

## Performance Configuration

### Node.js Optimization

#### Memory Configuration
```bash
# Set Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=2048"
```

#### Process Management
```javascript
// ecosystem.config.js (PM2)
{
  "instances": "max",           // Use all CPU cores
  "exec_mode": "cluster",       // Cluster mode
  "max_memory_restart": "1G",   // Restart if memory exceeds 1GB
  "node_args": "--max-old-space-size=2048"
}
```

### Chrome/Selenium Optimization

#### Chrome Flags
```javascript
// Optimized Chrome flags (automatically applied)
const chromeArgs = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-images',
  '--disable-plugins',
  '--disable-extensions'
];
```

#### Resource Limits
```bash
# System limits for Chrome
echo "whatsapp soft nofile 65536" >> /etc/security/limits.conf
echo "whatsapp hard nofile 65536" >> /etc/security/limits.conf
```

### Nginx Optimization

#### Performance Settings
```nginx
# nginx.conf optimizations
worker_processes auto;
worker_connections 1024;
sendfile on;
tcp_nopush on;
tcp_nodelay on;
keepalive_timeout 65;
gzip on;
gzip_vary on;
gzip_min_length 10240;
```

#### Caching Configuration
```nginx
# Static file caching
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# API response caching (optional)
location /api/health {
    expires 30s;
    add_header Cache-Control "public";
}
```

## Monitoring Configuration

### Health Check Endpoints

#### Application Health
```bash
# Endpoint: GET /health
# Returns: System health status
curl https://your-domain.com/health
```

#### Custom Health Checks
```javascript
// Custom health check configuration
{
  "healthCheck": {
    "interval": 30000,        // Check every 30 seconds
    "timeout": 5000,          // 5 second timeout
    "retries": 3,             // 3 retries before marking unhealthy
    "services": [
      "database",
      "whatsapp",
      "chrome"
    ]
  }
}
```

### Logging Configuration

#### Log Levels
```bash
# Available log levels (most to least verbose)
LOG_LEVEL=debug    # Development only
LOG_LEVEL=info     # Production default
LOG_LEVEL=warn     # Production warnings only
LOG_LEVEL=error    # Production errors only
```

#### Log Rotation
```javascript
// Automatic log rotation settings
{
  "logging": {
    "maxFiles": 10,           // Keep 10 log files
    "maxSize": "10m",         // 10MB per file
    "tailable": true,         // Allow tailing
    "zippedArchive": true     // Compress old logs
  }
}
```

#### Structured Logging
```javascript
// Log format configuration
{
  "logging": {
    "format": "json",         // JSON format for parsing
    "timestamp": true,        // Include timestamps
    "colorize": false,        // No colors in production
    "service": "whatsapp-otp-bot"
  }
}
```

## Integration Configuration

### Webhook Configuration

#### Event Types
```javascript
// Available webhook events
[
  "message.sent",
  "message.delivered", 
  "message.failed",
  "otp.generated",
  "otp.validated",
  "otp.expired",
  "session.connected",
  "session.disconnected",
  "api.rate_limit_exceeded"
]
```

#### Webhook Format
```json
{
  "event": "message.sent",
  "timestamp": "2023-12-01T15:30:00.000Z",
  "data": {
    "messageId": 123,
    "phone": "+1234567890",
    "status": "sent"
  },
  "signature": "sha256=abcd1234..."
}
```

### Email Notifications

#### SMTP Providers
```bash
# Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false

# Outlook
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false

# SendGrid
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false

# Mailgun
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
```

#### Notification Types
```javascript
// Email notification events
[
  "system.error",           // System errors
  "security.breach",        // Security incidents
  "rate_limit.exceeded",    // Rate limit violations
  "backup.completed",       // Backup operations
  "certificate.expiring"   // SSL certificate expiration
]
```

## Environment-Specific Configuration

### Development Environment
```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
CHROME_HEADLESS=false
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=admin123
```

### Staging Environment
```bash
NODE_ENV=staging
PORT=3000
LOG_LEVEL=info
CHROME_HEADLESS=true
API_BASE_URL=https://staging-bot.example.com
```

### Production Environment
```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn
CHROME_HEADLESS=true
API_BASE_URL=https://bot.example.com
```

## Configuration Validation

### Required Variables Check
```bash
# The application validates required environment variables on startup
# Missing variables will cause startup failure with descriptive errors
```

### Configuration Testing
```bash
# Test configuration
npm run config:test

# Validate environment
npm run config:validate

# Check all settings
npm run config:check
```

## Troubleshooting Configuration

### Common Configuration Issues

#### Missing Environment Variables
```bash
# Error: Missing required environment variable: JWT_SECRET
# Solution: Add JWT_SECRET to .env file
```

#### Invalid File Paths
```bash
# Error: ENOENT: no such file or directory
# Solution: Ensure all paths exist and are writable
```

#### Permission Issues
```bash
# Error: EACCES: permission denied
# Solution: Fix file/directory permissions
sudo chown -R whatsapp:whatsapp /opt/whatsapp-otp-bot
sudo chmod 750 /opt/whatsapp-otp-bot/data
```

#### Chrome/Selenium Issues
```bash
# Error: Chrome binary not found
# Solution: Install Chrome/Chromium or set CHROME_BIN
sudo apt install chromium-browser
```

### Configuration Debugging

#### Enable Debug Logging
```bash
LOG_LEVEL=debug
```

#### Check Configuration Loading
```bash
# View loaded configuration
curl http://localhost:3000/api/config
```

#### Test Database Connection
```bash
# Check database connectivity
npm run db:test
```

## Best Practices

### Security Best Practices
1. Use strong, unique passwords and secrets
2. Enable HTTPS in production
3. Set appropriate file permissions
4. Regularly update dependencies
5. Monitor logs for security events
6. Use firewall and fail2ban
7. Keep backup of configuration files

### Performance Best Practices
1. Use production NODE_ENV
2. Enable gzip compression
3. Configure appropriate cache headers
4. Monitor resource usage
5. Set reasonable rate limits
6. Use log rotation
7. Regular cleanup of old data

### Maintenance Best Practices
1. Regular backups
2. Monitor disk space
3. Update SSL certificates
4. Check log files
5. Monitor system health
6. Plan for scaling
7. Document configuration changes

For additional help with configuration:
- Check the example files in the repository
- Review the deployment documentation
- Check GitHub issues for configuration problems
- Contact support for complex setups