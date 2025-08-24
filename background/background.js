// Background Service Worker for HideBox Chrome Extension (MV3)
class HideBoxBackground {
    constructor() {
        this.initializeEventListeners();
        console.log('HideBox: Background service worker initialized');
    }

    initializeEventListeners() {
        // Extension installation/update
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstalled(details);
        });

        // Tab updates - apply rules when page loads
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdated(tabId, changeInfo, tab);
        });

        // Command shortcuts
        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });

        // Messages from popup and content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });

        // Storage changes - sync between tabs
        chrome.storage.onChanged.addListener((changes, namespace) => {
            this.handleStorageChanged(changes, namespace);
        });

        // Alarm for snooze cleanup
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });
    }

    async handleInstalled(details) {
        if (details.reason === 'install') {
            console.log('HideBox: Extension installed');
            await this.initializeStorage();
            this.showWelcomeNotification();
        } else if (details.reason === 'update') {
            console.log('HideBox: Extension updated');
            await this.migrateStorage(details.previousVersion);
        }
    }

    async initializeStorage() {
        try {
            const result = await chrome.storage.sync.get(['domains', 'settings']);
            
            if (!result.domains) {
                await chrome.storage.sync.set({ domains: {} });
            }

            if (!result.settings) {
                const defaultSettings = {
                    showPlaceholders: false,
                    debugMode: false,
                    autoApplyRules: true,
                    notificationEnabled: true,
                    version: chrome.runtime.getManifest().version
                };
                await chrome.storage.sync.set({ settings: defaultSettings });
            }

            console.log('HideBox: Storage initialized');
        } catch (error) {
            console.error('HideBox: Error initializing storage:', error);
        }
    }

    async migrateStorage(previousVersion) {
        try {
            const result = await chrome.storage.sync.get(['domains', 'settings']);
            let needsUpdate = false;

            if (this.compareVersions(previousVersion, '1.0.0') < 0) {
                console.log('HideBox: Migrating from version', previousVersion);
                needsUpdate = true;
            }

            if (needsUpdate) {
                await chrome.storage.sync.set({ domains: result.domains || {} });
                console.log('HideBox: Storage migration completed');
            }
        } catch (error) {
            console.error('HideBox: Error migrating storage:', error);
        }
    }

    compareVersions(a, b) {
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aPart = aParts[i] || 0;
            const bPart = bParts[i] || 0;
            
            if (aPart < bPart) return -1;
            if (aPart > bPart) return 1;
        }
        
        return 0;
    }

    async handleTabUpdated(tabId, changeInfo, tab) {
        if (changeInfo.status !== 'complete' || !tab.url) {
            return;
        }

        if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
            return;
        }

        try {
            const url = new URL(tab.url);
            const domain = url.hostname;

            const rules = await this.getRulesForDomain(domain);
            
            if (rules.length > 0) {
                const isSnoozed = await this.isDomainSnoozed(domain);
                
                if (!isSnoozed) {
                    await this.ensureContentScriptInjected(tabId);
                    
                    chrome.tabs.sendMessage(tabId, {
                        action: 'updateRules',
                        domain: domain,
                        rules: rules
                    }).catch(() => {
                    });
                }
            }
        } catch (error) {
            console.warn('HideBox: Error handling tab update:', error);
        }
    }

    async ensureContentScriptInjected(tabId) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
            if (response) {
                return;
            }
        } catch (error) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: [
                        'content/selector-generator.js',
                        'content/element-hider.js',
                        'content/content-script.js'
                    ]
                });

                await chrome.scripting.insertCSS({
                    target: { tabId: tabId },
                    files: ['content/overlay.css']
                });

                console.log('HideBox: Content script injected into tab', tabId);
            } catch (injectionError) {
                console.warn('HideBox: Failed to inject content script:', injectionError);
            }
        }
    }

    async getRulesForDomain(domain) {
        try {
            const result = await chrome.storage.sync.get(['domains']);
            const domains = result.domains || {};

            let domainData = domains[domain];
            let rules = [];

            if (domainData && domainData.rules) {
                rules = domainData.rules.filter(rule => rule.enabled);
            }

            if (rules.length === 0) {
                for (const [storedDomain, data] of Object.entries(domains)) {
                    if (data.applyToSubdomains && this.isSubdomain(domain, storedDomain)) {
                        rules = (data.rules || []).filter(rule => rule.enabled);
                        break;
                    }
                }
            }

            return rules;
        } catch (error) {
            console.error('HideBox: Error getting rules for domain:', error);
            return [];
        }
    }

    isSubdomain(hostname, parentDomain) {
        return hostname.endsWith('.' + parentDomain) || hostname === parentDomain;
    }

    async isDomainSnoozed(domain) {
        try {
            const result = await chrome.storage.local.get(['snooze']);
            const snooze = result.snooze || {};
            const snoozeUntil = snooze[domain];

            if (snoozeUntil && Date.now() < snoozeUntil) {
                return true;
            } else if (snoozeUntil) {
                delete snooze[domain];
                await chrome.storage.local.set({ snooze });
            }

            return false;
        } catch (error) {
            console.error('HideBox: Error checking snooze status:', error);
            return false;
        }
    }

    async handleCommand(command) {
        try {
            const [activeTab] = await chrome.tabs.query({ 
                active: true, 
                currentWindow: true 
            });

            if (!activeTab?.id) return;

            switch (command) {
                case 'toggle-selection-mode':
                    chrome.tabs.sendMessage(activeTab.id, {
                        action: 'toggleSelectionMode'
                    });
                    break;

                case 'snooze-domain':
                    await this.snoozeDomain(activeTab, 15); // Default 15 minutes
                    break;
            }
        } catch (error) {
            console.error('HideBox: Error handling command:', error);
        }
    }

    async snoozeDomain(tab, minutes) {
        try {
            const url = new URL(tab.url);
            const domain = url.hostname;
            const until = Date.now() + (minutes * 60 * 1000);

            const result = await chrome.storage.local.get(['snooze']);
            const snooze = result.snooze || {};
            snooze[domain] = until;
            await chrome.storage.local.set({ snooze });

            chrome.tabs.sendMessage(tab.id, {
                action: 'snoozeDomain',
                minutes: minutes
            });

            chrome.alarms.create(`snooze-${domain}`, { 
                when: until 
            });

            console.log(`HideBox: Domain ${domain} snoozed for ${minutes} minutes`);
        } catch (error) {
            console.error('HideBox: Error snoozing domain:', error);
        }
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'ping':
                sendResponse({ pong: true });
                break;

            case 'ensureContentScript':
                this.ensureContentScriptInjected(message.tabId)
                    .then(() => sendResponse({ success: true }))
                    .catch(error => sendResponse({ error: error.message }));
                return true; // Keep message channel open

            case 'saveSelectedElements':
                this.saveElementRules(message.rules, sender.tab)
                    .then(result => sendResponse(result))
                    .catch(error => sendResponse({ error: error.message }));
                return true; // Keep message channel open

            case 'getDomainStats':
                this.getDomainStats(message.domain)
                    .then(stats => sendResponse(stats))
                    .catch(error => sendResponse({ error: error.message }));
                return true;

            case 'exportAllData':
                this.exportAllData()
                    .then(data => sendResponse(data))
                    .catch(error => sendResponse({ error: error.message }));
                return true;

            case 'importData':
                this.importData(message.data)
                    .then(result => sendResponse(result))
                    .catch(error => sendResponse({ error: error.message }));
                return true;

            default:
                sendResponse({ error: 'Unknown action' });
        }
    }

    async saveElementRules(rules, tab) {
        try {
            if (!tab?.url) {
                throw new Error('Invalid tab');
            }

            const url = new URL(tab.url);
            const domain = url.hostname;

            const result = await chrome.storage.sync.get(['domains']);
            const domains = result.domains || {};
            
            if (!domains[domain]) {
                domains[domain] = {
                    applyToSubdomains: false,
                    rules: [],
                    updatedAt: Date.now()
                };
            }

            for (const rule of rules) {
                const exists = domains[domain].rules.some(
                    existingRule => existingRule.selector === rule.selector
                );
                
                if (!exists) {
                    domains[domain].rules.push(rule);
                }
            }

            domains[domain].updatedAt = Date.now();
            await chrome.storage.sync.set({ domains });

            console.log(`HideBox: Saved ${rules.length} rules for domain ${domain}`);
            return { success: true, domain, rulesCount: rules.length };
        } catch (error) {
            console.error('HideBox: Error saving rules:', error);
            throw error;
        }
    }

    async getDomainStats(domain) {
        try {
            const result = await chrome.storage.sync.get(['domains']);
            const domains = result.domains || {};
            const domainData = domains[domain];

            if (!domainData) {
                return { domain, rulesCount: 0, enabledRulesCount: 0 };
            }

            const rulesCount = domainData.rules.length;
            const enabledRulesCount = domainData.rules.filter(rule => rule.enabled).length;

            return {
                domain,
                rulesCount,
                enabledRulesCount,
                applyToSubdomains: domainData.applyToSubdomains,
                updatedAt: domainData.updatedAt
            };
        } catch (error) {
            console.error('HideBox: Error getting domain stats:', error);
            throw error;
        }
    }

    async exportAllData() {
        try {
            const syncResult = await chrome.storage.sync.get(null);
            const localResult = await chrome.storage.local.get(['snooze']);

            return {
                domains: syncResult.domains || {},
                settings: syncResult.settings || {},
                snooze: localResult.snooze || {},
                exportedAt: new Date().toISOString(),
                version: chrome.runtime.getManifest().version
            };
        } catch (error) {
            console.error('HideBox: Error exporting data:', error);
            throw error;
        }
    }

    async importData(data) {
        try {
            if (!data.domains || typeof data.domains !== 'object') {
                throw new Error('Invalid data format');
            }

            const result = await chrome.storage.sync.get(['domains']);
            const currentDomains = result.domains || {};
            
            const mergedDomains = { ...currentDomains, ...data.domains };
            
            await chrome.storage.sync.set({ domains: mergedDomains });

            if (data.settings) {
                await chrome.storage.sync.set({ settings: data.settings });
            }

            console.log('HideBox: Data imported successfully');
            return { success: true };
        } catch (error) {
            console.error('HideBox: Error importing data:', error);
            throw error;
        }
    }

    handleStorageChanged(changes, namespace) {
        if (namespace === 'sync' && changes.domains) {
            this.notifyTabsAboutStorageChange(changes.domains);
        }
    }

    async notifyTabsAboutStorageChange(domainsChange) {
        try {
            const tabs = await chrome.tabs.query({});
            
            for (const tab of tabs) {
                if (!tab.url || !tab.url.startsWith('http')) continue;
                
                try {
                    const url = new URL(tab.url);
                    const domain = url.hostname;
                    
                    const newValue = domainsChange.newValue || {};
                    const domainData = newValue[domain];
                    
                    if (domainData) {
                        const enabledRules = domainData.rules.filter(rule => rule.enabled);
                        
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'updateRules',
                            domain: domain,
                            rules: enabledRules
                        }).catch(() => {
                        });
                    }
                } catch (error) {
                    console.error('HideBox: Error notifying tabs about storage change:', error);
                }
            }
        } catch (error) {
            console.error('HideBox: Error notifying tabs about storage change:', error);
        }
    }

    handleAlarm(alarm) {
        if (alarm.name.startsWith('snooze-')) {
            const domain = alarm.name.replace('snooze-', '');
            this.cleanupExpiredSnooze(domain);
        }
    }

    async cleanupExpiredSnooze(domain) {
        try {
            const result = await chrome.storage.local.get(['snooze']);
            const snooze = result.snooze || {};
            
            if (snooze[domain]) {
                delete snooze[domain];
                await chrome.storage.local.set({ snooze });
                console.log(`HideBox: Cleaned up expired snooze for ${domain}`);
            }
        } catch (error) {
            console.error('HideBox: Error cleaning up snooze:', error);
        }
    }

    showWelcomeNotification() {
        console.log('HideBox: Welcome! Extension is ready to use.');
    }
}

new HideBoxBackground();
