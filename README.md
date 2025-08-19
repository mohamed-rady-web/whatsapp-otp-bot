# WhatsApp OTP Bot

A production-ready WhatsApp OTP bot system with Selenium automation, comprehensive API endpoints, web dashboard, and enterprise-grade security features.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://docker.com/)

## 🚀 Features

### Core Functionality
- **WhatsApp Web Automation**: Selenium-based automation with persistent sessions
- **OTP Generation & Validation**: Secure OTP creation with customizable length and expiration
- **Message Sending**: Custom message support with delivery confirmation
- **Session Management**: Automatic reconnection and QR code authentication

### API & Security
- **RESTful API**: 25+ endpoints with comprehensive functionality
- **API Key Authentication**: Secure access with bcrypt hashing
- **Rate Limiting**: Multiple rate limiting strategies with progressive penalties
- **Input Validation**: Joi-based validation with detailed error messages
- **Phone Number Validation**: International format support with country detection

### Dashboard & Monitoring
- **Web Dashboard**: Modern, responsive web interface
- **Real-time Monitoring**: Live connection status and metrics
- **Analytics & Charts**: Message statistics with Chart.js visualizations
- **System Health**: Resource monitoring and health checks
- **Log Viewing**: Live log streaming with filtering

### Enterprise Features
- **Production Ready**: Comprehensive logging, error handling, and monitoring
- **Docker Support**: Multi-stage builds with security optimizations
- **SSL/HTTPS**: Let's Encrypt integration with auto-renewal
- **Database Management**: SQLite with backup and migration support
- **Deployment Automation**: One-click VPS deployment scripts

