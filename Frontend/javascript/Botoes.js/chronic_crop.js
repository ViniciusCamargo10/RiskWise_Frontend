// Chaves exclusivas para Crônica
const LS_KEYS = {
  chronicData: "RW_CRONIC_DATA", // dados da tabela crônica
  idaAnvisa: "RW_CRONIC_IDA_ANVISA", // IDA externa
  idaSyngenta: "RW_CRONIC_IDA_SYNGENTA", // IDA interna
  pof2008: "RW_CRONIC_POF_2008", // POF 2008 recalculada
  pof2017: "RW_CRONIC_POF_2017"  // POF 2017 recalculada
};

// === Mapa central de labels (somente exibição) ===
const LABELS = {
  buttons: { Ext: "IDA_EXTERNA", Int: "IDA_INTERNA" },
  metrics: { "%IDA_ANVISA": "%IDA_EXTERNA", "%IDA_SYNGENTA": "%IDA_INTERNA" }
};

function displayButtonLabel(valueKey) {
  return LABELS.buttons[valueKey] ?? "";
}
function displayMetricLabel(metricKey) {
  return LABELS.metrics[metricKey] ?? metricKey;
}
function toBackendMetric(displayText) {
  const found = Object.entries(LABELS.metrics).find(([k, v]) => v === displayText);
  return found ? found[0] : displayText;
}


