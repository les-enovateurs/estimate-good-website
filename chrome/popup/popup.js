let translationsCache = {};
let forcedLanguage = null;

// Show loader and hide cards initially
function showLoader() {
    const loader = document.getElementById("loader");
    const cardWithScore = document.getElementById("card-with-score");
    const privacyCard = document.getElementById("privacy-card");
    const containerFooter = document.querySelector(".container-footer");

    if (loader) loader.classList.remove("hidden");
    if (cardWithScore) cardWithScore.classList.add("hidden");
    if (privacyCard) privacyCard.classList.add("hidden");
    if (containerFooter) containerFooter.classList.add("hidden");

    // Update loader text
    const loaderText = document.getElementById("loader-text");
    if (loaderText) {
        loaderText.textContent = getMessage("loadingText", "Loading...");
    }
}

// Hide loader and show cards
function hideLoader() {
    const loader = document.getElementById("loader");
    const cardWithScore = document.getElementById("card-with-score");
    const containerFooter = document.querySelector(".container-footer");

    if (loader) loader.classList.add("hidden");
    if (cardWithScore) cardWithScore.classList.remove("hidden");
    if (containerFooter) containerFooter.classList.remove("hidden");
    // Note: breach-card and terms-card are shown by their respective display functions
}

// Initialize
showLoader();

// Check for forced language first
chrome.storage.local.get(['badgeLanguage'], (result) => {
    if (result.badgeLanguage) {
        forcedLanguage = result.badgeLanguage;
        loadTranslations(forcedLanguage).then(() => {
            initPopup();
        });
    } else {
        initPopup();
    }
});

async function loadTranslations(lang) {
    if (!lang) return;
    try {
        const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
        const response = await fetch(url);
        const messages = await response.json();
        // Keep full messages object to support placeholders properly
        translationsCache = messages;
    } catch (e) {
        console.error(`Failed to load translations for ${lang}`, e);
    }
}

function getMessage(key, fallback, substitutions) {
    // Backward-compat: if fallback is an array and substitutions is undefined,
    // treat it as substitutions (older calls passed only two args)
    if (Array.isArray(fallback) && substitutions === undefined) {
        substitutions = fallback;
        fallback = undefined;
    }
    // Try forced language first
    if (forcedLanguage && translationsCache && translationsCache[key]) {
        let msg = translationsCache[key].message || '';
        const placeholders = translationsCache[key].placeholders || {};
        // If placeholders mapping exists and substitutions provided, replace named tokens
        if (placeholders && Array.isArray(substitutions)) {
            Object.keys(placeholders).forEach((phName) => {
                try {
                    const content = placeholders[phName].content || '';
                    const index = parseInt(String(content).replace(/\$/g, ''), 10) - 1;
                    const token = `$${phName.toUpperCase()}$`;
                    if (!isNaN(index) && substitutions[index] !== undefined) {
                        msg = msg.split(token).join(String(substitutions[index]));
                    }
                } catch (e) {
                    // ignore per placeholder errors
                }
            });
        }
        // Also support simple $1 style as a fallback
        if (Array.isArray(substitutions)) {
            substitutions.forEach((sub, index) => {
                msg = msg.split(`$${index + 1}`).join(String(sub));
            });
        }
        return msg || fallback;
    }

    // Fallback to chrome i18n
    try {
        const msg = chrome.i18n.getMessage(key, substitutions);
        return msg || fallback;
    } catch (e) {
        return fallback;
    }
}

