// EcoSurf Badge - Content Script (Firefox)
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
        return true;
    }

    // Request data from background
    function requestData() {
        if (getBrowser() && getBrowser().runtime) {
            getBrowser().runtime.sendMessage({ action: 'getBadgeData' })
                .then(response => {
                    if (response && response.enabled) {
                        if (response.data) {
                            currentData = response.data;
                            createBadge(response.data);
                        }
                    } else {
                        removeBadge();
                    }
                })
                .catch(error => {
                    // console.error("EcoSurf: Error requesting badge data", error);
                });
        }
    }

    function getBrowser() {
        if (typeof browser !== 'undefined') {
            return browser;
        }
        if (typeof chrome !== 'undefined') {
            return chrome;
        }
        return null;
    }

    // Get i18n message
    function getMessage(key, fallback) {
        // Check for forced translations first
        if (currentData && currentData.translations && currentData.translations[key]) {
            return currentData.translations[key];
        }

        try {
            const msg = browser.i18n.getMessage(key);
            return msg || fallback;
        } catch (e) {
            return fallback;
        }
    }

    // Format breach count
    function formatCount(count) {
        if (count >= 1000000) {
            return (count / 1000000).toFixed(1) + 'M';
        } else if (count >= 1000) {
            return Math.floor(count / 1000) + 'K';
        }
        return count.toString();
    }

    // Create the badge HTML
    function createBadgeHTML(data, forceLang) {
        const grade = data.grade || '?';
        const gradeColor = gradeColors[grade] || '#888888';
        const score = data.score || '-';
        const requests = data.requests || '-';
        const id = data.id || '';

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
                    <span class="ecosurf-section-title">EcoIndex</span>
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
                    <a href="https://www.ecoindex.fr/resultat/?id=${id}" target="_blank" class="ecosurf-link">${getMessage('detailedReport', 'See detailed report')}</a>
                </div>
            </div>
        `;

        // Unlock My Data section
        if (unlockData) {
            let privacyContent = '';

            // Service name
            if (unlockData.name) {
                privacyContent += `
                    <div class="ecosurf-row">
                        <span class="ecosurf-service-name">${unlockData.name}</span>
                    </div>
                `;
            }

            if (easyAccess) {
                privacyContent += `
                    <div class="ecosurf-row">
                        <span>${getMessage('easyAccessLabel', 'Access ease:')}</span>
                        <span>${easyAccess}</span>
                    </div>
                `;
            }

            // Export email
            if (unlockData.contactMailExport) {
                privacyContent += `
                    <div class="ecosurf-row">
                        <span>${getMessage('exportEmailLabel', 'Export email:')}</span>
                        <a href="mailto:${unlockData.contactMailExport}" class="ecosurf-link">${unlockData.contactMailExport}</a>
                    </div>
                `;
            }

            // Delete email
            if (unlockData.contactMailDelete && unlockData.contactMailDelete !== unlockData.contactMailExport) {
                privacyContent += `
                    <div class="ecosurf-row">
                        <span>${getMessage('deleteEmailLabel', 'Delete email:')}</span>
                        <a href="mailto:${unlockData.contactMailDelete}" class="ecosurf-link">${unlockData.contactMailDelete}</a>
                    </div>
                `;
            }

            // Export URL
            if (unlockData.urlExport) {
                privacyContent += `
                    <div class="ecosurf-row">
                        <span>${getMessage('exportUrlLabel', 'Export URL:')}</span>
                        <a href="${unlockData.urlExport}" target="_blank" class="ecosurf-link">Link</a>
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

            // Link to Unlock My Data
            let unlockUrl = 'https://unlock-my-data.com/';
            if (unlockData.slug) {
                let lang = forceLang;
                if (!lang && typeof browser !== 'undefined' && browser.i18n) {
                    lang = browser.i18n.getUILanguage();
                }

                if (lang && lang.startsWith('fr')) {
                    unlockUrl = `https://unlock-my-data.com/liste-applications/${unlockData.slug}/`;
                } else {
                    unlockUrl = `https://unlock-my-data.com/list-app/${unlockData.slug}/`;
                }
            }

            privacyContent += `
                <a href="${unlockUrl}" target="_blank" class="ecosurf-link ecosurf-mt-4">${getMessage('unlockMyDataLink', 'More on Unlock My Data')}</a>
            `;

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
                        <a href="https://haveibeenpwned.com/" target="_blank" class="ecosurf-link ecosurf-mt-4">Check on Have I Been Pwned</a>
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
                        <a href="https://opentermsarchive.org/" target="_blank" class="ecosurf-link ecosurf-mt-4">Source: Open Terms Archive</a>
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
                        <span class="ecosurf-title">EcoSurf Analyser</span>
                        <button class="ecosurf-close" id="ecosurf-close" aria-label="Close">×</button>
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
        badgeWrapper.innerHTML = createBadgeHTML(data, data.language);
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
                align-items: center;
            }

            .ecosurf-row span:first-child {
                color: #666;
            }

            .ecosurf-link {
                color: #3498db;
                text-decoration: none;
                font-size: 12px;
                display: inline-block;
                margin-top: 4px;
            }

            .ecosurf-link:hover {
                text-decoration: underline;
            }

            .ecosurf-mt-4 {
                margin-top: 8px;
                display: block;
            }
            
            .ecosurf-service-name {
                font-weight: 600;
                font-size: 14px;
                color: #333 !important;
                margin-bottom: 4px;
                display: block;
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
    function init() {
        requestData();
    }

    // Listen for messages from background
    if (getBrowser() && getBrowser().runtime) {
        getBrowser().runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'updateBadge') {
                if (message.data) {
                    currentData = message.data;
                    createBadge(message.data);
                }
            }
        });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
