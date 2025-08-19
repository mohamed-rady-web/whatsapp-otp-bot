/**
 * WhatsApp OTP Bot Dashboard JavaScript
 * 
 * Handles all dashboard functionality including real-time updates,
 * API communication, chart rendering, and user interactions.
 */

class Dashboard {
    constructor() {
        this.config = {
            refreshInterval: 30000, // 30 seconds
            chartColors: {
                primary: '#25d366',
                success: '#28a745',
                danger: '#dc3545',
                warning: '#ffc107',
                info: '#17a2b8',
                secondary: '#6c757d'
            }
        };
        
        this.charts = {};
        this.intervals = {};
        this.qrCode = null;
        this.currentSection = 'overview';
        
        this.init();
    }

    async init() {
        try {
            // Initialize event listeners
            this.initEventListeners();
            
            // Load initial data
            await this.loadDashboardConfig();
            
            // Show dashboard and hide loading
            this.showDashboard();
            
            // Load initial section
            await this.loadSection('overview');
            
            // Start real-time updates
            this.startRealTimeUpdates();
            
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            this.showError('Failed to initialize dashboard');
        }
    }

    initEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.switchSection(section);
            });
        });

        // Header controls
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshCurrentSection();
        });

        document.getElementById('user-btn').addEventListener('click', () => {
            document.getElementById('user-dropdown').classList.toggle('show');
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // Period selectors
        document.getElementById('overview-period').addEventListener('change', (e) => {
            this.loadOverview(e.target.value);
        });

        document.getElementById('analytics-period').addEventListener('change', (e) => {
            this.loadAnalytics(e.target.value);
        });

        // WhatsApp controls
        document.getElementById('connect-btn').addEventListener('click', () => {
            this.connectWhatsApp();
        });

        document.getElementById('disconnect-btn').addEventListener('click', () => {
            this.disconnectWhatsApp();
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.restartWhatsApp();
        });

        document.getElementById('clear-sessions-btn').addEventListener('click', () => {
            this.clearSessions();
        });

        document.getElementById('screenshot-btn').addEventListener('click', () => {
            this.takeScreenshot();
        });

        // Message filters
        document.getElementById('apply-filters').addEventListener('click', () => {
            this.applyMessageFilters();
        });

        document.getElementById('export-messages').addEventListener('click', () => {
            this.exportMessages();
        });

        // API Key management
        document.getElementById('create-api-key-btn').addEventListener('click', () => {
            this.showCreateApiKeyModal();
        });

        // Log controls
        document.getElementById('refresh-logs').addEventListener('click', () => {
            this.refreshLogs();
        });

        document.getElementById('clear-logs').addEventListener('click', () => {
            this.clearLogsView();
        });

        // Modal controls
        this.initModalControls();

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu')) {
                document.getElementById('user-dropdown').classList.remove('show');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.refreshCurrentSection();
            }
        });
    }

    initModalControls() {
        // Create API Key modal
        document.getElementById('submit-api-key').addEventListener('click', () => {
            this.createApiKey();
        });

        document.getElementById('cancel-api-key').addEventListener('click', () => {
            this.hideModal('create-api-key-modal');
        });

        document.getElementById('close-api-key-modal').addEventListener('click', () => {
            this.hideModal('api-key-display-modal');
        });

        document.getElementById('copy-api-key').addEventListener('click', () => {
            this.copyApiKey();
        });

        // Close modals when clicking overlay
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideAllModals();
            }
        });

        // Close modals with escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
        });
    }

    showDashboard() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'grid';
    }

    async switchSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');

        this.currentSection = section;
        await this.loadSection(section);
    }

    async loadSection(section) {
        try {
            switch (section) {
                case 'overview':
                    await this.loadOverview();
                    break;
                case 'whatsapp':
                    await this.loadWhatsAppSection();
                    break;
                case 'messages':
                    await this.loadMessages();
                    break;
                case 'analytics':
                    await this.loadAnalytics();
                    break;
                case 'api-keys':
                    await this.loadApiKeys();
                    break;
                case 'system':
                    await this.loadSystemInfo();
                    break;
                case 'logs':
                    await this.loadLogs();
                    break;
            }
        } catch (error) {
            console.error(`Failed to load ${section} section:`, error);
            this.showError(`Failed to load ${section} data`);
        }
    }

    async loadDashboardConfig() {
        try {
            const response = await this.apiCall('/dashboard/api/config');
            if (response.success) {
                document.getElementById('version').textContent = `v${response.data.version}`;
            }
        } catch (error) {
            console.warn('Failed to load dashboard config:', error);
        }
    }

    async loadOverview(period = '24h') {
        try {
            const response = await this.apiCall(`/dashboard/api/overview?period=${period}`);
            if (response.success) {
                this.updateOverviewStats(response.data);
                this.updateOverviewCharts(response.data);
                this.updateRecentActivity(response.data.recentActivity);
            }
        } catch (error) {
            console.error('Failed to load overview:', error);
        }
    }

    updateOverviewStats(data) {
        const summary = data.summary;
        
        document.getElementById('total-messages').textContent = this.formatNumber(summary.totalMessages);
        document.getElementById('delivered-messages').textContent = this.formatNumber(summary.deliveredMessages);
        document.getElementById('success-rate').textContent = `${summary.successRate}%`;
        document.getElementById('active-sessions').textContent = summary.activeSessions;

        // Update connection status
        this.updateConnectionStatus(data.whatsapp);
    }

    updateOverviewCharts(data) {
        // Messages chart
        this.createOrUpdateChart('messages-chart', {
            type: 'line',
            data: {
                labels: data.charts.dailyMessages.map(item => this.formatDate(item.date)),
                datasets: [{
                    label: 'Delivered',
                    data: data.charts.dailyMessages.map(item => item.delivered),
                    borderColor: this.config.chartColors.success,
                    backgroundColor: this.config.chartColors.success + '20',
                    tension: 0.4
                }, {
                    label: 'Failed',
                    data: data.charts.dailyMessages.map(item => item.failed),
                    borderColor: this.config.chartColors.danger,
                    backgroundColor: this.config.chartColors.danger + '20',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Success rate chart
        this.createOrUpdateChart('success-rate-chart', {
            type: 'line',
            data: {
                labels: data.charts.dailyMessages.map(item => this.formatDate(item.date)),
                datasets: [{
                    label: 'Success Rate (%)',
                    data: data.charts.dailyMessages.map(item => item.successRate),
                    borderColor: this.config.chartColors.primary,
                    backgroundColor: this.config.chartColors.primary + '20',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    updateRecentActivity(activities) {
        const container = document.getElementById('recent-activity');
        
        if (!activities || activities.length === 0) {
            container.innerHTML = '<p class="text-center" style="color: #666;">No recent activity</p>';
            return;
        }

        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas ${this.getActivityIcon(activity.status)}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">Message to ${activity.phone}</div>
                    <div class="activity-meta">
                        ${this.formatDateTime(activity.sentAt)} • 
                        <span class="status-badge-small status-${activity.status}">${activity.status}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async loadWhatsAppSection() {
        try {
            const [statusResponse, sessionsResponse] = await Promise.all([
                this.apiCall('/api/status'),
                this.apiCall('/api/sessions')
            ]);

            if (statusResponse.success) {
                this.updateWhatsAppStatus(statusResponse.data);
            }

            if (sessionsResponse.success) {
                this.updateSessionsList(sessionsResponse.data);
            }

            // Try to load QR code if awaiting scan
            if (statusResponse.data.status === 'awaiting_scan') {
                this.loadQrCode();
            }
        } catch (error) {
            console.error('Failed to load WhatsApp section:', error);
        }
    }

    updateWhatsAppStatus(data) {
        const statusElement = document.getElementById('whatsapp-status');
        const sessionIdElement = document.getElementById('session-id');
        const connectedPhoneElement = document.getElementById('connected-phone');
        const lastActivityElement = document.getElementById('last-activity');
        const uptimeElement = document.getElementById('session-uptime');

        statusElement.textContent = this.capitalize(data.status);
        statusElement.className = `status-badge ${data.status}`;

        if (data.session) {
            sessionIdElement.textContent = data.session.sessionId || '-';
            connectedPhoneElement.textContent = data.session.connectedPhone || '-';
            lastActivityElement.textContent = data.session.lastActivity 
                ? this.formatDateTime(data.session.lastActivity) 
                : '-';
            
            if (data.session.createdAt) {
                const uptime = this.calculateUptime(data.session.createdAt);
                uptimeElement.textContent = uptime;
            }
        } else {
            sessionIdElement.textContent = '-';
            connectedPhoneElement.textContent = '-';
            lastActivityElement.textContent = '-';
            uptimeElement.textContent = '-';
        }

        this.updateConnectionStatus(data);
    }

    updateConnectionStatus(data) {
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');

        indicator.className = `status-indicator ${data.status}`;
        text.textContent = this.capitalize(data.status);
    }

    async loadQrCode() {
        try {
            const response = await this.apiCall('/api/qr');
            if (response.success) {
                this.displayQrCode(response.data.qrCode);
            }
        } catch (error) {
            console.warn('Failed to load QR code:', error);
            this.showQrPlaceholder();
        }
    }

    displayQrCode(qrCodeData) {
        const canvas = document.getElementById('qr-code');
        const placeholder = document.getElementById('qr-placeholder');

        if (qrCodeData) {
            placeholder.style.display = 'none';
            canvas.style.display = 'block';

            // Use QRious library to generate QR code
            if (window.QRious) {
                this.qrCode = new QRious({
                    element: canvas,
                    value: qrCodeData,
                    size: 200,
                    level: 'M'
                });
            } else {
                // Fallback: display as image
                const img = new Image();
                img.onload = () => {
                    const ctx = canvas.getContext('2d');
                    canvas.width = 200;
                    canvas.height = 200;
                    ctx.drawImage(img, 0, 0, 200, 200);
                };
                img.src = qrCodeData;
            }
        } else {
            this.showQrPlaceholder();
        }
    }

    showQrPlaceholder() {
        document.getElementById('qr-placeholder').style.display = 'flex';
        document.getElementById('qr-code').style.display = 'none';
    }

    async connectWhatsApp() {
        try {
            this.showLoading('connect-btn');
            const response = await this.apiCall('/api/connect', 'POST');
            
            if (response.success) {
                this.showSuccess('WhatsApp connection initiated');
                await this.loadWhatsAppSection();
            } else {
                this.showError(response.error || 'Failed to connect');
            }
        } catch (error) {
            this.showError('Connection failed: ' + error.message);
        } finally {
            this.hideLoading('connect-btn');
        }
    }

    async disconnectWhatsApp() {
        try {
            this.showLoading('disconnect-btn');
            const response = await this.apiCall('/api/disconnect', 'POST');
            
            if (response.success) {
                this.showSuccess('WhatsApp disconnected');
                await this.loadWhatsAppSection();
            } else {
                this.showError(response.error || 'Failed to disconnect');
            }
        } catch (error) {
            this.showError('Disconnect failed: ' + error.message);
        } finally {
            this.hideLoading('disconnect-btn');
        }
    }

    async restartWhatsApp() {
        try {
            this.showLoading('restart-btn');
            const response = await this.apiCall('/api/restart', 'POST');
            
            if (response.success) {
                this.showSuccess('WhatsApp connection restarted');
                await this.loadWhatsAppSection();
            } else {
                this.showError(response.error || 'Failed to restart');
            }
        } catch (error) {
            this.showError('Restart failed: ' + error.message);
        } finally {
            this.hideLoading('restart-btn');
        }
    }

    async clearSessions() {
        if (!confirm('Are you sure you want to clear all sessions? This action cannot be undone.')) {
            return;
        }

        try {
            this.showLoading('clear-sessions-btn');
            const response = await this.apiCall('/api/sessions/clear', 'POST');
            
            if (response.success) {
                this.showSuccess('All sessions cleared');
                await this.loadWhatsAppSection();
            } else {
                this.showError(response.error || 'Failed to clear sessions');
            }
        } catch (error) {
            this.showError('Clear sessions failed: ' + error.message);
        } finally {
            this.hideLoading('clear-sessions-btn');
        }
    }

    async takeScreenshot() {
        try {
            this.showLoading('screenshot-btn');
            const response = await this.apiCall('/api/screenshot');
            
            if (response.success) {
                this.showSuccess('Screenshot captured: ' + response.data.filename);
            } else {
                this.showError(response.error || 'Failed to take screenshot');
            }
        } catch (error) {
            this.showError('Screenshot failed: ' + error.message);
        } finally {
            this.hideLoading('screenshot-btn');
        }
    }

    async loadMessages() {
        try {
            const filters = this.getMessageFilters();
            const queryString = new URLSearchParams(filters).toString();
            const response = await this.apiCall(`/api/messages?${queryString}`);
            
            if (response.success) {
                this.updateMessagesTable(response.data);
                this.updateMessagesPagination(response.pagination);
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    getMessageFilters() {
        return {
            status: document.getElementById('status-filter').value,
            dateFrom: document.getElementById('date-from').value,
            dateTo: document.getElementById('date-to').value,
            page: 1,
            limit: 50
        };
    }

    updateMessagesTable(messages) {
        const tbody = document.getElementById('messages-table-body');
        
        if (!messages || messages.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No messages found</td></tr>';
            return;
        }

        tbody.innerHTML = messages.map(msg => `
            <tr>
                <td>${this.formatDateTime(msg.sentAt)}</td>
                <td>${msg.phone}</td>
                <td><span class="status-badge-small status-${msg.status}">${msg.status}</span></td>
                <td>${this.truncateText(msg.message, 50)}</td>
                <td>${msg.apiKeyName || 'Unknown'}</td>
                <td>${msg.attempts}</td>
            </tr>
        `).join('');
    }

    updateMessagesPagination(pagination) {
        const container = document.getElementById('messages-pagination');
        
        if (pagination.pages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        
        // Previous button
        html += `<button ${pagination.page <= 1 ? 'disabled' : ''} onclick="dashboard.loadMessagesPage(${pagination.page - 1})">Previous</button>`;
        
        // Page numbers
        for (let i = 1; i <= Math.min(pagination.pages, 10); i++) {
            html += `<button class="${pagination.page === i ? 'active' : ''}" onclick="dashboard.loadMessagesPage(${i})">${i}</button>`;
        }
        
        // Next button
        html += `<button ${pagination.page >= pagination.pages ? 'disabled' : ''} onclick="dashboard.loadMessagesPage(${pagination.page + 1})">Next</button>`;
        
        container.innerHTML = html;
    }

    async loadMessagesPage(page) {
        const filters = this.getMessageFilters();
        filters.page = page;
        const queryString = new URLSearchParams(filters).toString();
        
        try {
            const response = await this.apiCall(`/api/messages?${queryString}`);
            if (response.success) {
                this.updateMessagesTable(response.data);
                this.updateMessagesPagination(response.pagination);
            }
        } catch (error) {
            this.showError('Failed to load messages page');
        }
    }

    applyMessageFilters() {
        this.loadMessages();
    }

    async exportMessages() {
        try {
            const filters = this.getMessageFilters();
            const queryString = new URLSearchParams({...filters, format: 'csv'}).toString();
            
            // Create download link
            const link = document.createElement('a');
            link.href = `/api/export?type=messages&${queryString}`;
            link.download = `messages_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showSuccess('Messages export started');
        } catch (error) {
            this.showError('Export failed: ' + error.message);
        }
    }

    async loadAnalytics(period = '7d') {
        try {
            const response = await this.apiCall(`/dashboard/api/analytics?type=messages&period=${period}`);
            if (response.success) {
                this.updateAnalyticsCharts(response.data);
            }
        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }

    updateAnalyticsCharts(data) {
        // Performance chart
        this.createOrUpdateChart('performance-chart', {
            type: 'doughnut',
            data: {
                labels: ['Delivered', 'Failed'],
                datasets: [{
                    data: [data.summary.deliveredMessages, data.summary.failedMessages],
                    backgroundColor: [this.config.chartColors.success, this.config.chartColors.danger]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        // Volume chart
        if (data.dailyStats) {
            this.createOrUpdateChart('volume-chart', {
                type: 'bar',
                data: {
                    labels: data.dailyStats.map(item => this.formatDate(item.date)),
                    datasets: [{
                        label: 'Messages',
                        data: data.dailyStats.map(item => item.total),
                        backgroundColor: this.config.chartColors.primary
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    async loadApiKeys() {
        try {
            const response = await this.apiCall('/api/auth/keys');
            if (response.success) {
                this.updateApiKeysList(response.data);
            }
        } catch (error) {
            console.error('Failed to load API keys:', error);
        }
    }

    updateApiKeysList(apiKeys) {
        const container = document.getElementById('api-keys-list');
        
        if (!apiKeys || apiKeys.length === 0) {
            container.innerHTML = '<p class="text-center">No API keys found</p>';
            return;
        }

        container.innerHTML = apiKeys.map(key => `
            <div class="api-key-card">
                <div class="api-key-info">
                    <h4>${key.name}</h4>
                    <div class="api-key-meta">
                        Created: ${this.formatDateTime(key.createdAt)} • 
                        Rate Limit: ${key.rateLimit}/15min • 
                        Permissions: ${key.permissions.join(', ')} • 
                        <span class="status-badge-small ${key.isActive ? 'status-delivered' : 'status-failed'}">
                            ${key.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
                <div class="api-key-actions">
                    <button class="btn btn-info btn-sm" onclick="dashboard.viewApiKeyStats(${key.id})">
                        <i class="fas fa-chart-bar"></i> Stats
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="dashboard.editApiKey(${key.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="dashboard.deleteApiKey(${key.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    showCreateApiKeyModal() {
        this.showModal('create-api-key-modal');
    }

    async createApiKey() {
        try {
            const formData = {
                name: document.getElementById('api-key-name').value,
                permissions: Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value),
                rateLimit: parseInt(document.getElementById('api-key-rate-limit').value)
            };

            if (!formData.name) {
                this.showError('Please enter a name for the API key');
                return;
            }

            this.showLoading('submit-api-key');
            const response = await this.apiCall('/api/auth/generate-key', 'POST', formData);
            
            if (response.success) {
                this.hideModal('create-api-key-modal');
                this.displayGeneratedApiKey(response.data.apiKey);
                this.loadApiKeys(); // Refresh the list
            } else {
                this.showError(response.error || 'Failed to create API key');
            }
        } catch (error) {
            this.showError('Create API key failed: ' + error.message);
        } finally {
            this.hideLoading('submit-api-key');
        }
    }

    displayGeneratedApiKey(apiKey) {
        document.getElementById('generated-api-key').value = apiKey;
        this.showModal('api-key-display-modal');
    }

    copyApiKey() {
        const input = document.getElementById('generated-api-key');
        input.select();
        document.execCommand('copy');
        this.showSuccess('API key copied to clipboard');
    }

    async loadSystemInfo() {
        try {
            const response = await this.apiCall('/dashboard/api/health');
            if (response.success) {
                this.updateSystemHealth(response.data);
            }
        } catch (error) {
            console.error('Failed to load system info:', error);
        }
    }

    updateSystemHealth(data) {
        // Update health indicators
        const healthContainer = document.getElementById('health-indicators');
        healthContainer.innerHTML = `
            <div class="health-item ${data.status}">
                <span>Overall Status</span>
                <span>${this.capitalize(data.status)}</span>
            </div>
            <div class="health-item ${data.metrics.memory.percentage > 80 ? 'warning' : 'healthy'}">
                <span>Memory</span>
                <span>${data.metrics.memory.used}MB / ${data.metrics.memory.total}MB</span>
            </div>
            <div class="health-item ${data.metrics.cpu.loadAverage > 1.0 ? 'warning' : 'healthy'}">
                <span>CPU Load</span>
                <span>${data.metrics.cpu.loadAverage.toFixed(2)}</span>
            </div>
            <div class="health-item ${data.whatsapp.status === 'connected' ? 'healthy' : 'warning'}">
                <span>WhatsApp</span>
                <span>${this.capitalize(data.whatsapp.status)}</span>
            </div>
        `;

        // Update resource meters
        this.updateResourceMeter('memory-usage', 'memory-text', data.metrics.memory.percentage, `${data.metrics.memory.percentage}%`);
        this.updateResourceMeter('cpu-usage', 'cpu-text', Math.min(data.metrics.cpu.loadAverage * 50, 100), `${data.metrics.cpu.loadAverage.toFixed(2)}`);

        // Update system info
        const sysInfoContainer = document.getElementById('system-info');
        sysInfoContainer.innerHTML = `
            <p><strong>Uptime:</strong> ${this.formatUptime(data.metrics.uptime)}</p>
            <p><strong>Node Version:</strong> ${data.metrics.nodeVersion}</p>
            <p><strong>Platform:</strong> ${data.metrics.platform}</p>
            <p><strong>CPU Cores:</strong> ${data.metrics.cpu.cores}</p>
        `;
    }

    updateResourceMeter(barId, textId, percentage, text) {
        const bar = document.getElementById(barId);
        const textEl = document.getElementById(textId);
        
        bar.style.width = `${percentage}%`;
        bar.className = `progress ${percentage > 80 ? 'danger' : percentage > 60 ? 'warning' : ''}`;
        textEl.textContent = text;
    }

    async loadLogs() {
        try {
            const level = document.getElementById('log-level').value;
            const service = document.getElementById('log-service').value;
            const params = new URLSearchParams({ level, service, lines: 100 });
            
            const response = await this.apiCall(`/api/logs?${params}`);
            if (response.success) {
                this.updateLogsDisplay(response.data.logs);
            }
        } catch (error) {
            console.error('Failed to load logs:', error);
        }
    }

    updateLogsDisplay(logs) {
        const container = document.getElementById('logs-output');
        
        if (!logs || logs.length === 0) {
            container.innerHTML = '<div class="log-entry">No logs available</div>';
            return;
        }

        container.innerHTML = logs.map(log => `
            <div class="log-entry ${log.level}">
                [${this.formatDateTime(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}
            </div>
        `).join('');
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    refreshLogs() {
        this.loadLogs();
    }

    clearLogsView() {
        document.getElementById('logs-output').innerHTML = '';
    }

    startRealTimeUpdates() {
        // Update connection status every 10 seconds
        this.intervals.connectionStatus = setInterval(() => {
            this.updateRealTimeStatus();
        }, 10000);

        // Refresh current section every 30 seconds
        this.intervals.sectionRefresh = setInterval(() => {
            if (this.currentSection === 'overview' || this.currentSection === 'whatsapp') {
                this.refreshCurrentSection();
            }
        }, this.config.refreshInterval);
    }

    async updateRealTimeStatus() {
        try {
            const response = await this.apiCall('/dashboard/api/metrics');
            if (response.success) {
                this.updateConnectionStatus(response.data.whatsapp);
                
                // Update QR code if status changed to awaiting_scan
                if (response.data.whatsapp.status === 'awaiting_scan' && this.currentSection === 'whatsapp') {
                    this.loadQrCode();
                }
            }
        } catch (error) {
            console.warn('Failed to update real-time status:', error);
        }
    }

    refreshCurrentSection() {
        this.loadSection(this.currentSection);
    }

    createOrUpdateChart(canvasId, config) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Destroy existing chart
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        // Create new chart
        this.charts[canvasId] = new Chart(canvas, config);
    }

    // API Communication
    async apiCall(endpoint, method = 'GET', data = null) {
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(endpoint, options);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }

            return result;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    // Utility Methods
    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString();
    }

    formatDateTime(dateString) {
        return new Date(dateString).toLocaleString();
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    calculateUptime(startTime) {
        const start = new Date(startTime);
        const now = new Date();
        const seconds = Math.floor((now - start) / 1000);
        return this.formatUptime(seconds);
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    truncateText(text, length) {
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    getActivityIcon(status) {
        switch (status) {
            case 'delivered': return 'fa-check-circle';
            case 'failed': return 'fa-times-circle';
            case 'pending': return 'fa-clock';
            default: return 'fa-circle';
        }
    }

    // UI Helper Methods
    showModal(modalId) {
        document.getElementById('modal-overlay').classList.add('show');
        document.getElementById(modalId).style.display = 'block';
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        document.getElementById('modal-overlay').classList.remove('show');
    }

    hideAllModals() {
        document.getElementById('modal-overlay').classList.remove('show');
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    showLoading(buttonId) {
        const button = document.getElementById(buttonId);
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    }

    hideLoading(buttonId) {
        const button = document.getElementById(buttonId);
        button.disabled = false;
        // Restore original content - this is simplified
        button.innerHTML = button.dataset.originalContent || 'Submit';
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.parentNode.removeChild(notification);
        });
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            // Clear any stored auth data
            localStorage.clear();
            sessionStorage.clear();
            
            // Redirect to login or reload page
            window.location.reload();
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});

// Add notification styles
const notificationStyles = `
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    z-index: 10000;
    min-width: 300px;
    animation: slideInRight 0.3s ease;
}

.notification-success {
    border-left: 4px solid #28a745;
}

.notification-error {
    border-left: 4px solid #dc3545;
}

.notification-info {
    border-left: 4px solid #17a2b8;
}

.notification-close {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #666;
    margin-left: auto;
}

@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
`;

// Inject notification styles
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);