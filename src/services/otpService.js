/**
 * OTP Service
 * 
 * Generates, validates, and manages One-Time Passwords
 * with customizable length, expiration, and format.
 */

const crypto = require('crypto');
const logger = require('../config/logger');

class OtpService {
    constructor() {
        this.otpStorage = new Map(); // In-memory storage for OTPs
        this.defaultLength = 6;
        this.defaultExpiration = 10; // minutes
        this.maxAttempts = 3;
    }

    /**
     * Generate OTP code
     */
    generateOtp(length = this.defaultLength, type = 'numeric') {
        try {
            let characters;
            
            switch (type) {
                case 'numeric':
                    characters = '0123456789';
                    break;
                case 'alpha':
                    characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    break;
                case 'alphanumeric':
                    characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                    break;
                default:
                    characters = '0123456789';
            }

            let otp = '';
            for (let i = 0; i < length; i++) {
                const randomIndex = crypto.randomInt(0, characters.length);
                otp += characters[randomIndex];
            }

            // Ensure numeric OTPs don't start with 0 for better UX
            if (type === 'numeric' && otp[0] === '0') {
                otp = '1' + otp.substring(1);
            }

            return otp;

        } catch (error) {
            logger.error('Failed to generate OTP:', error);
            throw new Error('OTP generation failed');
        }
    }

    /**
     * Create and store OTP with metadata
     */
    createOtp(identifier, options = {}) {
        try {
            const {
                length = this.defaultLength,
                type = 'numeric',
                expirationMinutes = this.defaultExpiration,
                maxAttempts = this.maxAttempts,
                purpose = 'verification',
                metadata = {}
            } = options;

            const otp = this.generateOtp(length, type);
            const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
            
            const otpData = {
                code: otp,
                identifier,
                purpose,
                createdAt: new Date(),
                expiresAt,
                attempts: 0,
                maxAttempts,
                isUsed: false,
                metadata
            };

            // Store OTP (use combination of identifier and purpose as key)
            const key = `${identifier}:${purpose}`;
            this.otpStorage.set(key, otpData);

            logger.info('OTP created', {
                identifier: this.maskIdentifier(identifier),
                purpose,
                length,
                type,
                expirationMinutes
            });

            return {
                otp,
                expiresAt: expiresAt.toISOString(),
                purpose
            };

        } catch (error) {
            logger.error('Failed to create OTP:', error);
            throw new Error('OTP creation failed');
        }
    }

    /**
     * Validate OTP code
     */
    validateOtp(identifier, otpCode, purpose = 'verification') {
        try {
            const key = `${identifier}:${purpose}`;
            const otpData = this.otpStorage.get(key);

            if (!otpData) {
                logger.warn('OTP validation failed - not found', {
                    identifier: this.maskIdentifier(identifier),
                    purpose
                });
                return {
                    isValid: false,
                    reason: 'OTP not found'
                };
            }

            // Check if already used
            if (otpData.isUsed) {
                logger.warn('OTP validation failed - already used', {
                    identifier: this.maskIdentifier(identifier),
                    purpose
                });
                return {
                    isValid: false,
                    reason: 'OTP already used'
                };
            }

            // Check if expired
            if (new Date() > otpData.expiresAt) {
                this.otpStorage.delete(key);
                logger.warn('OTP validation failed - expired', {
                    identifier: this.maskIdentifier(identifier),
                    purpose
                });
                return {
                    isValid: false,
                    reason: 'OTP expired'
                };
            }

            // Increment attempt counter
            otpData.attempts++;

            // Check max attempts
            if (otpData.attempts > otpData.maxAttempts) {
                this.otpStorage.delete(key);
                logger.warn('OTP validation failed - max attempts exceeded', {
                    identifier: this.maskIdentifier(identifier),
                    purpose,
                    attempts: otpData.attempts
                });
                return {
                    isValid: false,
                    reason: 'Maximum attempts exceeded'
                };
            }

            // Validate code
            if (otpData.code !== otpCode.toString().toUpperCase()) {
                logger.warn('OTP validation failed - invalid code', {
                    identifier: this.maskIdentifier(identifier),
                    purpose,
                    attempts: otpData.attempts
                });
                return {
                    isValid: false,
                    reason: 'Invalid OTP code',
                    attemptsRemaining: otpData.maxAttempts - otpData.attempts
                };
            }

            // Mark as used
            otpData.isUsed = true;
            otpData.validatedAt = new Date();

            logger.info('OTP validated successfully', {
                identifier: this.maskIdentifier(identifier),
                purpose,
                attempts: otpData.attempts
            });

            // Keep for audit trail for a short time, then remove
            setTimeout(() => {
                this.otpStorage.delete(key);
            }, 60000); // Remove after 1 minute

            return {
                isValid: true,
                metadata: otpData.metadata
            };

        } catch (error) {
            logger.error('OTP validation error:', error);
            return {
                isValid: false,
                reason: 'Validation error'
            };
        }
    }

    /**
     * Check if OTP exists and get info
     */
    getOtpInfo(identifier, purpose = 'verification') {
        try {
            const key = `${identifier}:${purpose}`;
            const otpData = this.otpStorage.get(key);

            if (!otpData) {
                return null;
            }

            const now = new Date();
            const isExpired = now > otpData.expiresAt;
            const timeRemaining = Math.max(0, Math.floor((otpData.expiresAt - now) / 1000));

            return {
                exists: true,
                isExpired,
                isUsed: otpData.isUsed,
                attempts: otpData.attempts,
                maxAttempts: otpData.maxAttempts,
                attemptsRemaining: otpData.maxAttempts - otpData.attempts,
                timeRemaining,
                createdAt: otpData.createdAt.toISOString(),
                expiresAt: otpData.expiresAt.toISOString(),
                purpose: otpData.purpose
            };

        } catch (error) {
            logger.error('Error getting OTP info:', error);
            return null;
        }
    }

