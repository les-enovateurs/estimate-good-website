// variables
let itemsPerPage = 10;
let translations = null;
let currentLanguage = null;

// Translation system
async function loadTranslations(langCode) {
    if (!langCode) {
        translations = null;
        currentLanguage = null;
        return;
    }
    currentLanguage = langCode;
    try {
        const response = await fetch(`../_locales/${langCode}/messages.json`);
        translations = await response.json();
    } catch (e) {
        console.error('Failed to load translations', e);
        translations = null;
        currentLanguage = null;
    }
}

function getLocalizedMessage(key, substitutions) {
    if (translations && translations[key]) {
        let message = translations[key].message;
        if (translations[key].placeholders) {
            Object.entries(translations[key].placeholders).forEach(([phName, phDef]) => {
                const content = phDef.content;
                // Simple support for $1, $2 etc.
                const match = content.match(/^\$(\d+)$/);
                if (match && substitutions) {
                    const index = parseInt(match[1]) - 1;
                    if (substitutions[index] !== undefined) {
                        message = message.replace(new RegExp(`\\$${phName}\\$`, 'gi'), substitutions[index]);
                    }
                }
            });
        }
        return message;
    }
    return chrome.i18n.getMessage(key, substitutions);
}

window.addEventListener('DOMContentLoaded', async (event) => {
    // Badge toggle setting
    initBadgeToggle();

    // Initialize language setting - this will also trigger initial localization
    await initBadgeLanguage();

    // listener
    const removeHistoryButton = findById("clearHistory");
    removeHistoryButton.addEventListener('click', () => {
        localStorage.clear();
    });

    const rowsSortedByVisitedAt = await computeData();
    const currentPage = 1;

    // Use global variable or pass it, but for now we follow existing pattern
    // However, we need to make sure renderTable uses localized strings.
    // We will call applyLocalizations() inside initBadgeLanguage or explicitly here if needed.
    // But initBadgeLanguage is async now and will likely handle it.

    // Initial render might happen before translations are loaded if we don't await.
    // We awaited initBadgeLanguage.

    // We need to render the table initially.
    renderTable(rowsSortedByVisitedAt, currentPage);
    renderPagination(rowsSortedByVisitedAt.length, itemsPerPage, currentPage);

    const gradeIconProgressBar = findById("grade-average-icon-progress-bar");
    const averageGrade = computeAverageNote(rowsSortedByVisitedAt, firstDateOfMonth(new Date()), lastDateOfMonth(new Date()));
    computeGradeIconAndPositionOnProgressBar(gradeIconProgressBar, averageGrade);

    renderCharts(rowsSortedByVisitedAt);
});

async function applyLocalizations() {
    const removeHistoryButton = findById("clearHistory");
    removeHistoryButton.innerHTML = getLocalizedMessage("clearHistory");

    const header = findById('settings-header');
    header.innerHTML = getLocalizedMessage("settingsHeader");

    const averageMonthTitle = findById("average-month-title");
    averageMonthTitle.innerHTML = getLocalizedMessage("averageMonthTitle");

    const browserHistoryTitle = findById("browser-history-title");
    browserHistoryTitle.innerHTML = getLocalizedMessage("browserHistoryTitle");

    // Set localized app name
    const appNameEl = document.getElementById('app-name');
    if (appNameEl) appNameEl.textContent = getLocalizedMessage('appName') || 'EcoSurf Analyser';

    // Localize language field labels
    const badgeLanguageLabel = document.getElementById('badge-language-label');
    if (badgeLanguageLabel) badgeLanguageLabel.textContent = getLocalizedMessage('badgeLanguageLabel') || 'Language';
    const badgeLanguageDescription = document.getElementById('badge-language-description');
    if (badgeLanguageDescription) badgeLanguageDescription.textContent = getLocalizedMessage('badgeLanguageDescription') || 'Force the language of the badge content';

    updateBadgeSettingsLabels();
    initChartLabels();

    // We also need to re-render the table header which is dynamic
    // But renderTable takes rows.
    // We can just re-render the table if we have the data.
    // Or we can just update the Headers if we can find them.
    // createHead() is called by renderTable.
    // to update table headers we need to call renderTable again.
    const rows = await computeData();
    // Assuming currentPage is 1 or we need to track it?
    // tracking currentPage is hard as it is local var in DOMContentLoaded.
    // For now, let's just re-render page 1 or try to find current page.
    // Simplification: just re-render current state if possible.
    // But itemsPerPage is global.
    // There is no global currentPage.
    // Let's just update the purely static text elements first.
    // The table headers will update on next navigation or if we force a refresh.
    // Ideally we should refresh the table too.

    // Let's try to get current page from pagination?
    const activePageBtn = document.querySelector('.pagination-selected');
    let currentPage = 1;
    if (activePageBtn) {
        currentPage = parseInt(activePageBtn.textContent) || 1;
    }
    renderTable(rows, currentPage);

    // Re-render charts to update labels (e.g. "Average score")
    renderCharts(rows);
}