## 📖 Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Dashboard Guide](#dashboard-guide)
- [Deployment](#deployment)
- [Development](#development)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/mohamed-rady-web/whatsapp-otp-bot.git
cd whatsapp-otp-bot

# Copy environment file
cp .env.example .env

# Edit configuration
nano .env

# Start with Docker Compose
docker-compose up -d

# Access dashboard
open http://localhost:3000/dashboard
```

### Manual Installation

```bash
# Clone repository
git clone https://github.com/mohamed-rady-web/whatsapp-otp-bot.git
cd whatsapp-otp-bot

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
nano .env

# Start the application
npm start
```

## 📦 Installation

### Prerequisites

- **Node.js** 18+ and npm
- **Chrome/Chromium** browser
- **Linux/macOS/Windows** (Linux recommended for production)

### System Dependencies

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install -y nodejs npm chromium-browser git nginx certbot
```

#### CentOS/RHEL
```bash
sudo yum install -y nodejs npm chromium git nginx certbot
```

#### macOS
```bash
brew install node chromium git nginx
```

### Application Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/mohamed-rady-web/whatsapp-otp-bot.git
   cd whatsapp-otp-bot
   ```

2. **Install Dependencies**
   ```bash
   npm install --production
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env  # Edit configuration
   ```

4. **Initialize Database**
   ```bash
   npm start  # Database will be created automatically
   ```

## ⚙️ Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=production
API_BASE_URL=https://your-domain.com

# Database
DB_PATH=./data/database.sqlite
DB_BACKUP_PATH=./data/backups

# WhatsApp
WHATSAPP_SESSION_PATH=./data/sessions
WHATSAPP_TIMEOUT=30000
CHROME_HEADLESS=true
CHROME_USER_DATA_DIR=./data/chrome-user-data

# Security
JWT_SECRET=your-super-secret-jwt-key
API_KEY_SALT_ROUNDS=12
SESSION_SECRET=your-session-secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Dashboard
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=secure-password-here
```

### Advanced Configuration

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for detailed configuration options.

## 🔌 API Documentation

### Authentication

All API endpoints require an API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: wab_your_api_key_here" \
     https://your-domain.com/api/status
```

### Core Endpoints

#### Generate API Key
```bash
POST /api/auth/generate-key
{
  "name": "My Application",
  "permissions": ["send_otp", "send_message"],
  "rateLimit": 100
}
```

#### Connect WhatsApp
```bash
POST /api/connect
# Returns session info and QR code status
```

#### Send OTP
```bash
POST /api/send-otp
{
  "phone": "+1234567890",
  "length": 6,
  "type": "numeric",
  "expirationMinutes": 10
}
```

#### Validate OTP
```bash
POST /api/validate-otp
{
  "phone": "+1234567890",
  "otpCode": "123456"
}
```

#### Send Custom Message
```bash
POST /api/send-message
{
  "phone": "+1234567890",
  "message": "Hello from WhatsApp Bot!"
}
```

#### Get Status
```bash
GET /api/status
# Returns connection status and statistics
```

### Complete API Reference

See [docs/API.md](docs/API.md) for comprehensive API documentation.

## 🖥️ Dashboard Guide

### Accessing the Dashboard

1. **Open Browser**: Navigate to `https://your-domain.com/dashboard`
2. **Login**: Use credentials from your `.env` file
3. **Setup**: Follow the initial setup wizard

### Dashboard Features

#### Overview Section
- **Real-time Statistics**: Message counts, success rates, active sessions
- **Charts**: Message activity and success rate trends
- **Recent Activity**: Latest message logs

#### WhatsApp Section
- **Connection Management**: Connect, disconnect, restart
- **QR Code Display**: Scan to authenticate
- **Session Information**: Current session details

#### Messages Section
- **Message History**: Searchable message logs
- **Filters**: Filter by status, date, phone number
- **Export**: Download message data as CSV

#### Analytics Section
- **Performance Metrics**: Success rates and delivery times
- **Usage Charts**: Message volume and API usage
- **Trend Analysis**: Historical performance data

#### API Keys Section
- **Key Management**: Create, edit, delete API keys
- **Usage Statistics**: Per-key usage metrics
- **Permission Control**: Granular permission settings

#### System Section
- **Health Monitoring**: CPU, memory, disk usage
- **Service Status**: All system components
- **Resource Alerts**: Performance warnings

#### Logs Section
- **Live Logs**: Real-time log streaming
- **Log Filtering**: By level, service, date
- **Log Export**: Download log files

## 🚀 Deployment

### VPS Deployment (Automated)

For automated VPS deployment:

```bash
# Download and run installation script
curl -sSL https://raw.githubusercontent.com/mohamed-rady-web/whatsapp-otp-bot/main/deployment/scripts/install.sh | sudo bash

# Setup SSL certificate
sudo /opt/whatsapp-otp-bot/deployment/scripts/setup-ssl.sh your-domain.com
```

### Docker Deployment

```bash
# Clone repository
git clone https://github.com/mohamed-rady-web/whatsapp-otp-bot.git
cd whatsapp-otp-bot

# Configure environment
cp .env.example .env
nano .env

# Deploy with Docker Compose
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs whatsapp-otp-bot
```

### Manual Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

## 🛠️ Development

### Development Setup

```bash
# Clone repository
git clone https://github.com/mohamed-rady-web/whatsapp-otp-bot.git
cd whatsapp-otp-bot

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Project Structure

```
whatsapp-otp-bot/
├── app.js                 # Application entry point
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # API controllers
│   ├── middleware/       # Express middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   └── utils/           # Utility functions
├── public/
│   └── dashboard/       # Dashboard frontend
├── deployment/          # Deployment configurations
├── docs/               # Documentation
└── tests/              # Test files
```

### Scripts

```bash
npm start              # Start production server
npm run dev           # Start development server with nodemon
npm test              # Run tests
npm run lint          # Run ESLint
npm run lint:fix      # Fix ESLint issues
npm run docker:build  # Build Docker image
npm run docker:run    # Run with Docker Compose
```

## 🔒 Security

### Security Features

- **API Key Authentication**: Bcrypt-hashed API keys
- **Rate Limiting**: Multiple rate limiting strategies
- **Input Validation**: Comprehensive request validation
- **HTTPS/SSL**: Full SSL encryption with HSTS
- **Security Headers**: XSS, CSRF, clickjacking protection
- **Process Isolation**: Non-root container execution
- **Firewall Configuration**: Automated firewall setup

### Security Best Practices

1. **Change Default Credentials**: Update dashboard admin credentials
2. **Use Strong API Keys**: Generate secure API keys with limited permissions
3. **Enable HTTPS**: Always use SSL in production
4. **Regular Updates**: Keep dependencies updated
5. **Monitor Logs**: Watch for suspicious activity
6. **Backup Data**: Regular database backups
7. **Network Security**: Use firewall and fail2ban

### Vulnerability Reporting

Report security vulnerabilities to security@your-domain.com

## 🔧 Troubleshooting

### Common Issues

#### WhatsApp Connection Issues
```bash
# Check Chrome/Chromium installation
chromium-browser --version

# Check session directory permissions
ls -la data/sessions/

# Clear sessions and restart
rm -rf data/sessions/*
sudo systemctl restart whatsapp-bot
```

#### Database Issues
```bash
# Check database file
ls -la data/database.sqlite

# Check database permissions
sudo chown whatsapp:whatsapp data/database.sqlite

# Backup and recreate database
cp data/database.sqlite data/database.backup.sqlite
rm data/database.sqlite
sudo systemctl restart whatsapp-bot
```

#### Performance Issues
```bash
# Check system resources
htop
df -h

# Check application logs
sudo journalctl -u whatsapp-bot -f

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Getting Help

1. **Check Logs**: Review application and system logs
2. **GitHub Issues**: Search existing issues or create new one
3. **Documentation**: Refer to detailed documentation
4. **Community**: Join our community discussions

## 📚 Documentation

- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Configuration Guide](docs/CONFIGURATION.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- [Contributing Guide](CONTRIBUTING.md)

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Selenium WebDriver**: Browser automation
- **WhatsApp Web**: Messaging platform
- **Node.js Community**: Runtime and packages
- **Chart.js**: Dashboard visualizations
- **Let's Encrypt**: Free SSL certificates

## 📞 Support

- **GitHub Issues**: Bug reports and feature requests
- **Documentation**: Comprehensive guides and API reference
- **Community**: Join our discussions and get help

---

**⭐ Star this repository if you find it useful!**

Made with ❤️ for the developer community.