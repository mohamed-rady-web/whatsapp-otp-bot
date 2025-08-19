/**
 * Selenium WebDriver Configuration
 * 
 * Chrome/Chromium WebDriver setup with headless mode,
 * user data persistence, and optimized settings for WhatsApp Web.
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

class SeleniumConfig {
    constructor() {
        this.driver = null;
        this.userDataDir = process.env.CHROME_USER_DATA_DIR || path.join(__dirname, '../../data/chrome-user-data');
        this.isHeadless = process.env.CHROME_HEADLESS === 'true';
        this.sessionPath = process.env.WHATSAPP_SESSION_PATH || path.join(__dirname, '../../data/sessions');
    }

    /**
     * Create and configure Chrome WebDriver
     */
    async createDriver() {
        try {
            // Ensure directories exist
            this.ensureDirectories();

            // Configure Chrome options
            const options = this.getChromeOptions();

            // Create WebDriver instance
            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();

            // Configure timeouts
            await this.driver.manage().setTimeouts({
                implicit: 30000,
                pageLoad: 60000,
                script: 30000
            });

            // Set window size for consistent behavior
            if (this.isHeadless) {
                await this.driver.manage().window().setRect({
                    width: 1366,
                    height: 768
                });
            } else {
                await this.driver.manage().window().maximize();
            }

            logger.info('Chrome WebDriver created successfully', {
                headless: this.isHeadless,
                userDataDir: this.userDataDir
            });

            return this.driver;

        } catch (error) {
            logger.error('Failed to create Chrome WebDriver:', error);
            throw new Error(`WebDriver creation failed: ${error.message}`);
        }
    }

    /**
     * Get Chrome options configuration
     */
    getChromeOptions() {
        const options = new chrome.Options();

        // Basic Chrome arguments
        const chromeArgs = [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images',
            '--disable-javascript-harmony-shipping',
            '--disable-javascript-harmony',
            '--disable-setuid-sandbox',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-default-apps',
            '--disable-popup-blocking',
            '--disable-translate',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-device-discovery-notifications',
            '--disable-background-networking',
            '--disable-sync',
            '--metrics-recording-only',
            '--no-report-upload',
            '--disable-gpu-memory-buffer-video-frames',
            '--disable-canvas-aa',
            '--disable-3d-apis',
            '--disable-webgl',
            '--disable-shared-workers',
            '--disable-speech-api',
            '--disable-file-system',
            '--disable-web-app-auto-reload',
            '--disable-accelerated-2d-canvas',
            '--disable-accelerated-jpeg-decoding',
            '--disable-accelerated-mjpeg-decode',
            '--disable-accelerated-video-decode',
            '--disable-gpu-compositing',
            '--disable-gpu-rasterization',
            '--disable-partial-raster'
        ];

        // Add headless mode if enabled
        if (this.isHeadless) {
            chromeArgs.push('--headless=new');
            chromeArgs.push('--disable-gpu');
            chromeArgs.push('--window-size=1366,768');
        }

        // Set user data directory for session persistence
        chromeArgs.push(`--user-data-dir=${this.userDataDir}`);

        // Apply all arguments
        chromeArgs.forEach(arg => options.addArguments(arg));

        // Set preferences
        const prefs = {
            'profile.default_content_setting_values': {
                'notifications': 2,
                'media_stream': 2,
                'media_stream_mic': 2,
                'media_stream_camera': 2,
                'geolocation': 2
            },
            'profile.default_content_settings': {
                'popups': 0
            },
            'profile.managed_default_content_settings': {
                'images': 2
            },
            'profile.content_settings.exceptions.automatic_downloads.*.setting': 2
        };

        options.setUserPreferences(prefs);

        // Exclude automation switches to avoid detection
        options.excludeSwitches(['enable-automation', 'enable-logging']);

        // Add experimental options
        options.addArguments('--disable-blink-features=AutomationControlled');
        options.setExperimentalOption('excludeSwitches', ['enable-automation']);
        options.setExperimentalOption('useAutomationExtension', false);

        return options;
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        const directories = [this.userDataDir, this.sessionPath];
        
        directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logger.info(`Created directory: ${dir}`);
            }
        });
    }

    /**
     * Navigate to WhatsApp Web
     */
    async navigateToWhatsApp() {
        if (!this.driver) {
            throw new Error('WebDriver not initialized');
        }

        try {
            logger.info('Navigating to WhatsApp Web');
            await this.driver.get('https://web.whatsapp.com');
            
            // Wait for page to load
            await this.driver.wait(
                until.titleContains('WhatsApp'),
                30000,
                'WhatsApp Web page did not load within 30 seconds'
            );

            logger.info('Successfully navigated to WhatsApp Web');
            return true;

        } catch (error) {
            logger.error('Failed to navigate to WhatsApp Web:', error);
            throw error;
        }
    }

    /**
     * Wait for element with custom timeout
     */
    async waitForElement(locator, timeout = 30000, message = '') {
        if (!this.driver) {
            throw new Error('WebDriver not initialized');
        }

        try {
            const element = await this.driver.wait(
                until.elementLocated(locator),
                timeout,
                message || `Element not found within ${timeout}ms: ${locator}`
            );
            return element;
        } catch (error) {
            logger.error(`Failed to find element: ${locator}`, error);
            throw error;
        }
    }

    /**
     * Check if element exists without throwing error
     */
    async elementExists(locator, timeout = 5000) {
        if (!this.driver) {
            return false;
        }

        try {
            await this.driver.wait(until.elementLocated(locator), timeout);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Take screenshot for debugging
     */
    async takeScreenshot(filename) {
        if (!this.driver) {
            throw new Error('WebDriver not initialized');
        }

        try {
            const screenshot = await this.driver.takeScreenshot();
            const screenshotPath = path.join(this.sessionPath, `${filename}.png`);
            fs.writeFileSync(screenshotPath, screenshot, 'base64');
            logger.info(`Screenshot saved: ${screenshotPath}`);
            return screenshotPath;
        } catch (error) {
            logger.error('Failed to take screenshot:', error);
            throw error;
        }
    }

    /**
     * Execute JavaScript in browser
     */
    async executeScript(script, ...args) {
        if (!this.driver) {
            throw new Error('WebDriver not initialized');
        }

        try {
            return await this.driver.executeScript(script, ...args);
        } catch (error) {
            logger.error('Failed to execute script:', error);
            throw error;
        }
    }

    /**
     * Clear browser data (except user data directory)
     */
    async clearBrowserData() {
        if (!this.driver) {
            return;
        }

        try {
            // Clear cookies, local storage, and session storage
            await this.driver.manage().deleteAllCookies();
            
            await this.executeScript(`
                try {
                    localStorage.clear();
                    sessionStorage.clear();
                } catch (e) {
                    console.log('Error clearing storage:', e);
                }
            `);

            logger.info('Browser data cleared');
        } catch (error) {
            logger.warn('Failed to clear browser data:', error);
        }
    }

    /**
     * Close WebDriver
     */
    async closeDriver() {
        if (this.driver) {
            try {
                await this.driver.quit();
                this.driver = null;
                logger.info('WebDriver closed successfully');
            } catch (error) {
                logger.error('Error closing WebDriver:', error);
            }
        }
    }

    /**
     * Get current page URL
     */
    async getCurrentUrl() {
        if (!this.driver) {
            throw new Error('WebDriver not initialized');
        }
        return await this.driver.getCurrentUrl();
    }

    /**
     * Refresh current page
     */
    async refresh() {
        if (!this.driver) {
            throw new Error('WebDriver not initialized');
        }
        await this.driver.navigate().refresh();
    }

    /**
     * Check if WebDriver is active
     */
    isDriverActive() {
        return this.driver !== null;
    }
}

module.exports = SeleniumConfig;