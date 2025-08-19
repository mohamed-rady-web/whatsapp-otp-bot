/**
 * Error Handling Middleware
 * 
 * Comprehensive error handling with logging, monitoring,
 * and appropriate error responses for all scenarios.
 */

const logger = require('../config/logger');

/**
 * Application Error Class
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = null, details = null) {
        super(message);
        
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.code = code;
        this.details = details;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Handle different types of errors
 */
const handleDatabaseError = (err) => {
    if (err.code === 'SQLITE_CONSTRAINT') {
        return new AppError(
            'Database constraint violation',
            400,
            'DATABASE_CONSTRAINT',
            { constraint: err.message }
        );
    }
    
    if (err.code === 'SQLITE_BUSY') {
        return new AppError(
            'Database is busy, please try again',
            503,
            'DATABASE_BUSY'
        );
    }
    
    return new AppError(
        'Database operation failed',
        500,
        'DATABASE_ERROR',
        { originalError: err.message }
    );
};

const handleValidationError = (err) => {
    const errors = err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
    }));
    
    return new AppError(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors }
    );
};

const handleJWTError = () => {
    return new AppError(
        'Invalid token, please authenticate again',
        401,
        'INVALID_TOKEN'
    );
};

const handleJWTExpiredError = () => {
    return new AppError(
        'Token expired, please authenticate again',
        401,
        'EXPIRED_TOKEN'
    );
};

const handleMulterError = (err) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return new AppError(
            'File size too large',
            400,
            'FILE_TOO_LARGE',
            { maxSize: err.limit }
        );
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
        return new AppError(
            'Too many files uploaded',
            400,
            'TOO_MANY_FILES',
            { maxCount: err.limit }
        );
    }
    
    return new AppError(
        'File upload error',
        400,
        'FILE_UPLOAD_ERROR',
        { originalError: err.message }
    );
};

const handleSeleniumError = (err) => {
    if (err.name === 'NoSuchElementError') {
        return new AppError(
            'WhatsApp interface element not found',
            503,
            'WHATSAPP_ELEMENT_NOT_FOUND',
            { element: err.message }
        );
    }
    
    if (err.name === 'TimeoutError') {
        return new AppError(
            'WhatsApp operation timed out',
            503,
            'WHATSAPP_TIMEOUT',
            { timeout: err.message }
        );
    }
    
    if (err.name === 'WebDriverError') {
        return new AppError(
            'WebDriver error occurred',
            503,
            'WEBDRIVER_ERROR',
            { originalError: err.message }
        );
    }
    
    return new AppError(
        'WhatsApp automation error',
        503,
        'WHATSAPP_ERROR',
        { originalError: err.message }
    );
};

/**
 * Send error response in development
 */
const sendErrorDev = (err, req, res) => {
    logger.error('Error (Development):', {
        error: err,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: err.code,
        details: err.details,
        stack: err.stack,
        request: {
            url: req.originalUrl,
            method: req.method,
            headers: req.headers,
            body: req.body,
            query: req.query
        }
    });
};

/**
 * Send error response in production
 */
const sendErrorProd = (err, req, res) => {
    // Log error details for monitoring
    logger.error('Error (Production):', {
        message: err.message,
        statusCode: err.statusCode,
        code: err.code,
        isOperational: err.isOperational,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        apiKey: req.apiKey?.id || 'none'
    });

    // Only send operational errors to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code,
            ...(err.details && { details: err.details })
        });
    } else {
        // Generic error message for non-operational errors
        res.status(500).json({
            success: false,
            error: 'Something went wrong',
            code: 'INTERNAL_ERROR',
            requestId: req.headers['x-request-id'] || 'unknown'
        });
    }
};

/**
 * Async error handler wrapper
 */
const asyncErrorHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Handle uncaught exceptions
 */
const handleUncaughtException = () => {
    process.on('uncaughtException', (err) => {
        logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
        
        // Give time for logger to write
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
};

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = () => {
    process.on('unhandledRejection', (err) => {
        logger.error('UNHANDLED REJECTION! Shutting down...', err);
        
        // Give time for logger to write
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
};

/**
 * Main error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    // Set default values
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        error = handleValidationError(err);
    } else if (err.name === 'JsonWebTokenError') {
        error = handleJWTError();
    } else if (err.name === 'TokenExpiredError') {
        error = handleJWTExpiredError();
    } else if (err.code && err.code.startsWith('SQLITE_')) {
        error = handleDatabaseError(err);
    } else if (err.code && err.code.startsWith('LIMIT_')) {
        error = handleMulterError(err);
    } else if (err.name && (err.name.includes('Selenium') || err.name.includes('WebDriver'))) {
        error = handleSeleniumError(err);
    } else if (err.code === 'ECONNREFUSED') {
        error = new AppError(
            'Connection refused - service unavailable',
            503,
            'SERVICE_UNAVAILABLE'
        );
    } else if (err.code === 'ENOTFOUND') {
        error = new AppError(
            'Network error - host not found',
            503,
            'NETWORK_ERROR'
        );
    } else if (err.type === 'entity.parse.failed') {
        error = new AppError(
            'Invalid JSON format in request body',
            400,
            'INVALID_JSON'
        );
    } else if (err.type === 'entity.too.large') {
        error = new AppError(
            'Request entity too large',
            413,
            'PAYLOAD_TOO_LARGE'
        );
    }

    // Send appropriate error response based on environment
    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(error, req, res);
    } else {
        sendErrorProd(error, req, res);
    }
};

/**
 * Not found handler
 */
const notFoundHandler = (req, res, next) => {
    const err = new AppError(
        `Route ${req.originalUrl} not found`,
        404,
        'ROUTE_NOT_FOUND'
    );
    
    next(err);
};

/**
 * Rate limit error handler
 */
const rateLimitHandler = (req, res, next) => {
    const err = new AppError(
        'Too many requests, please try again later',
        429,
        'RATE_LIMIT_EXCEEDED'
    );
    
    next(err);
};

/**
 * Request timeout handler
 */
const timeoutHandler = (timeout = 30000) => {
    return (req, res, next) => {
        const timer = setTimeout(() => {
            const err = new AppError(
                'Request timeout',
                408,
                'REQUEST_TIMEOUT'
            );
            next(err);
        }, timeout);

        // Clear timeout if request completes
        res.on('finish', () => {
            clearTimeout(timer);
        });

        next();
    };
};

/**
 * Error monitoring and alerting
 */
const monitorErrors = (err, req, res, next) => {
    // Count errors by type for monitoring
    const errorType = err.code || err.name || 'UNKNOWN';
    
    // Log error metrics
    logger.info('Error metrics', {
        type: errorType,
        statusCode: err.statusCode,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });

    // Add error to metrics collection (could be sent to monitoring service)
    // This is where you would integrate with services like DataDog, NewRelic, etc.
    
    next();
};

/**
 * Initialize error handlers
 */
const initializeErrorHandlers = () => {
    handleUncaughtException();
    handleUnhandledRejection();
    
    logger.info('Error handlers initialized');
};

module.exports = {
    AppError,
    errorHandler,
    notFoundHandler,
    rateLimitHandler,
    timeoutHandler,
    asyncErrorHandler,
    monitorErrors,
    initializeErrorHandlers
};