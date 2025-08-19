/**
 * Session Service
 * 
 * High-level session management that coordinates
 * WhatsApp connections, database sessions, and state management.
 */

const whatsappService = require('./whatsappService');
const SessionModel = require('../models/session');
const logger = require('../config/logger');
const cron = require('node-cron');

class SessionService {
    constructor() {
        this.isInitialized = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 30000; // 30 seconds
        this.healthCheckInterval = null;
        
        this.initializeCleanupTasks();
    }

    /**
     * Initialize session service
     */
    async initialize() {
        try {
            if (this.isInitialized) {
                return;
            }

            // Clean up any orphaned sessions on startup
            await this.cleanupOrphanedSessions();
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            this.isInitialized = true;
            logger.info('Session service initialized');

        } catch (error) {
            logger.error('Failed to initialize session service:', error);
            throw error;
        }
    }

    /**
     * Create new WhatsApp connection
     */
    async createConnection() {
        try {
            logger.info('Creating new WhatsApp connection');

            // Check if there's already an active connection
            const existingSession = await this.getActiveSession();
            if (existingSession && existingSession.status === 'connected') {
                logger.info('Using existing active connection');
                return existingSession;
            }

            // Disconnect any existing connections
            await this.disconnectAll();

            // Create new connection
            const session = await whatsappService.connect();
            
            logger.info('WhatsApp connection created successfully', {
                sessionId: session.sessionId
            });

            return session;

        } catch (error) {
            logger.error('Failed to create WhatsApp connection:', error);
            throw error;
        }
    }

    /**
     * Get current connection status
     */
    async getConnectionStatus() {
        try {
            const status = await whatsappService.getStatus();
            
            // Enhance with additional session data if available
            if (status.session) {
                const sessionData = await SessionModel.getBySessionId(status.session.sessionId);
                if (sessionData) {
                    status.session = { ...status.session, ...sessionData };
                }
            }

            return status;

        } catch (error) {
            logger.error('Failed to get connection status:', error);
            return {
                status: 'error',
                session: null,
                error: error.message
            };
        }
    }

    /**
     * Get active session from database
     */
    async getActiveSession() {
        try {
            return await SessionModel.getActiveSession();
        } catch (error) {
            logger.error('Failed to get active session:', error);
            return null;
        }
    }

    /**
     * Get QR code for current session
     */
    async getQrCode() {
        try {
            const activeSession = await this.getActiveSession();
            
            if (!activeSession) {
                throw new Error('No active session found');
            }

            if (activeSession.status !== 'awaiting_scan') {
                throw new Error(`Session is not awaiting scan. Current status: ${activeSession.status}`);
            }

            if (!activeSession.qrCode) {
                throw new Error('QR code not yet available');
            }

            return {
                qrCode: activeSession.qrCode,
                sessionId: activeSession.sessionId,
                status: activeSession.status
            };

        } catch (error) {
            logger.error('Failed to get QR code:', error);
            throw error;
        }
    }

    /**
     * Send message through active connection
     */
    async sendMessage(phone, message, apiKeyId = null) {
        try {
            // Check if connected
            if (!whatsappService.isConnected()) {
                throw new Error('WhatsApp not connected');
            }

            // Create message record
            const MessageModel = require('../models/message');
            const messageId = await MessageModel.create(apiKeyId, phone, message);

            // Send message
            await whatsappService.sendMessage(phone, message, messageId);

            return {
                success: true,
                messageId
            };

        } catch (error) {
            logger.error('Failed to send message:', error);
            throw error;
        }
    }

    /**
     * Disconnect current session
     */
    async disconnect() {
        try {
            await whatsappService.disconnect();
            logger.info('Session disconnected successfully');
            return true;

        } catch (error) {
            logger.error('Failed to disconnect session:', error);
            throw error;
        }
    }

    /**
     * Disconnect all sessions
     */
    async disconnectAll() {
        try {
            // Disconnect current WhatsApp service
            await whatsappService.disconnect();
            
            // Update all active sessions in database
            const activeSessions = await SessionModel.all(
                'SELECT session_id FROM sessions WHERE status IN (?, ?, ?)',
                ['connected', 'awaiting_scan', 'initializing']
            );

            for (const session of activeSessions) {
                await SessionModel.disconnect(session.session_id);
            }

            logger.info(`Disconnected ${activeSessions.length} sessions`);
            return activeSessions.length;

        } catch (error) {
            logger.error('Failed to disconnect all sessions:', error);
            throw error;
        }
    }

    /**
     * Restart connection
     */
    async restart() {
        try {
            logger.info('Restarting WhatsApp connection');
            
            await this.disconnect();
            
            // Wait before reconnecting
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            return await this.createConnection();

        } catch (error) {
            logger.error('Failed to restart connection:', error);
            throw error;
        }
    }

    /**
     * Check session health and attempt reconnection if needed
     */
    async checkSessionHealth() {
        try {
            const status = await this.getConnectionStatus();
            
            if (status.status === 'connected') {
                this.reconnectAttempts = 0; // Reset on successful connection
                return true;
            }

            if (status.status === 'disconnected' || status.status === 'error') {
                await this.handleDisconnection();
            }

            return false;

        } catch (error) {
            logger.error('Session health check failed:', error);
            await this.handleDisconnection();
            return false;
        }
    }

