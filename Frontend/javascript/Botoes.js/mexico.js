const API = "http://127.0.0.1:8000/mexico";

let state = {
  meta: { bw: 70, adi_interno: 0.05 },
  rows: [],
  totals: {}
};

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
    e.preventDefault();
    const clip = (e.clipboardData || window.clipboardData).getData("text") ?? "";

    // ❌ Recusa vírgula e qualquer coisa fora de [0-9.]
    if (/,/.test(clip) || /[^0-9.]/.test(clip)) {
      input.style.borderColor = "#e53935";
      setTimeout(() => (input.style.borderColor = "#ccc"), 800);
      return;
    }

    let sanitized = clip.replace(/[^0-9.]/g, "");

    // Monta o próximo valor respeitando seleção
    const selStart = input.selectionStart ?? 0;
    const selEnd = input.selectionEnd ?? 0;
    const nextValue = input.value.slice(0, selStart) + sanitized + input.value.slice(selEnd);

    // Permite apenas um ponto no total
    let dotSeen = false;
    let final = "";
    for (const c of nextValue) {
      if (c === ".") {
        if (dotSeen) continue;
        dotSeen = true;
      }
      final += c;
    }

    if (final.startsWith(".")) final = "0" + final;

    input.value = final;
    prev = final;
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

/* ==========================================
 * Cálculo por linha e totais (sem arredondar)
 * ========================================== */
function calcRowAndPaint(i) {
  const row = state.rows[i];
  let lmr = toNumOrNull(row["LMR (mg/kg)"]);
  let r   = toNumOrNull(row["R (mg/kg)"]);
  let c   = toNumOrNull(row["C (Kg/person/day)"]);

  const limite = (r !== null) ? r : (lmr !== null ? lmr : null);
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
}

/* =========================
 * Carregar dados da API
 * ========================= */
async function loadData() {
  try {
    const res = await fetch(`${API}/dados`);
    if (!res.ok) throw new Error("Erro ao buscar dados");
    const data = await res.json();

    state.meta = data.meta;

    // Normaliza (aceita vírgula do Excel) -> número
    state.rows = (data.rows ?? []).map(row => {
      return {
        ...row,
        "C (Kg/person/day)": toNumOrNull(normalizeFromServer(row["C (Kg/person/day)"])),
        "LMR (mg/kg)":       toNumOrNull(normalizeFromServer(row["LMR (mg/kg)"])),
        "R (mg/kg)":         toNumOrNull(normalizeFromServer(row["R (mg/kg)"]))
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

          if (["LMR (mg/kg)", "R (mg/kg)"].includes(col)) {
            const inp = document.createElement("input");
            inp.type = "text";
            // Mostra como string crua (sem casas forçadas); usuário editará
            inp.value = (row[col] ?? "") === "" ? "" : String(row[col]);
            inp.className = "editable-cell";
            inp.style.width = "100%";
            wireDecimalOnly(inp);

            inp.addEventListener("input", () => {
              row[col] = inp.value;   // mantém string para o usuário
              calcRowAndPaint(i);     // calcula com toNumOrNull internamente
              calcularTudo();
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

})