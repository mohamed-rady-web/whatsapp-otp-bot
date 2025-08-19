# API Documentation

## Overview

The WhatsApp OTP Bot API provides endpoints for sending OTP messages via WhatsApp Web automation. The API is RESTful and uses JSON for request/response bodies.

## Base URL

```
http://localhost:3000/api  (Development)
https://yourdomain.com/api (Production)
```

## Authentication

The API uses API key authentication. Include your API key in the request header:

```
X-API-Key: wab_your_32_character_api_key
```

### Obtaining an API Key

API keys can be generated using the admin endpoint:

```bash
curl -X POST /api/generate-key \
  -H "X-Admin-Token: your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"appName": "My App", "rateLimit": 1000}'
```

## Rate Limiting

The API implements several rate limiting tiers:

- **Global Rate Limit**: 100 requests per 15 minutes per IP
- **OTP Rate Limit**: 5 OTP requests per minute per IP
- **API Key Rate Limit**: Configurable daily limit per API key

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

## Error Handling

The API returns standard HTTP status codes and JSON error responses:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "details": "Additional error details"
}
```

Common status codes:
- `200`: Success
- `400`: Bad Request (validation error)
- `401`: Unauthorized (invalid/missing API key)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error
- `503`: Service Unavailable (WhatsApp not connected)

## Endpoints

### Health Check

Check if the service is running.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Get API Documentation

Retrieve API documentation.

```http
GET /api/docs
```

**Response:**
```json
{
  "title": "WhatsApp OTP Bot API",
  "version": "1.0.0",
  "endpoints": [...],
  "authentication": {...}
}
```

### Get Status

Get bot status and connection information.

```http
GET /api/status
```

**Headers:**
- `X-API-Key` (optional): Include for usage statistics

**Response:**
```json
{
  "service": "WhatsApp OTP Bot",
  "version": "1.0.0",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "whatsapp": {
    "connected": true,
    "sessionId": "abc-123",
    "phoneNumber": "+1234567890",
    "lastActivity": "2023-12-07T10:29:00.000Z",
    "queueLength": 0,
    "hasQRCode": false
  },
  "database": {
    "connected": true
  },
  "usage": {
    "today": {
      "messages_sent": 45,
      "messages_failed": 2,
      "total_requests": 47
    },
    "dailyLimit": 1000,
    "remaining": 953
  }
}
```

### Send OTP

Send an OTP message to a phone number.

```http
POST /api/send-otp
```

**Headers:**
- `X-API-Key` (required): Your API key
- `Content-Type: application/json`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "appName": "My Application",
  "otpLength": 6,
  "template": "Your OTP is: {otp}. Valid for {expiry} minutes."
}
```

**Parameters:**
- `phoneNumber` (string, required): Phone number in international format
- `appName` (string, optional): Application name for tracking
- `otpLength` (number, optional): OTP length (4-10), default: 6
- `template` (string, optional): Message template with placeholders

**Template Placeholders:**
- `{otp}`: The generated OTP code
- `{expiry}`: Expiry time in minutes
- `{app}`: Application name

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "otpId": 123,
    "phoneNumber": "+1234567890",
    "expiresAt": "2023-12-07T10:35:00.000Z",
    "expiryMinutes": 5
  }
}
```

### Connect WhatsApp

Initialize WhatsApp Web connection.

```http
POST /api/connect
```

**Headers:**
- `X-API-Key` (required): Your API key

**Response:**
```json
{
  "success": true,
  "message": "Connection initiated",
  "data": {
    "status": "qr_ready",
    "qrCode": "data:image/png;base64,..."
  }
}
```

### Get QR Code

Retrieve QR code for WhatsApp authentication.

```http
GET /api/qr
```

**Headers:**
- `X-API-Key` (required): Your API key

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "message": "Scan this QR code with WhatsApp mobile app"
  }
}
```

### Disconnect WhatsApp

Disconnect WhatsApp Web session.

```http
POST /api/disconnect
```

**Headers:**
- `X-API-Key` (required): Your API key

**Response:**
```json
{
  "success": true,
  "message": "Disconnected successfully"
}
```

### Restart WhatsApp

Restart WhatsApp Web connection.

```http
POST /api/restart
```

