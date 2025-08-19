/**
 * Phone Number Validation Utilities
 * 
 * Validates and formats phone numbers for WhatsApp messaging
 * with support for international formats and country codes.
 */

const logger = require('../config/logger');

class PhoneValidator {
    constructor() {
        // Common country codes and their patterns
        this.countryPatterns = {
            US: /^1[2-9]\d{9}$/,              // +1 followed by 10 digits
            CA: /^1[2-9]\d{9}$/,              // +1 followed by 10 digits
            GB: /^44[1-9]\d{8,9}$/,           // +44 followed by 9-10 digits
            AU: /^61[2-9]\d{8}$/,             // +61 followed by 9 digits
            DE: /^49[1-9]\d{10,11}$/,         // +49 followed by 10-11 digits
            FR: /^33[1-9]\d{8}$/,             // +33 followed by 9 digits
            IN: /^91[6-9]\d{9}$/,             // +91 followed by 10 digits starting with 6-9
            BR: /^55[1-9]\d{8,9}$/,           // +55 followed by 9-10 digits
            MX: /^52[1-9]\d{9}$/,             // +52 followed by 10 digits
            EG: /^20[1-9]\d{8,9}$/,           // +20 followed by 9-10 digits
            SA: /^966[5]\d{8}$/,              // +966 followed by 9 digits starting with 5
            AE: /^971[5]\d{8}$/,              // +971 followed by 9 digits starting with 5
        };

        // WhatsApp specific validation rules
        this.whatsappRules = {
            minLength: 10,
            maxLength: 15,
            allowedChars: /^[0-9+\-\s()]+$/
        };
    }

    /**
     * Validate phone number format
     */
    validate(phone, countryCode = null) {
        try {
            if (!phone) {
                return {
                    isValid: false,
                    error: 'Phone number is required',
                    formatted: null
                };
            }

            // Clean the phone number
            const cleaned = this.cleanPhoneNumber(phone);
            
            if (!cleaned) {
                return {
                    isValid: false,
                    error: 'Invalid phone number format',
                    formatted: null
                };
            }

            // Basic length validation
            if (cleaned.length < this.whatsappRules.minLength || 
                cleaned.length > this.whatsappRules.maxLength) {
                return {
                    isValid: false,
                    error: `Phone number must be between ${this.whatsappRules.minLength} and ${this.whatsappRules.maxLength} digits`,
                    formatted: null
                };
            }

            // Format for WhatsApp
            const formatted = this.formatForWhatsApp(cleaned, countryCode);
            
            if (!formatted) {
                return {
                    isValid: false,
                    error: 'Unable to format phone number for WhatsApp',
                    formatted: null
                };
            }

            // Additional validation if country code is specified
            if (countryCode) {
                const countryValidation = this.validateByCountry(formatted, countryCode);
                if (!countryValidation.isValid) {
                    return countryValidation;
                }
            }

            // Check if it's a valid WhatsApp number format
            const whatsappValidation = this.validateWhatsAppFormat(formatted);
            
            return {
                isValid: whatsappValidation.isValid,
                error: whatsappValidation.error,
                formatted: formatted,
                countryCode: this.detectCountryCode(formatted),
                displayFormat: this.formatForDisplay(formatted)
            };

        } catch (error) {
            logger.error('Phone validation error:', error);
            return {
                isValid: false,
                error: 'Validation error occurred',
                formatted: null
            };
        }
    }

    /**
     * Clean phone number by removing all non-digit characters except +
     */
    cleanPhoneNumber(phone) {
        if (typeof phone !== 'string') {
            phone = String(phone);
        }

        // Remove all characters except digits and +
        let cleaned = phone.replace(/[^\d+]/g, '');
        
        // If starts with +, remove it and keep the rest
        if (cleaned.startsWith('+')) {
            cleaned = cleaned.substring(1);
        }
        
        // Remove any remaining + characters
        cleaned = cleaned.replace(/\+/g, '');
        
        return cleaned;
    }

    /**
     * Format phone number for WhatsApp (international format without +)
     */
    formatForWhatsApp(cleaned, countryCode = null) {
        try {
            // If no country code and number doesn't start with country code, try to add default
            if (countryCode && !this.hasCountryCode(cleaned)) {
                const defaultCode = this.getCountryDialCode(countryCode);
                if (defaultCode) {
                    cleaned = defaultCode + cleaned;
                }
            }

            // Handle US/Canada numbers (if 10 digits, add 1)
            if (cleaned.length === 10 && /^[2-9]\d{9}$/.test(cleaned)) {
                cleaned = '1' + cleaned;
            }

            return cleaned;

        } catch (error) {
            logger.error('Error formatting phone for WhatsApp:', error);
            return null;
        }
    }

