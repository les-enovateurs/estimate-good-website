const APPLICABLE_PROTOCOLS = ["http:", "https:"];
const TITLE_REMOVE = "Estimate good website";

console.log("fdhfjdhfhdjfhhdfh")

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

function updateTab(tab_id){
  console.log("tabId ", tab_id);
  const stats = localStorage.getItem('da_'+tab_id);
  const statsJson = null === stats ? JSON.parse("{'req': 0, 'vald': 0}") : JSON.parse(stats);

  browser.pageAction.setIcon({tabId: tab_id, path: getImagesPathFromScore(statsJson.vald)});
  browser.pageAction.setTitle({tabId: tab_id, title: (statsJson.req + 'requête(s) envoyées pour ' + statsJson.vald + ' bytes')});
  browser.pageAction.show(tab_id);
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
  if(content){
    setByteLengthPerOrigin(requestDetails.tabId, content.value);
  }
  else
    setByteLengthPerOrigin(requestDetails.tabId, 1);

//   let filters= browser.webRequest.filterResponseData(requestDetails.requestId);
//
// // console.log('kddk',filters);
//   filters.ondata = event => {
//     // console.log('rqsdqr',requestDetails.tabId);
//
//     // const origin = extractHostname(!requestDetails.originUrl ? requestDetails.url : requestDetails.originUrl);
//     // setByteLengthPerOrigin(requestDetails.tabId, origin, event.data.byteLength);
//     setByteLengthPerOrigin(requestDetails.tabId, event.data.byteLength);
// // console.log('rr',requestDetails.tabId);
//     filters.write(event.data);
//     filters.disconnect();
//   };

  return {};
}

console.log(browser);
/*
Each time a tab is updated, reset the page action for that tab.
*/
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
  console.log("onUpdated");
  initializePageAction(tab);
});


browser.webRequest.onCompleted.addListener(
    headersReceivedListener,
    {urls: ['<all_urls>']},
    ['responseHeaders']
);