function initPopup() {
    // Update loader text with correct language
    const loaderText = document.getElementById("loader-text");
    if (loaderText) {
        loaderText.textContent = getMessage("loadingText", "Loading...");
    }

    chrome.tabs.query({currentWindow: true, active: true})
    .then(async (tabs) => {
        if (!tabs || tabs.length === 0) {
            console.error('No active tab found');
            hideLoader();
            return;
        }
        const url = tabs[0].url;

        try {
            const parsedData = await getResultFromUrl(url);
            const { id, score, requests, grade, unlockMyData, breaches, termsArchive } = parsedData;
            updateUrl(url);
            updateEcoIndexReportLink(id);
            updateScore(score);
            updateNumberOfRequests(requests);
            updateBorderColor(grade);

            // Display Unlock My Data info if available
            if (unlockMyData) {
                displayUnlockMyData(unlockMyData);
            }

            // Display breaches if available
            if (breaches && breaches.length > 0) {
                displayBreaches(breaches);
            }

            // Display terms archive if available
            if (termsArchive && termsArchive.length > 0) {
                displayTermsArchive(termsArchive);
            }
        } catch (error) {
            console.error('Failed to load EcoIndex data:', error.message);
            updateUrl(url);
        }

        // Hide loader and show content
        hideLoader();

        const sourceOfData = findById("source-of-data");
        sourceOfData.innerHTML = getMessage("sourceOfData");

        const settings = findById("settings");
        settings.addEventListener('click', () => {
            window.open("/options/options.html", '_blank');
        })

        const settingsText = findById("settings-text")
        settingsText.innerHTML = getMessage("settings");

        // Update privacy section labels
        updatePrivacyLabels();

        // Update breach and terms section labels
        updateBreachLabels();
        updateTermsLabels();
    });
}

function updateNumberOfRequests(requests) {
    requestsTitle = findById("number-of-requests-title");
    requestsTitle.innerHTML = getMessage("numberOfRequestsTitle");

    requestsDom = findById("number-of-requests");
    requestsDom.innerHTML = requests;
}

function updateScore(score) {
    scoreTitle = findById("score-title");
    scoreTitle.innerHTML = getMessage("scoreTitle");

    scoreDom = findById("score");
    scoreDom.innerHTML = getMessage("scoreResult", [score]);
}

function updateUrl(url) {
    const urlDom = findById("url");
    urlDom.textContent = url;
}

function updateEcoIndexReportLink(id) {
    const ecoIndexAnchor = findById("ecoindex-result")
    ecoIndexAnchor.innerHTML = getMessage("detailedReport");
    ecoIndexAnchor.href = `https://www.ecoindex.fr/resultat/?id=${id}`;
}

function updateBorderColor(grade) {
    const cardDom = findById("card-with-score");
    let gradeColor = "000000";
    switch(grade) {
        case "A":
            gradeColor = "#2e9b43";
            break;
        case "B":
            gradeColor = "#34bc6e";
            break;
        case "C":
            gradeColor = "#cadd00";
            break;
        case "D":
            gradeColor = "#f7ed00";
            break;
        case "E":
            gradeColor = "#ffce00";
            break;
        case "F":
            gradeColor = "#fb9929";
            break;
        case "G":
            gradeColor = "#f01c16";
            break;
    }
    cardDom.style.borderColor = gradeColor;
}

function getResultFromUrl(url) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([url], function(item) {
            if (!item || !item[url]) {
                reject(new Error('No data found for URL'));
                return;
            }
            try {
                resolve(JSON.parse(item[url]));
            } catch (e) {
                reject(new Error('Failed to parse stored data'));
            }
        });
    });
}

