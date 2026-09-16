const cidrForm = document.getElementById("cidr-form");
const ipInput = document.getElementById("ip");
const prefixInput = document.getElementById("prefix");
const cidrResults = document.getElementById("cidr-results");
const cidrError = document.getElementById("cidr-error");

const vlsmForm = document.getElementById("vlsm-form");
const baseCidrInput = document.getElementById("base-cidr");
const requirementsEl = document.getElementById("requirements");
const vlsmError = document.getElementById("vlsm-error");
const vlsmSummary = document.getElementById("vlsm-summary");
const vlsmTable = document.getElementById("vlsm-table");

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function clearError(el) {
  el.textContent = "";
  el.hidden = true;
}

async function request(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function renderResults(data) {
  const rows = [
    ["CIDR notation", data.input.cidr],
    ["Network address", data.networkAddress],
    ["Broadcast address", data.broadcastAddress],
    ["Usable host range", data.usableHostRange],
    ["Usable hosts", data.usableHosts],
    ["Total addresses", data.totalAddresses],
    ["Netmask", data.netmask],
    ["Wildcard mask", data.wildcardMask],
    ["IP class", data.ipClass],
    ["Private range", data.isPrivate ? "Yes" : "No"],
  ];
  cidrResults.innerHTML = "";
  for (const [label, value] of rows) {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    wrap.append(dt, dd);
    cidrResults.append(wrap);
  }
}

async function calculate() {
  clearError(cidrError);
  try {
    const ip = encodeURIComponent(ipInput.value.trim());
    const prefix = encodeURIComponent(prefixInput.value);
    const data = await request(`/api/calculate?ip=${ip}&prefix=${prefix}`);
    renderResults(data);
  } catch (err) {
    cidrResults.innerHTML = "";
    showError(cidrError, err.message);
  }
}

cidrForm.addEventListener("submit", (e) => {
  e.preventDefault();
  calculate();
});

function addRequirement(name = "", hosts = "") {
  const row = document.createElement("div");
  row.className = "req-row";
  row.innerHTML = `
    <input class="req-name" type="text" placeholder="e.g. Sales VLAN" value="${name}" />
    <input class="req-hosts" type="number" min="1" placeholder="e.g. 50" value="${hosts}" />
    <button type="button" class="remove" title="Remove">&#10005;</button>
  `;
  row.querySelector(".remove").addEventListener("click", () => row.remove());
  requirementsEl.append(row);
}

document.getElementById("add-req").addEventListener("click", () => addRequirement());

function renderVlsm(data) {
  vlsmSummary.hidden = false;
  vlsmSummary.innerHTML = `
    <span>Base: <b>${data.baseCidr}</b></span>
    <span>Allocated: <b>${data.allocatedAddresses}</b></span>
    <span>Free: <b>${data.freeAddresses}</b></span>
    <span>Utilization: <b>${data.utilization}</b></span>
  `;

  const tbody = vlsmTable.querySelector("tbody");
  tbody.innerHTML = "";
  for (const a of data.allocations) {
    const tr = document.createElement("tr");
    for (const value of [a.name, a.cidr, a.netmask, a.usableHostRange, a.usableHosts, a.requestedHosts]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    tbody.append(tr);
  }
  vlsmTable.hidden = false;
}

async function generateVlsm() {
  clearError(vlsmError);
  vlsmTable.hidden = true;
  vlsmSummary.hidden = true;

  const requirements = [...requirementsEl.querySelectorAll(".req-row")]
    .map((row, index) => ({
      name: row.querySelector(".req-name").value.trim() || `Subnet ${index + 1}`,
      hosts: row.querySelector(".req-hosts").value,
    }))
    .filter((r) => r.hosts !== "" && Number(r.hosts) > 0);

  if (requirements.length === 0) {
    showError(vlsmError, "Add at least one subnet with a host requirement.");
    return;
  }

  try {
    const data = await request("/api/vlsm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseCidr: baseCidrInput.value.trim(), requirements }),
    });
    renderVlsm(data);
  } catch (err) {
    showError(vlsmError, err.message);
  }
}

vlsmForm.addEventListener("submit", (e) => {
  e.preventDefault();
  generateVlsm();
});

addRequirement("Sales", 50);
addRequirement("Engineering", 20);
addRequirement("WAN link", 2);

calculate();
