/**
 * Message Model
 * 
 * Manages message logging, tracking, and statistics
 * for all WhatsApp messages sent through the bot.
 */

const { run, get, all } = require('../config/database');
const logger = require('../config/logger');

class MessageModel {
    /**
     * Create a new message record
     */
    static async create(apiKeyId, phone, message, otpCode = null) {
        try {
            const result = await run(
                `INSERT INTO messages (api_key_id, phone, message, otp_code, status) 
                 VALUES (?, ?, ?, ?, 'pending')`,
                [apiKeyId, phone, message, otpCode]
            );

            logger.info('Message record created', {
                id: result.id,
                apiKeyId,
                phone: this.maskPhoneNumber(phone),
                hasOtp: !!otpCode
            });

            return result.id;

        } catch (error) {
            logger.error('Failed to create message record:', error);
            throw new Error('Failed to create message record');
        }
    }

    /**
     * Update message status
     */
    static async updateStatus(messageId, status, errorMessage = null) {
        try {
            const updates = ['status = ?'];
            const values = [status];

            if (status === 'delivered') {
                updates.push('delivered_at = CURRENT_TIMESTAMP');
            }

            if (errorMessage) {
                updates.push('error_message = ?');
                values.push(errorMessage);
            }

            values.push(messageId);

            const result = await run(
                `UPDATE messages SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            if (result.changes === 0) {
                throw new Error('Message not found');
            }

            logger.info('Message status updated', {
                messageId,
                status,
                hasError: !!errorMessage
            });

            return true;

        } catch (error) {
            logger.error('Failed to update message status:', error);
            throw error;
        }
    }

    /**
     * Increment attempt counter
     */
    static async incrementAttempt(messageId) {
        try {
            const result = await run(
                'UPDATE messages SET attempts = attempts + 1 WHERE id = ?',
                [messageId]
            );

            return result.changes > 0;

        } catch (error) {
            logger.error('Failed to increment attempt counter:', error);
            return false;
        }
    }

    /**
     * Get message by ID
     */
    static async getById(messageId) {
        try {
            const message = await get(
                'SELECT * FROM messages WHERE id = ?',
                [messageId]
            );

            if (!message) {
                return null;
            }

            return {
                id: message.id,
                apiKeyId: message.api_key_id,
                phone: message.phone,
                message: message.message,
                otpCode: message.otp_code,
                status: message.status,
                errorMessage: message.error_message,
                sentAt: message.sent_at,
                deliveredAt: message.delivered_at,
                attempts: message.attempts
            };

        } catch (error) {
            logger.error('Failed to get message by ID:', error);
            throw new Error('Failed to retrieve message');
        }
    }

    /**
     * List messages with filters and pagination
     */
    static async list(filters = {}, page = 1, limit = 50) {
        try {
            const offset = (page - 1) * limit;
            const whereConditions = [];
            const values = [];

            // Build WHERE clause
            if (filters.apiKeyId) {
                whereConditions.push('api_key_id = ?');
                values.push(filters.apiKeyId);
            }

            if (filters.phone) {
                whereConditions.push('phone LIKE ?');
                values.push(`%${filters.phone}%`);
            }

            if (filters.status) {
                whereConditions.push('status = ?');
                values.push(filters.status);
            }

            if (filters.dateFrom) {
                whereConditions.push('sent_at >= ?');
                values.push(filters.dateFrom);
            }

            if (filters.dateTo) {
                whereConditions.push('sent_at <= ?');
                values.push(filters.dateTo);
            }

            const whereClause = whereConditions.length > 0 
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';

            // Get messages
            const messages = await all(
                `SELECT m.*, a.name as api_key_name 
                 FROM messages m 
                 LEFT JOIN api_keys a ON m.api_key_id = a.id 
                 ${whereClause}
                 ORDER BY m.sent_at DESC 
                 LIMIT ? OFFSET ?`,
                [...values, limit, offset]
            );

            // Get total count
            const totalResult = await get(
                `SELECT COUNT(*) as count FROM messages m ${whereClause}`,
                values
            );

            return {
                messages: messages.map(msg => ({
                    id: msg.id,
                    apiKeyId: msg.api_key_id,
                    apiKeyName: msg.api_key_name,
                    phone: this.maskPhoneNumber(msg.phone),
                    message: msg.message,
                    status: msg.status,
                    errorMessage: msg.error_message,
                    sentAt: msg.sent_at,
                    deliveredAt: msg.delivered_at,
                    attempts: msg.attempts
                })),
                pagination: {
                    page,
                    limit,
                    total: totalResult.count,
                    pages: Math.ceil(totalResult.count / limit)
                }
            };

        } catch (error) {
            logger.error('Failed to list messages:', error);
            throw new Error('Failed to retrieve messages');
        }
    }

    /**
     * Get message statistics
     */
    static async getStats(filters = {}) {
        try {
            const whereConditions = [];
            const values = [];

            // Build WHERE clause
            if (filters.apiKeyId) {
                whereConditions.push('api_key_id = ?');
                values.push(filters.apiKeyId);
            }

            if (filters.dateFrom) {
                whereConditions.push('sent_at >= ?');
                values.push(filters.dateFrom);
            }

            if (filters.dateTo) {
                whereConditions.push('sent_at <= ?');
                values.push(filters.dateTo);
            }

            const whereClause = whereConditions.length > 0 
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';

            const stats = await get(
                `SELECT 
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_messages,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_messages,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_messages,
                    AVG(CASE WHEN status = 'delivered' AND delivered_at IS NOT NULL 
                        THEN (julianday(delivered_at) - julianday(sent_at)) * 86400 
                        ELSE NULL END) as avg_delivery_time_seconds
                 FROM messages ${whereClause}`,
                values
            );

            const successRate = stats.total_messages > 0 
                ? (stats.delivered_messages / stats.total_messages) * 100 
                : 0;

            return {
                totalMessages: stats.total_messages || 0,
                deliveredMessages: stats.delivered_messages || 0,
                failedMessages: stats.failed_messages || 0,
                pendingMessages: stats.pending_messages || 0,
                successRate: Math.round(successRate * 100) / 100,
                avgDeliveryTime: stats.avg_delivery_time_seconds || 0
            };

        } catch (error) {
            logger.error('Failed to get message statistics:', error);
            throw new Error('Failed to retrieve statistics');
        }
    }

    /**
     * Get daily message statistics
     */
    static async getDailyStats(days = 30, apiKeyId = null) {
        try {
            const whereConditions = [`sent_at >= datetime('now', '-${days} days')`];
            const values = [];

            if (apiKeyId) {
                whereConditions.push('api_key_id = ?');
                values.push(apiKeyId);
            }

            const stats = await all(
                `SELECT 
                    DATE(sent_at) as date,
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_messages,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_messages,
                    ROUND(
                        (SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 
                        2
                    ) as success_rate
                 FROM messages 
                 WHERE ${whereConditions.join(' AND ')}
                 GROUP BY DATE(sent_at)
                 ORDER BY date DESC`,
                values
            );

            return stats;

        } catch (error) {
            logger.error('Failed to get daily statistics:', error);
            throw new Error('Failed to retrieve daily statistics');
        }
    }

    /**
     * Get pending messages for retry
     */
    static async getPendingMessages(maxAttempts = 3) {
        try {
            const messages = await all(
                `SELECT * FROM messages 
                 WHERE status = 'pending' 
                   AND attempts < ? 
                   AND sent_at < datetime('now', '-5 minutes')
                 ORDER BY sent_at ASC 
                 LIMIT 50`,
                [maxAttempts]
            );

            return messages.map(msg => ({
                id: msg.id,
                apiKeyId: msg.api_key_id,
                phone: msg.phone,
                message: msg.message,
                otpCode: msg.otp_code,
                attempts: msg.attempts,
                sentAt: msg.sent_at
            }));

        } catch (error) {
            logger.error('Failed to get pending messages:', error);
            return [];
        }
    }

    /**
     * Delete old messages
     */
    static async cleanupOldMessages(daysOld = 90) {
        try {
            const result = await run(
                `DELETE FROM messages 
                 WHERE sent_at < datetime('now', '-${daysOld} days')`,
                []
            );

            logger.info(`Cleaned up ${result.changes} old messages`);
            return result.changes;

        } catch (error) {
            logger.error('Failed to cleanup old messages:', error);
            return 0;
        }
    }

    /**
     * Get recent messages for a phone number
     */
    static async getRecentByPhone(phone, hours = 24) {
        try {
            const messages = await all(
                `SELECT * FROM messages 
                 WHERE phone = ? 
                   AND sent_at >= datetime('now', '-${hours} hours')
                 ORDER BY sent_at DESC`,
                [phone]
            );

            return messages;

        } catch (error) {
            logger.error('Failed to get recent messages by phone:', error);
            return [];
        }
    }

    /**
     * Check if phone number has reached daily limit
     */
    static async checkDailyLimit(phone, dailyLimit = 10) {
        try {
            const result = await get(
                `SELECT COUNT(*) as count FROM messages 
                 WHERE phone = ? 
                   AND DATE(sent_at) = DATE('now')`,
                [phone]
            );

            return result.count >= dailyLimit;

        } catch (error) {
            logger.error('Failed to check daily limit:', error);
            return false;
        }
    }

    /**
     * Mask phone number for privacy
     */
    static maskPhoneNumber(phone) {
        if (!phone || phone.length < 4) {
            return phone;
        }
        
        const visible = 3;
        const masked = '*'.repeat(phone.length - visible * 2);
        return phone.substring(0, visible) + masked + phone.substring(phone.length - visible);
    }

    /**
     * Export messages to CSV format
     */
    static async exportToCsv(filters = {}) {
        try {
            const { messages } = await this.list(filters, 1, 10000);
            
            const csvHeader = 'ID,API Key,Phone,Status,Sent At,Delivered At,Attempts,Error Message\n';
            const csvRows = messages.map(msg => 
                `${msg.id},"${msg.apiKeyName || 'Unknown'}","${msg.phone}","${msg.status}","${msg.sentAt}","${msg.deliveredAt || ''}",${msg.attempts},"${msg.errorMessage || ''}"`
            ).join('\n');

            return csvHeader + csvRows;

        } catch (error) {
            logger.error('Failed to export messages to CSV:', error);
            throw new Error('Failed to export messages');
        }
    }
}

module.exports = MessageModel;