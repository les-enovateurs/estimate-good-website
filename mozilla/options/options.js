// variables
let itemsPerPage = 10;

// Add the constants from popup.js at the top of the file
const EMISSIONS_FACTORS_RANGE_TOKEN = {
    "openai": {
        //openai/claude/gemini/default
        50: {
            "energy": 4.39,
            "gCO2eq": 2.68
        },
        170: {
            "energy": 14.9,
            "gCO2eq": 9.11
        },
        250: {
            "energy": 21.9,
            "gCO2eq": 13.4
        },
        400: {
            "energy": 35.1,
            "gCO2eq": 21.4
        },
        5000: {
            "energy": 439,
            "gCO2eq": 268
        },
        15000: {
            "energy": 1320,
            "gCO2eq": 803
        }
    },
    "meta": {
        //meta/llama3...
        50: {
            "energy": 4.39,
            "gCO2eq": 2.68
        },
        170: {
            "energy": 14.9,
            "gCO2eq": 9.11
        },
        250: {
            "energy": 21.9,
            "gCO2eq": 13.4
        },
        400: {
            "energy": 35.1,
            "gCO2eq": 21.4
        },
        5000: {
            "energy": 1190,
            "gCO2eq": 727
        },
        15000: {
            "energy": 3580,
            "gCO2eq": 2180
        }
    }
};

window.addEventListener('DOMContentLoaded', async (event) => {
    // listener
    const removeHistoryButton = findById("clearHistory");
    removeHistoryButton.innerHTML = browser.i18n.getMessage("clearHistory");
    removeHistoryButton.addEventListener('click', () => {
        localStorage.clear();
    });

    // header
    const header = findById('settings-header');
    header.innerHTML = browser.i18n.getMessage("settingsHeader");

    // header settings
    const averageMonthTitle = findById("average-month-title");
    averageMonthTitle.innerHTML = browser.i18n.getMessage("averageMonthTitle");

    const browserHistoryTitle = findById("browser-history-title");
    browserHistoryTitle.innerHTML = browser.i18n.getMessage("browserHistoryTitle");

    // progress bar
    const gradeIconProgressBar = findById("grade-average-icon-progress-bar");

    const rowsSortedByVisitedAt = computeData();
    const currentPage = 1;

    renderTable(rowsSortedByVisitedAt, currentPage);
    renderPagination(rowsSortedByVisitedAt.length, itemsPerPage, currentPage);

    const averageGrade = computeAverageNote(rowsSortedByVisitedAt, firstDateOfMonth(new Date()), lastDateOfMonth(new Date()));
    computeGradeIconAndPositionOnProgressBar(gradeIconProgressBar, averageGrade);
    
    // Set up LLM impact section
    setupLLMImpactSection();
    
    // Add LLM history clear button handler
    const clearLLMButton = findById("clearLLMHistory");
    clearLLMButton.addEventListener('click', async () => {
        await browser.runtime.sendMessage({
            action: "clearLLMData"
        });
        setupLLMImpactSection(); // Refresh the data display
    });
});

function computeData() {
    const items = { ...localStorage };
    const rows = Object.entries(items)
    // sort desc by visited at
    const rowsSortedByVisitedAt = rows.slice().sort(([keyA, valueA],[keyB, valueB]) => {
        const a = JSON.parse(valueA);
        const b = JSON.parse(valueB);
        return a["visitedAt"] < b["visitedAt"];
    });
    return rowsSortedByVisitedAt;
}

function renderTable(rows, currentPage) {
    const table = document.getElementById("list-of-url-table");
    // clear table
    table.innerHTML = "";

    table.appendChild(createHead());
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    const start = (currentPage-1)*itemsPerPage;
    const end = (currentPage) * itemsPerPage;
    rows.slice(start, end).map(([key, value]) => {
        tbody.appendChild(createRow(key, value));
    });

    //pagination (items per page)
    const paginationLabel = findById("paginate-by-label");
    paginationLabel.innerHTML = browser.i18n.getMessage("paginateBy");

    const paginationSelect = findById("select-paginate-by");
    paginationSelect.addEventListener('change', (event) => {
        event.preventDefault();

        itemsPerPage = event.target.value;
        renderTable(rows, 1);
        renderPagination(rows.length, itemsPerPage, currentPage);
    });

    return table;
}


