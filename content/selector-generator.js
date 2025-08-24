// Selector Generator for HideBox - Tạo CSS selector ổn định
class SelectorGenerator {
    constructor() {
        this.ignoredClasses = new Set([
            // Dynamic classes to ignore
            'active', 'focus', 'hover', 'selected', 'current',
            // Framework-specific dynamic classes
            'ng-', 'vue-', 'react-', 'ember-',
            // Utility classes that might be dynamic
            'is-', 'has-', 'js-'
        ]);

        this.ignoredAttributes = new Set([
            'style', 'data-reactid', 'data-react-checksum',
            'data-vue-', 'ng-', 'data-ng-'
        ]);
    }

    /**
     * Generate a stable CSS selector for the given element
     * @param {Element} element - Target element
     * @param {Object} options - Generation options
     * @returns {Object} - {selector: string, confidence: number, fallbacks: string[]}
     */
    generateSelector(element, options = {}) {
        if (!element || !element.tagName) {
            return { selector: null, confidence: 0, fallbacks: [] };
        }

        const strategies = [
            this.generateByUniqueId.bind(this),
            this.generateByStableAttributes.bind(this),
            this.generateByStableClasses.bind(this),
            this.generateByStructuralPath.bind(this),
            this.generateByPosition.bind(this)
        ];

        const results = [];
        const fallbacks = [];

        for (const strategy of strategies) {
            try {
                const result = strategy(element, options);
                if (result && result.selector) {
                    if (this.isValidSelector(result.selector, element)) {
                        if (results.length === 0) {
                            results.push(result);
                        } else {
                            fallbacks.push(result.selector);
                        }
                    }
                }
            } catch (error) {
                console.warn('Selector generation strategy failed:', error);
            }
        }

        const primaryResult = results[0] || { selector: null, confidence: 0 };
        return {
            ...primaryResult,
            fallbacks: fallbacks.slice(0, 3) // Limit fallbacks
        };
    }

    /**
     * Generate selector using unique ID
     */
    generateByUniqueId(element) {
        const id = element.id;
        if (!id || this.isDynamicValue(id)) {
            return null;
        }

        const selector = `#${this.escapeSelector(id)}`;
        const matches = document.querySelectorAll(selector);
        
        if (matches.length === 1 && matches[0] === element) {
            return {
                selector: selector,
                confidence: 0.9,
                strategy: 'unique-id'
            };
        }

        return null;
    }

    /**
     * Generate selector using stable data attributes
     */
    generateByStableAttributes(element) {
        const attributes = [];
        
        // Look for data attributes
        for (const attr of element.attributes) {
            if (attr.name.startsWith('data-') && 
                !this.isDynamicValue(attr.value) &&
                !this.ignoredAttributes.has(attr.name)) {
                attributes.push(`[${attr.name}="${this.escapeAttributeValue(attr.value)}"]`);
            }
        }

        // Look for other stable attributes
        const stableAttrs = ['name', 'type', 'role', 'aria-label'];
        for (const attrName of stableAttrs) {
            const value = element.getAttribute(attrName);
            if (value && !this.isDynamicValue(value)) {
                attributes.push(`[${attrName}="${this.escapeAttributeValue(value)}"]`);
            }
        }

        if (attributes.length === 0) {
            return null;
        }

        const tagName = element.tagName.toLowerCase();
        const selector = tagName + attributes.join('');
        
        if (this.isValidSelector(selector, element)) {
            return {
                selector: selector,
                confidence: 0.8,
                strategy: 'stable-attributes'
            };
        }

        return null;
    }

    /**
     * Generate selector using stable class combinations
     */
    generateByStableClasses(element) {
        const classes = Array.from(element.classList)
            .filter(cls => !this.isDynamicClass(cls))
            .sort(); // Sort for consistency

        if (classes.length === 0) {
            return null;
        }

        const tagName = element.tagName.toLowerCase();
        
        // Try different combinations of classes
        const combinations = this.generateClassCombinations(classes);
        
        for (const combination of combinations) {
            const classSelector = combination.map(cls => `.${this.escapeSelector(cls)}`).join('');
            const selector = tagName + classSelector;
            
            const matches = document.querySelectorAll(selector);
            if (matches.length > 0 && matches.length <= 5) { // Not too many matches
                // Check if our element is in the matches
                if (Array.from(matches).includes(element)) {
                    const confidence = this.calculateClassConfidence(combination, matches.length);
                    return {
                        selector: selector,
                        confidence: confidence,
                        strategy: 'stable-classes'
                    };
                }
            }
        }

        return null;
    }

    /**
     * Generate selector using structural path
     */
    generateByStructuralPath(element) {
        const path = [];
        let current = element;
        let maxDepth = 8; // Limit path depth

        while (current && current.parentElement && maxDepth > 0) {
            const tag = current.tagName.toLowerCase();
            
            // Try to find a stable identifier for this level
            let identifier = '';
            
            // Check for stable ID or classes
            if (current.id && !this.isDynamicValue(current.id)) {
                identifier = `#${this.escapeSelector(current.id)}`;
                path.unshift(tag + identifier);
                break; // Stop here as ID is unique
            }
            
            // Check for stable classes
            const stableClasses = Array.from(current.classList)
                .filter(cls => !this.isDynamicClass(cls))
                .slice(0, 2); // Limit to 2 classes
            
            if (stableClasses.length > 0) {
                identifier = stableClasses.map(cls => `.${this.escapeSelector(cls)}`).join('');
            }
            
            // Use nth-of-type as fallback
            if (!identifier) {
                const siblings = Array.from(current.parentElement.children)
                    .filter(sibling => sibling.tagName === current.tagName);
                const index = siblings.indexOf(current) + 1;
                identifier = `:nth-of-type(${index})`;
            }
            
            path.unshift(tag + identifier);
            current = current.parentElement;
            maxDepth--;
        }

        if (path.length === 0) {
            return null;
        }

        const selector = path.join(' > ');
        
        if (this.isValidSelector(selector, element)) {
            return {
                selector: selector,
                confidence: 0.6,
                strategy: 'structural-path'
            };
        }

        return null;
    }

