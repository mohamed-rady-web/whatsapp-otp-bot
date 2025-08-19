const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class WhatsAppService {
  constructor(database) {
    this.driver = null;
    this.database = database;
    this.sessionId = uuidv4();
    this.isConnected = false;
    this.qrCode = null;
    this.phoneNumber = null;
    this.lastActivity = new Date();
    this.messageQueue = [];
    this.isProcessingQueue = false;
    
    // Ensure session directory exists
    this.sessionPath = process.env.WHATSAPP_SESSION_PATH || './data/whatsapp-session';
    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = [this.sessionPath, './data/chrome-data'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async initializeDriver() {
    try {
      const options = new chrome.Options();
      
      // Chrome options for automation
      if (process.env.WHATSAPP_HEADLESS === 'true') {
        options.addArguments('--headless');
      }
      
      options.addArguments(
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-translate',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-device-discovery-notifications',
        `--user-data-dir=${process.env.CHROME_USER_DATA_DIR || './data/chrome-data'}`
      );

      // Set custom Chrome executable if provided
      if (process.env.CHROME_EXECUTABLE_PATH) {
        options.setChromeBinaryPath(process.env.CHROME_EXECUTABLE_PATH);
      }

      // Set window size for headless mode
      options.addArguments('--window-size=1920,1080');

      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

      await this.driver.manage().setTimeouts({
        implicit: parseInt(process.env.WHATSAPP_TIMEOUT) || 30000,
        pageLoad: 60000,
        script: 30000
      });

      logger.whatsapp('WebDriver initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize WebDriver:', error);
      throw error;
    }
  }

  async connect() {
    try {
      if (!this.driver) {
        await this.initializeDriver();
      }

      logger.whatsapp('Connecting to WhatsApp Web...');
      await this.driver.get('https://web.whatsapp.com');

      // Update session status
      await this.database.createOrUpdateSession(this.sessionId, 'connecting');

      // Wait for either QR code or main page to load
      const timeout = 30000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        try {
          // Check if already logged in
          const chatElements = await this.driver.findElements(By.css('[data-testid="chat-list"]'));
          if (chatElements.length > 0) {
            await this.handleSuccessfulLogin();
            return { success: true, status: 'connected' };
          }

          // Check for QR code
          const qrElements = await this.driver.findElements(By.css('[data-ref]'));
          if (qrElements.length > 0) {
            await this.handleQRCode();
            return { success: true, status: 'qr_ready', qrCode: this.qrCode };
          }

          await this.driver.sleep(1000);
        } catch (error) {
          // Continue checking
        }
      }

      throw new Error('Timeout waiting for WhatsApp Web to load');

    } catch (error) {
      logger.error('Failed to connect to WhatsApp:', error);
      await this.database.updateSessionStatus(this.sessionId, 'error');
      throw error;
    }
  }

  async handleQRCode() {
    try {
      const qrElement = await this.driver.findElement(By.css('[data-ref]'));
      const qrDataRef = await qrElement.getAttribute('data-ref');
      
      if (qrDataRef) {
        // Generate QR code image
        this.qrCode = await QRCode.toDataURL(qrDataRef);
        
        // Update session with QR code
        await this.database.createOrUpdateSession(this.sessionId, 'qr_ready', this.qrCode);
        
        logger.whatsapp('QR code generated successfully');
        
        // Wait for login
        await this.waitForLogin();
      }
    } catch (error) {
      logger.error('Failed to handle QR code:', error);
      throw error;
    }
  }

  async waitForLogin() {
    try {
      logger.whatsapp('Waiting for QR code scan...');
      
      // Wait for chat list to appear (indicates successful login)
      await this.driver.wait(
        until.elementLocated(By.css('[data-testid="chat-list"]')),
        120000 // 2 minutes timeout
      );

      await this.handleSuccessfulLogin();
    } catch (error) {
      logger.error('Login timeout or failed:', error);
      await this.database.updateSessionStatus(this.sessionId, 'login_failed');
      throw error;
    }
  }

  async handleSuccessfulLogin() {
    try {
      this.isConnected = true;
      this.qrCode = null;
      this.lastActivity = new Date();

      // Try to get phone number
      try {
        await this.driver.sleep(3000); // Wait for page to fully load
        const profileButton = await this.driver.findElement(By.css('[data-testid="menu"]'));
        await profileButton.click();
        
        await this.driver.sleep(1000);
        const profileOption = await this.driver.findElement(By.css('[data-testid="menu-item-profile"]'));
        await profileOption.click();

        await this.driver.sleep(2000);
        const phoneElements = await this.driver.findElements(By.css('[data-testid="phone-number"]'));
        if (phoneElements.length > 0) {
          this.phoneNumber = await phoneElements[0].getText();
        }

        // Close profile
        await this.driver.findElement(By.css('[data-testid="x"]')).click();
      } catch (error) {
        logger.warn('Could not retrieve phone number:', error.message);
      }

      await this.database.createOrUpdateSession(this.sessionId, 'connected', null, this.phoneNumber);
      logger.whatsapp('Successfully connected to WhatsApp Web', { phoneNumber: this.phoneNumber });

      // Start processing message queue
      this.startQueueProcessor();
    } catch (error) {
      logger.error('Failed to handle successful login:', error);
    }
  }

  async sendMessage(phoneNumber, message) {
    try {
      if (!this.isConnected) {
        throw new Error('WhatsApp is not connected');
      }

      logger.whatsapp(`Sending message to ${phoneNumber}`);

      // Navigate to chat
      const chatUrl = `https://web.whatsapp.com/send?phone=${phoneNumber.replace(/\D/g, '')}`;
      await this.driver.get(chatUrl);

      // Wait for chat to load
      await this.driver.wait(
        until.elementLocated(By.css('[data-testid="conversation-compose-box-input"]')),
        15000
      );

      // Find message input and send message
      const messageInput = await this.driver.findElement(By.css('[data-testid="conversation-compose-box-input"]'));
      await messageInput.click();
      await messageInput.clear();
      await messageInput.sendKeys(message);
      await messageInput.sendKeys(Key.ENTER);

      // Wait for message to be sent
      await this.driver.sleep(2000);

      this.lastActivity = new Date();
      logger.whatsapp(`Message sent successfully to ${phoneNumber}`);
      
      return { success: true, timestamp: new Date() };
    } catch (error) {
      logger.error(`Failed to send message to ${phoneNumber}:`, error);
      throw error;
    }
  }

  async sendOTP(phoneNumber, otpCode, template = null) {
    try {
      const otpTemplate = template || process.env.OTP_TEMPLATE || 'Your OTP is: {otp}. Valid for {expiry} minutes.';
      const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || 5;
      
      const message = otpTemplate
        .replace('{otp}', otpCode)
        .replace('{expiry}', expiryMinutes);

      return await this.sendMessage(phoneNumber, message);
    } catch (error) {
      logger.error(`Failed to send OTP to ${phoneNumber}:`, error);
      throw error;
    }
  }

  addToQueue(phoneNumber, message) {
    this.messageQueue.push({
      id: uuidv4(),
      phoneNumber,
      message,
      timestamp: new Date(),
      attempts: 0
    });

    if (!this.isProcessingQueue) {
      this.startQueueProcessor();
    }
  }

  async startQueueProcessor() {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;
    logger.whatsapp('Started message queue processor');

    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      
      try {
        await this.sendMessage(message.phoneNumber, message.message);
        logger.whatsapp(`Queue message sent successfully: ${message.id}`);
      } catch (error) {
        message.attempts++;
        if (message.attempts < 3) {
          // Retry up to 3 times
          this.messageQueue.unshift(message);
          logger.warn(`Queue message failed, retrying: ${message.id}`, error);
        } else {
          logger.error(`Queue message failed after 3 attempts: ${message.id}`, error);
        }
      }

      // Wait between messages to avoid rate limiting
      await this.driver.sleep(2000);
    }

    this.isProcessingQueue = false;
    logger.whatsapp('Message queue processor stopped');
  }

  async getStatus() {
    return {
      sessionId: this.sessionId,
      isConnected: this.isConnected,
      phoneNumber: this.phoneNumber,
      lastActivity: this.lastActivity,
      queueLength: this.messageQueue.length,
      hasQRCode: !!this.qrCode
    };
  }

  async getQRCode() {
    return this.qrCode;
  }

  async checkConnection() {
    try {
      if (!this.driver || !this.isConnected) {
        return false;
      }

      // Check if WhatsApp Web is still loaded
      const title = await this.driver.getTitle();
      if (!title.includes('WhatsApp')) {
        this.isConnected = false;
        return false;
      }

      // Check if we're still logged in
      const chatElements = await this.driver.findElements(By.css('[data-testid="chat-list"]'));
      if (chatElements.length === 0) {
        this.isConnected = false;
        await this.database.updateSessionStatus(this.sessionId, 'disconnected');
        return false;
      }

      this.lastActivity = new Date();
      return true;
    } catch (error) {
      logger.error('Error checking connection:', error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    try {
      this.isConnected = false;
      this.messageQueue = [];
      this.isProcessingQueue = false;

      if (this.driver) {
        await this.driver.quit();
        this.driver = null;
      }

      await this.database.updateSessionStatus(this.sessionId, 'disconnected');
      logger.whatsapp('WhatsApp service disconnected');
    } catch (error) {
      logger.error('Error during disconnect:', error);
    }
  }

  async restart() {
    await this.disconnect();
    await this.connect();
  }
}

module.exports = WhatsAppService;