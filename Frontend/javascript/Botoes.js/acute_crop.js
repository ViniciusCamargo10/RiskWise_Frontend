document.addEventListener("DOMContentLoaded", async () => {
  'use strict';

  const API_URL = `${window.location.origin}/acute/dados`;
  const tbody = document.getElementById("tabela-dados");

  // ---------- Estado global ----------
  let dadosOriginais = [];
  let idaAnvisa = null;    // IDA Externa -> %DRFA ANVISA
  let idaSyngenta = null;  // IDA Interna -> %DRFA SYNGENTA

  // Filtros (chaves iguais ao data-coluna do HTML Acute)
  const estadoFiltros = {
    "Cultivo/ Matriz Animal": "Todos",
    "ANO POF": "Todos",
    "Região": "Todos",
  };

  // Persistência das IDAs
  const LS_KEYS = {
    idaAnvisa: "IDA_ANVISA_VAL",
    idaSyngenta: "IDA_SYNGENTA_VAL"
  };

  const COLUNAS = [
    "Cultivo/ Matriz Animal",
    "ANO POF",
    "Região",
    "Caso Fórmula",
    "LMR (mg/kg)",
    "HR/MCR (mg/kg)",
    "MREC/STMR (mg/kg)",
    "IMEA (mg/kg p.c./dia)",
    "%DRFA ANVISA",
    "%DRFA SYNGENTA"
  ];

    // Mapa para exibir nomes amigáveis no cabeçalho
  const LABELS = {
    "%DRFA ANVISA": "%DRFA EXTERNA",
    "%DRFA SYNGENTA": "%DRFA INTERNA"
  };

  function displayLabel(col) {
    return LABELS[col] || col;
  }

  // ---------- Utilitários ----------
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

  function parseNum(val) {
    if (val === null || val === undefined) return NaN;
    const s = String(val).trim();
    if (!s || s === '-' || s.toUpperCase() === 'NA') return NaN;
    const norm = s.replace(',', '.');
    const n = Number(norm);
    return Number.isFinite(n) ? n : NaN;
  }

  function fmtCell(v, opts = {}) {
    const { digits, suffix } = opts;
    if (v === null || v === undefined || Number.isNaN(v)) return '';
    const out = (typeof digits === 'number') ? Number(v).toFixed(digits) : String(v);
    return suffix ? `${out}${suffix}` : out;
  }

  const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/"/g, '\\"'));

  function getScrollContainer() {
    return document.querySelector(".table-wrapper");
  }

  function isPositive(x) {
  return Number.isFinite(x) && x > 0;
  }

  // ---------- Cálculos ----------
  function calcularIMEA(item) {
  const caso = String(getCampo(item, "Caso Fórmula") || "").trim();

  const LMR  = parseNum(getCampo(item, "LMR (mg/kg)"));
  const HR   = parseNum(getCampo(item, "HR/MCR (mg/kg)"));
  const STMR = parseNum(getCampo(item, "MREC/STMR (mg/kg)"));

  const MP = parseNum(getCampo(item, "Maior porção MP (g/dia/pessoa)"));
  const PC = parseNum(getCampo(item, "Peso Corpóreo médio dos consumidores PC (kg)"));
  const FP = parseNum(getCampo(item, "Fator de Processamento FP"));
  const FC = parseNum(getCampo(item, "Fator de Conversão FC"));
  const Uc = parseNum(getCampo(item, "Peso Unitário da Parte Comestível Uc (g)"));
  const v  = parseNum(getCampo(item, "Fator de variabilidade v"));

  if ([MP, PC, FP, FC].some(Number.isNaN)) return NaN;

  const MPkg = MP / 1000;
  const Uckg = Uc / 1000;

  // 🔁 Regra de prioridade:
  // - Casos 1/2a/2b: usa LMR se válido (>0), senão HR/MCR
  // - Caso 3:        usa LMR se válido (>0), senão STMR
  const baseC12 = isPositive(LMR) ? LMR : HR;    // fallback HR
  const baseC3  = isPositive(LMR) ? LMR : STMR;  // fallback STMR

  switch (caso) {
    case 'Caso 1': {
      const res = baseC12;
      if (!isPositive(res)) return NaN;
      return (MPkg * res * FP * FC) / PC;
    }
    case 'Caso 2a': {
      const res = baseC12;
      if (!isPositive(res) || Number.isNaN(v) || Number.isNaN(Uckg)) return NaN;
      const parteUc = Uckg * res * FC * FP * v;
      const resto   = (MPkg - Uckg) * res * FC * FP;
      return (parteUc + resto) / PC;
    }
    case 'Caso 2b': {
      const res = baseC12;
      if (!isPositive(res) || Number.isNaN(v)) return NaN;
      return (MPkg * res * FP * FC * v) / PC;
    }
    case 'Caso 3': {
      const res = baseC3;
      if (!isPositive(res)) return NaN;
      return (MPkg * res * FP * FC) / PC;
    }
    default:
      return NaN;
  }
}

  function calcularDRFA(imea, idaRef) {
    if (Number.isNaN(imea) || idaRef === null || idaRef === undefined) return NaN;
    const ref = Number(idaRef);
    if (!Number.isFinite(ref) || ref === 0) return NaN;
    return (imea * 100) / ref;
  }

  // ---------- IDAs (persistência) ----------
  function carregarIDAsDeLocalStorage() {
    const ext = localStorage.getItem(LS_KEYS.idaAnvisa);
    const int = localStorage.getItem(LS_KEYS.idaSyngenta);
    idaAnvisa   = ext ? Number(ext) : null;
    idaSyngenta = int ? Number(int) : null;

    document.querySelectorAll('.editable-btn').forEach(inp => {
      if (idaAnvisa !== null && Number.isFinite(idaAnvisa)) inp.value = String(idaAnvisa);
    });
    document.querySelectorAll('.editable-int').forEach(inp => {
      if (idaSyngenta !== null && Number.isFinite(idaSyngenta)) inp.value = String(idaSyngenta);
    });
  }

  function setupDecimalInput(selector, onValidNumber) {
  document.querySelectorAll(selector).forEach(input => {
    const defaultText = input.dataset.default || input.value;
    input.type = 'text';
    input.setAttribute('inputmode', 'decimal');
    input.autocomplete = 'off';
    input.spellcheck = false;

    
    // ✅ Adiciona tooltip e acessibilidade
    input.title = selector.includes('btn')
      ? "Accepts integers and decimals with dots (.)"
      : "Accepts integers and decimals with dots (.)";

    input.setAttribute('aria-label', input.title);


    if (!input.value) input.value = defaultText;

    let prev = input.value;

    input.addEventListener('focus', () => {
      if (input.value === defaultText) input.value = '';
    });

    input.addEventListener('blur', () => {
      if (input.value.trim() === '') {
        onValidNumber(null);
        input.value = defaultText;
        refreshPreservandoFocoEScroll();
      }
    });

    input.addEventListener('input', () => {
      let v = input.value;

      // ✅ Permite dígitos e ponto (inclusive "0." ou "0.0")
      if (!/^\d*\.?\d*$/.test(v)) {
        input.value = prev; // volta para último válido
        return;
      }

      // Remove pontos extras depois do primeiro
      const i = v.indexOf('.');
      if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');

      prev = v;
      input.value = v;

      // ✅ Se for número completo, envia; senão, envia null
      const n = /^\d+(\.\d+)?$/.test(v) ? parseFloat(v) : null;
      onValidNumber(n);
      
    });
  });
}

  // ---------- Replicação e refresh com foco/scroll ----------
  function refreshPreservandoFocoEScroll(reselectInfo) {
    const sc = getScrollContainer();
    const scrollTop  = sc ? sc.scrollTop  : 0;
    const scrollLeft = sc ? sc.scrollLeft : 0;

    const filtrados = getDadosFiltrados();
    renderizarTabela(filtrados);

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

  // ---------- Persistência dos dados preenchidos ----------
  function salvarDadosNoLocalStorage() {
  dadosOriginais.forEach(item => {
    const caso = String(item["Caso Fórmula"] || "").trim();

    // 🔒 Bloqueios por caso
    if (caso === "Caso 3") {
      item["HR/MCR (mg/kg)"] = "NA";
    }

    if (["Caso 1", "Caso 2a", "Caso 2b"].includes(caso)) {
      item["MREC/STMR (mg/kg)"] = "NA";
    }

    // 🧮 Cálculo de IMEA e DRFA
    const imea = calcularIMEA(item);
    item["IMEA (mg/kg p.c./dia)"] = imea;

    const drfaAnvisa = calcularDRFA(imea, idaAnvisa);
    const drfaSyngenta = calcularDRFA(imea, idaSyngenta);

    item["%DRFA ANVISA"] = Number.isNaN(drfaAnvisa) ? "-" : `${drfaAnvisa.toFixed(2)}%`;
    item["%DRFA SYNGENTA"] = Number.isNaN(drfaSyngenta) ? "-" : `${drfaSyngenta.toFixed(2)}%`;
  });

  // 💾 Salva os dados com os bloqueios e cálculos aplicados
  localStorage.setItem("DADOS_CALCULADORA", JSON.stringify(dadosOriginais));
}

  function replicarEdicao({ cultivo, ano, regiao, coluna, valor }) {
    // Captura caret do input atual (se existir)
    const active = document.activeElement;
    const caret = (active && active.classList.contains("editable-cell") && typeof active.selectionStart === 'number')
      ? active.selectionStart
      : null;

    const reselectInfo = { cultivo, ano, regiao, coluna, caret };
    const anoComplementar = (ano === "2017") ? "2008" : (ano === "2008") ? "2017" : null;

    dadosOriginais.forEach(item => {
      const sameCultivo = String(getCampo(item, "Cultivo/ Matriz Animal")) === String(cultivo);
      const sameAno     = String(getCampo(item, "ANO POF")) === String(ano);
      const sameAnoComplementar = String(getCampo(item, "ANO POF")) === String(anoComplementar);
      
      if (!(sameCultivo && (sameAno || sameAnoComplementar))) return;

      const caso = String(getCampo(item, "Caso Fórmula") || "");

      // Respeitar regras de bloqueio por caso
      if (coluna === "HR/MCR (mg/kg)" && caso === "Caso 3") return;
      if (coluna === "MREC/STMR (mg/kg)" && (caso === "Caso 1" || caso === "Caso 2a" || caso === "Caso 2b")) return;

      item[coluna] = (valor === null ? null : valor); // mantém string "0.0" ou "0.06"
    });

    // Re-render preservando scroll e foco
    refreshPreservandoFocoEScroll(reselectInfo);
    salvarDadosNoLocalStorage(); // ✅ salva os dados atualizados

  }

  // ---------- Inputs numéricos de célula ----------
  // Emite três estados:
  //  - { kind: 'clear' }          -> usuário limpou o campo (replica null)
  //  - { kind: 'number', value:n} -> número válido (replica n)
  //  - { kind: 'intermediate' }   -> digitação parcial (não replica)
  function criarInputNumerico({ valorInicial, disabled, onDecision, placeholder, ctx }) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = placeholder ?? "-";
  input.className = "editable-cell";
  input.disabled = !!disabled;
  input.value = (valorInicial === "-" ? "" : (valorInicial ?? "")).toString();

  if (ctx) {
    input.dataset.ano     = String(ctx.ano ?? "");
    input.dataset.cultivo = String(ctx.cultivo ?? "");
    input.dataset.regiao  = String(ctx.regiao ?? "");
    input.dataset.col     = String(ctx.coluna ?? "");
  }

  if (input.disabled) return input;

  const regexParcial = /^\d*\.?\d*$/;   // permite "0.", "0.0", "0.06"
  const regexFinal   = /^\d+(\.\d+)?$/; // número completo
  let prev = input.value;

  input.addEventListener("input", () => {
    let v = input.value;

    // Só dígitos e um ponto
    if (!regexParcial.test(v)) {
      input.value = prev;
      return;
    }

    // Remove pontos extras após o primeiro
    const i = v.indexOf('.');
    if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');

    prev = v;
    input.value = v; // <- mantém exatamente o que o usuário vê/digitou

    if (v === "") {
      onDecision({ kind: 'clear' });
      return;
    }

    if (regexFinal.test(v)) {
      // Envia string (para preservar "0.0") e numérico (para quem precisar)
      onDecision({ kind: 'number', valueText: v, value: parseFloat(v) });
      return;
    }

    onDecision({ kind: 'intermediate' }); // não re-renderiza
  });

  return input;
}

  // ---------- Filtros ----------
  function inicializarFiltros(data) {
    const cultivos = [...new Set(
      data.map(i => getCampo(i, "Cultivo/ Matriz Animal"))
        .filter(Boolean)
        .map(String)
    )].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

    const anos = [...new Set(
      data.map(i => getCampo(i, "ANO POF"))
        .filter(Boolean)
        .map(String)
    )].sort((a, b) => {
      const na = Number(a), nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b, "pt-BR");
    });

    const regioes = [...new Set(
      data.map(i => getCampo(i, "Região"))
        .filter(Boolean)
        .map(String)
    )].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

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

          const tipo = coluna.dataset.coluna; // "Cultivo/ Matriz Animal" | "ANO POF"
          let opcoes = ["Todos"];
          if (tipo === "Cultivo/ Matriz Animal") opcoes = ["Todos", ...cultivos];
          if (tipo === "ANO POF") opcoes = ["Todos", ...anos];
          if (tipo === "Região") opcoes = ["Todos", ...regioes];

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

  function aplicarFiltros(coluna, valor) {
    estadoFiltros[coluna] = valor;
    refreshPreservandoFocoEScroll();
  }

  function getDadosFiltrados() {
    return dadosOriginais.filter(item => {
      const cultivo = String(getCampo(item, "Cultivo/ Matriz Animal") ?? "");
      const ano    = String(getCampo(item, "ANO POF") ?? "");
      const regiao = String(getCampo(item, "Região") ?? "");

      const filtroCultivoOK =
        estadoFiltros["Cultivo/ Matriz Animal"] === "Todos" ||
        cultivo === String(estadoFiltros["Cultivo/ Matriz Animal"]);

      const filtroAnoOK =
        estadoFiltros["ANO POF"] === "Todos" ||
        ano === String(estadoFiltros["ANO POF"]);

      const filtroRegiaoOK =
        estadoFiltros["Região"] === "Todos" ||
        regiao === String(estadoFiltros["Região"]);

      return filtroCultivoOK && filtroAnoOK && filtroRegiaoOK;
    });
  }

  // ---------- Render ----------
  function renderizarTabela(data) {
    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${COLUNAS.length}" class="no-data">Nenhum dado encontrado.</td></tr>`;
      return;
    }

    data.forEach(item => {
      const tr = document.createElement("tr");      

      const imea = calcularIMEA(item);
      const pctAnvisa = calcularDRFA(imea, idaAnvisa);
      const pctSyngenta = calcularDRFA(imea, idaSyngenta);

      // Se passar de 100%, linha vermelha
      if ((pctAnvisa > 100) || (pctSyngenta > 100)) {
        tr.classList.add("linha-vermelha");
      } else {
        // Só aplica verde se NÃO estiver vermelha
        const regiao = getCampo(item, "Região");
        if (typeof regiao === "string" && regiao.trim() === "Brasil") {
          tr.classList.add("linha-verde");
        }
      }

      COLUNAS.forEach(col => {
        const td = document.createElement("td");

        if (col === "IMEA (mg/kg p.c./dia)") {
          const imea = calcularIMEA(item);
          td.textContent = fmtCell(imea, { digits: 6 });
          tr.appendChild(td);
          return;
        }

        if (col === "%DRFA ANVISA") {
          const imea = calcularIMEA(item);
          const pctAnvisa = calcularDRFA(imea, idaAnvisa);
          td.textContent = fmtCell(pctAnvisa, { digits: 2, suffix: "%" });
          tr.appendChild(td);
          return;
        }

        if (col === "%DRFA SYNGENTA") {
          const imea = calcularIMEA(item);
          const pctSyg = calcularDRFA(imea, idaSyngenta);
          td.textContent = fmtCell(pctSyg, { digits: 2, suffix: "%" });
          tr.appendChild(td);
          return;
        }

        // Entradas com bloqueio por caso
        if (["LMR (mg/kg)", "HR/MCR (mg/kg)", "MREC/STMR (mg/kg)"].includes(col)) {
  // ✅ Adiciona tooltip na célula
          td.title = "Aceita números inteiros e decimais com ponto (.)";
          td.setAttribute("aria-label", "Campo numérico. Aceita inteiros e decimais com ponto.");

          const caso = String(getCampo(item, "Caso Fórmula") || "");
          const isHR = (col === "HR/MCR (mg/kg)");
          const isST = (col === "MREC/STMR (mg/kg)");

          const disableHR = (caso === "Caso 3") && isHR;
          const disableST = (caso === "Caso 1" || caso === "Caso 2a" || caso === "Caso 2b") && isST;
          const disabled  = disableHR || disableST;

          const placeholder = disabled ? "" : "";
          const raw = getCampo(item, col);
          const valorInicial = disabled ? "NA" : (raw === null || raw === undefined ? "" : raw);

          const anoItem     = String(getCampo(item, "ANO POF") ?? "");
          const cultivoItem = String(getCampo(item, "Cultivo/ Matriz Animal") ?? "");
          const regiaoItem  = String(getCampo(item, "Região") ?? "");
          
          const input = criarInputNumerico({
            valorInicial,
            disabled,
            placeholder,
            ctx: { ano: anoItem, cultivo: cultivoItem, regiao: regiaoItem, coluna: col },
            onDecision: (decision) => {
              if (decision?.kind === 'clear') {
                replicarEdicao({ cultivo: cultivoItem, ano: anoItem, regiao: regiaoItem, coluna: col, valor: null });
              } else if (decision?.kind === 'number') {
                replicarEdicao({ cultivo: cultivoItem, ano: anoItem, regiao: regiaoItem, coluna: col, valor: decision.valueText });
              }
            }
          });

          if (disabled) {
            input.value = "NA";
            input.readOnly = true;
          }

          // ✅ Também adiciona tooltip no input (opcional)
          input.title = "Accepts integers and decimals with dots (.)";
          input.setAttribute("aria-label", "Campo numérico. Aceita inteiros e decimais com ponto.");

          td.appendChild(input);
          tr.appendChild(td);
          return;
        }
                // Demais colunas (somente exibição)
        const valor = getCampo(item, col);
        td.textContent = (valor === null || valor === undefined || valor === '') ? "-" : valor;
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // ---------- Carregar do backend ----------
  async function carregarTabela() {    
    const dadosSalvos = localStorage.getItem("DADOS_CALCULADORA");
      if (dadosSalvos) {
        dadosOriginais = JSON.parse(dadosSalvos);
        inicializarFiltros(dadosOriginais);
        refreshPreservandoFocoEScroll();
        return;
      }

    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Erro ao buscar dados");
      const data = await response.json();
      dadosOriginais = Array.isArray(data.tabelaCompleta) ? data.tabelaCompleta : [];

      inicializarFiltros(dadosOriginais);
      refreshPreservandoFocoEScroll();
    } catch (error) {
      console.error("Erro ao carregar tabela:", error);
      tbody.innerHTML = `<tr><td colspan="${COLUNAS.length}" class="no-data">Falha ao carregar os dados.</td></tr>`;
    }
  }

  // ---------- Inicialização ----------
  await carregarTabela();
  carregarIDAsDeLocalStorage();
  refreshPreservandoFocoEScroll();

  // Wire dos inputs de IDA (topo)
  setupDecimalInput('.editable-btn', n => {
    idaAnvisa = (n === null ? null : n);
    if (n === null) localStorage.removeItem(LS_KEYS.idaAnvisa);
    else localStorage.setItem(LS_KEYS.idaAnvisa, String(n));
    refreshPreservandoFocoEScroll();
  });

  setupDecimalInput('.editable-int', n => {
    idaSyngenta = (n === null ? null : n);
    if (n === null) localStorage.removeItem(LS_KEYS.idaSyngenta);
    else localStorage.setItem(LS_KEYS.idaSyngenta, String(n));
    refreshPreservandoFocoEScroll();
  });

  // Botão Clear
  document.querySelector(".btn-clear").addEventListener("click", () => {
    // Zera entradas do usuário
    dadosOriginais.forEach(item => {
      item["LMR (mg/kg)"]      = null;
      item["HR/MCR (mg/kg)"]   = null;
      item["MREC/STMR (mg/kg)"]= null;
    });

    // Restaura placeholders nos inputs topo e limpa IDAs
    document.querySelectorAll(".editable-btn").forEach(input => {
      input.value = input.dataset.default || "IDA_EXTERNA";
    });
    document.querySelectorAll(".editable-int").forEach(input => {
      input.value = input.dataset.default || "IDA_INTERNA";
    });

    idaAnvisa = null;
    idaSyngenta = null;
    localStorage.removeItem(LS_KEYS.idaAnvisa);
    localStorage.removeItem(LS_KEYS.idaSyngenta);

   
    // ✅ Limpa os dados preenchidos salvos
    localStorage.removeItem("DADOS_CALCULADORA");

    refreshPreservandoFocoEScroll();
  });

// === COLAR COLUNA DO EXCEL -> preenche de onde estiver o foco até o final (LMR/HR/MCR/MREC) ===
(function enableExcelPaste(){
  const PASTE_COLUMNS = ["LMR (mg/kg)", "HR/MCR (mg/kg)", "MREC/STMR (mg/kg)"];

  document.addEventListener('paste', (event) => {
    const active = document.activeElement;
    if (!active || !active.classList.contains('editable-cell')) return;

    const currentCol = active.dataset.col;
    if (!PASTE_COLUMNS.includes(currentCol)) return; // só nessas 3 colunas

    // Evita que o onInput padrão dispare re-render a cada célula
    event.preventDefault();

    const clipboard = event.clipboardData?.getData('text') ?? '';
    const matrix = parseClipboard(clipboard); // linhas -> colunas (TSV Excel)

    if (!matrix.length) return;

    // Inputs visíveis da coluna atual, na ordem renderizada (respeita filtros)
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
        // Múltiplas colunas (TSV): espalhar para colunas à direita na ordem LMR -> HR/MCR -> MREC/STMR
        const startColIdx = PASTE_COLUMNS.indexOf(currentCol);
        for (let j = 0; j < colsThisRow.length; j++) {
          const targetCol = PASTE_COLUMNS[startColIdx + j];
          if (!targetCol) break; // ignorar excesso
          const valText = normalizeNumberText(colsThisRow[j]);
          const valor = interpretToken(valText);

          // Localiza o input daquela linha/coluna
          const sel = `.editable-cell[data-ano="${esc(ctx.ano)}"][data-cultivo="${esc(ctx.cultivo)}"][data-regiao="${esc(ctx.regiao)}"][data-col="${esc(targetCol)}"]`;
          const cell = document.querySelector(sel);
          if (cell && !cell.readOnly && !cell.disabled) {
            ops.push({ ...ctx, coluna: targetCol, valor });
          }
        }
      }
    }

    aplicarEdicoesEmLote(ops);
    mostrarFeedback(`Colados ${ops.length} valor(es).`);
  });

  function parseClipboard(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return [];
    // Separa por linhas e por TAB (TSV vindo do Excel)
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
    // Mantém como string para preservar "0.0" (sua UI lida bem com string numérica)
    return /^\d+(\.\d+)?$/.test(s) ? s : null;
  }

  function aplicarEdicoesEmLote(ops) {
    if (!Array.isArray(ops) || ops.length === 0) return;

    // Snapshot do foco para restaurar depois
    const active = document.activeElement;
    const caret = (active && typeof active.selectionStart === 'number') ? active.selectionStart : null;
    const reselectInfo = active ? {
      cultivo: active.dataset.cultivo,
      ano: active.dataset.ano,
      regiao: active.dataset.regiao,
      coluna: active.dataset.col,
      caret
    } : null;

    // Aplica cada operação replicando lógica de bloqueio e ano complementar (igual ao replicarEdicao)
    for (const { cultivo, ano, regiao, coluna, valor } of ops) {
      const anoComplementar = (ano === "2017") ? "2008" : (ano === "2008") ? "2017" : null;

      for (const item of dadosOriginais) {
        const sameCultivo = String(getCampo(item, "Cultivo/ Matriz Animal")) === String(cultivo);
        const sameAno     = String(getCampo(item, "ANO POF")) === String(ano);
        const sameAnoComp = anoComplementar && String(getCampo(item, "ANO POF")) === String(anoComplementar);
        if (!(sameCultivo && (sameAno || sameAnoComp))) continue;

        const caso = String(getCampo(item, "Caso Fórmula") || "");
        // Regras de bloqueio por caso (mesmas do render)
        if (coluna === "HR/MCR (mg/kg)" && caso === "Caso 3") continue;
        if (coluna === "MREC/STMR (mg/kg)" && (caso === "Caso 1" || caso === "Caso 2a" || caso === "Caso 2b")) continue;

        item[coluna] = (valor === null ? null : valor);
      }
    }

    // Recalcula/bloqueia/persistir (seu método já faz tudo isso)
    salvarDadosNoLocalStorage();

    // Re-render preservando scroll e foco
    refreshPreservandoFocoEScroll(reselectInfo);
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

});

    const modal = document.getElementById("btn-infoCrop");
    const btn = document.querySelector(".btn-infoCrop");
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
