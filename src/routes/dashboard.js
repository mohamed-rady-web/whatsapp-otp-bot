/**
 * Dashboard Routes Configuration
 * 
 * Defines routes for the web dashboard interface
 * with admin authentication and appropriate middleware.
 */

const express = require('express');
const router = express.Router();
const path = require('path');

// Import controllers
const DashboardController = require('../controllers/dashboardController');

// Import middleware
const { authenticateAdmin } = require('../middleware/auth');
const { dashboardRateLimit } = require('../middleware/rateLimiter');

// Apply global dashboard middleware
router.use(dashboardRateLimit);

// ===================
// PUBLIC DASHBOARD ROUTES
// ===================

// Serve dashboard HTML (public access)
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/dashboard/index.html'));
});

// Serve dashboard assets (public access)
router.get('/assets/*', (req, res) => {
    const assetPath = req.path.replace('/assets', '');
    res.sendFile(path.join(__dirname, '../../public/assets', assetPath));
});

// Basic dashboard configuration (public access)
router.get('/api/config', DashboardController.getDashboardConfig);

// ===================
// PROTECTED API ROUTES
// ===================

// Apply authentication for all dashboard API routes
router.use('/api', authenticateAdmin);

// Dashboard overview and metrics
router.get('/api/overview', DashboardController.getDashboardOverview);
router.get('/api/metrics', DashboardController.getRealTimeMetrics);
router.get('/api/analytics', DashboardController.getAnalytics);
router.get('/api/health', DashboardController.getSystemHealth);

// API key analytics
router.get('/api/api-keys/analytics', DashboardController.getApiKeyAnalytics);

// ===================
// DASHBOARD SPECIFIC ENDPOINTS
// ===================

// Get dashboard-specific data summaries
router.get('/api/summary/today', async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // This would be implemented with specific dashboard queries
        // For now, redirect to overview with today's data
        req.query.period = '24h';
        return DashboardController.getDashboardOverview(req, res, next);
    } catch (error) {
        next(error);
    }
});

router.get('/api/summary/week', async (req, res, next) => {
    try {
        req.query.period = '7d';
        return DashboardController.getDashboardOverview(req, res, next);
    } catch (error) {
        next(error);
    }
});

router.get('/api/summary/month', async (req, res, next) => {
    try {
        req.query.period = '30d';
        return DashboardController.getDashboardOverview(req, res, next);
    } catch (error) {
        next(error);
    }
});

// ===================
// DASHBOARD UTILITIES
// ===================

// Get dashboard notifications
router.get('/api/notifications', async (req, res) => {
    try {
        // This would typically come from a notification service
        // For now, return static notifications
        const notifications = [
            {
                id: 1,
                type: 'info',
                message: 'Dashboard loaded successfully',
                timestamp: new Date().toISOString(),
                read: false
            }
        ];

        res.json({
            success: true,
            data: notifications
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to load notifications'
        });
    }
});

// Mark notification as read
router.post('/api/notifications/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        
        // This would typically update notification status in database
        res.json({
            success: true,
            message: 'Notification marked as read',
            data: { id: parseInt(id), read: true }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to mark notification as read'
        });
    }
});

// Dashboard settings
router.get('/api/settings', async (req, res) => {
    try {
        const settings = {
            theme: 'light',
            autoRefresh: true,
            refreshInterval: 30000, // 30 seconds
            notifications: true,
            compactMode: false,
            timezone: 'UTC',
            dateFormat: 'YYYY-MM-DD',
            timeFormat: '24h'
        };

        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to load settings'
        });
    }
});

router.post('/api/settings', async (req, res) => {
    try {
        const { settings } = req.body;
        
        // This would typically save settings to database or user preferences
        res.json({
            success: true,
            message: 'Settings updated successfully',
            data: settings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update settings'
        });
    }
});

// ===================
// AUTHENTICATION ROUTES
// ===================

// Login endpoint for dashboard
router.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const adminUsername = process.env.DASHBOARD_USERNAME || 'admin';
        const adminPassword = process.env.DASHBOARD_PASSWORD || 'admin123';
        
        if (username !== adminUsername || password !== adminPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        
        // In a real application, you would generate a JWT token or session
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                username: adminUsername,
                token: Buffer.from(`${username}:${password}`).toString('base64')
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// Logout endpoint
router.post('/api/logout', async (req, res) => {
    try {
        // In a real application, you would invalidate the session/token
        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

// Check authentication status
router.get('/api/auth/status', (req, res) => {
    // If this endpoint is reached, admin middleware has passed
    res.json({
        success: true,
        authenticated: true,
        user: req.admin
    });
});

// ===================
// ERROR HANDLING
// ===================

// Handle unknown dashboard routes
router.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Dashboard API endpoint not found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        availableEndpoints: [
            'GET /dashboard/api/overview - Dashboard overview',
            'GET /dashboard/api/metrics - Real-time metrics',
            'GET /dashboard/api/analytics - Analytics data',
            'GET /dashboard/api/health - System health',
            'GET /dashboard/api/config - Dashboard configuration',
            'POST /dashboard/api/login - Admin login',
            'GET /dashboard/api/auth/status - Authentication status'
        ]
    });
});

// Redirect all other routes to dashboard
router.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/dashboard/index.html'));
});

module.exports = router;