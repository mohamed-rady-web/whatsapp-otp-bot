# WhatsApp OTP Bot

## Quick Setup

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd whatsapp-otp-bot
   npm install
   ```

2. **Configure:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start:**
   ```bash
   npm start
   ```

4. **Access dashboard:**
   http://localhost:3000/dashboard

## First Steps

1. **Connect WhatsApp:**
   - Visit the dashboard
   - Click "Connect" 
   - Scan QR code with WhatsApp mobile app

2. **Generate API Key:**
   ```bash
   curl -X POST http://localhost:3000/api/generate-key \
     -H "X-Admin-Token: admin-demo-token" \
     -H "Content-Type: application/json" \
     -d '{"appName": "My App", "rateLimit": 1000}'
   ```

3. **Send your first OTP:**
   ```bash
   curl -X POST http://localhost:3000/api/send-otp \
     -H "X-API-Key: wab_your_api_key" \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber": "+1234567890", "appName": "Test"}'
   ```

## API Endpoints

- `GET /health` - Health check
- `GET /api/docs` - API documentation
- `GET /api/status` - Bot status
- `POST /api/send-otp` - Send OTP
- `POST /api/connect` - Connect WhatsApp
- `GET /api/qr` - Get QR code

## Security Notes

- Change default admin token in production
- Use HTTPS in production
- Configure appropriate rate limits
- Keep API keys secure

## Support

- Check logs: `tail -f logs/combined.log`
- Dashboard: http://localhost:3000/dashboard
- Documentation: [docs/API.md](docs/API.md)