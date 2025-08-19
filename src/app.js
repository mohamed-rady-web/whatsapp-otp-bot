// Environment configuration
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Import services and middleware
const logger = require('./utils/logger');
const Database = require('./services/database');
const WhatsAppService = require('./services/whatsapp');
const authMiddleware = require('./middleware/auth');

// Import route creators
const createApiRoutes = require('./controllers/api');
const createDashboardRoutes = require('./controllers/dashboard');

class App {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.whatsappService = null;
    this.database = null;
    
    this.initializeDatabase();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  async initializeDatabase() {
    try {
      this.database = new Database();
      await this.database.initialize();
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      process.exit(1);
    }
  }

  initializeMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"]
        }
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // API rate limiting for OTP endpoint
    const otpLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 5, // limit each IP to 5 OTP requests per minute
      message: 'Too many OTP requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/send-otp', otpLimiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static files
    this.app.use('/dashboard', express.static(path.join(__dirname, '../public/dashboard')));
    this.app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  initializeRoutes() {
    // Initialize WhatsApp service and pass to routes
    this.whatsappService = new WhatsAppService(this.database);

    // API routes
    this.app.use('/api', createApiRoutes(this.whatsappService, this.database));
    
    // Dashboard routes
    this.app.use('/', createDashboardRoutes(this.whatsappService, this.database));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // Root redirect
    this.app.get('/', (req, res) => {
      res.redirect('/dashboard');
    });
  }

  initializeErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found.',
        path: req.path
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error:', error);
      
      const status = error.status || 500;
      const message = process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : error.message;

      res.status(status).json({
        error: 'Server Error',
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
      });
    });
  }

  async start() {
    try {
      this.app.listen(this.port, () => {
        logger.info(`WhatsApp OTP Bot server running on port ${this.port}`);
        logger.info(`Dashboard available at: http://localhost:${this.port}/dashboard`);
        logger.info(`API documentation: http://localhost:${this.port}/api/docs`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop() {
    try {
      if (this.whatsappService) {
        await this.whatsappService.disconnect();
      }
      if (this.database) {
        await this.database.close();
      }
      logger.info('Server stopped gracefully');
    } catch (error) {
      logger.error('Error stopping server:', error);
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (global.app) {
    await global.app.stop();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (global.app) {
    await global.app.stop();
  }
  process.exit(0);
});

// Start the application
if (require.main === module) {
  const app = new App();
  global.app = app;
  app.start();
}

module.exports = App;