//prod
const baseURL = 'https://compressor.les-enovateurs.com/';
//dev
// const baseURL = 'http://localhost:8080/';

function updateIcon(tabId, grade) {
    browser.pageAction.setIcon(
        {
            tabId,
            path: getImagesPathFromScore(grade)
        }
    );
}

function updateTitle(tabId, title) {
    browser.pageAction.setTitle({ tabId, title });
}

function getImagesPathFromScore(score) {
    const DIRECTORY_PATH = "icons";
    if (score) {
        return {
            16: `${DIRECTORY_PATH}/16/${score}.jpg`,
            32: `${DIRECTORY_PATH}/${score}.jpg`,
        };
    }

    return {
        16: `${DIRECTORY_PATH}/16/unknown.jpg`,
        32: `${DIRECTORY_PATH}/unknown.jpg`,
    };
}

function renderResult(tabId, parsedData) {
    if(parsedData === null ) {
        updateIcon(tabId, null);

        const title = browser.i18n.getMessage("popUpNoGrade");
        updateTitle(tabId, title);
    } else {
        const { grade, score, requests } = parsedData;
        updateIcon(tabId, grade);

        const title = browser.i18n.getMessage("popUpScoreResult", [score, requests]);
        updateTitle(tabId, title);
    }

    browser.pageAction.show(tabId);
}

function storeResult(url, parsedData) {
    localStorage.setItem(url, JSON.stringify(parsedData));

    const { score } = parsedData;
    // for statistics purpose
    if(score < 50) {
        const { score, requests, grade } = parsedData;
        fetch(`${baseURL}ecoindex?pth=${url}&scr=${score}&rqt=${requests}&bge=${grade}`);
    }

}

// select only the information we need for the app
function parseData(data) {
    const { grade, score, requests, id } = data;
    return { grade, score, requests, id };
}

function parseEcoIndexPayload(ecoIndexPayload) {
    const parsedData = parseData(ecoIndexPayload["latest-result"]);

    // if grade exist, we assume the others fields are here as well
    if(parsedData.grade !== "") {
        return parsedData;
    }

    const hostResults = ecoIndexPayload["host-results"];
    if(hostResults.length === 0) {
        throw new Error("Cannot retrieve the grade");
    }

    return parseData(hostResults[0]);
}

async function callEcoIndex(tabId, url, retry) {
    const ecoIndexResult = await getEcoIndexCachetResult(tabId, url);

    // if no result. Ask EcoIndex to analyse the url
    if(ecoIndexResult === null) {
        const tokenFromTaskResponse = await askToComputeEvaluation(url);
        if (tokenFromTaskResponse.ok && retry === false) {
            // try again in case of the task is processed within 30 seconds
            setTimeout(() => {
                callEcoIndex(tabId, url, true);
            },30000);
            return;
        } else {
            renderResult(tabId, null);
            return;
        }
    }
    renderResult(tabId, ecoIndexResult);
    storeResult(url, ecoIndexResult);
}

async function getEcoIndexCachetResult(tabId, url) {
    const ecoIndexResponse = await fetch(`https://bff.ecoindex.fr/api/results/?url=${url}`);
    if (ecoIndexResponse.ok) {
        const ecoIndexResponseObject = await ecoIndexResponse.json();
        return parseEcoIndexPayload(ecoIndexResponseObject);
    } else {
        return null;
    }
}

async function askToComputeEvaluation(url) {
    return fetch("https://bff.ecoindex.fr/api/tasks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({url})
    });
}

/*
Each time a tab is updated, reset the page action for that tab.
*/
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    if (tab.status == "complete" && tab.active) {
        // try to get results cached in the ecoindex server
        callEcoIndex(tab.id, tab.url, false);
    }
});

browser.pageAction.onClicked.addListener((tab) => {
    localStorageData = localStorage.getItem(tab.url);
    if(!localStorage) {
        return;
    }

    const parsedData = JSON.parse(localStorageData);
    const { id } = parsedData;
    const ecoIndexPage = `https://www.ecoindex.fr/resultat/?id=${id}`;
    browser.tabs.create({
        url: ecoIndexPage
    });
});