function createHead() {
    const head = document.createElement("thead");
    const tr = document.createElement("tr");

    const thLink = document.createElement("th");
    thLink.setAttribute("scope", "col");
    thLink.innerHTML = browser.i18n.getMessage("linkTable");

    const thGrade = document.createElement("th");
    thGrade.setAttribute("scope", "col");
    thGrade.innerHTML = browser.i18n.getMessage("gradeTable");

    const thScore = document.createElement("th");
    thScore.setAttribute("scope", "col");
    thScore.innerHTML = browser.i18n.getMessage("scoreTable");

    const thRequests = document.createElement("th");
    thRequests.setAttribute("scope", "col");
    thRequests.innerHTML = browser.i18n.getMessage("nbRequestsTable");

    const thVisitedAt = document.createElement("th");
    thVisitedAt.setAttribute("scope", "col");
    thVisitedAt.innerHTML = browser.i18n.getMessage("visitedAtTable");

    tr.appendChild(thGrade);
    tr.appendChild(thLink);
    tr.appendChild(thScore);
    tr.appendChild(thRequests);
    tr.appendChild(thVisitedAt);
    
    head.appendChild(tr);
    return  head;
}

function createRow(link, otherData) {
    const tr = document.createElement("tr");
    const parsedData = JSON.parse(otherData);

    const thLink = document.createElement("th");
    thLink.setAttribute("scope", "row");
    thLink.classList.add("link-th")
    thLink.innerHTML = `<a class="link-url" href="${link}">${link}</a>`;

    const tdGrade = document.createElement("td");
    tdGrade.innerHTML = `<img src="../icons/${parsedData["grade"]}.jpg" />`;

    const tdScore = document.createElement("td");
    tdScore.innerHTML = `<span style="font-weight:bold">${parsedData["score"]}</span> / 100`;

    const tdRequests = document.createElement("td");
    tdRequests.innerHTML = parsedData["requests"];

    const tdVisitedAt = document.createElement("td");
    tdVisitedAt.innerHTML = prettyDate(parsedData["visitedAt"]);

    tr.appendChild(tdGrade);
    tr.appendChild(thLink);
    tr.appendChild(tdScore);
    tr.appendChild(tdRequests);
    tr.appendChild(tdVisitedAt);

    return tr;
}

function renderPagination(numberOfItems, itemsPerPage, currentPage) {
    const paginationPages = findById("pagination-pages");
    // remove inner itemps
    paginationPages.innerHTML = "";

    const firstPageDom = document.createElement("button");
    firstPageDom.innerHTML = "<<";
    firstPageDom.addEventListener('click', (event) => {
        event.preventDefault();

        const currentPage = 1;
        const rows = computeData();
        renderTable(rows, currentPage);
        renderPagination(rows.length, itemsPerPage, currentPage);
    });

    const lastPageDom = document.createElement("button");
    lastPageDom.innerHTML = ">>";
    lastPageDom.addEventListener('click', (event) => {
        event.preventDefault();

        const currentPage = parseInt(Math.ceil(numberOfItems/itemsPerPage));
        const rows = computeData();
        renderTable(rows, currentPage);
        renderPagination(rows.length, itemsPerPage, currentPage);
    });

    paginationPages.appendChild(firstPageDom);
     const lastPage = Math.ceil(numberOfItems/itemsPerPage);

    const minusTwo = currentPage - 2;
    const minusOne = currentPage - 1;
    const plusOne = currentPage + 1;
    const plusTwo = currentPage + 2;

    [minusTwo, minusOne, currentPage, plusOne, plusTwo].map(i => {
        if(i < 1 || i > lastPage) {
            return;
        }
        const buttonIndex = document.createElement("button");
        buttonIndex.innerHTML = i.toString();
        if(i === currentPage) {
            buttonIndex.classList.toggle("pagination-selected")
        }
        buttonIndex.addEventListener('click', (event) => {
            event.preventDefault();

            const currentPage = parseInt(i);
            const rows = computeData();
            renderTable(rows, currentPage);
            renderPagination(rows.length, itemsPerPage, currentPage);
        });
        paginationPages.appendChild(buttonIndex);
    });

    paginationPages.appendChild(lastPageDom);

}

function prettyDate(time) {
    var date = new Date((time || "").replace(/-/g, "/").replace(/[TZ]/g, " ")),
        diff = (((new Date()).getTime() - date.getTime()) / 1000),
        day_diff = Math.floor(diff / 86400);

    if (isNaN(day_diff) || day_diff < 0 || day_diff >= 31) return;

    return day_diff == 0 && (
    diff < 60 && browser.i18n.getMessage("now") 
    || diff < 120 && browser.i18n.getMessage("minute")
    || diff < 3600 && browser.i18n.getMessage("minutes", [Math.floor(diff / 60)])
    || diff < 7200 &&  browser.i18n.getMessage("hour")
    || diff < 86400 && browser.i18n.getMessage("hours", [Math.floor(diff / 3600)])) 
    || day_diff == 1 && browser.i18n.getMessage("yesterday") || day_diff < 7 && browser.i18n.getMessage("days", [day_diff]) 
    || day_diff < 31 && browser.i18n.getMessage("weeks", [Math.ceil(day_diff / 7)]);
}

