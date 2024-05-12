browser.tabs.query({currentWindow: true, active: true})
.then((tabs) => {
    const url = tabs[0].url;
    const parsedData = getResultFromUrl(url);
    const { id, score, requests } = parsedData;

    updateUrl(url);
    updateEcoIndexReportLink(id);
    updateScore(score);
    updateNumberOfRequests(requests);

    const sourceOfData = findById("source-of-data");
    sourceOfData.innerHTML = browser.i18n.getMessage("sourceOfData");

    const settings = findById("settings");
    settings.innerHTML = browser.i18n.getMessage("settings");

});

function updateNumberOfRequests(requests) {
    requestsTitle = findById("number-of-requests-title");
    requestsTitle.innerHTML = browser.i18n.getMessage("numberOfRequestsTitle");

    requestsDom = findById("number-of-requests");
    requestsDom.innerHTML = requests;
}

function updateScore(score) {
    scoreTitle = findById("score-title");
    scoreTitle.innerHTML = browser.i18n.getMessage("scoreTitle");

    scoreDom = findById("score");
    scoreDom.innerHTML = browser.i18n.getMessage("scoreResult", [score]);
}

function updateUrl(url) {
    const urlDom = findById("url");
    urlDom.innerHTML = url;
}

function updateEcoIndexReportLink(id) {
    const ecoIndexAnchor = findById("ecoindex-result")
    ecoIndexAnchor.innerHTML = browser.i18n.getMessage("detailedReport");
    ecoIndexAnchor.href = `https://www.ecoindex.fr/resultat/?id=${id}`;
}

function getResultFromUrl(url) {
    const localStorageData = localStorage.getItem(url);
    if(!localStorage) {
        return;
    }

    return JSON.parse(localStorageData);
}

// tool functions
function findById(id) {
    const domElement = document.getElementById(id);
    if(!domElement) {
        throw new Error(`Cannot find the domElement by id: ${id}`);
    }
    return domElement;
}