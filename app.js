const $ = (id) => document.getElementById(id);

const fields = [
  "dataPedido",
  "dataEnvio",
  "cliente",
  "telefone",
  "pagamento",
  "envio",
  "observacoes",
  "desconto",
  "entrada"
];

const sizes = ["pp", "p", "m", "g", "gg"];
const itemsBody = $("itemsBody");
const subtotalEl = $("subtotal");
const valorTotalEl = $("valorTotal");
const restanteEl = $("restante");
const statusEl = $("status");
let deferredPrompt = null;

window.addEventListener("DOMContentLoaded", () => {
  setDefaultDate();
  for (let i = 0; i < 8; i++) addRow();
  bindEvents();
  registerServiceWorker();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  $("installBtn").classList.remove("hidden");
});

function bindEvents() {
  $("addRowBtn").addEventListener("click", () => addRow());
  $("clearRowsBtn").addEventListener("click", clearRows);
  $("printBtn").addEventListener("click", () => window.print());
  $("saveDraftBtn").addEventListener("click", saveDraft);
  $("loadDraftBtn").addEventListener("click", loadDraft);
  $("downloadBtn").addEventListener("click", downloadRomaneio);
  $("installBtn").addEventListener("click", installApp);

  fields.forEach((field) => {
    const el = $(field);
    if (el) el.addEventListener("input", calculateTotals);
  });
}

function setDefaultDate() {
  const today = new Date().toISOString().slice(0, 10);
  if (!$("dataPedido").value) $("dataPedido").value = today;
}

