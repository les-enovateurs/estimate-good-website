// Constants based on the Ecologits research
const EMISSIONS_FACTORS_RANGE_TOKEN = {
    "openai": 
    {//openai/claude/gemini/default
      50: {
          "energy":4.39,
          "gCO2eq":2.68 
      },
      170: {
        "energy":14.9,
        "gCO2eq":9.11 
      },  
      250: {
        "energy":21.9,
        "gCO2eq":13.4 
      },
      400: {
        "energy":35.1,
        "gCO2eq":21.4 
      },
      5000: {
        "energy":439,
        "gCO2eq":268 
      },
      15000: {
        "energy":1320,
        "gCO2eq":803 
      }
    },
    "meta": {//meta/llama3...
      50: {
          "energy":4.39,//Wh consumption
          "gCO2eq":2.68 // gCO2eq effect
      },
      170: {
        "energy":14.9,
        "gCO2eq":9.11 
      },
      250: {
        "energy":21.9,
        "gCO2eq":13.4 
      },
      400: {
        "energy":35.1,
        "gCO2eq":21.4 
      },
      5000: {
        "energy":1190,
        "gCO2eq":727 
      },
      15000: {
        "energy":3580,
        "gCO2eq":2180 
      },
    },
  };
  

// Modify the tab query event handler
chrome.tabs.query({currentWindow: true, active: true})
.then(async (tabs) => {
    const url = tabs[0].url;
    
    try {
        // Check if this is an LLM service
        const isLLMService = await chrome.runtime.sendMessage({
            action: "isLLMService",
            url: url
        });
        
        if (isLLMService) {
            // Force a refresh of LLM data before displaying
            await chrome.runtime.sendMessage({
                action: "refreshLLMData",
                url: url
            });
            
            // Now display LLM impact information with refreshed data
            displayLLMImpact(url);
            return;
        }
        
        // Continue with normal EcoIndex display
        const localStorage = window.localStorage;
        const parsedData = getResultFromUrl(url);
        
        if (!parsedData) {
            // No data available yet
            updateUrl(url);
            return;
        }
        
        const { id, score, requests, grade } = parsedData;
        
        updateUrl(url);
        updateScore(score);
        updateNumberOfRequests(requests);
        updateBorderColor(grade);
        
      const ecoIndexAnchor = findById("ecoindex-result");
      ecoIndexAnchor.addEventListener('click', () => {
        window.open("/options/options.html", '_blank');
    });   
        // Update source with link to EcoIndex
        const sourceOfData = findById("source-of-data");
        sourceOfData.innerHTML = `${chrome.i18n.getMessage("sourceOfData")} <a class="team-link" href="https://www.ecoindex.fr/resultat/?id=${id}" target="_blank">EcoIndex</a>`;
        
        
    } catch (error) {
        console.error("Error in popup initialization:", error);
    }
});