// Unlock My Data display functions
function displayUnlockMyData(data) {
    const privacyCard = findById("privacy-card");
    privacyCard.style.display = "flex";

    // Service name
    const serviceName = findById("service-name");
    serviceName.textContent = data.name || "";

    // Easy access rating
    const easyAccessValue = findById("easy-access-value");
    if (data.easyAccessData) {
        easyAccessValue.textContent = data.easyAccessData;
    } else {
        easyAccessValue.textContent = "-";
    }

    // Export email
    if (data.contactMailExport) {
        const exportEmailRow = findById("export-email-row");
        exportEmailRow.style.display = "flex";
        const exportEmailValue = findById("export-email-value");
        exportEmailValue.textContent = data.contactMailExport;
        exportEmailValue.href = `mailto:${data.contactMailExport}`;
    }

    // Delete email
    if (data.contactMailDelete && data.contactMailDelete !== data.contactMailExport) {
        const deleteEmailRow = findById("delete-email-row");
        deleteEmailRow.style.display = "flex";
        const deleteEmailValue = findById("delete-email-value");
        deleteEmailValue.textContent = data.contactMailDelete;
        deleteEmailValue.href = `mailto:${data.contactMailDelete}`;
    }

    // Export URL
    if (data.urlExport) {
        const exportUrlRow = findById("export-url-row");
        exportUrlRow.style.display = "flex";
        const exportUrlValue = findById("export-url-value");
        exportUrlValue.href = data.urlExport;
    }

    // Access badges
    if (data.dataAccessViaForm) {
        findById("badge-form").style.display = "inline-block";
    }
    if (data.dataAccessViaEmail) {
        findById("badge-email").style.display = "inline-block";
    }
    if (data.dataAccessViaPostal) {
        findById("badge-postal").style.display = "inline-block";
    }
    if (data.needIdCard) {
        findById("badge-id-card").style.display = "inline-block";
    }

    // Update link to Unlock My Data with slug
    if (data.slug) {
        const unlockLink = findById("unlock-my-data-link");
        const lang = chrome.i18n.getUILanguage();
        if (lang && lang.startsWith('fr')) {
            unlockLink.href = `https://unlock-my-data.com/liste-applications/${data.slug}/`;
        } else {
            unlockLink.href = `https://unlock-my-data.com/list-app/${data.slug}/`;
        }
    }
}

function updatePrivacyLabels() {
    const privacyTitle = document.getElementById("privacy-title");
    if (privacyTitle) {
        privacyTitle.textContent = getMessage("privacyTitle", "Data Privacy");
    }

    const easyAccessLabel = document.getElementById("easy-access-label");
    if (easyAccessLabel) {
        easyAccessLabel.textContent = getMessage("easyAccessLabel", "Access ease:");
    }

    const exportEmailLabel = document.getElementById("export-email-label");
    if (exportEmailLabel) {
        exportEmailLabel.textContent = getMessage("exportEmailLabel", "Export email:");
    }

    const deleteEmailLabel = document.getElementById("delete-email-label");
    if (deleteEmailLabel) {
        deleteEmailLabel.textContent = getMessage("deleteEmailLabel", "Delete email:");
    }

    const exportUrlLabel = document.getElementById("export-url-label");
    if (exportUrlLabel) {
        exportUrlLabel.textContent = getMessage("exportUrlLabel", "Export URL:");
    }

    const badgeForm = document.getElementById("badge-form");
    if (badgeForm) {
        badgeForm.textContent = getMessage("badgeForm", "Form");
    }

    const badgeEmail = document.getElementById("badge-email");
    if (badgeEmail) {
        badgeEmail.textContent = getMessage("badgeEmail", "Email");
    }

    const badgePostal = document.getElementById("badge-postal");
    if (badgePostal) {
        badgePostal.textContent = getMessage("badgePostal", "Postal");
    }

    const badgeIdCard = document.getElementById("badge-id-card");
    if (badgeIdCard) {
        badgeIdCard.textContent = getMessage("badgeIdCard", "ID Required");
    }

    const unlockLink = document.getElementById("unlock-my-data-link");
    if (unlockLink) {
        unlockLink.textContent = getMessage("unlockMyDataLink", "More on Unlock My Data");
    }
}

