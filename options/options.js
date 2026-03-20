// SlopFilter — Options Page

const domainInput = document.getElementById("domainInput");
const addDomainBtn = document.getElementById("addDomain");
const whitelistItems = document.getElementById("whitelistItems");
const totalBlocked = document.getElementById("totalBlocked");
const pagesScanned = document.getElementById("pagesScanned");

function renderWhitelist(domains) {
  whitelistItems.innerHTML = "";
  if (!domains || domains.length === 0) {
    whitelistItems.innerHTML = '<span class="empty">No domains whitelisted</span>';
    return;
  }
  for (const domain of domains) {
    const tag = document.createElement("span");
    tag.className = "whitelist-tag";
    tag.innerHTML = `${domain} <span class="remove" data-domain="${domain}">&times;</span>`;
    whitelistItems.appendChild(tag);
  }

  // Attach remove listeners
  whitelistItems.querySelectorAll(".remove").forEach((el) => {
    el.addEventListener("click", () => {
      removeDomain(el.dataset.domain);
    });
  });
}

function loadSettings() {
  chrome.storage.sync.get("settings", (result) => {
    const s = result.settings || {};
    renderWhitelist(s.whitelist || []);
    totalBlocked.textContent = (s.stats && s.stats.totalBlocked) || 0;
    pagesScanned.textContent = (s.stats && s.stats.pagesScanned) || 0;
  });
}

function addDomain() {
  let domain = domainInput.value.trim().toLowerCase();
  if (!domain) return;
  // Strip protocol if pasted
  domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  chrome.storage.sync.get("settings", (result) => {
    const s = result.settings || {};
    if (!s.whitelist) s.whitelist = [];
    if (s.whitelist.includes(domain)) return;
    s.whitelist.push(domain);
    chrome.storage.sync.set({ settings: s }, () => {
      domainInput.value = "";
      renderWhitelist(s.whitelist);
    });
  });
}

function removeDomain(domain) {
  chrome.storage.sync.get("settings", (result) => {
    const s = result.settings || {};
    s.whitelist = (s.whitelist || []).filter((d) => d !== domain);
    chrome.storage.sync.set({ settings: s }, () => {
      renderWhitelist(s.whitelist);
    });
  });
}

addDomainBtn.addEventListener("click", addDomain);
domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomain();
});

loadSettings();
