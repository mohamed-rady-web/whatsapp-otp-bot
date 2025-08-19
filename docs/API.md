# WhatsApp OTP Bot API Documentation

Complete API reference for the WhatsApp OTP Bot system.

## Base URL

```
https://your-domain.com/api
```

## Authentication

All API endpoints require authentication using an API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: wab_your_api_key_here" \
     https://your-domain.com/api/endpoint
```

## Rate Limiting

- **Global Limit**: 1000 requests per 15 minutes per IP
- **API Limit**: 200 requests per 10 minutes per IP for `/api/*`
- **Per API Key**: Configurable limit per API key (default: 100 per 15 minutes)

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Response Format

All responses follow this format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message",
  "details": {
    // Additional error details
  }
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

## Endpoints

### Authentication

#### Generate API Key

Generate a new API key for accessing the API.

**Endpoint**: `POST /auth/generate-key`

**Headers**: None (public endpoint)

**Request Body**:
```json
{
  "name": "My Application",
  "permissions": ["send_otp", "send_message", "manage_sessions", "view_stats"],
  "rateLimit": 100
}
```

**Response**:
```json
{
  "success": true,
  "message": "API key generated successfully",
  "data": {
    "apiKey": "wab_abcd1234567890abcd1234567890abcd",
    "id": 1,
    "name": "My Application",
    "permissions": ["send_otp"],
    "rateLimit": 100,
    "createdAt": "2023-12-01T10:00:00.000Z"
  },
  "warning": "Store this API key securely. You will not be able to see it again."
}
```

#### List API Keys

List all API keys (requires admin permissions).

**Endpoint**: `GET /auth/keys`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response**:
```json
{
  "success": true,
  "message": "API keys retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "My Application",
      "permissions": ["send_otp"],
      "rateLimit": 100,
      "isActive": true,
      "createdAt": "2023-12-01T10:00:00.000Z",
      "lastUsed": "2023-12-01T15:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "pages": 1
  }
}
```

#### Validate Current API Key

Validate the current API key and get its details.

**Endpoint**: `GET /auth/validate`

**Response**:
```json
{
  "success": true,
  "message": "API key is valid",
  "data": {
    "id": 1,
    "name": "My Application",
    "permissions": ["send_otp"],
    "rateLimit": 100,
    "lastUsed": "2023-12-01T15:30:00.000Z",
    "createdAt": "2023-12-01T10:00:00.000Z"
  }
}
```

### WhatsApp Connection

#### Connect to WhatsApp

Initialize a WhatsApp Web connection.

**Endpoint**: `POST /connect`

**Permissions**: `manage_sessions`

**Response**:
```json
{
  "success": true,
  "message": "WhatsApp connection initiated successfully",
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "awaiting_scan",
    "message": "Please scan the QR code to complete connection"
  }
}
```

#### Get Connection Status

Get the current WhatsApp connection status.

**Endpoint**: `GET /status`

**Response**:
```json
{
  "success": true,
  "message": "WhatsApp status retrieved successfully",
  "data": {
    "status": "connected",
    "session": {
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "connectedPhone": "+1234567890",
      "lastActivity": "2023-12-01T15:30:00.000Z",
      "createdAt": "2023-12-01T14:00:00.000Z"
    },
    "stats": {
      "totalSessions": 5,
      "connectedSessions": 1,
      "reconnectAttempts": 0
    }
  }
}
```

#### Get QR Code

Get the QR code for WhatsApp authentication.

**Endpoint**: `GET /qr`

**Permissions**: `manage_sessions`

**Response**:
```json
{
  "success": true,
  "message": "QR code retrieved successfully",
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "awaiting_scan"
  }
}
```

#### Disconnect WhatsApp

Disconnect the current WhatsApp session.

**Endpoint**: `POST /disconnect`

**Permissions**: `manage_sessions`

**Response**:
```json
{
  "success": true,
  "message": "WhatsApp disconnected successfully"
}
```

#### Restart Connection

Restart the WhatsApp connection.

**Endpoint**: `POST /restart`

**Permissions**: `manage_sessions`

**Response**:
```json
{
  "success": true,
  "message": "WhatsApp connection restarted successfully",
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "initializing"
  }
}
```

### OTP Operations

#### Send OTP

Send an OTP to a phone number.

**Endpoint**: `POST /send-otp`

**Permissions**: `send_otp`

**Request Body**:
```json
{
  "phone": "+1234567890",
  "length": 6,
  "type": "numeric",
  "expirationMinutes": 10,
  "customMessage": "Your verification code is: {OTP}",
  "purpose": "verification"
}
```

**Parameters**:
- `phone` (required): Phone number in international format
- `length` (optional): OTP length (4-8 digits, default: 6)
- `type` (optional): OTP type (`numeric`, `alpha`, `alphanumeric`, default: `numeric`)
- `expirationMinutes` (optional): Expiration time (1-60 minutes, default: 10)
- `customMessage` (optional): Custom message template
- `purpose` (optional): OTP purpose (default: `verification`)

**Response**:
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "phone": "+1 (234) 567-8900",
    "messageId": 123,
    "purpose": "verification",
    "expiresAt": "2023-12-01T15:40:00.000Z",
    "expirationMinutes": 10
  }
}
```

#### Validate OTP

Validate an OTP code.

**Endpoint**: `POST /validate-otp`

**Permissions**: `send_otp`

**Request Body**:
```json
{
  "phone": "+1234567890",
  "otpCode": "123456",
  "purpose": "verification"
}
```

**Response**:
```json
{
  "success": true,
  "message": "OTP validated successfully",
  "data": {
    "phone": "+1 (234) 567-8900",
    "purpose": "verification",
    "validatedAt": "2023-12-01T15:35:00.000Z"
  }
}
```

**Error Response** (Invalid OTP):
```json
{
  "success": false,
  "error": "OTP validation failed",
  "message": "Invalid OTP code",
  "attemptsRemaining": 2
}
```

#### Get OTP Info

Get information about an active OTP.

**Endpoint**: `GET /otp/info`

**Permissions**: `send_otp`

**Query Parameters**:
- `phone` (required): Phone number
- `purpose` (optional): OTP purpose (default: `verification`)

**Response**:
```json
{
  "success": true,
  "message": "OTP information retrieved",
  "data": {
    "phone": "+1 (234) 567-8900",
    "purpose": "verification",
    "exists": true,
    "isExpired": false,
    "isUsed": false,
    "attempts": 1,
    "maxAttempts": 3,
    "attemptsRemaining": 2,
    "timeRemaining": 420,
    "createdAt": "2023-12-01T15:30:00.000Z",
    "expiresAt": "2023-12-01T15:40:00.000Z"
  }
}
```

#### Revoke OTP

Revoke/cancel an active OTP.

**Endpoint**: `POST /otp/revoke`

**Permissions**: `send_otp`

**Request Body**:
```json
{
  "phone": "+1234567890",
  "purpose": "verification"
}
```

**Response**:
```json
{
  "success": true,
  "message": "OTP revoked successfully",
  "data": {
    "phone": "+1 (234) 567-8900",
    "purpose": "verification",
    "revoked": true,
    "revokedAt": "2023-12-01T15:35:00.000Z"
  }
}
```

#### Resend OTP

Resend an OTP (generates a new code).

**Endpoint**: `POST /otp/resend`

**Permissions**: `send_otp`

**Request Body**:
```json
{
  "phone": "+1234567890",
  "purpose": "verification"
}
```

**Response**:
```json
{
  "success": true,
  "message": "OTP resent successfully",
  "data": {
    "phone": "+1 (234) 567-8900",
    "messageId": 124,
    "purpose": "verification",
    "expiresAt": "2023-12-01T15:50:00.000Z"
  }
}
```

### Messaging

#### Send Custom Message

Send a custom message to a phone number.

**Endpoint**: `POST /send-message`

**Permissions**: `send_message`

**Request Body**:
```json
{
  "phone": "+1234567890",
  "message": "Hello from WhatsApp Bot!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "phone": "+1 (234) 567-8900",
    "messageId": 125,
    "sentAt": "2023-12-01T15:35:00.000Z"
  }
}
```

#### Get Messages

Get message history with filtering.

**Endpoint**: `GET /messages`

**Permissions**: `view_stats`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)
- `status` (optional): Message status (`delivered`, `failed`, `pending`)
- `phone` (optional): Filter by phone number
- `dateFrom` (optional): Start date (ISO 8601)
- `dateTo` (optional): End date (ISO 8601)
- `apiKeyId` (optional): Filter by API key ID

**Response**:
```json
{
  "success": true,
  "message": "Messages retrieved successfully",
  "data": [
    {
      "id": 123,
      "phone": "***456-**90",
      "status": "delivered",
      "message": "Your verification code is: 123456",
      "apiKeyName": "My Application",
      "sentAt": "2023-12-01T15:30:00.000Z",
      "deliveredAt": "2023-12-01T15:30:05.000Z",
      "attempts": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "pages": 1
  }
}
```

### System Information

#### Health Check

Get system health status.

**Endpoint**: `GET /health`

**Headers**: None (public endpoint)

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2023-12-01T15:35:00.000Z",
    "uptime": 3600,
    "version": "1.0.0",
    "environment": "production",
    "checks": {
      "database": {
        "status": "healthy",
        "message": "Database connection OK"
      },
      "whatsapp": {
        "status": "healthy",
        "message": "WhatsApp status: connected"
      },
      "memory": {
        "status": "healthy",
        "usage": {
          "heapUsed": "45MB",
          "heapTotal": "67MB",
          "percentage": "67%"
        }
      }
    }
  }
}
```

#### Get Statistics

Get system statistics.

**Endpoint**: `GET /stats`

**Permissions**: `view_stats`

**Query Parameters**:
- `days` (optional): Number of days for statistics (default: 30)

**Response**:
```json
{
  "success": true,
  "message": "System statistics retrieved successfully",
  "data": {
    "period": "30 days",
    "messages": {
      "totalMessages": 1250,
      "deliveredMessages": 1180,
      "failedMessages": 45,
      "pendingMessages": 25,
      "successRate": 94.4,
      "avgDeliveryTime": 2.3
    },
    "sessions": {
      "totalSessions": 15,
      "connectedSessions": 1,
      "awaitingScanSessions": 0,
      "disconnectedSessions": 14
    },
    "apiKeys": {
      "total": 5
    }
  }
}
```

#### Clear Sessions

Clear all sessions (admin only).

**Endpoint**: `POST /sessions/clear`

**Permissions**: `manage_sessions`

**Response**:
```json
{
  "success": true,
  "message": "All sessions cleared successfully",
  "data": {
    "expired": 3,
    "deleted": 2,
    "orphaned": 1
  }
}
```

#### Get Logs

Get system logs.

**Endpoint**: `GET /logs`

**Permissions**: Admin only

**Query Parameters**:
- `level` (optional): Log level (`error`, `warn`, `info`, `debug`)
- `service` (optional): Service name (`whatsapp`, `api`, `database`, `auth`)
- `lines` (optional): Number of lines (default: 100)
- `since` (optional): Start date (ISO 8601)

**Response**:
```json
{
  "success": true,
  "message": "Logs retrieved successfully",
  "data": {
    "logs": [
      {
        "timestamp": "2023-12-01T15:35:00.000Z",
        "level": "info",
        "service": "whatsapp",
        "message": "Message sent successfully"
      }
    ],
    "total": 1,
    "filters": {
      "level": "info",
      "lines": 100
    }
  }
}
```

## Error Codes

### Authentication Errors

- `MISSING_API_KEY`: No API key provided
- `INVALID_API_KEY`: API key is invalid or expired
- `INSUFFICIENT_PERMISSIONS`: API key lacks required permissions

### Validation Errors

- `VALIDATION_ERROR`: Request validation failed
- `INVALID_PHONE_NUMBER`: Phone number format is invalid
- `INVALID_JSON`: Request body is not valid JSON

### Rate Limiting Errors

- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded
- `PHONE_RATE_LIMIT_EXCEEDED`: Phone number rate limit exceeded
- `DAILY_LIMIT_EXCEEDED`: Daily message limit reached

### WhatsApp Errors

- `WHATSAPP_NOT_CONNECTED`: WhatsApp service not connected
- `WHATSAPP_SERVICE_UNAVAILABLE`: WhatsApp service unavailable
- `QR_CODE_FAILED`: QR code generation failed
- `CONNECTION_FAILED`: WhatsApp connection failed

### OTP Errors

- `OTP_SEND_FAILED`: OTP sending failed
- `OTP_VALIDATION_FAILED`: OTP validation failed
- `OTP_EXPIRED`: OTP has expired
- `OTP_ALREADY_USED`: OTP has already been used
- `MAX_ATTEMPTS_EXCEEDED`: Maximum validation attempts exceeded

## SDKs and Examples

### cURL Examples

**Generate API Key**:
```bash
curl -X POST "https://your-domain.com/api/auth/generate-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "permissions": ["send_otp"],
    "rateLimit": 100
  }'
```

**Connect WhatsApp**:
```bash
curl -X POST "https://your-domain.com/api/connect" \
  -H "X-API-Key: wab_your_api_key_here"
```

**Send OTP**:
```bash
curl -X POST "https://your-domain.com/api/send-otp" \
  -H "X-API-Key: wab_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "length": 6,
    "expirationMinutes": 10
  }'
```

**Validate OTP**:
```bash
curl -X POST "https://your-domain.com/api/validate-otp" \
  -H "X-API-Key: wab_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "otpCode": "123456"
  }'
```

### JavaScript Example

```javascript
class WhatsAppOTPClient {
  constructor(apiKey, baseUrl = 'https://your-domain.com/api') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async request(endpoint, method = 'GET', data = null) {
    const options = {
      method,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    return await response.json();
  }

  async sendOTP(phone, options = {}) {
    return await this.request('/send-otp', 'POST', {
      phone,
      ...options
    });
  }

  async validateOTP(phone, otpCode, purpose = 'verification') {
    return await this.request('/validate-otp', 'POST', {
      phone,
      otpCode,
      purpose
    });
  }

  async getStatus() {
    return await this.request('/status');
  }
}

// Usage
const client = new WhatsAppOTPClient('wab_your_api_key_here');

// Send OTP
const result = await client.sendOTP('+1234567890', {
  length: 6,
  expirationMinutes: 10
});

// Validate OTP
const validation = await client.validateOTP('+1234567890', '123456');
```

### Python Example

```python
import requests
import json

class WhatsAppOTPClient:
    def __init__(self, api_key, base_url='https://your-domain.com/api'):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        }

    def request(self, endpoint, method='GET', data=None):
        url = f"{self.base_url}{endpoint}"
        
        if method == 'GET':
            response = requests.get(url, headers=self.headers)
        elif method == 'POST':
            response = requests.post(url, headers=self.headers, 
                                   data=json.dumps(data) if data else None)
        
        return response.json()

    def send_otp(self, phone, **options):
        data = {'phone': phone, **options}
        return self.request('/send-otp', 'POST', data)

    def validate_otp(self, phone, otp_code, purpose='verification'):
        data = {
            'phone': phone,
            'otpCode': otp_code,
            'purpose': purpose
        }
        return self.request('/validate-otp', 'POST', data)

    def get_status(self):
        return self.request('/status')

# Usage
client = WhatsAppOTPClient('wab_your_api_key_here')

# Send OTP
result = client.send_otp('+1234567890', length=6, expirationMinutes=10)

# Validate OTP
validation = client.validate_otp('+1234567890', '123456')
```

## Postman Collection

Import the complete Postman collection from:
`/postman/WhatsApp-OTP-Bot.postman_collection.json`

This includes all endpoints with example requests and environment variables.

## WebHooks (Future Feature)

WebHooks will be available in a future release to notify your application of events:

- Message delivered
- Message failed  
- WhatsApp connected
- WhatsApp disconnected
- OTP validated
- Rate limit exceeded

## Support

For API support:
- GitHub Issues: Bug reports and feature requests
- Documentation: This complete API reference
- Email: api-support@your-domain.com