function computeAverageNote(rowsSortedByVisitedAt, fromDate, toDate) {
    const rowsSortedByVisitedRange = rowsSortedByVisitedAt.slice().filter( ([key, value]) => {
        const a = JSON.parse(value);
        const date =  new Date(a["visitedAt"]);
        return date >= fromDate && date <= toDate;
    });

    const sumNotes = rowsSortedByVisitedRange.reduce((acc, [currentKey, currentValue]) => {
        const a = JSON.parse(currentValue);
        return fromGradeToNote(a["grade"]) + acc;
    } ,0);

    const averageNote = Math.ceil(sumNotes/rowsSortedByVisitedRange.length);

    return fromToNoteGrade(averageNote);
}

function firstDateOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}


function lastDateOfMonth(date) {
    // 0 as day return the last day of the previous month
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function fromGradeToNote(grade) {
    switch(grade){
        case 'A':
        default:
            return 0;
        case 'B':
            return 1;
        case 'C':
            return 2;
        case 'D':
            return 3;
        case 'E':
            return 4;
        case 'F':
            return 5;
        case 'G':
            return 6;
    }
}


function fromToNoteGrade(note) {
    switch(note){
        case 0:
        default:
            return 'A';
        case  1:
            return 'B';
        case  2:
            return 'C';
        case 3:
            return 'D';
        case 4:
            return 'E';
        case 5:
            return 'F';
        case 6:
            return 'G';
    }
}

function computeGradeIconAndPositionOnProgressBar(gradeIconProgressBar, grade) {
    let positionInPercent = "0%";
    switch(grade){
        case 'A':
        default:
            positionInPercent = "2%";
            break;
        case 'B':
            positionInPercent = "10%";
            break;
        case 'C':
            positionInPercent = "30%";
            break;
        case 'D':
            positionInPercent = "50%";
            break;
        case 'E':
            positionInPercent = "55%";
            break;
        case 'F':
            positionInPercent = "80%";
            break;
        case 'G':
            positionInPercent = "95%";
            break;
    }
    gradeIconProgressBar.style.left = positionInPercent;
    gradeIconProgressBar.src = `../icons/${grade}.jpg`;
}


// tool functions
function findById(id) {
    const domElement = document.getElementById(id);
    if(!domElement) {
        throw new Error(`Cannot find the domElement by id: ${id}`);
    }
    return domElement;
}

async function setupLLMImpactSection() {
    // Set up internationalized text labels with improved formatting
    const llmImpactTitle = findById("llm-impact-title");
    llmImpactTitle.innerHTML = `
        <div class="section-header">
            <i class="impact-icon pulse"></i>
            <h2>${browser.i18n.getMessage("llmImpactTitle") || "LLM Impact"}</h2>
        </div>
    `;
    
    // Create a more structured stats display with visual indicators
    const llmCarbonLabel = findById("llm-carbon-label");
    llmCarbonLabel.innerHTML = `
        <span class="label-icon carbon-icon pulse-slow"></span>
        <span class="label-text">${browser.i18n.getMessage("llmCarbonLabel") || "Total Carbon (gCO2eq)"}</span>
    `;
    
    const llmInteractionsLabel = findById("llm-interactions-label");
    llmInteractionsLabel.innerHTML = `
        <span class="label-icon interactions-icon pulse-slow"></span>
        <span class="label-text">${browser.i18n.getMessage("llmInteractionsLabel") || "Interactions"}</span>
    `;
    
    const llmTokensLabel = findById("llm-tokens-label");
    llmTokensLabel.innerHTML = `
        <span class="label-icon tokens-icon pulse-slow"></span>
        <span class="label-text">${browser.i18n.getMessage("llmTokensLabel") || "Total Tokens"}</span>
    `;
    
    const llmEnergyLabel = findById("llm-energy-label");
    if (llmEnergyLabel) {
        llmEnergyLabel.innerHTML = `
            <span class="label-icon energy-icon pulse-slow"></span>
            <span class="label-text">${browser.i18n.getMessage("llmEnergyLabel") || "Energy (Wh)"}</span>
        `;
    }
    
    // Improve section headers with icons and better hierarchy
    const llmEquivalentTitle = findById("llm-equivalent-title");
    llmEquivalentTitle.innerHTML = `
        <div class="subsection-header">
            <span class="section-icon equivalent-icon"></span>
            <h3>${browser.i18n.getMessage("llmEquivalentTitle") || "Environmental Equivalent"}</h3>
        </div>
    `;
    
    const llmEnergyEquivalentTitle = findById("llm-energy-equivalent-title");
    if (llmEnergyEquivalentTitle) {
        llmEnergyEquivalentTitle.innerHTML = `
            <div class="subsection-header">
                <span class="section-icon energy-equivalent-icon"></span>
                <h3>${browser.i18n.getMessage("llmEnergyEquivalentTitle") || "Energy Equivalent"}</h3>
            </div>
        `;
    }
    
    // Make the button more visually appealing with an icon and hover effect
    const clearLLMButton = findById("clearLLMHistory");
    clearLLMButton.innerHTML = `
        <span class="button-icon clear-icon"></span>
        <span class="button-text">${browser.i18n.getMessage("clearLLMHistory") || "Clear LLM History"}</span>
    `;
    
    console.log("Requesting LLM statistics...");
    try {
        // Directly access browser storage to get the LLM interactions data
        const storage = await browser.storage.local.get(['llmInteractions']);
        
        if (!storage || !storage.llmInteractions || Object.keys(storage.llmInteractions).length === 0) {
            console.log("No LLM data found in storage");
            // Display placeholders or empty state
            updateEmptyStats();
            return;
        }
        
        // Calculate statistics directly from the raw data
        const interactions = Object.values(storage.llmInteractions);
        console.log(`Processing ${interactions.length} LLM interactions`);
        
        // Initialize accumulators
        let totalCarbonImpact = 0;
        let totalEnergyImpact = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let serviceBreakdown = {};
        
        // Process each interaction and accumulate totals
        interactions.forEach(interaction => {
            // Calculate impact values if they don't exist (using same approach as popup.js)
            const inputTokens = interaction.inputTokens || 0;
            const outputTokens = interaction.outputTokens || 0;
            
            // If carbon/energy impact is missing, calculate it based on tokens
            if (!interaction.carbonImpact || !interaction.energyImpact) {
                const totalTokens = inputTokens + outputTokens;
                // Get service type for different emission factors
                let serviceType = "openai"; // Default
                if (interaction.service && interaction.service.toLowerCase().includes("meta")) {
                    serviceType = "meta";
                }
                
                // Find the appropriate emission factor based on token count
                let emissionFactor = null;
                for (const tokenThreshold of [15000, 5000, 400, 250, 170, 50]) {
                    if (totalTokens <= tokenThreshold) {
                        emissionFactor = EMISSIONS_FACTORS_RANGE_TOKEN[serviceType][tokenThreshold];
                    }
                }
                
                // If no match found (very unlikely), use the highest threshold
                if (!emissionFactor) {
                    emissionFactor = EMISSIONS_FACTORS_RANGE_TOKEN[serviceType][15000];
                }
                
                // Scale the impact based on actual token count
                interaction.carbonImpact = (totalTokens / 1000) * emissionFactor.gCO2eq;
                interaction.energyImpact = (totalTokens / 1000) * emissionFactor.energy;
            }
            
            // Accumulate tokens
            totalInputTokens += inputTokens;
            totalOutputTokens += outputTokens;
            
            // Add carbon and energy impact
            totalCarbonImpact += (interaction.carbonImpact || 0);
            totalEnergyImpact += (interaction.energyImpact || 0);
            
            // Track service usage for breakdown chart
            const service = interaction.service || 'Unknown LLM';
            if (!serviceBreakdown[service]) {
                serviceBreakdown[service] = {
                    count: 0,
                    carbonImpact: 0,
                    energyImpact: 0
                };
            }
            
            serviceBreakdown[service].count += 1;
            serviceBreakdown[service].carbonImpact += (interaction.carbonImpact || 0);
            serviceBreakdown[service].energyImpact += (interaction.energyImpact || 0);
        });
        
        // Update the UI with the calculated statistics
        updateStats(
            totalCarbonImpact, 
            totalEnergyImpact, 
            interactions.length, 
            totalInputTokens + totalOutputTokens,
            serviceBreakdown
        );
    } catch (error) {
        console.error("Error calculating LLM statistics:", error);
        updateEmptyStats();
    }
}

// Helper function to update UI with calculated stats
function updateStats(carbonImpact, energyImpact, interactionsCount, totalTokens, serviceBreakdown) {
    // Update the basic stats
    const totalCarbonElement = findById("llm-total-carbon");
    totalCarbonElement.textContent = carbonImpact.toFixed(2);
    
    const totalEnergyElement = findById("llm-total-energy");
    if (totalEnergyElement) {
        totalEnergyElement.textContent = energyImpact.toFixed(2);
    }
    
    const interactionsElement = findById("llm-interactions");
    interactionsElement.textContent = interactionsCount;
    
    const tokensElement = findById("llm-tokens");
    tokensElement.textContent = totalTokens.toLocaleString();
    
    // Calculate environmental equivalents
    const comparisons = {
        carKilometers: carbonImpact / 110, // 110 CO2 per km average car - https://impactco2.fr/outils/transport
        coffeeCups: carbonImpact / 635      // 635g CO2 per liter of coffee - https://impactco2.fr/outils/boisson/cafe
    };
    
    // Calculate energy equivalents
    const energyComparisons = {
        smartphoneCharges: energyImpact / 10, // 10Wh per smartphone charge - https://www.edf.fr/groupe-edf/comprendre/electricite-au-quotidien/usages/que-peut-on-faire-avec-1-kwh
        ledBulbHours: energyImpact / 7        // 7Wh per hour of LED bulb usage - https://particuliers.engie.fr/economies-energie/conseils-economies-energie/conseils-calcul-consommation/consommation-ampoule.html#paraun
    };
    
    // Update comparisons section
    const comparisonsElement = findById("llm-comparisons-list");
    comparisonsElement.innerHTML = ''; // Clear existing content
    
    addComparisonItem(comparisonsElement, 
        browser.i18n.getMessage("carTravelLabel") || 'Car Travel', 
        `${comparisons.carKilometers.toFixed(4)} km`, 
        'car-icon.svg');
    
    addComparisonItem(comparisonsElement, 
        browser.i18n.getMessage("coffeeCupsLabel") || 'Liter of Coffee', 
        `${comparisons.coffeeCups.toFixed(4)}`, 
        'coffee-icon.svg');
    
    // Update energy comparisons section if it exists
    const energyComparisonsElement = findById("llm-energy-comparisons-list");
    if (energyComparisonsElement) {
        energyComparisonsElement.innerHTML = ''; // Clear existing content
        
        addComparisonItem(energyComparisonsElement, 
            browser.i18n.getMessage("smartphoneChargesEnergyLabel") || 'Smartphone Charges', 
            `${energyComparisons.smartphoneCharges.toFixed(4)}`, 
            'smartphone-icon.svg');
        
        addComparisonItem(energyComparisonsElement, 
            browser.i18n.getMessage("ledBulbHoursLabel") || 'LED Bulb Hours', 
            `${energyComparisons.ledBulbHours.toFixed(4)}`, 
            'bulb-solid.svg');
    }
    
    // Generate service breakdown chart
    renderLLMServiceChart(serviceBreakdown);
}

// Helper function to display empty state
function updateEmptyStats() {
    const totalCarbonElement = findById("llm-total-carbon");
    totalCarbonElement.textContent = "0.00";
    
    const totalEnergyElement = findById("llm-total-energy");
    if (totalEnergyElement) {
        totalEnergyElement.textContent = "0.00";
    }
    
    const interactionsElement = findById("llm-interactions");
    interactionsElement.textContent = "0";
    
    const tokensElement = findById("llm-tokens");
    tokensElement.textContent = "0";
    
    // Update comparisons with zeros
    const comparisonsElement = findById("llm-comparisons-list");
    comparisonsElement.innerHTML = ''; // Clear existing content
    
    addComparisonItem(comparisonsElement, 
        browser.i18n.getMessage("carTravelLabel") || 'Car Travel', 
        "0.0000 km", 
        'car-icon.svg');
    
    addComparisonItem(comparisonsElement, 
        browser.i18n.getMessage("coffeeCupsLabel") || 'Cups of Coffee', 
        "0.0000", 
        'coffee-icon.svg');
    
    // Update energy comparisons
    const energyComparisonsElement = findById("llm-energy-comparisons-list");
    if (energyComparisonsElement) {
        energyComparisonsElement.innerHTML = ''; // Clear existing content
        
        addComparisonItem(energyComparisonsElement, 
            browser.i18n.getMessage("smartphoneChargesEnergyLabel") || 'Smartphone Charges', 
            "0.0000", 
            'smartphone-icon.svg');
        
        addComparisonItem(energyComparisonsElement, 
            browser.i18n.getMessage("ledBulbHoursLabel") || 'LED Bulb Hours', 
            "0.0000", 
            'bulb-solid.svg');
    }
    
    // Display empty chart message
    const chartContainer = findById('llm-chart-container');
    chartContainer.innerHTML = `<p class="no-data-message">${browser.i18n.getMessage("noLLMDataAvailable") || 'No LLM usage data available yet.'}</p>`;
}

function addComparisonItem(container, label, value, iconSrc) {
    const item = document.createElement('div');
    item.className = 'comparison-item fade-in';
    
    item.innerHTML = `
        <div class="comparison-icon-wrapper">
            <img src="../icons/${iconSrc}" alt="${label}" class="comparison-icon icon-background" />
        </div>
        <div class="comparison-info">
            <div class="comparison-label">${label}</div>
            <div class="comparison-value highlight">${value}</div>
        </div>
    `;
    
    // Add hover effect
    item.addEventListener('mouseenter', () => {
        item.classList.add('comparison-hover');
    });
    
    item.addEventListener('mouseleave', () => {
        item.classList.remove('comparison-hover');
    });
    
    container.appendChild(item);
}

function renderLLMServiceChart(serviceData) {
    const chartContainer = findById('llm-chart-container');
    chartContainer.innerHTML = ''; // Clear previous chart
    
    if (!serviceData || Object.keys(serviceData).length === 0) {
        // No data to display
        chartContainer.innerHTML = `<p class="no-data-message">${browser.i18n.getMessage("noLLMDataAvailable") || 'No LLM usage data available yet.'}</p>`;
        return;
    }
    
    // Create a single chart container that will hold both types of impacts
    const chartSection = document.createElement('div');
    chartSection.className = 'llm-chart-section';
    
    // Add chart title with improved styling
    const chartTitle = document.createElement('div');
    chartTitle.className = 'chart-title animated fadeIn';
    chartTitle.innerHTML = `
        <h4>
            <span class="chart-icon carbon-icon"></span>
            ${browser.i18n.getMessage("llmServiceBreakdownTitle") || "Service Impact Breakdown"}
        </h4>
        <p class="chart-subtitle">${browser.i18n.getMessage("basedOnEcologits") || "Based on Ecologits emission factors"}</p>
    `;
    chartSection.appendChild(chartTitle);
    
    // Create the legend
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.innerHTML = `
        <div class="legend-item">
            <span class="legend-color carbon-color"></span>
            <span class="legend-label">${browser.i18n.getMessage("carbonImpact") || "Carbon Impact"} (gCO2eq)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color energy-color"></span>
            <span class="legend-label">${browser.i18n.getMessage("energyImpact") || "Energy Impact"} (Wh)</span>
        </div>
    `;
    chartSection.appendChild(legend);
    
    // Create bar chart container
    const chart = document.createElement('div');
    chart.className = 'llm-dual-bar-chart';
    
    // Find the max values for scaling - Ajout d'une valeur minimale pour éviter une division par zéro
    let maxCarbonImpact = 0.01;
    let maxEnergyImpact = 0.01;
    
    for (const service in serviceData) {
        maxCarbonImpact = Math.max(maxCarbonImpact, serviceData[service].carbonImpact || 0);
        maxEnergyImpact = Math.max(maxEnergyImpact, serviceData[service].energyImpact || 0);
    }
    
    // Ajouter un log pour debugging
    console.log("Max Carbon Impact:", maxCarbonImpact);
    console.log("Max Energy Impact:", maxEnergyImpact);
    
    // Sort services by carbon impact for consistent ordering
    const sortedServices = Object.keys(serviceData).sort((a, b) => {
        return (serviceData[b].carbonImpact || 0) - (serviceData[a].carbonImpact || 0);
    });
    
    // Créer une section pour le débogage
    const debugInfo = document.createElement('div');
    debugInfo.style.display = 'none'; // Masqué par défaut, à activer si besoin
    debugInfo.innerHTML = `<p>Données de service: ${JSON.stringify(serviceData)}</p>`;
    chartSection.appendChild(debugInfo);
    
    // Create service rows with both impact types
    sortedServices.forEach((service, index) => {
        const serviceInfo = serviceData[service];
        
        // Ajouter des logs pour debugging
        console.log(`Service: ${service}`, serviceInfo);
        
        // Skip if no data
        if ((!serviceInfo.carbonImpact && serviceInfo.carbonImpact !== 0) && 
            (!serviceInfo.energyImpact && serviceInfo.energyImpact !== 0)) {
            console.log(`Skipping service with no impact data: ${service}`);
            return;
        }
        
        // Calculate percentage widths with minimum to ensure visibility
        const carbonImpact = serviceInfo.carbonImpact || 0;
        const energyImpact = serviceInfo.energyImpact || 0;
        
        // Assurer un minimum de 1% pour la visibilité des barres même pour des valeurs très petites
        const carbonPercentWidth = Math.max(1, (carbonImpact / maxCarbonImpact) * 100);
        const energyPercentWidth = Math.max(1, (energyImpact / maxEnergyImpact) * 100);
        
        console.log(`${service} - Carbon Width: ${carbonPercentWidth}%, Energy Width: ${energyPercentWidth}%`);
        
        // Service row container
        const serviceRow = document.createElement('div');
        serviceRow.className = 'service-row animated fadeInUp';
        serviceRow.style.animationDelay = `${index * 0.1}s`;
        
        // Service label
        const label = document.createElement('div');
        label.className = 'service-label';
        
        // Add service icon if available
        const serviceIconClass = getServiceIconClass(service);
        label.innerHTML = `
            <span class="service-icon ${serviceIconClass}"></span>
            <span class="service-name">${service}</span>
            <span class="service-count">(${serviceInfo.count} ${browser.i18n.getMessage("interactions") || "interactions"})</span>
        `;
        
        // Bars container
        const barsContainer = document.createElement('div');
        barsContainer.className = 'impact-bars-container';
        
        // Carbon impact bar
        const carbonBarWrapper = document.createElement('div');
        carbonBarWrapper.className = 'bar-wrapper carbon-wrapper';
        
        const carbonBar = document.createElement('div');
        carbonBar.className = 'bar carbon-bar';
        carbonBar.style.width = `${carbonPercentWidth}%`;
        carbonBar.style.animationDelay = `${index * 0.1 + 0.1}s`;
        
        const carbonValue = document.createElement('div');
        carbonValue.className = 'bar-value';
        carbonValue.textContent = `${carbonImpact.toFixed(2)} gCO2eq`;
        
        carbonBarWrapper.appendChild(carbonBar);
        carbonBarWrapper.appendChild(carbonValue);
        
        // Energy impact bar
        const energyBarWrapper = document.createElement('div');
        energyBarWrapper.className = 'bar-wrapper energy-wrapper';
        
        const energyBar = document.createElement('div');
        energyBar.className = 'bar energy-bar';
        energyBar.style.width = `${energyPercentWidth}%`;
        energyBar.style.animationDelay = `${index * 0.1 + 0.2}s`;
        
        const energyValue = document.createElement('div');
        energyValue.className = 'bar-value';
        energyValue.textContent = `${energyImpact.toFixed(2)} Wh`;
        
        energyBarWrapper.appendChild(energyBar);
        energyBarWrapper.appendChild(energyValue);
        
        // Add bars to container
        barsContainer.appendChild(carbonBarWrapper);
        barsContainer.appendChild(energyBarWrapper);
        
        // Assemble row
        serviceRow.appendChild(label);
        serviceRow.appendChild(barsContainer);
        
        // Add to chart
        chart.appendChild(serviceRow);
    });
    
    chartSection.appendChild(chart);
    chartContainer.appendChild(chartSection);
    
    // Add emission factors explanation
    const emissionFactorsInfo = document.createElement('div');
    emissionFactorsInfo.className = 'emission-factors-info';
    emissionFactorsInfo.innerHTML = `
        <details>
            <summary>${browser.i18n.getMessage("emissionFactorsDetails") || "Emission Factors Details"}</summary>
            <div class="factors-grid">
                <div class="factor-item">
                    <strong>OpenAI/Claude/Gemini:</strong> 
                    <ul>
                        <li>&lt;50 tokens: 2.68 gCO2eq / 4.39 Wh</li>
                        <li>&lt;170 tokens: 9.11 gCO2eq / 14.9 Wh</li>
                        <li>&lt;250 tokens: 13.4 gCO2eq / 21.9 Wh</li>
                        <li>&lt;400 tokens: 21.4 gCO2eq / 35.1 Wh</li>
                        <li>&lt;5000 tokens: 268 gCO2eq / 439 Wh</li>
                        <li>&lt;15000 tokens: 803 gCO2eq / 1320 Wh</li>
                    </ul>
                </div>
                <div class="factor-item">
                    <strong>Meta:</strong>
                    <ul>
                        <li>&lt;50 tokens: 2.68 gCO2eq / 4.39 Wh</li>
                        <li>&lt;170 tokens: 9.11 gCO2eq / 14.9 Wh</li>
                        <li>&lt;250 tokens: 13.4 gCO2eq / 21.9 Wh</li>
                        <li>&lt;400 tokens: 21.4 gCO2eq / 35.1 Wh</li>
                        <li>&lt;5000 tokens: 727 gCO2eq / 1190 Wh</li>
                        <li>&lt;15000 tokens: 2180 gCO2eq / 3580 Wh</li>
                    </ul>
                </div>
            </div>
            <p><small>${browser.i18n.getMessage("basedOnStudy") || "Based on the Ecologits research study"}</small></p>
        </details>
    `;
    
    chartContainer.appendChild(emissionFactorsInfo);
}

// Nouvelle fonction pour créer les graphiques
function createServiceChart(container, serviceData, impactType, unit) {
    // Create a simple bar chart with div elements
    const chart = document.createElement('div');
    chart.className = 'llm-bar-chart';
    
    // Add chart title with improved styling
    const chartTitle = document.createElement('div');
    chartTitle.className = 'chart-title animated fadeIn';
    
    const titleText = impactType === 'carbonImpact' 
        ? (browser.i18n.getMessage("llmServiceBreakdownTitle") || "Service Carbon Impact Breakdown")
        : (browser.i18n.getMessage("llmServiceEnergyBreakdownTitle") || "Service Energy Impact Breakdown");
    
    chartTitle.innerHTML = `
        <h4>
            <span class="chart-icon ${impactType === 'carbonImpact' ? 'carbon-icon' : 'energy-icon'}"></span>
            ${titleText}
        </h4>
        <p class="chart-subtitle">${browser.i18n.getMessage("basedOnEcologits") || "Based on Ecologits emission factors"}</p>
    `;
    container.appendChild(chartTitle);
    
    // Find the highest impact for scaling
    let maxImpact = 0;
    for (const service in serviceData) {
        maxImpact = Math.max(maxImpact, serviceData[service][impactType] || 0);
    }
    
    // Sort services by impact for better visualization
    const sortedServices = Object.keys(serviceData).sort((a, b) => {
        return (serviceData[b][impactType] || 0) - (serviceData[a][impactType] || 0);
    });
    
    // Create bars for each service with animation delay for staggered effect
    sortedServices.forEach((service, index) => {
        const serviceInfo = serviceData[service];
        
        // Skip if no data for this impact type
        if (!serviceInfo[impactType] && serviceInfo[impactType] !== 0) return;
        
        // Calculate percentage width based on max impact
        const percentWidth = (serviceInfo[impactType] / maxImpact) * 100;
        
        const barContainer = document.createElement('div');
        barContainer.className = 'bar-container animated fadeInUp';
        barContainer.style.animationDelay = `${index * 0.1}s`;
        
        const label = document.createElement('div');
        label.className = 'bar-label';
        
        // Add service icon if available
        const serviceIconClass = getServiceIconClass(service);
        label.innerHTML = `
            <span class="service-icon ${serviceIconClass}"></span>
            ${service}
        `;
        
        const barWrapper = document.createElement('div');
        barWrapper.className = 'bar-wrapper';
        
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.width = `${percentWidth}%`;
        bar.style.animationDelay = `${index * 0.1 + 0.2}s`;
        
        // Add color based on impact (higher impact = warmer color)
        const hue = Math.max(0, 120 - (percentWidth * 1.2));
        bar.style.background = `linear-gradient(90deg, hsl(${hue}, 70%, 45%), hsl(${hue}, 80%, 55%))`;
        
        const value = document.createElement('div');
        value.className = 'bar-value';
        value.innerHTML = `
            <span class="impact-value">${serviceInfo[impactType].toFixed(2)} ${unit}</span>
            <small>(${serviceInfo.count} ${browser.i18n.getMessage("interactions") || "interactions"})</small>
        `;
        
        barWrapper.appendChild(bar);
        barWrapper.appendChild(value);
        
        barContainer.appendChild(label);
        barContainer.appendChild(barWrapper);
        
        chart.appendChild(barContainer);
    });
    
    container.appendChild(chart);
}

// Helper function to get icon class based on service name
function getServiceIconClass(serviceName) {
    const serviceNameLower = serviceName.toLowerCase();
    if (serviceNameLower.includes('openai') || serviceNameLower.includes('chatgpt')) {
        return 'openai-icon';
    } else if (serviceNameLower.includes('claude')) {
        return 'claude-icon';
    } else if (serviceNameLower.includes('gemini')) {
        return 'gemini-icon';
    } else if (serviceNameLower.includes('meta') || serviceNameLower.includes('llama')) {
        return 'meta-icon';
    } else if (serviceNameLower.includes('mistral')) {
        return 'mistral-icon';
    } else {
        return 'default-llm-icon';
    }
}