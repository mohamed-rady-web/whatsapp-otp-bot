/**
 * WhatsApp Service
 * 
 * Core WhatsApp Web automation using Selenium WebDriver.
 * Handles connection, QR code scanning, message sending,
 * and session management.
 */

const { By, until, Key } = require('selenium-webdriver');
const SeleniumConfig = require('../config/selenium');
const SessionModel = require('../models/session');
const MessageModel = require('../models/message');
const logger = require('../config/logger');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.seleniumConfig = new SeleniumConfig();
        this.driver = null;
        this.currentSession = null;
        this.isConnecting = false;
        this.connectionCheckInterval = null;
        this.qrCodeCheckInterval = null;
        this.lastQrCode = null;
    }

    /**
     * Initialize WhatsApp connection
     */
    async connect() {
        try {
            if (this.isConnecting) {
                throw new Error('Connection already in progress');
            }

            this.isConnecting = true;
            logger.logWhatsAppEvent('connection_started');

            // Create new session
            this.currentSession = await SessionModel.create();
            
            // Create WebDriver
            this.driver = await this.seleniumConfig.createDriver();
            
            // Navigate to WhatsApp Web
            await this.seleniumConfig.navigateToWhatsApp();
            
            // Wait for page to load completely
            await this.waitForInitialLoad();
            
            // Check if already logged in
            const isLoggedIn = await this.checkIfLoggedIn();
            
            if (isLoggedIn) {
                await this.handleSuccessfulLogin();
            } else {
                await this.handleQrCodeFlow();
            }

            // Start monitoring connection
            this.startConnectionMonitoring();
            
            this.isConnecting = false;
            return this.currentSession;

        } catch (error) {
            this.isConnecting = false;
            logger.error('Failed to connect to WhatsApp:', error);
            
            if (this.currentSession) {
                await SessionModel.updateStatus(
                    this.currentSession.sessionId, 
                    'failed', 
                    { error: error.message }
                );
            }
            
            await this.cleanup();
            throw error;
        }
    }

    /**
     * Wait for initial page load
     */
    async waitForInitialLoad() {
        try {
            // Wait for WhatsApp logo or main interface
            await this.driver.wait(
                until.elementLocated(By.css('[data-testid="landing-title"], [data-testid="qr-code"], [data-testid="side"]')),
                30000,
                'WhatsApp Web did not load within 30 seconds'
            );

            // Additional wait for JavaScript to initialize
            await this.driver.sleep(3000);
            
            logger.logWhatsAppEvent('page_loaded');

        } catch (error) {
            logger.error('Failed to wait for initial load:', error);
            throw error;
        }
    }

    /**
     * Check if already logged in
     */
    async checkIfLoggedIn() {
        try {
            // Look for chat interface elements
            const chatExists = await this.seleniumConfig.elementExists(
                By.css('[data-testid="side"]'),
                5000
            );

            if (chatExists) {
                logger.logWhatsAppEvent('already_logged_in');
                return true;
            }

            return false;

        } catch (error) {
            logger.error('Error checking login status:', error);
            return false;
        }
    }

    /**
     * Handle QR code flow for authentication
     */
    async handleQrCodeFlow() {
        try {
            logger.logWhatsAppEvent('qr_code_flow_started');
            
            // Update session status
            await SessionModel.updateStatus(
                this.currentSession.sessionId,
                'awaiting_scan'
            );

            // Start QR code monitoring
            this.startQrCodeMonitoring();

            // Wait for successful scan or timeout
            await this.waitForQrCodeScan();

        } catch (error) {
            logger.error('QR code flow failed:', error);
            throw error;
        }
    }

    /**
     * Start QR code monitoring
     */
    startQrCodeMonitoring() {
        this.qrCodeCheckInterval = setInterval(async () => {
            try {
                await this.checkAndUpdateQrCode();
            } catch (error) {
                logger.error('QR code monitoring error:', error);
            }
        }, 2000); // Check every 2 seconds
    }

    /**
     * Check and update QR code
     */
    async checkAndUpdateQrCode() {
        try {
            // Look for QR code element
            const qrElement = await this.seleniumConfig.elementExists(
                By.css('[data-testid="qr-code"]'),
                1000
            );

            if (!qrElement) {
                // QR code disappeared, might be logged in
                await this.checkForSuccessfulLogin();
                return;
            }

            // Get QR code data
            const qrCodeElement = await this.driver.findElement(By.css('[data-testid="qr-code"]'));
            const qrCodeData = await qrCodeElement.getAttribute('data-ref');

            if (qrCodeData && qrCodeData !== this.lastQrCode) {
                this.lastQrCode = qrCodeData;
                
                // Generate QR code image
                const qrCodeImage = await QRCode.toDataURL(qrCodeData);
                
                // Update session with QR code
                await SessionModel.setQrCode(this.currentSession.sessionId, qrCodeImage);
                
                logger.logWhatsAppEvent('qr_code_updated', {
                    sessionId: this.currentSession.sessionId
                });
            }

        } catch (error) {
            // QR code element might not be present, check if logged in
            await this.checkForSuccessfulLogin();
        }
    }

    /**
     * Wait for QR code scan
     */
    async waitForQrCodeScan() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.stopQrCodeMonitoring();
                reject(new Error('QR code scan timeout'));
            }, 300000); // 5 minutes timeout

            const checkLogin = async () => {
                try {
                    const isLoggedIn = await this.checkIfLoggedIn();
                    if (isLoggedIn) {
                        clearTimeout(timeout);
                        this.stopQrCodeMonitoring();
                        await this.handleSuccessfulLogin();
                        resolve();
                    }
                } catch (error) {
                    logger.error('Error checking login during QR scan:', error);
                }
            };

            // Check every 3 seconds
            const loginCheckInterval = setInterval(checkLogin, 3000);
            
            // Clean up interval when done
            timeout.finally = () => clearInterval(loginCheckInterval);
        });
    }

    /**
     * Stop QR code monitoring
     */
    stopQrCodeMonitoring() {
        if (this.qrCodeCheckInterval) {
            clearInterval(this.qrCodeCheckInterval);
            this.qrCodeCheckInterval = null;
        }
    }

    /**
     * Check for successful login
     */
    async checkForSuccessfulLogin() {
        try {
            const isLoggedIn = await this.checkIfLoggedIn();
            if (isLoggedIn) {
                await this.handleSuccessfulLogin();
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Error checking for successful login:', error);
            return false;
        }
    }

    /**
     * Handle successful login
     */
    async handleSuccessfulLogin() {
        try {
            this.stopQrCodeMonitoring();
            
            // Get connected phone number
            const phoneNumber = await this.getConnectedPhoneNumber();
            
            // Update session
            await SessionModel.setConnectedPhone(
                this.currentSession.sessionId,
                phoneNumber
            );

            // Update current session object
            this.currentSession.status = 'connected';
            this.currentSession.connectedPhone = phoneNumber;

            logger.logWhatsAppEvent('login_successful', {
                sessionId: this.currentSession.sessionId,
                phone: phoneNumber ? SessionModel.maskPhoneNumber(phoneNumber) : 'unknown'
            });

        } catch (error) {
            logger.error('Error handling successful login:', error);
            throw error;
        }
    }

    /**
     * Get connected phone number
     */
    async getConnectedPhoneNumber() {
        try {
            // Try to find profile info
            const profileExists = await this.seleniumConfig.elementExists(
                By.css('[data-testid="default-user"]'),
                5000
            );

            if (profileExists) {
                // Click on profile to get phone number
                const profileElement = await this.driver.findElement(By.css('[data-testid="default-user"]'));
                await profileElement.click();
                
                await this.driver.sleep(2000);
                
                // Look for phone number in profile
                const phoneElements = await this.driver.findElements(By.css('[data-testid="phone-number"]'));
                
                if (phoneElements.length > 0) {
                    const phoneText = await phoneElements[0].getText();
                    
                    // Close profile
                    await this.driver.findElement(By.css('[data-testid="x"]')).click();
                    
                    return phoneText.replace(/\D/g, ''); // Remove non-digits
                }
            }

            return 'unknown';

        } catch (error) {
            logger.warn('Could not retrieve phone number:', error);
            return 'unknown';
        }
    }

    /**
     * Send OTP message
     */
    async sendMessage(phone, message, messageId = null) {
        try {
            if (!this.isConnected()) {
                throw new Error('WhatsApp not connected');
            }

            logger.logWhatsAppEvent('message_send_started', {
                phone: SessionModel.maskPhoneNumber(phone),
                messageId
            });

            // Format phone number
            const formattedPhone = this.formatPhoneNumber(phone);
            
            // Open chat with phone number
            await this.openChatByPhone(formattedPhone);
            
            // Type and send message
            await this.typeAndSendMessage(message);
            
            // Update message status if messageId provided
            if (messageId) {
                await MessageModel.updateStatus(messageId, 'delivered');
            }

            logger.logWhatsAppEvent('message_sent', {
                phone: SessionModel.maskPhoneNumber(phone),
                messageId
            });

            return true;

        } catch (error) {
            logger.error('Failed to send message:', error);
            
            if (messageId) {
                await MessageModel.updateStatus(messageId, 'failed', error.message);
            }
            
            throw error;
        }
    }

    /**
     * Open chat by phone number
     */
    async openChatByPhone(phone) {
        try {
            // Use WhatsApp Web URL format to open chat
            const chatUrl = `https://web.whatsapp.com/send?phone=${phone}`;
            await this.driver.get(chatUrl);

            // Wait for chat to load
            await this.driver.wait(
                until.elementLocated(By.css('[data-testid="conversation-compose-box-input"]')),
                15000,
                'Chat interface did not load'
            );

            // Additional wait for full load
            await this.driver.sleep(2000);

        } catch (error) {
            logger.error('Failed to open chat:', error);
            throw new Error(`Failed to open chat for phone ${phone}: ${error.message}`);
        }
    }

    /**
     * Type and send message
     */
    async typeAndSendMessage(message) {
        try {
            // Find message input box
            const messageBox = await this.driver.findElement(
                By.css('[data-testid="conversation-compose-box-input"]')
            );

            // Clear existing text and type message
            await messageBox.clear();
            await messageBox.sendKeys(message);

            // Wait a bit for the message to be processed
            await this.driver.sleep(1000);

            // Send message (Enter key)
            await messageBox.sendKeys(Key.ENTER);

            // Wait for message to be sent
            await this.driver.sleep(2000);

        } catch (error) {
            logger.error('Failed to type and send message:', error);
            throw error;
        }
    }

    /**
     * Format phone number for WhatsApp
     */
    formatPhoneNumber(phone) {
        // Remove all non-digits
        let cleaned = phone.replace(/\D/g, '');
        
        // Add country code if missing (assuming international format needed)
        if (!cleaned.startsWith('1') && cleaned.length === 10) {
            cleaned = '1' + cleaned; // US/Canada
        }
        
        return cleaned;
    }

    /**
     * Start connection monitoring
     */
    startConnectionMonitoring() {
        this.connectionCheckInterval = setInterval(async () => {
            try {
                await this.checkConnectionStatus();
            } catch (error) {
                logger.error('Connection monitoring error:', error);
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Check connection status
     */
    async checkConnectionStatus() {
        try {
            if (!this.driver || !this.currentSession) {
                return;
            }

            // Update session activity
            await SessionModel.updateActivity(this.currentSession.sessionId);

            // Check if still on WhatsApp page
            const currentUrl = await this.seleniumConfig.getCurrentUrl();
            if (!currentUrl.includes('web.whatsapp.com')) {
                logger.warn('Not on WhatsApp page, attempting to navigate back');
                await this.seleniumConfig.navigateToWhatsApp();
            }

            // Check if still logged in
            const isLoggedIn = await this.checkIfLoggedIn();
            if (!isLoggedIn) {
                logger.warn('Lost WhatsApp connection');
                await SessionModel.updateStatus(
                    this.currentSession.sessionId,
                    'disconnected',
                    { reason: 'connection_lost' }
                );
            }

        } catch (error) {
            logger.error('Connection status check failed:', error);
            
            if (this.currentSession) {
                await SessionModel.updateStatus(
                    this.currentSession.sessionId,
                    'disconnected',
                    { reason: 'connection_check_failed', error: error.message }
                );
            }
        }
    }

    /**
     * Disconnect WhatsApp
     */
    async disconnect() {
        try {
            logger.logWhatsAppEvent('disconnect_started');

            // Stop monitoring intervals
            this.stopMonitoring();

            // Update session status
            if (this.currentSession) {
                await SessionModel.disconnect(this.currentSession.sessionId);
            }

            // Close WebDriver
            await this.cleanup();

            logger.logWhatsAppEvent('disconnected');

        } catch (error) {
            logger.error('Error during disconnect:', error);
            throw error;
        }
    }

    /**
     * Stop all monitoring intervals
     */
    stopMonitoring() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
        
        this.stopQrCodeMonitoring();
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            this.stopMonitoring();
            
            if (this.driver) {
                await this.seleniumConfig.closeDriver();
                this.driver = null;
            }
            
            this.currentSession = null;
            this.lastQrCode = null;
            this.isConnecting = false;

        } catch (error) {
            logger.error('Error during cleanup:', error);
        }
    }

    /**
     * Check if WhatsApp is connected
     */
    isConnected() {
        return this.currentSession && 
               this.currentSession.status === 'connected' && 
               this.driver;
    }

    /**
     * Get current session info
     */
    getCurrentSession() {
        return this.currentSession;
    }

    /**
     * Get connection status
     */
    async getStatus() {
        try {
            if (!this.currentSession) {
                return {
                    status: 'disconnected',
                    session: null
                };
            }

            // Get fresh session data from database
            const sessionData = await SessionModel.getBySessionId(this.currentSession.sessionId);
            
            return {
                status: sessionData ? sessionData.status : 'disconnected',
                session: sessionData
            };

        } catch (error) {
            logger.error('Error getting status:', error);
            return {
                status: 'error',
                session: null,
                error: error.message
            };
        }
    }

    /**
     * Take screenshot for debugging
     */
    async takeScreenshot(filename = 'debug') {
        try {
            if (this.driver) {
                return await this.seleniumConfig.takeScreenshot(filename);
            }
            return null;
        } catch (error) {
            logger.error('Failed to take screenshot:', error);
            return null;
        }
    }

    /**
     * Restart connection
     */
    async restart() {
        try {
            logger.logWhatsAppEvent('restart_initiated');
            
            await this.disconnect();
            await this.driver.sleep(5000); // Wait 5 seconds
            
            return await this.connect();

        } catch (error) {
            logger.error('Failed to restart connection:', error);
            throw error;
        }
    }
}

// Create singleton instance
const whatsappService = new WhatsAppService();

module.exports = whatsappService;