**Headers:**
- `X-API-Key` (required): Your API key

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp service restarted"
}
```

### Generate API Key

Generate a new API key (admin only).

```http
POST /api/generate-key
```

**Headers:**
- `X-Admin-Token` (required): Admin token
- `Content-Type: application/json`

**Request Body:**
```json
{
  "appName": "My Application",
  "rateLimit": 1000
}
```

**Response:**
```json
{
  "success": true,
  "message": "API key generated successfully",
  "data": {
    "apiKey": "wab_1234567890abcdef1234567890abcdef",
    "appName": "My Application",
    "rateLimit": 1000,
    "id": 1
  }
}
```

### Get Usage Statistics

Retrieve usage statistics for your API key.

```http
GET /api/usage/{days}
```

**Headers:**
- `X-API-Key` (required): Your API key

**Parameters:**
- `days` (number, optional): Number of days (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "apiKeyId": 1,
    "appName": "My Application",
    "period": "30 days",
    "statistics": [
      {
        "date": "2023-12-07",
        "messages_sent": 45,
        "messages_failed": 2,
        "total_requests": 47
      }
    ]
  }
}
```

### Get Recent Messages

Retrieve recent OTP messages.

```http
GET /api/messages?limit=20
```

**Headers:**
- `X-API-Key` (required): Your API key

**Query Parameters:**
- `limit` (number, optional): Number of messages (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 123,
        "phone_number": "+1234567890",
        "otp_code": "123456",
        "app_name": "My Application",
        "sent_at": "2023-12-07T10:30:00.000Z",
        "expires_at": "2023-12-07T10:35:00.000Z",
        "status": "sent"
      }
    ],
    "total": 1
  }
}
```

## SDKs and Examples

### cURL Examples

**Send OTP:**
```bash
curl -X POST https://yourdomain.com/api/send-otp \
  -H "X-API-Key: wab_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "appName": "My App"
  }'
```

**Check Status:**
```bash
curl https://yourdomain.com/api/status \
  -H "X-API-Key: wab_your_api_key"
```

### JavaScript Example

```javascript
const API_KEY = 'wab_your_api_key';
const BASE_URL = 'https://yourdomain.com/api';

async function sendOTP(phoneNumber, appName) {
  const response = await fetch(`${BASE_URL}/send-otp`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      phoneNumber,
      appName,
      otpLength: 6
    })
  });
  
  return response.json();
}

// Usage
sendOTP('+1234567890', 'My App')
  .then(result => console.log(result))
  .catch(error => console.error(error));
```

### Python Example

```python
import requests

API_KEY = 'wab_your_api_key'
BASE_URL = 'https://yourdomain.com/api'

def send_otp(phone_number, app_name):
    headers = {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
    }
    
    data = {
        'phoneNumber': phone_number,
        'appName': app_name,
        'otpLength': 6
    }
    
    response = requests.post(f'{BASE_URL}/send-otp', json=data, headers=headers)
    return response.json()

# Usage
result = send_otp('+1234567890', 'My App')
print(result)
```

### PHP Example

```php
<?php
$apiKey = 'wab_your_api_key';
$baseUrl = 'https://yourdomain.com/api';

function sendOTP($phoneNumber, $appName) {
    global $apiKey, $baseUrl;
    
    $data = [
        'phoneNumber' => $phoneNumber,
        'appName' => $appName,
        'otpLength' => 6
    ];
    
    $options = [
        'http' => [
            'header' => [
                'X-API-Key: ' . $apiKey,
                'Content-Type: application/json'
            ],
            'method' => 'POST',
            'content' => json_encode($data)
        ]
    ];
    
    $context = stream_context_create($options);
    $result = file_get_contents($baseUrl . '/send-otp', false, $context);
    
    return json_decode($result, true);
}

// Usage
$result = sendOTP('+1234567890', 'My App');
print_r($result);
?>
```

## Webhooks (Future)

Webhook support for delivery status notifications is planned for future releases.

## Testing

Use the provided Postman collection for testing:

1. Import `postman/WhatsApp-OTP-Bot-API.postman_collection.json`
2. Import `postman/WhatsApp-OTP-Bot.postman_environment.json`
3. Update environment variables with your API key
4. Run the collection tests

## Support

For API support:
- Review error messages and status codes
- Check rate limiting headers
- Verify API key validity
- Ensure WhatsApp connection status
- Consult the troubleshooting guide