document.addEventListener("DOMContentLoaded", async () => {
  'use strict';

  const API_URL = `${window.location.origin}/dados`;
  const tbody = document.getElementById("tabela-dados");

  // Estado dos filtros (cumulativos)
  const estadoFiltros = { Cultivo: "Todos", ANO_POF: "Todos", Região: "Todos" };

  // Colunas na ordem desejada
  const COLUNAS = [
    "Cultivo",
    "ANO_POF",
    "Região",
    "LMR (mg_kg)",
    "MREC_STMR (mg_kg)",
    "Market Share",
    "IDMT (Numerador)",
    "Contribuição Individual do Cultivo"
  ];

  let dadosOriginais = [];
    
  
  function salvarDadosCronica() {
    try {
      if (Array.isArray(dadosOriginais) && dadosOriginais.length > 0) {
        localStorage.setItem(LS_KEYS.chronicData, JSON.stringify(dadosOriginais));
      }
    } catch (e) {
      console.warn("[CRONICA] Falha ao salvar dados:", e);
    }
  }


  // ---------------- Utilitários ----------------

  const canon = (s) =>
    String(s)
      .normalize("NFD").replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[_\s-]+/g, "");

  function getCampo(item, nomeChave) {
    if (!item) return undefined;
    if (nomeChave in item) return item[nomeChave];
    const alvo = canon(nomeChave);
    for (const k of Object.keys(item)) {
      if (canon(k) === alvo) return item[k];
    }
    return undefined;
  }

  function toNumberSafe(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function fmt(v) {
    return (v === null || v === undefined || v === "") ? "-" : v;
  }

  // Escaper seguro para seletores CSS (fallback caso CSS.escape não exista)
  const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/"/g, '\\"'));

  // --------------------- Calcular IDMT E Contribuição individual ---------------------------

  function calcularIDMT(item) {
    const consumoRaw = toNumberSafe(getCampo(item, "Consumo diário per capita (g_dia_pessoa) C"));
    const consumo = consumoRaw !== null ? consumoRaw / 1000 : null; // kg/dia/pessoa

    const fp = toNumberSafe(getCampo(item, "Fator de Processamento FP"));
    const fc = toNumberSafe(getCampo(item, "Fator de Conversão FC"));
    const lmr = toNumberSafe(getCampo(item, "LMR (mg_kg)"));
    const mrec = toNumberSafe(getCampo(item, "MREC_STMR (mg_kg)"));
    const pc = toNumberSafe(getCampo(item, "PC (kg)")); // 🔹 precisa para dividir

    const limite =
      (lmr !== null && lmr > 0) ? lmr :
      (mrec !== null && mrec > 0) ? mrec :
      null;

    if (consumo !== null && fp !== null && fc !== null && limite !== null && pc !== null && pc > 0) {
      return (limite * consumo * fp * fc) / pc; // ✅ divide pelo PC
    }
    return null;
  }

  function calcularContribuicaoIndividual(idmt, item) {
    const pc = toNumberSafe(getCampo(item, "PC (kg)"));
    const marketShare = toNumberSafe(getCampo(item, "Market Share")) || 1;
    const idmtVal = (idmt ?? 0);

    return pc ? (idmtVal / pc) * marketShare : 0;
  }

  // ------------- % POF -------------------------


function atualizarPOF() {
  const regioes = ["Brasil", "Centro_Oeste", "Nordeste", "Norte", "Sudeste", "Sul"];
  const anos = ["2008", "2017"];

  anos.forEach(ano => {
    const resultado = {};

    regioes.forEach(regiao => {
      const idmtTotal = dadosOriginais
        .filter(item =>
          String(getCampo(item, "ANO_POF")) === ano &&
          String(getCampo(item, "Região")) === regiao
        )
        .reduce((soma, item) => soma + (calcularIDMT(item) ?? 0), 0);

      resultado[regiao] = {
        "%IDA_ANVISA": idaAnvisa ? (idmtTotal * 100) / idaAnvisa : null,
        "%IDA_SYNGENTA": idaSyngenta ? (idmtTotal * 100) / idaSyngenta : null
      };
    });

    atualizarTabelaPOF(resultado, ano === "2008" ? "tabela-pof-2008" : "tabela-pof-2017");
  });

  // ✅ Salva snapshots no localStorage
  const snap2008 = snapshotTabela('tabela-pof-2008');
  if (snap2008) localStorage.setItem(LS_KEYS.pof2008, JSON.stringify(snap2008));

  const snap2017 = snapshotTabela('tabela-pof-2017');
  if (snap2017) localStorage.setItem(LS_KEYS.pof2017, JSON.stringify(snap2017));
}


  function atualizarTabelaPOF(resultados, tabelaId) {
    const tbody = document.getElementById(tabelaId);
    if (!tbody) return;

    tbody.querySelectorAll("tr").forEach(tr => {
      const metrica = tr.dataset.metrica || toBackendMetric(tr.children[0].textContent.trim());

      if (!["%IDA_ANVISA", "%IDA_SYNGENTA"].includes(metrica)) return;

      const regioes = ["Brasil", "Centro_Oeste", "Nordeste", "Norte", "Sudeste", "Sul"];
      regioes.forEach((regiao, i) => {
        const valor = resultados[regiao][metrica];
        tr.children[i + 1].textContent =
          typeof valor === "number" ? valor.toFixed(4) + "%" : "—";
      });
    });
  }

  // ---------------- Criação de Input Numérico com replicação (com re-render global) ----------------
  function criarInputNumerico(valorInicial, onValidChange, placeholderText = "-", ano = null, cultivo = null, coluna = null) {
    const input = document.createElement("input");
    input.type = "text";              // 'text' para controlar a entrada
    input.inputMode = "decimal";      // teclado decimal em mobile
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = placeholderText;
    input.className = "editable-cell";
    input.value = (valorInicial === "-" ? "" : (valorInicial ?? "")).toString();

    input.title = "Accepts integers and decimals with dots (.)";

    const regexParcial = /^\d*\.?\d*$/;   // permite "0.", "0.0", "0.06"
    const regexFinal   = /^\d+(\.\d+)?$/; // número completo com ponto

    let prev = input.value;

    input.addEventListener("beforeinput", (e) => {
      if (
        e.inputType === "deleteContentBackward" ||
        e.inputType === "deleteContentForward" ||
        e.inputType === "deleteByCut"
      ) return;

      if (e.inputType === "insertFromPaste") return;

      const ch = e.data;
      if (typeof ch === "string") {
        if (!/[\d.]/.test(ch)) {
          e.preventDefault();
          return;
        }

        const selStart = input.selectionStart ?? 0;
        const selEnd = input.selectionEnd ?? 0;
        const selection = input.value.slice(selStart, selEnd);
        const jaTemPontoForaDaSelecao = input.value.includes(".") && !selection.includes(".");
        if (ch === "." && jaTemPontoForaDaSelecao) {
          e.preventDefault();
          return;
        }
      }
    });

    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const clipboard = (e.clipboardData || window.clipboardData).getData("text") ?? "";
      let sanitized = clipboard.replace(/[^\d.]/g, "");

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

      if (regexParcial.test(final)) {
        input.value = final;
        prev = input.value;
        validarAtualizar();
      }
    });

    input.addEventListener("input", () => {
      validarAtualizar();
    });

    function validarAtualizar() {
  let v = input.value;

  if (!regexParcial.test(v)) {
    input.value = prev;
    const caret = input.value.length;
    try { input.setSelectionRange(caret, caret); } catch {}
    input.style.borderColor = "#e53935";
    return;
  }

  // Remove pontos extras depois do primeiro
  const i = v.indexOf('.');
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');

  input.style.borderColor = "#ccc";
  prev = v;
  input.value = v;

  if (typeof onValidChange !== "function") return;

  // ---------------------- LIMPAR (v === "") ----------------------
  if (v === "") {
    onValidChange(null);

    if (cultivo != null && coluna) {
      // ⬇️ REPLICA para 2008 e 2017, todas as regiões, do mesmo Cultivo
      dadosOriginais.forEach(item => {
        const anoItem = String(getCampo(item, "ANO_POF"));
        const cultivoItem = String(getCampo(item, "Cultivo"));
        if (
          cultivoItem === String(cultivo) &&
          (anoItem === "2008" || anoItem === "2017")
        ) {
          item[coluna] = null;

          const novoIDMT = calcularIDMT(item);
          item["IDMT (Numerador)"] = novoIDMT;
          item["Contribuição Individual do Cultivo"] = calcularContribuicaoIndividual(novoIDMT, item);
        }
      });

      // 🔒 Preserva foco, re-renderiza e restaura
      const currentFocus = document.activeElement;
      const currentAno = currentFocus?.dataset?.ano;
      const currentCultivo = currentFocus?.dataset?.cultivo;
      const currentColuna = currentFocus?.dataset?.col;

      atualizarPOF();
      renderizarTabela(dadosComFiltrosAplicados());
      salvarDadosCronica();

      if (currentAno && currentCultivo && currentColuna) {
        const selector = `.editable-cell[data-ano="${esc(currentAno)}"][data-cultivo="${esc(currentCultivo)}"][data-col="${esc(currentColuna)}"]`;
        const newInput = document.querySelector(selector);
        if (newInput) {
          newInput.focus();
          const len = newInput.value.length;
          try { newInput.setSelectionRange(len, len); } catch {}
        }
      }
    }
    return;
  }

  // ---------------------- VALOR VÁLIDO ----------------------
  if (regexFinal.test(v)) {
    const valueText = v; // mantém "0.0", "0.06", etc.
    onValidChange(valueText);

    if (cultivo != null && coluna) {
      // ⬇️ REPLICA para 2008 e 2017, todas as regiões, do mesmo Cultivo
      dadosOriginais.forEach(item => {
        const anoItem = String(getCampo(item, "ANO_POF"));
        const cultivoItem = String(getCampo(item, "Cultivo"));
        if (
          cultivoItem === String(cultivo) &&
          (anoItem === "2008" || anoItem === "2017")
        ) {
          // Guardar STRING no modelo
          item[coluna] = valueText;

          const novoIDMT = calcularIDMT(item); // toNumberSafe converte string -> número
          item["IDMT (Numerador)"] = novoIDMT;
          item["Contribuição Individual do Cultivo"] = calcularContribuicaoIndividual(novoIDMT, item);
        }
      });

      // 💾 Persistência
      salvarDadosCronica();

      // 🔒 Preserva foco, re-renderiza e restaura
      const currentFocus = document.activeElement;
      const currentAno = currentFocus?.dataset?.ano;
      const currentCultivo = currentFocus?.dataset?.cultivo;
      const currentColuna = currentFocus?.dataset?.col;

      atualizarPOF();
      renderizarTabela(dadosComFiltrosAplicados());

      if (currentAno && currentCultivo && currentColuna) {
        const selector = `.editable-cell[data-ano="${esc(currentAno)}"][data-cultivo="${esc(currentCultivo)}"][data-col="${esc(currentColuna)}"]`;
        const newInput = document.querySelector(selector);
        if (newInput) {
          newInput.focus();
          const len = newInput.value.length;
          try { newInput.setSelectionRange(len, len); } catch {}
        }
      }
    }
    return;
  }
  
      // 🔹 Número completo — commit COMO STRING para preservar "0.0"
      // 🔹 Número completo — commit COMO STRING para preservar "0.0"
if (regexFinal.test(v)) {
  const valueText = v; // mantém "0.0", "0.06", etc.
  onValidChange(valueText);

  if (ano != null && cultivo != null && coluna) {
    dadosOriginais.forEach(item => {
      if (
        String(getCampo(item, "ANO_POF")) === String(ano) &&
        String(getCampo(item, "Cultivo")) === String(cultivo)
      ) {
        // Guardar STRING no modelo
        item[coluna] = valueText;

        const novoIDMT = calcularIDMT(item); // toNumberSafe converte string -> número
        item["IDMT (Numerador)"] = novoIDMT;
        item["Contribuição Individual do Cultivo"] = calcularContribuicaoIndividual(novoIDMT, item);
      }
    });

    // 💾 >>> SALVAR TAMBÉM AQUI <<<
    salvarDadosCronica();

    // 🔒 Preserva foco, re-renderiza e restaura
    const currentFocus = document.activeElement;
    const currentAno = currentFocus?.dataset?.ano;
    const currentCultivo = currentFocus?.dataset?.cultivo;
    const currentColuna = currentFocus?.dataset?.col;

    atualizarPOF();
    renderizarTabela(dadosComFiltrosAplicados());

    if (currentAno && currentCultivo && currentColuna) {
      const selector = `.editable-cell[data-ano="${esc(currentAno)}"][data-cultivo="${esc(currentCultivo)}"][data-col="${esc(currentColuna)}"]`;
      const newInput = document.querySelector(selector);
      if (newInput) {
        newInput.focus();
        const len = newInput.value.length;
        try { newInput.setSelectionRange(len, len); } catch {}
      }
    }
  }
  return;
}

      // 🔹 Estado intermediário (ex.: "0." ou "0.0")
      onValidChange(null);
    }

    return input;
  }

  // ---------------- Carregamento ----------------
  
  
