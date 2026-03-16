/* report.js - RiskWise Report
 * Requisitos: xlsx.full.min.js (0.18.5+) já carregado no HTML.
 * Este script:
 *  - Lê dados de Acute e Chronic do localStorage (com fallback do DOM)
 *  - Renderiza as tabelas Acute/Chronic em report.html
 *  - Extrai POF 2008/2017 do DOM (se tiver) com fallback para API /chronic/dados
 *  - Exporta Excel com 1 aba por calculadora e POFs na aba Chronic
 *  - Exporta PDF combinado via /report/gerar-pdf
 */
// ====== NOVO: chaves que o cálculo Crônico usa no localStorage ======

// ====== NOVO: chaves que a calculadora Aguda usa no localStorage ======
const LS_ACUTE = {
  drfaExterno: "IDA_ANVISA_VAL",    // DRFA Externa (Acute)
  drfaInterno: "IDA_SYNGENTA_VAL",  // DRFA Interna (Acute)
  acuteData:   "RW_ACUTE_DATA"      // (se você usar essa chave para dados) - opcional
};

const LS_CRONIC = {
  chronicData: "RW_CRONIC_DATA",
  idaAnvisa: "RW_CRONIC_IDA_ANVISA",
  idaSyngenta: "RW_CRONIC_IDA_SYNGENTA",
  pof2008: "RW_CRONIC_POF_2008",
  pof2017: "RW_CRONIC_POF_2017",
};

const LS_KEYS = {
  conc: "water_acute_conc",
  adulto: "water_acute_adulto",
  crianca: "water_acute_crianca",
  idaAnvisa: "water_acute_ida_anvisa_val",
  idaSyngenta: "water_acute_ida_syngenta_val"
};

"use strict";

function linhaWaterPreenchida(arr) {
  // Verifica se pelo menos um dos três campos principais foi preenchido
  return arr.slice(0, 3).some(val => val && val !== "-");
}

/* ================================
 * Config de endpoints e labels
 * ================================ */

const API_BASE = window.location.origin;

// Endpoint combinado (Acute + Chronic + POFs)
const REPORT_COMBINED_ENDPOINT = `${API_BASE}/report/gerar-pdf`;

// Endpoint de dados do crônico (fallback das POFs)
const CHRONIC_DADOS_ENDPOINT = `${API_BASE}/dados`;

// Labels visuais ↔ chaves internas das métricas
const LABELS = {
  buttons: { Ext: "IDA_EXTERNA", Int: "IDA_INTERNA" },
  metrics: { "%IDA_ANVISA": "%IDA_EXTERNA", "%IDA_SYNGENTA": "%IDA_INTERNA" }
};
const displayMetricLabel = (metricKey) => LABELS.metrics[metricKey] ?? metricKey;

/* ================================
 * Estado global básico
 * ================================ */

let drfaExterno = "-";
let drfaInterno = "-";

// Mapeia label exibida -> chave interna de métrica
function toBackendMetric(displayText) {
  const found = Object.entries(LABELS.metrics).find(([k, v]) => v === displayText);
  return found ? found[0] : displayText;
}

// Converte o snapshot salvo pela calculadora ("[{ metrica, valores: [...] }, ...]") em objeto POF
function pofFromSnapshotKey(lsKey) {
  const snap = safeJSON(localStorage.getItem(lsKey));
  if (!Array.isArray(snap) || snap.length === 0) return null;

  const regioes = ["Brasil", "Centro_Oeste", "Nordeste", "Norte", "Sudeste", "Sul"];
  const out = { PC_Kg: {}, "%IDA_ANVISA": {}, "%IDA_SYNGENTA": {} };

  for (const row of snap) {
    let m = row.metrica;
    // Se veio com label bonito (ex.: "IDA_EXTERNA" / "IDA_INTERNA"), converte para a chave interna
    m = toBackendMetric(m);
    if (!out[m]) continue;

    const valores = Array.isArray(row.valores) ? row.valores : [];
    for (let i = 0; i < regioes.length; i++) {
      const raw = (valores[i] ?? "").toString().replace("%", "").trim();
      const num = raw === "" || raw === "—" ? null : Number(raw);
      out[m][regioes[i]] = Number.isFinite(num) ? num : null;
    }
  }
  return out;
}

