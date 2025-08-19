/**
 * Dashboard Controller
 * 
 * Handles dashboard-specific endpoints for the web interface
 * including analytics, real-time data, and administrative functions.
 */

const sessionService = require('../services/sessionService');
const otpService = require('../services/otpService');
const MessageModel = require('../models/message');
const SessionModel = require('../models/session');
const ApiKeyModel = require('../models/apiKey');
const logger = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');

class DashboardController {
    /**
     * Get dashboard overview data
     */
    static async getDashboardOverview(req, res, next) {
        try {
            const { period = '24h' } = req.query;

            // Calculate date range based on period
            let dateFrom;
            switch (period) {
                case '1h':
                    dateFrom = new Date(Date.now() - 60 * 60 * 1000);
                    break;
                case '24h':
                    dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000);
            }

            // Get various statistics
            const [
                messageStats,
                sessionStats,
                otpStats,
                whatsappStatus,
                apiKeyCount,
                recentMessages,
                dailyStats
            ] = await Promise.all([
                MessageModel.getStats({ dateFrom: dateFrom.toISOString() }),
                SessionModel.getStats(),
                otpService.getStats(),
                sessionService.getConnectionStatus(),
                ApiKeyModel.list(1, 1).then(result => result.pagination.total),
                MessageModel.list({}, 1, 10),
                MessageModel.getDailyStats(period === '30d' ? 30 : 7)
            ]);

            // Calculate trends (simplified)
            const trends = {
                messages: messageStats.totalMessages > 0 ? 'up' : 'stable',
                successRate: messageStats.successRate > 80 ? 'up' : messageStats.successRate > 60 ? 'stable' : 'down',
                activeSessions: sessionStats.connectedSessions > 0 ? 'up' : 'down'
            };

            const overview = {
                period,
                summary: {
                    totalMessages: messageStats.totalMessages,
                    deliveredMessages: messageStats.deliveredMessages,
                    failedMessages: messageStats.failedMessages,
                    successRate: messageStats.successRate,
                    activeSessions: sessionStats.connectedSessions,
                    totalSessions: sessionStats.totalSessions,
                    activeOtps: otpStats.active,
                    totalApiKeys: apiKeyCount
                },
                whatsapp: {
                    status: whatsappStatus.status,
                    session: whatsappStatus.session
                },
                trends,
                charts: {
                    dailyMessages: dailyStats.map(stat => ({
                        date: stat.date,
                        total: stat.total_messages,
                        delivered: stat.delivered_messages,
                        failed: stat.failed_messages,
                        successRate: stat.success_rate
                    }))
                },
                recentActivity: recentMessages.messages.slice(0, 5),
                timestamp: new Date().toISOString()
            };

            res.json({
                success: true,
                message: 'Dashboard overview retrieved successfully',
                data: overview
            });

        } catch (error) {
            logger.error('Failed to get dashboard overview:', error);
            next(new AppError('Failed to retrieve dashboard overview', 500, 'DASHBOARD_OVERVIEW_FAILED'));
        }
    }

    /**
     * Get real-time metrics for dashboard
     */
    static async getRealTimeMetrics(req, res, next) {
        try {
            const [
                whatsappStatus,
                otpStats,
                recentMessages,
                systemMetrics
            ] = await Promise.all([
                sessionService.getConnectionStatus(),
                otpService.getStats(),
                MessageModel.list({}, 1, 5),
                this.getSystemMetrics()
            ]);

            const metrics = {
                whatsapp: {
                    status: whatsappStatus.status,
                    isConnected: whatsappStatus.status === 'connected',
                    lastActivity: whatsappStatus.session?.lastActivity
                },
                otp: {
                    active: otpStats.active,
                    expired: otpStats.expired,
                    used: otpStats.used
                },
                messages: {
                    recent: recentMessages.messages,
                    lastMessageTime: recentMessages.messages[0]?.sentAt
                },
                system: systemMetrics,
                timestamp: new Date().toISOString()
            };

            res.json({
                success: true,
                data: metrics
            });

        } catch (error) {
            logger.error('Failed to get real-time metrics:', error);
            next(new AppError('Failed to retrieve real-time metrics', 500, 'REALTIME_METRICS_FAILED'));
        }
    }

    /**
     * Get analytics data for charts
     */
    static async getAnalytics(req, res, next) {
        try {
            const { 
                type = 'messages', 
                period = '7d',
                groupBy = 'day'
            } = req.query;

            let days;
            switch (period) {
                case '24h':
                    days = 1;
                    break;
                case '7d':
                    days = 7;
                    break;
                case '30d':
                    days = 30;
                    break;
                case '90d':
                    days = 90;
                    break;
                default:
                    days = 7;
            }

            let analytics = {};

            switch (type) {
                case 'messages':
                    analytics = await this.getMessageAnalytics(days, groupBy);
                    break;
                case 'sessions':
                    analytics = await this.getSessionAnalytics(days, groupBy);
                    break;
                case 'performance':
                    analytics = await this.getPerformanceAnalytics(days);
                    break;
                default:
                    return next(new AppError('Invalid analytics type', 400, 'INVALID_ANALYTICS_TYPE'));
            }

            res.json({
                success: true,
                message: 'Analytics data retrieved successfully',
                data: {
                    type,
                    period,
                    groupBy,
                    ...analytics,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error('Failed to get analytics:', error);
            next(new AppError('Failed to retrieve analytics', 500, 'ANALYTICS_FAILED'));
        }
    }

    /**
     * Get API key analytics
     */
    static async getApiKeyAnalytics(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const apiKeys = await ApiKeyModel.list(1, 100);
            const analytics = [];

            for (const apiKey of apiKeys.keys) {
                const stats = await ApiKeyModel.getUsageStats(apiKey.id, days);
                const summary = stats.reduce((acc, stat) => {
                    acc.totalMessages += stat.total_messages;
                    acc.deliveredMessages += stat.delivered_messages;
                    acc.failedMessages += stat.failed_messages;
                    return acc;
                }, { totalMessages: 0, deliveredMessages: 0, failedMessages: 0 });

                analytics.push({
                    id: apiKey.id,
                    name: apiKey.name,
                    isActive: apiKey.isActive,
                    createdAt: apiKey.createdAt,
                    lastUsed: apiKey.lastUsed,
                    ...summary,
                    successRate: summary.totalMessages > 0 
                        ? Math.round((summary.deliveredMessages / summary.totalMessages) * 100)
                        : 0,
                    dailyStats: stats
                });
            }

            res.json({
                success: true,
                message: 'API key analytics retrieved successfully',
                data: {
                    period: `${days} days`,
                    apiKeys: analytics,
                    summary: {
                        totalApiKeys: analytics.length,
                        activeApiKeys: analytics.filter(ak => ak.isActive).length,
                        totalMessages: analytics.reduce((sum, ak) => sum + ak.totalMessages, 0),
                        avgSuccessRate: analytics.length > 0
                            ? Math.round(analytics.reduce((sum, ak) => sum + ak.successRate, 0) / analytics.length)
                            : 0
                    }
                }
            });

        } catch (error) {
            logger.error('Failed to get API key analytics:', error);
            next(new AppError('Failed to retrieve API key analytics', 500, 'API_KEY_ANALYTICS_FAILED'));
        }
    }

    /**
     * Get system health for dashboard
     */
    static async getSystemHealth(req, res, next) {
        try {
            const health = await this.getSystemMetrics();
            
            // Determine overall health status
            let status = 'healthy';
            const issues = [];

            if (health.memory.percentage > 90) {
                status = 'critical';
                issues.push('High memory usage');
            } else if (health.memory.percentage > 80) {
                status = 'warning';
                issues.push('Elevated memory usage');
            }

            if (health.cpu.loadAverage > 2.0) {
                status = status === 'healthy' ? 'critical' : status;
                issues.push('High CPU load');
            } else if (health.cpu.loadAverage > 1.0) {
                status = status === 'healthy' ? 'warning' : status;
                issues.push('Elevated CPU load');
            }

            // Check WhatsApp connection
            const whatsappStatus = await sessionService.getConnectionStatus();
            if (whatsappStatus.status !== 'connected') {
                status = status === 'healthy' ? 'warning' : status;
                issues.push('WhatsApp not connected');
            }

            res.json({
                success: true,
                message: 'System health retrieved successfully',
                data: {
                    status,
                    issues,
                    metrics: health,
                    whatsapp: whatsappStatus,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error('Failed to get system health:', error);
            next(new AppError('Failed to retrieve system health', 500, 'SYSTEM_HEALTH_FAILED'));
        }
    }

    /**
     * Get message analytics data
     */
    static async getMessageAnalytics(days, groupBy) {
        const dailyStats = await MessageModel.getDailyStats(days);
        
        return {
            dailyStats: dailyStats.map(stat => ({
                date: stat.date,
                total: stat.total_messages,
                delivered: stat.delivered_messages,
                failed: stat.failed_messages,
                successRate: stat.success_rate
            })),
            summary: dailyStats.reduce((acc, stat) => {
                acc.totalMessages += stat.total_messages;
                acc.deliveredMessages += stat.delivered_messages;
                acc.failedMessages += stat.failed_messages;
                return acc;
            }, { totalMessages: 0, deliveredMessages: 0, failedMessages: 0 })
        };
    }

    /**
     * Get session analytics data
     */
    static async getSessionAnalytics(days, groupBy) {
        // This would require additional database queries to track session creation by day
        // For now, return current session stats
        const sessionStats = await SessionModel.getStats();
        
        return {
            currentStats: sessionStats,
            // You would implement historical session tracking here
            dailyStats: []
        };
    }

    /**
     * Get performance analytics
     */
    static async getPerformanceAnalytics(days) {
        const messageStats = await MessageModel.getStats({
            dateFrom: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        });

        return {
            performance: {
                successRate: messageStats.successRate,
                avgDeliveryTime: messageStats.avgDeliveryTime,
                totalMessages: messageStats.totalMessages,
                failureRate: messageStats.totalMessages > 0 
                    ? Math.round((messageStats.failedMessages / messageStats.totalMessages) * 100)
                    : 0
            }
        };
    }

    /**
     * Get system metrics
     */
    static getSystemMetrics() {
        const memUsage = process.memoryUsage();
        const os = require('os');
        
        return {
            uptime: process.uptime(),
            memory: {
                used: Math.round(memUsage.heapUsed / 1024 / 1024),
                total: Math.round(memUsage.heapTotal / 1024 / 1024),
                percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
            },
            cpu: {
                loadAverage: os.loadavg()[0],
                cores: os.cpus().length
            },
            platform: os.platform(),
            nodeVersion: process.version
        };
    }

    /**
     * Get dashboard configuration
     */
    static async getDashboardConfig(req, res, next) {
        try {
            const config = {
                features: {
                    whatsappConnection: true,
                    otpGeneration: true,
                    messageHistory: true,
                    analytics: true,
                    apiKeyManagement: true,
                    systemMonitoring: true
                },
                limits: {
                    dailyMessages: 1000,
                    concurrentSessions: 1,
                    apiKeys: 10,
                    messageHistory: 10000
                },
                version: require('../../package.json').version,
                environment: process.env.NODE_ENV || 'development'
            };

            res.json({
                success: true,
                message: 'Dashboard configuration retrieved successfully',
                data: config
            });

        } catch (error) {
            logger.error('Failed to get dashboard config:', error);
            next(new AppError('Failed to retrieve dashboard configuration', 500, 'DASHBOARD_CONFIG_FAILED'));
        }
    }
}

module.exports = DashboardController;