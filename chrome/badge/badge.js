// EcoSurf Badge - Content Script
// Injects a floating badge showing website analysis results

(function() {
    'use strict';

    // Avoid double injection
    if (window.__ecosurfBadgeInjected) return;
    window.__ecosurfBadgeInjected = true;

    let badgeContainer = null;
    let shadowRoot = null;
    let isExpanded = false;
    let currentData = null;

    // Grade colors
    const gradeColors = {
        'A': '#2e9b43',
        'B': '#34bc6e',
        'C': '#cadd00',
        'D': '#f7ed00',
        'E': '#ffce00',
        'F': '#fb9929',
        'G': '#f01c16'
    };

    // Check if badge is enabled in settings
    function checkBadgeEnabled() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['badgeEnabled'], (result) => {
                // Default to true if not set
                resolve(result.badgeEnabled !== false);
            });
        });
    }

    // Get data for current URL
    function getPageData() {
        return new Promise((resolve) => {
            const url = window.location.href;
            chrome.storage.local.get([url], (result) => {
                if (result[url]) {
                    try {
                        resolve(JSON.parse(result[url]));
                    } catch (e) {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });
        });
    }

    // Locale override messages (used when user forces a language)
    let overrideMessages = null;

    // Load messages from storage (pre-loaded by options page)
    async function loadLocaleMessages(lang) {
        overrideMessages = null;
        if (!lang) {
            console.log('EcoSurf: No language specified, using default browser language');
            return;
        }
        try {
            // Get messages from storage (pre-loaded by options page)
            const result = await new Promise((resolve) => {
                chrome.storage.local.get(['badgeLanguageMessages'], resolve);
            });

            if (result.badgeLanguageMessages) {
                overrideMessages = result.badgeLanguageMessages;
                console.log('EcoSurf: Successfully loaded messages for language:', lang, 'Keys:', Object.keys(overrideMessages).length);
            } else {
                console.warn('EcoSurf: No messages found in storage for language:', lang);
                overrideMessages = null;
            }
        } catch (e) {
            console.error('EcoSurf: Error loading locale messages from storage:', e);
            overrideMessages = null;
        }
    }

    // Get i18n message, with optional substitutions array or default text
    // If overrideMessages is loaded, use it; otherwise fallback to chrome.i18n
    function getMessage(key, substitutionsOrDefault) {
        try {
            // Use loaded messages when available
            if (overrideMessages && overrideMessages[key]) {
                if (!overrideMessages[key].message) {
                    console.warn('EcoSurf: Key found but no message:', key);
                } else {
                    let msg = overrideMessages[key].message;

                    // If placeholders mapping exists in the messages.json, use it to replace named tokens like $MINUTES$
                    const placeholders = overrideMessages[key].placeholders || {};
                    if (placeholders && Array.isArray(substitutionsOrDefault)) {
                        Object.keys(placeholders).forEach((phName) => {
                            try {
                                const content = placeholders[phName].content || '';
                                // content is usually like "$1" -> extract index
                                const index = parseInt(content.replace(/\$/g, ''), 10);
                                const token = `$${phName.toUpperCase()}$`;
                                if (!isNaN(index) && substitutionsOrDefault[index - 1] !== undefined) {
                                    msg = msg.split(token).join(String(substitutionsOrDefault[index - 1]));
                                }
                            } catch (e) {
                                // ignore per-placeholder errors
                            }
                        });

                        // Also support direct $1, $2 replacements if present
                        substitutionsOrDefault.forEach((s, idx) => {
                            msg = msg.split(`$${idx + 1}`).join(String(s));
                        });
                    }

                    console.log('EcoSurf: Using override message for', key, ':', msg);
                    return msg;
                }
            } else if (overrideMessages) {
                console.warn('EcoSurf: Key not found in override messages:', key);
            }
        } catch (e) {
            // fall through to chrome.i18n fallback
            console.error('EcoSurf: Error getting override message:', e);
        }

        // When no override is loaded or key not found in override, try chrome.i18n
        try {
            let result = '';
            if (Array.isArray(substitutionsOrDefault)) {
                result = chrome.i18n.getMessage(key, substitutionsOrDefault);
            } else {
                result = chrome.i18n.getMessage(key);
            }

            // If we got a result from chrome.i18n, use it
            if (result) return result;

            // Otherwise, if a default string was provided (not an array, not null), use it
            if (substitutionsOrDefault && typeof substitutionsOrDefault === 'string') {
                return substitutionsOrDefault;
            }

            return '';
        } catch (e) {
            // If chrome.i18n fails and we have a default string, use it
            if (substitutionsOrDefault && typeof substitutionsOrDefault === 'string') {
                return substitutionsOrDefault;
            }
            return '';
        }
    }


    // Create the badge HTML
    function createBadgeHTML(data) {
        const grade = data.grade || '?';
        const gradeColor = gradeColors[grade] || '#888888';
        const score = data.score || '-';
        const requests = data.requests || '-';

        // Unlock My Data info
        const unlockData = data.unlockMyData;
        const easyAccess = unlockData?.easyAccessData || null;

        // Breaches
        const breaches = data.breaches || [];
        const breachCount = breaches.length;

        // Terms Archive
        const termsArchive = data.termsArchive || [];
        const hasTermsChanges = termsArchive.length > 0;

        // Build compact view indicators
        let compactIndicators = '';

        // EcoIndex grade
        compactIndicators += `
            <div class="ecosurf-indicator ecosurf-grade" style="background-color: ${gradeColor}">
                <span class="ecosurf-grade-letter">${grade}</span>
            </div>
        `;

        // Privacy indicator
        if (easyAccess) {
            const privacyColor = getPrivacyColor(easyAccess);
            compactIndicators += `
                <div class="ecosurf-indicator ecosurf-privacy" style="background-color: ${privacyColor}" title="${getMessage('badgePrivacyTitle', 'Data access')}">
                    <span class="ecosurf-icon">🔓</span>
                    <span class="ecosurf-privacy-text">${easyAccess}</span>
                </div>
            `;
        }

        // Breaches indicator
        if (breachCount > 0) {
            compactIndicators += `
                <div class="ecosurf-indicator ecosurf-breaches" title="${getMessage('badgeBreachesTitle', 'Data breaches')}">
                    <span class="ecosurf-icon">⚠️</span>
                    <span class="ecosurf-breach-count">${breachCount}</span>
                </div>
            `;
        }

        // Terms indicator
        if (hasTermsChanges) {
            compactIndicators += `
                <div class="ecosurf-indicator ecosurf-terms" title="${getMessage('badgeTermsTitle', 'Terms changes')}">
                    <span class="ecosurf-icon">📜</span>
                </div>
            `;
        }

        // Build expanded view
        let expandedContent = '';

        // EcoIndex section
        expandedContent += `
            <div class="ecosurf-section">
                <div class="ecosurf-section-header">
                    <span class="ecosurf-section-icon">🌿</span>
                    <span class="ecosurf-section-title">${getMessage('ecoIndexTitle', null) || 'EcoIndex'}</span>
                    <span class="ecosurf-grade-badge" style="background-color: ${gradeColor}">${grade}</span>
                </div>
                <div class="ecosurf-section-content">
                    <div class="ecosurf-row">
                        <span>${getMessage('scoreTitle', 'Score:')}</span>
                        <span>${score}/100</span>
                    </div>
                    <div class="ecosurf-row">
                        <span>${getMessage('numberOfRequestsTitle', 'Requests:')}</span>
                        <span>${requests}</span>
                    </div>
                </div>
            </div>
        `;

        // Unlock My Data section
        if (unlockData) {
            let privacyContent = '';
            if (easyAccess) {
                privacyContent += `
                    <div class="ecosurf-row">
                        <span>${getMessage('easyAccessLabel', 'Access ease:')}</span>
                        <span>${easyAccess}</span>
                    </div>
                `;
            }

            // Access methods
            let accessMethods = [];
            if (unlockData.dataAccessViaForm) accessMethods.push(getMessage('badgeForm', 'Form'));
            if (unlockData.dataAccessViaEmail) accessMethods.push(getMessage('badgeEmail', 'Email'));
            if (unlockData.dataAccessViaPostal) accessMethods.push(getMessage('badgePostal', 'Postal'));

            if (accessMethods.length > 0) {
                privacyContent += `
                    <div class="ecosurf-row">
                        <span>${getMessage('badgeAccessMethods', 'Methods:')}</span>
                        <span>${accessMethods.join(', ')}</span>
                    </div>
                `;
            }

            if (unlockData.needIdCard) {
                privacyContent += `
                    <div class="ecosurf-row ecosurf-warning">
                        <span>⚠️ ${getMessage('badgeIdCard', 'ID Required')}</span>
                    </div>
                `;
            }

            expandedContent += `
                <div class="ecosurf-section">
                    <div class="ecosurf-section-header">
                        <span class="ecosurf-section-icon">🔓</span>
                        <span class="ecosurf-section-title">${getMessage('privacyTitle', 'Data Privacy')}</span>
                    </div>
                    <div class="ecosurf-section-content">
                        ${privacyContent}
                    </div>
                </div>
            `;
        }

        // Breaches section
        if (breachCount > 0) {
            let breachItems = breaches.slice(0, 3).map(b => {
                const name = b.title || b.name;
                const year = b.breachDate ? new Date(b.breachDate).getFullYear() : '';
                return `<span class="ecosurf-breach-item">${name}${year ? ` (${year})` : ''}</span>`;
            }).join('');

            if (breaches.length > 3) {
                breachItems += `<span class="ecosurf-breach-more">+${breaches.length - 3} ${getMessage('badgeMore', 'more')}</span>`;
            }

            expandedContent += `
                <div class="ecosurf-section ecosurf-section-warning">
                    <div class="ecosurf-section-header">
                        <span class="ecosurf-section-icon">⚠️</span>
                        <span class="ecosurf-section-title">${getMessage('breachTitle', 'Data Breaches')}</span>
                        <span class="ecosurf-breach-badge">${breachCount}</span>
                    </div>
                    <div class="ecosurf-section-content">
                        <div class="ecosurf-breach-list">${breachItems}</div>
                    </div>
                </div>
            `;
        }

        // Terms section
        if (hasTermsChanges) {
            const latestTerm = termsArchive[0];
            const termTitle = latestTerm.titleFr || latestTerm.title || latestTerm.slug;

            expandedContent += `
                <div class="ecosurf-section">
                    <div class="ecosurf-section-header">
                        <span class="ecosurf-section-icon">📜</span>
                        <span class="ecosurf-section-title">${getMessage('termsTitle', 'Terms Changes')}</span>
                    </div>
                    <div class="ecosurf-section-content">
                        <div class="ecosurf-row">
                            <span>${termTitle}</span>
                        </div>
                        ${termsArchive.length > 1 ? `<span class="ecosurf-terms-more">+${termsArchive.length - 1} ${getMessage('badgeMore', 'more')}</span>` : ''}
                    </div>
                </div>
            `;
        }

        return `
            <div class="ecosurf-badge ${isExpanded ? 'ecosurf-expanded' : ''}" id="ecosurf-badge">
                <div class="ecosurf-compact" id="ecosurf-compact">
                    ${compactIndicators}
                </div>
                <div class="ecosurf-expanded-view" id="ecosurf-expanded-view">
                    <div class="ecosurf-header">
                        <span class="ecosurf-title">${getMessage('appName', null) || 'EcoSurf Analyser'}</span>
                        <button class="ecosurf-close" id="ecosurf-close" aria-label="${getMessage('closeLabel', null) || 'Close'}">×</button>
                    </div>
                    <div class="ecosurf-body">
                        ${expandedContent}
                    </div>
                </div>
            </div>
        `;
    }

    // Get privacy color based on ease of access
    function getPrivacyColor(easyAccess) {
        const level = easyAccess?.toLowerCase() || '';
        if (level.includes('easy') || level.includes('facile')) return '#2e9b43';
        if (level.includes('medium') || level.includes('moyen')) return '#f7ed00';
        if (level.includes('hard') || level.includes('difficile')) return '#fb9929';
        return '#888888';
    }

    // Create and inject the badge
    function createBadge(data) {
        // Create container
        badgeContainer = document.createElement('div');
        badgeContainer.id = 'ecosurf-badge-container';

        // Use Shadow DOM for style isolation
        shadowRoot = badgeContainer.attachShadow({ mode: 'closed' });

        // Inject styles
        const style = document.createElement('style');
        style.textContent = getBadgeStyles();
        shadowRoot.appendChild(style);

        // Inject badge HTML
        const badgeWrapper = document.createElement('div');
        badgeWrapper.innerHTML = createBadgeHTML(data);
        shadowRoot.appendChild(badgeWrapper);

        // Add to page
        document.body.appendChild(badgeContainer);

        // Add event listeners
        setupEventListeners();
    }

    // Setup event listeners
    function setupEventListeners() {
        const compact = shadowRoot.getElementById('ecosurf-compact');
        const closeBtn = shadowRoot.getElementById('ecosurf-close');

        if (compact) {
            compact.addEventListener('click', () => {
                isExpanded = true;
                updateBadgeState();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                isExpanded = false;
                updateBadgeState();
            });
        }
    }

    // Update badge expanded/collapsed state
    function updateBadgeState() {
        const badge = shadowRoot.getElementById('ecosurf-badge');
        if (badge) {
            if (isExpanded) {
                badge.classList.add('ecosurf-expanded');
            } else {
                badge.classList.remove('ecosurf-expanded');
            }
        }
    }

    // Get badge CSS styles
    function getBadgeStyles() {
        return `
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            .ecosurf-badge {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                font-size: 14px;
                line-height: 1.4;
                color: #333;
            }

            .ecosurf-compact {
                display: flex;
                gap: 4px;
                padding: 6px;
                background: rgba(255, 255, 255, 0.95);
                border-radius: 24px;
                box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
                backdrop-filter: blur(10px);
            }

            .ecosurf-compact:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            }

            .ecosurf-indicator {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 4px 10px;
                border-radius: 16px;
                font-size: 12px;
                font-weight: 600;
                color: white;
                white-space: nowrap;
            }

            .ecosurf-grade {
                min-width: 32px;
                justify-content: center;
            }

            .ecosurf-grade-letter {
                font-size: 16px;
                font-weight: 700;
            }

            .ecosurf-privacy {
                background: #888;
            }

            .ecosurf-privacy-text {
                max-width: 60px;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .ecosurf-breaches {
                background: #e74c3c;
            }

            .ecosurf-terms {
                background: #3498db;
                padding: 4px 8px;
            }

            .ecosurf-icon {
                font-size: 12px;
            }

            /* Expanded view */
            .ecosurf-expanded-view {
                display: none;
                position: absolute;
                bottom: 0;
                right: 0;
                width: 320px;
                max-height: 80vh;
                background: white;
                border-radius: 16px;
                box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
                overflow: hidden;
            }

            .ecosurf-expanded .ecosurf-compact {
                display: none;
            }

            .ecosurf-expanded .ecosurf-expanded-view {
                display: flex;
                flex-direction: column;
            }

            .ecosurf-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: linear-gradient(135deg, #2e9b43, #34bc6e);
                color: white;
            }

            .ecosurf-title {
                font-weight: 600;
                font-size: 15px;
            }

            .ecosurf-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                font-size: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }

            .ecosurf-close:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            .ecosurf-body {
                overflow-y: auto;
                max-height: calc(80vh - 52px);
            }

            .ecosurf-section {
                padding: 12px 16px;
                border-bottom: 1px solid #eee;
            }

            .ecosurf-section:last-child {
                border-bottom: none;
            }

            .ecosurf-section-warning {
                background: #fff5f5;
            }

            .ecosurf-section-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }

            .ecosurf-section-icon {
                font-size: 16px;
            }

            .ecosurf-section-title {
                font-weight: 600;
                flex: 1;
            }

            .ecosurf-grade-badge {
                padding: 2px 10px;
                border-radius: 12px;
                color: white;
                font-weight: 700;
                font-size: 13px;
            }

            .ecosurf-breach-badge {
                background: #e74c3c;
                padding: 2px 8px;
                border-radius: 10px;
                color: white;
                font-size: 12px;
                font-weight: 600;
            }

            .ecosurf-section-content {
                padding-left: 24px;
            }

            .ecosurf-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                font-size: 13px;
            }

            .ecosurf-row span:first-child {
                color: #666;
            }

            .ecosurf-warning {
                color: #e74c3c !important;
            }

            .ecosurf-warning span {
                color: #e74c3c !important;
            }

            .ecosurf-breach-list {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }

            .ecosurf-breach-item {
                background: #fee;
                color: #c0392b;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 12px;
            }

            .ecosurf-breach-more,
            .ecosurf-terms-more {
                color: #666;
                font-size: 12px;
                font-style: italic;
            }

            /* Mobile adjustments */
            @media (max-width: 480px) {
                .ecosurf-badge {
                    bottom: 10px;
                    right: 10px;
                    left: 10px;
                }

                .ecosurf-expanded-view {
                    width: calc(100vw - 20px);
                    left: 0;
                    right: 0;
                }

                .ecosurf-compact {
                    justify-content: center;
                }
            }

            /* Reduced motion */
            @media (prefers-reduced-motion: reduce) {
                .ecosurf-compact,
                .ecosurf-close {
                    transition: none;
                }
            }

            /* Dark mode support */
            @media (prefers-color-scheme: dark) {
                .ecosurf-compact {
                    background: rgba(30, 30, 30, 0.95);
                }

                .ecosurf-expanded-view {
                    background: #1e1e1e;
                    color: #eee;
                }

                .ecosurf-section {
                    border-color: #333;
                }

                .ecosurf-section-warning {
                    background: #2a1a1a;
                }

                .ecosurf-row span:first-child {
                    color: #aaa;
                }
            }
        `;
    }

    // Remove badge
    function removeBadge() {
        if (badgeContainer && badgeContainer.parentNode) {
            badgeContainer.parentNode.removeChild(badgeContainer);
            badgeContainer = null;
            shadowRoot = null;
        }
    }

    // Initialize
    async function init() {
        // Check if badge is enabled
        const enabled = await checkBadgeEnabled();
        if (!enabled) {
            removeBadge();
            return;
        }

        // Load forced language (if any) from storage, then load messages
        try {
            const storage = await new Promise((resolve) => chrome.storage.local.get(['badgeLanguage'], resolve));
            const lang = storage && storage.badgeLanguage ? storage.badgeLanguage : null;
            if (lang) {
                await loadLocaleMessages(lang);
            } else {
                overrideMessages = null;
            }
        } catch (e) {
            overrideMessages = null;
        }

        // Get page data
        const data = await getPageData();
        if (!data) {
            removeBadge();
            return;
        }

        currentData = data;

        // Create badge
        createBadge(data);
    }

    // Listen for storage changes to update badge
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;

        // Check if badge enabled setting changed
        if (changes.badgeEnabled) {
            console.log('EcoSurf: Badge enabled changed to', changes.badgeEnabled.newValue);
            if (changes.badgeEnabled.newValue === false) {
                removeBadge();
            } else {
                init();
            }
            return;
        }

        // If badge language or language messages were changed, reload and recreate badge
        if (changes.badgeLanguage || changes.badgeLanguageMessages) {
            const newLang = changes.badgeLanguage?.newValue || null;
            console.log('EcoSurf: Badge language changed to', newLang);
            (async () => {
                try {
                    if (badgeContainer) {
                        console.log('EcoSurf: Removing existing badge');
                        removeBadge();
                    }
                    console.log('EcoSurf: Loading new locale:', newLang);
                    await loadLocaleMessages(newLang);
                    console.log('EcoSurf: Reinitializing badge with new language');
                    await init();
                } catch (e) {
                    console.error('EcoSurf: Failed to reload badge with new language', e);
                }
            })();
            return;
        }

        // Check if current page data changed
        const url = window.location.href;
        if (changes[url]) {
            removeBadge();
            try {
                currentData = JSON.parse(changes[url].newValue);
                createBadge(currentData);
            } catch (e) {
                console.error('EcoSurf: Failed to parse updated data');
            }
        }
    });

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
