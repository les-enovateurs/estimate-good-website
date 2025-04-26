/**
 * LLM Impact Tracker Module
 * Based on the Ecologits project: https://github.com/genai-impact/ecologits/
 */

// LLM services to track and their detection patterns
const LLM_SERVICES = {
  'ChatGPT': {
    urlPattern: /chat\.openai\.com|chatgpt\.com/ 
  },
  'Claude': {
    urlPattern: /claude\.ai|anthropic\.com/
  },
  'Gemini': {
    urlPattern: /gemini\.google\.com/
  },
  'Bing Chat': {
    urlPattern: /bing\.com\/chat/
  }
};

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


const EMISSIONS_FACTORS = {
  // gCO2eq per token
  inference: {
    small: 0.00000121,   // Small models like GPT-3
    medium: 0.00000382,  // Medium models like GPT-3.5
    large: 0.00000922    // Large models like GPT-4, Claude
  }
};

// Approximate tokens per character for various languages
const TOKENS_PER_CHAR = {
  english: 0.25,         // ~4 characters per token
  nonEnglish: 0.16       // ~6 characters per token
};

class LLMTracker {
  constructor() {
    this.interactions = {};
    this.currentInteraction = null;
    this.isTracking = false;
    this.tokensPerChar = TOKENS_PER_CHAR.english; // Default to English
    console.log("LLM Tracker initialized");
  }

  // Ajoutez cette méthode au logger de débogage

