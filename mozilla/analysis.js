//prod
const baseURL = 'https://compressor.les-enovateurs.com/';
//dev
// const baseURL = 'http://localhost:8080/';

// Unlock My Data API
const UNLOCK_MY_DATA_SERVICES_URL = 'https://raw.githubusercontent.com/les-enovateurs/unlock-my-data/refs/heads/master/public/data/services.json';
const BREACH_MAPPING_URL = 'https://raw.githubusercontent.com/les-enovateurs/unlock-my-data/master/public/data/compare/breach-mapping.json';
const TERMS_ARCHIVE_URL = 'https://raw.githubusercontent.com/les-enovateurs/unlock-my-data/master/public/data/compare/terms-archive.json';
let unlockMyDataServices = null;
let breachMappingData = null;
let termsArchiveData = null;
let translationsCache = {};

// Fetch translations
async function getTranslations(lang) {
    if (!lang) return null;
    if (translationsCache[lang]) return translationsCache[lang];

    try {
        const url = browser.runtime.getURL(`_locales/${lang}/messages.json`);
        const response = await fetch(url);
        const messages = await response.json();
        // Simplify to key: message
        const simpleMessages = {};
        for (const [key, value] of Object.entries(messages)) {
            simpleMessages[key] = value.message;
        }
        translationsCache[lang] = simpleMessages;
        return simpleMessages;
    } catch (e) {
        console.error(`Failed to load translations for ${lang}`, e);
        return null;
    }
}

// Fetch Unlock My Data services list
async function fetchUnlockMyDataServices() {
    if (unlockMyDataServices !== null) {
        return unlockMyDataServices;
    }
    try {
        const response = await fetch(UNLOCK_MY_DATA_SERVICES_URL);
        if (response.ok) {
            unlockMyDataServices = await response.json();
            return unlockMyDataServices;
        }
    } catch (e) {
        console.error('Failed to fetch Unlock My Data services:', e);
    }
    return [];
}

// Fetch breach mapping data
async function fetchBreachMapping() {
    if (breachMappingData !== null) {
        return breachMappingData;
    }
    try {
        const response = await fetch(BREACH_MAPPING_URL);
        if (response.ok) {
            breachMappingData = await response.json();
            return breachMappingData;
        }
    } catch (e) {
        console.error('Failed to fetch breach mapping:', e);
    }
    return {};
}

// Fetch Terms Archive data
async function fetchTermsArchive() {
    if (termsArchiveData !== null) {
        return termsArchiveData;
    }
    try {
        const response = await fetch(TERMS_ARCHIVE_URL);
        if (response.ok) {
            termsArchiveData = await response.json();
            return termsArchiveData;
        }
    } catch (e) {
        console.error('Failed to fetch Terms Archive:', e);
    }
    return {};
}

// Find Terms Archive entries for a domain
async function findTermsArchiveForDomain(url) {
    const termsArchive = await fetchTermsArchive();
    const domain = extractDomain(url);

    if (!domain || Object.keys(termsArchive).length === 0) {
        return null;
    }

    const domainKey = domain.split('.')[0].toLowerCase();

    for (const [key, entries] of Object.entries(termsArchive)) {
        if (key.toLowerCase() === domainKey ||
            domain.includes(key.toLowerCase()) ||
            key.toLowerCase().includes(domainKey)) {
            if (entries && entries.length > 0) {
                // Return the most recent entries (max 3)
                return entries.slice(0, 3).map(entry => ({
                    slug: entry.slug,
                    url: entry.url,
                    title: entry.title,
                    titleFr: entry.title_fr,
                    service: entry.service,
                    termsTypes: entry.terms_types,
                    dates: entry.dates,
                    description: entry.description,
                    descriptionFr: entry.description_fr
                }));
            }
        }
    }
    return null;
}

