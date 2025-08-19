const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DB_PATH || './data/whatsapp-bot.db';
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.database('Created data directory');
    }
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('Failed to connect to database:', err);
          reject(err);
        } else {
          logger.database('Connected to SQLite database');
          this.createTables()
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  async createTables() {
    const tables = [
      // API Keys table
      `CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_hash TEXT UNIQUE NOT NULL,
        app_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME,
        is_active BOOLEAN DEFAULT 1,
        rate_limit INTEGER DEFAULT 100,
        usage_count INTEGER DEFAULT 0
      )`,

      // OTP Messages table
      `CREATE TABLE IF NOT EXISTS otp_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT NOT NULL,
        otp_code TEXT NOT NULL,
        app_name TEXT NOT NULL,
        api_key_id INTEGER,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
      )`,

      // WhatsApp Sessions table
      `CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'disconnected',
        qr_code TEXT,
        phone_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        connection_count INTEGER DEFAULT 0
      )`,

      // App Configuration table
      `CREATE TABLE IF NOT EXISTS app_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        api_key_id INTEGER,
        app_name TEXT NOT NULL,
        otp_template TEXT,
        otp_length INTEGER DEFAULT 6,
        otp_expiry_minutes INTEGER DEFAULT 5,
        daily_limit INTEGER DEFAULT 1000,
        monthly_limit INTEGER DEFAULT 30000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
      )`,

      // System Logs table
      `CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        category TEXT,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Usage Statistics table
      `CREATE TABLE IF NOT EXISTS usage_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        api_key_id INTEGER,
        app_name TEXT,
        date DATE NOT NULL,
        messages_sent INTEGER DEFAULT 0,
        messages_failed INTEGER DEFAULT 0,
        total_requests INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_messages(phone_number)',
      'CREATE INDEX IF NOT EXISTS idx_otp_status ON otp_messages(status)',
      'CREATE INDEX IF NOT EXISTS idx_otp_created ON otp_messages(sent_at)',
      'CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)',
      'CREATE INDEX IF NOT EXISTS idx_usage_stats_date ON usage_stats(date)',
      'CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }

    logger.database('Database tables and indexes created successfully');
  }

  // Generic database operations
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('Database run error:', err);
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('Database get error:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Database all error:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // API Key operations
  async createApiKey(keyHash, appName, rateLimit = 100) {
    const sql = `INSERT INTO api_keys (key_hash, app_name, rate_limit) VALUES (?, ?, ?)`;
    return this.run(sql, [keyHash, appName, rateLimit]);
  }

  async getApiKey(keyHash) {
    const sql = `SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1`;
    return this.get(sql, [keyHash]);
  }

  async updateApiKeyUsage(keyId) {
    const sql = `UPDATE api_keys SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?`;
    return this.run(sql, [keyId]);
  }

  // OTP operations
  async createOtpMessage(phoneNumber, otpCode, appName, apiKeyId, expiresAt) {
    const sql = `INSERT INTO otp_messages (phone_number, otp_code, app_name, api_key_id, expires_at) 
                 VALUES (?, ?, ?, ?, ?)`;
    return this.run(sql, [phoneNumber, otpCode, appName, apiKeyId, expiresAt]);
  }

  async updateOtpStatus(id, status, errorMessage = null) {
    const sql = `UPDATE otp_messages SET status = ?, error_message = ? WHERE id = ?`;
    return this.run(sql, [status, errorMessage, id]);
  }

  async getOtpMessage(id) {
    const sql = `SELECT * FROM otp_messages WHERE id = ?`;
    return this.get(sql, [id]);
  }

  async getRecentOtps(limit = 50) {
    const sql = `SELECT * FROM otp_messages ORDER BY sent_at DESC LIMIT ?`;
    return this.all(sql, [limit]);
  }

  // WhatsApp session operations
  async createOrUpdateSession(sessionId, status, qrCode = null, phoneNumber = null) {
    const sql = `INSERT OR REPLACE INTO whatsapp_sessions 
                 (session_id, status, qr_code, phone_number, last_activity) 
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;
    return this.run(sql, [sessionId, status, qrCode, phoneNumber]);
  }

  async getSession(sessionId) {
    const sql = `SELECT * FROM whatsapp_sessions WHERE session_id = ?`;
    return this.get(sql, [sessionId]);
  }

  async updateSessionStatus(sessionId, status) {
    const sql = `UPDATE whatsapp_sessions SET status = ?, last_activity = CURRENT_TIMESTAMP WHERE session_id = ?`;
    return this.run(sql, [status, sessionId]);
  }

  // Statistics operations
  async updateUsageStats(apiKeyId, appName, messagesSent = 0, messagesFailed = 0, totalRequests = 1) {
    const today = new Date().toISOString().split('T')[0];
    const sql = `INSERT INTO usage_stats (api_key_id, app_name, date, messages_sent, messages_failed, total_requests)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(api_key_id, date) DO UPDATE SET
                 messages_sent = messages_sent + ?,
                 messages_failed = messages_failed + ?,
                 total_requests = total_requests + ?`;
    return this.run(sql, [apiKeyId, appName, today, messagesSent, messagesFailed, totalRequests, messagesSent, messagesFailed, totalRequests]);
  }

  async getUsageStats(apiKeyId, days = 30) {
    const sql = `SELECT * FROM usage_stats 
                 WHERE api_key_id = ? AND date >= date('now', '-${days} days')
                 ORDER BY date DESC`;
    return this.all(sql, [apiKeyId]);
  }

  // System logs
  async logMessage(level, message, category = null, metadata = null) {
    const sql = `INSERT INTO system_logs (level, message, category, metadata) VALUES (?, ?, ?, ?)`;
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    return this.run(sql, [level, message, category, metadataStr]);
  }

  async getSystemLogs(limit = 100, level = null) {
    let sql = `SELECT * FROM system_logs`;
    const params = [];
    
    if (level) {
      sql += ` WHERE level = ?`;
      params.push(level);
    }
    
    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);
    
    return this.all(sql, params);
  }

  // Cleanup operations
  async cleanupExpiredOtps() {
    const sql = `DELETE FROM otp_messages WHERE expires_at < CURRENT_TIMESTAMP`;
    return this.run(sql);
  }

  async cleanupOldLogs(days = 30) {
    const sql = `DELETE FROM system_logs WHERE timestamp < date('now', '-${days} days')`;
    return this.run(sql);
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database:', err);
          } else {
            logger.database('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;