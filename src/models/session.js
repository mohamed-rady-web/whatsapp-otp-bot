/**
 * Session Model
 * 
 * Manages WhatsApp session tracking, QR codes,
 * and connection state persistence.
 */

const { run, get, all } = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class SessionModel {
    /**
     * Create a new session
     */
    static async create(sessionId = null) {
        try {
            const id = sessionId || uuidv4();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            const result = await run(
                `INSERT INTO sessions (session_id, status, expires_at) 
                 VALUES (?, 'initializing', ?)`,
                [id, expiresAt.toISOString()]
            );

            logger.info('Session created', {
                sessionId: id,
                dbId: result.id
            });

            return {
                id: result.id,
                sessionId: id,
                status: 'initializing',
                expiresAt: expiresAt.toISOString()
            };

        } catch (error) {
            logger.error('Failed to create session:', error);
            throw new Error('Failed to create session');
        }
    }

    /**
     * Update session status
     */
    static async updateStatus(sessionId, status, metadata = {}) {
        try {
            const currentTime = new Date().toISOString();
            const metadataJson = JSON.stringify(metadata);

            const result = await run(
                `UPDATE sessions 
                 SET status = ?, last_activity = ?, metadata = ?
                 WHERE session_id = ?`,
                [status, currentTime, metadataJson, sessionId]
            );

            if (result.changes === 0) {
                logger.warn('Session not found for status update', { sessionId, status });
                return false;
            }

            logger.info('Session status updated', {
                sessionId,
                status,
                metadata
            });

            return true;

        } catch (error) {
            logger.error('Failed to update session status:', error);
            throw error;
        }
    }

    /**
     * Set QR code for session
     */
    static async setQrCode(sessionId, qrCode) {
        try {
            const result = await run(
                `UPDATE sessions 
                 SET qr_code = ?, status = 'awaiting_scan', last_activity = CURRENT_TIMESTAMP 
                 WHERE session_id = ?`,
                [qrCode, sessionId]
            );

            if (result.changes === 0) {
                logger.warn('Session not found for QR update', { sessionId });
                return false;
            }

            logger.info('QR code set for session', { sessionId });
            return true;

        } catch (error) {
            logger.error('Failed to set QR code:', error);
            throw error;
        }
    }

    /**
     * Set connected phone for session
     */
    static async setConnectedPhone(sessionId, phone) {
        try {
            const result = await run(
                `UPDATE sessions 
                 SET connected_phone = ?, status = 'connected', 
                     qr_code = NULL, last_activity = CURRENT_TIMESTAMP 
                 WHERE session_id = ?`,
                [phone, sessionId]
            );

            if (result.changes === 0) {
                logger.warn('Session not found for phone update', { sessionId });
                return false;
            }

            logger.logWhatsAppEvent('session_connected', {
                sessionId,
                phone: this.maskPhoneNumber(phone)
            });

            return true;

        } catch (error) {
            logger.error('Failed to set connected phone:', error);
            throw error;
        }
    }

    /**
     * Get session by session ID
     */
    static async getBySessionId(sessionId) {
        try {
            const session = await get(
                'SELECT * FROM sessions WHERE session_id = ?',
                [sessionId]
            );

            if (!session) {
                return null;
            }

            return {
                id: session.id,
                sessionId: session.session_id,
                status: session.status,
                qrCode: session.qr_code,
                connectedPhone: session.connected_phone,
                createdAt: session.created_at,
                lastActivity: session.last_activity,
                expiresAt: session.expires_at,
                metadata: this.parseMetadata(session.metadata)
            };

        } catch (error) {
            logger.error('Failed to get session by ID:', error);
            throw new Error('Failed to retrieve session');
        }
    }

    /**
     * Get active session
     */
    static async getActiveSession() {
        try {
            const session = await get(
                `SELECT * FROM sessions 
                 WHERE status IN ('connected', 'awaiting_scan', 'initializing') 
                   AND expires_at > datetime('now')
                 ORDER BY last_activity DESC 
                 LIMIT 1`
            );

            if (!session) {
                return null;
            }

            return {
                id: session.id,
                sessionId: session.session_id,
                status: session.status,
                qrCode: session.qr_code,
                connectedPhone: session.connected_phone,
                createdAt: session.created_at,
                lastActivity: session.last_activity,
                expiresAt: session.expires_at,
                metadata: this.parseMetadata(session.metadata)
            };

        } catch (error) {
            logger.error('Failed to get active session:', error);
            return null;
        }
    }

    /**
     * List all sessions with pagination
     */
    static async list(page = 1, limit = 50) {
        try {
            const offset = (page - 1) * limit;

            const sessions = await all(
                `SELECT * FROM sessions 
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [limit, offset]
            );

            const totalResult = await get('SELECT COUNT(*) as count FROM sessions');

            return {
                sessions: sessions.map(session => ({
                    id: session.id,
                    sessionId: session.session_id,
                    status: session.status,
                    connectedPhone: session.connected_phone ? 
                        this.maskPhoneNumber(session.connected_phone) : null,
                    createdAt: session.created_at,
                    lastActivity: session.last_activity,
                    expiresAt: session.expires_at,
                    metadata: this.parseMetadata(session.metadata)
                })),
                pagination: {
                    page,
                    limit,
                    total: totalResult.count,
                    pages: Math.ceil(totalResult.count / limit)
                }
            };

        } catch (error) {
            logger.error('Failed to list sessions:', error);
            throw new Error('Failed to retrieve sessions');
        }
    }

    /**
     * Update session activity timestamp
     */
    static async updateActivity(sessionId) {
        try {
            await run(
                'UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE session_id = ?',
                [sessionId]
            );
        } catch (error) {
            logger.error('Failed to update session activity:', error);
        }
    }

    /**
     * Disconnect session
     */
    static async disconnect(sessionId) {
        try {
            const result = await run(
                `UPDATE sessions 
                 SET status = 'disconnected', qr_code = NULL, 
                     last_activity = CURRENT_TIMESTAMP 
                 WHERE session_id = ?`,
                [sessionId]
            );

            if (result.changes > 0) {
                logger.logWhatsAppEvent('session_disconnected', { sessionId });
                return true;
            }

            return false;

        } catch (error) {
            logger.error('Failed to disconnect session:', error);
            throw error;
        }
    }

    /**
     * Delete session
     */
    static async delete(sessionId) {
        try {
            const result = await run(
                'DELETE FROM sessions WHERE session_id = ?',
                [sessionId]
            );

            if (result.changes > 0) {
                logger.info('Session deleted', { sessionId });
                return true;
            }

            return false;

        } catch (error) {
            logger.error('Failed to delete session:', error);
            throw error;
        }
    }

    /**
     * Clean up expired sessions
     */
    static async cleanupExpiredSessions() {
        try {
            const result = await run(
                `UPDATE sessions 
                 SET status = 'expired' 
                 WHERE expires_at <= datetime('now') 
                   AND status != 'expired'`
            );

            if (result.changes > 0) {
                logger.info(`Marked ${result.changes} sessions as expired`);
            }

            // Delete very old sessions (older than 7 days)
            const deleteResult = await run(
                `DELETE FROM sessions 
                 WHERE created_at < datetime('now', '-7 days')`
            );

            if (deleteResult.changes > 0) {
                logger.info(`Deleted ${deleteResult.changes} old sessions`);
            }

            return {
                expired: result.changes,
                deleted: deleteResult.changes
            };

        } catch (error) {
            logger.error('Failed to cleanup expired sessions:', error);
            return { expired: 0, deleted: 0 };
        }
    }

    /**
     * Get session statistics
     */
    static async getStats() {
        try {
            const stats = await get(
                `SELECT 
                    COUNT(*) as total_sessions,
                    SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as connected_sessions,
                    SUM(CASE WHEN status = 'awaiting_scan' THEN 1 ELSE 0 END) as awaiting_scan_sessions,
                    SUM(CASE WHEN status = 'disconnected' THEN 1 ELSE 0 END) as disconnected_sessions,
                    SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_sessions,
                    SUM(CASE WHEN created_at >= datetime('now', '-24 hours') THEN 1 ELSE 0 END) as sessions_today
                 FROM sessions`
            );

            return {
                totalSessions: stats.total_sessions || 0,
                connectedSessions: stats.connected_sessions || 0,
                awaitingScanSessions: stats.awaiting_scan_sessions || 0,
                disconnectedSessions: stats.disconnected_sessions || 0,
                expiredSessions: stats.expired_sessions || 0,
                sessionsToday: stats.sessions_today || 0
            };

        } catch (error) {
            logger.error('Failed to get session statistics:', error);
            throw new Error('Failed to retrieve session statistics');
        }
    }

    /**
     * Check if session is active and not expired
     */
    static async isSessionActive(sessionId) {
        try {
            const session = await get(
                `SELECT status, expires_at FROM sessions 
                 WHERE session_id = ? 
                   AND status IN ('connected', 'awaiting_scan') 
                   AND expires_at > datetime('now')`,
                [sessionId]
            );

            return !!session;

        } catch (error) {
            logger.error('Failed to check session status:', error);
            return false;
        }
    }

    /**
     * Extend session expiration
     */
    static async extendExpiration(sessionId, hours = 24) {
        try {
            const newExpiration = new Date(Date.now() + hours * 60 * 60 * 1000);
            
            const result = await run(
                'UPDATE sessions SET expires_at = ? WHERE session_id = ?',
                [newExpiration.toISOString(), sessionId]
            );

            return result.changes > 0;

        } catch (error) {
            logger.error('Failed to extend session expiration:', error);
            return false;
        }
    }

    /**
     * Parse metadata JSON safely
     */
    static parseMetadata(metadataString) {
        try {
            return metadataString ? JSON.parse(metadataString) : {};
        } catch (error) {
            logger.warn('Failed to parse session metadata:', error);
            return {};
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
     * Get session uptime in seconds
     */
    static getSessionUptime(session) {
        if (!session || !session.createdAt) {
            return 0;
        }

        const createdAt = new Date(session.createdAt);
        const now = new Date();
        return Math.floor((now - createdAt) / 1000);
    }
}

module.exports = SessionModel;