// Enhanced function for LLM impact display
async function displayLLMImpact(url) {
    // Try to get data directly from storage first
    let llmData = null;
    
    try {
        // Get data directly from storage
        const storageData = await new Promise(resolve => {
            chrome.storage.local.get(['llmInteractions', 'lastUpdated'], result => {
                resolve(result);
            });
        });
        
        if (storageData && storageData.llmInteractions) {
            // Find the interaction for this URL
            for (const id in storageData.llmInteractions) {
                const interaction = storageData.llmInteractions[id];
                if (interaction.url === url) {
                    llmData = { lastInteraction: interaction };
                    break;
                }
            }
        }
    } catch (error) {
        console.error("Error loading data from storage", error);
    }
    
    // If we couldn't get data from storage, fall back to messaging
    if (!llmData) {
        llmData = await chrome.runtime.sendMessage({
            action: "getLLMData",
            url: url
        });
    }
    
    // Add LLM mode class to body
    document.body.classList.add('llm-mode');
    
    // Update UI with LLM info
    updateUrl(url);
    
    // Update title to show LLM tracking
    const scoreTitle = findById("score-title");
    scoreTitle.innerHTML = chrome.i18n.getMessage("llmImpactTitle") || "LLM Carbon Impact:";
    
    // Get the current interaction or most recent one
    const interaction = llmData.currentInteraction || (llmData.lastInteraction || null);
    
    // Show carbon impact
    const scoreDom = findById("score");
    
    if (!interaction || typeof interaction.carbonImpact === 'undefined') {
        // No data available yet
        scoreDom.innerHTML = "Waiting for data... <span class='unit'>gCO₂eq</span>";
        
        // Set a timer to retry in 2 seconds
        setTimeout(() => {
            displayLLMImpact(url);
        }, 2000);
        return;
    }
    
    // Continue with the rest of your displayLLMImpact function...
    // (existing code that handles the interaction data)
    
    if (interaction) {
        const carbonImpact = interaction.carbonImpact.toFixed(2);
        scoreDom.innerHTML = carbonImpact + " <span class='unit'>gCO₂eq</span>";
        
        // Add a visual indicator based on impact severity
        const impactSeverity = getImpactSeverity(carbonImpact);
        updateImpactBadge(impactSeverity);
        updateBorderColor(impactSeverity);
        
        // Ajouter des infos sur le service et le modèle utilisé
        if (interaction.service) {
            // Déterminer le type de service (meta/openai)
            let serviceType = "openai"; // par défaut
            if (interaction.service.toLowerCase().includes("meta")) {
                serviceType = "meta";
            }
            
            // Afficher le service et la capacité d'émission
            const totalTokens = (interaction.inputTokens || 0) + (interaction.outputTokens || 0);
            const serviceInfo = `${interaction.service} (${serviceType})`;
            scoreDom.innerHTML += `<div class="service-info">${serviceInfo}</div>`;
        }
    } else {
        scoreDom.innerHTML = "0.000000 <span class='unit'>gCO₂eq</span>";
    }
    
    // Show token count instead of requests
    const requestsTitle = findById("number-of-requests-title");
    requestsTitle.innerHTML = chrome.i18n.getMessage("llmTokensLabel") || "Tokens & Energy:";

    const requestsDom = findById("number-of-requests");
    if (interaction) {
        const inputTokens = interaction.inputTokens || 0;
        const outputTokens = interaction.outputTokens || 0;
        const totalTokens = inputTokens + outputTokens;
        
        // Determine service type
        let serviceType = "openai"; // default
        if (interaction.service && interaction.service.toLowerCase().includes("meta")) {
            serviceType = "meta";
        }
        
        // Find the corresponding threshold
        const thresholds = Object.keys(EMISSIONS_FACTORS_RANGE_TOKEN[serviceType])
            .map(Number)
            .sort((a, b) => a - b);
        
        let selectedThreshold = thresholds[thresholds.length - 1];
        for (const threshold of thresholds) {
            if (totalTokens <= threshold) {
                selectedThreshold = threshold;
                break;
            }
        }
        
        // Get energy data for this threshold
        const energyConsumption = EMISSIONS_FACTORS_RANGE_TOKEN[serviceType][selectedThreshold].energy;

        // Si aucun token n'a été généré, utiliser une proportion basée sur les tokens d'entrée
        const energyValue = (totalTokens > 0) 
            ? (energyConsumption * (totalTokens / 50)) // Calculer en fonction des tokens d'entrée
            : (outputTokens > 0 ? energyConsumption : 0); // Utiliser la valeur standard ou 0
        
        // Display tokens and energy consumption
        requestsDom.innerHTML = `<div class="energy-info">${energyValue.toFixed(2)} <span class="unit">Wh</span></div>`;
    } else {
        requestsDom.innerHTML = `<div class="energy-info">0.00 <span class="unit">Wh</span></div>`;
    }
    
    // Update source and make it clickable
    const sourceOfData = findById("source-of-data");
    sourceOfData.innerHTML = `source: <a class="team-link" href="https://github.com/genai-impact/ecologits" target="_blank">Ecologits</a>`;
    
    // Update link to EcoLLM info and make it go to dashboard/settings
    const ecoIndexAnchor = findById("ecoindex-result");
    const messageDashboard = chrome.i18n.getMessage("viewImpactDashboard") || "View Impact Dashboard"
    ecoIndexAnchor.innerHTML = `    
        <span class="button-text">${messageDashboard}</span>
    `;
    ecoIndexAnchor.href = "/options/options.html#llm-impact";

    
    // Remove settings button handler since it's redundant now
    const settings = findById("settings");
    settings.style.display = "none";
    
    const settingsText = findById("settings-text");
    if (settingsText) {
        settingsText.style.display = "none";
    }
}

