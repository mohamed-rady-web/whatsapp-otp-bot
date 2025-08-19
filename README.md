# WhatsApp OTP Bot

A comprehensive WhatsApp OTP bot system that automates OTP message delivery through WhatsApp Web using Selenium. This production-ready solution includes API endpoints, web dashboard, multi-app support, and Docker deployment capabilities.

## Features

### 🔧 Core Features
- **WhatsApp Web Automation**: Selenium-powered automation for reliable message delivery
- **RESTful API**: Complete API for OTP sending and bot management
- **Web Dashboard**: Real-time monitoring and control interface
- **Multi-App Support**: Manage multiple applications with individual API keys
- **Session Management**: Persistent WhatsApp Web sessions with QR code authentication
- **Rate Limiting**: Configurable rate limits per application and global limits

### 🛡️ Security Features
- **API Key Authentication**: Secure access with bcrypt-hashed API keys
- **Rate Limiting**: Protection against abuse with configurable limits
- **Request Validation**: Comprehensive input validation and sanitization
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: Helmet.js integration for enhanced security

### 📊 Monitoring & Analytics
- **Real-time Dashboard**: Monitor connection status, message queue, and statistics
- **Usage Analytics**: Track messages sent, success rates, and usage patterns
- **Comprehensive Logging**: Winston-powered logging with multiple levels
- **Health Checks**: Built-in health check endpoints for monitoring

### 🚀 Deployment Ready
- **Docker Support**: Complete containerization with docker-compose
- **VPS Deployment**: Automated installation script for Linux VPS
- **Nginx Integration**: Reverse proxy configuration with SSL support
- **Systemd Service**: Service management for production environments

## Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- Google Chrome/Chromium browser
- Linux/macOS/Windows with WSL

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/whatsapp-otp-bot.git
   cd whatsapp-otp-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env file with your configuration
   ```

4. **Start the application**
   ```bash
   npm start
   ```

5. **Access the dashboard**
   Open http://localhost:3000/dashboard in your browser

### Docker Deployment

1. **Using Docker Compose**
   ```bash
   cd deployment/docker
   cp .env.example .env
   # Edit .env file
   docker-compose up -d
   ```

2. **Build and run manually**
   ```bash
   docker build -f deployment/docker/Dockerfile -t whatsapp-otp-bot .
   docker run -p 3000:3000 -v $(pwd)/data:/usr/src/app/data whatsapp-otp-bot
   ```

### VPS Deployment

For automated deployment on a Linux VPS:

```bash
wget https://raw.githubusercontent.com/your-username/whatsapp-otp-bot/main/deployment/scripts/install.sh
chmod +x install.sh
./install.sh --repo https://github.com/your-username/whatsapp-otp-bot.git
```

## API Usage

### Authentication

All API endpoints (except status and docs) require authentication using an API key:

```bash
# Include API key in header
curl -H "X-API-Key: wab_your_api_key_here" https://your-domain.com/api/status
```

### Generate API Key

First, generate an API key using the admin token:

```bash
curl -X POST https://your-domain.com/api/generate-key \
  -H "X-Admin-Token: your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "appName": "My Application",
    "rateLimit": 1000
  }'
```

### Send OTP

```bash
curl -X POST https://your-domain.com/api/send-otp \
  -H "X-API-Key: wab_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "appName": "My App",
    "otpLength": 6,
    "template": "Your OTP is: {otp}. Valid for {expiry} minutes."
  }'
```

### Connect WhatsApp

```bash
# Start connection process
curl -X POST https://your-domain.com/api/connect \
  -H "X-API-Key: wab_your_api_key_here"

# Get QR code for scanning
curl https://your-domain.com/api/qr \
  -H "X-API-Key: wab_your_api_key_here"
```

### Check Status

```bash
curl https://your-domain.com/api/status \
  -H "X-API-Key: wab_your_api_key_here"
```

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | No |
| GET | `/api/docs` | API documentation | No |
| GET | `/api/status` | Bot status | Optional |
| POST | `/api/send-otp` | Send OTP message | Yes |
| POST | `/api/connect` | Connect WhatsApp | Yes |
| GET | `/api/qr` | Get QR code | Yes |
| POST | `/api/disconnect` | Disconnect WhatsApp | Yes |
| POST | `/api/restart` | Restart connection | Yes |
| POST | `/api/generate-key` | Generate API key | Admin |
| GET | `/api/usage/{days}` | Usage statistics | Yes |
| GET | `/api/messages` | Recent messages | Yes |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `DB_PATH` | Database path | ./data/whatsapp-bot.db |
| `WHATSAPP_HEADLESS` | Run Chrome headless | true |
| `API_KEY_SECRET` | API key encryption secret | (required) |
| `OTP_LENGTH` | Default OTP length | 6 |
| `OTP_EXPIRY_MINUTES` | OTP expiry time | 5 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

### OTP Templates

Customize OTP message templates using placeholders:

- `{otp}` - The generated OTP code
- `{expiry}` - Expiry time in minutes
- `{app}` - Application name

Example: `"Your {app} verification code is {otp}. Valid for {expiry} minutes."`

## Dashboard Features

The web dashboard provides:

- **Real-time Status**: WhatsApp connection status and bot health
- **QR Code Display**: Easy WhatsApp Web authentication
- **Message Statistics**: Success rates and message counts
- **Connection Management**: Connect, disconnect, and restart WhatsApp
- **Recent Messages**: View recent OTP messages and their status
- **System Information**: Server status and session details

## Security Best Practices

1. **Change Default Secrets**: Update all default secrets in production
2. **Use HTTPS**: Always use SSL/TLS in production
3. **Firewall Configuration**: Limit access to necessary ports only
4. **Regular Updates**: Keep dependencies and system updated
5. **Monitor Logs**: Regularly check logs for suspicious activity
6. **Backup Data**: Regular database backups
7. **Rate Limiting**: Configure appropriate rate limits

## Monitoring

### Health Checks

- **HTTP Health Check**: `GET /health`
- **Docker Health Check**: Built-in container health monitoring
- **Systemd Status**: `systemctl status whatsapp-otp-bot`

### Logs

```bash
# Application logs
tail -f logs/combined.log

# System logs (systemd)
journalctl -u whatsapp-otp-bot -f

# Docker logs
docker logs -f whatsapp-otp-bot
```

### Metrics

The dashboard provides real-time metrics:
- Messages sent/failed (24h)
- Active API keys
- Message queue length
- Connection status
- Success rates

## Troubleshooting

### Common Issues

1. **WhatsApp Connection Failed**
   - Ensure Chrome/Chromium is installed
   - Check if headless mode is appropriate
   - Verify WhatsApp Web is accessible

2. **QR Code Not Displaying**
   - Check WhatsApp service status
   - Restart the connection
   - Verify browser automation is working

3. **Messages Not Sending**
   - Verify WhatsApp connection status
   - Check phone number format
   - Review rate limiting settings

4. **API Authentication Errors**
   - Verify API key format and validity
   - Check API key permissions
   - Review rate limiting status

### Debug Mode

Enable debug logging:
```bash
DEBUG=whatsapp-bot:* npm start
```

### Support

For support and issues:
1. Check the logs for error messages
2. Review the troubleshooting guide
3. Create an issue on GitHub
4. Include relevant log excerpts and configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This software is for educational and legitimate business purposes only. Users are responsible for complying with WhatsApp's Terms of Service and applicable laws. The authors are not responsible for any misuse of this software.