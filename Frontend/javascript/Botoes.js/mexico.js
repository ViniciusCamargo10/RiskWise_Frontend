const API = "http://127.0.0.1:8000/mexico";

// Estado global
let state = {
  meta: { bw: 70, adi_interno: 0.05 },
  rows: [],
  totals: {} // { sumLC, idmt, "%ADI_interno" }
};

/* ================================
 * Utilitário: forçar decimal com ponto (sem vírgula)
 * - Permite apenas dígitos e um único '.'.
 * - Bloqueia ',' e quaisquer caracteres não numéricos.
 * - Trata paste para manter só 0-9 e no máximo um '.'.
 * ================================ */
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

    // Bloqueia vírgula e quaisquer não [0-9.]
    if (!/[\d.]/.test(ch)) {
      e.preventDefault();
      return;
    }

    // Permitir apenas um único '.'
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
    let sanitized = clip.replace(/[^0-9.]/g, "");

    const selStart = input.selectionStart ?? 0;
    const selEnd = input.selectionEnd ?? 0;
    const nextValue = input.value.slice(0, selStart) + sanitized + input.value.slice(selEnd);

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

    prev = input.value;
    input.style.borderColor = "#ccc";
  });
}

/* ================================
 * Helpers numéricos e formatação
 * ================================ */
function toNumOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function fmt6(n) { return Number(n).toFixed(6); }
function fmt2(n) { return Number(n).toFixed(2); }

/* ================================
 * Cálculo de uma linha e do total
 * - Atualiza state.rows[i]["(LMR or R)*C"]
 * - Atualiza DOM da coluna calculada da linha
 * ================================ */
function calcRowAndPaint(i) {
  const row = state.rows[i];
  let lmr = toNumOrNull(row["LMR (mg/kg)"]);
  let r   = toNumOrNull(row["R (mg/kg)"]);
  let c   = toNumOrNull(row["C (Kg/person/day)"]);

  const limite = (r !== null) ? r : (lmr !== null ? lmr : null);
  const val = (limite !== null && c !== null) ? limite * c : null;

  // Atualiza o modelo
  if (val !== null) {
    const v6 = Number(fmt6(val));
    row["(LMR or R)*C"] = v6;
  } else {
    row["(LMR or R)*C"] = "";
  }

  // Atualiza a célula da linha no DOM (sem rerenderizar tudo)
  const cell = document.querySelector(`tr[data-idx="${i}"] td.col-lc`);
  if (cell) {
    cell.textContent = (val !== null) ? fmt6(val) : "-";
  }
}

function calcularTudo() {
  // 1) Atualiza todas as linhas calculadas
  for (let i = 0; i < state.rows.length; i++) {
    calcRowAndPaint(i);
  }

  // 2) Soma (SUM) e IDMT
  let sumLC = 0;
  state.rows.forEach(r => {
    const v = toNumOrNull(r["(LMR or R)*C"]);
    if (v !== null) sumLC += v;
  });
  sumLC = Number(fmt6(sumLC));

  const bw  = toNumOrNull(state.meta.bw);
  const adi = toNumOrNull(state.meta.adi_interno);

  let idmt = null;
  if (bw !== null && bw > 0) {
    idmt = Number(fmt6(sumLC / bw));
  }

  let percent = null;
  if (adi !== null && adi > 0 && idmt !== null) {
    percent = Number(fmt2((idmt / adi) * 100));
  }

  state.totals = {
    sumLC: sumLC,
    idmt: idmt,
    "%ADI_interno": percent
  };

  // 3) Pinta o bloco de resultados
  const outIdmt = document.querySelector("#outIdmt");
  const outPercentAdi = document.querySelector("#outPercentAdi");
  if (outIdmt) outIdmt.textContent = (idmt !== null) ? fmt6(idmt) : "-";
  if (outPercentAdi) outPercentAdi.textContent = (percent !== null) ? fmt2(percent) : "-";
}

/* ================================
 * Carregar dados do backend
 * ================================ */
