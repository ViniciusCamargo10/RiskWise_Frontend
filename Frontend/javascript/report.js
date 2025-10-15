document.addEventListener("DOMContentLoaded", () => {
  // 🔹 Carrega os dados do localStorage e renderiza a tabela
  const dadosAcute = JSON.parse(localStorage.getItem("reportDataAcute") || "[]");
  renderizarTabelaReport(dadosAcute);

  // 🔹 Botão Home
  const homeBtn = document.getElementById("btn-home");
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      window.location.href = "./index.html";
    });
    homeBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.location.href = "./index.html";
      }
    });
  }

  // 🔹 Botão Calculator
  const calculatorBtn = document.getElementById("btn-calculator");
  if (calculatorBtn) {
    calculatorBtn.addEventListener("click", () => {
      window.location.href = "./calculator.html";
    });
    calculatorBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.location.href = "./calculator.html";
      }
    });
  }

  // 🔹 Botão Library
  const libraryBtn = document.getElementById("btn-library");
  if (libraryBtn) {
    libraryBtn.addEventListener("click", () => {
      window.location.href = "./library.html";
    });
    libraryBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.location.href = "./library.html";
      }
    });
  }

  // 🔹 Botão de exportação (opcional)
  const exportBtn = document.querySelector(".btn-excel");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      // Aqui você pode adicionar a lógica de exportação para Excel/PDF
      alert("Exportar para Excel/PDF ainda não implementado.");

      // Limpa os dados após exportar (opcional)
      localStorage.removeItem("reportDataAcute");
      location.reload();
    });
  }
});

// 🔹 Função para renderizar a tabela

function renderizarTabelaReport(dados) {
  const tbody = document.getElementById("report-acute-body");
  tbody.innerHTML = "";

  if (!dados.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="no-data">Nenhum dado disponível</td></tr>`;
    return;
  }

  dados.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item["Cultivo/ Matriz Animal"] || "-"}</td>
      <td>${item["ANO POF"] || "-"}</td>
      <td>${item["Região"] || "-"}</td>
      <td>${item["LMR (mg/kg)"] || "-"}</td>
      <td>${item["HR/MCR (mg/kg)"] || "-"}</td>
      <td>${item["MREC/STMR (mg/kg)"] || "-"}</td>
      <td>${item["IMEA (mg/kg p.c./dia)"] || "-"}</td>
      <td>${item["%DRFA ANVISA"] || "-"}</td>
      <td>${item["%DRFA SYNGENTA"] || "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}


// 🔹 Modal de contato
function abrirModal() {
  document.getElementById('modalEmail').style.display = 'flex';
}

function fecharModal() {
  document.getElementById('modalEmail').style.display = 'none';
}

window.onclick = function(event) {
  const modal = document.getElementById('modalEmail');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
};