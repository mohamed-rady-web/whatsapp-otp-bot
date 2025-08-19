/**
 * Database Configuration and Management
 * 
 * SQLite database setup with connection pooling, migration support,
 * and comprehensive error handling.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/database.sqlite');
        this.isInitialized = false;
    }

    /**
     * Initialize database connection and create tables
     */
    async initialize() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
                logger.info('Created data directory:', dataDir);
            }

            // Create database connection
            await this.connect();
            
            // Create tables if they don't exist
            await this.createTables();
            
            // Run any pending migrations
            await this.runMigrations();
            
            this.isInitialized = true;
            logger.info('Database initialized successfully');
            
        } catch (error) {
            logger.error('Failed to initialize database:', error);
            throw error;
        }
    }

    /**
     * Create database connection
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    logger.error('Failed to connect to database:', err);
                    reject(err);
                } else {
                    logger.info('Connected to SQLite database:', this.dbPath);
                    
                    // Enable foreign keys
                    this.db.run('PRAGMA foreign_keys = ON');
                    
                    // Set journal mode to WAL for better performance
                    this.db.run('PRAGMA journal_mode = WAL');
                    
                    // Set synchronous mode for balance between safety and performance
                    this.db.run('PRAGMA synchronous = NORMAL');
                    
                    resolve();
                }
            });
        });
    }

    /**
     * Create database tables
     */
    async createTables() {
        const tables = [
            // API Keys table
            `CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key_hash TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_used DATETIME,
                is_active BOOLEAN DEFAULT 1,
                rate_limit INTEGER DEFAULT 100,
                permissions TEXT DEFAULT '["send_otp"]'
            )`,

            // Messages table
            `CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_key_id INTEGER,
                phone TEXT NOT NULL,
                message TEXT NOT NULL,
                otp_code TEXT,
                status TEXT DEFAULT 'pending',
                error_message TEXT,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                delivered_at DATETIME,
                attempts INTEGER DEFAULT 0,
                FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
            )`,

            // Sessions table
            `CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL UNIQUE,
                status TEXT DEFAULT 'disconnected',
                qr_code TEXT,
                connected_phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                metadata TEXT DEFAULT '{}'
            )`,

            // Statistics table
            `CREATE TABLE IF NOT EXISTS statistics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                messages_sent INTEGER DEFAULT 0,
                messages_delivered INTEGER DEFAULT 0,
                messages_failed INTEGER DEFAULT 0,
                success_rate REAL DEFAULT 0,
                active_sessions INTEGER DEFAULT 0,
                api_calls INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date)
            )`,

            // Rate limiting table
            `CREATE TABLE IF NOT EXISTS rate_limits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_key_id INTEGER,
                window_start DATETIME NOT NULL,
                request_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
            )`,

            // System settings table
            `CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL UNIQUE,
                value TEXT NOT NULL,
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const sql of tables) {
            await this.run(sql);
        }

        // Create indexes for better performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone)',
            'CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)',
            'CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at)',
            'CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)',
            'CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(api_key_id, window_start)'
        ];

        for (const sql of indexes) {
            await this.run(sql);
        }

        logger.info('Database tables created successfully');
    }

    /**
     * Run database migrations
     */
    async runMigrations() {
        // Check current schema version
        try {
            const version = await this.get('SELECT value FROM settings WHERE key = ?', ['schema_version']);
            const currentVersion = version ? parseInt(version.value) : 0;
            const targetVersion = 1;

            if (currentVersion < targetVersion) {
                logger.info(`Running database migrations from version ${currentVersion} to ${targetVersion}`);
                
                // Add any migration scripts here as needed
                // await this.run('ALTER TABLE messages ADD COLUMN new_field TEXT');
                
                // Update schema version
                await this.run(
                    'INSERT OR REPLACE INTO settings (key, value, description) VALUES (?, ?, ?)',
                    ['schema_version', targetVersion.toString(), 'Database schema version']
                );
                
                logger.info('Database migrations completed');
            }
        } catch (error) {
            logger.warn('Migration check failed, assuming fresh install:', error.message);
        }
    }

    /**
     * Execute SQL query with parameters
     */
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    logger.logDatabaseQuery(sql, 0, err);
                    reject(err);
                } else {
                    logger.logDatabaseQuery(sql, 0);
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * Get single row from database
     */
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            this.db.get(sql, params, (err, row) => {
                const duration = Date.now() - startTime;
                if (err) {
                    logger.logDatabaseQuery(sql, duration, err);
                    reject(err);
                } else {
                    logger.logDatabaseQuery(sql, duration);
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get multiple rows from database
     */
    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            this.db.all(sql, params, (err, rows) => {
                const duration = Date.now() - startTime;
                if (err) {
                    logger.logDatabaseQuery(sql, duration, err);
                    reject(err);
                } else {
                    logger.logDatabaseQuery(sql, duration);
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Begin database transaction
     */
    async beginTransaction() {
        await this.run('BEGIN TRANSACTION');
    }

    /**
     * Commit database transaction
     */
    async commit() {
        await this.run('COMMIT');
    }

    /**
     * Rollback database transaction
     */
    async rollback() {
        await this.run('ROLLBACK');
    }

    /**
     * Close database connection
     */
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        logger.error('Error closing database:', err);
                        reject(err);
                    } else {
                        logger.info('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Create database backup
     */
    async createBackup() {
        const backupDir = process.env.DB_BACKUP_PATH || path.join(__dirname, '../../data/backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `backup-${timestamp}.sqlite`);

        return new Promise((resolve, reject) => {
            const backup = this.db.backup(backupPath);
            backup.step(-1, (err) => {
                if (err) {
                    logger.error('Backup failed:', err);
                    reject(err);
                } else {
                    backup.finish((err) => {
                        if (err) {
                            logger.error('Backup finish failed:', err);
                            reject(err);
                        } else {
                            logger.info('Database backup created:', backupPath);
                            resolve(backupPath);
                        }
                    });
                }
            });
        });
    }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

// Export functions
module.exports = {
    initializeDatabase: () => databaseManager.initialize(),
    run: (sql, params) => databaseManager.run(sql, params),
    get: (sql, params) => databaseManager.get(sql, params),
    all: (sql, params) => databaseManager.all(sql, params),
    beginTransaction: () => databaseManager.beginTransaction(),
    commit: () => databaseManager.commit(),
    rollback: () => databaseManager.rollback(),
    close: () => databaseManager.close(),
    createBackup: () => databaseManager.createBackup(),
    db: databaseManager
};