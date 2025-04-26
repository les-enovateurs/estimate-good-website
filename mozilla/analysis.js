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
    const validUrls = ["https://", "http://"];
    const found = validUrls.find(validUrl => url.includes(validUrl) );

    return found;
}

// Update your injectContentScript function with better error handling

async function injectContentScript(tabId, scriptPath) {
    try {
        // Check if we have permission for this tab
        const tabInfo = await browser.tabs.get(tabId);
        
        // Try the new scripting API first
        if (typeof browser.scripting !== 'undefined') {
            await browser.scripting.executeScript({
                target: {tabId: tabId},
                files: [scriptPath]
            });
        } else {
            // Fall back to the old API
            await browser.tabs.executeScript(tabId, {
                file: scriptPath
            });
        }
        return true;
    } catch (error) {
        console.error("Failed to inject script:", error);
        
        // If it's a permission error, log a more helpful message
        if (error.message.includes("Missing host permission") || 
            error.message.includes("Cannot access")) {
            console.warn(`Add host permission for ${scriptPath} in your manifest.json`);
        }
        
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
    console.log("🌱 Message reçu dans analysis.js:", message);
    
    // Handle LLM service detection
    if (message.action === "isLLMService") {
        const llmService = window.llmTracker.detectLLMService(message.url);
        console.log(`🌱 Détection LLM pour ${message.url}: ${llmService}`);
        return Promise.resolve(llmService !== null);
    }
    
    // Handle getting LLM data
    if (message.action === "getLLMData") {
        console.log(`🌱 Récupération des données LLM pour ${message.url}`);
        const data = window.llmTracker.getCurrentInteraction(message.url);
        console.log("🌱 Données actuelles:", data);
        return Promise.resolve(data);
    }
    
    // Handle starting LLM tracking
    if (message.action === "startLLMTracking") {
        console.log(`🌱 Démarrage du suivi LLM pour ${message.service} à ${message.url}`);
        window.llmTracker.startTracking(message.url, message.service);
        return Promise.resolve({status: "started"});
    }
    
    // Handle updating LLM inputs
    if (message.action === "updateLLMInput") {
        console.log(`🌱 Mise à jour des tokens d'entrée: ${message.text.length} caractères`);
        window.llmTracker.updateInputTokens(message.text);
        return Promise.resolve({status: "updated"});
    }
    
    // Handle updating LLM outputs
    if (message.action === "updateLLMOutput") {
        console.log(`🌱 Mise à jour des tokens de sortie: ${message.text.length} caractères`);
        window.llmTracker.updateOutputTokens(message.text);
        return Promise.resolve({status: "updated"});
    }
    
    // Handle completing LLM tracking
    if (message.action === "completeLLMTracking") {
        console.log("🌱 Finalisation du suivi LLM");
        
        // Include any final data passed from the content script
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

    // Handle ensuring icon stays visible for SPAs
    if (message.action === "ensureIconVisible") {
        const llmService = window.llmTracker.detectLLMService(message.url);
        if (llmService && sender.tab) {
            // Re-show the icon
            updateIcon(sender.tab.id, "LLM");
            browser.pageAction.show(sender.tab.id);
            return Promise.resolve({status: "icon refreshed"});
        }
        return Promise.resolve({status: "not an LLM site"});
    }

    console.log("🌱 Action non reconnue:", message.action);
    return false;
});

// Dans background.js
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