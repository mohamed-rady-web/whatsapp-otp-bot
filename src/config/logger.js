/**
 * Logger Configuration using Winston
 * 
 * Provides structured logging with multiple transports,
 * log rotation, and different log levels for development and production.
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        let log = `${timestamp} [${level}]`;
        if (service) log += ` [${service}]`;
        log += `: ${message}`;
        
        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
        }
        
        return log;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'whatsapp-otp-bot' },
    transports: [
        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        }),
        
        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 10,
            tailable: true
        }),
        
        // Separate file for WhatsApp specific logs
        new winston.transports.File({
            filename: path.join(logsDir, 'whatsapp.log'),
            level: 'info',
            format: winston.format.combine(
                winston.format.label({ label: 'WhatsApp' }),
                logFormat
            ),
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 5,
            tailable: true
        })
    ],
    
    // Handle exceptions and rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 5 * 1024 * 1024,
            maxFiles: 3
        })
    ],
    
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            maxsize: 5 * 1024 * 1024,
            maxFiles: 3
        })
    ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
        level: 'debug'
    }));
}

// Create specialized loggers for different services
const whatsappLogger = logger.child({ service: 'whatsapp' });
const apiLogger = logger.child({ service: 'api' });
const dbLogger = logger.child({ service: 'database' });
const authLogger = logger.child({ service: 'auth' });

// Helper methods for structured logging
logger.logApiRequest = (req, res, responseTime) => {
    apiLogger.info('API Request', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        contentLength: res.get('Content-Length')
    });
};

logger.logWhatsAppEvent = (event, data = {}) => {
    whatsappLogger.info(`WhatsApp Event: ${event}`, data);
};

logger.logDatabaseQuery = (query, duration, error = null) => {
    if (error) {
        dbLogger.error('Database Query Failed', { query, duration, error: error.message });
    } else {
        dbLogger.debug('Database Query', { query, duration: `${duration}ms` });
    }
};

logger.logAuthEvent = (event, userId, details = {}) => {
    authLogger.info(`Auth Event: ${event}`, { userId, ...details });
};

logger.logSecurityEvent = (event, details = {}) => {
    logger.warn(`Security Event: ${event}`, { 
        timestamp: new Date().toISOString(),
        ...details 
    });
};

module.exports = logger;