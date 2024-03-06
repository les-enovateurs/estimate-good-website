window.addEventListener('DOMContentLoaded', (event) => {
    console.log('DOM fully loaded and parsed');
    console.log({...localStorage});

    const table = document.getElementById("list-of-url-table");
    if(!table) {
        throw new Error("Cannot find the table id");
    }

    table.appendChild(createCaption());
    table.appendChild(createHead());
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    const items = { ...localStorage };
    Object.entries(items).map(([key, value]) => {
        tbody.appendChild(createRow(key, value));
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

    tr.appendChild(thLink);
    tr.appendChild(thGrade);
    tr.appendChild(thScore);
    tr.appendChild(thRequests);
    
    head.appendChild(tr);
    return  head;
}

function createRow(link, otherData) {
    const tr = document.createElement("tr");
    const parsedData = JSON.parse(otherData);

    const thLink = document.createElement("th");
    thLink.setAttribute("scope", "row");
    thLink.innerHTML = "link";

    const tdGrade = document.createElement("td");
    tdGrade.innerHTML = parsedData["grade"];

    const tdScore = document.createElement("td");
    tdScore.innerHTML = `${parsedData["score"]} / 100`;

    const tdRequests = document.createElement("td");
    tdRequests.innerHTML = parsedData["requests"];

    tr.appendChild(thLink);
    tr.appendChild(tdGrade);
    tr.appendChild(tdScore);
    tr.appendChild(tdRequests);

    return tr;

}