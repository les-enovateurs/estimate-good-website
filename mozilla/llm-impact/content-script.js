/**
 * Content script pour le suivi de l'impact des LLM
 * Fonctionne à la fois sur Claude et ChatGPT
 */

console.log("🌱 EcoSurf LLM Tracker démarré");

// État du traceur
let isTracking = false;
let currentService = null;
let lastInputText = "";
let lastOutputText = "";
let inputObserver = null;
let outputObserver = null;

// Écouteur de messages du script d'arrière-plan
browser.runtime.onMessage.addListener((message) => {
    console.log("🌱 Message reçu:", message);
    
    if (message.action === "trackLLM") {
        isTracking = true;
        currentService = message.service;
        console.log(`🌱 Début du suivi pour ${currentService}`);
        
        // Configuration spécifique au service
        setupServiceTracking(currentService);
        
        // Écouter l'événement de déchargement de la page
        window.addEventListener('beforeunload', () => {
            completeTracking();
        });
        
        // Retourner un statut
        return Promise.resolve({status: "tracking started"});
    }
    
    return Promise.resolve({status: "unknown action"});
});

/**
 * Configuration du suivi en fonction du service LLM
 */
function setupServiceTracking(serviceName) {
    // Informer le script d'arrière-plan du début du suivi
    browser.runtime.sendMessage({
        action: "startLLMTracking",
        service: serviceName,
        url: window.location.href
    }).then(response => {
        console.log("🌱 Suivi démarré, réponse:", response);
    }).catch(err => {
        console.error("🌱 Erreur lors du démarrage du suivi:", err);
    });
    
    // Configuration spécifique au service
    if (serviceName === "Claude") {
        setupClaudeTracking();
    } else if (serviceName === "ChatGPT") {
        setupChatGPTTracking();
    } else {
        // Configuration générique pour les autres services
        setupGenericTracking();
    }
}

/**
 * Configuration spécifique pour Claude
 */
function setupClaudeTracking() {
    console.log("🌱 Configuration du suivi pour Claude");
    
    // 1. Suivi des entrées utilisateur
    document.addEventListener('keydown', function(e) {
        // Détecter Entrée dans les zones de texte pour Claude
        if (e.key === 'Enter' && !e.shiftKey) {
            const textareas = document.querySelectorAll('textarea');
            textareas.forEach(textarea => {
                const text = textarea.value;
                if (text && text.trim() !== "" && text !== lastInputText) {
                    console.log(`🌱 Entrée Claude détectée: ${text.substring(0, 30)}...`);
                    lastInputText = text;
                    
                    browser.runtime.sendMessage({
                        action: "updateLLMInput",
                        text: text
                    }).catch(err => console.error("🌱 Erreur d'envoi d'entrée:", err));
                }
            });
        }
    });
    
    // Surveiller également les clics sur le bouton d'envoi
    document.addEventListener('click', function(e) {
        // Chercher les boutons d'envoi
        if (e.target.closest('button[type="submit"]') || 
            e.target.closest('[aria-label="Send message"]') ||
            e.target.closest('.send-button')) {
            
            setTimeout(() => {
                const textareas = document.querySelectorAll('textarea');
                textareas.forEach(textarea => {
                    const text = textarea.value;
                    if (text && text.trim() !== "" && text !== lastInputText) {
                        console.log(`🌱 Entrée Claude (bouton): ${text.substring(0, 30)}...`);
                        lastInputText = text;
                        
                        browser.runtime.sendMessage({
                            action: "updateLLMInput",
                            text: text
                        }).catch(err => console.error("🌱 Erreur d'envoi d'entrée:", err));
                    }
                });
            }, 100); // Petit délai pour s'assurer que le texte est disponible
        }
    });
    
    // 2. Suivi des réponses Claude
    // Créer un observateur de mutations pour surveiller les réponses
    if (outputObserver) outputObserver.disconnect();
    
    outputObserver = new MutationObserver(mutations => {
        // Chercher les réponses de Claude
        const responseElements = document.querySelectorAll('.claude-response, .prose, .assistant, .message-content');
        
        if (responseElements.length > 0) {
            // Collecter le texte de tous les éléments de réponse
            let completeText = '';
            responseElements.forEach(el => {
                if (el && el.textContent) {
                    completeText += el.textContent + ' ';
                }
            });
            
            completeText = completeText.trim();
            
            // Vérifier si la réponse est substantielle et nouvelle
            if (completeText && 
                completeText.length > 50 && 
                completeText !== lastOutputText) {
                
                console.log(`🌱 Réponse Claude détectée: ${completeText.substring(0, 30)}...`);
                lastOutputText = completeText;
                
                browser.runtime.sendMessage({
                    action: "updateLLMOutput",
                    text: completeText
                }).catch(err => console.error("🌱 Erreur d'envoi de sortie:", err));
            }
        }
    });
    
    // Observer le document entier pour les changements
    outputObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
    
    console.log("🌱 Suivi Claude configuré avec succès");
}

