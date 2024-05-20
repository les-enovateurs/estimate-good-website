// variables
let itemsPerPage = 10;

window.addEventListener('DOMContentLoaded', async (event) => {
    // listener
    const removeHistoryButton = findById("clearHistory");
    removeHistoryButton.innerHTML = chrome.i18n.getMessage("clearHistory");
    removeHistoryButton.addEventListener('click', () => {
        localStorage.clear();
    });

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
});

async function computeData() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, function(items) {
            const rows = Object.entries(items)
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