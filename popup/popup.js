// Popup script cho HideBox Chrome Extension
class HideBoxPopup {
    constructor() {
        this.currentDomain = '';
        this.domainRules = [];
        this.isSelectionMode = false;
        this.snoozeTimeout = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadCurrentDomain();
    }

    initializeElements() {
        // Main controls
        this.toggleSelectionBtn = document.getElementById('toggle-selection');
        this.snoozeBtn = document.getElementById('snooze-btn');
        this.snoozeDropdown = document.getElementById('snooze-dropdown');
        
        // Rules list
        this.rulesList = document.getElementById('rules-list');
        this.emptyState = document.getElementById('empty-state');
        this.ruleCount = document.getElementById('rule-count');
        
        // Domain settings
        this.applySubdomainsCheckbox = document.getElementById('apply-subdomains');
        this.currentDomainSpan = document.getElementById('current-domain');
        
        // Action buttons
        this.exportBtn = document.getElementById('export-btn');
        this.importBtn = document.getElementById('import-btn');
        this.clearDomainBtn = document.getElementById('clear-domain-btn');
        this.importFileInput = document.getElementById('import-file-input');
        
        // Status
        this.statusMessage = document.getElementById('status-message');
        
        // Template
        this.ruleItemTemplate = document.getElementById('rule-item-template');
    }