    /**
     * Check if phone number already has country code
     */
    hasCountryCode(phone) {
        // Check against known country code patterns
        for (const pattern of Object.values(this.countryPatterns)) {
            if (pattern.test(phone)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get dial code for country
     */
    getCountryDialCode(countryCode) {
        const dialCodes = {
            US: '1', CA: '1', GB: '44', AU: '61', DE: '49',
            FR: '33', IN: '91', BR: '55', MX: '52', EG: '20',
            SA: '966', AE: '971'
        };
        
        return dialCodes[countryCode.toUpperCase()];
    }

    /**
     * Detect country code from phone number
     */
    detectCountryCode(phone) {
        for (const [country, pattern] of Object.entries(this.countryPatterns)) {
            if (pattern.test(phone)) {
                return country;
            }
        }
        return 'UNKNOWN';
    }

    /**
     * Validate phone number by country
     */
    validateByCountry(phone, countryCode) {
        const pattern = this.countryPatterns[countryCode.toUpperCase()];
        
        if (!pattern) {
            return {
                isValid: true, // If we don't have a pattern, assume valid
                error: null
            };
        }

        const isValid = pattern.test(phone);
        
        return {
            isValid,
            error: isValid ? null : `Invalid phone number format for ${countryCode}`
        };
    }

    /**
     * Validate WhatsApp specific format
     */
    validateWhatsAppFormat(phone) {
        // WhatsApp requires international format without +
        // Should be all digits, 10-15 characters
        
        if (!/^\d+$/.test(phone)) {
            return {
                isValid: false,
                error: 'Phone number should contain only digits'
            };
        }

        if (phone.length < 10 || phone.length > 15) {
            return {
                isValid: false,
                error: 'Phone number must be 10-15 digits long'
            };
        }

        // Should not start with 0 (except for some specific cases)
        if (phone.startsWith('0')) {
            return {
                isValid: false,
                error: 'Phone number should not start with 0 for international format'
            };
        }

        return {
            isValid: true,
            error: null
        };
    }

    /**
     * Format phone number for display
     */
    formatForDisplay(phone) {
        if (!phone) return phone;

        // Add + prefix for display
        let formatted = '+' + phone;

        // Format based on detected country
        const country = this.detectCountryCode(phone);
        
        switch (country) {
            case 'US':
            case 'CA':
                // +1 (XXX) XXX-XXXX
                if (phone.length === 11 && phone.startsWith('1')) {
                    formatted = `+1 (${phone.substring(1, 4)}) ${phone.substring(4, 7)}-${phone.substring(7)}`;
                }
                break;
            case 'GB':
                // +44 XXXX XXX XXX
                if (phone.startsWith('44')) {
                    const number = phone.substring(2);
                    if (number.length >= 10) {
                        formatted = `+44 ${number.substring(0, 4)} ${number.substring(4, 7)} ${number.substring(7)}`;
                    }
                }
                break;
            // Add more formatting rules as needed
        }

        return formatted;
    }

    /**
     * Validate multiple phone numbers
     */
    validateBatch(phones, countryCode = null) {
        const results = [];
        
        for (const phone of phones) {
            const result = this.validate(phone, countryCode);
            results.push({
                original: phone,
                ...result
            });
        }

        return {
            results,
            summary: {
                total: phones.length,
                valid: results.filter(r => r.isValid).length,
                invalid: results.filter(r => !r.isValid).length
            }
        };
    }

    /**
     * Extract phone numbers from text
     */
    extractPhoneNumbers(text) {
        // Common phone number patterns
        const patterns = [
            /\+?1?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // US/Canada
            /\+?44[-.\s]?\d{4}[-.\s]?\d{3}[-.\s]?\d{3}/g,              // UK
            /\+?\d{1,4}[-.\s]?\d{6,14}/g                               // General international
        ];

        const extracted = [];
        
        for (const pattern of patterns) {
            const matches = text.match(pattern);
            if (matches) {
                extracted.push(...matches);
            }
        }

        // Remove duplicates and validate
        const unique = [...new Set(extracted)];
        return unique.map(phone => ({
            original: phone,
            ...this.validate(phone)
        }));
    }

    /**
     * Check if phone number is likely a mobile number
     */
    isMobileNumber(phone, countryCode = null) {
        const cleaned = this.cleanPhoneNumber(phone);
        
        // Mobile number patterns by country
        const mobilePatterns = {
            US: /^1[2-9]\d{9}$/, // All US numbers can be mobile
            CA: /^1[2-9]\d{9}$/, // All CA numbers can be mobile
            GB: /^447[0-9]\d{8}$/, // UK mobile starts with 447
            IN: /^91[6-9]\d{9}$/, // India mobile starts with 6-9
            AU: /^614\d{8}|^614\d{8}|^614\d{8}$/, // Australia mobile
            EG: /^20[1][0-9]\d{8}$/, // Egypt mobile
        };

        if (countryCode && mobilePatterns[countryCode.toUpperCase()]) {
            return mobilePatterns[countryCode.toUpperCase()].test(cleaned);
        }

        // General heuristics for mobile numbers
        // This is not 100% accurate but covers common cases
        return cleaned.length >= 10 && cleaned.length <= 15;
    }

    /**
     * Get phone number info
     */
    getPhoneInfo(phone, countryCode = null) {
        const validation = this.validate(phone, countryCode);
        
        if (!validation.isValid) {
            return validation;
        }

        const cleaned = validation.formatted;
        
        return {
            ...validation,
            info: {
                length: cleaned.length,
                detectedCountry: this.detectCountryCode(cleaned),
                isMobile: this.isMobileNumber(cleaned, countryCode),
                timezone: this.getTimezoneByCountry(this.detectCountryCode(cleaned))
            }
        };
    }

    /**
     * Get timezone by country code
     */
    getTimezoneByCountry(countryCode) {
        const timezones = {
            US: 'America/New_York', // Multiple timezones, using Eastern as default
            CA: 'America/Toronto',
            GB: 'Europe/London',
            AU: 'Australia/Sydney',
            DE: 'Europe/Berlin',
            FR: 'Europe/Paris',
            IN: 'Asia/Kolkata',
            BR: 'America/Sao_Paulo',
            MX: 'America/Mexico_City',
            EG: 'Africa/Cairo',
            SA: 'Asia/Riyadh',
            AE: 'Asia/Dubai'
        };
        
        return timezones[countryCode] || 'UTC';
    }
}

// Create singleton instance
const phoneValidator = new PhoneValidator();

module.exports = phoneValidator;