const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class AuthMiddleware {
  constructor(database) {
    this.database = database;
  }

  // Middleware to authenticate API key
  authenticate() {
    return async (req, res, next) => {
      try {
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
        
        if (!apiKey) {
          logger.security('API request without API key', { ip: req.ip, path: req.path });
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'API key is required'
          });
        }

        // Hash the provided API key to compare with stored hash
        const apiKeyRecord = await this.database.getApiKey(await this.hashApiKey(apiKey));
        
        if (!apiKeyRecord) {
          logger.security('Invalid API key used', { ip: req.ip, path: req.path, apiKey: apiKey.substring(0, 8) + '...' });
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid API key'
          });
        }

        if (!apiKeyRecord.is_active) {
          logger.security('Inactive API key used', { ip: req.ip, path: req.path, apiKeyId: apiKeyRecord.id });
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'API key is inactive'
          });
        }

        // Update API key usage
        await this.database.updateApiKeyUsage(apiKeyRecord.id);

        // Add API key info to request
        req.apiKey = apiKeyRecord;
        req.appName = apiKeyRecord.app_name;

        next();
      } catch (error) {
        logger.error('Authentication error:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Authentication failed'
        });
      }
    };
  }

  // Check rate limits for API key
  checkRateLimit() {
    return async (req, res, next) => {
      try {
        const apiKey = req.apiKey;
        if (!apiKey) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required'
          });
        }

        // Get current usage for today
        const today = new Date().toISOString().split('T')[0];
        const stats = await this.database.all(
          `SELECT SUM(total_requests) as total_requests FROM usage_stats 
           WHERE api_key_id = ? AND date = ?`,
          [apiKey.id, today]
        );

        const dailyRequests = stats[0]?.total_requests || 0;
        const rateLimit = apiKey.rate_limit;

        if (dailyRequests >= rateLimit) {
          logger.security('Rate limit exceeded', { 
            apiKeyId: apiKey.id, 
            appName: apiKey.app_name,
            dailyRequests,
            rateLimit 
          });
          
          return res.status(429).json({
            error: 'Rate Limit Exceeded',
            message: `Daily rate limit of ${rateLimit} requests exceeded`,
            dailyUsage: dailyRequests,
            limit: rateLimit
          });
        }

        req.dailyUsage = dailyRequests;
        next();
      } catch (error) {
        logger.error('Rate limit check error:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Rate limit check failed'
        });
      }
    };
  }

  // Generate a new API key
  async generateApiKey(appName, rateLimit = 100) {
    try {
      const apiKey = `wab_${uuidv4().replace(/-/g, '')}`;
      const keyHash = await this.hashApiKey(apiKey);
      
      const result = await this.database.createApiKey(keyHash, appName, rateLimit);
      
      logger.api('New API key generated', { appName, apiKeyId: result.lastID });
      
      return {
        apiKey,
        appName,
        rateLimit,
        id: result.lastID
      };
    } catch (error) {
      logger.error('Failed to generate API key:', error);
      throw error;
    }
  }

  // Hash API key for secure storage
  async hashApiKey(apiKey) {
    const saltRounds = 12;
    return bcrypt.hash(apiKey, saltRounds);
  }

  // Validate API key format
  validateApiKeyFormat(apiKey) {
    const apiKeyPattern = /^wab_[a-f0-9]{32}$/;
    return apiKeyPattern.test(apiKey);
  }

  // Admin authentication for dashboard
  authenticateAdmin() {
    return (req, res, next) => {
      // For demo purposes, using a simple token
      // In production, implement proper admin authentication
      const adminToken = req.headers['x-admin-token'];
      const expectedToken = process.env.ADMIN_TOKEN || 'admin-demo-token';
      
      if (adminToken === expectedToken) {
        req.isAdmin = true;
        next();
      } else {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Admin access required'
        });
      }
    };
  }

  // Optional authentication (doesn't fail if no key provided)
  optionalAuth() {
    return async (req, res, next) => {
      try {
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
        
        if (apiKey) {
          const apiKeyRecord = await this.database.getApiKey(await this.hashApiKey(apiKey));
          if (apiKeyRecord && apiKeyRecord.is_active) {
            req.apiKey = apiKeyRecord;
            req.appName = apiKeyRecord.app_name;
          }
        }
        
        next();
      } catch (error) {
        // Don't fail on optional auth errors
        next();
      }
    };
  }
}

module.exports = AuthMiddleware;