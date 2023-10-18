//prod
const baseURL = 'https://compressor.les-enovateurs.com/';
//dev
// const baseURL = 'http://localhost:8080/';

function updateTabUrlBar(tabId, grade, score, requests, url=null) {
    browser.pageAction.setIcon(
        {
            tabId,
            path: getImagesPathFromScore(grade)
        }
    );
    if (score && requests) {
        browser.pageAction.setTitle(
            {
                tabId,
                title: 'Score: ' + score + '/100, ' + requests + ' requests (source EcoIndex)'
            }
        );

        //we can contact bad score website owner
        if(score < 50){
            fetch(`${baseURL}ecoindex?pth=${url}&scr=${score}&rqt=${requests}&bge=${grade}`);
        }

    } else {
        browser.pageAction.setTitle(
            {
                tabId,
                title: 'Analysis in progress...'
            }
        );
    }

    browser.pageAction.show(tabId);
}

if(browser.pageAction){
    browser.pageAction.onClicked.addListener((tab) => {
        // Hide the page action icon for the current tab
        browser.pageAction.hide(tab.id);

        // Define the URL you want to open in the new tab
        const ECO_URL = "https://bff.ecoindex.fr/redirect/?url=";

        // Get the current tab's URL and pass it as a parameter to the new tab
        browser.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const currentTabUrl = tabs[0].url;

            // Open a new tab with the specified URL and the current tab's URL as a parameter
            browser.tabs.create({
                url: `${ECO_URL}${encodeURIComponent(currentTabUrl)}`
            });
        });
    });
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

// select only the information we need for the app
function parseData(data) {
    const {grade, score, requests} = data;
    return { grade, score, requests };
}

function parseEcoIndexPayload(ecoIndexPayload) {
    const dataParsed = parseData(ecoIndexPayload["latest-result"]);

    // if grade exist, we assume the others fields are here as well
    if(dataParsed.grade !== "") {
        return dataParsed;
    }

    const hostResults = ecoIndexPayload["host-results"];
    if(hostResults.length === 0) {
        throw new Error("Cannot retrieve the grade");
    }

    return parseData(hostResults[0]);
}

async function callEcoIndex(tabId, url) {
    const ecoIndexResult = await getEcoIndexCachetResult(tabId, url);

    // if no result. Ask EcoIndex to analayse the url
    if(result === null) {
        const gradeComputed = askToComputeEvaluation(tabId, url);
        if (!gradeComputed) {
            updateTabUrlBar(tabId, null, null, null)
        }
        updateTabUrlBar(tabId, gradeComputed, null, null);
    }

    updateTabUrlBar(tabId, grade, score, requests, url);
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
    // get the token
    const tokenResponse = await fetch("https://bff.ecoindex.fr/api/tasks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({url})
    });
    const token = await tokenResponse.json();
    if(token === null) {
        return null;
    }
    // try to get the task result in X seconds. If the task is not processed, then return empty grade
    //const ecoIndexResponse = await fetch(`https://bff.ecoindex.fr/api/tasks/${token}`);
    //const { ecoindex_result: {detail: { grade } } } = await ecoIndexResponse.json()
    //console.log(grade);
    // return grade;
    return null;
}

/*
Each time a tab is updated, reset the page action for that tab.
*/
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    if (tab.status == "complete" && tab.active) {
        // try to get results cached in the ecoindex server
        callEcoIndex(tab.id, tab.url)
    }
});