  /**
   * Journalise les événements de suivi
   * @param {string} message - Le message à journaliser
   * @param {*} data - Données optionnelles à inclure
   */
  logEvent(message, data = null) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    if (data) {
      console.log(`[${timestamp}] 🌱 ${message}`, data);
    } else {
      console.log(`[${timestamp}] 🌱 ${message}`);
    }
  }

  /**
   * Start tracking LLM interactions on a page
   * @param {string} url - The URL of the page
   * @param {string} serviceName - The LLM service name
   */
  startTracking(url, serviceName) {
    this.logEvent(`Starting to track ${serviceName} at ${url}`);
    this.isTracking = true;
    this.currentInteraction = {
      url,
      service: serviceName,
      startTime: new Date(),
      inputTokens: 0,
      outputTokens: 0,
      carbonImpact: 0
    };
    
    this.logEvent("Current interaction initialized", this.currentInteraction);
    return this.currentInteraction;
  }

  /**
   * Estimate the number of tokens in a text
   * @param {string} text - The text to estimate tokens for
   * @returns {number} - Estimated token count
   */
  estimateTokens(text) {
    if (!text) return 0;
    return Math.round(text.length * this.tokensPerChar);
  }

  /**
   * Calculate the carbon impact of the current interaction
   */
  calculateCarbonImpact() {
    if (!this.currentInteraction) return 0;

    const { inputTokens, outputTokens, service } = this.currentInteraction;
    const totalTokens = inputTokens + outputTokens;
    
    // Déterminer quel service LLM est utilisé
    let serviceType = "openai"; // Défaut sur openai
    
    if (service && service.toLowerCase().includes("meta")) {
      serviceType = "meta";
    }
    
    // Obtenez les seuils de tokens disponibles pour ce service
    const thresholds = Object.keys(EMISSIONS_FACTORS_RANGE_TOKEN[serviceType])
      .map(Number)
      .sort((a, b) => a - b);
    
    // Prendre par défaut la valeur la plus haute (plus conservateur)
    let selectedThreshold = thresholds[thresholds.length - 1];
    
    // Chercher le seuil approprié en partant du plus bas
    for (const threshold of thresholds) {
      if (totalTokens <= threshold) {
        selectedThreshold = threshold;
        break;
      }
    }
    
    // Calculer l'impact carbone en utilisant un facteur proportionnel
    const thresholdData = EMISSIONS_FACTORS_RANGE_TOKEN[serviceType][selectedThreshold];
    
    // Calcul proportionnel: (totalTokens / selectedThreshold) * gCO2eq du seuil
    const carbonImpact = (totalTokens / selectedThreshold) * thresholdData.gCO2eq;
    
    // Calcul proportionnel pour l'énergie: (totalTokens / selectedThreshold) * energy du seuil
    const energyImpact = (totalTokens / selectedThreshold) * thresholdData.energy;
    
    this.currentInteraction.carbonImpact = carbonImpact;
    this.currentInteraction.energyImpact = energyImpact;
    
    this.logEvent(`Calculated carbon impact: ${carbonImpact.toFixed(6)} gCO2eq for ${totalTokens} tokens (${inputTokens}+${outputTokens})`);
    this.logEvent(`Calculated energy impact: ${energyImpact.toFixed(6)} Wh for ${totalTokens} tokens (${inputTokens}+${outputTokens})`);
    this.logEvent(`Used ${serviceType} threshold: ${selectedThreshold} tokens with factor: ${thresholdData.gCO2eq} gCO2eq / ${thresholdData.energy} Wh`);
    
    return {
      carbonImpact,
      energyImpact
    };
  }

  /**
   * Get the current interaction for a URL
   * @param {string} url - The URL to get the interaction for
   * @returns {object|null} - The current interaction or null
   */
  getCurrentInteraction(url) {
    console.log(`Getting current interaction for ${url}`);
    console.log("Current interaction:", this.currentInteraction);
    
    if (this.currentInteraction && this.currentInteraction.url === url) {
      return { currentInteraction: this.currentInteraction };
    }
    
    // Check if we have a recent interaction for this URL
    for (const id in this.interactions) {
      if (this.interactions[id].url === url) {
        return { lastInteraction: this.interactions[id] };
      }
    }
    
    return { currentInteraction: null };
  }

  /**
   * Update input tokens based on text
   * @param {string} text - The input text
   */
  updateInputTokens(text) {
    if (!this.currentInteraction) {
      this.logEvent("No current interaction to update input tokens");
      // Auto-start tracking if needed
      const url = window.location.href;
      const service = this.detectLLMService(url);
      if (service) {
        this.startTracking(url, service);
      } else {
        return;
      }
    }
    
    const tokens = this.estimateTokens(text);
    this.logEvent(`Updating input tokens: ${tokens} from text length ${text.length}`);
    
    this.currentInteraction.inputTokens = tokens;
    this.calculateCarbonImpact();

    // Save data immediately to ensure it's captured
    this.saveInteractionInProgress();
  }

  /**
   * Update output tokens based on text
   * @param {string} text - The output text
   */
  updateOutputTokens(text) {
    if (!this.currentInteraction) {
      console.warn("No current interaction to update output tokens");
      return;
    }
    
    const tokens = this.estimateTokens(text);
    console.log(`Updating output tokens: ${tokens} from text length ${text.length}`);
    
    this.currentInteraction.outputTokens = tokens;
    this.calculateCarbonImpact();

    // Save data after each significant update
    // This ensures we capture the data even if the user never completes the interaction
    this.saveInteractionInProgress();
  }

  /**
   * Complete the current interaction and save it
   */
  completeInteraction() {
    if (!this.currentInteraction) {
      console.warn("No current interaction to complete");
      return;
    }
    
    console.log("Completing current interaction");
    
    this.currentInteraction.endTime = new Date();
    this.currentInteraction.duration = 
      (this.currentInteraction.endTime - this.currentInteraction.startTime) / 1000; // in seconds
    
    // Calculate final carbon impact
    this.calculateCarbonImpact();
    
    // Store this interaction
    const interactionId = `${this.currentInteraction.service}-${Date.now()}`;
    this.interactions[interactionId] = {...this.currentInteraction};
    
    // Save to storage
    this.saveInteractions();
    
    this.isTracking = false;
    const completed = {...this.currentInteraction};
    this.currentInteraction = null;
    
    return completed;
  }

  /**
   * Save interactions to browser storage
   */
  saveInteractions() {
    // Instead of storing stringified data, store the raw interactions object
    if (typeof browser !== 'undefined') {
      browser.storage.local.set({
        llmInteractions: this.interactions, // Store directly without JSON.stringify
        lastUpdated: new Date().toISOString()
      });
    } else if (typeof chrome !== 'undefined') {
      chrome.storage.local.set({
        llmInteractions: this.interactions, // Store directly without JSON.stringify
        lastUpdated: new Date().toISOString()
      });
    }
    
    console.log("Saved interactions to storage", Object.keys(this.interactions).length);
  }

  /**
   * Load saved interactions from browser storage
   */
  async loadInteractions() {
    return new Promise((resolve) => {
      const storageAPI = typeof browser !== 'undefined' ? browser.storage : chrome.storage;
      
      storageAPI.local.get(['llmInteractions', 'lastUpdated'], (result) => {
        if (result && result.llmInteractions) {
          try {
            // No need to parse, directly assign the object
            this.interactions = result.llmInteractions || {};
            console.log("Loaded interactions from storage:", Object.keys(this.interactions).length);
          } catch (e) {
            console.error('Error loading LLM interactions:', e);
            this.interactions = {};
          }
        }
        resolve(this.interactions);
      });
    });
  }

  /**
   * Get statistics about tracked LLM interactions
   */
  async getStatistics() {
    try {
      await this.loadInteractions();
      
      console.log("Building statistics from interactions:", Object.keys(this.interactions).length);
      console.log("Interactions data:", this.interactions);
      
      let totalInteractions = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCarbonImpact = 0;
      let totalEnergyImpact = 0;
      let serviceBreakdown = {};
      
      // Process all interactions
      for (const id in this.interactions) {
        const interaction = this.interactions[id];
        
        // Skip invalid entries
        if (!interaction || typeof interaction !== 'object') continue;
        
        totalInteractions++;
        totalInputTokens += parseInt(interaction.inputTokens || 0);
        totalOutputTokens += parseInt(interaction.outputTokens || 0);
        totalCarbonImpact += parseFloat(interaction.carbonImpact || 0);
        totalEnergyImpact += parseFloat(interaction.energyImpact || 0);
        
        // Track service-specific statistics
        const serviceName = interaction.service || 'Unknown';
        if (!serviceBreakdown[serviceName]) {
          serviceBreakdown[serviceName] = {
            count: 0,
            carbonImpact: 0,
            energyImpact: 0
          };
        }
        
        serviceBreakdown[serviceName].count++;
        serviceBreakdown[serviceName].carbonImpact += parseFloat(interaction.carbonImpact || 0);
        serviceBreakdown[serviceName].energyImpact += parseFloat(interaction.energyImpact || 0);
      }
      
      const stats = {
        totalInteractions,
        totalInputTokens,
        totalOutputTokens,
        totalCarbonImpact,
        totalEnergyImpact,
        serviceBreakdown,
        // Comparisons to help users understand the impact
        comparisons: {
          // Convert gCO2eq to everyday equivalents
          carKilometers: totalCarbonImpact / 122, // gCO2eq per km of driving
          smartphoneCharges: totalCarbonImpact / 3.8, // gCO2eq per smartphone charge
          coffeeCups: totalCarbonImpact / 21, // gCO2eq per cup of coffee
        },
        // Energy comparisons
        energyComparisons: {
          smartphoneCharges: totalEnergyImpact / 15, // Wh per smartphone charge (approx.)
          ledBulbHours: totalEnergyImpact / 10, // Wh for a 10W LED bulb for 1 hour
          laptopMinutes: totalEnergyImpact / 45  // Wh for average laptop use for 1 hour (45W/h)
        }
      };
      
      console.log("LLM usage statistics:", stats);
      return stats;
    } catch (error) {
      console.error("Error getting LLM statistics:", error);
      // Return default empty stats
      return {
        totalInteractions: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCarbonImpact: 0,
        totalEnergyImpact: 0,
        serviceBreakdown: {},
        comparisons: {
          carKilometers: 0,
          smartphoneCharges: 0,
          coffeeCups: 0
        },
        energyComparisons: {
          smartphoneCharges: 0,
          ledBulbHours: 0,
          laptopMinutes: 0
        }
      };
    }
  }

  /**
   * Clear all stored interactions
   */
  clearInteractions() {
    console.log("Clearing all LLM interactions");
    this.interactions = {};
    this.saveInteractions();
  }

  /**
   * Detect if the current page is an LLM service
   * @param {string} url - The URL to check
   * @returns {string|null} - The name of the LLM service if detected, null otherwise
   */
  detectLLMService(url) {
    for (const [serviceName, service] of Object.entries(LLM_SERVICES)) {
      if (service.urlPattern.test(url)) {
        console.log(`Detected LLM service: ${serviceName} for URL: ${url}`);
        return serviceName;
      }
    }
    return null;
  }

  /**
   * Sauvegarde l'état actuel (utile pour récupérer après refresh)
   */
  saveCurrentState() {
    if (!this.currentInteraction) return;
    
    const storageAPI = typeof browser !== 'undefined' ? browser.storage : chrome.storage;
    storageAPI.local.set({
      currentLLMInteraction: JSON.stringify(this.currentInteraction)
    });
    
    this.logEvent("État actuel sauvegardé");
  }

  /**
   * Charge l'état actuel (utile après refresh)
   */
  async loadCurrentState() {
    return new Promise((resolve) => {
      const storageAPI = typeof browser !== 'undefined' ? browser.storage : chrome.storage;
      
      storageAPI.local.get(['currentLLMInteraction'], (result) => {
        if (result && result.currentLLMInteraction) {
          try {
            this.currentInteraction = JSON.parse(result.currentLLMInteraction);
            this.isTracking = true;
            this.logEvent("État actuel chargé", this.currentInteraction);
          } catch (e) {
            this.logEvent("Erreur lors du chargement de l'état actuel", e);
            this.currentInteraction = null;
            this.isTracking = false;
          }
        }
        resolve(this.currentInteraction);
      });
    });
  }

  /**
   * Save interaction in progress
   * This ensures data is saved even if completeInteraction is never called
   */
  saveInteractionInProgress() {
    if (!this.currentInteraction) return;
    
    // Store this interaction
    const interactionId = `${this.currentInteraction.service}-${Date.now()}`;
    this.interactions[interactionId] = {...this.currentInteraction};
    
    // Save to storage
    this.saveInteractions();
    
    console.log("Saved in-progress interaction to history");
  }
}

// Create and export the tracker
const llmTracker = new LLMTracker();
window.llmTracker = llmTracker;
console.log("LLM Tracker global instance created");