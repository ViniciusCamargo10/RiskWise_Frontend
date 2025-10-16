let drfaExterno = "-";
let drfaInterno = "-";

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.location.origin; // ex.: http://127.0.0.1:8000

  // Carrega dados da memória
  let dadosAcute = JSON.parse(localStorage.getItem("DADOS_CALCULADORA") || "[]");
  renderizarTabelaReport(dadosAcute);

  // DRFA do localStorage
  drfaExterno = localStorage.getItem("IDA_ANVISA_VAL") || "-";
  drfaInterno = localStorage.getItem("IDA_SYNGENTA_VAL") || "-";

  const elDrfaExt = document.getElementById("drfa-externo");
  const elDrfaInt = document.getElementById("drfa-interno");
  if (elDrfaExt) elDrfaExt.textContent = drfaExterno;
  if (elDrfaInt) elDrfaInt.textContent = drfaInterno;

  // Navegação (ajuste se seus nomes de página forem diferentes)
  bindNav("btn-home", "./index.html");
  bindNav("btn-calculator", "./calculatorHome.html"); // <- seu HTML usa calculatorHome.html
  bindNav("btn-library", "./LibraryHome.html");

  // ---------------------------
  // Botão Excel (apenas Excel)
  // ---------------------------
  const btnExcel = document.querySelector(".btn-excel");
  if (btnExcel) {
    btnExcel.addEventListener("click", async () => {
      try {
        console.log("[Excel] clique detectado");
        // Garante dados: se localStorage vazio, extrai da tabela
        const dadosParaExportar = ensureDadosAcute(dadosAcute);
        exportToExcel(dadosParaExportar);
      } catch (err) {
        console.error("Falha ao exportar Excel:", err);
        alert("Falha ao exportar Excel. Veja o console para detalhes.");
      }
    });
  }

  // ---------------------------
  // Botão PDF (apenas PDF)
  // ---------------------------
  const btnPdf = document.querySelector(".btn-pdf"); // ou document.getElementById("btn-pdf")
  if (btnPdf) {
    btnPdf.addEventListener("click", async () => {
      try {
        console.log("[PDF] clique detectado");
        // Garante dados: se localStorage vazio, extrai da tabela
        const dadosParaExportar = ensureDadosAcute(dadosAcute);
        await exportPdfFromBackend(API_BASE, dadosParaExportar);
      } catch (err) {
        console.error("Falha ao exportar PDF:", err);
        alert("Falha ao exportar PDF. Veja o console para detalhes.");
      }
    });
  }
});

// ---------------------------
// Util: garante dados válidos
// ---------------------------
function ensureDadosAcute(dadosAcute) {
  if (Array.isArray(dadosAcute) && dadosAcute.length > 0) {
    console.log("[Dados] usando localStorage:", dadosAcute.length, "linhas");
    return dadosAcute;
  }
  // Fallback: extrai da tabela renderizada (DOM)
  const extraidos = extractAcuteFromTable();
  console.log("[Dados] extraídos do DOM:", extraidos.length, "linhas");
  if (extraidos.length === 0) {
    throw new Error("Não há dados na memória nem na tabela para exportar.");
  }
  return extraidos;
}

// Extrai dados do DOM (tabela #report-acute-body)
function extractAcuteFromTable() {
  const rows = Array.from(document.querySelectorAll("#report-acute-body tr"));
  const itens = [];

  rows.forEach((r) => {
    const tds = r.querySelectorAll("td");
    if (!tds || tds.length < 10) return; // ignora linha "Nenhum dado disponível"
    itens.push({
      "Cultivo/ Matriz Animal": tds[0]?.innerText?.trim(),
      "ANO POF": tds[1]?.innerText?.trim(),
      "Região": tds[2]?.innerText?.trim(),
      "Caso Fórmula": tds[3]?.innerText?.trim(),
      "LMR (mg/kg)": tds[4]?.innerText?.trim(),
      "HR/MCR (mg/kg)": tds[5]?.innerText?.trim(),
      "MREC/STMR (mg/kg)": tds[6]?.innerText?.trim(),
      "IMEA (mg/kg p.c./dia)": tds[7]?.innerText?.trim(),
      "%DRFA ANVISA": tds[8]?.innerText?.trim(),
      "%DRFA SYNGENTA": tds[9]?.innerText?.trim(),
    });
  });

  return itens;
}