// Find breaches for a domain
async function findBreachesForDomain(url) {
    const breachMapping = await fetchBreachMapping();
    const domain = extractDomain(url);

    if (!domain || Object.keys(breachMapping).length === 0) {
        return null;
    }

    // Try to find breaches by domain key
    const domainKey = domain.split('.')[0].toLowerCase();

    // Check various possible keys
    for (const [key, breaches] of Object.entries(breachMapping)) {
        if (key.toLowerCase() === domainKey ||
            domain.includes(key.toLowerCase()) ||
            key.toLowerCase().includes(domainKey)) {
            if (breaches && breaches.length > 0) {
                return breaches.map(breach => ({
                    name: breach.name,
                    title: breach.title,
                    breachDate: breach.breachDate,
                    pwnCount: breach.pwnCount,
                    dataClasses: breach.dataClasses,
                    description: breach.description,
                    isVerified: breach.isVerified
                }));
            }
        }
    }
    return null;
}

// Extract domain from URL
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, '').toLowerCase();
    } catch (e) {
        return null;
    }
}

// Find matching service from Unlock My Data
async function findUnlockMyDataService(url) {
    const services = await fetchUnlockMyDataServices();
    const domain = extractDomain(url);

    if (!domain || services.length === 0) {
        return null;
    }

    // Try to match by slug or by domain patterns
    for (const service of services) {
        const slug = service.slug.toLowerCase();
        // Check if domain contains the service slug
        if (domain.includes(slug) || slug.includes(domain.split('.')[0])) {
            return {
                name: service.name,
                slug: service.slug,
                logo: service.logo,
                easyAccessData: service.easy_access_data,
                contactMailExport: service.contact_mail_export,
                contactMailDelete: service.contact_mail_delete,
                urlExport: service.url_export,
                needIdCard: service.need_id_card,
                dataAccessViaForm: service.data_access_via_form,
                dataAccessViaEmail: service.data_access_via_email,
                dataAccessViaPostal: service.data_access_via_postal,
                countryName: service.country_name,
                countryCode: service.country_code,
                tosdr: service.tosdr,
                exodus: service.exodus
            };
        }
    }
    return null;
}

// Listen for messages from content scripts
browser.runtime.onMessage.addListener((request, sender) => {
    if (request.action === 'getBadgeData') {
        return handleGetBadgeData(sender);
    }
});

async function handleGetBadgeData(sender) {
    if (!sender || !sender.tab) {
        return { enabled: false };
    }
    const url = sender.tab.url;
    const enabled = localStorage.getItem('badgeEnabled') !== 'false';
    const badgeLanguage = localStorage.getItem('badgeLanguage');

    const dataStr = localStorage.getItem(url);
    let data = null;
    if (dataStr) {
        try {
            data = JSON.parse(dataStr);
            if (data && badgeLanguage) {
                data.language = badgeLanguage;
                data.translations = await getTranslations(badgeLanguage);
            }
        } catch (e) {
            console.error('Failed to parse data for badge:', e);
        }
    }
    return { enabled, data };
}

function updateIcon(tabId, grade) {
    browser.pageAction.setIcon(
        {
            tabId,
            path: getImagesPathFromScore(grade)
        }
    );
}

function getImagesPathFromScore(score) {
    const DIRECTORY_PATH = "icons";
    if (score) {
        return {
            16: `${DIRECTORY_PATH}/16/${score}.jpg`,
            32: `${DIRECTORY_PATH}/${score}.jpg`,
        };
    }

    return {
        16: `${DIRECTORY_PATH}/16/unknown.jpg`,
        32: `${DIRECTORY_PATH}/unknown.jpg`,
    };
}

function renderResult(tabId, parsedData) {
    if(parsedData === null ) {
        updateIcon(tabId, null);
    } else {
        const { grade, score, requests } = parsedData;
        updateIcon(tabId, grade);
    }

    browser.pageAction.show(tabId);
}

async function storeResult(tabId, url, parsedData, unlockMyData = null, breaches = null, termsArchive = null) {
    const visitedAt = new Date();
    const dataToStore = { ...parsedData, visitedAt };
    if (unlockMyData) {
        dataToStore.unlockMyData = unlockMyData;
    }
    if (breaches) {
        dataToStore.breaches = breaches;
    }
    if (termsArchive) {
        dataToStore.termsArchive = termsArchive;
    }
    localStorage.setItem(url, JSON.stringify(dataToStore));

    // Send data to badge
    const enabled = localStorage.getItem('badgeEnabled') !== 'false';
    if (enabled) {
        const badgeLanguage = localStorage.getItem('badgeLanguage');
        const dataToSend = { ...dataToStore };
        if (badgeLanguage) {
            dataToSend.language = badgeLanguage;
            dataToSend.translations = await getTranslations(badgeLanguage);
        }

        browser.tabs.sendMessage(tabId, {
            action: 'updateBadge',
            data: dataToSend
        }).catch(() => {
            // Content script might not be injected or ready
        });
    }

    //disable statistics
    // const { score } = parsedData;
    // // for statistics purpose
    // if(score < 50) {
    //     const { score, requests, grade } = parsedData;
    //     fetch(`${baseURL}ecoindex?pth=${url}&scr=${score}&rqt=${requests}&bge=${grade}`);
    // }

}