// Badge toggle functions
function initBadgeToggle() {
    const badgeToggle = document.getElementById('badge-toggle');
    if (!badgeToggle) return;

    // Load current setting
    chrome.storage.local.get(['badgeEnabled'], (result) => {
        // Default to true if not set
        badgeToggle.checked = result.badgeEnabled !== false;
    });

    // Save setting on change
    badgeToggle.addEventListener('change', (event) => {
        chrome.storage.local.set({ badgeEnabled: event.target.checked });
    });

    // Update labels
    updateBadgeSettingsLabels();
}

function updateBadgeSettingsLabels() {
    const badgeSettingsTitle = document.getElementById('badge-settings-title');
    if (badgeSettingsTitle) {
        badgeSettingsTitle.textContent = getLocalizedMessage('badgeSettingsTitle') || 'Display';
    }

    const badgeToggleLabel = document.getElementById('badge-toggle-label');
    if (badgeToggleLabel) {
        badgeToggleLabel.textContent = getLocalizedMessage('badgeToggleLabel') || 'Show floating badge';
    }

    const badgeToggleDescription = document.getElementById('badge-toggle-description');
    if (badgeToggleDescription) {
        badgeToggleDescription.textContent = getLocalizedMessage('badgeToggleDescription') || 'Display a floating badge on websites with EcoIndex score and privacy info';
    }
}

async function initBadgeLanguage() {
    const badgeLanguage = document.getElementById('badge-language');
    if (!badgeLanguage) return;

    // Load current setting
    return new Promise((resolve) => {
        chrome.storage.local.get(['badgeLanguage'], async (result) => {
            if (result && result.badgeLanguage) {
                badgeLanguage.value = result.badgeLanguage;
                await loadTranslations(result.badgeLanguage);

                // Also ensure messages are stored for the badge
                try {
                    const response = await fetch(`../_locales/${result.badgeLanguage}/messages.json`);
                    if (response.ok) {
                        const messages = await response.json();
                        chrome.storage.local.set({ badgeLanguageMessages: messages });
                    }
                } catch (e) {
                    console.error('Failed to preload language messages:', e);
                }
            } else {
                badgeLanguage.value = '';
                translations = null;
            }
            // Trigger initial localization
            await applyLocalizations();
            resolve();
        });
    }).then(() => {
        // Save setting on change
        badgeLanguage.addEventListener('change', async (event) => {
            const value = event.target.value;
            if (value) {
                // Load the messages for the selected language and store them
                try {
                    const response = await fetch(`../_locales/${value}/messages.json`);
                    if (response.ok) {
                        const messages = await response.json();
                        chrome.storage.local.set({
                            badgeLanguage: value,
                            badgeLanguageMessages: messages
                        });
                    } else {
                        chrome.storage.local.set({ badgeLanguage: value });
                    }
                } catch (e) {
                    console.error('Failed to load language messages:', e);
                    chrome.storage.local.set({ badgeLanguage: value });
                }
                await loadTranslations(value);
            } else {
                // Remove the forced language to use system/default behavior
                chrome.storage.local.remove(['badgeLanguage', 'badgeLanguageMessages']);
                translations = null;
            }
            await applyLocalizations();
        });
    });
}

