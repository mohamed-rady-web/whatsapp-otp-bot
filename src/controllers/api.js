const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const AuthMiddleware = require('../middleware/auth');

function createApiRoutes(whatsappService, database) {
  const router = express.Router();
  const authMiddleware = new AuthMiddleware(database);

  // Validation schemas
  const sendOtpSchema = Joi.object({
    phoneNumber: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .required()
      .messages({
        'string.pattern.base': 'Phone number must be in international format'
      }),
    appName: Joi.string().max(100).optional(),
    template: Joi.string().max(500).optional(),
    otpLength: Joi.number().integer().min(4).max(10).default(6)
  });

  const generateApiKeySchema = Joi.object({
    appName: Joi.string().min(1).max(100).required(),
    rateLimit: Joi.number().integer().min(1).max(10000).default(100)
  });

  // Helper function to generate OTP
  function generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  // Helper function to validate request
  function validateRequest(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.details[0].message,
          details: error.details
        });
      }
      req.validatedData = value;
      next();
    };
  }

  // POST /api/send-otp - Send OTP to a phone number
  router.post('/send-otp', 
    authMiddleware.authenticate(),
    authMiddleware.checkRateLimit(),
    validateRequest(sendOtpSchema),
    async (req, res) => {
      try {
        const { phoneNumber, template, otpLength } = req.validatedData;
        const appName = req.appName;
        const apiKeyId = req.apiKey.id;

        // Check if WhatsApp is connected
        const status = await whatsappService.getStatus();
        if (!status.isConnected) {
          return res.status(503).json({
            error: 'Service Unavailable',
            message: 'WhatsApp is not connected. Please connect first.',
            status: 'disconnected'
          });
        }

        // Generate OTP
        const otpCode = generateOTP(otpLength);
        const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

        // Save OTP to database
        const otpRecord = await database.createOtpMessage(
          phoneNumber,
          otpCode,
          appName,
          apiKeyId,
          expiresAt.toISOString()
        );

        try {
          // Send OTP via WhatsApp
          const result = await whatsappService.sendOTP(phoneNumber, otpCode, template);
          
          // Update OTP status
          await database.updateOtpStatus(otpRecord.lastID, 'sent');
          
          // Update usage statistics
          await database.updateUsageStats(apiKeyId, appName, 1, 0, 1);

          logger.otp(`OTP sent successfully`, {
            phoneNumber,
            appName,
            otpId: otpRecord.lastID
          });

          res.json({
            success: true,
            message: 'OTP sent successfully',
            data: {
              otpId: otpRecord.lastID,
              phoneNumber,
              expiresAt: expiresAt.toISOString(),
              expiryMinutes
            }
          });

        } catch (sendError) {
          // Update OTP status as failed
          await database.updateOtpStatus(otpRecord.lastID, 'failed', sendError.message);
          
          // Update usage statistics
          await database.updateUsageStats(apiKeyId, appName, 0, 1, 1);

          logger.error(`Failed to send OTP`, {
            phoneNumber,
            appName,
            otpId: otpRecord.lastID,
            error: sendError.message
          });

          res.status(500).json({
            error: 'Send Failed',
            message: 'Failed to send OTP via WhatsApp',
            details: sendError.message
          });
        }

      } catch (error) {
        logger.error('Send OTP error:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to process OTP request'
        });
      }
    }
  );

  // GET /api/status - Check bot status and connection
  router.get('/status', authMiddleware.optionalAuth(), async (req, res) => {
    try {
      const whatsappStatus = await whatsappService.getStatus();
      const connectionOk = await whatsappService.checkConnection();
      
      const response = {
        service: 'WhatsApp OTP Bot',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        whatsapp: {
          connected: connectionOk,
          sessionId: whatsappStatus.sessionId,
          phoneNumber: whatsappStatus.phoneNumber,
          lastActivity: whatsappStatus.lastActivity,
          queueLength: whatsappStatus.queueLength,
          hasQRCode: whatsappStatus.hasQRCode
        },
        database: {
          connected: !!database.db
        }
      };

      // Add usage info if authenticated
      if (req.apiKey) {
        const stats = await database.getUsageStats(req.apiKey.id, 1);
        response.usage = {
          today: stats[0] || { messages_sent: 0, messages_failed: 0, total_requests: 0 },
          dailyLimit: req.apiKey.rate_limit,
          remaining: req.apiKey.rate_limit - (req.dailyUsage || 0)
        };
      }

      res.json(response);
    } catch (error) {
      logger.error('Status check error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get status'
      });
    }
  });

  // POST /api/connect - Initialize WhatsApp Web connection
  router.post('/connect', authMiddleware.authenticate(), async (req, res) => {
    try {
      logger.api('WhatsApp connection requested', { appName: req.appName });
      
      const result = await whatsappService.connect();
      
      res.json({
        success: true,
        message: 'Connection initiated',
        data: result
      });
    } catch (error) {
      logger.error('Connection error:', error);
      res.status(500).json({
        error: 'Connection Failed',
        message: error.message
      });
    }
  });

  // GET /api/qr - Get QR code for authentication
  router.get('/qr', authMiddleware.authenticate(), async (req, res) => {
    try {
      const qrCode = await whatsappService.getQRCode();
      
      if (!qrCode) {
        return res.status(404).json({
          error: 'Not Available',
          message: 'QR code not available. Connect first or already logged in.'
        });
      }

      res.json({
        success: true,
        data: {
          qrCode,
          message: 'Scan this QR code with WhatsApp mobile app'
        }
      });
    } catch (error) {
      logger.error('QR code error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get QR code'
      });
    }
  });

  // POST /api/disconnect - Disconnect session
  router.post('/disconnect', authMiddleware.authenticate(), async (req, res) => {
    try {
      await whatsappService.disconnect();
      
      logger.api('WhatsApp disconnected', { appName: req.appName });
      
      res.json({
        success: true,
        message: 'Disconnected successfully'
      });
    } catch (error) {
      logger.error('Disconnect error:', error);
      res.status(500).json({
        error: 'Disconnect Failed',
        message: error.message
      });
    }
  });

  // POST /api/restart - Restart WhatsApp connection
  router.post('/restart', authMiddleware.authenticate(), async (req, res) => {
    try {
      await whatsappService.restart();
      
      logger.api('WhatsApp restarted', { appName: req.appName });
      
      res.json({
        success: true,
        message: 'WhatsApp service restarted'
      });
    } catch (error) {
      logger.error('Restart error:', error);
      res.status(500).json({
        error: 'Restart Failed',
        message: error.message
      });
    }
  });

  // POST /api/generate-key - Generate new API key (admin only)
  router.post('/generate-key',
    authMiddleware.authenticateAdmin(),
    validateRequest(generateApiKeySchema),
    async (req, res) => {
      try {
        const { appName, rateLimit } = req.validatedData;
        
        const apiKeyData = await authMiddleware.generateApiKey(appName, rateLimit);
        
        res.json({
          success: true,
          message: 'API key generated successfully',
          data: apiKeyData
        });
      } catch (error) {
        logger.error('API key generation error:', error);
        res.status(500).json({
          error: 'Generation Failed',
          message: 'Failed to generate API key'
        });
      }
    }
  );

  // GET /api/usage/:apiKeyId - Get usage statistics
  router.get('/usage/:days?', authMiddleware.authenticate(), async (req, res) => {
    try {
      const days = parseInt(req.params.days) || 30;
      const stats = await database.getUsageStats(req.apiKey.id, days);
      
      res.json({
        success: true,
        data: {
          apiKeyId: req.apiKey.id,
          appName: req.appName,
          period: `${days} days`,
          statistics: stats
        }
      });
    } catch (error) {
      logger.error('Usage statistics error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get usage statistics'
      });
    }
  });

  // GET /api/messages - Get recent OTP messages
  router.get('/messages', authMiddleware.authenticate(), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const messages = await database.getRecentOtps(limit);
      
      // Filter messages for this API key only
      const filteredMessages = messages.filter(msg => msg.api_key_id === req.apiKey.id);
      
      res.json({
        success: true,
        data: {
          messages: filteredMessages,
          total: filteredMessages.length
        }
      });
    } catch (error) {
      logger.error('Messages fetch error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get messages'
      });
    }
  });

  // GET /api/docs - API documentation
  router.get('/docs', (req, res) => {
    const docs = {
      title: 'WhatsApp OTP Bot API',
      version: '1.0.0',
      baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      authentication: {
        type: 'API Key',
        header: 'X-API-Key',
        format: 'wab_[32 character hex string]'
      },
      endpoints: [
        {
          method: 'POST',
          path: '/api/send-otp',
          description: 'Send OTP to a phone number',
          authentication: 'required',
          parameters: {
            phoneNumber: 'string (required) - Phone number in international format',
            appName: 'string (optional) - Application name',
            template: 'string (optional) - OTP message template',
            otpLength: 'number (optional) - Length of OTP (4-10, default: 6)'
          }
        },
        {
          method: 'GET',
          path: '/api/status',
          description: 'Get bot status and connection info',
          authentication: 'optional'
        },
        {
          method: 'POST',
          path: '/api/connect',
          description: 'Initialize WhatsApp Web connection',
          authentication: 'required'
        },
        {
          method: 'GET',
          path: '/api/qr',
          description: 'Get QR code for WhatsApp authentication',
          authentication: 'required'
        },
        {
          method: 'POST',
          path: '/api/disconnect',
          description: 'Disconnect WhatsApp session',
          authentication: 'required'
        }
      ],
      rateLimits: {
        general: '100 requests per 15 minutes per IP',
        otp: '5 OTP requests per minute per IP',
        daily: 'Based on API key configuration'
      }
    };

    res.json(docs);
  });

  return router;
}

module.exports = createApiRoutes;