    /**
     * Revoke/invalidate OTP
     */
    revokeOtp(identifier, purpose = 'verification') {
        try {
            const key = `${identifier}:${purpose}`;
            const deleted = this.otpStorage.delete(key);

            if (deleted) {
                logger.info('OTP revoked', {
                    identifier: this.maskIdentifier(identifier),
                    purpose
                });
            }

            return deleted;

        } catch (error) {
            logger.error('Error revoking OTP:', error);
            return false;
        }
    }

    /**
     * Clean up expired OTPs
     */
    cleanupExpiredOtps() {
        try {
            const now = new Date();
            let cleanupCount = 0;

            for (const [key, otpData] of this.otpStorage.entries()) {
                if (now > otpData.expiresAt || otpData.isUsed) {
                    this.otpStorage.delete(key);
                    cleanupCount++;
                }
            }

            if (cleanupCount > 0) {
                logger.info(`Cleaned up ${cleanupCount} expired/used OTPs`);
            }

            return cleanupCount;

        } catch (error) {
            logger.error('Error during OTP cleanup:', error);
            return 0;
        }
    }

    /**
     * Get OTP statistics
     */
    getStats() {
        try {
            const now = new Date();
            const stats = {
                total: this.otpStorage.size,
                active: 0,
                expired: 0,
                used: 0
            };

            for (const otpData of this.otpStorage.values()) {
                if (otpData.isUsed) {
                    stats.used++;
                } else if (now > otpData.expiresAt) {
                    stats.expired++;
                } else {
                    stats.active++;
                }
            }

            return stats;

        } catch (error) {
            logger.error('Error getting OTP stats:', error);
            return { total: 0, active: 0, expired: 0, used: 0 };
        }
    }

    /**
     * Format OTP for display/messaging
     */
    formatOtpMessage(otp, options = {}) {
        const {
            serviceName = 'WhatsApp OTP Bot',
            expirationMinutes = this.defaultExpiration,
            includeWarning = true,
            customMessage = null
        } = options;

        if (customMessage) {
            return customMessage.replace('{OTP}', otp).replace('{EXPIRY}', expirationMinutes);
        }

        let message = `Your ${serviceName} verification code is: ${otp}`;
        
        if (expirationMinutes) {
            message += `\n\nThis code will expire in ${expirationMinutes} minutes.`;
        }

        if (includeWarning) {
            message += '\n\nDo not share this code with anyone for security reasons.';
        }

        return message;
    }

    /**
     * Generate OTP with specific pattern
     */
    generatePatternOtp(pattern) {
        try {
            // Pattern examples:
            // "NNNN" = 4 digit number
            // "AAAA" = 4 letters
            // "AA-NN" = 2 letters, dash, 2 numbers
            
            let otp = '';
            
            for (let i = 0; i < pattern.length; i++) {
                const char = pattern[i];
                
                switch (char) {
                    case 'N':
                        otp += Math.floor(Math.random() * 10);
                        break;
                    case 'A':
                        otp += String.fromCharCode(65 + Math.floor(Math.random() * 26));
                        break;
                    case 'a':
                        otp += String.fromCharCode(97 + Math.floor(Math.random() * 26));
                        break;
                    default:
                        otp += char;
                }
            }

            return otp;

        } catch (error) {
            logger.error('Failed to generate pattern OTP:', error);
            throw new Error('Pattern OTP generation failed');
        }
    }

    /**
     * Mask identifier for privacy
     */
    maskIdentifier(identifier) {
        if (!identifier || identifier.length < 4) {
            return identifier;
        }
        
        const visible = 2;
        const masked = '*'.repeat(identifier.length - visible * 2);
        return identifier.substring(0, visible) + masked + identifier.substring(identifier.length - visible);
    }

    /**
     * Start automatic cleanup interval
     */
    startCleanupInterval(intervalMinutes = 5) {
        setInterval(() => {
            this.cleanupExpiredOtps();
        }, intervalMinutes * 60 * 1000);
        
        logger.info(`OTP cleanup interval started (${intervalMinutes} minutes)`);
    }

    /**
     * Rate limiting for OTP generation
     */
    checkRateLimit(identifier, windowMinutes = 1, maxOtps = 3) {
        try {
            const now = new Date();
            const windowStart = new Date(now - windowMinutes * 60 * 1000);
            
            let otpsInWindow = 0;
            
            for (const otpData of this.otpStorage.values()) {
                if (otpData.identifier === identifier && otpData.createdAt > windowStart) {
                    otpsInWindow++;
                }
            }

            return {
                allowed: otpsInWindow < maxOtps,
                count: otpsInWindow,
                limit: maxOtps,
                windowMinutes
            };

        } catch (error) {
            logger.error('Error checking OTP rate limit:', error);
            return { allowed: true, count: 0, limit: maxOtps, windowMinutes };
        }
    }
}

// Create singleton instance
const otpService = new OtpService();

// Start cleanup interval
otpService.startCleanupInterval(5); // Clean up every 5 minutes

module.exports = otpService;