async function loadData() {
  try {
    const res = await fetch(`${API}/dados`);
    if (!res.ok) throw new Error("Erro ao buscar dados");
    const data = await res.json();

    state.meta = data.meta;
    state.rows = data.rows;
    state.totals = data.totals ?? {};

    render(true); // primeiro render: constrói tabela e calcula tudo
  } catch (err) {
    console.error("Falha ao carregar dados:", err);
    const tbody = document.querySelector("#tbodyMexico");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="no-data">Erro ao carregar dados</td></tr>`;
    }
  }
}

/* ================================
 * Renderizar tabela e resultados
 * - firstPaint = true: constrói linhas e liga eventos
 * ================================ */
function render(firstPaint = false) {
  // Cabeçalhos fixos
  const outBw = document.querySelector("#outBw");
  const outAdi = document.querySelector("#outAdi");
  if (outBw)  outBw.textContent  = state.meta.bw ?? "-";
  if (outAdi) outAdi.textContent = state.meta.adi_interno ?? "-";

  const tbody = document.querySelector("#tbodyMexico");
  if (!tbody) return;

  if (firstPaint) {
    // Monta a tabela do zero apenas no primeiro paint
    tbody.innerHTML = "";

    if (!state.rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="no-data">Nenhum dado disponível</td></tr>`;
    } else {
      state.rows.forEach((row, i) => {
        const tr = document.createElement("tr");
        tr.dataset.idx = String(i);

        // Colunas em ordem
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

          if (["LMR (mg/kg)", "R (mg/kg)", "C (Kg/person/day)"].includes(col)) {
            const inp = document.createElement("input");
            inp.type = "text";
            inp.value = row[col] ?? "";
            inp.className = "editable-cell";
            inp.style.width = "100%";
            wireDecimalOnly(inp);

            // Recalcular a cada digitação (inclui apagar)
            inp.addEventListener("input", () => {
              row[col] = inp.value;   // mantém no estado como string/número coerente
              // Recalcula apenas o necessário e resultados
              calcRowAndPaint(i);
              // Recalcula totais e pinta bloco de resultados
              // (mais leve que re-renderizar toda a tabela)
              let sumLC = 0;
              state.rows.forEach(r => {
                const v = toNumOrNull(r["(LMR or R)*C"]);
                if (v !== null) sumLC += v;
              });
              sumLC = Number(fmt6(sumLC));
              const bw = toNumOrNull(state.meta.bw);
              const adi = toNumOrNull(state.meta.adi_interno);
              let idmt = (bw !== null && bw > 0) ? Number(fmt6(sumLC / bw)) : null;
              let percent = (adi !== null && adi > 0 && idmt !== null) ? Number(fmt2((idmt / adi) * 100)) : null;

              state.totals = { sumLC, idmt, "%ADI_interno": percent };

              const outIdmt = document.querySelector("#outIdmt");
              const outPercentAdi = document.querySelector("#outPercentAdi");
              if (outIdmt) outIdmt.textContent = (idmt !== null) ? fmt6(idmt) : "-";
              if (outPercentAdi) outPercentAdi.textContent = (percent !== null) ? fmt2(percent) : "-";
            });

            // Normaliza no blur (opcional)
            inp.addEventListener("blur", () => {
              const n = toNumOrNull(inp.value);
              inp.value = (n !== null) ? String(n) : "";
              row[col] = inp.value;
            });

            td.appendChild(inp);
          } else if (col === "(LMR or R)*C") {
            td.classList.add("col-lc");  // marcador para atualização rápida
            td.textContent = row[col] ?? "-";
          } else {
            td.textContent = row[col] ?? "-";
          }

          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    }
  }

  // Calcula tudo e pinta resultados/coluna calculada
  calcularTudo();
}

/* ================================
 * Clear Report (frontend apenas)
 * ================================ */
function clearReport() {
  state.rows.forEach((row, i) => {
    row["LMR (mg/kg)"] = "";
    row["R (mg/kg)"] = "";
    row["C (Kg/person/day)"] = "";
    row["(LMR or R)*C"] = "";
    // Atualiza inputs visualmente (sem reconstruir tabela)
    const tr = document.querySelector(`tr[data-idx="${i}"]`);
    if (tr) {
      const inputs = tr.querySelectorAll("input.editable-cell");
      inputs.forEach(inp => inp.value = "");
      const lcCell = tr.querySelector("td.col-lc");
      if (lcCell) lcCell.textContent = "-";
    }
  });

  state.totals = {};
  const outIdmt = document.querySelector("#outIdmt");
  const outPercentAdi = document.querySelector("#outPercentAdi");
  if (outIdmt) outIdmt.textContent = "-";
  if (outPercentAdi) outPercentAdi.textContent = "-";
}

/* ================================
 * Inicialização
 * ================================ */
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  // Botão Clear (por id ou classe)
  const btnClearById = document.querySelector("#btnClear");
  const btnClearByClass = document.querySelector(".btn-clear");
  const btnClear = btnClearById || btnClearByClass;
  if (btnClear) btnClear.addEventListener("click", clearReport);
});