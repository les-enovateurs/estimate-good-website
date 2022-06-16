const CSS = "body { border: 20px solid red; }";
const TITLE_APPLY = "Apply CSS";
const TITLE_REMOVE = "Remove CSS";
const APPLICABLE_PROTOCOLS = ["http:", "https:"];

/*
Toggle CSS: based on the current title, insert or remove the CSS.
Update the page action's title and icon to reflect its state.
*/
// function toggleCSS(tab) {
//
//   function gotTitle(title) {
//     if (title === TITLE_APPLY) {
//
//
//       function draw(starty, startx) {
//         var canvas = document.createElement('canvas');
//         var context = canvas.getContext('2d');
//         var img = new Image();
//         img.src = "icon_16.png"
//         img.onload = function () {
//           context.drawImage(img,0,2);
//         }
//         //context.clearRect(0, 0, canvas.width, canvas.height);
//         context.fillStyle = "rgba(255,0,0,1)";
//         // context.fillRect(startx % 19, starty % 19, 10, 10);
//         context.fillStyle = "red";
//         context.font = "15px Arial";
//         context.fillText("30",0,15);
//         return context.getImageData(0, 0, 19, 19);
//       }
//
//       browser.pageAction.setIcon({tabId: tab.id, imageData: draw(10, 0)});
//       browser.pageAction.setTitle({tabId: tab.id, title: TITLE_REMOVE});
//       browser.tabs.insertCSS({code: CSS});
//     } else {
//       browser.pageAction.setIcon({tabId: tab.id, path: "icons/off.svg"});
//       browser.pageAction.setTitle({tabId: tab.id, title: TITLE_APPLY});
//       browser.tabs.removeCSS({code: CSS});
//     }
//   }
//
//   var gettingTitle = browser.pageAction.getTitle({tabId: tab.id});
//   gettingTitle.then(gotTitle);
// }

/*
Returns true only if the URL's protocol is in APPLICABLE_PROTOCOLS.
Argument url must be a valid URL string.
*/
function protocolIsApplicable(url) {
  const protocol = (new URL(url)).protocol;
  return APPLICABLE_PROTOCOLS.includes(protocol);
}

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

/*
Initialize the page action: set icon and title, then show.
Only operates on tabs whose URL's protocol is applicable.
*/
async function initializePageAction(tab, size=0) {
  if (protocolIsApplicable(tab.url)) {


    browser.pageAction.setIcon({tabId: tab.id, imageData: draw(size, 10, 0)});
    browser.pageAction.setTitle({tabId: tab.id, title: TITLE_REMOVE});
    browser.pageAction.show(tab.id);
  }
}

/*
When first loaded, initialize the page action for all tabs.
*/
var gettingAllTabs = browser.tabs.query({});
gettingAllTabs.then((tabs) => {
  for (let tab of tabs) {
    initializePageAction(tab);
  }
});


/*
Each time a tab is updated, reset the page action for that tab.
*/
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
  initializePageAction(tab);
});


/*
Toggle CSS when the page action is clicked.
*/
// browser.pageAction.onClicked.addListener(toggleCSS);
extractHostname = (url) => {
  let hostname = url.indexOf("//") > -1 ? url.split('/')[2] : url.split('/')[0];

  // find & remove port number
  hostname = hostname.split(':')[0];
  // find & remove "?"
  hostname = hostname.split('?')[0];

  return hostname;
};

setByteLengthPerOrigin = (origin, byteLength) => {
  const stats = localStorage.getItem('stats');
  const statsJson = null === stats ? {} : JSON.parse(stats);

  let bytePerOrigin = undefined === statsJson[origin] ? 0 : parseInt(statsJson[origin]);
  statsJson[origin] = bytePerOrigin + byteLength;

  initializePageAction(0, statsJson[origin]);
  console.log(statsJson[origin]);

  localStorage.setItem('stats', JSON.stringify(statsJson));


};

isChrome = () => {
  return (typeof(browser) === 'undefined');
};

headersReceivedListener = (requestDetails) => {
  if (isChrome()) {
    const origin = extractHostname(!requestDetails.initiator ? requestDetails.url : requestDetails.initiator);
    const responseHeadersContentLength = requestDetails.responseHeaders.find(element => element.name.toLowerCase() === "content-length");
    const contentLength = undefined === responseHeadersContentLength ? {value: 0}
        : responseHeadersContentLength;
    const requestSize = parseInt(contentLength.value, 10);
    setByteLengthPerOrigin(origin, requestSize);
    return {};
  }

  let filter = browser.webRequest.filterResponseData(requestDetails.requestId);

  filter.ondata = event => {
    const origin = extractHostname(!requestDetails.originUrl ? requestDetails.url : requestDetails.originUrl);
    setByteLengthPerOrigin(origin, event.data.byteLength);

    filter.write(event.data);
  };

  filter.onstop = () => {
    filter.disconnect();
  };

  return {};
};

addOneMinute = () => {
  let duration = localStorage.getItem('duration');
  duration = null === duration ? 1 : 1 * duration + 1;
  localStorage.setItem('duration', duration);
};

let addOneMinuteInterval;


handleMessage = (request, sender, sendResponse) => {
console.log('here');
    chrome.webRequest.onHeadersReceived.addListener(
        headersReceivedListener,
        {urls: ["<all_urls>"]},
        ["blocking", "responseHeaders"]
    );

    if (!addOneMinuteInterval) {
      addOneMinuteInterval = setInterval(addOneMinute, 60000);
    }


};

chrome.runtime.onMessage.addListener(handleMessage);
