browser.tabs.query({currentWindow: true, active: true})
    .then((tabs) => {
        const url = tabs[0].url;

        const ecoIndexAnchor = document.getElementById("ecoindex-result")
        if(!ecoIndexAnchor) {
            return;
        }

        localStorageData = localStorage.getItem(url);
        if(!localStorage) {
            return;
        }

        const parsedData = JSON.parse(localStorageData);
        const { id } = parsedData;

        ecoIndexAnchor.href = `https://www.ecoindex.fr/resultat/?id=${id}`;
  })