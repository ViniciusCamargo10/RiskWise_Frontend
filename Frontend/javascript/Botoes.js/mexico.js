const API = `${window.location.origin}/mexico`;

let state = {
  meta: { bw: 70, adi_interno: 0.05 },
  rows: [],
  totals: {}
};

function salvarMexicoNoLocalStorage() {
  localStorage.setItem("RW_MEXICO_DATA", JSON.stringify(state.rows));
  localStorage.setItem("RW_MEXICO_META", JSON.stringify(state.meta));
  localStorage.setItem("RW_MEXICO_TOTALS", JSON.stringify(state.totals));
  // Salva também os campos individuais para a tabela de resultados
  localStorage.setItem("RW_MEXICO_BW", state.meta.bw ?? "-");
  localStorage.setItem("RW_MEXICO_SUM", state.totals.sumLC ?? "-");

  // ✅ ADI: se vazio, remove do storage; se preenchido, grava como string
  const adi = state.meta.adi_interno;
  if (adi === null || adi === undefined || String(adi).trim() === "") {
    localStorage.removeItem("RW_MEXICO_ADI");
  } else {
    localStorage.setItem("RW_MEXICO_ADI", String(adi));
  }

  localStorage.setItem("RW_MEXICO_IDMT", state.totals.idmt ?? "-");
  localStorage.setItem("RW_MEXICO_PERCENT_ADI", state.totals["%ADI_interno"] ?? "-");
}

/* =========================================================
 * Normalização vindos do servidor (aceita vírgula do Excel)
 * ========================================================= */
function normalizeFromServer(s) {
  s = String(s ?? "").trim();
  if (s === "") return s;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Assume o último separador como decimal
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";

    s = s.split(thousandSep).join(""); // remove milhares
    s = s.replace(decimalSep, ".");    // decimal vira ponto
  } else if (hasComma) {
    s = s.replace(/\./g, ""); // remove milhares
    s = s.replace(/,/g, "."); // decimal vírgula -> ponto
  } else if (hasDot) {
    // se vier com múltiplos pontos, mantém o último como decimal
    const dots = (s.match(/\./g) || []).length;
    if (dots > 1) {
      const parts = s.split(".");
      const last = parts.pop();
      s = parts.join("") + "." + last;
    }
  }
  return s;
}

