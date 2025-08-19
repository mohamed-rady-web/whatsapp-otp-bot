/**
 * Authentication Controller
 * 
 * Handles API key management operations including
 * generation, validation, updates, and permissions.
 */

const ApiKeyModel = require('../models/apiKey');
const logger = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');

class AuthController {
    /**
     * Generate new API key
     */
    static async generateApiKey(req, res, next) {
        try {
            const { name, permissions, rateLimit } = req.body;

            // Create new API key
            const apiKeyData = await ApiKeyModel.create(name, permissions, rateLimit);

            logger.info('API key generated', {
                id: apiKeyData.id,
                name: apiKeyData.name,
                permissions: apiKeyData.permissions,
                rateLimit: apiKeyData.rateLimit,
                ip: req.ip
            });

            res.status(201).json({
                success: true,
                message: 'API key generated successfully',
                data: {
                    apiKey: apiKeyData.apiKey, // Only returned once
                    id: apiKeyData.id,
                    name: apiKeyData.name,
                    permissions: apiKeyData.permissions,
                    rateLimit: apiKeyData.rateLimit,
                    createdAt: apiKeyData.createdAt
                },
                warning: 'Store this API key securely. You will not be able to see it again.'
            });

        } catch (error) {
            logger.error('Failed to generate API key:', error);
            next(new AppError('Failed to generate API key', 500, 'API_KEY_GENERATION_FAILED'));
        }
    }

