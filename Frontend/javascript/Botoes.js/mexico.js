const API = "http://127.0.0.1:8000/mexico";

let state = {
  meta: { bw: 70, adi_interno: 0.05 },
  rows: [],
  totals: {}
};

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

    if (!/[\d.]/.test(ch)) {
      e.preventDefault();
      return;
    }

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

function toNumOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function fmt6(n) { return Number(n).toFixed(6); }
function fmt2(n) { return Number(n).toFixed(2); }

function calcRowAndPaint(i) {
  const row = state.rows[i];
  let lmr = toNumOrNull(row["LMR (mg/kg)"]);
  let r   = toNumOrNull(row["R (mg/kg)"]);
  let c   = toNumOrNull(row["C (Kg/person/day)"]);

  const limite = (r !== null) ? r : (lmr !== null ? lmr : null);
  const val = (limite !== null && c !== null) ? limite * c : null;

  if (val !== null) {
    const v6 = Number(fmt6(val));
    row["(LMR or R)*C"] = v6;
  } else {
    row["(LMR or R)*C"] = "";
  }

  const cell = document.querySelector(`tr[data-idx="${i}"] td.col-lc`);
  if (cell) cell.textContent = (val !== null) ? fmt6(val) : "-";
}

function calcularTudo() {
  for (let i = 0; i < state.rows.length; i++) {
    calcRowAndPaint(i);
  }

  let sumLC = 0;
  state.rows.forEach(r => {
    const v = toNumOrNull(r["(LMR or R)*C"]);
    if (v !== null) sumLC += v;
  });
  sumLC = Number(fmt6(sumLC));

  const bw  = toNumOrNull(state.meta.bw);
  const adi = toNumOrNull(state.meta.adi_interno);

  let idmt = null;
  if (bw !== null && bw > 0) idmt = Number(fmt6(sumLC / bw));

  let percent = null;
  if (adi !== null && adi > 0 && idmt !== null) {
    percent = Number(fmt2((idmt / adi) * 100));
  }

  state.totals = {
    sumLC,
    idmt,
    "%ADI_interno": percent
  };

  const outIdmt = document.querySelector("#outIdmt");
  const outPercentAdi = document.querySelector("#outPercentAdi");
  if (outIdmt) outIdmt.textContent = (idmt !== null) ? fmt6(idmt) : "-";
  if (outPercentAdi) outPercentAdi.textContent = (percent !== null) ? fmt2(percent) : "-";
}

async function loadData() {
  try {
    const res = await fetch(`${API}/dados`);
    if (!res.ok) throw new Error("Erro ao buscar dados");
    const data = await res.json();

    state.meta = data.meta;

    // Converte C (Kg/person/day) para número
    state.rows = data.rows.map(row => ({
      ...row,
      "C (Kg/person/day)": toNumOrNull(row["C (Kg/person/day)"])
    }));

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

function render(firstPaint = false) {
  const outBw = document.querySelector("#outBw");
  const outAdi = document.querySelector("#outAdi");

  if (outBw) outBw.textContent = state.meta.bw ?? "-";

  if (outAdi) {
  const inpAdi = document.createElement("input");
  inpAdi.type = "text";
  inpAdi.value = state.meta.adi_interno ?? "";
  inpAdi.className = "editable-cell";
  inpAdi.style.width = "80px";
  wireDecimalOnly(inpAdi);

 inpAdi.addEventListener("input", (e) => {
  let val = inpAdi.value;

  // Se o usuário está apagando, não força nada
  if (e.inputType === "deleteContentBackward") {
    state.meta.adi_interno = val;
    calcularTudo();
    return;
  }

  // Se começar com "0" e não tiver ponto, apenas mantém 0
  if (val === "0") {
    state.meta.adi_interno = val;
    calcularTudo();
    return;
  }

  // Se o valor começa com "0" e o próximo caractere não é ponto, insere ponto automaticamente
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
            inp.value = row[col] ?? "";
            inp.className = "editable-cell";
            inp.style.width = "100%";
            wireDecimalOnly(inp);

            inp.addEventListener("input", () => {
              row[col] = inp.value;
              calcRowAndPaint(i);
              calcularTudo();
            });

            inp.addEventListener("blur", () => {
              const n = toNumOrNull(inp.value);
              inp.value = (n !== null) ? String(n) : "";
              row[col] = inp.value;
            });

            td.appendChild(inp);
          } else if (col === "C (Kg/person/day)") {
            td.textContent = row[col] ?? "-";
          } else if (col === "Cultivo") {
            const valor = row[col] ?? "-";
            td.innerHTML = valor.replace(/(\d+)$/, "<sup>$1</sup>");
          } else if (col === "(LMR or R)*C") {
            td.classList.add("col-lc");
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

  calcularTudo();
}

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

  // ✅ Recalcula tudo após limpar
  calcularTudo();
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  const btnClearById = document.querySelector("#btnClear");
  const btnClearByClass = document.querySelector(".btn-clear");
  const btnClear = btnClearById || btnClearByClass;
  if (btnClear) btnClear.addEventListener("click", clearReport);
});

