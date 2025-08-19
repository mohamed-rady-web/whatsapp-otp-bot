/**
 * Request Validation Middleware
 * 
 * Comprehensive request validation using Joi schemas
 * for all API endpoints with detailed error messages.
 */

const Joi = require('joi');
const logger = require('../config/logger');
const phoneValidator = require('../utils/phoneValidator');

/**
 * Create validation middleware from Joi schema
 */
const createValidator = (schema, source = 'body') => {
    return (req, res, next) => {
        try {
            let dataToValidate;
            
            switch (source) {
                case 'body':
                    dataToValidate = req.body;
                    break;
                case 'query':
                    dataToValidate = req.query;
                    break;
                case 'params':
                    dataToValidate = req.params;
                    break;
                case 'headers':
                    dataToValidate = req.headers;
                    break;
                default:
                    dataToValidate = req.body;
            }

            const { error, value } = schema.validate(dataToValidate, {
                abortEarly: false,
                allowUnknown: true,
                stripUnknown: true
            });

            if (error) {
                logger.warn('Validation error', {
                    ip: req.ip,
                    url: req.originalUrl,
                    source,
                    errors: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message,
                        value: detail.context?.value
                    }))
                });

                return res.status(400).json({
                    success: false,
                    error: 'Validation error',
                    message: 'Request validation failed',
                    details: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message.replace(/"/g, ''),
                        code: detail.type
                    }))
                });
            }

            // Replace the source data with validated and sanitized data
            switch (source) {
                case 'body':
                    req.body = value;
                    break;
                case 'query':
                    req.query = value;
                    break;
                case 'params':
                    req.params = value;
                    break;
            }

            next();

        } catch (error) {
            logger.error('Validation middleware error:', error);
            res.status(500).json({
                success: false,
                error: 'Validation error',
                message: 'Internal validation error'
            });
        }
    };
};

/**
 * Custom phone number validation function
 */
const validatePhoneNumber = (value, helpers) => {
    const validation = phoneValidator.validate(value);
    
    if (!validation.isValid) {
        return helpers.error('phone.invalid', { 
            message: validation.error 
        });
    }
    
    return validation.formatted;
};

/**
 * Joi schemas for different endpoints
 */
const schemas = {
    // API Key generation
    generateApiKey: Joi.object({
        name: Joi.string()
            .min(3)
            .max(100)
            .required()
            .messages({
                'string.min': 'API key name must be at least 3 characters long',
                'string.max': 'API key name cannot exceed 100 characters'
            }),
        permissions: Joi.array()
            .items(Joi.string().valid('send_otp', 'send_message', 'manage_sessions', 'view_stats', '*'))
            .default(['send_otp'])
            .messages({
                'array.includes': 'Invalid permission. Allowed: send_otp, send_message, manage_sessions, view_stats, *'
            }),
        rateLimit: Joi.number()
            .integer()
            .min(1)
            .max(10000)
            .default(100)
            .messages({
                'number.min': 'Rate limit must be at least 1',
                'number.max': 'Rate limit cannot exceed 10000'
            })
    }),

    // Send OTP
    sendOtp: Joi.object({
        phone: Joi.string()
            .custom(validatePhoneNumber)
            .required()
            .messages({
                'phone.invalid': '{{#message}}',
                'any.required': 'Phone number is required'
            }),
        length: Joi.number()
            .integer()
            .min(4)
            .max(8)
            .default(6)
            .messages({
                'number.min': 'OTP length must be at least 4 digits',
                'number.max': 'OTP length cannot exceed 8 digits'
            }),
        type: Joi.string()
            .valid('numeric', 'alpha', 'alphanumeric')
            .default('numeric')
            .messages({
                'any.only': 'OTP type must be numeric, alpha, or alphanumeric'
            }),
        expirationMinutes: Joi.number()
            .integer()
            .min(1)
            .max(60)
            .default(10)
            .messages({
                'number.min': 'Expiration must be at least 1 minute',
                'number.max': 'Expiration cannot exceed 60 minutes'
            }),
        customMessage: Joi.string()
            .max(1000)
            .optional()
            .messages({
                'string.max': 'Custom message cannot exceed 1000 characters'
            }),
        purpose: Joi.string()
            .max(50)
            .default('verification')
            .messages({
                'string.max': 'Purpose cannot exceed 50 characters'
            })
    }),

    // Send custom message
    sendMessage: Joi.object({
        phone: Joi.string()
            .custom(validatePhoneNumber)
            .required()
            .messages({
                'phone.invalid': '{{#message}}',
                'any.required': 'Phone number is required'
            }),
        message: Joi.string()
            .min(1)
            .max(1000)
            .required()
            .messages({
                'string.min': 'Message cannot be empty',
                'string.max': 'Message cannot exceed 1000 characters',
                'any.required': 'Message is required'
            })
    }),

    // Update API key
    updateApiKey: Joi.object({
        name: Joi.string()
            .min(3)
            .max(100)
            .optional(),
        permissions: Joi.array()
            .items(Joi.string().valid('send_otp', 'send_message', 'manage_sessions', 'view_stats', '*'))
            .optional(),
        rateLimit: Joi.number()
            .integer()
            .min(1)
            .max(10000)
            .optional(),
        isActive: Joi.boolean()
            .optional()
    }),

    // Query parameters for listing
    listQuery: Joi.object({
        page: Joi.number()
            .integer()
            .min(1)
            .default(1),
        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(50),
        sort: Joi.string()
            .valid('created_at', 'updated_at', 'name', 'last_used')
            .default('created_at'),
        order: Joi.string()
            .valid('asc', 'desc')
            .default('desc')
    }),

    // Message filtering
    messageQuery: Joi.object({
        page: Joi.number()
            .integer()
            .min(1)
            .default(1),
        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(50),
        status: Joi.string()
            .valid('pending', 'delivered', 'failed')
            .optional(),
        phone: Joi.string()
            .optional(),
        dateFrom: Joi.date()
            .iso()
            .optional(),
        dateTo: Joi.date()
            .iso()
            .optional(),
        apiKeyId: Joi.number()
            .integer()
            .optional()
    }).custom((value, helpers) => {
        // Ensure dateTo is after dateFrom
        if (value.dateFrom && value.dateTo && value.dateFrom >= value.dateTo) {
            return helpers.error('date.range');
        }
        return value;
    }).messages({
        'date.range': 'dateTo must be after dateFrom'
    }),

    // Statistics query
    statsQuery: Joi.object({
        days: Joi.number()
            .integer()
            .min(1)
            .max(365)
            .default(30),
        apiKeyId: Joi.number()
            .integer()
            .optional()
    }),

    // ID parameter validation
    idParam: Joi.object({
        id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.positive': 'ID must be a positive number',
                'any.required': 'ID is required'
            })
    }),

    // Session ID parameter validation
    sessionIdParam: Joi.object({
        sessionId: Joi.string()
            .uuid()
            .required()
            .messages({
                'string.uuid': 'Session ID must be a valid UUID',
                'any.required': 'Session ID is required'
            })
    }),

    // Validate OTP
    validateOtp: Joi.object({
        phone: Joi.string()
            .custom(validatePhoneNumber)
            .required(),
        otpCode: Joi.string()
            .min(4)
            .max(8)
            .required()
            .messages({
                'string.min': 'OTP code must be at least 4 characters',
                'string.max': 'OTP code cannot exceed 8 characters',
                'any.required': 'OTP code is required'
            }),
        purpose: Joi.string()
            .max(50)
            .default('verification')
    }),

    // File upload validation
    fileUpload: Joi.object({
        filename: Joi.string()
            .max(255)
            .required(),
        mimetype: Joi.string()
            .valid('image/jpeg', 'image/png', 'image/gif', 'text/csv', 'application/json')
            .required(),
        size: Joi.number()
            .max(10 * 1024 * 1024) // 10MB
            .required()
            .messages({
                'number.max': 'File size cannot exceed 10MB'
            })
    }),

    // Webhook configuration
    webhook: Joi.object({
        url: Joi.string()
            .uri()
            .required()
            .messages({
                'string.uri': 'Webhook URL must be a valid URL'
            }),
        events: Joi.array()
            .items(Joi.string().valid('message_sent', 'message_failed', 'session_connected', 'session_disconnected'))
            .min(1)
            .required(),
        secret: Joi.string()
            .min(10)
            .max(100)
            .optional()
    })
};

