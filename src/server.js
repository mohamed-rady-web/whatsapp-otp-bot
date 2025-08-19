/**
 * Express Server Configuration
 * 
 * Main server setup with middleware, routes, security,
 * and comprehensive error handling.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const logger = require('./config/logger');
const sessionService = require('./services/sessionService');

// Import middleware
const authMiddleware = require('./middleware/auth');
const rateLimiter = require('./middleware/rateLimiter');
const validator = require('./middleware/validator');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const apiRoutes = require('./routes/api');
const dashboardRoutes = require('./routes/dashboard');

class Server {
    constructor() {
        this.app = express();
        this.isInitialized = false;
    }

    /**
     * Initialize and configure the server
     */
    async initializeServer() {
        try {
            if (this.isInitialized) {
                return this.app;
            }

            // Initialize session service
            await sessionService.initialize();

            // Configure security middleware
            this.configureSecurityMiddleware();

            // Configure parsing middleware
            this.configureParsingMiddleware();

            // Configure logging middleware
            this.configureLoggingMiddleware();

            // Configure rate limiting
            this.configureRateLimiting();

            // Configure routes
            this.configureRoutes();

            // Configure static files
            this.configureStaticFiles();

            // Configure error handling
            this.configureErrorHandling();

            this.isInitialized = true;
            logger.info('Express server initialized successfully');

            return this.app;

        } catch (error) {
            logger.error('Failed to initialize server:', error);
            throw error;
        }
    }

    /**
     * Configure security middleware
     */
    configureSecurityMiddleware() {
        // Helmet for security headers
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
                },
            },
            crossOriginEmbedderPolicy: false
        }));

        // CORS configuration
        const corsOptions = {
            origin: this.getAllowedOrigins(),
            credentials: process.env.CORS_CREDENTIALS === 'true',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With'],
            maxAge: 86400 // 24 hours
        };

        this.app.use(cors(corsOptions));

        // Trust proxy (important for rate limiting and IP detection)
        this.app.set('trust proxy', 1);

        logger.info('Security middleware configured');
    }

    /**
     * Get allowed CORS origins
     */
    getAllowedOrigins() {
        const origins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            process.env.CORS_ORIGIN
        ].filter(Boolean);

        if (process.env.NODE_ENV === 'development') {
            origins.push('http://localhost:*');
        }

        return origins;
    }

    /**
     * Configure parsing middleware
     */
    configureParsingMiddleware() {
        // Body parsing
        this.app.use(express.json({ 
            limit: '10mb',
            strict: true
        }));
        
        this.app.use(express.urlencoded({ 
            extended: true, 
            limit: '10mb' 
        }));

        // Remove powered by header
        this.app.disable('x-powered-by');

        logger.info('Parsing middleware configured');
    }

    /**
     * Configure logging middleware
     */
    configureLoggingMiddleware() {
        // Request logging middleware
        this.app.use((req, res, next) => {
            const startTime = Date.now();
            
            // Log request
            logger.info('Request received', {
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                contentLength: req.get('Content-Length')
            });

            // Override res.end to log response
            const originalEnd = res.end;
            res.end = function(chunk, encoding) {
                const responseTime = Date.now() - startTime;
                
                // Log response
                logger.logApiRequest(req, res, responseTime);
                
                originalEnd.call(this, chunk, encoding);
            };

            next();
        });

        logger.info('Logging middleware configured');
    }

    /**
     * Configure rate limiting
     */
    configureRateLimiting() {
        // Global rate limiter for all requests
        const globalLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // Limit each IP to 1000 requests per windowMs
            message: {
                error: 'Too many requests from this IP, please try again later',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                logger.logSecurityEvent('rate_limit_exceeded', {
                    ip: req.ip,
                    url: req.originalUrl,
                    userAgent: req.get('User-Agent')
                });
                
                res.status(429).json({
                    success: false,
                    error: 'Too many requests from this IP, please try again later',
                    retryAfter: '15 minutes'
                });
            }
        });

        this.app.use(globalLimiter);

        // API-specific rate limiter
        const apiLimiter = rateLimit({
            windowMs: 10 * 60 * 1000, // 10 minutes
            max: 200, // Limit each IP to 200 API requests per windowMs
            message: {
                error: 'API rate limit exceeded, please try again later',
                retryAfter: '10 minutes'
            }
        });

        this.app.use('/api', apiLimiter);

        logger.info('Rate limiting configured');
    }

    /**
     * Configure application routes
     */
    configureRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: require('../package.json').version
            });
        });

        // API routes
        this.app.use('/api', apiRoutes);

        // Dashboard routes
        this.app.use('/dashboard', dashboardRoutes);

        // Redirect root to dashboard
        this.app.get('/', (req, res) => {
            res.redirect('/dashboard');
        });

        // API documentation endpoint
        this.app.get('/api/docs', (req, res) => {
            res.json({
                name: 'WhatsApp OTP Bot API',
                version: require('../package.json').version,
                description: 'Production-ready WhatsApp OTP bot with comprehensive API',
                endpoints: {
                    auth: {
                        'POST /api/auth/generate-key': 'Generate new API key',
                        'GET /api/auth/keys': 'List API keys',
                        'PUT /api/auth/keys/:id': 'Update API key',
                        'DELETE /api/auth/keys/:id': 'Delete API key'
                    },
                    whatsapp: {
                        'POST /api/connect': 'Initialize WhatsApp connection',
                        'GET /api/qr': 'Get QR code for authentication',
                        'POST /api/disconnect': 'Disconnect WhatsApp session',
                        'GET /api/status': 'Get connection status'
                    },
                    messaging: {
                        'POST /api/send-otp': 'Send OTP message',
                        'POST /api/send-message': 'Send custom message',
                        'GET /api/messages': 'List sent messages'
                    },
                    system: {
                        'GET /api/stats': 'Get system statistics',
                        'GET /api/logs': 'Get system logs',
                        'POST /api/sessions/clear': 'Clear all sessions'
                    }
                },
                authentication: 'Include X-API-Key header with your API key',
                documentation: 'See /docs/API.md for detailed documentation'
            });
        });

        logger.info('Routes configured');
    }

    /**
     * Configure static file serving
     */
    configureStaticFiles() {
        // Serve dashboard static files
        this.app.use('/dashboard', express.static(path.join(__dirname, '../public/dashboard')));
        
        // Serve general assets
        this.app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

        // Serve documentation
        this.app.use('/docs', express.static(path.join(__dirname, '../docs')));

        logger.info('Static file serving configured');
    }

    /**
     * Configure error handling
     */
    configureErrorHandling() {
        // 404 handler for undefined routes
        this.app.use('*', (req, res) => {
            logger.warn('Route not found', {
                method: req.method,
                url: req.originalUrl,
                ip: req.ip
            });

            res.status(404).json({
                success: false,
                error: 'Route not found',
                message: `Cannot ${req.method} ${req.originalUrl}`,
                availableEndpoints: [
                    'GET /health',
                    'GET /api/docs',
                    'GET /dashboard',
                    'POST /api/connect',
                    'POST /api/send-otp'
                ]
            });
        });

        // Global error handler
        this.app.use(errorHandler);

        // Unhandled promise rejection handler
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        // Uncaught exception handler
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            
            // Give time for logger to write, then exit
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        });

        logger.info('Error handling configured');
    }

    /**
     * Get the configured Express app
     */
    getApp() {
        return this.app;
    }

    /**
     * Start the server
     */
    async startServer(port) {
        try {
            await this.initializeServer();
            
            const serverPort = port || process.env.PORT || 3000;
            
            return new Promise((resolve, reject) => {
                const server = this.app.listen(serverPort, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        logger.info(`Server started on port ${serverPort}`);
                        resolve(this.app);
                    }
                });

                // Graceful shutdown
                const gracefulShutdown = async (signal) => {
                    logger.info(`Received ${signal}. Starting graceful shutdown...`);
                    
                    server.close(async () => {
                        try {
                            await sessionService.shutdown();
                            logger.info('Server shut down gracefully');
                            process.exit(0);
                        } catch (error) {
                            logger.error('Error during shutdown:', error);
                            process.exit(1);
                        }
                    });
                };

                process.on('SIGTERM', gracefulShutdown);
                process.on('SIGINT', gracefulShutdown);
            });

        } catch (error) {
            logger.error('Failed to start server:', error);
            throw error;
        }
    }
}

// Create singleton instance
const serverInstance = new Server();

module.exports = {
    startServer: (port) => serverInstance.startServer(port),
    getApp: () => serverInstance.getApp(),
    initializeServer: () => serverInstance.initializeServer()
};