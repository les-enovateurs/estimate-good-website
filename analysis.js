const APPLICABLE_PROTOCOLS = ["http:", "https:"];
const TITLE_REMOVE = "Estimate good website";

async function initializePageAction(tab) {
  if (protocolIsApplicable(tab.url)) {
    localStorage.setItem('da_'+tab.id, JSON.stringify({'req': 0, 'vald': 0}));
    updateTab(tab.id);
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
  console.log(bytes)
  if (i === 0)  {
    return `${bytes} ${sizes[i]}`;
  }

  return `${(bytes / (1024 ** i)).toFixed(1)} ${sizes[i]}`;
}

function updateTab(tabId){
  console.log("tabId ", tabId);
  const stats = localStorage.getItem('da_'+tabId);
  const statsJson = null === stats ? JSON.parse("{'req': 0, 'vald': 0}") : JSON.parse(stats);

  browser.pageAction.setIcon(
    {  tabId,
      path: getImagesPathFromScore(statsJson.vald)
    }
  );
  
  browser.pageAction.setTitle(
    {
      tabId,
      title: `${statsJson.req} requête(s) envoyées pour ${bytesToSize(statsJson.vald)}`
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

setByteLengthPerOrigin = (tab_id, byteLength) => {
  const stats = localStorage.getItem('da_'+tab_id);
  const statsJson = null === stats ? JSON.parse("{'req': 0, 'vald': 0}") : JSON.parse(stats);
  let req = null === statsJson.req || undefined === statsJson.req ? 1 : parseInt(statsJson.req) + 1;
  let vald = undefined === statsJson.vald ? byteLength : parseInt(statsJson.vald) + byteLength;
  statsJson.req = req;
  statsJson.vald = vald;
  localStorage.setItem('da_'+tab_id, JSON.stringify(statsJson));
  updateTab(tab_id);
};

function contentSize(element){
  return element.name === 'content-length'
}

headersReceivedListener = (requestDetails) => {
  content = requestDetails.responseHeaders.find(contentSize);
  if(content) {
    setByteLengthPerOrigin(requestDetails.tabId, content.value);
  }
  else {
    setByteLengthPerOrigin(requestDetails.tabId, 1);
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