/**
 * Sanitize input to prevent XSS and injection attacks
 */
const sanitizeInput = (req, res, next) => {
    try {
        const sanitizeValue = (value) => {
            if (typeof value === 'string') {
                // Remove potentially dangerous characters
                return value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '')
                    .trim();
            }
            
            if (typeof value === 'object' && value !== null) {
                const sanitized = {};
                for (const [key, val] of Object.entries(value)) {
                    sanitized[key] = sanitizeValue(val);
                }
                return sanitized;
            }
            
            return value;
        };

        if (req.body) {
            req.body = sanitizeValue(req.body);
        }
        
        if (req.query) {
            req.query = sanitizeValue(req.query);
        }

        next();

    } catch (error) {
        logger.error('Input sanitization error:', error);
        res.status(500).json({
            success: false,
            error: 'Input processing error',
            message: 'Error processing request data'
        });
    }
};

/**
 * Validate content type
 */
const validateContentType = (allowedTypes = ['application/json']) => {
    return (req, res, next) => {
        if (req.method === 'GET' || req.method === 'DELETE') {
            return next();
        }

        const contentType = req.get('Content-Type');
        
        if (!contentType) {
            return res.status(400).json({
                success: false,
                error: 'Missing Content-Type header',
                message: 'Content-Type header is required'
            });
        }

        const isValidContentType = allowedTypes.some(type => 
            contentType.includes(type)
        );

        if (!isValidContentType) {
            return res.status(415).json({
                success: false,
                error: 'Unsupported Media Type',
                message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
                received: contentType
            });
        }

        next();
    };
};

// Export validators for specific endpoints
module.exports = {
    // Schema validators
    validateGenerateApiKey: createValidator(schemas.generateApiKey),
    validateSendOtp: createValidator(schemas.sendOtp),
    validateSendMessage: createValidator(schemas.sendMessage),
    validateUpdateApiKey: createValidator(schemas.updateApiKey),
    validateListQuery: createValidator(schemas.listQuery, 'query'),
    validateMessageQuery: createValidator(schemas.messageQuery, 'query'),
    validateStatsQuery: createValidator(schemas.statsQuery, 'query'),
    validateIdParam: createValidator(schemas.idParam, 'params'),
    validateSessionIdParam: createValidator(schemas.sessionIdParam, 'params'),
    validateOtp: createValidator(schemas.validateOtp),
    validateFileUpload: createValidator(schemas.fileUpload),
    validateWebhook: createValidator(schemas.webhook),

    // Utility validators
    sanitizeInput,
    validateContentType,
    createValidator,
    
    // Schemas for custom validation
    schemas
};