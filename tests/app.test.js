const request = require('supertest');
const App = require('../src/app');
const Database = require('../src/services/database');

describe('WhatsApp OTP Bot API', () => {
  let app;
  let server;
  
  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.DB_PATH = ':memory:'; // Use in-memory database for tests
    
    app = new App();
    await new Promise(resolve => {
      server = app.app.listen(0, resolve);
    });
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    if (app) {
      await app.stop();
    }
  });

  describe('Health Check', () => {
    test('GET /health should return 200', async () => {
      const response = await request(app.app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('API Documentation', () => {
    test('GET /api/docs should return API documentation', async () => {
      const response = await request(app.app)
        .get('/api/docs')
        .expect(200);

      expect(response.body).toHaveProperty('title', 'WhatsApp OTP Bot API');
      expect(response.body).toHaveProperty('endpoints');
      expect(Array.isArray(response.body.endpoints)).toBe(true);
    });
  });

  describe('Authentication', () => {
    test('API endpoints should require authentication', async () => {
      await request(app.app)
        .post('/api/send-otp')
        .send({
          phoneNumber: '+1234567890',
          appName: 'Test App'
        })
        .expect(401);
    });

    test('Invalid API key should return 401', async () => {
      await request(app.app)
        .post('/api/send-otp')
        .set('X-API-Key', 'invalid-key')
        .send({
          phoneNumber: '+1234567890',
          appName: 'Test App'
        })
        .expect(401);
    });
  });

  describe('Status Endpoint', () => {
    test('GET /api/status should work without authentication', async () => {
      const response = await request(app.app)
        .get('/api/status')
        .expect(200);

      expect(response.body).toHaveProperty('service', 'WhatsApp OTP Bot');
      expect(response.body).toHaveProperty('whatsapp');
      expect(response.body).toHaveProperty('database');
    });
  });

  describe('Dashboard Routes', () => {
    test('GET /dashboard should serve HTML', async () => {
      const response = await request(app.app)
        .get('/dashboard')
        .expect(301); // Redirect to /dashboard/ with trailing slash

      expect(response.headers['location']).toMatch(/\/dashboard/);
    });

    test('GET / should redirect to dashboard', async () => {
      await request(app.app)
        .get('/')
        .expect(302)
        .expect('Location', '/dashboard');
    });
  });

  describe('Rate Limiting', () => {
    test('Should implement rate limiting on API endpoints', async () => {
      // This test would need a valid API key to properly test rate limiting
      // For now, we'll just verify the middleware is in place
      const response = await request(app.app)
        .get('/api/status');

      // Check if rate limit headers are present
      expect(response.headers).toHaveProperty('ratelimit-limit');
    }, 10000);
  });
});

describe('Database Service', () => {
  let database;

  beforeAll(async () => {
    database = new Database();
    database.dbPath = ':memory:';
    await database.initialize();
  });

  afterAll(async () => {
    if (database) {
      await database.close();
    }
  });

  describe('API Key Operations', () => {
    test('Should create and retrieve API key', async () => {
      const keyHash = 'test-hash-123';
      const appName = 'Test App';
      const rateLimit = 100;

      const result = await database.createApiKey(keyHash, appName, rateLimit);
      expect(result.lastID).toBeDefined();

      const retrievedKey = await database.getApiKey(keyHash);
      expect(retrievedKey).toBeDefined();
      expect(retrievedKey.app_name).toBe(appName);
      expect(retrievedKey.rate_limit).toBe(rateLimit);
      expect(retrievedKey.is_active).toBe(1);
    });
  });

  describe('OTP Message Operations', () => {
    test('Should create and retrieve OTP message', async () => {
      const phoneNumber = '+1234567890';
      const otpCode = '123456';
      const appName = 'Test App';
      const apiKeyId = 1;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const result = await database.createOtpMessage(phoneNumber, otpCode, appName, apiKeyId, expiresAt);
      expect(result.lastID).toBeDefined();

      const retrievedMessage = await database.getOtpMessage(result.lastID);
      expect(retrievedMessage).toBeDefined();
      expect(retrievedMessage.phone_number).toBe(phoneNumber);
      expect(retrievedMessage.otp_code).toBe(otpCode);
      expect(retrievedMessage.app_name).toBe(appName);
    });

    test('Should update OTP status', async () => {
      const phoneNumber = '+1234567890';
      const otpCode = '654321';
      const appName = 'Test App';
      const apiKeyId = 1;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const result = await database.createOtpMessage(phoneNumber, otpCode, appName, apiKeyId, expiresAt);
      
      await database.updateOtpStatus(result.lastID, 'sent');
      
      const retrievedMessage = await database.getOtpMessage(result.lastID);
      expect(retrievedMessage.status).toBe('sent');
    });
  });

  describe('Session Operations', () => {
    test('Should create and update WhatsApp session', async () => {
      const sessionId = 'test-session-123';
      const status = 'connected';
      const phoneNumber = '+1234567890';

      await database.createOrUpdateSession(sessionId, status, null, phoneNumber);
      
      const session = await database.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session.session_id).toBe(sessionId);
      expect(session.status).toBe(status);
      expect(session.phone_number).toBe(phoneNumber);
    });
  });
});

describe('Utility Functions', () => {
  const { OTPGenerator, PhoneUtils, ValidationUtils } = require('../src/utils/helpers');

  describe('OTP Generator', () => {
    test('Should generate numeric OTP of correct length', () => {
      const otp = OTPGenerator.generate(6, 'numeric');
      expect(otp).toHaveLength(6);
      expect(/^\d+$/.test(otp)).toBe(true);
    });

    test('Should generate alphanumeric OTP', () => {
      const otp = OTPGenerator.generate(8, 'alphanumeric');
      expect(otp).toHaveLength(8);
      expect(/^[A-Z0-9]+$/.test(otp)).toBe(true);
    });

    test('Should validate OTP correctly', () => {
      expect(OTPGenerator.isValid('123456', 6, 'numeric')).toBe(true);
      expect(OTPGenerator.isValid('12345', 6, 'numeric')).toBe(false);
      expect(OTPGenerator.isValid('ABC123', 6, 'alphanumeric')).toBe(true);
    });
  });

  describe('Phone Utils', () => {
    test('Should normalize phone numbers', () => {
      expect(PhoneUtils.normalize('1234567890')).toBe('+1234567890');
      expect(PhoneUtils.normalize('+1 (234) 567-8900')).toBe('+12345678900');
      expect(PhoneUtils.normalize('+44 20 1234 5678')).toBe('+442012345678');
    });

    test('Should validate phone numbers', () => {
      expect(PhoneUtils.isValid('+1234567890')).toBe(true);
      expect(PhoneUtils.isValid('1234567890')).toBe(true);
      expect(PhoneUtils.isValid('invalid')).toBe(false);
      expect(PhoneUtils.isValid('+123')).toBe(false); // Too short
    });

    test('Should get country code', () => {
      const usResult = PhoneUtils.getCountryCode('+1234567890');
      expect(usResult.code).toBe('+1');
      expect(usResult.country).toBe('US/CA');

      const ukResult = PhoneUtils.getCountryCode('+442012345678');
      expect(ukResult.code).toBe('+44');
      expect(ukResult.country).toBe('UK');
    });
  });

  describe('Validation Utils', () => {
    test('Should validate OTP requests', () => {
      const validRequest = {
        phoneNumber: '+1234567890',
        appName: 'Test App',
        otpLength: 6
      };

      const result = ValidationUtils.validateOtpRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('Should reject invalid OTP requests', () => {
      const invalidRequest = {
        phoneNumber: 'invalid',
        otpLength: 15,
        template: 'x'.repeat(600)
      };

      const result = ValidationUtils.validateOtpRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('Should validate API key format', () => {
      expect(ValidationUtils.isValidApiKey('wab_' + 'a'.repeat(32))).toBe(true);
      expect(ValidationUtils.isValidApiKey('invalid-key')).toBe(false);
      expect(ValidationUtils.isValidApiKey('wab_short')).toBe(false);
    });
  });
});