async function carregarTabela() {
  // 1) Tenta restaurar do localStorage SOMENTE se houver dados válidos
  const saved = localStorage.getItem(LS_KEYS.chronicData);
  if (saved) {
    try {
      const restored = JSON.parse(saved);
      if (Array.isArray(restored) && restored.length > 0) {
        dadosOriginais = restored;
        renderizarTabela(dadosComFiltrosAplicados());
        inicializarFiltros(dadosOriginais);
        atualizarPOF();
        return; // ✅ restauração bem-sucedida, não precisa backend
      }
      // Se chegou aqui, havia chave, mas vazia/ineficaz. Cai para o backend.
      console.warn("[CRONICA] Salvo no localStorage vazio/ineficaz. Buscando do backend...");
    } catch (e) {
      console.warn("[CRONICA] JSON do localStorage inválido. Buscando do backend...", e);
      // cai pro backend
    }
  }

  // 2) Busca do backend se não tinha salvo válido
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error("Erro ao buscar dados");
    const data = await response.json();

    // 🔎 Ajuste aqui para o nome certo da propriedade do seu backend:
    // Ex.: data.tabelaCompleta, data.tabela_cronica, etc.
    dadosOriginais = Array.isArray(data.tabelaCompleta) ? data.tabelaCompleta : [];

    renderizarTabela(dadosComFiltrosAplicados());
    inicializarFiltros(dadosOriginais);
    atualizarPOF();

    // (opcional) Se quiser já “seedar” o storage na primeira carga:
    // salvarDadosCronica();
  } catch (error) {
    console.error("Erro ao carregar tabela:", error);
    tbody.innerHTML = `<tr><td class="no-data" colspan="${COLUNAS.length}">Falha ao carregar os dados.</td></tr>`;
  }
}



  // ---------------- Renderização ----------------
  function renderizarTabela(data) {
    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td class="no-data" colspan="${COLUNAS.length}">Nenhum dado encontrado para os filtros aplicados.</td></tr>`;
      return;
    }

    data.forEach(item => {
      const tr = document.createElement("tr");

      const regiao = getCampo(item, "Região");
      if (typeof regiao === "string" && regiao.trim() === "Brasil") {
        tr.classList.add("linha-verde");
      }

      COLUNAS.forEach(col => {
        const td = document.createElement("td");
        const valor = fmt(getCampo(item, col));

        if (["LMR (mg_kg)", "MREC_STMR (mg_kg)", "Market Share"].includes(col)) {
          td.title = "Accepts integers and decimals with dots (.)";
          td.setAttribute("aria-label", "Campo numérico. Aceita inteiros e decimais com ponto.");

          const anoItem = getCampo(item, "ANO_POF");
          const cultivoItem = getCampo(item, "Cultivo");
          const regiaoItem = getCampo(item, "Região");

          const input = criarInputNumerico(
            valor,
            (novoValor) => { item[col] = novoValor; }, // novoValor será string ("0.0", "0.06") ou null
            "-",
            anoItem,
            cultivoItem,
            col
          );

          input.dataset.ano = String(anoItem);
          input.dataset.cultivo = String(cultivoItem);
          input.dataset.regiao = String(regiaoItem);
          input.dataset.col = col;

          td.appendChild(input);
        } else if (["IDMT (Numerador)", "Contribuição Individual do Cultivo"].includes(col)) {
          const num = toNumberSafe(getCampo(item, col));
          td.textContent = num !== null ? num.toFixed(8) : "-";
        } else {
          td.textContent = valor;
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    }); // fechamento do data.forEach
  } // fechamento da função renderizarTabela

  // ---------------- Filtros ----------------

  function inicializarFiltros(data) {
    const cultivosUnicos = [...new Set(
      data.map(i => getCampo(i, "Cultivo")).filter(v => v && String(v).trim() !== "")
    )].sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" }));

    const anosUnicosRaw = data
      .map(i => getCampo(i, "ANO_POF"))
      .filter(v => v && String(v).trim() !== "");

    const regioesUnicas = [...new Set(
      data.map(i => getCampo(i, "Região")).filter(v => v && String(v).trim() !== "")
    )].sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" }));

    const anosUnicos = [...new Set(anosUnicosRaw.map(v => {
      const n = toNumberSafe(v);
      return n !== null ? n : String(v).trim();
    }))].sort((a, b) => {
      const na = toNumberSafe(a);
      const nb = toNumberSafe(b);
      if (na !== null && nb !== null) return na - nb;
      return String(a).localeCompare(String(b), "pt-BR");
    });

    document.querySelectorAll(".coluna-filtro").forEach((coluna) => {
      coluna.addEventListener("click", (e) => {
        e.stopPropagation();
        const jaAtivo = coluna.classList.contains("ativo");
        fecharTodosDropdowns();
        if (jaAtivo) return;

        coluna.classList.add("ativo");
        let dropdown = coluna.querySelector(".dropdown-filtro");
        if (!dropdown) {
          dropdown = document.createElement("div");
          dropdown.className = "dropdown-filtro";

          const tipo = coluna.dataset.coluna;
          let opcoes = ["Todos"];
          if (tipo === "Cultivo") opcoes = ["Todos", ...cultivosUnicos];
          if (tipo === "ANO_POF") opcoes = ["Todos", ...anosUnicos];
          if (tipo === "Região") opcoes = ["Todos", ...regioesUnicas];

          dropdown.innerHTML = opcoes.map(op => `<div data-value="${op}">${op}</div>`).join("");
          coluna.appendChild(dropdown);

          dropdown.querySelectorAll("div").forEach(item => {
            item.addEventListener("click", (ev) => {
              ev.stopPropagation();
              aplicarFiltros(tipo, item.dataset.value);
              fecharDropdown(coluna);
            });
          });
        }
        dropdown.classList.add("show");
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".coluna-filtro")) fecharTodosDropdowns();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fecharTodosDropdowns();
    });
  }

  function fecharDropdown(coluna) {
    const dd = coluna.querySelector(".dropdown-filtro");
    if (dd) dd.classList.remove("show");
    coluna.classList.remove("ativo");
  }

  function fecharTodosDropdowns() {
    document.querySelectorAll(".dropdown-filtro.show").forEach(d => d.classList.remove("show"));
    document.querySelectorAll(".coluna-filtro.ativo").forEach(c => c.classList.remove("ativo"));
  }

  // 🔧 Helper central para reaplicar os filtros atuais
  function dadosComFiltrosAplicados() {
    return dadosOriginais.filter(item => {
      const cultivoItem = getCampo(item, "Cultivo");
      const anoItem = getCampo(item, "ANO_POF");
      const regiaoItem = getCampo(item, "Região");

      const filtroCultivoOK =
        estadoFiltros.Cultivo === "Todos" ||
        (cultivoItem && String(cultivoItem) === String(estadoFiltros.Cultivo));

      const filtroAnoOK =
        estadoFiltros.ANO_POF === "Todos" ||
        (toNumberSafe(anoItem) !== null && toNumberSafe(estadoFiltros.ANO_POF) !== null
          ? toNumberSafe(anoItem) === toNumberSafe(estadoFiltros.ANO_POF)
          : String(anoItem) === String(estadoFiltros.ANO_POF));
            
      const filtroRegiaoOK =
        estadoFiltros.Região === "Todos" ||
        (regiaoItem && String(regiaoItem) === String(estadoFiltros.Região));

      
      return filtroCultivoOK && filtroAnoOK && filtroRegiaoOK;
    });
  }

  // Simplifica: aplica valor e re-renderiza com os filtros vigentes
  function aplicarFiltros(coluna, valor) {
    estadoFiltros[coluna] = valor;
    renderizarTabela(dadosComFiltrosAplicados());
  }

  // ---------------- Inicialização ----------------

  // 1) Ajusta inputs visuais (sem mudar HTML): converte "Ext"/"Int" -> labels de exibição
  const extInput = document.querySelector('.editable-btn');
  if (extInput) {
    extInput.dataset.sentinel = extInput.dataset.sentinel || 'Ext';
    extInput.dataset.default = extInput.dataset.default || displayButtonLabel('Ext'); // "IDA_EXTERNA"
    if (extInput.value === 'Ext' || extInput.value.trim() === '') {
      extInput.value = extInput.dataset.default;
    }
  }
  const intInput = document.querySelector('.editable-int');
  if (intInput) {
    intInput.dataset.sentinel = intInput.dataset.sentinel || 'Int';
    intInput.dataset.default = intInput.dataset.default || displayButtonLabel('Int'); // "IDA_INTERNA"
    if (intInput.value === 'Int' || intInput.value.trim() === '') {
      intInput.value = intInput.dataset.default;
    }
  }
 
  setupDecimalInput('.editable-btn', n => {
    idaAnvisa = n;
    atualizarPOF();
    salvarDadosCronica();
  }, LS_KEYS.idaAnvisa);

  setupDecimalInput('.editable-int', n => {
    idaSyngenta = n;
    atualizarPOF();
    salvarDadosCronica();
  }, LS_KEYS.idaSyngenta);

  // ✅ BLOCO CERTO AQUI:
  await carregarTabelaPOF2008();
  await carregarTabelaPOF2017();

  // 🔁 Restaura POFs salvas, se existirem
  const savedPOF2008 = localStorage.getItem(LS_KEYS.pof2008);
  if (savedPOF2008) restaurarTabela('tabela-pof-2008', JSON.parse(savedPOF2008));

  const savedPOF2017 = localStorage.getItem(LS_KEYS.pof2017);
  if (savedPOF2017) restaurarTabela('tabela-pof-2017', JSON.parse(savedPOF2017));

  // Agora carrega os dados principais
  await carregarTabela();

  // ✅ Garante persistência inicial
  salvarDadosCronica();

  // Eventos: beforeunload, botão back, botão clear
  window.addEventListener("beforeunload", salvarDadosCronica);

  const backBtn = document.querySelector(".btn-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => salvarDadosCronica());
  }


  // 4) Clear: volta rótulos visuais e zera lógicas
  document.querySelector(".btn-clear").addEventListener("click", () => {
    document.querySelectorAll(".editable-btn, .editable-int").forEach(input => {
      const defaultText = input.dataset.default || input.value;
      input.value = defaultText; // exibe "IDA_EXTERNA/IDA_INTERNA"
    });
    idaAnvisa = null;
    idaSyngenta = null;

    // Zera LMR/MREC e recomputa derivados
    dadosOriginais = dadosOriginais.map(item => {
      item["LMR (mg_kg)"] = null;
      item["MREC_STMR (mg_kg)"] = null;

      const novoIDMT = calcularIDMT(item);
      item["IDMT (Numerador)"] = novoIDMT;
      item["Contribuição Individual do Cultivo"] = calcularContribuicaoIndividual(novoIDMT, item);
      return item;
    });

    // 🔧 re-render com filtros preservados
    renderizarTabela(dadosComFiltrosAplicados());
  
  localStorage.removeItem(LS_KEYS.chronicData);
  localStorage.removeItem(LS_KEYS.idaAnvisa);
  localStorage.removeItem(LS_KEYS.idaSyngenta);
  localStorage.removeItem(LS_KEYS.pof2008);
  localStorage.removeItem(LS_KEYS.pof2017);

  });

  atualizarPOF(); // calcula e renderiza
  salvarDadosCronica();

  // === COLAR DO EXCEL (LMR/MREC) — Chronic ===
(function enableChronicExcelPaste(){
  const PASTE_COLUMNS = ["LMR (mg_kg)", "MREC_STMR (mg_kg)"];

  document.addEventListener('paste', (event) => {
    const active = document.activeElement;
    if (!active || !active.classList.contains('editable-cell')) return;

    const currentCol = active.dataset.col;
    if (!PASTE_COLUMNS.includes(currentCol)) return; // só LMR/MREC

    // Evita re-render a cada célula pelo handler padrão do input
    event.preventDefault();

    const clipboard = event.clipboardData?.getData('text') ?? '';
    const matrix = parseClipboard(clipboard); // linhas -> colunas (TSV Excel)
    if (!matrix.length) return;

    // Inputs visíveis da coluna atual (respeita filtros)
    const colSelector = `.editable-cell[data-col="${currentCol}"]`;
    const inputs = Array.from(document.querySelectorAll(colSelector));
    const startIndex = inputs.indexOf(active);

    const ops = [];

    // Mapeia linhas do Excel para baixo a partir do input focado
    for (let i = 0; i < matrix.length; i++) {
      const rowInput = inputs[startIndex + i];
      if (!rowInput) break; // acabou a tabela visível

      const ctx = {
        ano: rowInput.dataset.ano,
        cultivo: rowInput.dataset.cultivo,
        regiao: rowInput.dataset.regiao
      };

      const colsThisRow = matrix[i];

      if (colsThisRow.length === 1) {
        // 1 coluna: preencher somente a coluna atual
        const valText = normalizeNumberText(colsThisRow[0]);
        const valor = interpretToken(valText); // null para vazio/'-'/NA
        if (!rowInput.readOnly && !rowInput.disabled) {
          ops.push({ ...ctx, coluna: currentCol, valor });
        }
      } else {
        // Múltiplas colunas (TSV): espalhar para direita na ordem LMR -> MREC
        const startColIdx = PASTE_COLUMNS.indexOf(currentCol);
        for (let j = 0; j < colsThisRow.length; j++) {
          const targetCol = PASTE_COLUMNS[startColIdx + j];
          if (!targetCol) break; // ignorar excesso

          const valText = normalizeNumberText(colsThisRow[j]);
          const valor = interpretToken(valText);

          // Localiza o input daquela linha/coluna para honrar disabled/readOnly (se houver)
          const sel = `.editable-cell[data-ano="${esc(ctx.ano)}"][data-cultivo="${esc(ctx.cultivo)}"][data-regiao="${esc(ctx.regiao)}"][data-col="${esc(targetCol)}"]`;
          const cell = document.querySelector(sel);
          if (cell && !cell.readOnly && !cell.disabled) {
            ops.push({ ...ctx, coluna: targetCol, valor });
          }
        }
      }
    }

    aplicarEdicoesCrBatch(ops);
    mostrarFeedback(`Colados ${ops.length} valor(es).`);
  });

  function aplicarEdicoesCrBatch(ops) {
    if (!Array.isArray(ops) || ops.length === 0) return;

    // Snapshot de scroll e foco para restaurar depois
    const sc = document.querySelector('.table-wrapper');
    const scrollTop  = sc ? sc.scrollTop  : 0;
    const scrollLeft = sc ? sc.scrollLeft : 0;

    const active = document.activeElement;
    const caret = (active && typeof active.selectionStart === 'number') ? active.selectionStart : null;
    const reselectInfo = active ? {
      cultivo: active.dataset.cultivo,
      ano: active.dataset.ano,
      regiao: active.dataset.regiao,
      coluna: active.dataset.col,
      caret
    } : null;

    // Aplica cada operação replicando a MESMA regra do input:
    // para o mesmo Cultivo, aplica em 2008 e 2017 em TODAS as regiões
    for (const { cultivo, coluna, valor } of ops) {
      dadosOriginais.forEach(item => {
        const cultivoItem = String(getCampo(item, "Cultivo"));
        const anoItem = String(getCampo(item, "ANO_POF"));
        if (cultivoItem !== String(cultivo)) return;
        if (!(anoItem === "2008" || anoItem === "2017")) return;

        item[coluna] = (valor === null ? null : valor);

        const novoIDMT = calcularIDMT(item);
        item["IDMT (Numerador)"] = novoIDMT;
        item["Contribuição Individual do Cultivo"] = calcularContribuicaoIndividual(novoIDMT, item);
      });
    }

    // Persistência e re-render
    salvarDadosCronica();
    atualizarPOF();
    renderizarTabela(dadosComFiltrosAplicados());

    // Restaura scroll e foco
    if (sc) { sc.scrollTop = scrollTop; sc.scrollLeft = scrollLeft; }
    if (reselectInfo) {
      const selector = `.editable-cell[data-ano="${esc(reselectInfo.ano)}"][data-cultivo="${esc(reselectInfo.cultivo)}"][data-regiao="${esc(reselectInfo.regiao)}"][data-col="${esc(reselectInfo.coluna)}"]`;
      const el = document.querySelector(selector);
      if (el) {
        el.focus();
        const pos = typeof reselectInfo.caret === 'number' ? reselectInfo.caret : el.value.length;
        try { el.setSelectionRange(pos, pos); } catch {}
      }
    }
  }

  function parseClipboard(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return [];
    // Separa por linhas e TAB (TSV do Excel)
    return trimmed.split(/\r?\n/).map(line => line.split('\t').map(s => s.trim()));
  }

  function normalizeNumberText(s) {
    // Trata decimais com vírgula do Excel pt-BR sem quebrar quem já usa ponto
    if (s == null) return '';
    let t = String(s).trim();

    // Tokens especiais
    if (/^(na|n\/a|n\.a\.|n\.a|--|-)$/i.test(t)) return '-';

    // Se contiver vírgula, assume vírgula decimal e ponto como milhar
    if (t.includes(',')) {
      t = t.replace(/\./g, '').replace(',', '.');
    }
    // remove espaços não quebráveis
    t = t.replace(/\u00A0/g, ' ').trim();

    return t;
  }

  function interpretToken(s) {
    if (!s) return null;
    if (s === '-' || /^na$/i.test(s)) return null;

    const n = Number(s);
    if (Number.isFinite(n) && n === 0) return null;

    // Mantém string para preservar "0.06" etc. (sem normalizar formato)
    return /^\d+(\.\d+)?$/.test(s) ? s : null;
  }

  function mostrarFeedback(msg) {
    try {
      let toast = document.getElementById('paste-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'paste-toast';
        toast.style.cssText = "position:fixed;bottom:16px;right:16px;background:#2d7;border-radius:6px;color:#fff;padding:8px 12px;font:600 12px/1.3 system-ui;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:9999;opacity:.98";
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      clearTimeout(toast._t);
      toast.style.display = 'block';
      toast._t = setTimeout(() => { toast.style.display = 'none'; }, 2000);
    } catch {}
  }
})();

}); // fim DOMContentLoaded


function snapshotTabela(tabelaId) {
  const tbody = document.getElementById(tabelaId);
  if (!tbody) return null; // ⬅️ evita snapshot vazio

  const rows = tbody.querySelectorAll('tr');
  if (!rows || rows.length === 0) return null; // ⬅️ evita snapshot vazio

  const linhas = [];
  rows.forEach(tr => {
    const metrica = tr.dataset.metrica || tr.children[0].textContent.trim();
    const valores = [];
    for (let i = 1; i < tr.children.length; i++) {
      valores.push(tr.children[i].textContent.trim());
    }
    linhas.push({ metrica, valores });
  });
  return linhas;
}

// 🔽 ADICIONE ESTA FUNÇÃO (fora do DOMContentLoaded)
function restaurarTabela(tabelaId, dados) {
  const tbody = document.getElementById(tabelaId);
  if (!tbody || !Array.isArray(dados)) return;

  tbody.querySelectorAll('tr').forEach((tr, idx) => {
    const linhaSalva = dados[idx];
    if (linhaSalva && Array.isArray(linhaSalva.valores)) {
      for (let i = 1; i < tr.children.length; i++) {
        tr.children[i].textContent = linhaSalva.valores[i - 1] ?? '—';
      }
    }
  });
}

// ---------------- Inputs Ext e Int ----------------

let idaAnvisa = null;
let idaSyngenta = null;


function setupDecimalInput(selector, onValidNumber, storageKey) {
  document.querySelectorAll(selector).forEach(input => {
    const defaultText = input.dataset.default || input.value; // "IDA_EXTERNA"/"IDA_INTERNA"
    input.type = 'text';
    input.setAttribute('inputmode', 'decimal');
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.title = 'Accepts integers and decimals with dots (.)';

    // ✅ Restaura valor salvo no localStorage (se existir)
    const savedValue = localStorage.getItem(storageKey);
    if (savedValue !== null && savedValue.trim() !== '') {
      input.value = savedValue; // mostra o valor salvo
      onValidNumber(parseFloat(savedValue)); // atualiza variável lógica
    } else {
      // Mostra o rótulo “bonito” no começo, se não houver valor
      if (!input.value) input.value = defaultText;
    }

    input.addEventListener('focus', () => {
      if (input.value === defaultText) input.value = '';
    });

    input.addEventListener('blur', () => {
      // Se ficou vazio, zera o valor lógico e restaura o rótulo visual
      if (input.value.trim() === '') {
        onValidNumber(null);           // 🔴 dispara recalcular como nulo
        input.value = defaultText;     // 🔵 restaura o rótulo visual
        localStorage.removeItem(storageKey); // limpa do storage
      }
    });

    input.addEventListener('input', () => {
      // Sanitiza: só dígitos e um ponto
      let v = input.value.replace(/[^0-9.]/g, '');
      const i = v.indexOf('.');
      if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');
      if (v.startsWith('.')) v = '0' + v;
      input.value = v;

      // Notifica número válido ou null (inclusive quando usuário apaga tudo)
      const isValid = /^\d+(\.\d+)?$/.test(v);
      onValidNumber(isValid ? parseFloat(v) : null);

      // ✅ Salva no localStorage sempre que mudar
      if (isValid) {
        localStorage.setItem(storageKey, v);
      } else {
        localStorage.removeItem(storageKey);
      }
    });
  });
}


// ---------------- (Opcional) Destaque visual ao replicar ----------------

function flashUpdate(el) {
  el.classList.add('flash-update');
  setTimeout(() => el.classList.remove('flash-update'), 600);
}

//------------------- POF 2008 --------------------------------------------
let pof2008Dados = null;

async function carregarTabelaPOF2008() {
  try {
    const response = await fetch(`${window.location.origin}/dados`);
    if (!response.ok) throw new Error("Erro ao buscar dados da POF 2008");

    const data = await response.json();
    const pof = data.POF_2008;

    const regioes = ["Brasil", "Centro_Oeste", "Nordeste", "Norte", "Sudeste", "Sul"];
    const metricas = ["PC_Kg", "%IDA_ANVISA", "%IDA_SYNGENTA"];

    const tbody = document.getElementById("tabela-pof-2008");
    if (!tbody) return;

    tbody.innerHTML = "";

    metricas.forEach(metrica => {
      const tr = document.createElement("tr");
      tr.dataset.metrica = metrica; // guarda a chave original

      const tdTitulo = document.createElement("td");
      tdTitulo.textContent = displayMetricLabel(metrica); // exibe label
      tdTitulo.dataset.metrica = metrica;
      tr.appendChild(tdTitulo);

      regioes.forEach(regiao => {
        const td = document.createElement("td");
        const valor = pof[metrica][regiao];
        td.textContent = typeof valor === "number" ? valor.toFixed(4) : "—";
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Erro ao carregar tabela POF 2008:", error);
  }
}

// ------------------------ POF 2017 --------------------------------
let pof2017Dados = null;

async function carregarTabelaPOF2017() {
  try {
    const response = await fetch(`${window.location.origin}/dados`);
    if (!response.ok) throw new Error("Erro ao buscar dados da POF 2017");

    const data = await response.json();
    const pof = data.POF_2017;

    const regioes = ["Brasil", "Centro_Oeste", "Nordeste", "Norte", "Sudeste", "Sul"];
    const metricas = ["PC_Kg", "%IDA_ANVISA", "%IDA_SYNGENTA"];

    const tbody = document.getElementById("tabela-pof-2017");
    if (!tbody) return;

    tbody.innerHTML = "";

    metricas.forEach(metrica => {
      const tr = document.createElement("tr");
      tr.dataset.metrica = metrica; // guarda a chave original

      const tdTitulo = document.createElement("td");
      tdTitulo.textContent = displayMetricLabel(metrica); // exibe label
      tdTitulo.dataset.metrica = metrica;
      tr.appendChild(tdTitulo);

      regioes.forEach(regiao => {
        const td = document.createElement("td");
        const valor = pof[metrica][regiao];
        td.textContent = typeof valor === "number" ? valor.toFixed(4) : "—";
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Erro ao carregar tabela POF 2017:", error);
  }
}
const modal = document.getElementById("btn-infoChronic");
    const btn = document.querySelector(".btn-infoChronic");
    const span = modal.querySelector(".close"); // pega o X dentro do modal
    
    if (btn && modal && span) {
    btn.addEventListener("click", () => {
        modal.style.display = "flex";
    });

    span.addEventListener("click", () => {
        modal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });
}
