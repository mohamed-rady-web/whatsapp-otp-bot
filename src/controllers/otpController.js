/**
 * OTP Controller
 * 
 * Handles OTP generation, sending, and validation
 * with comprehensive rate limiting and security measures.
 */

const otpService = require('../services/otpService');
const sessionService = require('../services/sessionService');
const MessageModel = require('../models/message');
const logger = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const phoneValidator = require('../utils/phoneValidator');

class OtpController {
    /**
     * Send OTP to phone number
     */
    static async sendOtp(req, res, next) {
        try {
            const {
                phone,
                length,
                type,
                expirationMinutes,
                customMessage,
                purpose
            } = req.body;

            const apiKeyId = req.apiKey.id;

            // Validate phone number
            const phoneValidation = phoneValidator.validate(phone);
            if (!phoneValidation.isValid) {
                return next(new AppError(
                    `Invalid phone number: ${phoneValidation.error}`,
                    400,
                    'INVALID_PHONE_NUMBER'
                ));
            }

            const formattedPhone = phoneValidation.formatted;

            // Check if WhatsApp is connected
            const connectionStatus = await sessionService.getConnectionStatus();
            if (connectionStatus.status !== 'connected') {
                return next(new AppError(
                    'WhatsApp is not connected. Please connect first.',
                    503,
                    'WHATSAPP_NOT_CONNECTED',
                    { currentStatus: connectionStatus.status }
                ));
            }

            // Check rate limiting for this phone number
            const rateLimitCheck = otpService.checkRateLimit(formattedPhone, 1, 3);
            if (!rateLimitCheck.allowed) {
                return next(new AppError(
                    'Rate limit exceeded for this phone number',
                    429,
                    'PHONE_RATE_LIMIT_EXCEEDED',
                    {
                        count: rateLimitCheck.count,
                        limit: rateLimitCheck.limit,
                        windowMinutes: rateLimitCheck.windowMinutes
                    }
                ));
            }

            // Check daily limit for phone number
            const dailyLimitReached = await MessageModel.checkDailyLimit(formattedPhone, 10);
            if (dailyLimitReached) {
                return next(new AppError(
                    'Daily message limit reached for this phone number',
                    429,
                    'DAILY_LIMIT_EXCEEDED'
                ));
            }

            // Generate OTP
            const otpData = otpService.createOtp(formattedPhone, {
                length,
                type,
                expirationMinutes,
                purpose,
                metadata: {
                    apiKeyId,
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });

            // Format message
            const message = customMessage 
                ? otpService.formatOtpMessage(otpData.otp, { customMessage })
                : otpService.formatOtpMessage(otpData.otp, { 
                    expirationMinutes,
                    serviceName: 'WhatsApp OTP Bot'
                });

            // Send message
            const sendResult = await sessionService.sendMessage(
                formattedPhone,
                message,
                apiKeyId
            );

            logger.info('OTP sent successfully', {
                phone: phoneValidator.maskPhoneNumber(formattedPhone),
                purpose,
                length,
                type,
                apiKeyId,
                messageId: sendResult.messageId
            });

            res.json({
                success: true,
                message: 'OTP sent successfully',
                data: {
                    phone: phoneValidation.displayFormat,
                    messageId: sendResult.messageId,
                    purpose,
                    expiresAt: otpData.expiresAt,
                    expirationMinutes
                }
            });

        } catch (error) {
            logger.error('Failed to send OTP:', error);
            
            if (error.message.includes('WhatsApp not connected')) {
                return next(new AppError(
                    'WhatsApp service unavailable',
                    503,
                    'WHATSAPP_SERVICE_UNAVAILABLE'
                ));
            }
            
            next(new AppError('Failed to send OTP', 500, 'OTP_SEND_FAILED'));
        }
    }

    /**
     * Validate OTP code
     */
    static async validateOtp(req, res, next) {
        try {
            const { phone, otpCode, purpose } = req.body;

            // Validate phone number
            const phoneValidation = phoneValidator.validate(phone);
            if (!phoneValidation.isValid) {
                return next(new AppError(
                    `Invalid phone number: ${phoneValidation.error}`,
                    400,
                    'INVALID_PHONE_NUMBER'
                ));
            }

            const formattedPhone = phoneValidation.formatted;

            // Validate OTP
            const validationResult = otpService.validateOtp(formattedPhone, otpCode, purpose);

            if (!validationResult.isValid) {
                logger.warn('OTP validation failed', {
                    phone: phoneValidator.maskPhoneNumber(formattedPhone),
                    reason: validationResult.reason,
                    attemptsRemaining: validationResult.attemptsRemaining,
                    ip: req.ip
                });

                return res.status(400).json({
                    success: false,
                    error: 'OTP validation failed',
                    message: validationResult.reason,
                    attemptsRemaining: validationResult.attemptsRemaining
                });
            }

            logger.info('OTP validated successfully', {
                phone: phoneValidator.maskPhoneNumber(formattedPhone),
                purpose,
                apiKeyId: req.apiKey.id
            });

            res.json({
                success: true,
                message: 'OTP validated successfully',
                data: {
                    phone: phoneValidation.displayFormat,
                    purpose,
                    validatedAt: new Date().toISOString(),
                    metadata: validationResult.metadata
                }
            });

        } catch (error) {
            logger.error('Failed to validate OTP:', error);
            next(new AppError('Failed to validate OTP', 500, 'OTP_VALIDATION_FAILED'));
        }
    }

    /**
     * Get OTP information
     */
    static async getOtpInfo(req, res, next) {
        try {
            const { phone, purpose = 'verification' } = req.query;

            if (!phone) {
                return next(new AppError('Phone number is required', 400, 'PHONE_REQUIRED'));
            }

            // Validate phone number
            const phoneValidation = phoneValidator.validate(phone);
            if (!phoneValidation.isValid) {
                return next(new AppError(
                    `Invalid phone number: ${phoneValidation.error}`,
                    400,
                    'INVALID_PHONE_NUMBER'
                ));
            }

            const formattedPhone = phoneValidation.formatted;

            // Get OTP info
            const otpInfo = otpService.getOtpInfo(formattedPhone, purpose);

            if (!otpInfo) {
                return res.json({
                    success: true,
                    message: 'No active OTP found',
                    data: {
                        phone: phoneValidation.displayFormat,
                        purpose,
                        exists: false
                    }
                });
            }

            res.json({
                success: true,
                message: 'OTP information retrieved',
                data: {
                    phone: phoneValidation.displayFormat,
                    purpose,
                    ...otpInfo
                }
            });

        } catch (error) {
            logger.error('Failed to get OTP info:', error);
            next(new AppError('Failed to retrieve OTP information', 500, 'OTP_INFO_FAILED'));
        }
    }

    /**
     * Revoke/cancel OTP
     */
    static async revokeOtp(req, res, next) {
        try {
            const { phone, purpose = 'verification' } = req.body;

            // Validate phone number
            const phoneValidation = phoneValidator.validate(phone);
            if (!phoneValidation.isValid) {
                return next(new AppError(
                    `Invalid phone number: ${phoneValidation.error}`,
                    400,
                    'INVALID_PHONE_NUMBER'
                ));
            }

            const formattedPhone = phoneValidation.formatted;

            // Revoke OTP
            const revoked = otpService.revokeOtp(formattedPhone, purpose);

            if (!revoked) {
                return res.json({
                    success: true,
                    message: 'No active OTP found to revoke',
                    data: {
                        phone: phoneValidation.displayFormat,
                        purpose,
                        revoked: false
                    }
                });
            }

            logger.info('OTP revoked', {
                phone: phoneValidator.maskPhoneNumber(formattedPhone),
                purpose,
                apiKeyId: req.apiKey.id,
                ip: req.ip
            });

            res.json({
                success: true,
                message: 'OTP revoked successfully',
                data: {
                    phone: phoneValidation.displayFormat,
                    purpose,
                    revoked: true,
                    revokedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error('Failed to revoke OTP:', error);
            next(new AppError('Failed to revoke OTP', 500, 'OTP_REVOKE_FAILED'));
        }
    }

    /**
     * Send custom message (non-OTP)
     */
    static async sendMessage(req, res, next) {
        try {
            const { phone, message } = req.body;
            const apiKeyId = req.apiKey.id;

            // Validate phone number
            const phoneValidation = phoneValidator.validate(phone);
            if (!phoneValidation.isValid) {
                return next(new AppError(
                    `Invalid phone number: ${phoneValidation.error}`,
                    400,
                    'INVALID_PHONE_NUMBER'
                ));
            }

            const formattedPhone = phoneValidation.formatted;

            // Check if WhatsApp is connected
            const connectionStatus = await sessionService.getConnectionStatus();
            if (connectionStatus.status !== 'connected') {
                return next(new AppError(
                    'WhatsApp is not connected. Please connect first.',
                    503,
                    'WHATSAPP_NOT_CONNECTED',
                    { currentStatus: connectionStatus.status }
                ));
            }

            // Check daily limit for phone number
            const dailyLimitReached = await MessageModel.checkDailyLimit(formattedPhone, 20);
            if (dailyLimitReached) {
                return next(new AppError(
                    'Daily message limit reached for this phone number',
                    429,
                    'DAILY_LIMIT_EXCEEDED'
                ));
            }

            // Send message
            const sendResult = await sessionService.sendMessage(
                formattedPhone,
                message,
                apiKeyId
            );

            logger.info('Custom message sent successfully', {
                phone: phoneValidator.maskPhoneNumber(formattedPhone),
                messageLength: message.length,
                apiKeyId,
                messageId: sendResult.messageId
            });

            res.json({
                success: true,
                message: 'Message sent successfully',
                data: {
                    phone: phoneValidation.displayFormat,
                    messageId: sendResult.messageId,
                    sentAt: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error('Failed to send message:', error);
            
            if (error.message.includes('WhatsApp not connected')) {
                return next(new AppError(
                    'WhatsApp service unavailable',
                    503,
                    'WHATSAPP_SERVICE_UNAVAILABLE'
                ));
            }
            
            next(new AppError('Failed to send message', 500, 'MESSAGE_SEND_FAILED'));
        }
    }

    /**
     * Get OTP statistics
     */
    static async getOtpStats(req, res, next) {
        try {
            const stats = otpService.getStats();

            res.json({
                success: true,
                message: 'OTP statistics retrieved successfully',
                data: {
                    ...stats,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error('Failed to get OTP stats:', error);
            next(new AppError('Failed to retrieve OTP statistics', 500, 'OTP_STATS_FAILED'));
        }
    }

    /**
     * Resend OTP
     */
    static async resendOtp(req, res, next) {
        try {
            const { phone, purpose = 'verification' } = req.body;

            // Validate phone number
            const phoneValidation = phoneValidator.validate(phone);
            if (!phoneValidation.isValid) {
                return next(new AppError(
                    `Invalid phone number: ${phoneValidation.error}`,
                    400,
                    'INVALID_PHONE_NUMBER'
                ));
            }

            const formattedPhone = phoneValidation.formatted;

            // Check if there's an existing OTP
            const existingOtp = otpService.getOtpInfo(formattedPhone, purpose);
            
            if (!existingOtp || existingOtp.isExpired) {
                return next(new AppError(
                    'No active OTP found to resend. Please request a new one.',
                    400,
                    'NO_ACTIVE_OTP'
                ));
            }

            // Check resend rate limiting (more restrictive)
            const rateLimitCheck = otpService.checkRateLimit(formattedPhone, 5, 2); // 2 per 5 minutes
            if (!rateLimitCheck.allowed) {
                return next(new AppError(
                    'Resend rate limit exceeded. Please wait before requesting again.',
                    429,
                    'RESEND_RATE_LIMIT_EXCEEDED',
                    {
                        waitMinutes: 5
                    }
                ));
            }

            // Revoke existing OTP and create new one with same parameters
            otpService.revokeOtp(formattedPhone, purpose);

            // Create new OTP (use same parameters as before)
            const otpData = otpService.createOtp(formattedPhone, {
                purpose,
                metadata: {
                    apiKeyId: req.apiKey.id,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    isResend: true
                }
            });

            // Format and send message
            const message = otpService.formatOtpMessage(otpData.otp, { 
                serviceName: 'WhatsApp OTP Bot (Resent)'
            });

            const sendResult = await sessionService.sendMessage(
                formattedPhone,
                message,
                req.apiKey.id
            );

            logger.info('OTP resent successfully', {
                phone: phoneValidator.maskPhoneNumber(formattedPhone),
                purpose,
                apiKeyId: req.apiKey.id,
                messageId: sendResult.messageId
            });

            res.json({
                success: true,
                message: 'OTP resent successfully',
                data: {
                    phone: phoneValidation.displayFormat,
                    messageId: sendResult.messageId,
                    purpose,
                    expiresAt: otpData.expiresAt
                }
            });

        } catch (error) {
            logger.error('Failed to resend OTP:', error);
            next(new AppError('Failed to resend OTP', 500, 'OTP_RESEND_FAILED'));
        }
    }
}

module.exports = OtpController;