// Charts functions
let chartEvolution = null;
let chartDistribution = null;
let chartTopSites = null;
let currentTopSitesMode = 'best';

const gradeColors = {
    'A': '#2e9b43',
    'B': '#34bc6e',
    'C': '#cadd00',
    'D': '#f7ed00',
    'E': '#ffce00',
    'F': '#fb9929',
    'G': '#f01c16'
};

function initChartLabels() {
    const chartsTitle = document.getElementById('charts-title');
    if (chartsTitle) {
        chartsTitle.textContent = getLocalizedMessage('chartsTitle') || 'Statistics';
    }

    const chartEvolutionTitle = document.getElementById('chart-evolution-title');
    if (chartEvolutionTitle) {
        chartEvolutionTitle.textContent = getLocalizedMessage('chartEvolutionTitle') || 'Score evolution';
    }

    const chartDistributionTitle = document.getElementById('chart-distribution-title');
    if (chartDistributionTitle) {
        chartDistributionTitle.textContent = getLocalizedMessage('chartDistributionTitle') || 'Grade distribution';
    }

    const chartTopSitesTitle = document.getElementById('chart-top-sites-title');
    if (chartTopSitesTitle) {
        chartTopSitesTitle.textContent = getLocalizedMessage('chartTopSitesTitle') || 'Top 10 sites';
    }

    const btnBestSites = document.getElementById('btn-best-sites');
    if (btnBestSites) {
        btnBestSites.textContent = getLocalizedMessage('btnBestSites') || 'Best';
    }

    const btnWorstSites = document.getElementById('btn-worst-sites');
    if (btnWorstSites) {
        btnWorstSites.textContent = getLocalizedMessage('btnWorstSites') || 'Worst';
    }
}

function renderCharts(rows) {
    renderEvolutionChart(rows);
    renderDistributionChart(rows);
    renderTopSitesChart(rows, 'best');
    setupTopSitesToggle(rows);
}

function renderEvolutionChart(rows) {
    const ctx = document.getElementById('chart-evolution');
    if (!ctx) return;

    // Group by day and calculate average score
    const scoresByDay = {};
    rows.forEach(([key, value]) => {
        try {
            const data = JSON.parse(value);
            if (data.score && data.visitedAt) {
                const date = new Date(data.visitedAt);
                const dayKey = date.toISOString().split('T')[0];
                if (!scoresByDay[dayKey]) {
                    scoresByDay[dayKey] = { total: 0, count: 0 };
                }
                scoresByDay[dayKey].total += data.score;
                scoresByDay[dayKey].count++;
            }
        } catch (e) {}
    });

    // Sort by date and take last 30 days
    const sortedDays = Object.keys(scoresByDay).sort().slice(-30);
    const labels = sortedDays.map(day => {
        const date = new Date(day);
        return date.toLocaleDateString(currentLanguage || chrome.i18n.getUILanguage(), { month: 'short', day: 'numeric' });
    });
    const data = sortedDays.map(day => Math.round(scoresByDay[day].total / scoresByDay[day].count));

    if (chartEvolution) {
        chartEvolution.destroy();
    }

    chartEvolution = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: getLocalizedMessage('averageScore') || 'Average score',
                data: data,
                borderColor: '#30A8A7',
                backgroundColor: 'rgba(48, 168, 167, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: '#a0a0a0' },
                    grid: { color: '#333' }
                },
                x: {
                    ticks: { color: '#a0a0a0' },
                    grid: { color: '#333' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#fff' }
                }
            }
        }
    });
}

