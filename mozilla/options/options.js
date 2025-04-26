// variables
let itemsPerPage = 10;

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
    // Set up internationalized text labels
    const llmImpactTitle = findById("llm-impact-title");
    llmImpactTitle.innerHTML = browser.i18n.getMessage("llmImpactTitle") || "LLM Carbon Impact";
    
    const llmCarbonLabel = findById("llm-carbon-label");
    llmCarbonLabel.innerHTML = browser.i18n.getMessage("llmCarbonLabel") || "Total Carbon (gCO2eq)";
    
    const llmInteractionsLabel = findById("llm-interactions-label");
    llmInteractionsLabel.innerHTML = browser.i18n.getMessage("llmInteractionsLabel") || "Interactions";
    
    const llmTokensLabel = findById("llm-tokens-label");
    llmTokensLabel.innerHTML = browser.i18n.getMessage("llmTokensLabel") || "Total Tokens";
    
    const llmEquivalentTitle = findById("llm-equivalent-title");
    llmEquivalentTitle.innerHTML = browser.i18n.getMessage("llmEquivalentTitle") || "Environmental Equivalent";
    
    // Update Clear LLM button text
    const clearLLMButton = findById("clearLLMHistory");
    clearLLMButton.innerHTML = browser.i18n.getMessage("clearLLMHistory") || "Clear LLM History";
    
    console.log("Requesting LLM statistics...");
    try {
        const llmStats = await browser.runtime.sendMessage({
            action: "getLLMStatistics"
        });
        
        console.log("Received LLM statistics:", llmStats);
        
        if (!llmStats) return;
        
        // Update the statistics values
        const totalCarbonElement = findById("llm-total-carbon");
        
        // Add this null check and default value:
        const carbonImpact = llmStats.totalCarbonImpact || 0;
        totalCarbonElement.textContent = carbonImpact.toFixed(6);
        
        const interactionsElement = findById("llm-interactions");
        interactionsElement.textContent = llmStats.totalInteractions || 0;
        
        const tokensElement = findById("llm-tokens");
        const totalTokens = (llmStats.totalInputTokens || 0) + (llmStats.totalOutputTokens || 0);
        tokensElement.textContent = totalTokens.toLocaleString();
        
        // Update comparisons with null checks
        const comparisonsElement = findById("llm-comparisons-list");
        comparisonsElement.innerHTML = ''; // Clear existing content
        
        if (llmStats.comparisons) {
            addComparisonItem(comparisonsElement, 
                              browser.i18n.getMessage("carTravelLabel") || 'Car Travel', 
                              `${(llmStats.comparisons.carKilometers || 0).toFixed(4)} km`, 
                              'car-icon.svg');
                             
            addComparisonItem(comparisonsElement, 
                              browser.i18n.getMessage("smartphoneChargesLabel") || 'Smartphone Charges', 
                              `${(llmStats.comparisons.smartphoneCharges || 0).toFixed(4)}`, 
                              'smartphone-icon.svg');
                             
            addComparisonItem(comparisonsElement, 
                              browser.i18n.getMessage("coffeeCupsLabel") || 'Cups of Coffee', 
                              `${(llmStats.comparisons.coffeeCups || 0).toFixed(4)}`, 
                              'coffee-icon.svg');
        }
        
        // Generate chart of service breakdown
        renderLLMServiceChart(llmStats.serviceBreakdown || {});
    } catch (error) {
        console.error("Error fetching LLM statistics:", error);
    }
}

function addComparisonItem(container, label, value, iconSrc) {
    const item = document.createElement('div');
    item.className = 'comparison-item';
    
    item.innerHTML = `
        <div class="comparison-icon">
            <img src="../icons/${iconSrc}" alt="${label}" />
        </div>
        <div class="comparison-info">
            <div class="comparison-label">${label}</div>
            <div class="comparison-value">${value}</div>
        </div>
    `;
    
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
    
    // Create a simple bar chart with div elements
    const chart = document.createElement('div');
    chart.className = 'llm-bar-chart';
    
    // Find the highest carbon impact for scaling
    let maxImpact = 0;
    for (const service in serviceData) {
        maxImpact = Math.max(maxImpact, serviceData[service].carbonImpact);
    }
    
    // Add chart title with emission factor info
    const chartTitle = document.createElement('div');
    chartTitle.className = 'chart-title';
    chartTitle.innerHTML = `<h4>${browser.i18n.getMessage("llmServiceBreakdownTitle") || "Service Breakdown"}</h4>
                           <p class="chart-subtitle">${browser.i18n.getMessage("basedOnEcologits") || "Based on Ecologits emission factors"}</p>`;
    chartContainer.appendChild(chartTitle);
    
    // Create bars for each service
    for (const service in serviceData) {
        // Rename serviceData to serviceInfo to avoid collision
        const serviceInfo = serviceData[service];
        
        // Calculate percentage width based on max impact
        const percentWidth = (serviceInfo.carbonImpact / maxImpact) * 100;
        
        // Determine service type for emission factor info
        let serviceType = "openai";
        if (service.toLowerCase().includes("meta")) {
            serviceType = "meta";
        }
        
        const barContainer = document.createElement('div');
        barContainer.className = 'bar-container';
        
        const label = document.createElement('div');
        label.className = 'bar-label';
        label.textContent = service;
        
        const barWrapper = document.createElement('div');
        barWrapper.className = 'bar-wrapper';
        
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.width = `${percentWidth}%`;
        
        const value = document.createElement('div');
        value.className = 'bar-value';
        value.innerHTML = `${serviceInfo.carbonImpact.toFixed(6)} gCO2eq
                         <small>(${serviceInfo.count} ${browser.i18n.getMessage("interactions") || "interactions"})</small>`;
        
        barWrapper.appendChild(bar);
        barWrapper.appendChild(value);
        
        barContainer.appendChild(label);
        barContainer.appendChild(barWrapper);
        
        chart.appendChild(barContainer);
    }
    
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
                        <li>&lt;50 tokens: 2.68 gCO2eq</li>
                        <li>&lt;170 tokens: 9.11 gCO2eq</li>
                        <li>&lt;250 tokens: 13.4 gCO2eq</li>
                        <li>&lt;400 tokens: 21.4 gCO2eq</li>
                        <li>&lt;5000 tokens: 268 gCO2eq</li>
                        <li>&lt;15000 tokens: 803 gCO2eq</li>
                    </ul>
                </div>
                <div class="factor-item">
                    <strong>Meta:</strong>
                    <ul>
                        <li>&lt;50 tokens: 2.68 gCO2eq</li>
                        <li>&lt;170 tokens: 9.11 gCO2eq</li>
                        <li>&lt;250 tokens: 13.4 gCO2eq</li>
                        <li>&lt;400 tokens: 21.4 gCO2eq</li>
                        <li>&lt;15000 tokens: 30864.72 gCO2eq</li>
                    </ul>
                </div>
            </div>
            <p><small>${browser.i18n.getMessage("basedOnStudy") || "Based on the Ecologits research study"}</small></p>
        </details>
    `;
    
    chartContainer.appendChild(chart);
    chartContainer.appendChild(emissionFactorsInfo);
}