/**
 * Configuration spécifique pour ChatGPT
 */
function setupChatGPTTracking() {
    console.log("🌱 Configuration du suivi pour ChatGPT");
    
    // Create a global variable to store the latest prompt
    let currentPrompt = "";
    
    // Capture the input as it's typed (before send)
    document.addEventListener('input', function(e) {
        if (e.target.tagName === 'TEXTAREA' && 
            (e.target.getAttribute('data-testid') === 'chat-input' || 
             e.target.placeholder?.includes('Send a message'))) {
            currentPrompt = e.target.value;
        }
    });
    
    // 1. Watch for button clicks to send messages
    document.addEventListener('click', function(e) {
        // Find send button clicks - multiple selector patterns to be thorough
        if (e.target.closest('button[data-testid="send-button"]') ||
            e.target.closest('[aria-label="Send message"]') ||
            e.target.closest('button.absolute.p-1') || // Common pattern in ChatGPT UI
            e.target.closest('button svg path[d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z"]')) {
            
            // Send the captured input if we have one
            if (currentPrompt && currentPrompt.trim() !== "" && currentPrompt !== lastInputText) {
                console.log(`🌱 Entrée ChatGPT (bouton): ${currentPrompt.substring(0, 30)}...`);
                lastInputText = currentPrompt;
                
                browser.runtime.sendMessage({
                    action: "updateLLMInput",
                    text: currentPrompt
                }).catch(err => console.error("🌱 Erreur d'envoi d'entrée:", err));
                
                // Reset for next input
                currentPrompt = "";
            }
        }
    });
    
    // 2. Watch for Enter key to send messages
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            const textarea = e.target;
            if (textarea.tagName === 'TEXTAREA' && 
                (textarea.getAttribute('data-testid') === 'chat-input' || 
                 textarea.placeholder?.includes('Send a message'))) {
                
                const text = textarea.value || currentPrompt;
                if (text && text.trim() !== "" && text !== lastInputText) {
                    console.log(`🌱 Entrée ChatGPT (enter): ${text.substring(0, 30)}...`);
                    lastInputText = text;
                    
                    browser.runtime.sendMessage({
                        action: "updateLLMInput",
                        text: text
                    }).catch(err => console.error("🌱 Erreur d'envoi d'entrée:", err));
                    
                    // Reset for next input
                    currentPrompt = "";
                }
            }
        }
    });
    
    // 3. Monitor for AI responses - this part seems to work well from your logs
    if (outputObserver) outputObserver.disconnect();
    
    outputObserver = new MutationObserver(mutations => {
        // Sélecteurs spécifiques à ChatGPT
        const responseElements = document.querySelectorAll('.markdown, .prose, [data-message-author-role="assistant"]');
        
        if (responseElements.length > 0) {
            let completeText = '';
            responseElements.forEach(el => {
                if (el && el.textContent) {
                    completeText += el.textContent + ' ';
                }
            });
            
            completeText = completeText.trim();
            
            if (completeText && 
                completeText.length > 50 && 
                completeText !== lastOutputText) {
                
                console.log(`🌱 Réponse ChatGPT détectée: ${completeText.substring(0, 30)}...`);
                lastOutputText = completeText;
                
                browser.runtime.sendMessage({
                    action: "updateLLMOutput",
                    text: completeText
                }).catch(err => console.error("🌱 Erreur d'envoi de sortie:", err));
            }
        }
    });
    
    outputObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
}

