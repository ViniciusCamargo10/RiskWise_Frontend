const API = "/mexico";

// Estado global
let state = {
  meta: { bw: 70, adi_interno: 0.05 },
  rows: [],
  totals: {}
};

// -------------------- Carregar dados do backend --------------------
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

// -------------------- Renderizar tabela e resultados --------------------
function render() {
  // Atualiza valores fixos no bloco Results Output
  document.querySelector("#outBw").textContent = state.meta.bw;
  document.querySelector("#outAdi").textContent = state.meta.adi_interno;
  document.querySelector("#outIdmt").textContent = "-"; // será calculado depois
  document.querySelector("#outPercentAdi").textContent = "-"; // será calculado depois

  // Renderiza linhas da tabela principal
  const tbody = document.querySelector("#tbodyMexico");
  tbody.innerHTML = "";

  if (!state.rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="no-data">Nenhum dado disponível</td></tr>`;
    return;
  }

  state.rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    const cols = ["Crop", "Cultivo", "LMR (mg/kg)", "R (mg/kg)", "C (Kg/person/day)", "(LMR or R)*C"];

    cols.forEach(col => {
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

// -------------------- Salvar alterações no backend --------------------
async function saveData() {
  try {
    const payload = { meta: state.meta, rows: state.rows };
    const res = await fetch(`${API}/atualizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`Erro ao salvar: ${err.detail || res.statusText}`);
    } else {
      alert("Dados salvos com sucesso!");
    }
  } catch (err) {
    console.error("Erro ao salvar:", err);
    alert("Falha ao salvar dados.");
  }
}

// -------------------- Limpar relatório --------------------
function clearReport() {
  state.rows.forEach(row => {
    row["LMR (mg/kg)"] = "";
    row["R (mg/kg)"] = "";
    row["C (Kg/person/day)"] = "";
    row["(LMR or R)*C"] = "";
    row["IDMT"] = "";
    row["%ADI"] = "";
  });
  render();
}

// -------------------- Eventos --------------------
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  document.querySelector("#btnSave").addEventListener("click", saveData);
  document.querySelector("#btnClear").addEventListener("click", clearReport);
  document.querySelector("#btnRecalc").addEventListener("click", () => {
    alert("Cálculo será implementado na próxima fase!");
  });
});