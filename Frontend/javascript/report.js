let drfaExterno = "-";
let drfaInterno = "-";

document.addEventListener("DOMContentLoaded", () => {
  const dadosAcute = JSON.parse(localStorage.getItem("DADOS_CALCULADORA") || "[]");
  renderizarTabelaReport(dadosAcute);

  drfaExterno = localStorage.getItem("IDA_ANVISA_VAL") || "-";
  drfaInterno = localStorage.getItem("IDA_SYNGENTA_VAL") || "-";

  document.getElementById("drfa-externo").textContent = drfaExterno;
  document.getElementById("drfa-interno").textContent = drfaInterno;

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

  
  const exportBtn = document.querySelector(".btn-excel");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      // Primeiro gera Excel
      exportToExcel(dadosAcute);

      // Depois gera PDF
      exportToPDF(dadosAcute);

      // Aguarda 2 segundos antes de limpar e recarregar
      setTimeout(() => {
        localStorage.removeItem("reportDataAcute");
        location.reload();
      }, 2000); // 2000 ms = 2 segundos
    });
  }
});


function exportToExcel(dados) {
  const wb = XLSX.utils.book_new();

  const dadosComHeader = [
    ["DRFA Externo", drfaExterno],
    ["DRFA Interno", drfaInterno],
    [],
    ["Cultivo", "ANO POF", "Região", "Caso Fórmula", "LMR", "HR/MCR", "MREC/STMR", "IMEA", "%DRFA Externo", "%DRFA Interno"],
    ...dados.map(item => [
      item["Cultivo/ Matriz Animal"], item["ANO POF"], item["Região"], item["Caso Fórmula"],
      item["LMR (mg/kg)"], item["HR/MCR (mg/kg)"], item["MREC/STMR (mg/kg)"],
      item["IMEA (mg/kg p.c./dia)"], item["%DRFA ANVISA"], item["%DRFA SYNGENTA"]
    ])
  ];

  const ws = XLSX.utils.aoa_to_sheet(dadosComHeader);
  XLSX.utils.book_append_sheet(wb, ws, "Acute Diet");

  XLSX.writeFile(wb, `riskwise_acute_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportToPDF(dados) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  doc.setFontSize(14);
  doc.text("Acute Diet Calculator", 40, 40);

  doc.setFontSize(12);
  doc.text(`DRFA Externo: ${drfaExterno}`, 40, 60);
  doc.text(`DRFA Interno: ${drfaInterno}`, 40, 80);

  doc.autoTable({
    startY: 100,
    head: [["Cultivo", "ANO POF", "Região", "Caso Fórmula", "LMR", "HR/MCR", "MREC/STMR", "IMEA", "%DRFA Externo", "%DRFA Interno"]],
    body: dados.map(item => [
      item["Cultivo/ Matriz Animal"], item["ANO POF"], item["Região"], item["Caso Fórmula"],
      item["LMR (mg/kg)"], item["HR/MCR (mg/kg)"], item["MREC/STMR (mg/kg)"],
      item["IMEA (mg/kg p.c./dia)"], item["%DRFA ANVISA"], item["%DRFA SYNGENTA"]
    ]),
    theme: 'grid'
  });

  doc.save(`riskwise_acute_${new Date().toISOString().split('T')[0]}.pdf`);
}

function renderizarTabelaReport(dados) {
  const tbody = document.getElementById("report-acute-body");
  tbody.innerHTML = "";

  if (!dados.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="no-data">Nenhum dado disponível</td></tr>`;
    return;
  }

  dados.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item["Cultivo/ Matriz Animal"] || "-"}</td>
      <td>${item["ANO POF"] || "-"}</td>
      <td>${item["Região"] || "-"}</td>
      <td>${item["Caso Fórmula"] || "-"}</td>
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
``