function toNumOrNull(v) {
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (s === "") return null;
  s = normalizeFromServer(s); // aceita vírgula vindos do Excel
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ===========================================
 * Funções de formatação (exibição estilo Excel)
 * =========================================== */
// Notação científica com 2 casas significativas e vírgula
function fmtSci2(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  // ex.: 7E-05 -> "7,00e-5" (mantém 'e' minúsculo padrão JS; se quiser 'E', troque o 'e' por 'E')
  return Number(n).toExponential(2).replace('.', ',');
}

// 4 casas decimais, vírgula
function fmt4(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return Number(n).toFixed(4).replace('.', ',');
}

// 5 casas decimais, vírgula
function fmt5(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return Number(n).toFixed(5).replace('.', ',');
}

// 6 casas decimais, vírgula
function fmt6(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return Number(n).toFixed(6).replace('.', ',');
}

// ✅ Helper: aplica tooltip e aria-label para inputs/células numéricos
function applyNumericTooltip(el, label = "Accepts integers and decimals with dots (.)") {
  if (!el) return;
  el.title = label;
  el.setAttribute("aria-label", label);
}

/* =================================================
 * Inputs do usuário: dígitos e ponto (vírgula BLOQUEADA)
 * ================================================= */
function wireDecimalOnly(input) {
  let prev = input.value ?? "";

  input.addEventListener("beforeinput", (e) => {
    if (
      e.inputType === "deleteContentBackward" ||
      e.inputType === "deleteContentForward" ||
      e.inputType === "deleteByCut" ||
      e.inputType === "insertFromPaste"
    ) return;

    const ch = e.data;
    if (typeof ch !== "string") return;

    // Só dígitos e ponto; vírgula é bloqueada
    if (!/[\d.]/.test(ch)) {
      e.preventDefault();
      return;
    }

    // Evita segundo ponto fora da seleção
    if (ch === ".") {
      const selStart = input.selectionStart ?? 0;
      const selEnd = input.selectionEnd ?? 0;
      const selection = input.value.slice(selStart, selEnd);
      const jaTemPontoForaDaSelecao = input.value.includes(".") && !selection.includes(".");
      if (jaTemPontoForaDaSelecao) {
        e.preventDefault();
        return;
      }
    }
  });

  input.addEventListener("paste", (e) => {
    const clip = (e.clipboardData || window.clipboardData).getData("text") ?? "";

    // ✅ Se for matriz (tem TAB ou QUEBRA DE LINHA), deixa o handler global tratar
    if (/\t|\r?\n/.test(clip)) {
      return; // não chama preventDefault aqui
    }

    // ✅ Colagem simples (uma célula): sanitiza aqui mesmo
    e.preventDefault();

    // Converter vírgula -> ponto; remover separador de milhar (.)
    let sanitized = clip.trim();
    if (sanitized.includes(",")) {
      sanitized = sanitized.replace(/\./g, "").replace(/,/g, ".");
    }

    // Mantém apenas [0-9 .], e só um ponto
    sanitized = sanitized.replace(/[^0-9.]/g, "");
    let dotSeen = false;
    let final = "";
    for (const c of sanitized) {
      if (c === ".") {
        if (dotSeen) continue;
        dotSeen = true;
      }
      final += c;
    }
    if (final.startsWith(".")) final = "0" + final;

    // Aplica respeitando a seleção
    const selStart = input.selectionStart ?? 0;
    const selEnd = input.selectionEnd ?? 0;
    const nextValue = input.value.slice(0, selStart) + final + input.value.slice(selEnd);

    input.value = nextValue;
    prev = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  input.addEventListener("input", () => {
    const regexParcial = /^\d*\.?\d*$/;
    if (!regexParcial.test(input.value)) {
      input.value = prev;
      const caret = input.value.length;
      try { input.setSelectionRange(caret, caret); } catch {}
      input.style.borderColor = "#e53935";
      return;
    }

    if (input.value.startsWith(".")) input.value = "0" + input.value;

    // Garante no máximo um ponto (mantém o primeiro)
    const firstDot = input.value.indexOf(".");
    if (firstDot !== -1) {
      input.value = input.value.slice(0, firstDot + 1) + input.value.slice(firstDot + 1).replace(/\./g, "");
    }

    prev = input.value;
    input.style.borderColor = "#ccc";
  });
}

function isPositive(x) {
  return Number.isFinite(x) && x > 0;
}

/* ==========================================
 * Cálculo por linha e totais (sem arredondar)
 * ========================================== */
function calcRowAndPaint(i) {
  const row = state.rows[i];
  let lmr = toNumOrNull(row["LMR (mg/kg)"]);
  let r   = toNumOrNull(row["R (mg/kg)"]);
  let c   = toNumOrNull(row["C (Kg/person/day)"]);

  const limite = isPositive(r) ? r : (isPositive(lmr) ? lmr : null);
  const val = (limite !== null && c !== null) ? limite * c : null;

  // Guarda valor exato (sem arredondar)
  row["(LMR or R)*C"] = (val !== null) ? val : "";

  // Exibição com 6 casas (Excel)
  const cell = document.querySelector(`tr[data-idx="${i}"] td.col-lc`);
  if (cell) cell.textContent = (val !== null) ? fmt6(val) : "-";
}

function calcularTudo() {
  // Recalcula por linha (mantém exatos; exibe formatado)
  for (let i = 0; i < state.rows.length; i++) {
    calcRowAndPaint(i);
  }

  // Soma exata (sem arredondar)
  let sumLC = 0;
  state.rows.forEach(r => {
    const v = toNumOrNull(r["(LMR or R)*C"]);
    if (v !== null) sumLC += v;
  });

  const bw  = toNumOrNull(state.meta.bw);
  const adi = toNumOrNull(state.meta.adi_interno);

  let idmt = null;
  if (bw !== null && bw > 0) idmt = sumLC / bw;

  let percent = null;
  if (adi !== null && adi > 0 && idmt !== null) {
    percent = (idmt / adi) * 100;
  }

  state.totals = {
    sumLC,              // soma exata
    idmt,               // exato
    "%ADI_interno": percent // exato
  };

  // Exibição formatada no "RESULTS OUTPUT"
  const outIdmt = document.querySelector("#outIdmt");
  const outPercentAdi = document.querySelector("#outPercentAdi");
  if (outIdmt)        outIdmt.textContent        = (idmt !== null)    ? fmtSci2(idmt) : "-"; // IDMT: científica (2 sig)
  if (outPercentAdi)  outPercentAdi.textContent  = (percent !== null) ? fmt4(percent) : "-"; // %ADI: 4 casas

  // (Opcional) Se você criar um elemento #outSum, exibirá igual ao Excel (5 casas)
  const outSum = document.querySelector("#outSum");
  if (outSum) outSum.textContent = fmt5(sumLC);

  salvarMexicoNoLocalStorage();
}

/* =========================
 * Carregar dados da API
 * ========================= */
async function loadData() {
  // 1. Tenta carregar do localStorage primeiro
  const savedRows = JSON.parse(localStorage.getItem("RW_MEXICO_DATA") || "[]");
  const savedMeta = JSON.parse(localStorage.getItem("RW_MEXICO_META") || "null");
  const savedTotals = JSON.parse(localStorage.getItem("RW_MEXICO_TOTALS") || "null");

  if (savedRows.length > 0 && savedMeta && savedTotals) {
    state.rows = savedRows;
    state.meta = savedMeta;
    state.totals = savedTotals;
    render(true);
    return; // Não busca da API, pois já tem dados do usuário
  }

  // 2. Se não houver dados salvos, busca da API normalmente
  try {
    const res = await fetch(`${API}/dados`);
    if (!res.ok) throw new Error("Erro ao buscar dados");
    const data = await res.json();

    state.meta = data.meta;
    state.rows = (data.rows ?? []).map(row => {
      return {
        ...row,
        "C (Kg/person/day)": toNumOrNull(normalizeFromServer(row["C (Kg/person/day)"])),
        "LMR (mg/kg)": toNumOrNull(normalizeFromServer(row["LMR (mg/kg)"])),
        "R (mg/kg)": toNumOrNull(normalizeFromServer(row["R (mg/kg)"]))
      };
    });
    state.totals = data.totals ?? {};

    render(true);
  } catch (err) {
    console.error("Falha ao carregar dados:", err);
    const tbody = document.querySelector("#tbodyMexico");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="no-data">Erro ao carregar dados</td></tr>`;
    }
  }
}

/* =========================
 * Renderização
 * ========================= */
function render(firstPaint = false) {
  const outBw = document.querySelector("#outBw");
  const outAdi = document.querySelector("#outAdi");

  if (outBw) outBw.textContent = state.meta.bw ?? "-";

  if (outAdi) {
    const inpAdi = document.createElement("input");
    inpAdi.type = "text";
    // Mostra valor "cru" (sem força de casas), mas bloqueia vírgula no input
    inpAdi.value = state.meta.adi_interno ?? "";
    inpAdi.className = "editable-cell";
    inpAdi.style.width = "80px";
    wireDecimalOnly(inpAdi);

    // ✅ Tooltip no botão/field de ADI
    applyNumericTooltip(inpAdi, " Accepts integers and decimals with dots (.)");

    inpAdi.addEventListener("input", (e) => {
      let val = inpAdi.value;

      // Se o usuário está apagando, apenas propaga
      if (e.inputType === "deleteContentBackward") {
        state.meta.adi_interno = val;
        calcularTudo();
        return;
      }

      // Se começar com "0" e não tiver ponto, mantém 0
      if (val === "0") {
        state.meta.adi_interno = val;
        calcularTudo();
        return;
      }

      // Se começa com "0" e próximo não é ponto, insere ponto automaticamente
      if (val.length === 2 && val.startsWith("0") && val[1] !== ".") {
        val = "0." + val[1];
      }

      // Remove pontos extras (mantém apenas o primeiro)
      const parts = val.split(".");
      if (parts.length > 2) {
        val = parts[0] + "." + parts.slice(1).join("").replace(/\./g, "");
      }

      inpAdi.value = val;
      state.meta.adi_interno = val;
      calcularTudo();
      salvarMexicoNoLocalStorage();
    });

    // (Opcional) se quiser formatar ADI em exibição com X casas, basta trocar aqui
    outAdi.innerHTML = "";
    outAdi.appendChild(inpAdi);
  }

  const tbody = document.querySelector("#tbodyMexico");
  if (!tbody) return;

  if (firstPaint) {
    tbody.innerHTML = "";

    if (!state.rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="no-data">Nenhum dado disponível</td></tr>`;
    } else {
      state.rows.forEach((row, i) => {
        const tr = document.createElement("tr");
        tr.dataset.idx = String(i);

        const cols = [
          "Crop",
          "Cultivo",
          "LMR (mg/kg)",
          "R (mg/kg)",
          "C (Kg/person/day)",
          "(LMR or R)*C"
        ];

        cols.forEach((col) => {
          const td = document.createElement("td");
          td.dataset.col = col; // ✅ marca o nome da coluna no TD

          if (["LMR (mg/kg)", "R (mg/kg)"].includes(col)) {
            // ✅ Tooltip na célula
            applyNumericTooltip(td, `Accepts integers and decimals with dots (.)`);

            const inp = document.createElement("input");
            inp.type = "text";
            inp.value = (row[col] ?? "") === "" ? "" : String(row[col]);
            inp.className = "editable-cell";
            inp.style.width = "100%";
            inp.dataset.col = col; // ✅ marca também no INPUT
            wireDecimalOnly(inp);

            // ✅ Tooltip também no input
            applyNumericTooltip(inp, `Accepts integers and decimals with dots (.)`);

            inp.addEventListener("input", () => {
              row[col] = inp.value;   // mantém string para o usuário
              calcRowAndPaint(i);     // calcula com toNumOrNull internamente
              calcularTudo();
              salvarMexicoNoLocalStorage();
            });

            inp.addEventListener("blur", () => {
              const n = toNumOrNull(inp.value);
              // Normaliza string exibida no input (sem vírgula, sem múltiplos pontos)
              inp.value = (n !== null) ? String(n) : "";
              row[col] = inp.value;
            });

            td.appendChild(inp);
          } else if (col === "C (Kg/person/day)") {
            // Exibe como no Excel: 5 casas decimais
            const v = toNumOrNull(row[col]);
            td.textContent = (v !== null) ? fmt5(v) : "-";
          } else if (col === "Cultivo") {
            const valor = row[col] ?? "-";
            td.innerHTML = String(valor).replace(/(\d+)$/, "<sup>$1</sup>");
          } else if (col === "(LMR or R)*C") {
            td.classList.add("col-lc");
            // Exibe como no Excel: 6 casas decimais
            const v = toNumOrNull(row[col]);
            td.textContent = (v !== null) ? fmt6(v) : "-";
          } else {
            td.textContent = row[col] ?? "-";
          }

          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    }
  }

  calcularTudo();
}

/* =========================
 * Colagem tipo Excel (matriz)
 * ========================= */
(function enableExcelPasteMexico() {
  const PASTE_COLUMNS = ["LMR (mg/kg)", "R (mg/kg)"];

  // Fallback para CSS.escape em navegadores antigos
  const cssEscape = (s) =>
    (window.CSS && typeof window.CSS.escape === "function")
      ? window.CSS.escape(s)
      : String(s).replace(/"/g, '\\"');

  document.addEventListener("paste", (event) => {
    const active = document.activeElement;
    if (!active || !active.classList.contains("editable-cell")) return;

    const td = active.closest("td");
    const currentCol = active.dataset.col || td?.dataset.col || ""; // ✅ usa data-col

    if (!PASTE_COLUMNS.includes(currentCol)) return; // só LMR e R

    const clipboard = event.clipboardData?.getData("text") ?? "";
    const isMatrix = /\t|\r?\n/.test(clipboard);

    // ✅ Deixe colagem de matriz para o handler global; colagem simples é tratada no input
    if (!isMatrix) return;

    event.preventDefault();

    const matrix = parseClipboard(clipboard); // linhas -> colunas (TSV Excel)
    if (!matrix.length) return;

    // ✅ inputs da MESMA COLUNA usando data-col (e escapando nome com espaços/parênteses)
    const inputs = Array.from(
      document.querySelectorAll(`td[data-col="${cssEscape(currentCol)}"] input.editable-cell`)
    );

    const startIndex = inputs.indexOf(active);
    const ops = [];

    for (let i = 0; i < matrix.length; i++) {
      const rowInput = inputs[startIndex + i];
      if (!rowInput) break;

      const rowIdx = rowInput.closest("tr").dataset.idx;
      const colsThisRow = matrix[i];

      if (colsThisRow.length === 1) {
        const valText = normalizeNumberText(colsThisRow[0]);
        const valor = interpretToken(valText);
        ops.push({ idx: rowIdx, coluna: currentCol, valor });
      } else {
        const startColIdx = PASTE_COLUMNS.indexOf(currentCol);
        for (let j = 0; j < colsThisRow.length; j++) {
          const targetCol = PASTE_COLUMNS[startColIdx + j];
          if (!targetCol) break;
          const valText = normalizeNumberText(colsThisRow[j]);
          const valor = interpretToken(valText);
          ops.push({ idx: rowIdx, coluna: targetCol, valor });
        }
      }
    }

    const applied = ops.filter(o => o.valor !== "").length;
    aplicarEdicoesEmLote(ops, cssEscape);
    mostrarFeedback(`Colados ${applied} valor(es).`);
  });

  function parseClipboard(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return [];
    return trimmed.split(/\r?\n/).map(line => line.split("\t").map(s => s.trim()));
  }

  function normalizeNumberText(s) {
    if (s == null) return "";
    let t = String(s).trim();
    if (/^(na|n\/a|--|-)$/i.test(t)) return "-";
    if (t.includes(",")) {
      t = t.replace(/\./g, "").replace(",", ".");
    }
    return t;
  }

  function interpretToken(s) {
    if (!s || s === "-" || /^na$/i.test(s)) return "";
    // aceita inteiros e decimais com ponto
    return /^\d+(\.\d+)?$/.test(s) ? s : "";
  }

  function aplicarEdicoesEmLote(ops, esc) {
    ops.forEach(({ idx, coluna, valor }) => {
      const row = state.rows[idx];
      if (row) {
        row[coluna] = valor;

        // ✅ seleciona o INPUT correto por linha + coluna
        const sel = `tr[data-idx="${idx}"] td[data-col="${esc(coluna)}"] input.editable-cell`;
        const input = document.querySelector(sel);
        if (input) input.value = valor;
      }
    });
    calcularTudo();
    salvarMexicoNoLocalStorage();
  }

  function mostrarFeedback(msg) {
    let toast = document.getElementById("paste-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "paste-toast";
      toast.style.cssText = "position:fixed;bottom:16px;right:16px;background:#2d7;border-radius:6px;color:#fff;padding:8px 12px;font:600 12px/1.3 system-ui;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:9999;opacity:.98";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    clearTimeout(toast._t);
    toast.style.display = "block";
    toast._t = setTimeout(() => { toast.style.display = "none"; }, 2000);
  }
})();

/* =========================
 * Limpar relatório
 * ========================= */
function clearReport() {
  state.rows.forEach((row, i) => {
    row["LMR (mg/kg)"] = "";
    row["R (mg/kg)"] = "";
    row["(LMR or R)*C"] = "";
    const tr = document.querySelector(`tr[data-idx="${i}"]`);
    if (tr) {
      tr.querySelectorAll("input.editable-cell").forEach(inp => inp.value = "");
      const lcCell = tr.querySelector("td.col-lc");
      if (lcCell) lcCell.textContent = "-";
    }
  });

  state.meta.adi_interno = "";
  const outAdi = document.querySelector("#outAdi");
  if (outAdi) {
    const inpAdi = outAdi.querySelector("input");
    if (inpAdi) inpAdi.value = "";
  }

  state.totals = {};
  const outIdmt = document.querySelector("#outIdmt");
  const outPercentAdi = document.querySelector("#outPercentAdi");
  if (outIdmt) outIdmt.textContent = "-";
  if (outPercentAdi) outPercentAdi.textContent = "-";

  calcularTudo();

  // ✅ Reflete "apagou" no storage
  localStorage.removeItem("RW_MEXICO_ADI");
  localStorage.setItem("RW_MEXICO_META", JSON.stringify(state.meta));
  localStorage.setItem("RW_MEXICO_TOTALS", JSON.stringify(state.totals));
}

/* =========================
 * Boot
 * ========================= */
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  const btnClearById = document.querySelector("#btnClear");
  const btnClearByClass = document.querySelector(".btn-clear");
  const btnClear = btnClearById || btnClearByClass;
  if (btnClear) btnClear.addEventListener("click", clearReport);
});

/* =========================
 * Modais (mantidos)
 * ========================= */
const modal = document.getElementById("btn-infoC");
const btn = document.querySelector(".btn-infoC");
// Cuidado: se 'modal' for na verdade o botão, esse seletor vai falhar.
// Mantive como estava, mas ideal é que modal seja um <div id="modal-infoC">.
const span = modal ? modal.querySelector(".close") : null;

if (btn && modal && span) {
  btn.addEventListener("click", () => {
    modal.style.display = "flex";
  });

  span.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
}

const modalNote = document.getElementById("modalNote");
const noteLink = document.getElementById("note-link");
const closeNote = modalNote ? modalNote.querySelector(".close") : null;

if (noteLink && modalNote && closeNote) {
  noteLink.addEventListener("click", () => {
    modalNote.style.display = "flex";
  });

  closeNote.addEventListener("click", () => {
    modalNote.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    if (event.target === modalNote) {
      modalNote.style.display = "none";
    }
  });
}