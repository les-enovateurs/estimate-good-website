window.addEventListener('DOMContentLoaded', async (event) => {
    const table = document.getElementById("list-of-url-table");
    if(!table) {
        throw new Error("Cannot find the table id");
    }

    table.appendChild(createCaption());
    table.appendChild(createHead());
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    const rowsSortedByVisitedAt = await computeData();
    console.log(rowsSortedByVisitedAt)

    rowsSortedByVisitedAt.map(([key, value]) => {
        tbody.appendChild(createRow(key, value));
    });

    // listener
    const removeHistoryButton = document.getElementById("clearHistory");
    if(!removeHistoryButton) {
        throw new Error("Cannot find the button id");
    }

    removeHistoryButton.innerHTML = chrome.i18n.getMessage("clearHistory");
    removeHistoryButton.addEventListener('click', () => {
        localStorage.clear();
    });

    // header
    const header = document.getElementById('settings-header');
    if(!header) {
        throw new Error("Cannot find the header");
    }
    header.innerHTML = chrome.i18n.getMessage("settingsHeader");

    // header settings
    const averageMonthTitle = document.getElementById("average-month-title");
    averageMonthTitle.innerHTML = chrome.i18n.getMessage("averageMonthTitle");

    const averageNoteSpan = document.getElementById('averageNote');
    if(!averageNoteSpan) {
        throw new Error("Cannot find the average note id");
    }

    const averageNote = computeAverageNote(rowsSortedByVisitedAt, firstDateOfMonth(new Date()), lastDateOfMonth(new Date()));
    averageNoteSpan.innerHTML = `<img src="icons/${averageNote}.jpg" />`;

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

function createCaption() {
    const caption = document.createElement("caption");
    caption.innerHTML = "Here is the list of your history";
    return caption;
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

    tr.appendChild(thLink);
    tr.appendChild(thGrade);
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
    thLink.classList.add("link-url")
    thLink.innerHTML = `<a style="color:white" href="${link}">${link}</a>`;

    const tdGrade = document.createElement("td");
    tdGrade.innerHTML = `<img src="icons/${parsedData["grade"]}.jpg" />`;

    const tdScore = document.createElement("td");
    tdScore.innerHTML = `<span style="font-weight:bold">${parsedData["score"]}</span> / 100`;

    const tdRequests = document.createElement("td");
    tdRequests.innerHTML = parsedData["requests"];

    const tdVisitedAt = document.createElement("td");
    tdVisitedAt.innerHTML = prettyDate(parsedData["visitedAt"]);

    tr.appendChild(thLink);
    tr.appendChild(tdGrade);
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
