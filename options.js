window.addEventListener('DOMContentLoaded', (event) => {
    const table = document.getElementById("list-of-url-table");
    table.appendChild(createHead());
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    const items = { ...localStorage };
    const rows = Object.entries(items)
    // sort desc by visited at
    const rowsSortedByVisitedAt = rows.slice().sort(([keyA, valueA],[keyB, valueB]) => {
        const a = JSON.parse(valueA);
        const b = JSON.parse(valueB);
        return a["visitedAt"] < b["visitedAt"];
    });

    rowsSortedByVisitedAt.map(([key, value]) => {
        tbody.appendChild(createRow(key, value));
    });

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

    const averageGrade = "C";
    computeGradeIconAndPositionOnProgressBar(gradeIconProgressBar, averageGrade);
});

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
    tdGrade.innerHTML = `<img src="icons/${parsedData["grade"]}.jpg" />`;

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
    gradeIconProgressBar.src = `icons/${grade}.jpg`;
}

// tool function
function findById(id) {
    const domElement = document.getElementById(id);
    if(!domElement) {
        throw new Error(`Cannot find the domElement by id: ${id}`);
    }
    return domElement;
}