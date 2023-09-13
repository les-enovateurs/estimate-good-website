const APPLICABLE_PROTOCOLS = ["http:", "https:"];
const TITLE_REMOVE = "Estimate good website";
const PREFIX_LOCALSTORAGE_KEY = "estimate_good_website";

async function initializePageAction(tab) {
  if (protocolIsApplicable(tab.url)) {
    updateTab(tab.id, tab.url);
  }
}

function getImagesPathFromScore(score) {
  const DIRECTORY_PATH = "icons";
  if(score > 5000) {
    return {
      16: `${DIRECTORY_PATH}/bad-16.jpg`,
      32: `${DIRECTORY_PATH}/bad-32.jpg`,
    }
  } else if(score > 10000) {
    return {
      16: `${DIRECTORY_PATH}/bad-16.jpg`,
      32: `${DIRECTORY_PATH}/bad-32.jpg`,
    }    
  }

  return {
    16: `${DIRECTORY_PATH}/good-16.jpg`,
    32: `${DIRECTORY_PATH}/good-32.jpg`,
  }
}

function bytesToSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) {
    return 'n/a';
  }

  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
  if (i === 0)  {
    return `${bytes} ${sizes[i]}`;
  }

  return `${(bytes / (1024 ** i)).toFixed(1)} ${sizes[i]}`;
}

function fetchDataFromTheWebsite() {
  //TODO: query greenIT
  const fakeNumberOfQueries = 1;
  const fakeBytes = parseInt((Math.random() * 10000));
  return { numberOfQueries: fakeNumberOfQueries, bytes: fakeBytes };
}

function localeStoragKey(url) {
  return `${PREFIX_LOCALSTORAGE_KEY}@${url}`;
}

function getDataFromLocalStorage(url) {
  const statsInJson = localStorage.getItem(localeStoragKey(url));
  if(!statsInJson) {
    return null;
  }
  return JSON.parse(statsInJson);
}

function getData(url) {
  const stats = getDataFromLocalStorage(url);
  if(!stats) {
    return fetchDataFromTheWebsite();
  } else {
    return stats;
  }
}

function updateTab(tabId, url){
  const stats = getData(url);

  browser.pageAction.setIcon(
    {  tabId,
      path: getImagesPathFromScore(stats.bytes)
    }
  );
  
  browser.pageAction.setTitle(
    {
      tabId,
      title: `${stats.numberOfQueries} requête(s) envoyées pour ${bytesToSize(stats.bytes)}`
    }
  );

  browser.pageAction.show(tabId);
}

/*
Returns true only if the URL's protocol is in APPLICABLE_PROTOCOLS.
Argument url must be a valid URL string.
*/
function protocolIsApplicable(url) {
  const protocol = (new URL(url)).protocol;
  return APPLICABLE_PROTOCOLS.includes(protocol);
}

extractHostname = (url) => {
  let hostname = url.indexOf("//") > -1 ? url.split('/')[2] : url.split('/')[0];

  // find & remove port number
  hostname = hostname.split(':')[0];
  // find & remove "?"
  hostname = hostname.split('?')[0];

  return hostname;
};

setByteLengthPerOrigin = (tabId, originUrl, byteLength) => {
  const stats = getData(originUrl);
  const numberOfQueries = parseInt(stats.numberOfQueries) + 1;
  const bytes = parseInt(stats.bytes) + parseInt(byteLength);
  const newLocaleStorageValues = { numberOfQueries, bytes };
  
  localStorage.setItem(localeStoragKey(originUrl), JSON.stringify(newLocaleStorageValues));
  updateTab(tabId, originUrl);
};

function contentSize(element){
  return element.name === 'content-length'
}

headersReceivedListener = (requestDetails) => {
  content = requestDetails.responseHeaders.find(contentSize);
  if(content) {
    setByteLengthPerOrigin(requestDetails.tabId, requestDetails.originUrl, content.value);
  }
  else {
    setByteLengthPerOrigin(requestDetails.tabId, requestDetails.originUrl, 1);
  }
  return {};
}

/*
Each time a tab is updated, reset the page action for that tab.
*/
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
  initializePageAction(tab);
});

browser.webRequest.onCompleted.addListener(
    headersReceivedListener,
    {urls: ['<all_urls>']},
    ['responseHeaders']
);
