// SlopFilter — Background Service Worker

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "dim",
  sensitivity: "medium",
  whitelist: [],
  stats: {
    totalBlocked: 0,
    pagesScanned: 0
  }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get("settings", (result) => {
    if (!result.settings) {
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getSettings") {
    chrome.storage.sync.get("settings", (result) => {
      sendResponse(result.settings || DEFAULT_SETTINGS);
    });
    return true;
  }

  if (message.type === "updateStats") {
    chrome.storage.sync.get("settings", (result) => {
      const settings = result.settings || DEFAULT_SETTINGS;
      settings.stats.totalBlocked += message.count;
      settings.stats.pagesScanned += 1;
      chrome.storage.sync.set({ settings });
    });
  }

  if (message.type === "getPageCount") {
    // Relay to content script in active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "getPageCount" }, (response) => {
          sendResponse(response || { count: 0 });
        });
      } else {
        sendResponse({ count: 0 });
      }
    });
    return true;
  }
});