function renderDistributionChart(rows) {
    const ctx = document.getElementById('chart-distribution');
    if (!ctx) return;

    // Count grades
    const gradeCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 };
    rows.forEach(([key, value]) => {
        try {
            const data = JSON.parse(value);
            if (data.grade && gradeCounts.hasOwnProperty(data.grade)) {
                gradeCounts[data.grade]++;
            }
        } catch (e) {}
    });

    const labels = Object.keys(gradeCounts);
    const data = Object.values(gradeCounts);
    const colors = labels.map(grade => gradeColors[grade]);

    if (chartDistribution) {
        chartDistribution.destroy();
    }

    chartDistribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#1a1d20',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#fff' }
                }
            }
        }
    });
}

function renderTopSitesChart(rows, mode) {
    const ctx = document.getElementById('chart-top-sites');
    if (!ctx) return;

    // Parse and sort sites by score
    const sites = [];
    const domains = {};

    rows.forEach(([url, value]) => {
        try {
            const data = JSON.parse(value);
            if (data.score !== undefined && data.grade) {
                // Extract domain from URL
                let domain = url;
                try {
                    domain = new URL(url).hostname.replace('www.', '');
                } catch (e) {}

                if (!domains[domain]) {
                    domains[domain] = { totalScore: 0, count: 0 };
                }
                domains[domain].totalScore += data.score;
                domains[domain].count += 1;
            }
        } catch (e) {}
    });

    Object.keys(domains).forEach(domain => {
        const avgScore = Math.round(domains[domain].totalScore / domains[domain].count);
        let grade = 'G';
        if (avgScore >= 80) grade = 'A';
        else if (avgScore >= 70) grade = 'B';
        else if (avgScore >= 55) grade = 'C';
        else if (avgScore >= 40) grade = 'D';
        else if (avgScore >= 25) grade = 'E';
        else if (avgScore >= 10) grade = 'F';

        sites.push({
            url: domain,
            score: avgScore,
            grade: grade
        });
    });

    // Sort and get top 10
    let sortedSites;
    if (mode === 'best') {
        sortedSites = sites.sort((a, b) => b.score - a.score).slice(0, 10);
    } else {
        sortedSites = sites.sort((a, b) => a.score - b.score).slice(0, 10);
    }

    const labels = sortedSites.map(s => s.url.length > 25 ? s.url.substring(0, 25) + '...' : s.url);
    const data = sortedSites.map(s => s.score);
    const colors = sortedSites.map(s => gradeColors[s.grade] || '#888');

    if (chartTopSites) {
        chartTopSites.destroy();
    }

    chartTopSites = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: getLocalizedMessage('score') || 'Score',
                data: data,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: '#a0a0a0' },
                    grid: { color: '#333' }
                },
                y: {
                    ticks: { color: '#a0a0a0' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function setupTopSitesToggle(rows) {
    const btnBest = document.getElementById('btn-best-sites');
    const btnWorst = document.getElementById('btn-worst-sites');

    if (btnBest) {
        btnBest.addEventListener('click', () => {
            if (currentTopSitesMode !== 'best') {
                currentTopSitesMode = 'best';
                btnBest.classList.add('active');
                btnWorst.classList.remove('active');
                renderTopSitesChart(rows, 'best');
            }
        });
    }

    if (btnWorst) {
        btnWorst.addEventListener('click', () => {
            if (currentTopSitesMode !== 'worst') {
                currentTopSitesMode = 'worst';
                btnWorst.classList.add('active');
                btnBest.classList.remove('active');
                renderTopSitesChart(rows, 'worst');
            }
        });
    }
}

// Compute data and render functions
async function computeData() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, function(items) {
            const rows = Object.entries(items);
            // sort desc by visited at
            const rowsSortedByVisitedAt = rows.slice().sort(([keyA, valueA],[keyB, valueB]) => {
                try {
                    const a = JSON.parse(valueA);
                    const b = JSON.parse(valueB);
                    return a["visitedAt"] < b["visitedAt"];
                } catch (e) {
                    return 0;
                }
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
    paginationLabel.innerHTML = getLocalizedMessage("paginateBy");

    const paginationSelect = findById("select-paginate-by");
    paginationSelect.addEventListener('change', (event) => {
        event.preventDefault();

        itemsPerPage = parseInt(event.target.value, 10) || 10;
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
    thLink.innerHTML = getLocalizedMessage("linkTable");

    const thGrade = document.createElement("th");
    thGrade.setAttribute("scope", "col");
    thGrade.innerHTML = getLocalizedMessage("gradeTable");

    const thScore = document.createElement("th");
    thScore.setAttribute("scope", "col");
    thScore.innerHTML = getLocalizedMessage("scoreTable");

    const thRequests = document.createElement("th");
    thRequests.setAttribute("scope", "col");
    thRequests.innerHTML = getLocalizedMessage("nbRequestsTable");

    const thVisitedAt = document.createElement("th");
    thVisitedAt.setAttribute("scope", "col");
    thVisitedAt.innerHTML = getLocalizedMessage("visitedAtTable");

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
    let parsedData;
    try {
        parsedData = JSON.parse(otherData);
    } catch (e) {
        console.error('Failed to parse row data:', e);
        return tr;
    }

    const thLink = document.createElement("th");
    thLink.setAttribute("scope", "row");
    thLink.classList.add("link-th");
    const anchor = document.createElement("a");
    anchor.classList.add("link-url");
    anchor.href = link;
    anchor.textContent = link;
    thLink.appendChild(anchor);

    const tdGrade = document.createElement("td");
    const gradeImg = document.createElement("img");
    const validGrades = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const grade = validGrades.includes(parsedData["grade"]) ? parsedData["grade"] : 'A';
    gradeImg.src = `../icons/${grade}.jpg`;
    gradeImg.alt = `Grade ${grade}`;
    tdGrade.appendChild(gradeImg);

    const tdScore = document.createElement("td");
    const scoreSpan = document.createElement("span");
    scoreSpan.style.fontWeight = "bold";
    scoreSpan.textContent = parsedData["score"];
    tdScore.appendChild(scoreSpan);
    tdScore.appendChild(document.createTextNode(" / 100"));

    const tdRequests = document.createElement("td");
    tdRequests.textContent = parsedData["requests"];

    const tdVisitedAt = document.createElement("td");
    tdVisitedAt.textContent = prettyDate(parsedData["visitedAt"]);

    tr.appendChild(tdGrade);
    tr.appendChild(thLink);
    tr.appendChild(tdScore);
    tr.appendChild(tdRequests);
    tr.appendChild(tdVisitedAt);

    return tr;
}

async function renderPagination(numberOfItems, itemsPerPage, currentPage) {
    const paginationPages = findById("pagination-pages");
    // remove inner itemps
    paginationPages.innerHTML = "";

    const firstPageDom = document.createElement("button");
    firstPageDom.innerHTML = "<<";
    firstPageDom.addEventListener('click', async (event) => {
        event.preventDefault();

        const currentPage = 1;
        const rows = await computeData();
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
    diff < 60 && getLocalizedMessage("now")
    || diff < 120 && getLocalizedMessage("minute")
    || diff < 3600 && getLocalizedMessage("minutes", [Math.floor(diff / 60)])
    || diff < 7200 &&  getLocalizedMessage("hour")
    || diff < 86400 && getLocalizedMessage("hours", [Math.floor(diff / 3600)]))
    || day_diff == 1 && getLocalizedMessage("yesterday") || day_diff < 7 && getLocalizedMessage("days", [day_diff])
    || day_diff < 31 && getLocalizedMessage("weeks", [Math.ceil(day_diff / 7)]);
}

function computeAverageNote(rowsSortedByVisitedAt, fromDate, toDate) {
    const rowsSortedByVisitedRange = rowsSortedByVisitedAt.slice().filter( ([key, value]) => {
        try {
            const a = JSON.parse(value);
            const date = new Date(a["visitedAt"]);
            return date >= fromDate && date <= toDate;
        } catch (e) {
            return false;
        }
    });

    const sumNotes = rowsSortedByVisitedRange.reduce((acc, [currentKey, currentValue]) => {
        try {
            const a = JSON.parse(currentValue);
            return fromGradeToNote(a["grade"]) + acc;
        } catch (e) {
            return acc;
        }
    }, 0);

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

