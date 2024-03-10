window.addEventListener('DOMContentLoaded', (event) => {
    //console.log('DOM fully loaded and parsed');
    //console.log(JSON.stringify({...localStorage}));

    const table = document.getElementById("list-of-url-table");
    if(!table) {
        throw new Error("Cannot find the table id");
    }

    table.appendChild(createCaption());
    table.appendChild(createHead());
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    const items = { ...localStorage };
    /*const items = {
        "https://www.google.com/url": '{"grade":"C","score":63,"requests":44,"id":"5277e57b-ec03-4c2b-85b5-b389a4914b5c","expirationDate":1710454961512,"visitedAt":"2024-03-07T22:22:41.514Z"}',
        "https://www.google.com/search?q=tables+html+20241nuoq29qENwEYxw": '{"grade":"D","score":44,"requests":54,"id":"9ef62ed4-46e8-4890-93b1-75955595b047","expirationDate":1710626047905,"visitedAt":"2024-03-09T21:54:07.906Z"}',
        "https://developer.mozilla.org/fr/docs/Web/CSS/text-overflow": '{"grade":"D","score":52,"requests":31,"id":"77e24428-ad2f-4599-9cd2-fb85a81bcd16","expirationDate":1710454139769,"visitedAt":"2024-03-07T22:08:59.772Z"}'
    };*/
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
    const removeHistoryButton = document.getElementById("clearHistory");
    if(!removeHistoryButton) {
        throw new Error("Cannot find the button id");
    }

    removeHistoryButton.innerHTML = browser.i18n.getMessage("clearHistory");
    removeHistoryButton.addEventListener('click', () => {
        localStorage.clear();
    });

    // header
    const header = document.getElementById('settings-header');
    if(!header) {
        throw new Error("Cannot find the header");
    }
    header.innerHTML = browser.i18n.getMessage("settingsHeader");

    
});


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
    diff < 60 && browser.i18n.getMessage("now") 
    || diff < 120 && browser.i18n.getMessage("minute")
    || diff < 3600 && browser.i18n.getMessage("minutes", [Math.floor(diff / 60)])
    || diff < 7200 &&  browser.i18n.getMessage("hour")
    || diff < 86400 && browser.i18n.getMessage("hours", [Math.floor(diff / 3600)])) 
    || day_diff == 1 && browser.i18n.getMessage("yesterday") || day_diff < 7 && browser.i18n.getMessage("days", [day_diff]) 
    || day_diff < 31 && browser.i18n.getMessage("weeks", [Math.ceil(day_diff / 7)]);
}