    /**
     * Handle disconnection and attempt reconnection
     */
    async handleDisconnection() {
        try {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                logger.warn('Max reconnection attempts reached, stopping auto-reconnect');
                return;
            }

            this.reconnectAttempts++;
            logger.info(`Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            // Wait before attempting reconnection
            await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

            try {
                await this.restart();
                logger.info('Reconnection successful');
                this.reconnectAttempts = 0;
            } catch (error) {
                logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
            }

        } catch (error) {
            logger.error('Error handling disconnection:', error);
        }
    }

    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        // Check health every 2 minutes
        this.healthCheckInterval = setInterval(async () => {
            await this.checkSessionHealth();
        }, 120000);

        logger.info('Session health monitoring started');
    }

    /**
     * Stop health monitoring
     */
    stopHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            logger.info('Session health monitoring stopped');
        }
    }

    /**
     * Get session statistics
     */
    async getSessionStats() {
        try {
            const stats = await SessionModel.getStats();
            const whatsappStatus = await this.getConnectionStatus();
            
            return {
                ...stats,
                currentStatus: whatsappStatus.status,
                reconnectAttempts: this.reconnectAttempts,
                maxReconnectAttempts: this.maxReconnectAttempts,
                healthMonitoringActive: !!this.healthCheckInterval
            };

        } catch (error) {
            logger.error('Failed to get session stats:', error);
            throw error;
        }
    }

    /**
     * List all sessions
     */
    async listSessions(page = 1, limit = 50) {
        try {
            return await SessionModel.list(page, limit);
        } catch (error) {
            logger.error('Failed to list sessions:', error);
            throw error;
        }
    }

    /**
     * Delete session by ID
     */
    async deleteSession(sessionId) {
        try {
            // If it's the current active session, disconnect first
            const currentSession = whatsappService.getCurrentSession();
            if (currentSession && currentSession.sessionId === sessionId) {
                await this.disconnect();
            }

            return await SessionModel.delete(sessionId);

        } catch (error) {
            logger.error('Failed to delete session:', error);
            throw error;
        }
    }

    /**
     * Clean up orphaned sessions
     */
    async cleanupOrphanedSessions() {
        try {
            // Mark sessions as disconnected if they were left in connecting states
            const orphanedSessions = await SessionModel.all(
                `SELECT session_id FROM sessions 
                 WHERE status IN ('initializing', 'awaiting_scan') 
                   AND created_at < datetime('now', '-30 minutes')`
            );

            for (const session of orphanedSessions) {
                await SessionModel.updateStatus(
                    session.session_id,
                    'disconnected',
                    { reason: 'orphaned_cleanup' }
                );
            }

            if (orphanedSessions.length > 0) {
                logger.info(`Cleaned up ${orphanedSessions.length} orphaned sessions`);
            }

            return orphanedSessions.length;

        } catch (error) {
            logger.error('Failed to cleanup orphaned sessions:', error);
            return 0;
        }
    }

    /**
     * Initialize cleanup tasks
     */
    initializeCleanupTasks() {
        // Clean up expired sessions every hour
        cron.schedule('0 * * * *', async () => {
            try {
                logger.info('Running scheduled session cleanup');
                
                const expiredResult = await SessionModel.cleanupExpiredSessions();
                const orphanedResult = await this.cleanupOrphanedSessions();
                
                logger.info('Session cleanup completed', {
                    expired: expiredResult.expired,
                    deleted: expiredResult.deleted,
                    orphaned: orphanedResult
                });

            } catch (error) {
                logger.error('Scheduled session cleanup failed:', error);
            }
        });

        logger.info('Session cleanup tasks initialized');
    }

    /**
     * Force cleanup all sessions
     */
    async forceCleanupAllSessions() {
        try {
            logger.info('Force cleaning up all sessions');
            
            // Disconnect active connections
            await this.disconnectAll();
            
            // Clean up database
            const expiredResult = await SessionModel.cleanupExpiredSessions();
            const orphanedResult = await this.cleanupOrphanedSessions();
            
            logger.info('Force cleanup completed', {
                expired: expiredResult.expired,
                deleted: expiredResult.deleted,
                orphaned: orphanedResult
            });

            return {
                expired: expiredResult.expired,
                deleted: expiredResult.deleted,
                orphaned: orphanedResult
            };

        } catch (error) {
            logger.error('Force cleanup failed:', error);
            throw error;
        }
    }

    /**
     * Take screenshot for debugging
     */
    async takeScreenshot(filename) {
        try {
            return await whatsappService.takeScreenshot(filename);
        } catch (error) {
            logger.error('Failed to take screenshot:', error);
            return null;
        }
    }

    /**
     * Get detailed session info
     */
    async getSessionDetails(sessionId) {
        try {
            const session = await SessionModel.getBySessionId(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            // Add runtime info if it's the current session
            const currentSession = whatsappService.getCurrentSession();
            if (currentSession && currentSession.sessionId === sessionId) {
                session.isCurrentSession = true;
                session.driverActive = whatsappService.seleniumConfig.isDriverActive();
            }

            return session;

        } catch (error) {
            logger.error('Failed to get session details:', error);
            throw error;
        }
    }

    /**
     * Shutdown session service
     */
    async shutdown() {
        try {
            logger.info('Shutting down session service');
            
            this.stopHealthMonitoring();
            await this.disconnectAll();
            
            this.isInitialized = false;
            logger.info('Session service shut down');

        } catch (error) {
            logger.error('Error during session service shutdown:', error);
        }
    }
}

// Create singleton instance
const sessionService = new SessionService();

module.exports = sessionService;