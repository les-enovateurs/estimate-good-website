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
    // header
    const header = findById('settings-header');
    header.innerHTML = chrome.i18n.getMessage("settingsHeader");

    // header settings
    const averageMonthTitle = findById("average-month-title");
    averageMonthTitle.innerHTML = chrome.i18n.getMessage("averageMonthTitle");

    const browserHistoryTitle = findById("browser-history-title");
    browserHistoryTitle.innerHTML = chrome.i18n.getMessage("browserHistoryTitle");

    // progress bar
    const gradeIconProgressBar = findById("grade-average-icon-progress-bar");

    const rowsSortedByVisitedAt = await computeData();
    const currentPage = 1;

    renderTable(rowsSortedByVisitedAt, currentPage);
    renderPagination(rowsSortedByVisitedAt.length, itemsPerPage, currentPage);

    const averageGrade = computeAverageNote(rowsSortedByVisitedAt, firstDateOfMonth(new Date()), lastDateOfMonth(new Date()));
    computeGradeIconAndPositionOnProgressBar(gradeIconProgressBar, averageGrade);
    
    // Set up LLM impact section
    setupLLMImpactSection();
    
    // Add clear all data button handler
    const clearButton = findById("clearLLMHistory");
    clearButton.innerHTML = chrome.i18n.getMessage("clearAllData") || "Clear All Data";
    clearButton.addEventListener('click', async () => {
        // Clear website history
        await chrome.storage.local.clear();
        
        // Clear LLM data
        await chrome.runtime.sendMessage({
            action: "clearLLMData"
        });
        
        // Refresh both sections
        const rowsSortedByVisitedAt = await computeData();
        renderTable(rowsSortedByVisitedAt, currentPage);
        renderPagination(rowsSortedByVisitedAt.length, itemsPerPage, currentPage);
        setupLLMImpactSection();
    });
});

