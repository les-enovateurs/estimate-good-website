// Initialize LLM tracker state
let llmTrackerState = {
    isInitialized: false,
    currentUrl: null,
    currentService: null
};

function updateIcon(tabId, grade) {
    chrome.action.setIcon(
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

    chrome.action.enable(tabId);
}

async function storeResult(url, parsedData) {
    const visitedAt = new Date();
    console.log(visitedAt, url)
    await chrome.storage.local.set({[url]: JSON.stringify({ ...parsedData, visitedAt })});
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

// Message handler for communication between scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle ecoindex result messages
    if (message.type === 'ecoindex_result') {
        const { tabId, data } = message;
        renderResult(tabId, parseData(data));
        sendResponse({ status: 'success' });
        return true;
    }

    // Handle messages that don't require tab information
    if (message.action === "getLLMStatistics") {
        // Get statistics from storage
        chrome.storage.local.get(['llmStatistics'], function(result) {
            if (result.llmStatistics) {
                sendResponse(result.llmStatistics);
            } else {
                sendResponse({
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
                });
            }
        });
        return true;
    }

    // Handle messages that require tab information
    if (!sender || !sender.tab || !sender.tab.id) {
        console.warn("Message received without tab information:", message);
        sendResponse({ status: 'error', message: 'This operation requires tab information' });
        return true;
    }

    const tabId = sender.tab.id;
    
    if (message.action === "isLLMService") {
        // Check if URL is an LLM service
        const isLLM = isLLMService(message.url);
        sendResponse(isLLM);
        return true;
    }
    
    if (message.action === "getLLMData") {
        chrome.storage.local.get([`llmData_${message.url}`], function(result) {
            sendResponse(result[`llmData_${message.url}`] || null);
        });
        return true;
    }
    
    if (message.action === "startLLMTracking") {
        const llmData = {
            url: message.url,
            service: message.service,
            startTime: Date.now(),
            inputTokens: 0,
            outputTokens: 0
        };
        chrome.storage.local.set({ [`llmData_${message.url}`]: llmData }, function() {
            sendResponse({status: "started"});
        });
        return true;
    }
    
    if (message.action === "updateLLMInput") {
        chrome.storage.local.get([`llmData_${message.url}`], function(result) {
            const llmData = result[`llmData_${message.url}`] || {};
            llmData.inputTokens = (llmData.inputTokens || 0) + estimateTokens(message.text);
            chrome.storage.local.set({ [`llmData_${message.url}`]: llmData }, function() {
                sendResponse({status: "updated"});
            });
        });
        return true;
    }
    
    if (message.action === "updateLLMOutput") {
        chrome.storage.local.get([`llmData_${message.url}`], function(result) {
            const llmData = result[`llmData_${message.url}`] || {};
            llmData.outputTokens = (llmData.outputTokens || 0) + estimateTokens(message.text);
            chrome.storage.local.set({ [`llmData_${message.url}`]: llmData }, function() {
                sendResponse({status: "updated"});
            });
        });
        return true;
    }
    
    if (message.action === "completeLLMTracking") {
        chrome.storage.local.get([`llmData_${message.url}`], function(result) {
            const llmData = result[`llmData_${message.url}`] || {};
            if (message.inputText) {
                llmData.inputTokens = (llmData.inputTokens || 0) + estimateTokens(message.inputText);
            }
            if (message.outputText) {
                llmData.outputTokens = (llmData.outputTokens || 0) + estimateTokens(message.outputText);
            }
            llmData.endTime = Date.now();
            
            // Update statistics
            chrome.storage.local.get(['llmStatistics'], function(statsResult) {
                const statistics = statsResult.llmStatistics || {
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
                
                statistics.totalInteractions++;
                statistics.totalInputTokens += llmData.inputTokens || 0;
                statistics.totalOutputTokens += llmData.outputTokens || 0;
                
                // Update service breakdown
                if (!statistics.serviceBreakdown[llmData.service]) {
                    statistics.serviceBreakdown[llmData.service] = {
                        interactions: 0,
                        inputTokens: 0,
                        outputTokens: 0
                    };
                }
                statistics.serviceBreakdown[llmData.service].interactions++;
                statistics.serviceBreakdown[llmData.service].inputTokens += llmData.inputTokens || 0;
                statistics.serviceBreakdown[llmData.service].outputTokens += llmData.outputTokens || 0;
                
                // Calculate carbon impact and comparisons
                const carbonImpact = calculateCarbonImpact(llmData);
                statistics.totalCarbonImpact += carbonImpact;
                statistics.comparisons = calculateComparisons(statistics.totalCarbonImpact);
                
                chrome.storage.local.set({ llmStatistics: statistics }, function() {
                    sendResponse({status: "completed"});
                });
            });
        });
        return true;
    }
    
    if (message.action === "clearLLMData") {
        chrome.storage.local.clear(function() {
            sendResponse({status: "cleared"});
        });
        return true;
    }
    
    return true;
});

// Helper function to estimate tokens
function estimateTokens(text) {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil((text || '').length / 4);
}

// Helper function to calculate carbon impact
function calculateCarbonImpact(llmData) {
    // Rough estimation: 1 token ≈ 0.000001 kg CO2
    const totalTokens = (llmData.inputTokens || 0) + (llmData.outputTokens || 0);
    return totalTokens * 0.000001;
}

// Helper function to calculate comparisons
function calculateComparisons(carbonImpact) {
    // Rough estimations:
    // - Car: 0.2 kg CO2 per km
    // - Smartphone: 0.01 kg CO2 per charge
    // - Coffee: 0.1 kg CO2 per cup
    return {
        carKilometers: carbonImpact / 0.2,
        smartphoneCharges: carbonImpact / 0.01,
        coffeeCups: carbonImpact / 0.1
    };
}

// Tab update listener
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (isLLMService(tab.url)) {
            updateIcon(tabId, "LLM");
            chrome.action.enable(tabId);
        } else if (isValidUrl(tab.url)) {
            callEcoIndex(tab.id, tab.url, false);
        }
    }
});

// Function to detect LLM services
function isLLMService(url) {
    const llmServices = [
        'openai.com',
        'chatgpt.com',
        'claude.ai',
        'anthropic.com',
        'gemini.google.com',
        'bing.com/chat'
    ];
    
    return llmServices.some(service => url.includes(service));
}