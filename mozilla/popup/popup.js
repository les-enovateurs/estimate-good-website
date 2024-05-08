browser.tabs.query({currentWindow: true, active: true})
    .then((tabs) => {
        const url = tabs[0].url;
        const parsedData = getResultFromUrl(url);
        const { id, score, requests } = parsedData;

        updateEcoIndexReportLink(id);
        updateStats(score, requests);

  })

function updateEcoIndexReportLink(id) {
    const ecoIndexAnchor = document.getElementById("ecoindex-result")
    if(!ecoIndexAnchor) {
        return;
    }

    ecoIndexAnchor.href = `https://www.ecoindex.fr/resultat/?id=${id}`;
}
function updateStats(score, requests) {
    const stats = document.getElementById('stats');
    if(!stats) {
        return;
    }


    const title = browser.i18n.getMessage("popUpScoreResult", [score, requests]);
    stats.innerHTML = title;
}


function getResultFromUrl(url) {
    const localStorageData = localStorage.getItem(url);
    if(!localStorage) {
        return;
    }

    return JSON.parse(localStorageData);
}