    /**
     * Generate selector using position-based approach (fallback)
     */
    generateByPosition(element) {
        const tag = element.tagName.toLowerCase();
        const parent = element.parentElement;
        
        if (!parent) {
            return {
                selector: tag,
                confidence: 0.3,
                strategy: 'position-fallback'
            };
        }

        // Find position among siblings of same tag
        const siblings = Array.from(parent.children)
            .filter(sibling => sibling.tagName === element.tagName);
        
        const index = siblings.indexOf(element) + 1;
        
        if (index > 0) {
            const selector = `${tag}:nth-of-type(${index})`;
            
            return {
                selector: selector,
                confidence: 0.4,
                strategy: 'position-fallback'
            };
        }

        return {
            selector: tag,
            confidence: 0.2,
            strategy: 'tag-only'
        };
    }

    /**
     * Check if a value appears to be dynamic (contains timestamps, hashes, etc.)
     */
    isDynamicValue(value) {
        if (!value || typeof value !== 'string') {
            return true;
        }

        // Check for common dynamic patterns
        const dynamicPatterns = [
            /\d{10,}/, // Timestamps
            /[a-f0-9]{8,}/, // Hashes
            /\d{4}-\d{2}-\d{2}/, // Dates
            /random|temp|tmp/i,
            /\d+_\d+/, // ID patterns
            /session|token/i
        ];

        return dynamicPatterns.some(pattern => pattern.test(value));
    }

    /**
     * Check if a class name appears to be dynamic
     */
    isDynamicClass(className) {
        if (this.isDynamicValue(className)) {
            return true;
        }

        // Check against ignored class patterns
        for (const ignored of this.ignoredClasses) {
            if (className.startsWith(ignored)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generate different combinations of classes for testing
     */
    generateClassCombinations(classes) {
        const combinations = [];
        
        // Single classes
        for (const cls of classes) {
            combinations.push([cls]);
        }
        
        // Pairs of classes
        for (let i = 0; i < classes.length; i++) {
            for (let j = i + 1; j < classes.length; j++) {
                combinations.push([classes[i], classes[j]]);
            }
        }
        
        // All classes (if not too many)
        if (classes.length <= 4) {
            combinations.push(classes);
        }
        
        return combinations;
    }

    /**
     * Calculate confidence based on class stability and uniqueness
     */
    calculateClassConfidence(classes, matchCount) {
        let confidence = 0.7;
        
        // Reduce confidence based on number of matches
        if (matchCount > 1) {
            confidence -= (matchCount - 1) * 0.1;
        }
        
        // Increase confidence for more specific classes
        if (classes.length > 1) {
            confidence += 0.1;
        }
        
        return Math.max(0.3, Math.min(0.9, confidence));
    }

    /**
     * Validate that a selector uniquely identifies the element
     */
    isValidSelector(selector, targetElement) {
        try {
            const matches = document.querySelectorAll(selector);
            return matches.length > 0 && Array.from(matches).includes(targetElement);
        } catch (error) {
            return false;
        }
    }

    /**
     * Escape special characters in CSS selectors
     */
    escapeSelector(value) {
        return value.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
    }

    /**
     * Escape attribute values
     */
    escapeAttributeValue(value) {
        return value.replace(/["\\]/g, '\\$&');
    }

    /**
     * Get element information for display
     */
    getElementInfo(element) {
        if (!element) return null;

        const info = {
            tag: element.tagName.toLowerCase(),
            id: element.id || '',
            classes: Array.from(element.classList),
            text: element.textContent ? element.textContent.trim().slice(0, 50) : '',
            rect: element.getBoundingClientRect()
        };

        // Add relevant attributes
        const relevantAttrs = ['name', 'type', 'role', 'aria-label', 'title'];
        const attributes = {};
        
        for (const attr of relevantAttrs) {
            const value = element.getAttribute(attr);
            if (value) {
                attributes[attr] = value;
            }
        }
        
        info.attributes = attributes;
        return info;
    }

    /**
     * Test multiple fallback selectors for an element
     */
    testFallbackSelectors(element) {
        const selectorData = this.generateSelector(element);
        const allSelectors = [selectorData.selector, ...selectorData.fallbacks].filter(Boolean);
        
        const results = [];
        
        for (const selector of allSelectors) {
            try {
                const matches = document.querySelectorAll(selector);
                const isValid = Array.from(matches).includes(element);
                
                results.push({
                    selector: selector,
                    valid: isValid,
                    matchCount: matches.length
                });
            } catch (error) {
                results.push({
                    selector: selector,
                    valid: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }
}

// Export for use in content script
window.SelectorGenerator = SelectorGenerator;
