const $ = (id) => document.getElementById(id);

const fields = [
  "numero",
  "cliente",
  "telefone",
  "envio",
  "dataPedido",
  "dataEnvio",
  "observacoes",
  "conferidoPor",
  "desconto"
];

const itemsBody = $("itemsBody");
const subtotalEl = $("subtotal");
const totalEl = $("total");
const statusEl = $("status");
let deferredPrompt = null;

window.addEventListener("DOMContentLoaded", () => {
  setDefaultDate();
  addRow();
  addRow();
  addRow();
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
    <td><input class="qty" type="number" min="0" step="1" value="${escapeAttr(data.quantidade ?? "")}" placeholder="0"></td>
    <td><input class="produto" type="text" value="${escapeAttr(data.produto ?? "")}" placeholder="Ex: Pijama americano"></td>
    <td><input class="tamanho" type="text" value="${escapeAttr(data.tamanho ?? "")}" placeholder="P, M, G..."></td>
    <td><input class="cor" type="text" value="${escapeAttr(data.cor ?? "")}" placeholder="Ex: Rosa"></td>
    <td><input class="vies" type="text" value="${escapeAttr(data.vies ?? "")}" placeholder="Ex: Branco"></td>
    <td><input class="unit money" type="number" min="0" step="0.01" value="${escapeAttr(data.valorUnit ?? "")}" placeholder="0,00"></td>
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
  if (!confirm("Limpar todos os itens do romaneio?")) return;
  itemsBody.innerHTML = "";
  addRow();
  calculateTotals();
}

function getFormData() {
  const data = {};
  fields.forEach((field) => {
    const el = $(field);
    if (el) data[field] = el.value;
  });

  data.items = Array.from(itemsBody.querySelectorAll("tr")).map((tr) => ({
    quantidade: tr.querySelector(".qty")?.value || "",
    produto: tr.querySelector(".produto")?.value || "",
    tamanho: tr.querySelector(".tamanho")?.value || "",
    cor: tr.querySelector(".cor")?.value || "",
    vies: tr.querySelector(".vies")?.value || "",
    valorUnit: tr.querySelector(".unit")?.value || ""
  }));

  data.subtotal = subtotalEl.textContent;
  data.total = totalEl.textContent;
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
  const data = getFormData();
  localStorage.setItem("romaneioPijamaDeRica", JSON.stringify(data));
  setStatus("Rascunho salvo neste navegador.");
}

function loadDraft() {
  const raw = localStorage.getItem("romaneioPijamaDeRica");
  if (!raw) {
    setStatus("Nenhum rascunho salvo encontrado.");
    return;
  }

  try {
    setFormData(JSON.parse(raw));
    setStatus("Rascunho carregado.");
  } catch {
    setStatus("Não consegui carregar o rascunho salvo.");
  }
}

function downloadRomaneio() {
  const data = getFormData();
  const cliente = cleanFileName(data.cliente || "cliente");
  const numero = cleanFileName(data.numero || "sem-numero");
  const fileName = `romaneio-${numero}-${cliente}.html`;

  const rows = data.items
    .filter((item) => item.quantidade || item.produto || item.tamanho || item.cor || item.valorUnit)
    .map((item) => {
      const qtd = Number(item.quantidade || 0);
      const unit = Number(item.valorUnit || 0);
      const total = qtd * unit;
      return `
        <tr>
          <td>${escapeHtml(item.quantidade)}</td>
          <td>${escapeHtml(item.produto)}</td>
          <td>${escapeHtml(item.tamanho)}</td>
          <td>${escapeHtml(item.cor)}</td>
          <td>${escapeHtml(item.vies)}</td>
          <td>${formatCurrency(unit)}</td>
          <td>${formatCurrency(total)}</td>
        </tr>`;
    }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Romaneio ${escapeHtml(data.numero || "")}</title>
<style>
body{font-family:Arial,sans-serif;margin:30px;color:#222}
.header{display:grid;grid-template-columns:180px 1fr 120px;align-items:center;border-bottom:2px solid #222;padding-bottom:12px}
.logo{max-width:160px;max-height:90px;object-fit:contain;object-position:left center}
h1{margin:0;text-transform:uppercase}
.info{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}
.box{border-bottom:1px solid #777;padding:6px 0}
label{display:block;font-size:11px;font-weight:bold;text-transform:uppercase}
table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{border:1px solid #333;padding:7px;text-align:left;font-size:12px}
.totals{margin-left:auto;margin-top:20px;width:260px}
.total-line{display:flex;justify-content:space-between;border:1px solid #333;padding:8px}
</style>
</head>
<body>
<div class="header">
<img class="logo" src="assets/logo.png" alt="Logo">
<div><h1>Romaneio Pijama de Rica</h1><p>Controle de pedido, separação e envio</p></div>
<div><label>Nº</label><strong>${escapeHtml(data.numero || "")}</strong></div>
</div>

<div class="info">
<div class="box"><label>Cliente</label>${escapeHtml(data.cliente || "")}</div>
<div class="box"><label>Telefone</label>${escapeHtml(data.telefone || "")}</div>
<div class="box"><label>Forma de envio</label>${escapeHtml(data.envio || "")}</div>
<div class="box"><label>Data do pedido</label>${escapeHtml(data.dataPedido || "")}</div>
<div class="box"><label>Data do envio</label>${escapeHtml(data.dataEnvio || "")}</div>
<div class="box"><label>Conferido por</label>${escapeHtml(data.conferidoPor || "")}</div>
<div class="box" style="grid-column:1/-1"><label>Observações</label>${escapeHtml(data.observacoes || "")}</div>
</div>

<table>
<thead>
<tr>
<th>Quantidade</th><th>Produto / Modelo</th><th>Tamanho</th><th>Cor / Estampa</th><th>Cor / Viés</th><th>Valor unit.</th><th>Valor total</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>

<div class="totals">
<div class="total-line"><span>Subtotal</span><strong>${escapeHtml(data.subtotal)}</strong></div>
<div class="total-line"><span>Desconto</span><strong>${formatCurrency(Number(data.desconto || 0))}</strong></div>
<div class="total-line"><span>Total</span><strong>${escapeHtml(data.total)}</strong></div>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  setStatus("Arquivo salvo. Para PDF, use o botão Imprimir / PDF.");
}

function calculateTotals() {
  let subtotal = 0;

  itemsBody.querySelectorAll("tr").forEach((tr) => {
    const qty = Number(tr.querySelector(".qty")?.value || 0);
    const unit = Number(tr.querySelector(".unit")?.value || 0);
    const rowTotal = qty * unit;
    subtotal += rowTotal;
    tr.querySelector(".row-total").textContent = formatCurrency(rowTotal);
  });

  const desconto = Number($("desconto").value || 0);
  const total = Math.max(0, subtotal - desconto);

  subtotalEl.textContent = formatCurrency(subtotal);
  totalEl.textContent = formatCurrency(total);
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function setStatus(message) {
  statusEl.textContent = message;
}

async function installApp() {
  if (!deferredPrompt) {
    setStatus("Se o botão de instalação não aparecer, use o menu do Chrome e escolha instalar app.");
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

function cleanFileName(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
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
