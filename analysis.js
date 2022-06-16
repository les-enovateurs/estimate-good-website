const APPLICABLE_PROTOCOLS = ["http:", "https:"];
const TITLE_REMOVE = "Remove CSS";


function draw(size, starty, startx) {
  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');
  var img = new Image();
  img.src = "icon_16.png"
  img.onload = function () {
    context.drawImage(img, 0, 2);
  }
  //context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255,0,0,1)";
  // context.fillRect(startx % 19, starty % 19, 10, 10);
  context.fillStyle = "red";
  context.font = "15px Arial";
  context.fillText(size.toString(), 0, 15);
  return context.getImageData(0, 0, 19, 19);
}

async function initializePageAction(tab) {
  console.log('hhh');
  if (protocolIsApplicable(tab.url)) {
    localStorage.setItem('da_'+tab.id, JSON.stringify({'req': 0, 'vald': 0}));
    updateTab(tab.id);
  }
}

function updateTab(tab_id){
  const stats = localStorage.getItem('da_'+tab_id);
  const statsJson = null === stats ? JSON.parse("{'req': 0, 'vald': 0}") : JSON.parse(stats);
  browser.pageAction.setIcon({tabId: tab_id, imageData: draw(statsJson.vald, 10, 0)});
  browser.pageAction.setTitle({tabId: tab_id, title: TITLE_REMOVE});
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

/*
When first loaded, initialize the page action for all tabs.
*/
// var gettingAllTabs = browser.tabs.query({});
// gettingAllTabs.then((tabs) => {
//   for (let tab of tabs) {
//     initializePageAction(tab);
//   }
// });

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
  // console.log('kkdsfds',requestDetails);
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
