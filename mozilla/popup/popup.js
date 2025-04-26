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
    "meta": {//openai/claude/gemini/default
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
  

browser.tabs.query({currentWindow: true, active: true})
.then(async (tabs) => {
    const url = tabs[0].url;
    
    // Check if this is an LLM service
    const isLLMService = await browser.runtime.sendMessage({
        action: "isLLMService",
        url: url
    });
    
    if (isLLMService) {
        // Display LLM impact information
        displayLLMImpact(url);
        return;
    }
    
    // Continue with normal EcoIndex display
    const parsedData = getResultFromUrl(url);
    const { id, score, requests, grade } = parsedData;

    updateUrl(url);
    updateEcoIndexReportLink(id);
    updateScore(score);
    updateNumberOfRequests(requests);
    updateBorderColor(grade);

    const sourceOfData = findById("source-of-data");
    sourceOfData.innerHTML = browser.i18n.getMessage("sourceOfData");

    const settings = findById("settings");
    settings.addEventListener('click', () => {
        window.open("/options/options.html", '_blank');
    })

    const settingsText = findById("settings-text")
    settingsText.innerHTML = chrome.i18n.getMessage("settings");
});

async function displayLLMImpact(url) {
    // Get the current LLM tracking data
    const llmData = await browser.runtime.sendMessage({
        action: "getLLMData",
        url: url
    });
    
    // Update UI with LLM info
    updateUrl(url);
    
    // Update title to show LLM tracking
    const scoreTitle = findById("score-title");
    scoreTitle.innerHTML = browser.i18n.getMessage("llmImpactTitle") || "LLM Carbon Impact:";
    
    // Get the current interaction or most recent one
    const interaction = llmData.currentInteraction || (llmData.lastInteraction || null);
    
    // Show carbon impact
    const scoreDom = findById("score");
    if (interaction) {
        const carbonImpact = interaction.carbonImpact.toFixed(6);
        scoreDom.innerHTML = carbonImpact + " gCO2eq";
        
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
            scoreDom.innerHTML += `<br><small>${serviceInfo}</small>`;
        }
    } else {
        scoreDom.innerHTML = "0.000000 gCO2eq";
    }
    
    // Show token count instead of requests
    const requestsTitle = findById("number-of-requests-title");
    requestsTitle.innerHTML = browser.i18n.getMessage("llmTokensLabel") || "Tokens (input + output):";
    
    const requestsDom = findById("number-of-requests");
    if (interaction) {
        const inputTokens = interaction.inputTokens || 0;
        const outputTokens = interaction.outputTokens || 0;
        const totalTokens = inputTokens + outputTokens;
        
        // Ajouter des infos sur le seuil utilisé
        let serviceType = "openai"; // par défaut
        if (interaction.service && interaction.service.toLowerCase().includes("meta")) {
            serviceType = "meta";
        }
        
        // Trouver le seuil correspondant
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
        
        requestsDom.innerHTML = `${inputTokens} + ${outputTokens}`;
        requestsDom.innerHTML += `<br><small>Seuil: ${selectedThreshold} tokens</small>`;
    } else {
        requestsDom.innerHTML = "0 + 0";
    }
    
    // Update source
    const sourceOfData = findById("source-of-data");
    sourceOfData.innerHTML = "source: Ecologits";
    
    // Update link to EcoLLM info
    const ecoIndexAnchor = findById("ecoindex-result");
    ecoIndexAnchor.innerHTML = "Learn more about LLM impact";
    ecoIndexAnchor.href = "https://github.com/genai-impact/ecologits";
    
    // Update border color for LLM services
    const cardDom = findById("card-with-score");
    cardDom.style.borderColor = "#30A8A7"; // Use secondary color
    
    // Add settings button handler
    const settings = findById("settings");
    settings.addEventListener('click', () => {
        window.open("/options/options.html#llm-impact", '_blank');
    });
    
    const settingsText = findById("settings-text");
    settingsText.innerHTML = browser.i18n.getMessage("settings") || "Settings";
}

function updateNumberOfRequests(requests) {
    requestsTitle = findById("number-of-requests-title");
    requestsTitle.innerHTML = browser.i18n.getMessage("numberOfRequestsTitle");

    requestsDom = findById("number-of-requests");
    requestsDom.innerHTML = requests;
}

function updateScore(score) {
    scoreTitle = findById("score-title");
    scoreTitle.innerHTML = browser.i18n.getMessage("scoreTitle");

    scoreDom = findById("score");
    scoreDom.innerHTML = browser.i18n.getMessage("scoreResult", [score]);
}

function updateUrl(url) {
    const urlDom = findById("url");
    urlDom.innerHTML = url;
}

function updateEcoIndexReportLink(id) {
    const ecoIndexAnchor = findById("ecoindex-result")
    ecoIndexAnchor.innerHTML = browser.i18n.getMessage("detailedReport");
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