async function computeData() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, function(items) {
            const rows = Object.entries(items);
            // sort desc by visited at
            const rowsSortedByVisitedAt = rows.slice().sort(([keyA, valueA],[keyB, valueB]) => {
                const a = JSON.parse(valueA);
                const b = JSON.parse(valueB);
                return a["visitedAt"] < b["visitedAt"];
            });
            resolve(rowsSortedByVisitedAt);
        });
    });
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
    paginationLabel.innerHTML = chrome.i18n.getMessage("paginateBy");

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
    thLink.innerHTML = chrome.i18n.getMessage("linkTable");

    const thGrade = document.createElement("th");
    thGrade.setAttribute("scope", "col");
    thGrade.innerHTML = chrome.i18n.getMessage("gradeTable");

    const thScore = document.createElement("th");
    thScore.setAttribute("scope", "col");
    thScore.innerHTML = chrome.i18n.getMessage("scoreTable");

    const thRequests = document.createElement("th");
    thRequests.setAttribute("scope", "col");
    thRequests.innerHTML = chrome.i18n.getMessage("nbRequestsTable");

    const thVisitedAt = document.createElement("th");
    thVisitedAt.setAttribute("scope", "col");
    thVisitedAt.innerHTML = chrome.i18n.getMessage("visitedAtTable");

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
    paginationPages.classList.add('pagination-nb-pages')

    // remove inner itemps
    paginationPages.innerHTML = "";

    const firstPageDom = document.createElement("button");
    firstPageDom.innerHTML = "<<";
    firstPageDom.addEventListener('click', async (event) => {
        event.preventDefault();

        const currentPage = 1;
        const rows =  await computeData();
        renderTable(rows, currentPage);
        renderPagination(rows.length, itemsPerPage, currentPage);
    });

    const lastPageDom = document.createElement("button");
    lastPageDom.innerHTML = ">>";
    lastPageDom.addEventListener('click', async (event) => {
        event.preventDefault();

        const currentPage = parseInt(Math.ceil(numberOfItems/itemsPerPage));
        const rows = await computeData();
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
        buttonIndex.addEventListener('click', async (event) => {
            event.preventDefault();

            const currentPage = parseInt(i);
            const rows = await computeData();
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
    diff < 60 && chrome.i18n.getMessage("now") 
    || diff < 120 && chrome.i18n.getMessage("minute")
    || diff < 3600 && chrome.i18n.getMessage("minutes", [Math.floor(diff / 60)])
    || diff < 7200 &&  chrome.i18n.getMessage("hour")
    || diff < 86400 && chrome.i18n.getMessage("hours", [Math.floor(diff / 3600)])) 
    || day_diff == 1 && chrome.i18n.getMessage("yesterday") || day_diff < 7 && chrome.i18n.getMessage("days", [day_diff]) 
    || day_diff < 31 && chrome.i18n.getMessage("weeks", [Math.ceil(day_diff / 7)]);
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
    // Set up internationalized text labels
    const llmImpactTitle = findById("llm-impact-title");
    llmImpactTitle.innerHTML = `
        <div class="section-header">
            <i class="impact-icon"></i>
            <h2>${chrome.i18n.getMessage("llmImpactTitle") || "LLM Impact"}</h2>
        </div>
    `;
    
    // Set up other labels
    const labels = {
        'llmCarbonLabel': 'Total Carbon (gCO2eq)',
        'llmInteractionsLabel': 'Interactions',
        'llmTokensLabel': 'Total Tokens',
        'llm-energy-label': 'Energy (Wh)',
        'llmEquivalentTitle': 'Environmental Equivalent',
        'llmEnergyEquivalentTitle': 'Energy Equivalent'
    };
    
    Object.entries(labels).forEach(([id, defaultText]) => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = `
                <span class="label-icon ${id.replace('-label', '')}-icon"></span>
                <span class="label-text">${chrome.i18n.getMessage(id) || defaultText}</span>
            `;
        }
    });
    
    // Style clear button
    const clearLLMButton = findById("clearLLMHistory");
    clearLLMButton.innerHTML = `
        <span class="button-icon clear-icon"></span>
        <span class="button-text">${chrome.i18n.getMessage("clearLLMHistory") || "Clear LLM History"}</span>
    `;
    
    try {
        console.log("Requesting LLM statistics...");
        
        // Get LLM data from storage
        const storage = await chrome.storage.local.get(['llmInteractions']);
        console.log("Retrieved storage data:", storage);
        
        if (!storage || !storage.llmInteractions || Object.keys(storage.llmInteractions).length === 0) {
            console.log("No LLM data found in storage");
            updateEmptyStats();
            return;
        }
        
        // Process the interactions
        const interactions = Object.values(storage.llmInteractions);
        console.log(`Processing ${interactions.length} LLM interactions`);
        
        // Initialize accumulators
        let totalCarbonImpact = 0;
        let totalEnergyImpact = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let serviceBreakdown = {};
        let needsUpdate = false;
        
        // Process each interaction
        interactions.forEach(interaction => {
            const inputTokens = interaction.inputTokens || 0;
            const outputTokens = interaction.outputTokens || 0;
            
            // Calculate impact if missing
            if (!interaction.carbonImpact || !interaction.energyImpact) {
                const totalTokens = inputTokens + outputTokens;
                const serviceType = interaction.service?.toLowerCase().includes("meta") ? "meta" : "openai";
                
                // Find appropriate emission factor
                let emissionFactor = null;
                for (const tokenThreshold of [15000, 5000, 400, 250, 170, 50]) {
                    if (totalTokens <= tokenThreshold) {
                        emissionFactor = EMISSIONS_FACTORS_RANGE_TOKEN[serviceType][tokenThreshold];
                        break;
                    }
                }
                
                // Use highest threshold if no match
                if (!emissionFactor) {
                    emissionFactor = EMISSIONS_FACTORS_RANGE_TOKEN[serviceType][15000];
                }
                
                // Calculate impacts
                interaction.carbonImpact = (totalTokens / 1000) * emissionFactor.gCO2eq;
                interaction.energyImpact = (totalTokens / 1000) * emissionFactor.energy;
                needsUpdate = true;
            }
            
            // Accumulate totals
            totalInputTokens += inputTokens;
            totalOutputTokens += outputTokens;
            totalCarbonImpact += (interaction.carbonImpact || 0);
            totalEnergyImpact += (interaction.energyImpact || 0);
            
            // Track service breakdown
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
        
        // Update storage if needed
        if (needsUpdate) {
            await chrome.storage.local.set({ llmInteractions: storage.llmInteractions });
        }
        
        // Update UI with calculated statistics
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
        chrome.i18n.getMessage("carTravelLabel") || 'Car Travel', 
        `${comparisons.carKilometers.toFixed(4)} km`, 
        'car-icon.svg');
    
    addComparisonItem(comparisonsElement, 
        chrome.i18n.getMessage("coffeeCupsLabel") || 'Liter of Coffee', 
        `${comparisons.coffeeCups.toFixed(4)}`, 
        'coffee-icon.svg');
    
    // Update energy comparisons section if it exists
    const energyComparisonsElement = findById("llm-energy-comparisons-list");
    if (energyComparisonsElement) {
        energyComparisonsElement.innerHTML = ''; // Clear existing content
        
        addComparisonItem(energyComparisonsElement, 
            chrome.i18n.getMessage("smartphoneChargesEnergyLabel") || 'Smartphone Charges', 
            `${energyComparisons.smartphoneCharges.toFixed(4)}`, 
            'smartphone-icon.svg');
        
        addComparisonItem(energyComparisonsElement, 
            chrome.i18n.getMessage("ledBulbHoursLabel") || 'LED Bulb Hours', 
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
        chrome.i18n.getMessage("carTravelLabel") || 'Car Travel', 
        "0.0000 km", 
        'car-icon.svg');
    
    addComparisonItem(comparisonsElement, 
        chrome.i18n.getMessage("coffeeCupsLabel") || 'Cups of Coffee', 
        "0.0000", 
        'coffee-icon.svg');
    
    // Update energy comparisons
    const energyComparisonsElement = findById("llm-energy-comparisons-list");
    if (energyComparisonsElement) {
        energyComparisonsElement.innerHTML = ''; // Clear existing content
        
        addComparisonItem(energyComparisonsElement, 
            chrome.i18n.getMessage("smartphoneChargesEnergyLabel") || 'Smartphone Charges', 
            "0.0000", 
            'smartphone-icon.svg');
        
        addComparisonItem(energyComparisonsElement, 
            chrome.i18n.getMessage("ledBulbHoursLabel") || 'LED Bulb Hours', 
            "0.0000", 
            'bulb-solid.svg');
    }
    
    // Display empty chart message
    const chartContainer = findById('llm-chart-container');
    chartContainer.innerHTML = `<p class="no-data-message">${chrome.i18n.getMessage("noLLMDataAvailable") || 'No LLM usage data available yet.'}</p>`;
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
    
    // Check if we have valid data
    if (!serviceData || Object.keys(serviceData).length === 0) {
        chartContainer.innerHTML = `
            <div class="no-data-message">
                <p>${chrome.i18n.getMessage("noLLMDataAvailable") || 'No LLM usage data available yet.'}</p>
                <small style="color: #666; margin-top: 8px; display: block;">Start using AI services to see your impact.</small>
            </div>`;
        return;
    }
    
    // Create chart section
    const chartSection = document.createElement('div');
    chartSection.className = 'llm-chart-section';
    
    // Add chart title
    const chartTitle = document.createElement('div');
    chartTitle.className = 'chart-title';
    chartTitle.innerHTML = `
        <h4>
            <span class="chart-icon carbon-icon"></span>
            ${chrome.i18n.getMessage("llmServiceBreakdownTitle") || "Service Carbon Impact Breakdown"}
        </h4>
        <p class="chart-subtitle">${chrome.i18n.getMessage("basedOnEcologits") || "Based on Ecologits emission factors"}</p>
    `;
    chartSection.appendChild(chartTitle);
    
    // Create legend
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.innerHTML = `
        <div class="legend-item">
            <span class="legend-color carbon-color"></span>
            <span class="legend-label">${chrome.i18n.getMessage("carbonImpact") || "Carbon Impact"} (gCO2eq)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color energy-color"></span>
            <span class="legend-label">${chrome.i18n.getMessage("energyImpact") || "Energy Impact"} (Wh)</span>
        </div>
    `;
    chartSection.appendChild(legend);
    
    // Create chart container
    const chart = document.createElement('div');
    chart.className = 'llm-dual-bar-chart';
    
    // Calculate max values for scaling
    const maxCarbonImpact = Math.max(0.01, ...Object.values(serviceData).map(service => service.carbonImpact || 0));
    const maxEnergyImpact = Math.max(0.01, ...Object.values(serviceData).map(service => service.energyImpact || 0));
    
    // Sort services by carbon impact
    const sortedServices = Object.entries(serviceData)
        .sort(([, a], [, b]) => (b.carbonImpact || 0) - (a.carbonImpact || 0));
    
    // Create service rows
    sortedServices.forEach(([service, info], index) => {
        const carbonImpact = info.carbonImpact || 0;
        const energyImpact = info.energyImpact || 0;
        
        // Calculate percentage widths with minimum visibility
        const carbonWidth = Math.max(5, (carbonImpact / maxCarbonImpact) * 100);
        const energyWidth = Math.max(5, (energyImpact / maxEnergyImpact) * 100);
        
        const serviceRow = document.createElement('div');
        serviceRow.className = 'service-row';
        serviceRow.style.animationDelay = `${index * 0.1}s`;
        
        // Service label with icon
        const serviceIconClass = getServiceIconClass(service);
        serviceRow.innerHTML = `
            <div class="service-label">
                <span class="service-icon ${serviceIconClass}"></span>
                <span class="service-name">${service}</span>
                <span class="service-count">(${info.count} ${chrome.i18n.getMessage("interactions") || "interactions"})</span>
            </div>
            <div class="impact-bars-container">
                <div class="bar-wrapper">
                    <div class="bar carbon-bar" style="width: ${carbonWidth}%; height:30px;"></div>
                    <div class="bar-value">${carbonImpact.toFixed(2)} gCO2eq</div>
                </div>
                <div class="bar-wrapper">
                    <div class="bar energy-bar" style="width: ${energyWidth}%; height:30px;"></div>
                    <div class="bar-value">${energyImpact.toFixed(2)} Wh</div>
                </div>
            </div>
        `;
        
        chart.appendChild(serviceRow);
    });
    
    chartSection.appendChild(chart);
    chartContainer.appendChild(chartSection);
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
        ? (chrome.i18n.getMessage("llmServiceBreakdownTitle") || "Service Carbon Impact Breakdown")
        : (chrome.i18n.getMessage("llmServiceEnergyBreakdownTitle") || "Service Energy Impact Breakdown");
    
    chartTitle.innerHTML = `
        <h4>
            <span class="chart-icon ${impactType === 'carbonImpact' ? 'carbon-icon' : 'energy-icon'}"></span>
            ${titleText}
        </h4>
        <p class="chart-subtitle">${chrome.i18n.getMessage("basedOnEcologits") || "Based on Ecologits emission factors"}</p>
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
            <small>(${serviceInfo.count} ${chrome.i18n.getMessage("interactions") || "interactions"})</small>
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