// Breach display functions
function displayBreaches(breaches) {
    const breachCard = findById("breach-card");
    breachCard.style.display = "flex";

    // Update count
    const breachCount = findById("breach-count");
    breachCount.textContent = breaches.length;

    // Build breach list
    const breachList = findById("breach-list");
    breachList.innerHTML = "";

    breaches.forEach(breach => {
        const item = document.createElement("div");
        item.className = "breach-item";

        const title = document.createElement("div");
        title.className = "breach-item-title";
        title.textContent = breach.title || breach.name;

        const date = document.createElement("div");
        date.className = "breach-item-date";
        date.textContent = breach.breachDate ? formatBreachDate(breach.breachDate) : "";

        const count = document.createElement("div");
        count.className = "breach-item-count";
        if (breach.pwnCount) {
            count.textContent = formatPwnCount(breach.pwnCount) + " " + getMessage("breachAffectedAccounts", "accounts affected");
        }

        item.appendChild(title);
        if (breach.breachDate) item.appendChild(date);
        if (breach.pwnCount) item.appendChild(count);

        breachList.appendChild(item);
    });
}

function formatBreachDate(dateStr) {
    const date = new Date(dateStr);
    const lang = chrome.i18n.getUILanguage();
    return date.toLocaleDateString(lang.startsWith('fr') ? 'fr-FR' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatPwnCount(count) {
    if (count >= 1000000) {
        return (count / 1000000).toFixed(1) + "M";
    } else if (count >= 1000) {
        return (count / 1000).toFixed(0) + "K";
    }
    return count.toString();
}

function updateBreachLabels() {
    const breachTitle = document.getElementById("breach-title");
    if (breachTitle) {
        breachTitle.textContent = getMessage("breachTitle", "Data Breaches");
    }

    const haveibeenpwnedLink = document.getElementById("haveibeenpwned-link");
    if (haveibeenpwnedLink) {
        haveibeenpwnedLink.textContent = getMessage("breachCheckLink", "Check on Have I Been Pwned");
    }
}

// Terms Archive display functions
function displayTermsArchive(termsEntries) {
    const termsCard = findById("terms-card");
    termsCard.style.display = "flex";

    // Build terms list
    const termsList = findById("terms-list");
    termsList.innerHTML = "";

    const lang = chrome.i18n.getUILanguage();
    const isFrench = lang && lang.startsWith('fr');

    termsEntries.forEach(entry => {
        const item = document.createElement("div");
        item.className = "terms-item";

        const title = document.createElement("div");
        title.className = "terms-item-title";
        title.textContent = (isFrench && entry.titleFr) ? entry.titleFr : (entry.title || entry.slug);

        const service = document.createElement("div");
        service.className = "terms-item-service";
        if (entry.service) {
            service.textContent = entry.service;
        }
        if (entry.termsTypes && entry.termsTypes.length > 0) {
            service.textContent += (service.textContent ? " - " : "") + entry.termsTypes.join(", ");
        }

        const dates = document.createElement("div");
        dates.className = "terms-item-dates";
        if (entry.dates && entry.dates.length > 0) {
            const latestDate = entry.dates[entry.dates.length - 1];
            dates.textContent = (getMessage("termsLastUpdate", "Last update: ") + formatTermsDate(latestDate));
        }

        item.appendChild(title);
        if (service.textContent) item.appendChild(service);
        if (entry.dates && entry.dates.length > 0) item.appendChild(dates);

        // Add link if available
        if (entry.url) {
            const link = document.createElement("a");
            link.href = entry.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = getMessage("termsViewChanges", "View changes");
            item.appendChild(link);
        }

        termsList.appendChild(item);
    });
}

function formatTermsDate(dateStr) {
    const date = new Date(dateStr);
    const lang = chrome.i18n.getUILanguage();
    return date.toLocaleDateString(lang.startsWith('fr') ? 'fr-FR' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function updateTermsLabels() {
    const termsTitle = document.getElementById("terms-title");
    if (termsTitle) {
        termsTitle.textContent = getMessage("termsTitle", "Terms Changes");
    }

    const termsArchiveLink = document.getElementById("terms-archive-link");
    if (termsArchiveLink) {
        termsArchiveLink.textContent = getMessage("termsArchiveLink", "Source: Open Terms Archive");
    }
}

// tool functions
function findById(id) {
    const domElement = document.getElementById(id);
    if(!domElement) {
        throw new Error(`Cannot find the domElement by id: ${id}`);
    }
    return domElement;
}