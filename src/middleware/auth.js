/**
 * Authentication Middleware
 * 
 * Handles API key authentication and authorization
 * with comprehensive security measures.
 */

const ApiKeyModel = require('../models/apiKey');
const logger = require('../config/logger');

/**
 * API Key Authentication Middleware
 */
const authenticateApiKey = async (req, res, next) => {
    try {
        // Get API key from header
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

        if (!apiKey) {
            logger.logSecurityEvent('missing_api_key', {
                ip: req.ip,
                url: req.originalUrl,
                userAgent: req.get('User-Agent')
            });

            return res.status(401).json({
                success: false,
                error: 'API key required',
                message: 'Include X-API-Key header with your API key'
            });
        }

        // Validate API key
        const keyData = await ApiKeyModel.validate(apiKey);

        if (!keyData) {
            logger.logSecurityEvent('invalid_api_key', {
                ip: req.ip,
                url: req.originalUrl,
                userAgent: req.get('User-Agent'),
                keyPreview: apiKey.substring(0, 8) + '...'
            });

            return res.status(401).json({
                success: false,
                error: 'Invalid API key',
                message: 'The provided API key is not valid'
            });
        }

        // Log successful authentication
        logger.logAuthEvent('api_key_authenticated', keyData.id, {
            ip: req.ip,
            url: req.originalUrl
        });

        // Attach key data to request
        req.apiKey = keyData;
        next();

    } catch (error) {
        logger.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication error',
            message: 'Internal server error during authentication'
        });
    }
};

/**
 * Permission check middleware
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.apiKey) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'API key authentication required'
            });
        }

        if (!ApiKeyModel.hasPermission(req.apiKey, permission)) {
            logger.logSecurityEvent('insufficient_permissions', {
                userId: req.apiKey.id,
                requiredPermission: permission,
                userPermissions: req.apiKey.permissions,
                ip: req.ip,
                url: req.originalUrl
            });

            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: `This operation requires '${permission}' permission`,
                requiredPermission: permission,
                yourPermissions: req.apiKey.permissions
            });
        }

        next();
    };
};

/**
 * Admin authentication middleware (for dashboard)
 */
const authenticateAdmin = (req, res, next) => {
    try {
        // Check for basic auth or session
        const auth = req.headers.authorization;

        if (!auth || !auth.startsWith('Basic ')) {
            return res.status(401).json({
                success: false,
                error: 'Admin authentication required',
                message: 'Basic authentication required for admin access'
            });
        }

        // Decode basic auth
        const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
        const username = credentials[0];
        const password = credentials[1];

        // Check credentials
        const adminUsername = process.env.DASHBOARD_USERNAME || 'admin';
        const adminPassword = process.env.DASHBOARD_PASSWORD || 'admin123';

        if (username !== adminUsername || password !== adminPassword) {
            logger.logSecurityEvent('admin_auth_failed', {
                username,
                ip: req.ip,
                url: req.originalUrl
            });

            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                message: 'Invalid username or password'
            });
        }

        logger.logAuthEvent('admin_authenticated', username, {
            ip: req.ip,
            url: req.originalUrl
        });

        req.admin = { username };
        next();

    } catch (error) {
        logger.error('Admin authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication error',
            message: 'Internal server error during authentication'
        });
    }
};

/**
 * Optional authentication middleware
 */
const optionalAuth = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

        if (apiKey) {
            const keyData = await ApiKeyModel.validate(apiKey);
            if (keyData) {
                req.apiKey = keyData;
                logger.logAuthEvent('api_key_authenticated', keyData.id, {
                    ip: req.ip,
                    url: req.originalUrl
                });
            }
        }

        next();

    } catch (error) {
        logger.error('Optional authentication error:', error);
        next(); // Continue without authentication
    }
};

/**
 * Rate limiting per API key
 */
const apiKeyRateLimit = async (req, res, next) => {
    try {
        if (!req.apiKey) {
            return next();
        }

        const now = new Date();
        const windowStart = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes window

        // Check rate limit for this API key
        const { run, get } = require('../config/database');
        
        // Clean old rate limit records
        await run(
            'DELETE FROM rate_limits WHERE window_start < ?',
            [windowStart.toISOString()]
        );

        // Get current count for this API key in the window
        const currentCount = await get(
            'SELECT SUM(request_count) as total FROM rate_limits WHERE api_key_id = ? AND window_start > ?',
            [req.apiKey.id, windowStart.toISOString()]
        );

        const requestCount = currentCount?.total || 0;
        const limit = req.apiKey.rateLimit || 100;

        if (requestCount >= limit) {
            logger.logSecurityEvent('api_key_rate_limit_exceeded', {
                apiKeyId: req.apiKey.id,
                requestCount,
                limit,
                ip: req.ip
            });

            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                message: `API key rate limit of ${limit} requests per 15 minutes exceeded`,
                retryAfter: 900 // 15 minutes in seconds
            });
        }

        // Record this request
        const windowStartTime = new Date(Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000)); // 5-minute buckets
        
        await run(
            `INSERT INTO rate_limits (api_key_id, window_start, request_count) 
             VALUES (?, ?, 1) 
             ON CONFLICT(api_key_id, window_start) 
             DO UPDATE SET request_count = request_count + 1`,
            [req.apiKey.id, windowStartTime.toISOString()]
        ).catch(() => {
            // If there's an error with the rate limiting table, just continue
            // This prevents the rate limiting from breaking the API
        });

        next();

    } catch (error) {
        logger.error('API key rate limiting error:', error);
        next(); // Continue on error to not break the API
    }
};

/**
 * IP-based rate limiting
 */
const ipRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
    const requests = new Map();

    return (req, res, next) => {
        const ip = req.ip;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old entries
        for (const [requestIp, timestamps] of requests.entries()) {
            requests.set(requestIp, timestamps.filter(time => time > windowStart));
            if (requests.get(requestIp).length === 0) {
                requests.delete(requestIp);
            }
        }

        // Get current IP requests
        const ipRequests = requests.get(ip) || [];

        if (ipRequests.length >= max) {
            logger.logSecurityEvent('ip_rate_limit_exceeded', {
                ip,
                requestCount: ipRequests.length,
                limit: max,
                url: req.originalUrl
            });

            return res.status(429).json({
                success: false,
                error: 'Too many requests',
                message: `Rate limit of ${max} requests per ${windowMs/1000/60} minutes exceeded`,
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }

        // Record this request
        ipRequests.push(now);
        requests.set(ip, ipRequests);

        next();
    };
};

module.exports = {
    authenticateApiKey,
    requirePermission,
    authenticateAdmin,
    optionalAuth,
    apiKeyRateLimit,
    ipRateLimit
};