function addRow(data = {}) {
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td class="row-qtd">0</td>
    ${sizes.map((size) => `
      <td>
        <input class="size-input size-${size}" type="number" min="0" step="1" value="${escapeAttr(data[size] ?? "")}" placeholder="0" />
      </td>
    `).join("")}
    <td><input class="desc-input" type="text" value="${escapeAttr(data.descricao ?? "")}" placeholder="Descrição / modelo" /></td>
    <td><input class="cor-input" type="text" value="${escapeAttr(data.cor ?? "")}" placeholder="Cor / estampa" /></td>
    <td><input class="vies-input" type="text" value="${escapeAttr(data.vies ?? "")}" placeholder="Viés" /></td>
    <td><input class="unit-input" type="number" min="0" step="0.01" value="${escapeAttr(data.valorUnit ?? "")}" placeholder="0,00" /></td>
    <td class="row-total">R$ 0,00</td>
    <td class="no-print"><button class="remove-row" type="button">Remover</button></td>
  `;

  tr.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", calculateTotals);
  });

  tr.querySelector(".remove-row").addEventListener("click", () => {
    tr.remove();
    calculateTotals();
  });

  itemsBody.appendChild(tr);
  calculateTotals();
}

function clearRows() {
  if (!confirm("Limpar todas as linhas?")) return;
  itemsBody.innerHTML = "";
  addRow();
  calculateTotals();
}

function getRowQuantity(tr) {
  return sizes.reduce((sum, size) => {
    return sum + Number(tr.querySelector(`.size-${size}`)?.value || 0);
  }, 0);
}

function calculateTotals() {
  let subtotal = 0;

  itemsBody.querySelectorAll("tr").forEach((tr) => {
    const quantity = getRowQuantity(tr);
    const unit = Number(tr.querySelector(".unit-input")?.value || 0);
    const rowTotal = quantity * unit;

    tr.querySelector(".row-qtd").textContent = String(quantity);
    tr.querySelector(".row-total").textContent = formatCurrency(rowTotal);
    subtotal += rowTotal;
  });

  const desconto = Number($("desconto").value || 0);
  const entrada = Number($("entrada").value || 0);
  const valorTotal = Math.max(0, subtotal - desconto);
  const restante = Math.max(0, valorTotal - entrada);

  subtotalEl.textContent = formatCurrency(subtotal);
  valorTotalEl.textContent = formatCurrency(valorTotal);
  restanteEl.textContent = formatCurrency(restante);
}

function getFormData() {
  const data = {};

  fields.forEach((field) => {
    const el = $(field);
    if (el) data[field] = el.value;
  });

  data.items = Array.from(itemsBody.querySelectorAll("tr")).map((tr) => {
    const item = {
      descricao: tr.querySelector(".desc-input")?.value || "",
      cor: tr.querySelector(".cor-input")?.value || "",
      vies: tr.querySelector(".vies-input")?.value || "",
      valorUnit: tr.querySelector(".unit-input")?.value || ""
    };

    sizes.forEach((size) => {
      item[size] = tr.querySelector(`.size-${size}`)?.value || "";
    });

    return item;
  });

  data.subtotal = subtotalEl.textContent;
  data.valorTotal = valorTotalEl.textContent;
  data.restante = restanteEl.textContent;
  data.savedAt = new Date().toISOString();

  return data;
}

function setFormData(data) {
  fields.forEach((field) => {
    const el = $(field);
    if (el && data[field] !== undefined) el.value = data[field];
  });

  itemsBody.innerHTML = "";
  const items = Array.isArray(data.items) && data.items.length ? data.items : [{}];
  items.forEach((item) => addRow(item));
  calculateTotals();
}

function saveDraft() {
  localStorage.setItem("romaneioPijamaDeRicaRefeito", JSON.stringify(getFormData()));
  setStatus("Rascunho salvo neste navegador.");
}

function loadDraft() {
  const raw = localStorage.getItem("romaneioPijamaDeRicaRefeito");

  if (!raw) {
    setStatus("Nenhum rascunho salvo encontrado.");
    return;
  }

  try {
    setFormData(JSON.parse(raw));
    setStatus("Rascunho carregado.");
  } catch {
    setStatus("Não consegui carregar o rascunho.");
  }
}

function downloadRomaneio() {
  const data = getFormData();
  const cliente = cleanFileName(data.cliente || "cliente");
  const fileName = `romaneio-${cliente}.html`;
  const logo = window.PIJAMA_DE_RICA_LOGO || "assets/logo.png";

  const rows = data.items
    .filter((item) => sizes.some((s) => item[s]) || item.descricao || item.cor || item.vies || item.valorUnit)
    .map((item) => {
      const qtd = sizes.reduce((sum, s) => sum + Number(item[s] || 0), 0);
      const unit = Number(item.valorUnit || 0);
      const total = qtd * unit;

      return `
        <tr>
          <td>${qtd}</td>
          <td>${escapeHtml(item.pp || "")}</td>
          <td>${escapeHtml(item.p || "")}</td>
          <td>${escapeHtml(item.m || "")}</td>
          <td>${escapeHtml(item.g || "")}</td>
          <td>${escapeHtml(item.gg || "")}</td>
          <td>${escapeHtml(item.descricao || "")}</td>
          <td>${escapeHtml(item.cor || "")}</td>
          <td>${escapeHtml(item.vies || "")}</td>
          <td>${formatCurrency(unit)}</td>
          <td>${formatCurrency(total)}</td>
        </tr>`;
    }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Romaneio Pijama de Rica</title>
<style>
@page{size:A4 landscape;margin:7mm}
body{font-family:Arial,sans-serif;margin:0;color:#222}
.sheet{border:1px solid #000;padding:9px}
.header{display:grid;grid-template-columns:175px 1fr 205px;gap:10px;align-items:start;border-bottom:2px solid #000;padding-bottom:7px}
.logo{width:160px;max-height:72px;object-fit:contain;object-position:left top}
h1{text-align:center;text-transform:uppercase;margin:8px 0 0;font-size:22px}
label{display:block;font-size:8.5px;font-weight:900;text-transform:uppercase}
.field{border-bottom:1px solid #777;min-height:24px;font-size:10px}
.info{display:grid;grid-template-columns:1fr 1fr;gap:5px 26px;max-width:660px;padding:7px 0 8px;border-bottom:1px solid #000}
table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:8px}
th,td{border:1px solid #777;padding:3px;font-size:8px;text-align:center}
th{text-transform:uppercase;font-size:7.5px}
.footer{display:grid;grid-template-columns:1fr 245px;gap:20px;margin-top:10px;min-height:110px}
.totals{border:1px solid #000;align-self:end}
.line{display:flex;justify-content:space-between;border-bottom:1px solid #777;padding:5px 8px;font-size:9px}
.line:last-child{border-bottom:0;background:#fffaf2;font-weight:900}
</style>
</head>
<body>
<section class="sheet">
<header class="header">
<img class="logo" src="${logo}" alt="Pijama de Rica" />
<h1>Romaneio Pijama de Rica</h1>
<div>
<div class="field"><label>Data do pedido</label>${escapeHtml(data.dataPedido || "")}</div>
<div class="field"><label>Data do envio</label>${escapeHtml(data.dataEnvio || "")}</div>
</div>
</header>

<section class="info">
<div class="field"><label>Cliente</label>${escapeHtml(data.cliente || "")}</div>
<div class="field"><label>Telefone</label>${escapeHtml(data.telefone || "")}</div>
<div class="field"><label>Forma de pagamento</label>${escapeHtml(data.pagamento || "")}</div>
<div class="field"><label>Forma de envio</label>${escapeHtml(data.envio || "")}</div>
</section>

<table>
<thead>
<tr>
<th>Qtd</th><th>PP</th><th>P</th><th>M</th><th>G</th><th>GG</th><th>Descrição / Modelo</th><th>Cor / Estampa</th><th>Viés</th><th>Valor unit.</th><th>Valor total</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>

<section class="footer">
<div><label>Observações</label><div class="field">${escapeHtml(data.observacoes || "")}</div></div>
<div class="totals">
<div class="line"><span>Subtotal</span><strong>${escapeHtml(data.subtotal)}</strong></div>
<div class="line"><span>Desconto</span><strong>${formatCurrency(Number(data.desconto || 0))}</strong></div>
<div class="line"><span>Entrada</span><strong>${formatCurrency(Number(data.entrada || 0))}</strong></div>
<div class="line"><span>Valor total</span><strong>${escapeHtml(data.valorTotal)}</strong></div>
<div class="line"><span>Restante</span><strong>${escapeHtml(data.restante)}</strong></div>
</div>
</section>
</section>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  setStatus("Arquivo salvo.");
}

async function installApp() {
  if (!deferredPrompt) {
    setStatus("Se o botão não aparecer, use o menu do Chrome e escolha instalar app.");
    return;
  }

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("installBtn").classList.add("hidden");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function cleanFileName(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function setStatus(message) {
  statusEl.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