// ---------------------------
// Navegação util
// ---------------------------
function bindNav(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", () => (window.location.href = target));
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      window.location.href = target;
    }
  });
}

// ---------------------------
// Excel (mantido em JS)
// ---------------------------


function exportToExcel(dados) {
  const wb = XLSX.utils.book_new();

  // Cabeçalho
  const cabecalho = [
    "Cultivo", "ANO POF", "Região", "Caso Fórmula", "LMR",
    "HR/MCR", "MREC/STMR", "IMEA", "%DRFA Externo", "%DRFA Interno"
  ];

  // Mapa de colunas -> possíveis chaves no objeto
  const keyMap = {
    "Cultivo": ["Cultivo", "Cultivo/ Matriz Animal"],
    "ANO POF": ["ANO POF"],
    "Região": ["Região"],
    "Caso Fórmula": ["Caso Fórmula"],
    "LMR": ["LMR (mg/kg)"],
    "HR/MCR": ["HR/MCR (mg/kg)"],
    "MREC/STMR": ["MREC/STMR (mg/kg)"],
    "IMEA": ["IMEA (mg/kg p.c./dia)"],
    "%DRFA Externo": ["%DRFA ANVISA"],
    "%DRFA Interno": ["%DRFA SYNGENTA"],
  };
  const getVal = (row, col) => {
    const keys = keyMap[col] || [col];
    for (const k of keys) if (row[k] !== undefined && row[k] !== null) return row[k];
    return "";
  };

  const dadosComHeader = [
    ["DRFA Externo", drfaExterno],
    ["DRFA Interno", drfaInterno],
    [],
    cabecalho,
    ...dados.map(item => cabecalho.map(col => getVal(item, col)))
  ];

  const ws = XLSX.utils.aoa_to_sheet(dadosComHeader);

  // Larguras automáticas (clamp 12..40)
  ws["!cols"] = cabecalho.map((col) => {
    const maxLength = Math.max(
      String(col).length,
      ...dados.map(row => String(getVal(row, col) ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 12), 40) };
  });

  // Cabeçalho estilizado (linha 4 -> índice 3)
  cabecalho.forEach((_, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: 3, c: i });
    if (!ws[cellRef]) return;
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4CAF50" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      }
    };
  });

  // Destaque DRFA (linhas 1 e 2)
  ["A1","A2"].forEach(ref => ws[ref] && (ws[ref].s = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "4CAF50" } },
    alignment: { horizontal: "center", vertical: "center" }
  }));
  ["B1","B2"].forEach(ref => ws[ref] && (ws[ref].s = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "81C784" } },
    alignment: { horizontal: "center", vertical: "center" }
  }));

  XLSX.utils.book_append_sheet(wb, ws, "Acute Diet");
  XLSX.writeFile(wb, `riskwise_acute_${new Date().toISOString().split('T')[0]}.xlsx`);
}


// ---------------------------
// PDF via backend (FastAPI)
// ---------------------------
async function exportPdfFromBackend(API_BASE, dados) {
  const drfaExternoLS = localStorage.getItem("IDA_ANVISA_VAL") || "-";
  const drfaInternoLS = localStorage.getItem("IDA_SYNGENTA_VAL") || "-";

  const payload = {
    dados,
    drfa_externo: drfaExternoLS,
    drfa_interno: drfaInternoLS,
  };

  console.log("[PDF] POST", `${API_BASE}/acute/gerar-pdf`, payload);

  const resp = await fetch(`${API_BASE}/acute/gerar-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("[PDF] erro", resp.status, text);
    throw new Error(`Erro ao gerar PDF: ${resp.status} - ${text}`);
  }

  // Garante que veio PDF
  const contentType = resp.headers.get("Content-Type") || "";
  if (!contentType.includes("application/pdf")) {
    const previewText = await resp.text();
    console.error("[PDF] Content-Type inesperado:", contentType, "body:", previewText.slice(0, 300));
    throw new Error("Resposta não é PDF. Veja o console.");
  }

  const blob = await resp.blob();
  console.log("[PDF] blob recebido:", blob.size, "bytes");
  if (blob.size === 0) {
    throw new Error("PDF vazio recebido.");
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `riskwise_acute_${new Date().toISOString().slice(0,10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ---------------------------
// Renderização (seu código)
// ---------------------------
function renderizarTabelaReport(dados) {
  const tbody = document.getElementById("report-acute-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!dados || !dados.length) {
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