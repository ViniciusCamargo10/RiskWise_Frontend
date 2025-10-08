const API = "http://127.0.0.1:8000/mexico";

// Estado global
let state = {
  meta: { bw: 70, adi_interno: 0.05 },
  rows: [],
  totals: {}
};

/* ================================
 * Utilitário: forçar decimal com ponto (sem vírgula)
 * - Permite apenas dígitos e um único '.'.
 * - Bloqueia ',' e quaisquer caracteres não numéricos.
 * - Trata paste para manter só 0-9 e no máximo um '.'.
 * ================================ */
function wireDecimalOnly(input) {
  // Ajuda a manter caret estável nos bloqueios
  let prev = input.value ?? "";

  // Antes da inserção: bloquear caracteres não permitidos
  input.addEventListener("beforeinput", (e) => {
    // Deleções liberadas
    if (
      e.inputType === "deleteContentBackward" ||
      e.inputType === "deleteContentForward" ||
      e.inputType === "deleteByCut"
    ) return;

    // Paste tratado no handler de 'paste'
    if (e.inputType === "insertFromPaste") return;

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

  // Colagem: sanitizar para [0-9] e um único '.'
  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const clip = (e.clipboardData || window.clipboardData).getData("text") ?? "";
    // Remove tudo que não for dígito ou ponto
    let sanitized = clip.replace(/[^0-9.]/g, "");

    // Monta o novo valor respeitando apenas um único ponto no total
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

    // Se iniciar com '.', vira '0.'
    if (final.startsWith(".")) final = "0" + final;

    input.value = final;
    prev = final;
    // Dispara evento de mudança visualmente consistente
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // Input: manter apenas formato parcial válido (^\d*\.?\d*$)
  input.addEventListener("input", () => {
    const regexParcial = /^\d*\.?\d*$/;

    if (!regexParcial.test(input.value)) {
      // Reverte ao valor anterior se inválido
      input.value = prev;
      const caret = input.value.length;
      try { input.setSelectionRange(caret, caret); } catch {}
      input.style.borderColor = "#e53935";
      return;
    }

    // Se iniciar com '.', vira '0.'
    if (input.value.startsWith(".")) input.value = "0" + input.value;

    // OK
    prev = input.value;
    input.style.borderColor = "#ccc";
  });
}

// Carregar dados do backend
async function loadData() {
  try {
    const res = await fetch(`${API}/dados`);
    if (!res.ok) throw new Error("Erro ao buscar dados");
    const data = await res.json();

    state.meta = data.meta;
    state.rows = data.rows;
    state.totals = data.totals;

    render();
  } catch (err) {
    console.error("Falha ao carregar dados:", err);
    const tbody = document.querySelector("#tbodyMexico");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="no-data">Erro ao carregar dados</td></tr>`;
    }
  }
}

// Renderizar tabela e resultados
function render() {
  // Atualiza valores fixos no bloco Results Output
  const outBw = document.querySelector("#outBw");
  const outAdi = document.querySelector("#outAdi");
  const outIdmt = document.querySelector("#outIdmt");
  const outPercentAdi = document.querySelector("#outPercentAdi");

  if (outBw) outBw.textContent = state.meta.bw ?? "-";
  if (outAdi) outAdi.textContent = state.meta.adi_interno ?? "-";

  // Atualiza resultados vindos do Excel (totals) — ou placeholders
  if (outIdmt) {
    outIdmt.textContent =
      state.totals?.idmt !== null && state.totals?.idmt !== undefined
        ? state.totals.idmt
        : "-";
  }
  if (outPercentAdi) {
    outPercentAdi.textContent =
      state.totals?.["%ADI_interno"] !== null && state.totals?.["%ADI_interno"] !== undefined
        ? state.totals["%ADI_interno"]
        : "-";
  }

  // Renderiza linhas da tabela principal
  const tbody = document.querySelector("#tbodyMexico");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!state.rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="no-data">Nenhum dado disponível</td></tr>`;
    return;
  }

  state.rows.forEach((row) => {
    const tr = document.createElement("tr");
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
        // Campos editáveis numéricos com ponto (.)
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = row[col] ?? "";
        inp.className = "editable-cell";
        inp.style.width = "100%";

        // 🔒 aplica a mesma disciplina do Chronic (sem vírgula)
        wireDecimalOnly(inp);

        // Ao mudar, gravar no estado
        inp.addEventListener("change", () => {
          row[col] = inp.value;
        });

        td.appendChild(inp);
      } else {
        // Campos não editáveis (Crop, Cultivo, e (LMR or R)*C vindo do Excel)
        td.textContent = row[col] ?? "-";
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

/**
 * Clear Report — comportamento inspirado no Chronic:
 * - Zera LMR, R e C (front-end somente).
 * - Limpa (LMR or R)*C (placeholder).
 * - Reseta os resultados do bloco (IDMT e %ADI) para "-".
 * - NÃO salva no Excel (sem POST).
 */
function clearReport() {
  // 1) Limpa os campos editáveis de todas as linhas no estado
  state.rows.forEach((row) => {
    row["LMR (mg/kg)"] = "";
    row["R (mg/kg)"] = "";
    row["C (Kg/person/day)"] = "";
    row["(LMR or R)*C"] = "";
  });

  // 2) Reseta os totais exibidos (mantendo meta)
  state.totals = {}; // sem cálculo por enquanto

  // 3) Atualiza UI imediatamente
  const outIdmt = document.querySelector("#outIdmt");
  const outPercentAdi = document.querySelector("#outPercentAdi");
  if (outIdmt) outIdmt.textContent = "-";
  if (outPercentAdi) outPercentAdi.textContent = "-";

  render();
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  // Liga o botão Clear por id OU por classe (robusto a variações de HTML)
  const btnClearById = document.querySelector("#btnClear");
  const btnClearByClass = document.querySelector(".btn-clear");
  const btnClear = btnClearById || btnClearByClass;
  if (btnClear) btnClear.addEventListener("click", clearReport);
})