    /**
     * List all API keys (excluding hashes)
     */
    static async listApiKeys(req, res, next) {
        try {
            const { page, limit } = req.query;

            const result = await ApiKeyModel.list(page, limit);

            res.json({
                success: true,
                message: 'API keys retrieved successfully',
                data: result.keys,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error('Failed to list API keys:', error);
            next(new AppError('Failed to retrieve API keys', 500, 'API_KEY_LIST_FAILED'));
        }
    }

    /**
     * Get API key by ID
     */
    static async getApiKey(req, res, next) {
        try {
            const { id } = req.params;

            const apiKey = await ApiKeyModel.getById(id);

            if (!apiKey) {
                return next(new AppError('API key not found', 404, 'API_KEY_NOT_FOUND'));
            }

            res.json({
                success: true,
                message: 'API key retrieved successfully',
                data: apiKey
            });

        } catch (error) {
            logger.error('Failed to get API key:', error);
            next(new AppError('Failed to retrieve API key', 500, 'API_KEY_GET_FAILED'));
        }
    }

    /**
     * Update API key
     */
    static async updateApiKey(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const updatedApiKey = await ApiKeyModel.update(id, updates);

            res.json({
                success: true,
                message: 'API key updated successfully',
                data: updatedApiKey
            });

        } catch (error) {
            logger.error('Failed to update API key:', error);
            
            if (error.message === 'API key not found') {
                return next(new AppError('API key not found', 404, 'API_KEY_NOT_FOUND'));
            }
            
            next(new AppError('Failed to update API key', 500, 'API_KEY_UPDATE_FAILED'));
        }
    }

    /**
     * Delete API key
     */
    static async deleteApiKey(req, res, next) {
        try {
            const { id } = req.params;

            const deleted = await ApiKeyModel.delete(id);

            if (!deleted) {
                return next(new AppError('API key not found', 404, 'API_KEY_NOT_FOUND'));
            }

            res.json({
                success: true,
                message: 'API key deleted successfully'
            });

        } catch (error) {
            logger.error('Failed to delete API key:', error);
            next(new AppError('Failed to delete API key', 500, 'API_KEY_DELETE_FAILED'));
        }
    }

    /**
     * Deactivate API key (soft delete)
     */
    static async deactivateApiKey(req, res, next) {
        try {
            const { id } = req.params;

            const deactivatedApiKey = await ApiKeyModel.deactivate(id);

            res.json({
                success: true,
                message: 'API key deactivated successfully',
                data: deactivatedApiKey
            });

        } catch (error) {
            logger.error('Failed to deactivate API key:', error);
            
            if (error.message === 'API key not found') {
                return next(new AppError('API key not found', 404, 'API_KEY_NOT_FOUND'));
            }
            
            next(new AppError('Failed to deactivate API key', 500, 'API_KEY_DEACTIVATE_FAILED'));
        }
    }

    /**
     * Get API key usage statistics
     */
    static async getApiKeyStats(req, res, next) {
        try {
            const { id } = req.params;
            const { days } = req.query;

            // Verify API key exists
            const apiKey = await ApiKeyModel.getById(id);
            if (!apiKey) {
                return next(new AppError('API key not found', 404, 'API_KEY_NOT_FOUND'));
            }

            // Get usage statistics
            const stats = await ApiKeyModel.getUsageStats(id, days);

            res.json({
                success: true,
                message: 'API key statistics retrieved successfully',
                data: {
                    apiKey: {
                        id: apiKey.id,
                        name: apiKey.name,
                        createdAt: apiKey.createdAt
                    },
                    stats: stats,
                    period: `${days || 30} days`
                }
            });

        } catch (error) {
            logger.error('Failed to get API key stats:', error);
            next(new AppError('Failed to retrieve API key statistics', 500, 'API_KEY_STATS_FAILED'));
        }
    }

    /**
     * Validate current API key (self-check)
     */
    static async validateCurrentApiKey(req, res, next) {
        try {
            // API key data is already attached by auth middleware
            const apiKeyData = req.apiKey;

            res.json({
                success: true,
                message: 'API key is valid',
                data: {
                    id: apiKeyData.id,
                    name: apiKeyData.name,
                    permissions: apiKeyData.permissions,
                    rateLimit: apiKeyData.rateLimit,
                    lastUsed: apiKeyData.lastUsed,
                    createdAt: apiKeyData.createdAt
                }
            });

        } catch (error) {
            logger.error('Failed to validate API key:', error);
            next(new AppError('Failed to validate API key', 500, 'API_KEY_VALIDATION_FAILED'));
        }
    }

    /**
     * Get current user permissions
     */
    static async getPermissions(req, res, next) {
        try {
            const apiKeyData = req.apiKey;

            const permissions = {
                send_otp: ApiKeyModel.hasPermission(apiKeyData, 'send_otp'),
                send_message: ApiKeyModel.hasPermission(apiKeyData, 'send_message'),
                manage_sessions: ApiKeyModel.hasPermission(apiKeyData, 'manage_sessions'),
                view_stats: ApiKeyModel.hasPermission(apiKeyData, 'view_stats'),
                admin: ApiKeyModel.hasPermission(apiKeyData, '*')
            };

            res.json({
                success: true,
                message: 'Permissions retrieved successfully',
                data: {
                    permissions,
                    rateLimit: apiKeyData.rateLimit,
                    apiKeyName: apiKeyData.name
                }
            });

        } catch (error) {
            logger.error('Failed to get permissions:', error);
            next(new AppError('Failed to retrieve permissions', 500, 'PERMISSIONS_GET_FAILED'));
        }
    }

    /**
     * Refresh API key (generate new key, invalidate old one)
     */
    static async refreshApiKey(req, res, next) {
        try {
            const { id } = req.params;

            // Get existing API key
            const existingKey = await ApiKeyModel.getById(id);
            if (!existingKey) {
                return next(new AppError('API key not found', 404, 'API_KEY_NOT_FOUND'));
            }

            // Create new API key with same permissions
            const newApiKey = await ApiKeyModel.create(
                existingKey.name,
                existingKey.permissions,
                existingKey.rateLimit
            );

            // Deactivate old API key
            await ApiKeyModel.deactivate(id);

            logger.info('API key refreshed', {
                oldKeyId: id,
                newKeyId: newApiKey.id,
                name: existingKey.name,
                ip: req.ip
            });

            res.json({
                success: true,
                message: 'API key refreshed successfully',
                data: {
                    apiKey: newApiKey.apiKey, // Only returned once
                    id: newApiKey.id,
                    name: newApiKey.name,
                    permissions: newApiKey.permissions,
                    rateLimit: newApiKey.rateLimit,
                    createdAt: newApiKey.createdAt
                },
                warning: 'Store this new API key securely. The old key has been deactivated.'
            });

        } catch (error) {
            logger.error('Failed to refresh API key:', error);
            next(new AppError('Failed to refresh API key', 500, 'API_KEY_REFRESH_FAILED'));
        }
    }

    /**
     * Cleanup old API keys
     */
    static async cleanupOldKeys(req, res, next) {
        try {
            const { days = 90 } = req.query;

            const cleanedCount = await ApiKeyModel.cleanupOldKeys(days);

            res.json({
                success: true,
                message: 'API key cleanup completed',
                data: {
                    cleanedCount,
                    daysOld: days
                }
            });

        } catch (error) {
            logger.error('Failed to cleanup old API keys:', error);
            next(new AppError('Failed to cleanup old API keys', 500, 'API_KEY_CLEANUP_FAILED'));
        }
    }
}

module.exports = AuthController;