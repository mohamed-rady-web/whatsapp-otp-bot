/**
 * Status Controller
 * 
 * Handles system status, health checks, and monitoring
 * endpoints for the WhatsApp OTP bot.
 */

const sessionService = require('../services/sessionService');
const otpService = require('../services/otpService');
const MessageModel = require('../models/message');
const SessionModel = require('../models/session');
const ApiKeyModel = require('../models/apiKey');
const logger = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const os = require('os');
const fs = require('fs');
const path = require('path');

class StatusController {
    /**
     * Get overall system health
     */
    static async getHealth(req, res, next) {
        try {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: require('../../package.json').version,
                environment: process.env.NODE_ENV || 'development',
                checks: {}
            };

            // Database health check
            try {
                const { get } = require('../config/database');
                await get('SELECT 1');
                health.checks.database = { status: 'healthy', message: 'Database connection OK' };
            } catch (error) {
                health.checks.database = { status: 'unhealthy', message: error.message };
                health.status = 'degraded';
            }

            // WhatsApp connection health check
            try {
                const connectionStatus = await sessionService.getConnectionStatus();
                health.checks.whatsapp = {
                    status: connectionStatus.status === 'connected' ? 'healthy' : 'degraded',
                    message: `WhatsApp status: ${connectionStatus.status}`,
                    details: connectionStatus
                };
                
                if (connectionStatus.status !== 'connected') {
                    health.status = 'degraded';
                }
            } catch (error) {
                health.checks.whatsapp = { status: 'unhealthy', message: error.message };
                health.status = 'degraded';
            }

            // Memory health check
            const memUsage = process.memoryUsage();
            const memUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
            health.checks.memory = {
                status: memUsagePercent > 0.9 ? 'unhealthy' : memUsagePercent > 0.8 ? 'degraded' : 'healthy',
                usage: {
                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
                    percentage: Math.round(memUsagePercent * 100) + '%'
                }
            };

            if (memUsagePercent > 0.8) {
                health.status = health.status === 'healthy' ? 'degraded' : health.status;
            }

            // CPU health check
            const loadAvg = os.loadavg()[0];
            health.checks.cpu = {
                status: loadAvg > 2.0 ? 'unhealthy' : loadAvg > 1.0 ? 'degraded' : 'healthy',
                loadAverage: loadAvg,
                cores: os.cpus().length
            };

            if (loadAvg > 1.0) {
                health.status = health.status === 'healthy' ? 'degraded' : health.status;
            }

            // Disk space check
            try {
                const stats = fs.statSync(path.join(__dirname, '../../data'));
                health.checks.disk = { status: 'healthy', message: 'Data directory accessible' };
            } catch (error) {
                health.checks.disk = { status: 'unhealthy', message: 'Data directory not accessible' };
                health.status = 'unhealthy';
            }

            res.json({
                success: true,
                data: health
            });

        } catch (error) {
            logger.error('Health check failed:', error);
            res.status(503).json({
                success: false,
                error: 'Health check failed',
                data: {
                    status: 'unhealthy',
                    timestamp: new Date().toISOString(),
                    message: error.message
                }
            });
        }
    }

    /**
     * Get WhatsApp connection status
     */
    static async getWhatsAppStatus(req, res, next) {
        try {
            const status = await sessionService.getConnectionStatus();
            const sessionStats = await sessionService.getSessionStats();

            res.json({
                success: true,
                message: 'WhatsApp status retrieved successfully',
                data: {
                    ...status,
                    stats: sessionStats,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error('Failed to get WhatsApp status:', error);
            next(new AppError('Failed to retrieve WhatsApp status', 500, 'WHATSAPP_STATUS_FAILED'));
        }
    }

    /**
     * Get system statistics
     */
    static async getSystemStats(req, res, next) {
        try {
            const { days = 30 } = req.query;

            // Get message statistics
            const messageStats = await MessageModel.getStats({
                dateFrom: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
            });

            // Get daily message statistics
            const dailyStats = await MessageModel.getDailyStats(days);

            // Get session statistics
            const sessionStats = await SessionModel.getStats();

            // Get OTP statistics
            const otpStats = otpService.getStats();

            // Get API key count
            const apiKeyResult = await ApiKeyModel.list(1, 1);
            const totalApiKeys = apiKeyResult.pagination.total;

            // System metrics
            const systemMetrics = {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: {
                    loadAverage: os.loadavg(),
                    cores: os.cpus().length
                },
                platform: os.platform(),
                nodeVersion: process.version
            };

            res.json({
                success: true,
                message: 'System statistics retrieved successfully',
                data: {
                    period: `${days} days`,
                    messages: {
                        ...messageStats,
                        daily: dailyStats
                    },
                    sessions: sessionStats,
                    otp: otpStats,
                    apiKeys: {
                        total: totalApiKeys
                    },
                    system: systemMetrics,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error('Failed to get system stats:', error);
            next(new AppError('Failed to retrieve system statistics', 500, 'SYSTEM_STATS_FAILED'));
        }
    }

    /**
     * Get QR code for WhatsApp authentication
     */
    static async getQrCode(req, res, next) {
        try {
            const qrData = await sessionService.getQrCode();

            res.json({
                success: true,
                message: 'QR code retrieved successfully',
                data: qrData
            });

        } catch (error) {
            logger.error('Failed to get QR code:', error);
            
            if (error.message.includes('No active session')) {
                return next(new AppError(
                    'No active session found. Please initiate a connection first.',
                    404,
                    'NO_ACTIVE_SESSION'
                ));
            }
            
            if (error.message.includes('not awaiting scan')) {
                return next(new AppError(
                    error.message,
                    400,
                    'INVALID_SESSION_STATE'
                ));
            }
            
            next(new AppError('Failed to retrieve QR code', 500, 'QR_CODE_FAILED'));
        }
    }

    /**
     * Get message history and logs
     */
    static async getMessages(req, res, next) {
        try {
            const filters = {
                apiKeyId: req.query.apiKeyId,
                phone: req.query.phone,
                status: req.query.status,
                dateFrom: req.query.dateFrom,
                dateTo: req.query.dateTo
            };

            const { page, limit } = req.query;

            const result = await MessageModel.list(filters, page, limit);

            res.json({
                success: true,
                message: 'Messages retrieved successfully',
                data: result.messages,
                pagination: result.pagination,
                filters: filters
            });

        } catch (error) {
            logger.error('Failed to get messages:', error);
            next(new AppError('Failed to retrieve messages', 500, 'MESSAGES_GET_FAILED'));
        }
    }

    /**
     * Get session list
     */
    static async getSessions(req, res, next) {
        try {
            const { page, limit } = req.query;

            const result = await sessionService.listSessions(page, limit);

            res.json({
                success: true,
                message: 'Sessions retrieved successfully',
                data: result.sessions,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error('Failed to get sessions:', error);
            next(new AppError('Failed to retrieve sessions', 500, 'SESSIONS_GET_FAILED'));
        }
    }

    /**
     * Connect to WhatsApp
     */
    static async connect(req, res, next) {
        try {
            const session = await sessionService.createConnection();

            res.json({
                success: true,
                message: 'WhatsApp connection initiated successfully',
                data: {
                    sessionId: session.sessionId,
                    status: session.status,
                    message: session.status === 'awaiting_scan' 
                        ? 'Please scan the QR code to complete connection'
                        : 'Connection established'
                }
            });

        } catch (error) {
            logger.error('Failed to connect to WhatsApp:', error);
            
            if (error.message.includes('already in progress')) {
                return next(new AppError(
                    'Connection already in progress',
                    400,
                    'CONNECTION_IN_PROGRESS'
                ));
            }
            
            next(new AppError('Failed to connect to WhatsApp', 500, 'WHATSAPP_CONNECT_FAILED'));
        }
    }

    /**
     * Disconnect from WhatsApp
     */
    static async disconnect(req, res, next) {
        try {
            await sessionService.disconnect();

            res.json({
                success: true,
                message: 'WhatsApp disconnected successfully'
            });

        } catch (error) {
            logger.error('Failed to disconnect from WhatsApp:', error);
            next(new AppError('Failed to disconnect from WhatsApp', 500, 'WHATSAPP_DISCONNECT_FAILED'));
        }
    }

    /**
     * Restart WhatsApp connection
     */
    static async restart(req, res, next) {
        try {
            const session = await sessionService.restart();

            res.json({
                success: true,
                message: 'WhatsApp connection restarted successfully',
                data: {
                    sessionId: session.sessionId,
                    status: session.status
                }
            });

        } catch (error) {
            logger.error('Failed to restart WhatsApp connection:', error);
            next(new AppError('Failed to restart WhatsApp connection', 500, 'WHATSAPP_RESTART_FAILED'));
        }
    }

    /**
     * Clear all sessions
     */
    static async clearSessions(req, res, next) {
        try {
            const result = await sessionService.forceCleanupAllSessions();

            res.json({
                success: true,
                message: 'All sessions cleared successfully',
                data: result
            });

        } catch (error) {
            logger.error('Failed to clear sessions:', error);
            next(new AppError('Failed to clear sessions', 500, 'SESSIONS_CLEAR_FAILED'));
        }
    }

    /**
     * Take screenshot for debugging
     */
    static async takeScreenshot(req, res, next) {
        try {
            const { filename = 'debug' } = req.query;

            const screenshotPath = await sessionService.takeScreenshot(filename);

            if (!screenshotPath) {
                return next(new AppError(
                    'No active WhatsApp session to capture',
                    400,
                    'NO_ACTIVE_SESSION'
                ));
            }

            res.json({
                success: true,
                message: 'Screenshot captured successfully',
                data: {
                    filename: path.basename(screenshotPath),
                    path: screenshotPath,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error('Failed to take screenshot:', error);
            next(new AppError('Failed to capture screenshot', 500, 'SCREENSHOT_FAILED'));
        }
    }

    /**
     * Get system logs
     */
    static async getLogs(req, res, next) {
        try {
            const { 
                level = 'info', 
                lines = 100, 
                service,
                since 
            } = req.query;

            // This is a basic implementation - in production you might want to use
            // a proper log management system like ELK stack or similar
            const logPath = path.join(__dirname, '../../logs/combined.log');
            
            if (!fs.existsSync(logPath)) {
                return res.json({
                    success: true,
                    message: 'No logs available',
                    data: {
                        logs: [],
                        filters: { level, lines, service, since }
                    }
                });
            }

            // Read last N lines from log file
            const logContent = fs.readFileSync(logPath, 'utf8');
            const logLines = logContent.split('\n').filter(line => line.trim());
            const recentLines = logLines.slice(-lines);

            // Parse and filter logs
            const logs = recentLines
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch (error) {
                        return { message: line, level: 'unknown', timestamp: null };
                    }
                })
                .filter(log => {
                    if (level && log.level !== level) return false;
                    if (service && log.service !== service) return false;
                    if (since && log.timestamp && new Date(log.timestamp) < new Date(since)) return false;
                    return true;
                })
                .reverse(); // Most recent first

            res.json({
                success: true,
                message: 'Logs retrieved successfully',
                data: {
                    logs: logs,
                    total: logs.length,
                    filters: { level, lines, service, since }
                }
            });

        } catch (error) {
            logger.error('Failed to get logs:', error);
            next(new AppError('Failed to retrieve logs', 500, 'LOGS_GET_FAILED'));
        }
    }

    /**
     * Export data (messages, sessions, etc.)
     */
    static async exportData(req, res, next) {
        try {
            const { type = 'messages', format = 'json', dateFrom, dateTo } = req.query;

            let data;
            let filename;

            switch (type) {
                case 'messages':
                    if (format === 'csv') {
                        data = await MessageModel.exportToCsv({ dateFrom, dateTo });
                        filename = `messages_export_${new Date().toISOString().split('T')[0]}.csv`;
                        res.setHeader('Content-Type', 'text/csv');
                    } else {
                        const result = await MessageModel.list({ dateFrom, dateTo }, 1, 10000);
                        data = JSON.stringify(result.messages, null, 2);
                        filename = `messages_export_${new Date().toISOString().split('T')[0]}.json`;
                        res.setHeader('Content-Type', 'application/json');
                    }
                    break;

                case 'sessions':
                    const sessionResult = await sessionService.listSessions(1, 1000);
                    data = JSON.stringify(sessionResult.sessions, null, 2);
                    filename = `sessions_export_${new Date().toISOString().split('T')[0]}.json`;
                    res.setHeader('Content-Type', 'application/json');
                    break;

                default:
                    return next(new AppError('Invalid export type', 400, 'INVALID_EXPORT_TYPE'));
            }

            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(data);

        } catch (error) {
            logger.error('Failed to export data:', error);
            next(new AppError('Failed to export data', 500, 'EXPORT_FAILED'));
        }
    }
}

module.exports = StatusController;