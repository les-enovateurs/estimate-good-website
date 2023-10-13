const APPLICABLE_PROTOCOLS = ["http:", "https:"];
const TITLE_REMOVE = "Estimate good website";



function updateTabUrlBar(tabId, grade){
  browser.pageAction.setIcon(
    {
      tabId,
      path: getImagesPathFromScore(grade)
    }
  );
  browser.pageAction.show(tabId);
}

function getImagesPathFromScore(score) {
  const DIRECTORY_PATH = "icons";
   if(!score) {
      return {
          16: `${DIRECTORY_PATH}/loading-16.jpg`,
          32: `${DIRECTORY_PATH}/loading-32.jpg`,
      };

   }
   console.log(score)

  return {
    16: `${DIRECTORY_PATH}/bad-16.jpg`,
    32: `${DIRECTORY_PATH}/bad-32.jpg`,
  };
}

async function callEcoIndex(tabId, url) {
  const grade = await getCachedResult(tabId, url);
  if(!grade) {
    const gradeComputed = askToComputeEvaluation(tabId, url);
    if(!gradeComputed) {
      updateTabUrlBar(tabId, null)
    }
    updateTabUrlBar(tabId, gradeComputed);
  }
  updateTabUrlBar(tabId, grade);
}

async function getCachedResult(tabId, url) {
  const ecoIndexResponse = await fetch(`https://bff.ecoindex.fr/api/results/?url=${url}`);
  if(ecoIndexResponse.ok) {
    const ecoIndexResponseObject = await ecoIndexResponse.json();
    const { grade } = ecoIndexResponseObject["latest-result"];
    if(grade === "") {
      const hostResults = ecoIndexResponseObject["host-results"];
      if(hostResults.length > 0) {
        const { grade } = hostResults[0];
        console.log(`depuis l'origin c'est ${grade}`);
        return grade;
      } else {
        throw new Error("Cannot retrieve the grade");
      }
    } else {
      console.log(grade)
      return grade;
    }
  } else {
    console.log("this is not ok man")
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
    body: JSON.stringify({ url })
  });
  const token = await tokenResponse.json();
  // try to get the task result in X seconds. If the task is not processed, then return empty grade
  //const ecoIndexResponse = await fetch(`https://bff.ecoindex.fr/api/tasks/${token}`);
  //const { ecoindex_result: {detail: { grade } } } = await ecoIndexResponse.json()
  //console.log(grade);
  return grade;
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
