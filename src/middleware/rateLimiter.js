/**
 * Rate Limiting Middleware
 * 
 * Advanced rate limiting with different strategies
 * for various API endpoints and use cases.
 */

const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

/**
 * Create custom rate limiter with logging
 */
const createRateLimiter = (options = {}) => {
    const defaultOptions = {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        message: {
            success: false,
            error: 'Too many requests',
            message: 'Rate limit exceeded, please try again later'
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res, next, options) => {
            logger.logSecurityEvent('rate_limit_exceeded', {
                ip: req.ip,
                url: req.originalUrl,
                userAgent: req.get('User-Agent'),
                limit: options.max,
                windowMs: options.windowMs
            });

            res.status(429).json(options.message);
        }
    };

    return rateLimit({ ...defaultOptions, ...options });
};

/**
 * Strict rate limiter for sensitive operations
 */
const strictRateLimit = createRateLimiter({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // Only 10 requests per 10 minutes
    message: {
        success: false,
        error: 'Strict rate limit exceeded',
        message: 'This endpoint has strict rate limiting. Please try again in 10 minutes.',
        retryAfter: 600
    }
});

/**
 * Moderate rate limiter for API operations
 */
const moderateRateLimit = createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 requests per 5 minutes
    message: {
        success: false,
        error: 'API rate limit exceeded',
        message: 'API rate limit exceeded. Please try again in a few minutes.',
        retryAfter: 300
    }
});

/**
 * Lenient rate limiter for general operations
 */
const lenientRateLimit = createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: {
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please slow down.',
        retryAfter: 60
    }
});

/**
 * Message sending rate limiter
 */
const messagingRateLimit = createRateLimiter({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 25, // 25 messages per 10 minutes
    message: {
        success: false,
        error: 'Messaging rate limit exceeded',
        message: 'Message sending rate limit exceeded. Please wait before sending more messages.',
        retryAfter: 600
    },
    keyGenerator: (req) => {
        // Use API key ID if available, otherwise IP
        return req.apiKey?.id || req.ip;
    }
});

/**
 * Auth operation rate limiter
 */
const authRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Only 5 auth attempts per 15 minutes
    message: {
        success: false,
        error: 'Authentication rate limit exceeded',
        message: 'Too many authentication attempts. Please try again in 15 minutes.',
        retryAfter: 900
    }
});

/**
 * Connection operation rate limiter
 */
const connectionRateLimit = createRateLimiter({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 3, // Only 3 connection attempts per 30 minutes
    message: {
        success: false,
        error: 'Connection rate limit exceeded',
        message: 'Too many connection attempts. Please wait 30 minutes before trying again.',
        retryAfter: 1800
    }
});

/**
 * Dashboard rate limiter
 */
const dashboardRateLimit = createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // 100 requests per 5 minutes for dashboard
    message: {
        success: false,
        error: 'Dashboard rate limit exceeded',
        message: 'Dashboard rate limit exceeded. Please refresh the page in a few minutes.',
        retryAfter: 300
    }
});

/**
 * File upload rate limiter
 */
const uploadRateLimit = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    message: {
        success: false,
        error: 'Upload rate limit exceeded',
        message: 'File upload rate limit exceeded. Please try again in an hour.',
        retryAfter: 3600
    }
});

/**
 * Progressive rate limiter that increases delay based on violations
 */
class ProgressiveRateLimiter {
    constructor() {
        this.violations = new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
    }

    createMiddleware(baseWindowMs = 60000, baseMax = 30) {
        return (req, res, next) => {
            const key = req.ip;
            const now = Date.now();
            
            // Get violation history
            const violation = this.violations.get(key) || { count: 0, lastViolation: 0 };
            
            // Calculate current limits based on violation history
            const multiplier = Math.min(Math.pow(2, violation.count), 16); // Max 16x penalty
            const windowMs = baseWindowMs * multiplier;
            const max = Math.max(Math.floor(baseMax / multiplier), 1); // Min 1 request
            
            // Use express-rate-limit with dynamic options
            const limiter = rateLimit({
                windowMs,
                max,
                keyGenerator: () => key,
                handler: (req, res) => {
                    // Record violation
                    violation.count++;
                    violation.lastViolation = now;
                    this.violations.set(key, violation);
                    
                    logger.logSecurityEvent('progressive_rate_limit_violation', {
                        ip: req.ip,
                        violationCount: violation.count,
                        currentMultiplier: multiplier,
                        currentMax: max,
                        currentWindowMs: windowMs
                    });
                    
                    res.status(429).json({
                        success: false,
                        error: 'Progressive rate limit exceeded',
                        message: `Rate limit exceeded. Current limit: ${max} requests per ${windowMs/1000} seconds.`,
                        violationCount: violation.count,
                        retryAfter: Math.ceil(windowMs / 1000)
                    });
                }
            });
            
            limiter(req, res, next);
        };
    }
    
    cleanup() {
        const now = Date.now();
        const expireTime = 24 * 60 * 60 * 1000; // 24 hours
        
        for (const [key, violation] of this.violations.entries()) {
            if (now - violation.lastViolation > expireTime) {
                this.violations.delete(key);
            }
        }
    }
    
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

/**
 * Dynamic rate limiter based on system load
 */
const dynamicRateLimit = (req, res, next) => {
    // Get system metrics
    const loadAvg = require('os').loadavg()[0];
    const memUsage = process.memoryUsage();
    const memUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
    
    // Calculate dynamic limits based on system load
    let maxRequests = 100;
    
    if (loadAvg > 2.0 || memUsagePercent > 0.8) {
        maxRequests = 20; // Reduce significantly under high load
    } else if (loadAvg > 1.0 || memUsagePercent > 0.6) {
        maxRequests = 50; // Moderate reduction
    }
    
    // Create dynamic rate limiter
    const limiter = rateLimit({
        windowMs: 60000, // 1 minute
        max: maxRequests,
        message: {
            success: false,
            error: 'System under high load',
            message: `System is under high load. Current limit: ${maxRequests} requests per minute.`,
            systemLoad: {
                cpu: loadAvg,
                memory: Math.round(memUsagePercent * 100)
            }
        },
        handler: (req, res) => {
            logger.logSecurityEvent('dynamic_rate_limit_exceeded', {
                ip: req.ip,
                systemLoad: loadAvg,
                memoryUsage: memUsagePercent,
                currentLimit: maxRequests
            });
            
            res.status(503).json({
                success: false,
                error: 'Service temporarily overloaded',
                message: `System is under high load. Please try again later.`,
                retryAfter: 60
            });
        }
    });
    
    limiter(req, res, next);
};

// Create progressive rate limiter instance
const progressiveRateLimiter = new ProgressiveRateLimiter();

module.exports = {
    // Basic rate limiters
    strictRateLimit,
    moderateRateLimit,
    lenientRateLimit,
    
    // Specific operation limiters
    messagingRateLimit,
    authRateLimit,
    connectionRateLimit,
    dashboardRateLimit,
    uploadRateLimit,
    
    // Advanced limiters
    progressiveRateLimit: progressiveRateLimiter.createMiddleware(),
    dynamicRateLimit,
    
    // Utility
    createRateLimiter,
    
    // Cleanup
    cleanup: () => progressiveRateLimiter.destroy()
};