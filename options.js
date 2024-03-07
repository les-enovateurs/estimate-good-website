window.addEventListener('DOMContentLoaded', (event) => {
    //console.log('DOM fully loaded and parsed');
    //console.log({...localStorage});

    const table = document.getElementById("list-of-url-table");
    if(!table) {
        throw new Error("Cannot find the table id");
    }

    table.appendChild(createCaption());
    table.appendChild(createHead());
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    const items = { ...localStorage };
    const rows = Object.entries(items)
    // sort desc by visited at
    const rowsSortedByVisitedAt = rows.slice().sort(([keyA, valueA],[keyB, valueB]) => {
        const a = JSON.parse(valueA);
        const b = JSON.parse(valueB);
        console.log(a["visitedAt"] < b["visitedAt"])
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

    removeHistoryButton.addEventListener('click', () => {
        localStorage.clear();
    });
    
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
    thLink.innerHTML = "Link";

    const thGrade = document.createElement("th");
    thGrade.setAttribute("scope", "col");
    thGrade.innerHTML = "Grade";

    const thScore = document.createElement("th");
    thScore.setAttribute("scope", "col");
    thScore.innerHTML = "Score";

    const thRequests = document.createElement("th");
    thRequests.setAttribute("scope", "col");
    thRequests.innerHTML = "Nb Requests";

    const thVisitedAt = document.createElement("th");
    thVisitedAt.setAttribute("scope", "col");
    thVisitedAt.innerHTML = "Visited At";

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
    thLink.innerHTML = link;

    const tdGrade = document.createElement("td");
    tdGrade.innerHTML = parsedData["grade"];

    const tdScore = document.createElement("td");
    tdScore.innerHTML = `${parsedData["score"]} / 100`;

    const tdRequests = document.createElement("td");
    tdRequests.innerHTML = parsedData["requests"];

    const tdVisitedAt = document.createElement("td");
    tdVisitedAt.innerHTML = parsedData["visitedAt"];

    tr.appendChild(thLink);
    tr.appendChild(tdGrade);
    tr.appendChild(tdScore);
    tr.appendChild(tdRequests);
    tr.appendChild(tdVisitedAt);

    return tr;

}