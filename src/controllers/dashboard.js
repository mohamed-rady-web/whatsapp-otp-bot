const express = require('express');
const path = require('path');
const logger = require('../utils/logger');

function createDashboardRoutes(whatsappService, database) {
  const router = express.Router();

  // Dashboard main page
  router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/dashboard/index.html'));
  });

  // Dashboard API endpoints for frontend
  router.get('/dashboard/api/status', async (req, res) => {
    try {
      const whatsappStatus = await whatsappService.getStatus();
      const connectionOk = await whatsappService.checkConnection();
      
      // Get recent messages (last 24 hours)
      const recentMessages = await database.all(`
        SELECT COUNT(*) as total, 
               SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
               SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM otp_messages 
        WHERE sent_at >= datetime('now', '-24 hours')
      `);

      // Get active API keys count
      const activeKeys = await database.all(`
        SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1
      `);

      res.json({
        whatsapp: {
          connected: connectionOk,
          sessionId: whatsappStatus.sessionId,
          phoneNumber: whatsappStatus.phoneNumber,
          lastActivity: whatsappStatus.lastActivity,
          queueLength: whatsappStatus.queueLength,
          hasQRCode: whatsappStatus.hasQRCode
        },
        statistics: {
          last24Hours: recentMessages[0] || { total: 0, sent: 0, failed: 0 },
          activeApiKeys: activeKeys[0].count
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Dashboard status error:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  // Get QR code for dashboard
  router.get('/dashboard/api/qr', async (req, res) => {
    try {
      const qrCode = await whatsappService.getQRCode();
      
      if (!qrCode) {
        return res.json({ 
          success: false, 
          message: 'QR code not available' 
        });
      }

      res.json({
        success: true,
        qrCode: qrCode
      });
    } catch (error) {
      logger.error('Dashboard QR error:', error);
      res.status(500).json({ error: 'Failed to get QR code' });
    }
  });

  // Connect WhatsApp from dashboard
  router.post('/dashboard/api/connect', async (req, res) => {
    try {
      const result = await whatsappService.connect();
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Dashboard connect error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Disconnect WhatsApp from dashboard
  router.post('/dashboard/api/disconnect', async (req, res) => {
    try {
      await whatsappService.disconnect();
      res.json({
        success: true,
        message: 'Disconnected successfully'
      });
    } catch (error) {
      logger.error('Dashboard disconnect error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Restart WhatsApp from dashboard
  router.post('/dashboard/api/restart', async (req, res) => {
    try {
      await whatsappService.restart();
      res.json({
        success: true,
        message: 'Restarted successfully'
      });
    } catch (error) {
      logger.error('Dashboard restart error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Get recent messages for dashboard
  router.get('/dashboard/api/messages', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const messages = await database.getRecentOtps(limit);
      
      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      logger.error('Dashboard messages error:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  });

  // Get system logs for dashboard
  router.get('/dashboard/api/logs', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const level = req.query.level;
      
      const logs = await database.getSystemLogs(limit, level);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      logger.error('Dashboard logs error:', error);
      res.status(500).json({ error: 'Failed to get logs' });
    }
  });

  // Get usage statistics for dashboard
  router.get('/dashboard/api/stats', async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      
      // Get daily statistics
      const dailyStats = await database.all(`
        SELECT 
          date,
          SUM(messages_sent) as messages_sent,
          SUM(messages_failed) as messages_failed,
          SUM(total_requests) as total_requests
        FROM usage_stats 
        WHERE date >= date('now', '-${days} days')
        GROUP BY date
        ORDER BY date DESC
      `);

      // Get top applications
      const topApps = await database.all(`
        SELECT 
          app_name,
          SUM(messages_sent) as total_sent,
          SUM(messages_failed) as total_failed,
          SUM(total_requests) as total_requests
        FROM usage_stats 
        WHERE date >= date('now', '-${days} days')
        GROUP BY app_name
        ORDER BY total_sent DESC
        LIMIT 10
      `);

      res.json({
        success: true,
        data: {
          period: `${days} days`,
          dailyStats,
          topApps
        }
      });
    } catch (error) {
      logger.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  });

  return router;
}

module.exports = createDashboardRoutes;