    attachEventListeners() {
        // Toggle selection mode
        this.toggleSelectionBtn.addEventListener('click', () => {
            this.toggleSelectionMode();
        });

        // Snooze functionality
        this.snoozeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSnoozeDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.snoozeBtn.contains(e.target) && !this.snoozeDropdown.contains(e.target)) {
                this.snoozeDropdown.classList.remove('show');
            }
        });

        // Snooze options
        this.snoozeDropdown.addEventListener('click', (e) => {
            if (e.target.hasAttribute('data-minutes')) {
                const minutes = parseInt(e.target.getAttribute('data-minutes'));
                this.snoozeDomain(minutes);
                this.snoozeDropdown.classList.remove('show');
            }
        });

        // Domain settings
        this.applySubdomainsCheckbox.addEventListener('change', () => {
            this.updateDomainSettings();
        });

        // Export/Import
        this.exportBtn.addEventListener('click', () => {
            this.exportConfiguration();
        });

        this.importBtn.addEventListener('click', () => {
            this.importFileInput.click();
        });

        this.importFileInput.addEventListener('change', (e) => {
            this.importConfiguration(e);
        });

        // Clear domain
        this.clearDomainBtn.addEventListener('click', () => {
            this.clearDomainRules();
        });

        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
    }

    async loadCurrentDomain() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.url) {
                const url = new URL(tab.url);
                this.currentDomain = url.hostname;
                this.currentDomainSpan.textContent = this.currentDomain;
                
                await this.loadDomainData();
                await this.checkSelectionMode();
            }
        } catch (error) {
            console.error('Error loading current domain:', error);
            this.showStatus('Không thể tải thông tin domain', 'error');
        }
    }

    async loadDomainData() {
        try {
            const result = await chrome.storage.sync.get(['domains']);
            const domains = result.domains || {};
            const domainData = domains[this.currentDomain] || {
                applyToSubdomains: false,
                rules: [],
                updatedAt: Date.now()
            };

            this.domainRules = domainData.rules || [];
            this.applySubdomainsCheckbox.checked = domainData.applyToSubdomains || false;
            
            this.renderRulesList();
            this.updateRuleCount();
        } catch (error) {
            console.error('Error loading domain data:', error);
            this.showStatus('Lỗi khi tải dữ liệu domain', 'error');
        }
    }

    async saveDomainData() {
        try {
            const result = await chrome.storage.sync.get(['domains']);
            const domains = result.domains || {};
            
            domains[this.currentDomain] = {
                applyToSubdomains: this.applySubdomainsCheckbox.checked,
                rules: this.domainRules,
                updatedAt: Date.now()
            };

            await chrome.storage.sync.set({ domains });
            
            // Notify content script to update rules
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
                await this.ensureContentScriptReady(tab.id);
                chrome.tabs.sendMessage(tab.id, {
                    action: 'updateRules',
                    domain: this.currentDomain,
                    rules: this.domainRules.filter(rule => rule.enabled)
                }).catch(error => {
                    console.warn('Failed to send rules update:', error);
                });
            }
        } catch (error) {
            console.error('Error saving domain data:', error);
            this.showStatus('Lỗi khi lưu dữ liệu', 'error');
        }
    }

    async toggleSelectionMode() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            // Ensure content script is injected before sending message
            await this.ensureContentScriptReady(tab.id);

            this.isSelectionMode = !this.isSelectionMode;
            
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'toggleSelectionMode',
                enabled: this.isSelectionMode
            }).catch(error => {
                console.warn('Failed to send toggle message:', error);
                return null;
            });

            this.updateSelectionButton();
        } catch (error) {
            console.error('Error toggling selection mode:', error);
            this.showStatus('Lỗi khi chuyển chế độ chọn', 'error');
        }
    }

    async ensureContentScriptReady(tabId) {
        try {
            // Test if content script is already injected
            const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' }).catch(() => null);
            if (response) {
                return true; // Already ready
            }
        } catch (error) {
            // Content script not ready, request injection via background
        }

        // Request background to inject content script
        try {
            await chrome.runtime.sendMessage({
                action: 'ensureContentScript',
                tabId: tabId
            });
            
            // Wait a bit for injection to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Test again
            const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' }).catch(() => null);
            return !!response;
        } catch (error) {
            console.warn('Failed to ensure content script ready:', error);
            return false;
        }
    }

    async checkSelectionMode() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            await this.ensureContentScriptReady(tab.id);

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'getSelectionMode'
            }).catch(() => null);

            if (response && typeof response.enabled === 'boolean') {
                this.isSelectionMode = response.enabled;
                this.updateSelectionButton();
            }
        } catch (error) {
            console.error('Error checking selection mode:', error);
        }
    }

    updateSelectionButton() {
        const icon = this.toggleSelectionBtn.querySelector('.btn-icon');
        const text = this.toggleSelectionBtn.querySelector('.btn-text');
        
        if (this.isSelectionMode) {
            icon.textContent = '⏹️';
            text.textContent = 'Tắt chế độ chọn';
            this.toggleSelectionBtn.style.background = '#dc3545';
        } else {
            icon.textContent = '🎯';
            text.textContent = 'Bật chế độ chọn';
            this.toggleSelectionBtn.style.background = '';
        }
    }

    toggleSnoozeDropdown() {
        this.snoozeDropdown.classList.toggle('show');
    }

    async snoozeDomain(minutes) {
        try {
            const until = Date.now() + (minutes * 60 * 1000);
            
            const result = await chrome.storage.local.get(['snooze']);
            const snooze = result.snooze || {};
            snooze[this.currentDomain] = until;
            
            await chrome.storage.local.set({ snooze });
            
            // Notify content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
                await this.ensureContentScriptReady(tab.id);
                chrome.tabs.sendMessage(tab.id, {
                    action: 'snoozeDomain',
                    minutes: minutes
                }).catch(error => {
                    console.warn('Failed to notify content script about snooze:', error);
                });
            }
            
            this.showStatus(`Đã tạm ngưng ${minutes} phút cho ${this.currentDomain}`, 'success');
        } catch (error) {
            console.error('Error snoozing domain:', error);
            this.showStatus('Lỗi khi tạm ngưng domain', 'error');
        }
    }

    renderRulesList() {
        this.rulesList.innerHTML = '';
        
        if (this.domainRules.length === 0) {
            this.emptyState.style.display = 'block';
            return;
        }
        
        this.emptyState.style.display = 'none';
        
        this.domainRules.forEach((rule, index) => {
            const ruleElement = this.createRuleElement(rule, index);
            this.rulesList.appendChild(ruleElement);
        });
    }

    createRuleElement(rule, index) {
        const template = this.ruleItemTemplate.content.cloneNode(true);
        const ruleElement = template.querySelector('.rule-item');
        
        ruleElement.setAttribute('data-rule-id', rule.id);
        if (!rule.enabled) {
            ruleElement.classList.add('disabled');
        }
        
        // Fill rule information
        const selectorSpan = ruleElement.querySelector('.rule-selector');
        const noteSpan = ruleElement.querySelector('.rule-note');
        const tagSpan = ruleElement.querySelector('.rule-tag');
        
        selectorSpan.textContent = rule.selector;
        noteSpan.textContent = rule.note || 'Không có ghi chú';
        tagSpan.textContent = this.getElementTagFromSelector(rule.selector);
        
        // Set up controls
        const toggleBtn = ruleElement.querySelector('.toggle-rule-btn');
        const editBtn = ruleElement.querySelector('.edit-rule-btn');
        const deleteBtn = ruleElement.querySelector('.delete-rule-btn');
        
        // Toggle button
        const toggleIcon = toggleBtn.querySelector('.toggle-icon');
        toggleIcon.textContent = rule.enabled ? '👁️' : '🙈';
        toggleBtn.title = rule.enabled ? 'Tắt rule' : 'Bật rule';
        
        toggleBtn.addEventListener('click', () => {
            this.toggleRule(rule.id);
        });
        
        // Edit button
        editBtn.addEventListener('click', () => {
            this.editRule(rule.id);
        });
        
        // Delete button
        deleteBtn.addEventListener('click', () => {
            this.deleteRule(rule.id);
        });
        
        return ruleElement;
    }

    getElementTagFromSelector(selector) {
        // Extract tag name from selector for display
        const match = selector.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
        return match ? match[1].toUpperCase() : 'ELEMENT';
    }

    updateRuleCount() {
        const enabledCount = this.domainRules.filter(rule => rule.enabled).length;
        this.ruleCount.textContent = `${enabledCount}/${this.domainRules.length}`;
    }

    async toggleRule(ruleId) {
        const rule = this.domainRules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = !rule.enabled;
            await this.saveDomainData();
            this.renderRulesList();
            this.updateRuleCount();
        }
    }

    async editRule(ruleId) {
        const rule = this.domainRules.find(r => r.id === ruleId);
        if (rule) {
            const newNote = prompt('Nhập ghi chú mới:', rule.note || '');
            if (newNote !== null) {
                rule.note = newNote.trim();
                await this.saveDomainData();
                this.renderRulesList();
            }
        }
    }

    async deleteRule(ruleId) {
        if (confirm('Bạn có chắc muốn xóa rule này?')) {
            this.domainRules = this.domainRules.filter(r => r.id !== ruleId);
            await this.saveDomainData();
            this.renderRulesList();
            this.updateRuleCount();
            this.showStatus('Đã xóa rule', 'success');
        }
    }

    async updateDomainSettings() {
        await this.saveDomainData();
        this.showStatus('Đã cập nhật cài đặt domain', 'success');
    }

    async exportConfiguration() {
        try {
            const result = await chrome.storage.sync.get(['domains']);
            const data = {
                domains: result.domains || {},
                exportedAt: new Date().toISOString(),
                version: chrome.runtime.getManifest().version
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `hidebox-config-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.showStatus('Đã xuất cấu hình', 'success');
        } catch (error) {
            console.error('Error exporting configuration:', error);
            this.showStatus('Lỗi khi xuất cấu hình', 'error');
        }
    }

    async importConfiguration(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (data.domains && typeof data.domains === 'object') {
                await chrome.storage.sync.set({ domains: data.domains });
                await this.loadDomainData();
                this.showStatus('Đã nhập cấu hình thành công', 'success');
            } else {
                throw new Error('Invalid configuration format');
            }
        } catch (error) {
            console.error('Error importing configuration:', error);
            this.showStatus('Lỗi khi nhập cấu hình', 'error');
        }
        
        // Reset file input
        event.target.value = '';
    }

    async clearDomainRules() {
        if (confirm(`Bạn có chắc muốn xóa tất cả rules cho domain ${this.currentDomain}?`)) {
            this.domainRules = [];
            await this.saveDomainData();
            this.renderRulesList();
            this.updateRuleCount();
            this.showStatus('Đã xóa tất cả rules', 'success');
        }
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'elementSelected':
                this.addNewRule(message.rule);
                break;
            case 'elementUnselected':
                this.removeRuleFromUI(message.selector);
                break;
            case 'selectionModeChanged':
                this.isSelectionMode = message.enabled;
                this.updateSelectionButton();
                break;
        }
    }

    async addNewRule(rule) {
        // Check if rule already exists
        const exists = this.domainRules.some(r => r.selector === rule.selector);
        if (exists) {
            this.showStatus('Phần tử này đã được chọn', 'error');
            return;
        }

        // Add new rule to UI
        this.domainRules.push(rule);
        this.renderRulesList();
        this.updateRuleCount();
        this.showStatus('Đã thêm phần tử mới', 'success');
    }

    removeRuleFromUI(selector) {
        // Remove rule from UI
        const originalLength = this.domainRules.length;
        this.domainRules = this.domainRules.filter(rule => rule.selector !== selector);
        
        if (this.domainRules.length < originalLength) {
            this.renderRulesList();
            this.updateRuleCount();
            this.showStatus('Đã xóa rule', 'success');
        }
    }

    generateRuleId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showStatus(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
        
        // Clear status after 3 seconds
        setTimeout(() => {
            this.statusMessage.textContent = '';
            this.statusMessage.className = 'status-message';
        }, 3000);
    }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new HideBoxPopup();
});