// select only the information we need for the app
function parseData(data) {
    const { grade, score, requests, id } = data;
    return { grade, score, requests, id };
}

function parseEcoIndexPayload(ecoIndexPayload) {
    const parsedData = parseData(ecoIndexPayload["latest-result"]);

    // if grade exist, we assume the others fields are here as well
    if(parsedData.grade !== "") {
        return parsedData;
    }

    const hostResults = ecoIndexPayload["host-results"];
    if(hostResults.length === 0) {
        throw new Error("Cannot retrieve the grade");
    }

    return parseData(hostResults[0]);
}

async function callEcoIndex(tabId, url, retry) {
    // Fetch EcoIndex, Unlock My Data, breaches, and terms archive in parallel
    const [ecoIndexResult, unlockMyData, breaches, termsArchive] = await Promise.all([
        getEcoIndexCachetResult(tabId, url),
        findUnlockMyDataService(url),
        findBreachesForDomain(url),
        findTermsArchiveForDomain(url)
    ]);

    // if no result. Ask EcoIndex to analyse the url
    if(ecoIndexResult === null) {
        const tokenFromTaskResponse = await askToComputeEvaluation(url);
        if (tokenFromTaskResponse.ok && retry === false) {
            // try again in case of the task is processed within 30 seconds
            setTimeout(() => {
                callEcoIndex(tabId, url, true);
            },30000);
            return;
        } else {
            // Still store Unlock My Data, breaches, and terms archive even if EcoIndex fails
            if (unlockMyData || breaches || termsArchive) {
                const dataToStore = { visitedAt: new Date() };
                if (unlockMyData) dataToStore.unlockMyData = unlockMyData;
                if (breaches) dataToStore.breaches = breaches;
                if (termsArchive) dataToStore.termsArchive = termsArchive;
                localStorage.setItem(url, JSON.stringify(dataToStore));

                // Also send incomplete data to badge
                const enabled = localStorage.getItem('badgeEnabled') !== 'false';
                if (enabled) {
                    const badgeLanguage = localStorage.getItem('badgeLanguage');
                    const dataToSend = { ...dataToStore };
                    if (badgeLanguage) {
                        dataToSend.language = badgeLanguage;
                        const translations = await getTranslations(badgeLanguage);
                        if (translations) {
                            dataToSend.translations = translations;
                        }
                    }

                    browser.tabs.sendMessage(tabId, {
                        action: 'updateBadge',
                        data: dataToSend
                    }).catch(() => {});
                }
            }
            renderResult(tabId, null);
            return;
        }
    }
    renderResult(tabId, ecoIndexResult);
    storeResult(tabId, url, ecoIndexResult, unlockMyData, breaches, termsArchive);
}

async function getEcoIndexCachetResult(tabId, url) {
    const ecoIndexResponse = await fetch(`https://bff.ecoindex.fr/api/results/?url=${url}`);
    if (ecoIndexResponse.ok) {
        const ecoIndexResponseObject = await ecoIndexResponse.json();
        return parseEcoIndexPayload(ecoIndexResponseObject);
    } else {
        return null;
    }
}

async function askToComputeEvaluation(url) {
    return fetch("https://bff.ecoindex.fr/api/tasks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({url})
    });
}

function isValidUrl(url) {
    const validUrls = ["https://", "http://"];
    const found = validUrls.find(validUrl => url.includes(validUrl) );

    return found;
}

/*
Each time a tab is updated, reset the page action for that tab.
*/
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    if (tab.status == "complete" && tab.active) {

        if(!isValidUrl(tab.url)){
            return;
        }
        // try to get results cached in the ecoindex server
        callEcoIndex(tab.id, tab.url, false);
    }
});