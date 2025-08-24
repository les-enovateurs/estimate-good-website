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
    if (score === "LLM") {
        // Special icon for LLM services
        return {
            16: `${DIRECTORY_PATH}/16/llm.jpg`,
            32: `${DIRECTORY_PATH}/llm.jpg`,
        };
    } else if (score) {
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

function storeResult(url, parsedData) {
    const visitedAt = new Date();
    localStorage.setItem(url, JSON.stringify({...parsedData, visitedAt }));
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
    const ecoIndexResult = await getEcoIndexCachetResult(tabId, url);

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
            renderResult(tabId, null);
            return;
        }
    }
    renderResult(tabId, ecoIndexResult);
    storeResult(url, ecoIndexResult);
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
    return url.startsWith('http://') || url.startsWith('https://');
}

// Update your injectContentScript function with better error handling

async function injectContentScript(tabId, scriptPath) {
    try {
        if (typeof browser.scripting !== 'undefined') {
            await browser.scripting.executeScript({
                target: {tabId: tabId},
                files: [scriptPath]
            });
        } else {
            await browser.tabs.executeScript(tabId, {
                file: scriptPath
            });
        }
        return true;
    } catch (error) {
        console.error(`Failed to inject script ${scriptPath}:`, error);
        return false;
    }
}

/*
Each time a tab is updated, reset the page action for that tab.
*/
browser.tabs.onUpdated.addListener(async (id, changeInfo, tab) => {
    if (tab.status == "complete" && tab.active) {
        // Check if this is an LLM service
        const llmService = window.llmTracker.detectLLMService(tab.url);
        if (llmService) {
            // Try to inject the content script
            const scriptInjected = await injectContentScript(tab.id, "/llm-impact/content-script.js");
            
            if (scriptInjected) {
                browser.tabs.sendMessage(tab.id, {
                    action: "trackLLM",
                    service: llmService
                });
                
                // Update icon to show LLM tracking
                updateIcon(tab.id, "LLM");
                browser.pageAction.show(tab.id);
            } else {
                // Fallback - we still show the LLM icon but we can't track interactions
                console.warn(`Can't track LLM usage on ${tab.url} - insufficient permissions`);
                updateIcon(tab.id, "LLM");
                browser.pageAction.show(tab.id);
            }
            return;
        }

        if(!isValidUrl(tab.url)){
            return;
        }
        // try to get results cached in the ecoindex server
        callEcoIndex(tab.id, tab.url, false);
    }
});

// Message handler for communication between scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "isLLMService") {
        const llmService = window.llmTracker.detectLLMService(message.url);
        return Promise.resolve(llmService !== null);
    }
    
    if (message.action === "getLLMData") {
        const data = window.llmTracker.getCurrentInteraction(message.url);
        return Promise.resolve(data);
    }
    
    if (message.action === "startLLMTracking") {
        window.llmTracker.startTracking(message.url, message.service);
        return Promise.resolve({status: "started"});
    }
    
    if (message.action === "updateLLMInput") {
        window.llmTracker.updateInputTokens(message.text);
        return Promise.resolve({status: "updated"});
    }
    
    if (message.action === "updateLLMOutput") {
        window.llmTracker.updateOutputTokens(message.text);
        return Promise.resolve({status: "updated"});
    }
    
    if (message.action === "completeLLMTracking") {
        if (message.inputText) {
            window.llmTracker.updateInputTokens(message.inputText);
        }
        if (message.outputText) {
            window.llmTracker.updateOutputTokens(message.outputText);
        }
        window.llmTracker.completeInteraction();
        return Promise.resolve({status: "completed"});
    }
    
    // Handle getting statistics
    if (message.action === "getLLMStatistics") {
        console.log("🌱 Récupération des statistiques LLM");
        return window.llmTracker.getStatistics()
            .then(stats => {
                console.log("🌱 Statistiques récupérées:", stats);
                return stats;
            })
            .catch(error => {
                console.error("🌱 Erreur lors de la récupération des statistiques:", error);
                return {
                    totalInteractions: 0,
                    totalInputTokens: 0,
                    totalOutputTokens: 0,
                    totalCarbonImpact: 0,
                    serviceBreakdown: {},
                    comparisons: {
                        carKilometers: 0,
                        smartphoneCharges: 0,
                        coffeeCups: 0
                    }
                };
            });
    }
    
    // Handle clearing data
    if (message.action === "clearLLMData") {
        console.log("🌱 Effacement des données LLM");
        window.llmTracker.clearInteractions();
        return Promise.resolve({status: "cleared"});
    }
    
    // Handle ensuring icon stays visible for SPAs
    if (message.action === "ensureIconVisible") {
        console.log("🌱 Ensuring icon is visible for:", message.url);
        
        // Only proceed if we have a valid sender tab
        if (!sender || !sender.tab || !sender.tab.id) {
            console.log("🌱 No valid tab in sender:", sender);
            return Promise.resolve({status: "no valid tab"});
        }
        
        const llmService = window.llmTracker.detectLLMService(message.url);
        if (llmService) {
            // Re-show the icon
            updateIcon(sender.tab.id, "LLM");
            browser.pageAction.show(sender.tab.id);
            return Promise.resolve({status: "icon refreshed"});
        }
        return Promise.resolve({status: "not an LLM site"});
    }

    // Add this to your browser.runtime.onMessage handler

    if (message.action === "refreshLLMData") {
        console.log("🌱 Refreshing LLM data for:", message.url);
        
        // Find the tab that contains this URL
        return browser.tabs.query({url: message.url}).then(async (tabs) => {
            if (tabs.length > 0) {
                // Re-inject the content script to ensure data is current
                try {
                    await injectContentScript(tabs[0].id, "/llm-impact/content-script.js");
                    return {status: "refreshed"};
                } catch (err) {
                    console.error("Failed to refresh LLM data:", err);
                    return {status: "error", message: err.message};
                }
            }
            return {status: "no matching tab"};
        });
    }

    console.log("🌱 Action non reconnue:", message.action);
    return false;
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "ensureIconVisible") {
    // Mettre à jour l'icône basée sur l'URL
    const url = message.url;
    const tabId = sender.tab.id;
    
    // Vérifier si c'est un service LLM
    if (isLLMService(url)) {
      browser.pageAction.show(tabId);
      // Ou si vous utilisez browserAction:
      // browser.browserAction.setIcon({
      //   tabId: tabId,
      //   path: "/icons/llm-icon.png" 
      // });
    }
    
    return Promise.resolve({success: true});
  }
  // Autres gestionnaires...
});

// Fonction pour détecter les services LLM
function isLLMService(url) {
  for (const service in LLM_SERVICES) {
    if (LLM_SERVICES[service].urlPattern.test(url)) {
      return true;
    }
  }
  return false;
}