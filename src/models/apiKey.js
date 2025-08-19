/**
 * API Key Model
 * 
 * Manages API key creation, validation, and permissions
 * with bcrypt hashing and rate limiting support.
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../config/database');
const logger = require('../config/logger');

class ApiKeyModel {
    /**
     * Create a new API key
     */
    static async create(name, permissions = ['send_otp'], rateLimit = 100) {
        try {
            // Generate API key
            const apiKey = this.generateApiKey();
            
            // Hash the API key for storage
            const saltRounds = parseInt(process.env.API_KEY_SALT_ROUNDS) || 12;
            const keyHash = await bcrypt.hash(apiKey, saltRounds);
            
            // Insert into database
            const result = await run(
                `INSERT INTO api_keys (key_hash, name, permissions, rate_limit) 
                 VALUES (?, ?, ?, ?)`,
                [keyHash, name, JSON.stringify(permissions), rateLimit]
            );

            logger.logAuthEvent('api_key_created', result.id, {
                name,
                permissions,
                rateLimit
            });

            return {
                id: result.id,
                apiKey: apiKey, // Return plain API key only once
                name,
                permissions,
                rateLimit,
                createdAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error('Failed to create API key:', error);
            throw new Error('Failed to create API key');
        }
    }

    /**
     * Validate API key and return key data
     */
    static async validate(apiKey) {
        try {
            if (!apiKey) {
                return null;
            }

            // Get all active API keys
            const keys = await all(
                'SELECT * FROM api_keys WHERE is_active = 1'
            );

            // Check each key hash
            for (const key of keys) {
                const isValid = await bcrypt.compare(apiKey, key.key_hash);
                if (isValid) {
                    // Update last used timestamp
                    await this.updateLastUsed(key.id);
                    
                    return {
                        id: key.id,
                        name: key.name,
                        permissions: JSON.parse(key.permissions || '[]'),
                        rateLimit: key.rate_limit,
                        lastUsed: key.last_used,
                        createdAt: key.created_at
                    };
                }
            }

            return null;

        } catch (error) {
            logger.error('Failed to validate API key:', error);
            return null;
        }
    }

    /**
     * Update last used timestamp
     */
    static async updateLastUsed(keyId) {
        try {
            await run(
                'UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?',
                [keyId]
            );
        } catch (error) {
            logger.error('Failed to update last used timestamp:', error);
        }
    }

    /**
     * Get API key by ID
     */
    static async getById(id) {
        try {
            const key = await get(
                'SELECT id, name, permissions, rate_limit, created_at, last_used, is_active FROM api_keys WHERE id = ?',
                [id]
            );

            if (!key) {
                return null;
            }

            return {
                id: key.id,
                name: key.name,
                permissions: JSON.parse(key.permissions || '[]'),
                rateLimit: key.rate_limit,
                createdAt: key.created_at,
                lastUsed: key.last_used,
                isActive: Boolean(key.is_active)
            };

        } catch (error) {
            logger.error('Failed to get API key by ID:', error);
            throw new Error('Failed to retrieve API key');
        }
    }

    /**
     * List all API keys (excluding hashes)
     */
    static async list(page = 1, limit = 50) {
        try {
            const offset = (page - 1) * limit;
            
            const keys = await all(
                `SELECT id, name, permissions, rate_limit, created_at, last_used, is_active 
                 FROM api_keys 
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [limit, offset]
            );

            const totalResult = await get('SELECT COUNT(*) as count FROM api_keys');
            const total = totalResult.count;

            return {
                keys: keys.map(key => ({
                    id: key.id,
                    name: key.name,
                    permissions: JSON.parse(key.permissions || '[]'),
                    rateLimit: key.rate_limit,
                    createdAt: key.created_at,
                    lastUsed: key.last_used,
                    isActive: Boolean(key.is_active)
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };

        } catch (error) {
            logger.error('Failed to list API keys:', error);
            throw new Error('Failed to retrieve API keys');
        }
    }

    /**
     * Update API key permissions and settings
     */
    static async update(id, updates) {
        try {
            const allowedUpdates = ['name', 'permissions', 'rate_limit', 'is_active'];
            const updateFields = [];
            const updateValues = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedUpdates.includes(key)) {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(
                        key === 'permissions' ? JSON.stringify(value) : value
                    );
                }
            }

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            updateValues.push(id);

            const result = await run(
                `UPDATE api_keys SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );

            if (result.changes === 0) {
                throw new Error('API key not found');
            }

            logger.logAuthEvent('api_key_updated', id, updates);

            return await this.getById(id);

        } catch (error) {
            logger.error('Failed to update API key:', error);
            throw error;
        }
    }

    /**
     * Delete API key
     */
    static async delete(id) {
        try {
            const result = await run(
                'DELETE FROM api_keys WHERE id = ?',
                [id]
            );

            if (result.changes === 0) {
                throw new Error('API key not found');
            }

            logger.logAuthEvent('api_key_deleted', id);

            return true;

        } catch (error) {
            logger.error('Failed to delete API key:', error);
            throw error;
        }
    }

    /**
     * Deactivate API key instead of deleting
     */
    static async deactivate(id) {
        try {
            return await this.update(id, { is_active: false });
        } catch (error) {
            logger.error('Failed to deactivate API key:', error);
            throw error;
        }
    }

    /**
     * Check if API key has specific permission
     */
    static hasPermission(keyData, permission) {
        if (!keyData || !keyData.permissions) {
            return false;
        }
        
        return keyData.permissions.includes(permission) || 
               keyData.permissions.includes('*');
    }

    /**
     * Get API key usage statistics
     */
    static async getUsageStats(keyId, days = 30) {
        try {
            const stats = await all(
                `SELECT 
                    DATE(sent_at) as date,
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_messages,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_messages
                 FROM messages 
                 WHERE api_key_id = ? 
                   AND sent_at >= datetime('now', '-${days} days')
                 GROUP BY DATE(sent_at)
                 ORDER BY date DESC`,
                [keyId]
            );

            return stats;

        } catch (error) {
            logger.error('Failed to get API key usage stats:', error);
            throw new Error('Failed to retrieve usage statistics');
        }
    }

    /**
     * Generate a secure API key
     */
    static generateApiKey() {
        const prefix = 'wab_'; // WhatsApp Bot prefix
        const randomPart = uuidv4().replace(/-/g, '');
        return `${prefix}${randomPart}`;
    }

    /**
     * Clean up old unused API keys
     */
    static async cleanupOldKeys(daysOld = 90) {
        try {
            const result = await run(
                `DELETE FROM api_keys 
                 WHERE is_active = 0 
                   AND (last_used IS NULL OR last_used < datetime('now', '-${daysOld} days'))
                   AND created_at < datetime('now', '-${daysOld} days')`,
                []
            );

            logger.info(`Cleaned up ${result.changes} old API keys`);
            return result.changes;

        } catch (error) {
            logger.error('Failed to cleanup old API keys:', error);
            return 0;
        }
    }
}

module.exports = ApiKeyModel;