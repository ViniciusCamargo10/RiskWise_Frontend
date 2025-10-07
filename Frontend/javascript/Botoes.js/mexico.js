const API = "http://127.0.0.1:8000/mexico";

// Estado global
let state = {
  meta: { bw: 70, adi_interno: 0.05 },
  rows: [],
  totals: {}
};

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
    document.querySelector("#tbodyMexico").innerHTML =
      `<tr><td colspan="6" class="no-data">Erro ao carregar dados</td></tr>`;
  }
}

// Renderizar tabela e resultados
function render() {
  // Atualiza valores fixos no bloco Results Output
  document.querySelector("#outBw").textContent = state.meta.bw ?? "-";
  document.querySelector("#outAdi").textContent = state.meta.adi_interno ?? "-";

  // Atualiza resultados vindos do Excel (totals)
  document.querySelector("#outIdmt").textContent =
    state.totals.idmt !== null && state.totals.idmt !== undefined
      ? state.totals.idmt
      : "-";

  document.querySelector("#outPercentAdi").textContent =
    state.totals["%ADI_interno"] !== null && state.totals["%ADI_interno"] !== undefined
      ? state.totals["%ADI_interno"]
      : "-";

  // Renderiza linhas da tabela principal
  const tbody = document.querySelector("#tbodyMexico");
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
        // Campos editáveis
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = row[col] ?? "";
        inp.style.width = "100%";
        inp.addEventListener("change", () => {
          row[col] = inp.value;
        });
        td.appendChild(inp);
      } else {
        // Campos não editáveis
        td.textContent = row[col] ?? "-";
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  loadData();
});