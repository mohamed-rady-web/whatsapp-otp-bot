/**
 * OTP Generator utility
 */
class OTPGenerator {
  static generate(length = 6, type = 'numeric') {
    let charset;
    
    switch (type) {
      case 'numeric':
        charset = '0123456789';
        break;
      case 'alpha':
        charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        break;
      case 'alphanumeric':
        charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        break;
      default:
        charset = '0123456789';
    }
    
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return otp;
  }

  static isValid(otp, length = 6, type = 'numeric') {
    if (!otp || otp.length !== length) {
      return false;
    }

    let pattern;
    switch (type) {
      case 'numeric':
        pattern = /^\d+$/;
        break;
      case 'alpha':
        pattern = /^[A-Z]+$/;
        break;
      case 'alphanumeric':
        pattern = /^[A-Z0-9]+$/;
        break;
      default:
        pattern = /^\d+$/;
    }

    return pattern.test(otp);
  }
}

/**
 * Phone number utilities
 */
class PhoneUtils {
  static normalize(phoneNumber) {
    // Remove all non-digit characters except +
    let normalized = phoneNumber.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    
    return normalized;
  }

  static isValid(phoneNumber) {
    const normalized = this.normalize(phoneNumber);
    // Basic international phone number validation - must be at least 8 digits after country code
    const pattern = /^\+[1-9]\d{7,14}$/;
    return pattern.test(normalized);
  }

  static getCountryCode(phoneNumber) {
    const normalized = this.normalize(phoneNumber);
    
    // Common country codes mapping
    const countryCodes = {
      '+1': 'US/CA',
      '+44': 'UK',
      '+49': 'DE',
      '+33': 'FR',
      '+39': 'IT',
      '+34': 'ES',
      '+91': 'IN',
      '+86': 'CN',
      '+81': 'JP',
      '+82': 'KR',
      '+55': 'BR',
      '+52': 'MX',
      '+61': 'AU',
      '+64': 'NZ',
      '+27': 'ZA',
      '+20': 'EG',
      '+234': 'NG',
      '+254': 'KE',
      '+90': 'TR',
      '+7': 'RU',
      '+380': 'UA',
      '+48': 'PL',
      '+31': 'NL',
      '+46': 'SE',
      '+47': 'NO',
      '+45': 'DK',
      '+358': 'FI',
      '+41': 'CH',
      '+43': 'AT',
      '+32': 'BE',
      '+351': 'PT',
      '+30': 'GR',
      '+36': 'HU',
      '+420': 'CZ',
      '+421': 'SK'
    };

    // Find matching country code
    for (const [code, country] of Object.entries(countryCodes)) {
      if (normalized.startsWith(code)) {
        return { code, country };
      }
    }

    return { code: 'unknown', country: 'Unknown' };
  }

  static format(phoneNumber, format = 'international') {
    const normalized = this.normalize(phoneNumber);
    
    if (format === 'international') {
      return normalized;
    } else if (format === 'national') {
      return normalized.substring(1); // Remove the +
    } else if (format === 'whatsapp') {
      return normalized.substring(1); // WhatsApp uses numbers without +
    }
    
    return normalized;
  }
}

/**
 * Template processing utilities
 */
class TemplateUtils {
  static process(template, variables) {
    let processed = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      processed = processed.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }
    
    return processed;
  }

  static getVariables(template) {
    const regex = /{([^}]+)}/g;
    const variables = [];
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1]);
    }
    
    return [...new Set(variables)]; // Remove duplicates
  }

  static validate(template, requiredVariables = []) {
    const templateVars = this.getVariables(template);
    const missing = requiredVariables.filter(required => !templateVars.includes(required));
    const extra = templateVars.filter(template => !requiredVariables.includes(template));
    
    return {
      isValid: missing.length === 0,
      missing,
      extra,
      variables: templateVars
    };
  }
}

/**
 * Rate limiting utilities
 */
class RateLimitUtils {
  static calculateReset(windowMs) {
    return new Date(Date.now() + windowMs);
  }

  static isExpired(resetTime) {
    return new Date() > new Date(resetTime);
  }

  static getRemainingTime(resetTime) {
    const remaining = new Date(resetTime) - new Date();
    return Math.max(0, remaining);
  }

  static formatRemainingTime(milliseconds) {
    const seconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

/**
 * Validation utilities
 */
class ValidationUtils {
  static sanitizeInput(input, maxLength = 1000) {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .trim()
      .substring(0, maxLength)
      .replace(/[<>]/g, ''); // Basic XSS prevention
  }

  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isValidEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
  }

  static isValidApiKey(apiKey) {
    const pattern = /^wab_[a-f0-9]{32}$/;
    return pattern.test(apiKey);
  }

  static validateOtpRequest(data) {
    const errors = [];
    
    if (!data.phoneNumber) {
      errors.push('Phone number is required');
    } else if (!PhoneUtils.isValid(data.phoneNumber)) {
      errors.push('Invalid phone number format');
    }
    
    if (data.otpLength && (data.otpLength < 4 || data.otpLength > 10)) {
      errors.push('OTP length must be between 4 and 10');
    }
    
    if (data.template && data.template.length > 500) {
      errors.push('Template too long (max 500 characters)');
    }
    
    if (data.appName && data.appName.length > 100) {
      errors.push('App name too long (max 100 characters)');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Time utilities
 */
class TimeUtils {
  static addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  static addHours(date, hours) {
    return new Date(date.getTime() + hours * 3600000);
  }

  static addDays(date, days) {
    return new Date(date.getTime() + days * 86400000);
  }

  static isExpired(expiryDate) {
    return new Date() > new Date(expiryDate);
  }

  static formatRelative(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }
}

module.exports = {
  OTPGenerator,
  PhoneUtils,
  TemplateUtils,
  RateLimitUtils,
  ValidationUtils,
  TimeUtils
};