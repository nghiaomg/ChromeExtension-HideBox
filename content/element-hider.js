class ElementHider {
    constructor() {
        this.hiddenElements = new Map();
        this.observer = null;
        this.styleSheet = null;
        this.isActive = true;
        
        this.initializeStyleSheet();
        this.setupMutationObserver();
    }

    /**
     * Initialize CSS stylesheet for hiding elements
     */
    initializeStyleSheet() {
        let styleElement = document.getElementById('hidebox-styles');
        
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'hidebox-styles';
            styleElement.type = 'text/css';
            
            if (document.head) {
                document.head.appendChild(styleElement);
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    document.head.appendChild(styleElement);
                });
                return;
            }
        }
        
        this.styleSheet = styleElement.sheet || styleElement.styleSheet;
    }

    /**
     * Setup MutationObserver
     */
    setupMutationObserver() {
        if (this.observer) {
            this.observer.disconnect();
        }

        this.observer = new MutationObserver((mutations) => {
            if (!this.isActive) return;
            
            clearTimeout(this.observerTimeout);
            this.observerTimeout = setTimeout(() => {
                this.handleDOMChanges(mutations);
            }, 100);
        });

        this.observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: false
        });
    }

    /**
     * Handle DOM changes
     */
    handleDOMChanges(mutations) {
        let shouldReapply = false;

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        shouldReapply = true;
                        break;
                    }
                }
            }
            
            if (shouldReapply) break;
        }

        if (shouldReapply) {
            this.reapplyAllRules();
        }
    }

    /**
     * Apply rules
     * @param {Array} rules - Array of rule objects {id, selector, enabled, note}
     */
    applyRules(rules) {
        if (!Array.isArray(rules)) {
            console.warn('ElementHider: Invalid rules format');
            return;
        }

        this.clearAllRules();

        for (const rule of rules) {
            if (rule.enabled && rule.selector) {
                this.addRule(rule);
            }
        }
    }

    /**
     * Add a single hiding rule
     * @param {Object} rule - Rule object {id, selector, enabled, note}
     */
    addRule(rule) {
        if (!rule.selector || !rule.enabled) {
            return;
        }

        try {
            document.querySelector(rule.selector);
            
            this.addCSSRule(rule.selector);
            
            const elements = new Set();
            const matchingElements = document.querySelectorAll(rule.selector);
            
            for (const element of matchingElements) {
                elements.add(element);
                this.hideElement(element, rule);
            }
            
            this.hiddenElements.set(rule.selector, {
                elements: elements,
                rule: rule
            });
            
            console.log(`HideBox: Applied rule for ${elements.size} elements:`, rule.selector);
            
        } catch (error) {
            console.warn(`HideBox: Invalid selector "${rule.selector}":`, error);
        }
    }

    /**
     * Remove a hiding rule
     * @param {string} selector - CSS selector to remove
     */
    removeRule(selector) {
        const ruleData = this.hiddenElements.get(selector);
        if (!ruleData) return;

        for (const element of ruleData.elements) {
            this.showElement(element);
        }

        this.removeCSSRule(selector);
        
        this.hiddenElements.delete(selector);
        
        console.log(`HideBox: Removed rule:`, selector);
    }

    /**
     * Clear all hiding rules
     */
    clearAllRules() {
        for (const selector of this.hiddenElements.keys()) {
            this.removeRule(selector);
        }
        
        if (this.styleSheet) {
            while (this.styleSheet.cssRules.length > 0) {
                this.styleSheet.deleteRule(0);
            }
        }
    }

    /**
     * Reapply all current rules (useful after DOM changes)
     */
    reapplyAllRules() {
        const currentRules = Array.from(this.hiddenElements.values()).map(data => data.rule);
        this.applyRules(currentRules);
    }

    /**
     * Add CSS rule to hide elements
     * @param {string} selector - CSS selector
     */
    addCSSRule(selector) {
        if (!this.styleSheet) {
            this.initializeStyleSheet();
        }

        try {
            const ruleText = `${selector} { display: none !important; }`;
            
            const existingRules = Array.from(this.styleSheet.cssRules || []);
            const ruleExists = existingRules.some(rule => 
                rule.selectorText === selector && 
                rule.style.display === 'none'
            );
            
            if (!ruleExists) {
                this.styleSheet.insertRule(ruleText, this.styleSheet.cssRules.length);
            }
        } catch (error) {
            console.warn(`HideBox: Failed to add CSS rule for "${selector}":`, error);
        }
    }

    /**
     * Remove CSS rule
     * @param {string} selector - CSS selector
     */
    removeCSSRule(selector) {
        if (!this.styleSheet) return;

        try {
            const rules = Array.from(this.styleSheet.cssRules || []);
            for (let i = rules.length - 1; i >= 0; i--) {
                const rule = rules[i];
                if (rule.selectorText === selector) {
                    this.styleSheet.deleteRule(i);
                }
            }
        } catch (error) {
            console.warn(`HideBox: Failed to remove CSS rule for "${selector}":`, error);
        }
    }

    /**
     * Hide a specific element
     * @param {Element} element - Element to hide
     * @param {Object} rule - Rule object for reference
     */
    hideElement(element, rule) {
        if (!element || element.style.display === 'none') {
            return;
        }

        if (!element.hasAttribute('data-hidebox-original-display')) {
            const originalDisplay = getComputedStyle(element).display;
            element.setAttribute('data-hidebox-original-display', originalDisplay);
        }

        element.classList.add('hidebox-hidden');
        element.setAttribute('data-hidebox-rule-id', rule.id);
        element.setAttribute('data-hidebox-hidden-by', 'HideBox Extension');

        if (this.shouldShowPlaceholder()) {
            this.createPlaceholder(element, rule);
        }
    }

    /**
     * Show a previously hidden element
     * @param {Element} element - Element to show
     */
    showElement(element) {
        if (!element) return;

        element.classList.remove('hidebox-hidden');
        element.removeAttribute('data-hidebox-rule-id');
        element.removeAttribute('data-hidebox-hidden-by');

        const originalDisplay = element.getAttribute('data-hidebox-original-display');
        if (originalDisplay) {
            element.style.display = originalDisplay === 'none' ? '' : originalDisplay;
            element.removeAttribute('data-hidebox-original-display');
        }

        this.removePlaceholder(element);
    }

    /**
     * Create placeholder for hidden element (debug mode)
     * @param {Element} element - Hidden element
     * @param {Object} rule - Hiding rule
     */
    createPlaceholder(element, rule) {
        if (!this.isDebugMode()) return;

        const placeholder = document.createElement('div');
        placeholder.className = 'hidebox-hidden-placeholder';
        placeholder.setAttribute('data-hidebox-placeholder-for', rule.selector);
        placeholder.style.cssText = `
            border: 2px dashed #ccc !important;
            padding: 10px !important;
            margin: 5px 0 !important;
            background: #f9f9f9 !important;
            color: #666 !important;
            font-size: 12px !important;
            text-align: center !important;
        `;
        placeholder.textContent = `🙈 Hidden by HideBox: ${rule.note || rule.selector}`;

        if (element.parentNode) {
            element.parentNode.insertBefore(placeholder, element);
        }
    }

    /**
     * Remove placeholder for element
     * @param {Element} element - Element whose placeholder to remove
     */
    removePlaceholder(element) {
        if (!element.parentNode) return;

        const placeholders = element.parentNode.querySelectorAll('.hidebox-hidden-placeholder');
        for (const placeholder of placeholders) {
            const forSelector = placeholder.getAttribute('data-hidebox-placeholder-for');
            if (forSelector && element.matches && element.matches(forSelector)) {
                placeholder.remove();
            }
        }
    }

    /**
     * Check if debug mode is enabled
     */
    isDebugMode() {
        return localStorage.getItem('hidebox-debug') === 'true' ||
               new URLSearchParams(window.location.search).has('hidebox-debug');
    }

    /**
     * Check if placeholders should be shown
     */
    shouldShowPlaceholder() {
        return this.isDebugMode();
    }

    /**
     * Get statistics about currently hidden elements
     */
    getStats() {
        let totalElements = 0;
        const ruleStats = [];

        for (const [selector, data] of this.hiddenElements) {
            const elementCount = data.elements.size;
            totalElements += elementCount;
            
            ruleStats.push({
                selector: selector,
                rule: data.rule,
                elementCount: elementCount,
                isValid: elementCount > 0
            });
        }

        return {
            totalRules: this.hiddenElements.size,
            totalElements: totalElements,
            ruleStats: ruleStats,
            isActive: this.isActive
        };
    }

    /**
     * Enable or disable the element hider
     * @param {boolean} active - Whether to activate hiding
     */
    setActive(active) {
        this.isActive = active;
        
        if (active) {
            this.reapplyAllRules();
            if (this.observer) {
                this.observer.observe(document.body || document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: false
                });
            }
        } else {
            this.clearAllRules();
            if (this.observer) {
                this.observer.disconnect();
            }
        }
    }

    /**
     * Check if an element is currently hidden by HideBox
     * @param {Element} element - Element to check
     */
    isElementHidden(element) {
        return element && element.classList.contains('hidebox-hidden');
    }

    /**
     * Get the rule that hides a specific element
     * @param {Element} element - Element to check
     */
    getElementRule(element) {
        if (!this.isElementHidden(element)) {
            return null;
        }

        const ruleId = element.getAttribute('data-hidebox-rule-id');
        if (!ruleId) return null;

        for (const data of this.hiddenElements.values()) {
            if (data.rule.id === ruleId) {
                return data.rule;
            }
        }

        return null;
    }

    /**
     * Cleanup - remove observer and styles
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        this.clearAllRules();
        
        const styleElement = document.getElementById('hidebox-styles');
        if (styleElement) {
            styleElement.remove();
        }

        this.hiddenElements.clear();
    }
}

window.ElementHider = ElementHider;
