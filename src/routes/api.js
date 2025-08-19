/**
 * API Routes Configuration
 * 
 * Defines all API endpoints with appropriate middleware,
 * validation, authentication, and rate limiting.
 */

const express = require('express');
const router = express.Router();

// Import controllers
const AuthController = require('../controllers/authController');
const OtpController = require('../controllers/otpController');
const StatusController = require('../controllers/statusController');

// Import middleware
const { 
    authenticateApiKey, 
    requirePermission, 
    apiKeyRateLimit,
    optionalAuth 
} = require('../middleware/auth');

const {
    strictRateLimit,
    moderateRateLimit,
    lenientRateLimit,
    messagingRateLimit,
    authRateLimit,
    connectionRateLimit
} = require('../middleware/rateLimiter');

const {
    validateGenerateApiKey,
    validateSendOtp,
    validateSendMessage,
    validateUpdateApiKey,
    validateListQuery,
    validateMessageQuery,
    validateStatsQuery,
    validateIdParam,
    validateOtp,
    sanitizeInput,
    validateContentType
} = require('../middleware/validator');

// Apply global API middleware
router.use(sanitizeInput);
router.use(validateContentType(['application/json', 'multipart/form-data']));

// ======================
// AUTHENTICATION ROUTES
// ======================

// Generate new API key (no auth required for first setup)
router.post('/auth/generate-key',
    authRateLimit,
    validateGenerateApiKey,
    AuthController.generateApiKey
);

// Protected auth routes (require existing API key)
router.use('/auth', authenticateApiKey, apiKeyRateLimit);

router.get('/auth/keys',
    moderateRateLimit,
    validateListQuery,
    requirePermission('*'),
    AuthController.listApiKeys
);

router.get('/auth/keys/:id',
    lenientRateLimit,
    validateIdParam,
    requirePermission('*'),
    AuthController.getApiKey
);

router.put('/auth/keys/:id',
    strictRateLimit,
    validateIdParam,
    validateUpdateApiKey,
    requirePermission('*'),
    AuthController.updateApiKey
);

router.delete('/auth/keys/:id',
    strictRateLimit,
    validateIdParam,
    requirePermission('*'),
    AuthController.deleteApiKey
);

router.post('/auth/keys/:id/deactivate',
    strictRateLimit,
    validateIdParam,
    requirePermission('*'),
    AuthController.deactivateApiKey
);

router.get('/auth/keys/:id/stats',
    moderateRateLimit,
    validateIdParam,
    validateStatsQuery,
    requirePermission('*'),
    AuthController.getApiKeyStats
);

router.post('/auth/keys/:id/refresh',
    strictRateLimit,
    validateIdParam,
    requirePermission('*'),
    AuthController.refreshApiKey
);

router.get('/auth/validate',
    lenientRateLimit,
    AuthController.validateCurrentApiKey
);

router.get('/auth/permissions',
    lenientRateLimit,
    AuthController.getPermissions
);

router.post('/auth/cleanup',
    strictRateLimit,
    requirePermission('*'),
    AuthController.cleanupOldKeys
);

// ===================
// OTP & MESSAGING ROUTES
// ===================

// Apply authentication for all OTP routes
router.use(['/send-otp', '/send-message', '/validate-otp', '/otp'], 
    authenticateApiKey, 
    apiKeyRateLimit
);

// Send OTP
router.post('/send-otp',
    messagingRateLimit,
    validateSendOtp,
    requirePermission('send_otp'),
    OtpController.sendOtp
);

// Send custom message
router.post('/send-message',
    messagingRateLimit,
    validateSendMessage,
    requirePermission('send_message'),
    OtpController.sendMessage
);

// Validate OTP
router.post('/validate-otp',
    moderateRateLimit,
    validateOtp,
    requirePermission('send_otp'),
    OtpController.validateOtp
);

// Get OTP information
router.get('/otp/info',
    lenientRateLimit,
    requirePermission('send_otp'),
    OtpController.getOtpInfo
);

// Revoke OTP
router.post('/otp/revoke',
    moderateRateLimit,
    requirePermission('send_otp'),
    OtpController.revokeOtp
);

// Resend OTP
router.post('/otp/resend',
    strictRateLimit,
    requirePermission('send_otp'),
    OtpController.resendOtp
);

// Get OTP statistics
router.get('/otp/stats',
    moderateRateLimit,
    requirePermission('view_stats'),
    OtpController.getOtpStats
);

// ========================
// WHATSAPP & STATUS ROUTES
// ========================

// Public health check (no auth required)
router.get('/health',
    lenientRateLimit,
    StatusController.getHealth
);

// Protected status routes
router.use(['/status', '/connect', '/disconnect', '/restart', '/qr'], 
    authenticateApiKey, 
    apiKeyRateLimit
);

// Get WhatsApp status
router.get('/status',
    lenientRateLimit,
    StatusController.getWhatsAppStatus
);

// Get system statistics
router.get('/stats',
    moderateRateLimit,
    validateStatsQuery,
    requirePermission('view_stats'),
    StatusController.getSystemStats
);

// WhatsApp connection management
router.post('/connect',
    connectionRateLimit,
    requirePermission('manage_sessions'),
    StatusController.connect
);

router.post('/disconnect',
    moderateRateLimit,
    requirePermission('manage_sessions'),
    StatusController.disconnect
);

router.post('/restart',
    connectionRateLimit,
    requirePermission('manage_sessions'),
    StatusController.restart
);

// Get QR code for authentication
router.get('/qr',
    lenientRateLimit,
    requirePermission('manage_sessions'),
    StatusController.getQrCode
);

// ==================
// MESSAGE & SESSION ROUTES
// ==================

// Protected message/session routes
router.use(['/messages', '/sessions'], 
    authenticateApiKey, 
    apiKeyRateLimit
);

// Get messages
router.get('/messages',
    moderateRateLimit,
    validateMessageQuery,
    requirePermission('view_stats'),
    StatusController.getMessages
);

// Get sessions
router.get('/sessions',
    moderateRateLimit,
    validateListQuery,
    requirePermission('view_stats'),
    StatusController.getSessions
);

// Clear all sessions
router.post('/sessions/clear',
    strictRateLimit,
    requirePermission('manage_sessions'),
    StatusController.clearSessions
);

// =================
// UTILITY ROUTES
// =================

// Protected utility routes
router.use(['/logs', '/screenshot', '/export'], 
    authenticateApiKey, 
    apiKeyRateLimit,
    requirePermission('*')
);

// Get system logs
router.get('/logs',
    moderateRateLimit,
    StatusController.getLogs
);

// Take screenshot for debugging
router.get('/screenshot',
    strictRateLimit,
    StatusController.takeScreenshot
);

// Export data
router.get('/export',
    strictRateLimit,
    StatusController.exportData
);

// =================
// ERROR HANDLING
// =================

// Handle unknown API routes
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        availableEndpoints: [
            'POST /api/auth/generate-key - Generate API key',
            'POST /api/connect - Connect to WhatsApp',
            'GET /api/qr - Get QR code',
            'POST /api/send-otp - Send OTP message',
            'POST /api/send-message - Send custom message',
            'POST /api/validate-otp - Validate OTP code',
            'GET /api/status - Get connection status',
            'GET /api/stats - Get system statistics',
            'GET /api/health - Health check',
            'GET /api/messages - Get message history',
            'GET /api/sessions - Get session list'
        ],
        documentation: '/api/docs'
    });
});

module.exports = router;