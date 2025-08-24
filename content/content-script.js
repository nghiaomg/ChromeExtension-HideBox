class HideBoxContentScript {
    constructor() {
        this.isSelectionMode = false;
        this.currentDomain = window.location.hostname;
        this.overlay = null;
        this.tooltip = null;
        this.indicator = null;
        this.instructions = null;
        this.selectedElements = new Set();
        this.tempRules = [];
        
        this.selectorGenerator = new SelectorGenerator();
        this.elementHider = new ElementHider();
        
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseClick = this.handleMouseClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
        
        this.initialize();
    }

    async initialize() {
        chrome.runtime.onMessage.addListener(this.handleMessage);
        
        this.setupGlobalKeyListener();
        
        await this.loadAndApplyRules();
        
        await this.checkSnoozeStatus();
        
        console.log('HideBox: Content script initialized for', this.currentDomain);
    }

    setupGlobalKeyListener() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isSelectionMode) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                this.toggleSelectionMode(false);
                this.showNotification('Đã thoát chế độ chọn (global ESC)');
                console.log('HideBox: Global ESC triggered');
            }
        }, { capture: true, passive: false });
    }

    async loadAndApplyRules() {
        try {
            const result = await chrome.storage.sync.get(['domains']);
            const domains = result.domains || {};
            
            let domainData = domains[this.currentDomain];
            
            if (!domainData) {
                for (const [domain, data] of Object.entries(domains)) {
                    if (data.applyToSubdomains && this.isSubdomain(this.currentDomain, domain)) {
                        domainData = data;
                        break;
                    }
                }
            }
            
            if (domainData && domainData.rules) {
                const enabledRules = domainData.rules.filter(rule => rule.enabled);
                this.elementHider.applyRules(enabledRules);
                console.log(`HideBox: Applied ${enabledRules.length} rules for ${this.currentDomain}`);
            }
        } catch (error) {
            console.error('HideBox: Error loading rules:', error);
        }
    }

    async checkSnoozeStatus() {
        try {
            const result = await chrome.storage.local.get(['snooze']);
            const snooze = result.snooze || {};
            const snoozeUntil = snooze[this.currentDomain];
            
            if (snoozeUntil && Date.now() < snoozeUntil) {
                this.elementHider.setActive(false);
                console.log('HideBox: Domain is snoozed until', new Date(snoozeUntil));
            } else if (snoozeUntil) {
                delete snooze[this.currentDomain];
                await chrome.storage.local.set({ snooze });
            }
        } catch (error) {
            console.error('HideBox: Error checking snooze status:', error);
        }
    }

    isSubdomain(hostname, parentDomain) {
        return hostname.endsWith('.' + parentDomain) || hostname === parentDomain;
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'toggleSelectionMode':
                this.toggleSelectionMode(message.enabled);
                sendResponse({ success: true });
                break;
                
            case 'getSelectionMode':
                sendResponse({ enabled: this.isSelectionMode });
                break;
                
            case 'updateRules':
                this.elementHider.applyRules(message.rules);
                sendResponse({ success: true });
                break;
                
            case 'snoozeDomain':
                this.handleSnooze(message.minutes);
                sendResponse({ success: true });
                break;
                
            case 'getStats':
                sendResponse(this.elementHider.getStats());
                break;
                
            default:
                sendResponse({ error: 'Unknown action' });
        }
        
        return true;
    }

    toggleSelectionMode(enabled) {
        if (typeof enabled !== 'undefined') {
            this.isSelectionMode = enabled;
        } else {
            this.isSelectionMode = !this.isSelectionMode;
        }
        
        if (this.isSelectionMode) {
            this.startSelectionMode();
        } else {
            this.stopSelectionMode();
        }
        
        chrome.runtime.sendMessage({
            action: 'selectionModeChanged',
            enabled: this.isSelectionMode
        });
    }

    startSelectionMode() {
        document.addEventListener('mousemove', this.handleMouseMove, true);
        document.addEventListener('click', this.handleMouseClick, true);
        
        document.addEventListener('keydown', this.handleKeyDown, true);
        window.addEventListener('keydown', this.handleKeyDown, true);
        document.body.addEventListener('keydown', this.handleKeyDown, true);
        
        this.createOverlay();
        this.createTooltip();
        this.createIndicator();
        this.createInstructions();
        
        document.body.classList.add('hidebox-selection-mode');
        
        document.body.focus();
        document.body.setAttribute('tabindex', '-1');
        
        console.log('HideBox: Selection mode started');
    }

    stopSelectionMode() {
        document.removeEventListener('mousemove', this.handleMouseMove, true);
        document.removeEventListener('click', this.handleMouseClick, true);
        document.removeEventListener('keydown', this.handleKeyDown, true);
        window.removeEventListener('keydown', this.handleKeyDown, true);
        document.body.removeEventListener('keydown', this.handleKeyDown, true);
        
        this.removeOverlay();
        this.removeTooltip();
        this.removeIndicator();
        this.removeInstructions();
        
        document.body.classList.remove('hidebox-selection-mode');
        
        document.body.removeAttribute('tabindex');
        document.body.blur();
        
        this.clearTempSelections();
        
        console.log('HideBox: Selection mode stopped');
    }

    handleMouseMove(event) {
        if (!this.isSelectionMode) return;
        
        const element = event.target;
        if (!element || this.isHideBoxElement(element)) return;
        
        this.highlightElement(element);
        this.updateTooltip(element, event);
    }

    handleMouseClick(event) {
        if (!this.isSelectionMode) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const element = event.target;
        if (!element || this.isHideBoxElement(element)) return;
        
        if (event.shiftKey) {
            this.selectParentElement(element);
        } else if (event.ctrlKey || event.metaKey) {
            this.unselectElement(element);
        } else {
            this.selectElement(element);
        }
    }

    handleKeyDown(event) {
        if (!this.isSelectionMode) return;
        
        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                this.toggleSelectionMode(false);
                this.showNotification('Đã thoát chế độ chọn');
                break;
                
            case 'u':
            case 'U':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.undoLastSelection();
                }
                break;
                
            case 'Enter':
                event.preventDefault();
                this.saveSelectedElements();
                break;
        }
    }

    async selectElement(element) {
        if (this.selectedElements.has(element)) {
            return;
        }
        
        const selectorData = this.selectorGenerator.generateSelector(element);
        if (!selectorData.selector) {
            console.warn('HideBox: Could not generate selector for element');
            return;
        }
        
        const rule = {
            id: this.generateRuleId(),
            selector: selectorData.selector,
            confidence: selectorData.confidence,
            fallbacks: selectorData.fallbacks,
            note: this.generateElementNote(element),
            enabled: true,
            createdAt: Date.now()
        };
        
        await this.saveRuleToStorage(rule);
        
        this.selectedElements.add(element);
        this.tempRules.push({...rule, element: element});
        
        this.elementHider.addRule(rule);

        chrome.runtime.sendMessage({
            action: 'elementSelected',
            rule: rule
        });
        
        console.log('HideBox: Selected and saved element:', rule.selector);
        this.showNotification(`Đã ẩn và lưu: ${rule.note}`);
    }

    selectParentElement(element) {
        const parent = element.parentElement;
        if (parent && parent !== document.body) {
            this.selectElement(parent);
        }
    }

    async unselectElement(element) {
        if (!this.selectedElements.has(element)) {
            return;
        }
        
        const tempRule = this.tempRules.find(rule => rule.element === element);
        if (tempRule) {
            await this.removeRuleFromStorage(tempRule.selector);
            
            this.elementHider.removeRule(tempRule.selector);
        }
        
        this.selectedElements.delete(element);
        
        this.tempRules = this.tempRules.filter(rule => rule.element !== element);
        
        chrome.runtime.sendMessage({
            action: 'elementUnselected',
            selector: tempRule?.selector
        });
        
        console.log('HideBox: Unselected and removed element');
        this.showNotification('Đã bỏ chọn và xóa rule');
    }

    async undoLastSelection() {
        if (this.tempRules.length === 0) return;
        
        const lastRule = this.tempRules.pop();
        const element = lastRule.element;
        
        await this.removeRuleFromStorage(lastRule.selector);
        
        this.elementHider.removeRule(lastRule.selector);
        
        if (element) {
            this.selectedElements.delete(element);
        }
        
        chrome.runtime.sendMessage({
            action: 'elementUnselected',
            selector: lastRule.selector
        });
        
        console.log('HideBox: Undid last selection');
        this.showNotification('Đã hoàn tác selection gần nhất');
    }

    saveSelectedElements() {
        this.clearTempSelections();
        this.toggleSelectionMode(false);
        
        console.log('HideBox: Exited selection mode');
    }

    clearTempSelections() {
        this.selectedElements.clear();
        this.tempRules = [];
    }

    highlightElement(element) {
        if (!this.overlay) return;
        
        const rect = element.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        
        this.overlay.style.left = (rect.left + scrollX) + 'px';
        this.overlay.style.top = (rect.top + scrollY) + 'px';
        this.overlay.style.width = rect.width + 'px';
        this.overlay.style.height = rect.height + 'px';
        this.overlay.style.display = 'block';
        
        this.overlay.className = 'hidebox-overlay';
        if (this.selectedElements.has(element)) {
            this.overlay.classList.add('selected');
        }
    }

    updateTooltip(element, event) {
        if (!this.tooltip) return;
        
        const info = this.selectorGenerator.getElementInfo(element);
        if (!info) return;
        
        let content = '';
        content += `<span class="hidebox-tooltip-line"><span class="hidebox-tooltip-tag">${info.tag.toUpperCase()}</span></span>`;
        
        if (info.id) {
            content += `<span class="hidebox-tooltip-line"><span class="hidebox-tooltip-id">#${info.id}</span></span>`;
        }
        
        if (info.classes.length > 0) {
            const classText = info.classes.slice(0, 3).join(' ');
            content += `<span class="hidebox-tooltip-line"><span class="hidebox-tooltip-class">.${classText}</span></span>`;
        }
        
        if (info.text) {
            const truncatedText = info.text.length > 30 ? info.text.substring(0, 30) + '...' : info.text;
            content += `<span class="hidebox-tooltip-line">"${truncatedText}"</span>`;
        }
        
        content += `<span class="hidebox-tooltip-line"><span class="hidebox-tooltip-size">${Math.round(info.rect.width)}×${Math.round(info.rect.height)}</span></span>`;
        
        this.tooltip.innerHTML = content;
        

        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        
        this.tooltip.style.left = (event.clientX + scrollX) + 'px';
        this.tooltip.style.top = (event.clientY + scrollY) + 'px';
        this.tooltip.style.display = 'block';
    }

    createOverlay() {
        if (this.overlay) return;
        
        this.overlay = document.createElement('div');
        this.overlay.className = 'hidebox-overlay';
        this.overlay.style.display = 'none';
        document.body.appendChild(this.overlay);
    }

    createTooltip() {
        if (this.tooltip) return;
        
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'hidebox-tooltip';
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);
    }

    createIndicator() {
        if (this.indicator) return;
        
        this.indicator = document.createElement('div');
        this.indicator.className = 'hidebox-selection-indicator';
        this.indicator.innerHTML = `
            <span class="hidebox-selection-indicator-icon">🎯</span>
            <span class="hidebox-selection-indicator-text">Chế độ chọn đang bật</span>
        `;
        document.body.appendChild(this.indicator);
    }

    createInstructions() {
        if (this.instructions) return;
        
        this.instructions = document.createElement('div');
        this.instructions.className = 'hidebox-instructions';
        this.instructions.innerHTML = `
            <div class="hidebox-instructions-title">🎯 Hướng dẫn chọn phần tử</div>
            <ul class="hidebox-instructions-list">
                <li class="hidebox-instructions-item">Click để chọn và lưu phần tử</li>
                <li class="hidebox-instructions-item"><span class="hidebox-instructions-key">Shift+Click</span> chọn phần tử cha</li>
                <li class="hidebox-instructions-item"><span class="hidebox-instructions-key">Ctrl+Click</span> bỏ chọn và xóa</li>
                <li class="hidebox-instructions-item"><span class="hidebox-instructions-key">Ctrl+U</span> hoàn tác • <span class="hidebox-instructions-key">ESC</span> thoát</li>
            </ul>
            <div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">
                💡 Bấm <span class="hidebox-instructions-key">ESC</span> bất cứ lúc nào để thoát
            </div>
        `;
        document.body.appendChild(this.instructions);
    }

    removeOverlay() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    removeTooltip() {
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
    }

    removeIndicator() {
        if (this.indicator) {
            this.indicator.remove();
            this.indicator = null;
        }
    }

    removeInstructions() {
        if (this.instructions) {
            this.instructions.remove();
            this.instructions = null;
        }
    }

    isHideBoxElement(element) {
        return element.classList.contains('hidebox-overlay') ||
               element.classList.contains('hidebox-tooltip') ||
               element.classList.contains('hidebox-selection-indicator') ||
               element.classList.contains('hidebox-instructions') ||
               element.closest('.hidebox-overlay, .hidebox-tooltip, .hidebox-selection-indicator, .hidebox-instructions');
    }

    generateElementNote(element) {
        const info = this.selectorGenerator.getElementInfo(element);
        if (!info) return '';
        
        let note = info.tag.toUpperCase();
        
        if (info.id) {
            note += ` #${info.id}`;
        } else if (info.classes.length > 0) {
            note += ` .${info.classes[0]}`;
        }
        
        if (info.text && info.text.length > 0) {
            const truncatedText = info.text.length > 20 ? info.text.substring(0, 20) + '...' : info.text;
            note += ` "${truncatedText}"`;
        }
        
        return note;
    }

    async saveRuleToStorage(rule) {
        try {
            const result = await chrome.storage.sync.get(['domains']);
            const domains = result.domains || {};
            
            if (!domains[this.currentDomain]) {
                domains[this.currentDomain] = {
                    applyToSubdomains: false,
                    rules: [],
                    updatedAt: Date.now()
                };
            }
            
            const existingRuleIndex = domains[this.currentDomain].rules.findIndex(
                existingRule => existingRule.selector === rule.selector
            );
            
            if (existingRuleIndex === -1) {
                domains[this.currentDomain].rules.push(rule);
                domains[this.currentDomain].updatedAt = Date.now();
                
                await chrome.storage.sync.set({ domains });
                
                console.log(`HideBox: Saved rule for ${this.currentDomain}:`, rule.selector);
                return true;
            } else {
                console.log('HideBox: Rule already exists for selector:', rule.selector);
                return false;
            }
        } catch (error) {
            console.error('HideBox: Error saving rule to storage:', error);
            this.showNotification('Lỗi khi lưu rule');
            return false;
        }
    }

    async removeRuleFromStorage(selector) {
        try {
            const result = await chrome.storage.sync.get(['domains']);
            const domains = result.domains || {};
            
            if (domains[this.currentDomain] && domains[this.currentDomain].rules) {
                const originalLength = domains[this.currentDomain].rules.length;
                domains[this.currentDomain].rules = domains[this.currentDomain].rules.filter(
                    rule => rule.selector !== selector
                );
                
                if (domains[this.currentDomain].rules.length < originalLength) {
                    domains[this.currentDomain].updatedAt = Date.now();
                    await chrome.storage.sync.set({ domains });
                    console.log(`HideBox: Removed rule from ${this.currentDomain}:`, selector);
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('HideBox: Error removing rule from storage:', error);
            this.showNotification('Lỗi khi xóa rule');
            return false;
        }
    }

    generateRuleId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    handleSnooze(minutes) {
        this.elementHider.setActive(false);
        console.log(`HideBox: Domain snoozed for ${minutes} minutes`);
        
        this.showNotification(`Domain đã được tạm ngưng ${minutes} phút`);
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background: #28a745 !important;
            color: white !important;
            padding: 12px 16px !important;
            border-radius: 6px !important;
            font-family: system-ui !important;
            font-size: 14px !important;
            z-index: 2147483647 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new HideBoxContentScript();
    });
} else {
    new HideBoxContentScript();
}
