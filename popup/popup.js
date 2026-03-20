// SlopFilter — Popup Script

const SENS_MAP = ["low", "medium", "high"];
const SENS_LABELS = ["Low", "Medium", "High"];

const enableToggle = document.getElementById("enableToggle");
const modeButtons = document.querySelectorAll(".mode-btn");
const sensitivitySlider = document.getElementById("sensitivitySlider");
const sensValue = document.getElementById("sensValue");
const pageCount = document.getElementById("pageCount");

function loadSettings() {
  chrome.storage.sync.get("settings", (result) => {
    const s = result.settings;
    if (!s) return;

    enableToggle.checked = s.enabled;

    modeButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === s.mode);
    });

    const sensIndex = SENS_MAP.indexOf(s.sensitivity);
    sensitivitySlider.value = sensIndex >= 0 ? sensIndex : 1;
    sensValue.textContent = SENS_LABELS[sensitivitySlider.value];
  });
}

function saveAndNotify() {
  const mode = document.querySelector(".mode-btn.active").dataset.mode;
  const sensitivity = SENS_MAP[sensitivitySlider.value];
  const enabled = enableToggle.checked;

  chrome.storage.sync.get("settings", (result) => {
    const s = result.settings || {};
    s.enabled = enabled;
    s.mode = mode;
    s.sensitivity = sensitivity;

    chrome.storage.sync.set({ settings: s }, () => {
      // Notify active tab's content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "settingsUpdated",
            settings: s
          });
        }
      });
    });
  });
}

function updatePageCount() {
  chrome.runtime.sendMessage({ type: "getPageCount" }, (response) => {
    if (chrome.runtime.lastError) return;
    pageCount.textContent = (response && response.count) || 0;
  });
}

// Event listeners
enableToggle.addEventListener("change", saveAndNotify);

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    saveAndNotify();
  });
});

sensitivitySlider.addEventListener("input", () => {
  sensValue.textContent = SENS_LABELS[sensitivitySlider.value];
  saveAndNotify();
});

// Init
loadSettings();
updatePageCount();