/**
 * Configuration générique pour les autres LLM
 */
function setupGenericTracking() {
    console.log("🌱 Configuration du suivi générique LLM");
    
    // Surveiller tous les textarea et entrées de texte
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            const inputs = document.querySelectorAll('textarea, input[type="text"]');
            
            inputs.forEach(input => {
                const text = input.value;
                if (text && text.trim() !== "" && text !== lastInputText) {
                    console.log(`🌱 Entrée générique détectée: ${text.substring(0, 30)}...`);
                    lastInputText = text;
                    
                    browser.runtime.sendMessage({
                        action: "updateLLMInput",
                        text: text
                    }).catch(err => console.error("🌱 Erreur d'envoi d'entrée:", err));
                }
            });
        }
    });
    
    // Observer les changements de DOM pour détecter les réponses
    if (outputObserver) outputObserver.disconnect();
    
    outputObserver = new MutationObserver(mutations => {
        // Nous cherchons des blocs de texte significatifs qui pourraient être des réponses
        const bodyText = document.body.innerText;
        
        // Si nous détectons un changement significatif dans le texte de la page
        if (bodyText && 
            bodyText.length > lastOutputText.length + 200) { // Au moins 200 caractères de plus
            
            console.log(`🌱 Changement de contenu détecté (générique): +${bodyText.length - lastOutputText.length} caractères`);
            lastOutputText = bodyText;
            
            browser.runtime.sendMessage({
                action: "updateLLMOutput",
                text: bodyText
            }).catch(err => console.error("🌱 Erreur d'envoi de sortie:", err));
        }
    });
    
    // Observer le document entier pour les changements
    outputObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
}

/**
 * Finalise le suivi et envoie les données
 */
function completeTracking() {
  if (isTracking) {
    console.log("🌱 Finalisation du suivi LLM");
    
    browser.runtime.sendMessage({
      action: "completeLLMTracking",
      // Include the last data we had
      inputText: lastInputText,
      outputText: lastOutputText
    }).then(response => {
      console.log("🌱 Suivi terminé, réponse:", response);
    }).catch(err => {
      console.error("🌱 Erreur lors de la finalisation du suivi:", err);
    });
    
    isTracking = false;
  }
}

// Lancer la détection automatique après un court délai
setTimeout(() => {
    const url = window.location.href;
    console.log(`🌱 Vérification automatique de l'URL: ${url}`);
    
    if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
        console.log("🌱 ChatGPT détecté automatiquement");
        setupServiceTracking('ChatGPT');
    } else if (url.includes('claude.ai') || url.includes('anthropic.com')) {
        console.log("🌱 Claude détecté automatiquement");
        setupServiceTracking('Claude');
    }
    // Autres services...
}, 1000);

// Helper function to check if the current tab is still valid
async function isTabValid() {
  try {
    const tabs = await browser.tabs.query({active: true, currentWindow: true});
    return tabs && tabs.length > 0;
  } catch (e) {
    return false;
  }
}

// Function to ensure the icon is visible
async function ensureIconVisible() {
  if (await isTabValid()) {
    browser.runtime.sendMessage({
      action: "ensureIconVisible",
      url: window.location.href
    }).catch(err => console.log("🌱 Icon refresh error:", err));
  }
}

// Établir une connexion persistante avec le script d'arrière-plan
let port;
try {
  port = browser.runtime.connect({name: "llm-tracking"});
  
  port.onDisconnect.addListener(() => {
    console.log("🌱 Connection to background disconnected");
    port = null;
  });
  
} catch (err) {
  console.error("🌱 Failed to connect to background:", err);
}

// Fonction pour démarrer le rafraîchissement de l'icône
function startIconRefresh() {
  console.log("🌱 Starting icon refresh cycle");
  
  // Appeler immédiatement une fois
  ensureIconVisible();
  
  // Puis configurer un intervalle pour des mises à jour périodiques
  setInterval(ensureIconVisible, 10000);
}

// Démarrer le rafraîchissement d'icône après le chargement complet
window.addEventListener('load', () => {
  // Attendre un peu pour que le script d'arrière-plan soit prêt
  setTimeout(startIconRefresh, 3000);
});


console.log("🌱 EcoSurf LLM Tracker initialisé avec succès");