// Renderiza POF em <tbody id="tabela-pof-2008|2017">
function renderizarPOF(tbodyId, pof) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody || !pof) return;

  const regioes = ["Brasil", "Centro_Oeste", "Nordeste", "Norte", "Sudeste", "Sul"];
  const linhas = [
    { metrica: "PC_Kg", label: "PC_Kg" },
    { metrica: "%IDA_ANVISA", label: LABELS.metrics["%IDA_ANVISA"] ?? "%IDA_ANVISA" },   // "IDA_EXTERNA"
    { metrica: "%IDA_SYNGENTA", label: LABELS.metrics["%IDA_SYNGENTA"] ?? "%IDA_SYNGENTA" } // "IDA_INTERNA"
  ];

  tbody.innerHTML = "";

  linhas.forEach(({ metrica, label }) => {
    const tr = document.createElement("tr");
    tr.dataset.metrica = metrica;

    const tdTitulo = document.createElement("td");
    tdTitulo.textContent = label;
    tr.appendChild(tdTitulo);

    regioes.forEach((reg) => {
      const td = document.createElement("td");
      const val = pof?.[metrica]?.[reg];

      if (typeof val === "number" && Number.isFinite(val)) {
        // Para IDA_* mostramos com '%', para PC_Kg apenas número
        td.textContent = metrica === "PC_Kg" ? val.toFixed(4) : `${val.toFixed(4)}%`;
      } else {
        td.textContent = "—";
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}


async function refreshPOFsAndIDAs() {
  // ===== IDAs da CRÔNICA (aparecem na seção "Referências de IDA") =====
  const idaExterno = localStorage.getItem(LS_CRONIC.idaAnvisa) || "-";
  const idaInterno = localStorage.getItem(LS_CRONIC.idaSyngenta) || "-";
  const elIdaExt = document.getElementById("ida-externo");
  const elIdaInt = document.getElementById("ida-interno");
  if (elIdaExt) elIdaExt.textContent = idaExterno;
  if (elIdaInt) elIdaInt.textContent = idaInterno;

  // ===== DRFA da AGUDA (aparecem na seção "Referências de DRFA") =====
  const drfaExternoAcute = localStorage.getItem(LS_ACUTE.drfaExterno) || "-";
  const drfaInternoAcute = localStorage.getItem(LS_ACUTE.drfaInterno) || "-";
  const elDrfaExt = document.getElementById("drfa-externo");
  const elDrfaInt = document.getElementById("drfa-interno");
  if (elDrfaExt) elDrfaExt.textContent = drfaExternoAcute;
  if (elDrfaInt) elDrfaInt.textContent = drfaInternoAcute;

  // ===== POFs (prioriza snapshots salvos pela crônica, depois DOM, depois API) =====
  const snap2008Raw = localStorage.getItem(LS_CRONIC.pof2008);
  const snap2017Raw = localStorage.getItem(LS_CRONIC.pof2017);
  console.log("[REPORT] POF_2008 snapshot bruto:", snap2008Raw);
  console.log("[REPORT] POF_2017 snapshot bruto:", snap2017Raw);

  let p2008 = pofFromSnapshotKey(LS_CRONIC.pof2008);
  let p2017 = pofFromSnapshotKey(LS_CRONIC.pof2017);

  if (!p2008) p2008 = extractPofFromDom("tabela-pof-2008");
  if (!p2017) p2017 = extractPofFromDom("tabela-pof-2017");

  if (!p2008 || !p2017) {
    const { p08, p17 } = await fetchPofFromApi();
    p2008 = p2008 || p08;
    p2017 = p2017 || p17;
  }

  if (p2008) renderizarPOF("tabela-pof-2008", p2008);
  if (p2017) renderizarPOF("tabela-pof-2017", p2017);
}


document.addEventListener("DOMContentLoaded", () => {
  // 1) Carregar dados da memória (localStorage) e renderizar
  const dadosAcute = safeJSON(localStorage.getItem("DADOS_CALCULADORA")) || [];
  renderizarTabelaAcute(dadosAcute);

  // Lê diretamente do que a calculadora crônica salvou
  const dadosChronic = safeJSON(localStorage.getItem(LS_CRONIC.chronicData)) || [];

  renderizarTabelaChronic(dadosChronic);
  
  // Renderiza POFs na tela a partir do snapshot (com fallback DOM/API)
  
  
refreshPOFsAndIDAs();

// 🔄 Atualiza quando a aba voltar a ficar visível (ex.: usuário foi à calculadora e voltou)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshPOFsAndIDAs();
});

// 🔁 Atualiza quando outra aba/janela salvar no localStorage (ex.: calculadora aberta em outra aba)
window.addEventListener("storage", (e) => {
  const keys = [LS_CRONIC.pof2008, LS_CRONIC.pof2017, LS_CRONIC.idaAnvisa, LS_CRONIC.idaSyngenta];
  if (keys.includes(e.key)) {
    refreshPOFsAndIDAs();
  }
});

  // 3) Navegação
  bindNav("btn-home", "./index.html");
  bindNav("btn-calculator", "./calculatorHome.html");
  bindNav("btn-library", "./LibraryHome.html");

 

  // 4) Botões de exportação
  const btnExcel = document.querySelector(".btn-excel");
  if (btnExcel) {
    btnExcel.addEventListener("click", async () => {
      try {
        console.log("[Excel] clique detectado");
        await refreshPOFsAndIDAs();
        const pacoteBase = ensurePacoteDados(dadosAcute, dadosChronic);

        // Coleta POFs (DOM com fallback para API)
        const { pof2008, pof2017 } = await collectPOFs();
        await exportToExcelMulti({ ...pacoteBase, pof2008, pof2017 });
        await exportToExcelBackupAll({ ...pacoteBase, pof2008, pof2017 });
      } catch (err) {
        console.error("Falha ao exportar Excel:", err);
        alert("Falha ao exportar Excel. Veja o console para detalhes.");
      }
    });
  }

// === EXPORTAR WORD (via html-docx-js) ===
const btnWord = document.querySelector(".btn-word");
if (btnWord) {
  btnWord.addEventListener("click", async () => {
    try {
      console.log("[Word] clique detectado");

      // 0) Lib presente?
      if (!window.htmlDocx || !htmlDocx.asBlob) {
        console.error("[Word] html-docx-js não está carregado.");
        alert("Não foi possível gerar o Word: biblioteca 'html-docx-js' não carregada.");
        return;
      }

      // 1) Atualiza refs/POFs
      await refreshPOFsAndIDAs();

      // 2) Pacote base (dados das calculadoras e refs)
      const pacote = ensurePacoteDados(dadosAcute, dadosChronic);

      // 3) Filtragens (reuso da sua lógica atual)
      // Acute: manter apenas linhas com colunas editáveis preenchidas
      const acuteBase = linhasUsuarioPreencheu(pacote.acute || [], [
        "LMR (mg/kg)", "HR/MCR (mg/kg)", "MREC/STMR (mg/kg)"
      ]);
      const acutePreenchido = acuteBase.filter(row =>
        ["LMR (mg/kg)", "HR/MCR (mg/kg)", "MREC/STMR (mg/kg)"].some(k => {
          const v = row?.[k];
          return typeof v === "string" && v.trim() !== "" && v !== "-" && v.toLowerCase?.() !== "na";
        })
      );

      // Chronic: manter linhas editáveis e exporta se usuário definiu IDA
      const chronicPreenchido = linhasUsuarioPreencheu(pacote.chronic || [], [
        "LMR (mg_kg)", "LMR (mg/kg)",
        "MREC_STMR (mg_kg)", "MREC_STMR (mg/kg)"
      ]);
      const chronicUserSetExt = isNumberLike(localStorage.getItem(LS_CRONIC.idaAnvisa));
      const chronicUserSetInt = isNumberLike(localStorage.getItem(LS_CRONIC.idaSyngenta));
      const shouldExportChronic = (chronicUserSetExt || chronicUserSetInt) && chronicPreenchido.length > 0;

      // Water Acute
      const waterAcuteRow = [
        localStorage.getItem(LS_KEYS.conc)   || "-",
        localStorage.getItem(LS_KEYS.adulto) || "-",
        localStorage.getItem(LS_KEYS.crianca)|| "-",
        localStorage.getItem("outIntAdulto")  || "-",
        localStorage.getItem("outExtAdulto")  || "-",
        localStorage.getItem("outIntCrianca") || "-",
        localStorage.getItem("outExtCrianca") || "-"
      ];
      const temWaterAcute = (() => {
        const inputs  = waterAcuteRow.slice(0, 3);
        const outputs = waterAcuteRow.slice(3);
        const anyInputFilled = inputs.some(v => String(v ?? "").trim() !== "" && v !== "-");
        const anyOutputNumber = outputs.some(v => {
          const s = String(v ?? "").trim().replace("%", "").replace(",", ".");
          return Number.isFinite(Number(s));
        });
        return anyInputFilled || anyOutputNumber;
      })();

      // Water Chronic
      const waterChronicRow = [
        localStorage.getItem("CRONICO_conc")     || "-",
        localStorage.getItem("CRONICO_adulto")   || "-",
        localStorage.getItem("CRONICO_crianca")  || "-",
        localStorage.getItem("CRONICO_outIntAdulto")  || "-",
        localStorage.getItem("CRONICO_outExtAdulto")  || "-",
        localStorage.getItem("CRONICO_outIntCrianca") || "-",
        localStorage.getItem("CRONICO_outExtCrianca") || "-"
      ];
      const temWaterChronic = linhaWaterPreenchida(waterChronicRow);

      // México
      const mexicoData = linhasUsuarioPreencheu(
        JSON.parse(localStorage.getItem("RW_MEXICO_DATA") || "[]"),
        ["LMR (mg/kg)", "R (mg/kg)"]
      );
      const mexicoAdiRaw = localStorage.getItem("RW_MEXICO_ADI");
      const mexicoMeta   = safeJSON(localStorage.getItem("RW_MEXICO_META")) || {};
      const shouldExportMexico = isNumberLike(mexicoAdiRaw) || isNumberLike(mexicoMeta.adi_interno);

      // 4) POFs (pegamos agora para inserir no Word)
      const { pof2008, pof2017 } = await collectPOFs();

      // 5) Montagem do HTML do relatório
      const parts = [];
      parts.push(`<h1>RiskWise Report</h1>`);

      // Referências (opcional – mantém como no HTML da tela)
      const drfaExt = document.getElementById("drfa-externo")?.textContent?.trim() || "-";
      const drfaInt = document.getElementById("drfa-interno")?.textContent?.trim() || "-";
      parts.push(`
        <h2>Referências de DRFA</h2>
        <p><b>DRFA Externa:</b> ${esc(drfaExt)}&nbsp;&nbsp; <b>DRFA Interna:</b> ${esc(drfaInt)}</p>
      `);

      // Acute
      if (acutePreenchido.length) {
        parts.push(`<h2>Acute Diet</h2>`);
        parts.push(htmlTableAcute(acutePreenchido));
      }

      // Chronic + POFs
      if (shouldExportChronic) {
        const idaExt = localStorage.getItem(LS_CRONIC.idaAnvisa) || "-";
        const idaInt = localStorage.getItem(LS_CRONIC.idaSyngenta) || "-";
        parts.push(`<h2>Chronic Diet</h2>`);
        parts.push(`<p><b>IDA Externa:</b> ${esc(idaExt)}&nbsp;&nbsp; <b>IDA Interna:</b> ${esc(idaInt)}</p>`);
        parts.push(htmlTableChronic(chronicPreenchido));

        if (pof2008) {
          parts.push(`<h3>POF 2008</h3>`);
          parts.push(htmlTablePOF(pof2008));
        }
        if (pof2017) {
          parts.push(`<h3>POF 2017</h3>`);
          parts.push(htmlTablePOF(pof2017));
        }
      }

      // Water Acute
      if (temWaterAcute) {
        parts.push(`<h2>Water Acute</h2>`);
        parts.push(`<p><b>DRFA Externo:</b> ${esc(pacote.water_drfa_externo || "-")} &nbsp;&nbsp; <b>DRFA Interno:</b> ${esc(pacote.water_drfa_interno || "-")}</p>`);
        parts.push(htmlTableWaterAcute(waterAcuteRow));
      }

      // Water Chronic
      if (temWaterChronic) {
        const idaExtW = localStorage.getItem("CRONICO_IDA_ANVISA_VAL")   || "-";
        const idaIntW = localStorage.getItem("CRONICO_IDA_SYNGENTA_VAL") || "-";
        parts.push(`<h2>Water Chronic</h2>`);
        parts.push(`<p><b>IDA Externo:</b> ${esc(idaExtW)} &nbsp;&nbsp; <b>IDA Interno:</b> ${esc(idaIntW)}</p>`);
        parts.push(htmlTableWaterChronic(waterChronicRow));
      }

      // México
      if (shouldExportMexico) {
        parts.push(`<h2>Mexico Chronic</h2>`);
        parts.push(htmlTableMexico(mexicoData));
        parts.push('<br><br>'); // duas quebras de linha
        parts.push(htmlTableMexicoResultados({
          bw:         localStorage.getItem("RW_MEXICO_BW")          || "-",
          sum:        localStorage.getItem("RW_MEXICO_SUM")         || "-",
          adi:        localStorage.getItem("RW_MEXICO_ADI")         || "-",
          idmt:       localStorage.getItem("RW_MEXICO_IDMT")        || "-",
          percentAdi: localStorage.getItem("RW_MEXICO_PERCENT_ADI") || "-"
        }));
      }

      // Sem dados?
      const thereIsContent =
        acutePreenchido.length ||
        shouldExportChronic ||
        temWaterAcute ||
        temWaterChronic ||
        shouldExportMexico;

      if (!thereIsContent) {
        alert("Não há dados preenchidos em nenhuma calculadora para exportar.");
        return;
      }

      // 6) HTML completo + CSS mínimo inline (Word ignora CSS externo)
      const conteudo = wrapHtml(parts.join("\n"));

      // 7) Gera o .docx a partir do HTML
      const blob = window.htmlDocx.asBlob(conteudo, { orientation: "portrait" });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `riskwise_report_${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("Erro ao gerar Word (html-docx-js):", err);
      alert("Falha ao gerar Word. Veja o console.");
    }
  });
}
// Funções auxiliares para criar tabelas
  function createTableAcute(dados) {
    const rows = [
      new docx.TableRow({
        children: [
          new docx.TableCell({ children: [new docx.Paragraph("Cultivo")] }),
          new docx.TableCell({ children: [new docx.Paragraph("ANO POF")] }),
          new docx.TableCell({ children: [new docx.Paragraph("Região")] }),
          new docx.TableCell({ children: [new docx.Paragraph("LMR")] }),
          new docx.TableCell({ children: [new docx.Paragraph("%DRFA ANVISA")] }),
          new docx.TableCell({ children: [new docx.Paragraph("%DRFA SYNGENTA")] }),
        ],
      }),
      ...dados.map(item =>
        new docx.TableRow({
          children: [
            new docx.TableCell({ children: [new docx.Paragraph(item["Cultivo/ Matriz Animal"] || "-")] }),
            new docx.TableCell({ children: [new docx.Paragraph(item["ANO POF"] || "-")] }),
            new docx.TableCell({ children: [new docx.Paragraph(item["Região"] || "-")] }),
            new docx.TableCell({ children: [new docx.Paragraph(item["LMR (mg/kg)"] || "-")] }),
            new docx.TableCell({ children: [new docx.Paragraph(item["%DRFA ANVISA"] || "-")] }),
            new docx.TableCell({ children: [new docx.Paragraph(item["%DRFA SYNGENTA"] || "-")] }),
          ],
        })
      ),
    ];
    return new docx.Table({ rows });
  }

  function createTableChronic(dados) {
    const rows = [
      new docx.TableRow({
        children: [
          new docx.TableCell({ children: [new docx.Paragraph("Cultivo")] }),
          new docx.TableCell({ children: [new docx.Paragraph("ANO POF")] }),
          new docx.TableCell({ children: [new docx.Paragraph("Região")] }),
          new docx.TableCell({ children: [new docx.Paragraph("LMR")] }),
          new docx.TableCell({ children: [new docx.Paragraph("Market Share")] }),
        ],
      }),
      ...dados.map(item =>
        new docx.TableRow({
          children: [
            new docx.TableCell({ children: [new docx.Paragraph(item["Cultivo"] || "-")] }),
            new docx.TableCell({ children: [new docx.Paragraph(item["ANO_POF"] || "-")] }),
            new docx.TableCell({ children: [new docx.Paragraph(item["Região"] || "-")] }),
            new docx.TableCell({ children: [new docx.Paragraph(item["LMR (mg/kg)"] || "-")] }),
            new docx.TableCell({ children: [new docx.Paragraph(item["Market Share (%)"] || "-")] }),
          ],
        })
      ),
    ];
    return new docx.Table({ rows });
  }

  function createTablePOF(pof) {
    if (!pof) return new docx.Paragraph("Nenhum dado disponível");
    const regioes = ["Brasil", "Centro-Oeste", "Nordeste", "Norte", "Sudeste", "Sul"];
    const rows = [
      new docx.TableRow({
        children: [new docx.TableCell({ children: [new docx.Paragraph("Métrica")] }),
          ...regioes.map(r => new docx.TableCell({ children: [new docx.Paragraph(r)] }))
        ],
      }),
      ...["PC_Kg", "%IDA_ANVISA", "%IDA_SYNGENTA"].map(metrica =>
        new docx.TableRow({
          children: [
            new docx.TableCell({ children: [new docx.Paragraph(metrica)] }),
            ...regioes.map(r => new docx.TableCell({ children: [new docx.Paragraph(String(pof[metrica]?.[r] ?? "-"))] }))
          ],
        })
      ),
    ];
    return new docx.Table({ rows });
  }

// ===== Helpers para geração de HTML =====
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapHtml(inner) {
  // CSS mínimo inline para o Word
  const css = `
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; }
  h1 { font-size: 20pt; margin: 0 0 14px; }
  h2 { font-size: 16pt; margin: 18px 0 8px; }
  h3 { font-size: 13pt; margin: 14px 0 6px; }
  p { margin: 6px 0; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 16px; table-layout: fixed; }
  th, td { border: 1px solid #333; padding: 6px; vertical-align: top; word-wrap: break-word; }
  th { background: #f2f2f2; font-weight: bold; }
  small { color: #444; }
  `;
  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <style>${css}</style>
    </head>
    <body>
      ${inner}
    </body>
  </html>`;
}

// --- Tabelas em HTML --- //
function htmlTableAcute(dados) {
  const head = `
    <tr>
      <th>Cultivo</th><th>ANO POF</th><th>Região</th><th>Caso Fórmula</th>
      <th>LMR (mg/kg)</th><th>HR/MCR (mg/kg)</th><th>MREC/STMR (mg/kg)</th>
      <th>IMEA (mg/kg p.c./dia)</th><th>%DRFA ANVISA</th><th>%DRFA SYNGENTA</th>
    </tr>`;
  const rows = dados.map(item => `
    <tr>
      <td>${esc(item["Cultivo/ Matriz Animal"] || "-")}</td>
      <td>${esc(item["ANO POF"] || "-")}</td>
      <td>${esc(item["Região"] || "-")}</td>
      <td>${esc(item["Caso Fórmula"] || "-")}</td>
      <td>${esc(item["LMR (mg/kg)"] || "-")}</td>
      <td>${esc(item["HR/MCR (mg/kg)"] || "-")}</td>
      <td>${esc(item["MREC/STMR (mg/kg)"] || "-")}</td>
      <td>${esc(item["IMEA (mg/kg p.c./dia)"] || "-")}</td>
      <td>${esc(item["%DRFA ANVISA"] || "-")}</td>
      <td>${esc(item["%DRFA SYNGENTA"] || "-")}</td>
    </tr>`).join("");
  return `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

function htmlTableChronic(dados) {
  const head = `
    <tr>
      <th>Cultivo</th><th>ANO_POF</th><th>Região</th>
      <th>LMR (mg/kg)</th><th>MREC_STMR (mg/kg)</th>
      <th>Market Share (%)</th><th>IDMT (%)</th>
      <th>Contribuição Individual do Cultivo (%)</th>
    </tr>`;
  const rows = dados.map(item => `
    <tr>
      <td>${esc(item["Cultivo"] || "-")}</td>
      <td>${esc(item["ANO_POF"] || "-")}</td>
      <td>${esc(item["Região"] || "-")}</td>
      <td>${esc(item["LMR (mg_kg)"] ?? item["LMR (mg/kg)"] ?? "-")}</td>
      <td>${esc(item["MREC_STMR (mg_kg)"] ?? item["MREC_STMR (mg/kg)"] ?? "-")}</td>
      <td>${esc(item["Market Share (%)"] ?? item["Market Share"] ?? "-")}</td>
      <td>${esc(item["IDMT (%)"] ?? item["IDMT (Numerador)"] ?? "-")}</td>
      <td>${esc(item["Contribuição Individual do Cultivo (%)"] ?? item["Contribuição Individual do Cultivo"] ?? "-")}</td>
    </tr>`).join("");
  return `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

function htmlTablePOF(pof) {
  if (!pof) return `<p><small>Nenhum dado disponível</small></p>`;
  const regioesHeader = ["Brasil", "Centro-Oeste", "Nordeste", "Norte", "Sudeste", "Sul"];
  // tenta "_" e "-" para Centro-Oeste
  const get = (obj, key) => {
    if (key === "Centro-Oeste") return obj?.["Centro_Oeste"] ?? obj?.["Centro-Oeste"] ?? "-";
    return obj?.[key] ?? "-";
  };

  const linhas = [
    { label: "PC_Kg", key: "PC_Kg", isPercent: false },
    { label: "IDA_EXTERNA", key: "%IDA_ANVISA", isPercent: true },
    { label: "IDA_INTERNA", key: "%IDA_SYNGENTA", isPercent: true },
  ];

  const head = `<tr><th>Métrica</th>${regioesHeader.map(r => `<th>${r}</th>`).join("")}</tr>`;
  const body = linhas.map(l => `
    <tr>
      <td>${l.label}</td>
      ${regioesHeader.map(r => {
        const v = get(pof[l.key] || {}, r);
        if (v === "-" || v === null) return `<td>-</td>`;
        const num = Number(v);
        const txt = Number.isFinite(num) ? (l.isPercent ? `${num.toFixed(4)}%` : num.toFixed(4)) : esc(v);
        return `<td>${txt}</td>`;
      }).join("")}
    </tr>
  `).join("");

  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function htmlTableWaterAcute(row) {
  const head = `
    <tr>
      <th>Concentração</th><th>Adulto (kg)</th><th>Criança (kg)</th>
      <th>%DRFA Interno Adulto</th><th>%DRFA Externo Adulto</th>
      <th>%DRFA Interno Criança</th><th>%DRFA Externo Criança</th>
    </tr>`;
  const r = row.map(v => esc(v ?? "-"));
  const body = `<tr>${r.map(v => `<td>${v}</td>`).join("")}</tr>`;
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function htmlTableWaterChronic(row) {
  const head = `
    <tr>
      <th>Concentração</th><th>Adulto (kg)</th><th>Criança (kg)</th>
      <th>%IDA Interno Adulto</th><th>%IDA Externo Adulto</th>
      <th>%IDA Interno Criança</th><th>%IDA Externo Criança</th>
    </tr>`;
  const r = row.map(v => esc(v ?? "-"));
  const body = `<tr>${r.map(v => `<td>${v}</td>`).join("")}</tr>`;
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function htmlTableMexico(data) {
  const head = `
    <tr>
      <th>Crop</th><th>Cultivo</th><th>LMR (mg/kg)</th>
      <th>R (mg/kg)</th><th>C (Kg/person/day)</th>
      <th>(LMR or R)*C</th>
    </tr>`;
  const body = (data || []).map(item => `
    <tr>
      <td>${esc(item["Crop"] || "-")}</td>
      <td>${esc(item["Cultivo"] || "-")}</td>
      <td>${esc(item["LMR (mg/kg)"] || "-")}</td>
      <td>${esc(item["R (mg/kg)"] || "-")}</td>
      <td>${esc(item["C (Kg/person/day)"] || "-")}</td>
      <td>${esc(item["(LMR or R)*C"] || "-")}</td>
    </tr>
  `).join("");
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function htmlTableMexicoResultados(res) {
  const head = `<tr><th>BW (kg)</th><th>Sum</th><th>ADI (mg/kg bw/dia)</th><th>IDMT</th><th>%ADI</th></tr>`;
  const vals = [res.bw, res.sum, res.adi, res.idmt, res.percentAdi].map(v => esc(v ?? "-"));
  const body = `<tr>${vals.map(v => `<td>${v}</td>`).join("")}</tr>`;
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

  const btnPdf = document.querySelector(".btn-pdf");
  if (btnPdf) {
    btnPdf.addEventListener("click", async () => {
      try {
        console.log("[PDF] clique detectado");
        const pacoteBase = ensurePacoteDados(dadosAcute, dadosChronic);

        // Coleta POFs (DOM com fallback para API)
        const { pof2008, pof2017 } = await collectPOFs();
        await exportPdfCombinedFromBackend({ ...pacoteBase, pof2008, pof2017 });
      } catch (err) {
        console.error("Falha ao exportar PDF:", err);
        alert("Falha ao exportar PDF. Veja o console para detalhes.");
      }
    });
  }
  renderizarReferenciasWaterAcute();
  renderizarTabelaWaterAcute();
  renderizarReferenciasWaterChronic();
  renderizarTabelaWaterChronic();
  renderizarTabelaMexico();
  renderizarResultadosMexico();

});

/* ================================
 * Helpers gerais
 * ================================ */

function safeJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

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


function ensurePacoteDados(dadosAcuteLS, dadosChronicLS) {
  // Garantir Acute
  const acute = Array.isArray(dadosAcuteLS) && dadosAcuteLS.length > 0
    ? dadosAcuteLS
    : extractAcuteFromTable();

  // Garantir Chronic
  const chronic = Array.isArray(dadosChronicLS) && dadosChronicLS.length > 0
    ? dadosChronicLS
    : extractChronicFromTable();

  // 🔒 Separe as origens para não “vazar” valores entre calculadoras
  const acute_drfa_externo   = localStorage.getItem(LS_ACUTE.drfaExterno) || "-";
  const acute_drfa_interno   = localStorage.getItem(LS_ACUTE.drfaInterno) || "-";
  const chronic_ida_externo  = localStorage.getItem(LS_CRONIC.idaAnvisa) || "-";
  const chronic_ida_interno  = localStorage.getItem(LS_CRONIC.idaSyngenta) || "-";

  // Water Acute refs
  const water_drfa_externo = localStorage.getItem(LS_KEYS.idaAnvisa) || "-";
  const water_drfa_interno = localStorage.getItem(LS_KEYS.idaSyngenta) || "-";

  // ❌ REMOVIDO: não lançar erro aqui. Deixe a função de export decidir se há algo a exportar.
  return {
    acute, chronic,
    acute_drfa_externo, acute_drfa_interno,
    chronic_ida_externo, chronic_ida_interno,
    water_drfa_externo, water_drfa_interno,
  };
}

/* ================================
 * Renderizações na tela
 * ================================ */

function renderizarTabelaAcute(dados) {
  const tbody = document.getElementById("report-acute-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!dados || !dados.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="no-data">Nenhum dado disponível</td></tr>`;
    return;
  }

  dados.forEach((item) => {
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

function renderizarTabelaChronic(dados) {
  const tbody = document.getElementById("report-chronic-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!dados || !dados.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="no-data">Nenhum dado disponível</td></tr>`;
    return;
  }

  dados.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item["Cultivo"] || "-"}</td>
      <td>${item["ANO_POF"] || "-"}</td>
      <td>${item["Região"] || "-"}</td>
      <td>${item["LMR (mg_kg)"] ?? item["LMR (mg/kg)"] ?? "-"}</td>
      <td>${item["MREC_STMR (mg_kg)"] ?? item["MREC_STMR (mg/kg)"] ?? "-"}</td>
      <td>${item["Market Share (%)"] ?? item["Market Share"] ?? "-"}</td>
      <td>${item["IDMT (%)"] ?? item["IDMT (Numerador)"] ?? "-"}</td>
      <td>${item["Contribuição Individual do Cultivo (%)"] ?? item["Contribuição Individual do Cultivo"] ?? "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ================================
 * Extrações do DOM (fallback)
 * ================================ */

function extractAcuteFromTable() {
  const rows = Array.from(document.querySelectorAll("#report-acute-body tr"));
  const itens = [];

  rows.forEach((r) => {
    const tds = r.querySelectorAll("td");
    if (!tds || tds.length < 10) return; // ignora linha "Nenhum dado"
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

function extractChronicFromTable() {
  const rows = Array.from(document.querySelectorAll("#report-chronic-body tr"));
  const itens = [];

  rows.forEach((r) => {
    const tds = r.querySelectorAll("td");
    if (!tds || tds.length < 8) return; // ignora linha "Nenhum dado"
    itens.push({
      "Cultivo": tds[0]?.innerText?.trim(),
      "ANO_POF": tds[1]?.innerText?.trim(),
      "Região": tds[2]?.innerText?.trim(),
      "LMR (mg/kg)": tds[3]?.innerText?.trim(),
      "MREC_STMR (mg/kg)": tds[4]?.innerText?.trim(),
      "Market Share (%)": tds[5]?.innerText?.trim(),
      "IDMT (%)": tds[6]?.innerText?.trim(),
      "Contribuição Individual do Cultivo (%)": tds[7]?.innerText?.trim(),
    });
  });

  return itens;
}

/* ================================
 * POFs: DOM → fallback API
 * ================================ */

function normalizeRegiaoKey(k) {
  if (!k) return k;
  return k === "Centro_Oeste" ? "Centro-Oeste" : k;
}

function extractPofFromDom(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return null;

  // Estrutura esperada: linhas com data-metrica = "PC_Kg" | "%IDA_ANVISA" | "%IDA_SYNGENTA"
  const out = { PC_Kg: {}, "%IDA_ANVISA": {}, "%IDA_SYNGENTA": {} };
  const regioes = ["Brasil", "Centro_Oeste", "Nordeste", "Norte", "Sudeste", "Sul"];

  tbody.querySelectorAll("tr").forEach(tr => {
    const headCell = tr.children?.[0];
    if (!headCell) return;

    // Pode vir como label bonito (IDA_EXTERNA / IDA_INTERNA) ou chave interna
    const display = headCell.textContent?.trim();
    const metricKey = Object.entries(LABELS.metrics).find(([, v]) => v === display)?.[0]
                    || display;

    if (!["PC_Kg", "%IDA_ANVISA", "%IDA_SYNGENTA"].includes(metricKey)) return;

    // Preenche colunas de regiões (índices 1..6)
    regioes.forEach((regiao, i) => {
      const td = tr.children?.[i + 1];
      if (!td) return;
      const raw = (td.textContent || "").replace("%","").trim();
      const val = raw === "—" || raw === "" ? null : Number(raw);
      out[metricKey][regiao] = Number.isFinite(val) ? val : null;
    });
  });

  return out;
}

async function fetchPofFromApi() {
  try {
    const r = await fetch(CHRONIC_DADOS_ENDPOINT);
    if (!r.ok) throw new Error(r.statusText);
    const data = await r.json();
    const p08 = data.POF_2008 || null;
    const p17 = data.POF_2017 || null;
    return { p08, p17 };
  } catch (e) {
    console.warn("[POF] Fallback API falhou:", e);
    return { p08: null, p17: null };
  }
}

async function collectPOFs() {
  // 1) Primeiro tenta dos snapshots do localStorage (salvos pela calculadora)
  let pof2008 = pofFromSnapshotKey(LS_CRONIC.pof2008);
  let pof2017 = pofFromSnapshotKey(LS_CRONIC.pof2017);

  // 2) Depois tenta do DOM, se o HTML já tiver as tabelas renderizadas
  if (!pof2008) pof2008 = extractPofFromDom("tabela-pof-2008");
  if (!pof2017) pof2017 = extractPofFromDom("tabela-pof-2017");

  // 3) Por fim, tenta a API
  if (!pof2008 || !pof2017) {
    const { p08, p17 } = await fetchPofFromApi();
    pof2008 = pof2008 || p08;
    pof2017 = pof2017 || p17;
  }

  return { pof2008, pof2017 };
}

/* ================================
 * EXCEL (multi-aba)
 * ================================ */

// --- Helpers para detectar "preenchimento real"
function isNumberLike(val) {
  if (val === null || val === undefined) return false;
  const s = String(val).trim();
  if (s === "" || s === "-") return false;
  const n = Number(s);
  return Number.isFinite(n);
}

// (Opcional, mas recomendado) — considerar "0" e "0.0" como preenchidos:
function isValorPreenchido(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === "string" && val.trim() === "") return false;
  if (val === "-") return false;
  return true; // 0 e "0" contam como preenchidos
}
function linhasPreenchidas(dados) {
  return (dados || []).filter(row =>
    Object.values(row).some(isValorPreenchido)
  );
}

function linhasUsuarioPreencheu(dados, camposEditaveis) {
  return (dados || []).filter(row =>
    camposEditaveis.some(campo => {
      const val = String(row?.[campo] ?? "").trim();
      return val !== "" && val !== "-" && val.toLowerCase() !== "na";
    })
  );
}

async function exportToExcelMulti(pacote) {
  const {
    acute, chronic, pof2008, pof2017,
    acute_drfa_externo, acute_drfa_interno,
    chronic_ida_externo, chronic_ida_interno,
    water_drfa_externo, water_drfa_interno
  } = pacote;

  const wb = XLSX.utils.book_new();

  // ----- Filtra linhas preenchidas (evita abas vazias)
  // Exportar apenas o que o usuário preencheu nas colunas editáveis
// 1) Primeiro aplica o filtro “não vazio”
const acuteBase = linhasUsuarioPreencheu(acute, [
  "LMR (mg/kg)", "HR/MCR (mg/kg)", "MREC/STMR (mg/kg)"
]);

// 2) Depois, reforça: mantém só quem tem algum desses campos como STRING (indício de digitação)
const acutePreenchido = acuteBase.filter(row =>
  ["LMR (mg/kg)", "HR/MCR (mg/kg)", "MREC/STMR (mg/kg)"].some(k => {
    const v = row?.[k];
    return typeof v === "string" && v.trim() !== "" && v !== "-";
  })
);

const chronicPreenchido = linhasUsuarioPreencheu(chronic, [
  "LMR (mg_kg)", "LMR (mg/kg)",
  "MREC_STMR (mg_kg)", "MREC_STMR (mg/kg)",
]);

// ====== NOVO: flags de interação do usuário ======
  // CHRONIC → se o usuário preencheu IDA_EXTERNA ou IDA_INTERNA (independentes)
  const chronicUserSetExt = isNumberLike(localStorage.getItem(LS_CRONIC.idaAnvisa));   // "RW_CRONIC_IDA_ANVISA"
  const chronicUserSetInt = isNumberLike(localStorage.getItem(LS_CRONIC.idaSyngenta)); // "RW_CRONIC_IDA_SYNGENTA"
  const shouldExportChronic = (chronicUserSetExt || chronicUserSetInt);

  // MÉXICO → se o usuário preencheu ADI (aceita tanto o atalho RW_MEXICO_ADI quanto o META)
  const mexicoAdiRaw = localStorage.getItem("RW_MEXICO_ADI");
  const mexicoMeta   = safeJSON(localStorage.getItem("RW_MEXICO_META")) || {};
  const shouldExportMexico = isNumberLike(mexicoAdiRaw) || isNumberLike(mexicoMeta.adi_interno);

  // ---------- Acute (só se tiver linha preenchida)
  if (acutePreenchido.length > 0) {
    const cabecalhoAcute = [
      "Cultivo", "ANO POF", "Região", "Caso Fórmula", "LMR",
      "HR/MCR", "MREC/STMR", "IMEA", "%DRFA Externo", "%DRFA Interno"
    ];
    const keyMapAcute = {
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
    const getValA = (row, col) => {
      const keys = keyMapAcute[col] || [col];
      for (const k of keys) if (row[k] !== undefined && row[k] !== null) return row[k];
      return "";
    };

    const aoaAcute = [
      ["DRFA Externo", acute_drfa_externo],
      ["DRFA Interno", acute_drfa_interno],
      [],
      cabecalhoAcute,
      ...acutePreenchido.map(item => cabecalhoAcute.map(col => getValA(item, col))),
    ];

    const wsA = XLSX.utils.aoa_to_sheet(aoaAcute);
    autoWidth(wsA, cabecalhoAcute, (row, col) => getValA(row, col), acutePreenchido);
    XLSX.utils.book_append_sheet(wb, wsA, "Acute Diet");
  }

  // ---------- Chronic (só se tiver linha preenchida)
  if (shouldExportChronic) {
    const cabecalhoChronic = [
      "Cultivo", "ANO_POF", "Região",
      "LMR (mg/kg)", "MREC_STMR (mg/kg)",
      "Market Share (%)", "IDMT (%)", "Contribuição Individual do Cultivo (%)"
    ];
    const keyMapC = {
      "Cultivo": ["Cultivo"],
      "ANO_POF": ["ANO_POF"],
      "Região": ["Região"],
      "LMR (mg/kg)": ["LMR (mg_kg)", "LMR (mg/kg)"],
      "MREC_STMR (mg/kg)": ["MREC_STMR (mg_kg)", "MREC_STMR (mg/kg)"],
      "Market Share (%)": ["Market Share (%)", "Market Share"],
      "IDMT (%)": ["IDMT (%)", "IDMT (Numerador)"],
      "Contribuição Individual do Cultivo (%)": ["Contribuição Individual do Cultivo (%)", "Contribuição Individual do Cultivo"],
    };
    const getValC = (row, col) => {
      const keys = keyMapC[col] || [col];
      for (const k of keys) if (row[k] !== undefined && row[k] !== null) return row[k];
      return "";
    };

    const mIDA_EXT = displayMetricLabel("%IDA_ANVISA");   // "IDA_EXTERNA"
    const mIDA_INT = displayMetricLabel("%IDA_SYNGENTA"); // "IDA_INTERNA"

    const regioesHeader = ["Métrica", "Brasil", "Centro-Oeste", "Nordeste", "Norte", "Sudeste", "Sul"];

    const aoaChronic = [
      ["IDA (Externo)", chronic_ida_externo],
      ["IDA (Interno)", chronic_ida_interno],
      [],
      ["Chronic DRA Calculator"],
      cabecalhoChronic,
      ...chronicPreenchido.map(item => cabecalhoChronic.map(col => getValC(item, col))),
      [],
    ];

    // POF 2008
    if (pof2008) {
      aoaChronic.push(
        ["POF 2008"],
        regioesHeader,
        ["PC (Kg)",
          pof2008.PC_Kg?.Brasil ?? 0,
          (pof2008.PC_Kg?.["Centro_Oeste"] ?? pof2008.PC_Kg?.["Centro-Oeste"]) ?? 0,
          pof2008.PC_Kg?.Nordeste ?? 0,
          pof2008.PC_Kg?.Norte ?? 0,
          pof2008.PC_Kg?.Sudeste ?? 0,
          pof2008.PC_Kg?.Sul ?? 0
        ],
        [mIDA_EXT,
          pof2008["%IDA_ANVISA"]?.Brasil ?? 0,
          (pof2008["%IDA_ANVISA"]?.["Centro_Oeste"] ?? pof2008["%IDA_ANVISA"]?.["Centro-Oeste"]) ?? 0,
          pof2008["%IDA_ANVISA"]?.Nordeste ?? 0,
          pof2008["%IDA_ANVISA"]?.Norte ?? 0,
          pof2008["%IDA_ANVISA"]?.Sudeste ?? 0,
          pof2008["%IDA_ANVISA"]?.Sul ?? 0
        ],
        [mIDA_INT,
          pof2008["%IDA_SYNGENTA"]?.Brasil ?? 0,
          (pof2008["%IDA_SYNGENTA"]?.["Centro_Oeste"] ?? pof2008["%IDA_SYNGENTA"]?.["Centro-Oeste"]) ?? 0,
          pof2008["%IDA_SYNGENTA"]?.Nordeste ?? 0,
          pof2008["%IDA_SYNGENTA"]?.Norte ?? 0,
          pof2008["%IDA_SYNGENTA"]?.Sudeste ?? 0,
          pof2008["%IDA_SYNGENTA"]?.Sul ?? 0
        ],
        []
      );
    }

    // POF 2017
    if (pof2017) {
      aoaChronic.push(
        ["POF 2017"],
        regioesHeader,
        ["PC (Kg)",
          pof2017.PC_Kg?.Brasil ?? 0,
          (pof2017.PC_Kg?.["Centro_Oeste"] ?? pof2017.PC_Kg?.["Centro-Oeste"]) ?? 0,
          pof2017.PC_Kg?.Nordeste ?? 0,
          pof2017.PC_Kg?.Norte ?? 0,
          pof2017.PC_Kg?.Sudeste ?? 0,
          pof2017.PC_Kg?.Sul ?? 0
        ],
        [mIDA_EXT,
          pof2017["%IDA_ANVISA"]?.Brasil ?? 0,
          (pof2017["%IDA_ANVISA"]?.["Centro_Oeste"] ?? pof2017["%IDA_ANVISA"]?.["Centro-Oeste"]) ?? 0,
          pof2017["%IDA_ANVISA"]?.Nordeste ?? 0,
          pof2017["%IDA_ANVISA"]?.Norte ?? 0,
          pof2017["%IDA_ANVISA"]?.Sudeste ?? 0,
          pof2017["%IDA_ANVISA"]?.Sul ?? 0
        ],
        [mIDA_INT,
          pof2017["%IDA_SYNGENTA"]?.Brasil ?? 0,
          (pof2017["%IDA_SYNGENTA"]?.["Centro_Oeste"] ?? pof2017["%IDA_SYNGENTA"]?.["Centro-Oeste"]) ?? 0,
          pof2017["%IDA_SYNGENTA"]?.Nordeste ?? 0,
          pof2017["%IDA_SYNGENTA"]?.Norte ?? 0,
          pof2017["%IDA_SYNGENTA"]?.Sudeste ?? 0,
          pof2017["%IDA_SYNGENTA"]?.Sul ?? 0
        ]
      );
    }

    const wsC = XLSX.utils.aoa_to_sheet(aoaChronic);
    autoWidth(wsC, cabecalhoChronic, (row, col) => getValC(row, col), chronicPreenchido);
    XLSX.utils.book_append_sheet(wb, wsC, "Chronic Diet");
  }

  // ---------- Water Acute
  // ---------- Water Acute
const waterAcuteRow = [
  localStorage.getItem(LS_KEYS.conc)   || "-",
  localStorage.getItem(LS_KEYS.adulto) || "-",
  localStorage.getItem(LS_KEYS.crianca)|| "-",
  localStorage.getItem("outIntAdulto") || "-",
  localStorage.getItem("outExtAdulto") || "-",
  localStorage.getItem("outIntCrianca") || "-",
  localStorage.getItem("outExtCrianca") || "-"
];

// ✅ Novo gate: exporta se (inputs preenchidos) OU (algum output numérico)
const temWaterAcute = (() => {
  const inputs  = waterAcuteRow.slice(0, 3); // conc, adulto, crianca
  const outputs = waterAcuteRow.slice(3);    // %DRFA...

  const anyInputFilled = inputs.some(v => {
    const s = String(v ?? "").trim();
    return s !== "" && s !== "-";
  });

  // Aceita "12.3%", "12,3%", " 7 % " etc.
  const anyOutputNumber = outputs.some(v => {
    const s = String(v ?? "").trim().replace("%", "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n);
  });

  return anyInputFilled || anyOutputNumber;
})();

if (temWaterAcute) {
  const aoaWaterAcute = [
    ["Water Acute Calculator"],
    ["DRFA Externo", water_drfa_externo],
    ["DRFA Interno", water_drfa_interno],
    [],
    ["Concentração", "Adulto (kg)", "Criança (kg)",
      "%DRFA Interno Adulto", "%DRFA Externo Adulto",
      "%DRFA Interno Criança", "%DRFA Externo Criança"],
    waterAcuteRow
  ];
  const wsWater = XLSX.utils.aoa_to_sheet(aoaWaterAcute);
  XLSX.utils.book_append_sheet(wb, wsWater, "Water Acute");
}

  // ---------- Water Chronic
  const waterChronicIdaExterno = localStorage.getItem("CRONICO_IDA_ANVISA_VAL")   || "-";
  const waterChronicIdaInterno = localStorage.getItem("CRONICO_IDA_SYNGENTA_VAL") || "-";

  const waterChronicRow = [
    localStorage.getItem("CRONICO_conc")     || "-",
    localStorage.getItem("CRONICO_adulto")   || "-",
    localStorage.getItem("CRONICO_crianca")  || "-",
    localStorage.getItem("CRONICO_outIntAdulto")  || "-",
    localStorage.getItem("CRONICO_outExtAdulto")  || "-",
    localStorage.getItem("CRONICO_outIntCrianca") || "-",
    localStorage.getItem("CRONICO_outExtCrianca") || "-"
  ];
  const temWaterChronic = linhaWaterPreenchida(waterChronicRow);

  if (temWaterChronic) {
    const aoaWaterChronic = [
      ["Water Chronic Calculator"],
      ["IDA Externo", waterChronicIdaExterno],
      ["IDA Interno", waterChronicIdaInterno],
      [],
      ["Concentração", "Adulto (kg)", "Criança (kg)",
        "%IDA Interno Adulto", "%IDA Externo Adulto",
        "%IDA Interno Criança", "%IDA Externo Criança"],
      waterChronicRow
    ];
    const wsWaterChronic = XLSX.utils.aoa_to_sheet(aoaWaterChronic);
    XLSX.utils.book_append_sheet(wb, wsWaterChronic, "Water Chronic");
  }

  // ---------- Mexico Chronic
  const mexicoData = linhasUsuarioPreencheu(
  JSON.parse(localStorage.getItem("RW_MEXICO_DATA") || "[]"),
  ["LMR (mg/kg)", "R (mg/kg)"]
);
  
  if (shouldExportMexico) {
    const mexicoResults = {
      bw: localStorage.getItem("RW_MEXICO_BW") || "-",
      sum: localStorage.getItem("RW_MEXICO_SUM") || "-",
      adi: localStorage.getItem("RW_MEXICO_ADI") || "-",
      idmt: localStorage.getItem("RW_MEXICO_IDMT") || "-",
      percentAdi: localStorage.getItem("RW_MEXICO_PERCENT_ADI") || "-"
    };

    const cabecalhoMexico = [
      "Crop", "Cultivo", "LMR (mg/kg)", "R (mg/kg)", "C (Kg/person/day)", "(LMR or R)*C"
    ];
    const aoaMexico = [
      cabecalhoMexico,
      ...mexicoData.map(item => [
        item["Crop"] || "-",
        item["Cultivo"] || "-",
        item["LMR (mg/kg)"] || "-",
        item["R (mg/kg)"] || "-",
        item["C (Kg/person/day)"] || "-",
        item["(LMR or R)*C"] || "-"
      ]),
      [],
      ["BW (kg)", "Sum", "ADI (mg/kg bw/dia)", "IDMT", "%ADI"],
      [
        mexicoResults.bw,
        mexicoResults.sum,
        mexicoResults.adi,
        mexicoResults.idmt,
        mexicoResults.percentAdi
      ]
    ];
    const wsMexico = XLSX.utils.aoa_to_sheet(aoaMexico);
    XLSX.utils.book_append_sheet(wb, wsMexico, "Mexico Chronic");
  }

  // ---------- Nome do arquivo refletindo as abas presentes
  const nameParts = [];
  if (acutePreenchido.length) nameParts.push("acute_crop");
  if (shouldExportChronic) nameParts.push("chronic_crop");
  if (temWaterAcute) nameParts.push("acute_water");
  if (temWaterChronic) nameParts.push("chronic_water");
  if (shouldExportMexico) nameParts.push("mexico");

  if (nameParts.length === 0) {
    alert("Não há dados preenchidos em nenhuma calculadora para exportar.");
    return;
  }

  const fname = `riskwise_${nameParts.join("_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}


function autoWidth(ws, headerCols, getter, dataRows) {
  ws["!cols"] = headerCols.map((col) => {
    const maxLength = Math.max(
      String(col).length,
      ...dataRows.map((row) => String(getter(row, col) ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 12), 40) };
  });
}

/* ================================
 * PDF via backend (combinado)
 * ================================ */

async function exportPdfCombinedFromBackend(pacote) {
  // 1) Base “não vazio”
  const acuteBase = linhasUsuarioPreencheu(pacote.acute || [], [
    "LMR (mg/kg)", "HR/MCR (mg/kg)", "MREC/STMR (mg/kg)"
  ]);

  // 2) Reforço: só mantém quem tem pelo menos 1 campo editável como STRING
  const acutePreenchido = acuteBase.filter(row =>
    ["LMR (mg/kg)", "HR/MCR (mg/kg)", "MREC/STMR (mg/kg)"].some(k => {
      const v = row?.[k];
      return typeof v === "string" && v.trim() !== "" && v !== "-" && v.toLowerCase?.() !== "na";
    })
  );

  // Chronic: mantém sua lógica atual
  const chronicPreenchido = linhasUsuarioPreencheu(pacote.chronic || [], [
    "LMR (mg_kg)", "LMR (mg/kg)",
    "MREC_STMR (mg_kg)", "MREC_STMR (mg/kg)",
  ]);

  // … (sua lógica de temWaterAcute/temWaterChronic como já está)
  const temWaterAcute = (() => {
    const inputs = [
      localStorage.getItem(LS_KEYS.conc),
      localStorage.getItem(LS_KEYS.adulto),
      localStorage.getItem(LS_KEYS.crianca)
    ];
    return inputs.some(v => v && v !== "-");
  })();

  const temWaterChronic = (() => {
    const inputs = [
      localStorage.getItem("CRONICO_conc"),
      localStorage.getItem("CRONICO_adulto"),
      localStorage.getItem("CRONICO_crianca")
    ];
    return inputs.some(v => v && v !== "-");
  })();

  const payload = {
    // ⬅️ Envie já filtrado
    acute: acutePreenchido,
    chronic: chronicPreenchido,
    // ... (restante do payload igual ao seu código)
    pof2008: pacote.pof2008 || null,
    pof2017: pacote.pof2017 || null,

    acute_drfa_externo:  pacote.acute_drfa_externo  ?? "-",
    acute_drfa_interno:  pacote.acute_drfa_interno  ?? "-",
    chronic_ida_externo: pacote.chronic_ida_externo ?? "-",
    chronic_ida_interno: pacote.chronic_ida_interno ?? "-",
    water_drfa_externo:  pacote.water_drfa_externo  ?? "-",
    water_drfa_interno:  pacote.water_drfa_interno  ?? "-",

    incluirWaterAcute: temWaterAcute,
    incluirWaterChronic: temWaterChronic,

    // Water Acute extra
    water_conc:       localStorage.getItem(LS_KEYS.conc)     || "-",
    water_adulto:     localStorage.getItem(LS_KEYS.adulto)   || "-",
    water_crianca:    localStorage.getItem(LS_KEYS.crianca)  || "-",
    water_int_adulto: localStorage.getItem("outIntAdulto")   || "-",
    water_ext_adulto: localStorage.getItem("outExtAdulto")   || "-",
    water_int_crianca:localStorage.getItem("outIntCrianca")  || "-",
    water_ext_crianca:localStorage.getItem("outExtCrianca")  || "-",
  };

  Object.assign(payload, {
    "CRONICO_conc":             localStorage.getItem("CRONICO_conc")            || "-",
    "CRONICO_adulto":           localStorage.getItem("CRONICO_adulto")          || "-",
    "CRONICO_crianca":          localStorage.getItem("CRONICO_crianca")         || "-",
    "CRONICO_outIntAdulto":     localStorage.getItem("CRONICO_outIntAdulto")    || "-",
    "CRONICO_outExtAdulto":     localStorage.getItem("CRONICO_outExtAdulto")    || "-",
    "CRONICO_outIntCrianca":    localStorage.getItem("CRONICO_outIntCrianca")   || "-",
    "CRONICO_outExtCrianca":    localStorage.getItem("CRONICO_outExtCrianca")   || "-",
    "CRONICO_IDA_ANVISA_VAL":   localStorage.getItem("CRONICO_IDA_ANVISA_VAL")  || "-",
    "CRONICO_IDA_SYNGENTA_VAL": localStorage.getItem("CRONICO_IDA_SYNGENTA_VAL")|| "-"
  });

  payload.mexico = {
    data: JSON.parse(localStorage.getItem("RW_MEXICO_DATA") || "[]"),
    results: {
      bw: localStorage.getItem("RW_MEXICO_BW") || "-",
      sum: localStorage.getItem("RW_MEXICO_SUM") || "-",
      adi: localStorage.getItem("RW_MEXICO_ADI") || "-",
      idmt: localStorage.getItem("RW_MEXICO_IDMT") || "-",
      percentAdi: localStorage.getItem("RW_MEXICO_PERCENT_ADI") || "-"
    }
  };

  console.log("[PDF] POST", REPORT_COMBINED_ENDPOINT, payload);

  const resp = await fetch(REPORT_COMBINED_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("[PDF] erro", resp.status, text);
    throw new Error(`Erro ao gerar PDF: ${resp.status} - ${text}`);
  }

  const contentType = resp.headers.get("Content-Type") || "";
  if (!contentType.includes("application/pdf")) {
    const previewText = await resp.text();
    console.error("[PDF] Content-Type inesperado:", contentType, "body:", previewText.slice(0, 300));
    throw new Error("Resposta não é PDF. Veja o console.");
  }

  const blob = await resp.blob();
  if (blob.size === 0) throw new Error("PDF vazio recebido.");

  const nameParts = [];
  if (payload.acute?.length)   nameParts.push("acute");
  if (payload.chronic?.length) nameParts.push("chronic");
  const fname = `riskwise_${nameParts.join("_") || "empty"}_${new Date().toISOString().slice(0, 10)}.pdf`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

async function exportToExcelBackupAll(pacote) {
  const {
    acute, chronic, pof2008, pof2017,
    acute_drfa_externo, acute_drfa_interno,
    chronic_ida_externo, chronic_ida_interno
  } = pacote;

  const wbAll = XLSX.utils.book_new();

  // ===== Cabeçalhos e mapeamentos iguais ao arquivo principal =====
  const cabecalhoAcute = [
    "Cultivo", "ANO POF", "Região", "Caso Fórmula", "LMR",
    "HR/MCR", "MREC/STMR", "IMEA", "%DRFA Externo", "%DRFA Interno"
  ];
  const keyMapAcute = {
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
  const getValA = (row, col) => {
    const keys = keyMapAcute[col] || [col];
    for (const k of keys) if (row[k] !== undefined && row[k] !== null) return row[k];
    return "";
  };

  const cabecalhoChronic = [
    "Cultivo", "ANO_POF", "Região",
    "LMR (mg/kg)", "MREC_STMR (mg/kg)",
    "Market Share (%)", "IDMT (%)", "Contribuição Individual do Cultivo (%)"
  ];
  const keyMapC = {
    "Cultivo": ["Cultivo"],
    "ANO_POF": ["ANO_POF"],
    "Região": ["Região"],
    "LMR (mg/kg)": ["LMR (mg_kg)", "LMR (mg/kg)"],
    "MREC_STMR (mg/kg)": ["MREC_STMR (mg_kg)", "MREC_STMR (mg/kg)"],
    "Market Share (%)": ["Market Share (%)", "Market Share"],
    "IDMT (%)": ["IDMT (%)", "IDMT (Numerador)"],
    "Contribuição Individual do Cultivo (%)": ["Contribuição Individual do Cultivo (%)", "Contribuição Individual do Cultivo"],
  };
  const getValC = (row, col) => {
    const keys = keyMapC[col] || [col];
    for (const k of keys) if (row[k] !== undefined && row[k] !== null) return row[k];
    return "";
  };

  const mIDA_EXT = displayMetricLabel("%IDA_ANVISA");   // "IDA_EXTERNA"
  const mIDA_INT = displayMetricLabel("%IDA_SYNGENTA"); // "IDA_INTERNA"
  const regioesHeader = ["Métrica", "Brasil", "Centro-Oeste", "Nordeste", "Norte", "Sudeste", "Sul"];

  // ===== Acute (ALL) — sem filtrar por preenchimento =====
  if (Array.isArray(acute) && acute.length > 0) {
    const aoaAcuteAll = [
      ["DRFA Externo", acute_drfa_externo],
      ["DRFA Interno", acute_drfa_interno],
      [],
      cabecalhoAcute,
      ...acute.map(item => cabecalhoAcute.map(col => getValA(item, col))),
    ];
    const wsAAll = XLSX.utils.aoa_to_sheet(aoaAcuteAll);
    autoWidth(wsAAll, cabecalhoAcute, (row, col) => getValA(row, col), acute);
    XLSX.utils.book_append_sheet(wbAll, wsAAll, "Acute Diet (ALL)");
  }

  // ===== Chronic (ALL) — sem filtrar por preenchimento =====
  if (Array.isArray(chronic) && chronic.length > 0) {
    const aoaChronicAll = [
      ["IDA (Externo)", chronic_ida_externo],
      ["IDA (Interno)", chronic_ida_interno],
      [],
      ["Chronic DRA Calculator"],
      cabecalhoChronic,
      ...chronic.map(item => cabecalhoChronic.map(col => getValC(item, col))),
      [],
    ];

    // POF 2008 (mesmo bloco do principal)
    if (pof2008) {
      aoaChronicAll.push(
        ["POF 2008"],
        regioesHeader,
        ["PC (Kg)",
          pof2008.PC_Kg?.Brasil ?? 0,
          (pof2008.PC_Kg?.["Centro_Oeste"] ?? pof2008.PC_Kg?.["Centro-Oeste"]) ?? 0,
          pof2008.PC_Kg?.Nordeste ?? 0,
          pof2008.PC_Kg?.Norte ?? 0,
          pof2008.PC_Kg?.Sudeste ?? 0,
          pof2008.PC_Kg?.Sul ?? 0
        ],
        [mIDA_EXT,
          pof2008["%IDA_ANVISA"]?.Brasil ?? 0,
          (pof2008["%IDA_ANVISA"]?.["Centro_Oeste"] ?? pof2008["%IDA_ANVISA"]?.["Centro-Oeste"]) ?? 0,
          pof2008["%IDA_ANVISA"]?.Nordeste ?? 0,
          pof2008["%IDA_ANVISA"]?.Norte ?? 0,
          pof2008["%IDA_ANVISA"]?.Sudeste ?? 0,
          pof2008["%IDA_ANVISA"]?.Sul ?? 0
        ],
        [mIDA_INT,
          pof2008["%IDA_SYNGENTA"]?.Brasil ?? 0,
          (pof2008["%IDA_SYNGENTA"]?.["Centro_Oeste"] ?? pof2008["%IDA_SYNGENTA"]?.["Centro-Oeste"]) ?? 0,
          pof2008["%IDA_SYNGENTA"]?.Nordeste ?? 0,
          pof2008["%IDA_SYNGENTA"]?.Norte ?? 0,
          pof2008["%IDA_SYNGENTA"]?.Sudeste ?? 0,
          pof2008["%IDA_SYNGENTA"]?.Sul ?? 0
        ],
        []
      );
    }

    // POF 2017 (mesmo bloco do principal)
    if (pof2017) {
      aoaChronicAll.push(
        ["POF 2017"],
        regioesHeader,
        ["PC (Kg)",
          pof2017.PC_Kg?.Brasil ?? 0,
          (pof2017.PC_Kg?.["Centro_Oeste"] ?? pof2017.PC_Kg?.["Centro-Oeste"]) ?? 0,
          pof2017.PC_Kg?.Nordeste ?? 0,
          pof2017.PC_Kg?.Norte ?? 0,
          pof2017.PC_Kg?.Sudeste ?? 0,
          pof2017.PC_Kg?.Sul ?? 0
        ],
        [mIDA_EXT,
          pof2017["%IDA_ANVISA"]?.Brasil ?? 0,
          (pof2017["%IDA_ANVISA"]?.["Centro_Oeste"] ?? pof2017["%IDA_ANVISA"]?.["Centro-Oeste"]) ?? 0,
          pof2017["%IDA_ANVISA"]?.Nordeste ?? 0,
          pof2017["%IDA_ANVISA"]?.Norte ?? 0,
          pof2017["%IDA_ANVISA"]?.Sudeste ?? 0,
          pof2017["%IDA_ANVISA"]?.Sul ?? 0
        ],
        [mIDA_INT,
          pof2017["%IDA_SYNGENTA"]?.Brasil ?? 0,
          (pof2017["%IDA_SYNGENTA"]?.["Centro_Oeste"] ?? pof2017["%IDA_SYNGENTA"]?.["Centro-Oeste"]) ?? 0,
          pof2017["%IDA_SYNGENTA"]?.Nordeste ?? 0,
          pof2017["%IDA_SYNGENTA"]?.Norte ?? 0,
          pof2017["%IDA_SYNGENTA"]?.Sudeste ?? 0,
          pof2017["%IDA_SYNGENTA"]?.Sul ?? 0
        ]
      );
    }

    const wsCAll = XLSX.utils.aoa_to_sheet(aoaChronicAll);
    autoWidth(wsCAll, cabecalhoChronic, (row, col) => getValC(row, col), chronic);
    XLSX.utils.book_append_sheet(wbAll, wsCAll, "Chronic Diet (ALL)");
  }

  // ===== Nome do arquivo =====
  const fnameAll = `riskwise_backup_all_crops_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wbAll, fnameAll);
}

function renderizarReferenciasWaterAcute() {

  const drfaExterno = localStorage.getItem(LS_KEYS.idaAnvisa) || "-";
  const drfaInterno = localStorage.getItem(LS_KEYS.idaSyngenta) || "-";

    const elExt = document.getElementById("water-drfa-externo");
    const elInt = document.getElementById("water-drfa-interno");

    if (elExt) elExt.textContent = drfaExterno;
    if (elInt) elInt.textContent = drfaInterno;
}

function renderizarTabelaWaterAcute() {
  const conc    = localStorage.getItem(LS_KEYS.conc)    || "-";
  const adulto  = localStorage.getItem(LS_KEYS.adulto)  || "-";
  const crianca = localStorage.getItem(LS_KEYS.crianca) || "-";
  const intAdulto = localStorage.getItem("outIntAdulto") || "-";
  const extAdulto = localStorage.getItem("outExtAdulto") || "-";
  const intCrianca = localStorage.getItem("outIntCrianca") || "-";
  const extCrianca = localStorage.getItem("outExtCrianca") || "-";

  const tabela = document.getElementById("tabela-water-acute");
  if (!tabela) return;

  tabela.innerHTML = `
    <tr>
      <td>${conc}</td>
      <td>${adulto}</td>
      <td>${crianca}</td>
      <td>${intAdulto}</td>
      <td>${extAdulto}</td>
      <td>${intCrianca}</td>
      <td>${extCrianca}</td>
    </tr>
  `;
}

function renderizarReferenciasWaterChronic() {
    const idaExterno = localStorage.getItem("CRONICO_IDA_ANVISA_VAL") || "-";
    const idaInterno = localStorage.getItem("CRONICO_IDA_SYNGENTA_VAL") || "-";

    const elExt = document.getElementById("water-chronic-ida-externo");
    const elInt = document.getElementById("water-chronic-ida-interno");

    if (elExt) elExt.textContent = idaExterno;
    if (elInt) elInt.textContent = idaInterno;
}

function renderizarTabelaWaterChronic() {
  const conc    = localStorage.getItem("CRONICO_conc")    || "-";
  const adulto  = localStorage.getItem("CRONICO_adulto")  || "-";
  const crianca = localStorage.getItem("CRONICO_crianca") || "-";
  const intAdulto = localStorage.getItem("CRONICO_outIntAdulto") || "-";
  const extAdulto = localStorage.getItem("CRONICO_outExtAdulto") || "-";
  const intCrianca = localStorage.getItem("CRONICO_outIntCrianca") || "-";
  const extCrianca = localStorage.getItem("CRONICO_outExtCrianca") || "-";

  const tabela = document.getElementById("tabela-water-chronic");
  if (!tabela) return;

  tabela.innerHTML = `
    <tr>
      <td>${conc}</td>
      <td>${adulto}</td>
      <td>${crianca}</td>
      <td>${intAdulto}</td>
      <td>${extAdulto}</td>
      <td>${intCrianca}</td>
      <td>${extCrianca}</td>
    </tr>
  `;
}

// Tabela principal
function renderizarTabelaMexico() {
    const tbody = document.getElementById("report-mexico-body");
    if (!tbody) return;

    const dados = JSON.parse(localStorage.getItem("RW_MEXICO_DATA")) || [];
    tbody.innerHTML = "";

    if (!dados.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="no-data">Nenhum dado disponível</td></tr>`;
        return;
    }

    dados.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item["Crop"] || "-"}</td>
            <td>${item["Cultivo"] || "-"}</td>
            <td>${item["LMR (mg/kg)"] || "-"}</td>
            <td>${item["R (mg/kg)"] || "-"}</td>
            <td>${item["C (Kg/person/day)"] || "-"}</td>
            <td>${item["(LMR or R)*C"] || "-"}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Tabela de resultados
function renderizarResultadosMexico() {
    const tbody = document.getElementById("mexico-results-output");
    if (!tbody) return;

    const bw = localStorage.getItem("RW_MEXICO_BW") || "-";
    const sum = localStorage.getItem("RW_MEXICO_SUM") || "-";
    const adi = localStorage.getItem("RW_MEXICO_ADI") || "-";
    const idmt = localStorage.getItem("RW_MEXICO_IDMT") || "-";
    const percentAdi = localStorage.getItem("RW_MEXICO_PERCENT_ADI") || "-";

    tbody.innerHTML = `
        <tr>
            <td>${bw}</td>
            <td>${sum}</td>
            <td>${adi}</td>
            <td>${idmt}</td>
            <td>${percentAdi}</td>
        </tr>
    `;
}