// Update the impact badge based on grade
function updateImpactBadge(grade) {
    const impactBadge = findById("impact-badge");
    if (!impactBadge) return;
    
    impactBadge.textContent = grade || 'A';
    
    // Set badge color based on grade
    let badgeColor = "#2e9b43"; // Default to A (green)
    switch(grade) {
        case "A": badgeColor = "#2e9b43"; break;
        case "B": badgeColor = "#34bc6e"; break;
        case "C": badgeColor = "#cadd00"; break;
        case "D": badgeColor = "#f7ed00"; break;
        case "E": badgeColor = "#ffce00"; break;
        case "F": badgeColor = "#fb9929"; break;
        case "G": badgeColor = "#f01c16"; break;
    }
    impactBadge.style.backgroundColor = badgeColor;
}

// Enhance the border color update to also update the badge
function updateBorderColor(grade) {
    const cardDom = findById("card-with-score");
    let gradeColor = "#2e9b43"; // Default to A (green)
    
    switch(grade) {
        case "A": gradeColor = "#2e9b43"; break;
        case "B": gradeColor = "#34bc6e"; break;
        case "C": gradeColor = "#cadd00"; break;
        case "D": gradeColor = "#f7ed00"; break;
        case "E": gradeColor = "#ffce00"; break;
        case "F": gradeColor = "#fb9929"; break;
        case "G": gradeColor = "#f01c16"; break;
    }
    
    cardDom.style.borderColor = gradeColor;
    
    // Also update the badge
    updateImpactBadge(grade);
}

// Helper function to determine impact severity
function getImpactSeverity(carbonImpact) {
    // Convert to number to be safe
    const impact = parseFloat(carbonImpact);
    
    if (impact < 5) return "A";
    if (impact < 15) return "B";
    if (impact < 30) return "C";
    if (impact < 60) return "D";
    if (impact < 100) return "E";
    if (impact < 200) return "F";
    return "G";
}

// Enhance the existing updateScore function
function updateScore(score) {
    scoreTitle = findById("score-title");
    scoreTitle.innerHTML = chrome.i18n.getMessage("scoreTitle");

    scoreDom = findById("score");
    scoreDom.innerHTML = chrome.i18n.getMessage("scoreResult", [score]);
    
    // Add visual indicators based on score
    if (score >= 75) {
        scoreDom.classList.add('excellent-score');
    } else if (score >= 50) {
        scoreDom.classList.add('good-score');
    } else if (score >= 30) {
        scoreDom.classList.add('medium-score');
    } else {
        scoreDom.classList.add('poor-score');
    }
}

function updateNumberOfRequests(requests) {
    requestsTitle = findById("number-of-requests-title");
    requestsTitle.innerHTML = chrome.i18n.getMessage("numberOfRequestsTitle");

    requestsDom = findById("number-of-requests");
    requestsDom.innerHTML = requests;
}

function updateUrl(url) {
    const urlDom = findById("url");
    urlDom.innerHTML = url;
}

function getResultFromUrl(url) {
    const localStorageData = localStorage.getItem(url);
    if(!localStorage) {
        return;
    }

    return JSON.parse(localStorageData);
}

// tool functions
function findById(id) {
    const domElement = document.getElementById(id);
    if(!domElement) {
        throw new Error(`Cannot find the domElement by id: ${id}`);
    }
    return domElement;
}