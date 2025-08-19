/**
 * WhatsApp OTP Bot - Main Application Entry Point
 * 
 * Production-ready WhatsApp OTP bot with Selenium automation,
 * API endpoints, web dashboard, and comprehensive security measures.
 * 
 * @author Mohamed Rady
 * @license MIT
 */

require('dotenv').config();
const server = require('./src/server');
const logger = require('./src/config/logger');
const { initializeDatabase } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

/**
 * Initialize application
 */
async function startApplication() {
    try {
        // Initialize database
        await initializeDatabase();
        logger.info('Database initialized successfully');

        // Start server
        const app = await server.startServer();
        
        app.listen(PORT, () => {
            logger.info(`🚀 WhatsApp OTP Bot server started on port ${PORT}`);
            logger.info(`📊 Dashboard available at: http://localhost:${PORT}/dashboard`);
            logger.info(`📖 API documentation available at: http://localhost:${PORT}/api/docs`);
            logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // Graceful shutdown handlers
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            process.exit(1);
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });

    } catch (error) {
        logger.error('Failed to start application:', error);
        process.exit(1);
    }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    try {
        // Close WhatsApp connections
        const whatsappService = require('./src/services/whatsappService');
        await whatsappService.disconnect();
        
        // Close database connections
        const database = require('./src/config/database');
        await database.close();
        
        logger.info('Application shut down gracefully');
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}

// Start the application
startApplication();