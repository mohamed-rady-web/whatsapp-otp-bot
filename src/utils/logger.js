const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define custom formats
const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
  
  // Add metadata if present
  if (Object.keys(meta).length > 0) {
    log += ' ' + JSON.stringify(meta);
  }
  
  return log;
});

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'whatsapp-otp-bot' },
  transports: [
    // Write all logs with level 'error' and below to 'error.log'
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        customFormat
      )
    }),
    
    // Write all logs to 'combined.log'
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        customFormat
      )
    })
  ]
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        let log = `${timestamp} ${level}: ${message}`;
        
        // Add metadata if present
        if (Object.keys(meta).length > 0) {
          log += ' ' + JSON.stringify(meta, null, 2);
        }
        
        return log;
      })
    )
  }));
}

// Create a stream object for HTTP request logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Add custom methods for different types of logging
logger.whatsapp = (message, meta = {}) => {
  logger.info(`[WhatsApp] ${message}`, meta);
};

logger.api = (message, meta = {}) => {
  logger.info(`[API] ${message}`, meta);
};

logger.database = (message, meta = {}) => {
  logger.info(`[Database] ${message}`, meta);
};

logger.security = (message, meta = {}) => {
  logger.warn(`[Security] ${message}`, meta);
};

logger.otp = (message, meta = {}) => {
  logger.info(`[OTP] ${message}`, meta);
};

module.exports = logger;