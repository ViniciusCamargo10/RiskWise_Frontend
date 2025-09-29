document.addEventListener("DOMContentLoaded", () => {
  'use strict';

  const API_URL = "http://localhost:8000/dados";
  const tbody = document.getElementById("tabela-dados");

  // Estado dos filtros (cumulativos)
  const estadoFiltros = { Cultivo: "Todos", ANO_POF: "Todos" };

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
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function fmt(v) {
    return (v === null || v === undefined || v === "") ? "-" : v;
  }

  // ---------------- Criação de Input Numérico com replicação (sem re-render) ----------------
  function criarInputNumerico(valorInicial, onValidChange, placeholderText = "-", ano = null, cultivo = null, coluna = null) {
    const input = document.createElement("input");
    input.type = "text";              // 'text' para controlar a entrada
    input.inputMode = "decimal";      // teclado decimal em mobile
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = placeholderText;
    input.className = "editable-cell";
    input.value = (valorInicial === "-" ? "" : (valorInicial ?? "")).toString();

    input.title = "Aceita números inteiros e decimais com ponto (.)";

    const regexParcial = /^\d*\.?\d*$/;
    const regexFinal   = /^\d+(\.\d+)?$/;

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
      const v = input.value;

      // escaper para seletores CSS
      const esc = (s) => window.CSS && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/"/g, '\\"');

      if (!regexParcial.test(v)) {
        input.value = prev;
        const caret = input.value.length;
        try { input.setSelectionRange(caret, caret); } catch {}
        input.style.borderColor = "#e53935";
        return;
      }

      input.style.borderColor = "#ccc";
      prev = v;

      if (typeof onValidChange === "function") {
        // 🔹 Caso: o usuário APAGOU tudo (string vazia) -> limpar todos os irmãos
        if (v === "") {
          onValidChange(null);

          if (ano != null && cultivo != null && coluna) {
            // 1) Atualiza o modelo de dados: zera/limpa todos do mesmo (ano,cultivo,coluna)
            dadosOriginais.forEach(item => {
              if (
                String(getCampo(item, "ANO_POF")) === String(ano) &&
                String(getCampo(item, "Cultivo")) === String(cultivo)
              ) {
                item[coluna] = null;
              }
            });

            // 2) Atualiza o DOM visível: limpa os outros inputs correspondentes
            const selector =
              `.editable-cell[data-col="${esc(coluna)}"][data-ano="${esc(ano)}"][data-cultivo="${esc(cultivo)}"]`;

            document.querySelectorAll(selector).forEach(el => {
              if (el !== input) {
                el.value = "";              // mostra placeholder
                flashUpdate(el);            // opcional: destaque visual
              }
            });

            flashUpdate(input);             // opcional
          }
          return; // evita cair no branch numérico
        }

        // 🔹 Caso: número válido -> replicar preenchimento
        if (regexFinal.test(v)) {
          const num = Number(v);
          onValidChange(num);

          // Replicar para linhas com MESMO ANO + MESMO CULTIVO na MESMA COLUNA (sem re-render)
          if (ano != null && cultivo != null && coluna) {
            // 1) Atualiza o modelo de dados
            dadosOriginais.forEach(item => {
              if (
                String(getCampo(item, "ANO_POF")) === String(ano) &&
                String(getCampo(item, "Cultivo")) === String(cultivo)
              ) {
                item[coluna] = num;
              }
            });

            // 2) Atualiza o DOM visível (sem re-render)
            const selector =
              `.editable-cell[data-col="${esc(coluna)}"][data-ano="${esc(ano)}"][data-cultivo="${esc(cultivo)}"]`;

            document.querySelectorAll(selector).forEach(el => {
              if (el !== input) {
                el.value = String(num);
                flashUpdate(el); // opcional
              }
            });

            flashUpdate(input); // opcional
          }
        } else {
          // estados intermediários (ex.: '10.'), não replicamos, mas mantemos model atual como null
          onValidChange(null);
        }
      }
    }

    return input;
  }

  // ---------------- Carregamento ----------------

  async function carregarTabela() {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Erro ao buscar dados");
      const data = await response.json();
      dadosOriginais = Array.isArray(data.tabelaCompleta) ? data.tabelaCompleta : [];

      renderizarTabela(dadosOriginais);
      inicializarFiltros(dadosOriginais);
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
          td.title = "Aceita números inteiros e decimais com ponto (.)";
          td.setAttribute("aria-label", "Campo numérico. Aceita inteiros e decimais com ponto.");

          const anoItem = getCampo(item, "ANO_POF");
          const cultivoItem = getCampo(item, "Cultivo");
          const regiaoItem = getCampo(item, "Região");

          const input = criarInputNumerico(
            valor,
            (novoValor) => { item[col] = novoValor; },
            "-",
            anoItem,          // ano
            cultivoItem,      // cultivo
            col               // coluna atual
          );

          // Data-atributos para localizar inputs "irmãos" sem re-render
          input.dataset.ano = String(anoItem);
          input.dataset.cultivo = String(cultivoItem);
          input.dataset.regiao = String(regiaoItem);
          input.dataset.col = col;

          td.appendChild(input);
        } else {
          td.textContent = valor;
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // ---------------- Filtros ----------------

  function inicializarFiltros(data) {
    const cultivosUnicos = [...new Set(
      data.map(i => getCampo(i, "Cultivo")).filter(v => v && String(v).trim() !== "")
    )].sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" }));

    const anosUnicosRaw = data
      .map(i => getCampo(i, "ANO_POF"))
      .filter(v => v && String(v).trim() !== "");

    const anosUnicos = [...new Set(anosUnicosRaw.map(v => {
      const n = toNumberSafe(v);
      return n !== null ? n : String(v).trim();
    }))].sort((a, b) => {
      const na = toNumberSafe(a);
      const nb = toNumberSafe(b);
      if (na !== null && nb !== null) return na - nb;
      return String(a).localeCompare(String(b), "pt-BR");
    });

    document.querySelectorAll(".coluna-filtro").forEach(coluna => {
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

    let filtrados = dadosOriginais.filter(item => {
      const cultivoItem = getCampo(item, "Cultivo");
      const anoItem = getCampo(item, "ANO_POF");

      const filtroCultivoOK =
        estadoFiltros.Cultivo === "Todos" ||
        (cultivoItem && String(cultivoItem) === String(estadoFiltros.Cultivo));

      const filtroAnoOK =
        estadoFiltros.ANO_POF === "Todos" ||
        (toNumberSafe(anoItem) !== null && toNumberSafe(estadoFiltros.ANO_POF) !== null
          ? toNumberSafe(anoItem) === toNumberSafe(estadoFiltros.ANO_POF)
          : String(anoItem) === String(estadoFiltros.ANO_POF));

      return filtroCultivoOK && filtroAnoOK;
    });

    renderizarTabela(filtrados);
  }

  carregarTabela();
});

// ---------------- Inputs Ext e Int ----------------

let idaAnvisa = null;
let idaSyngenta = null;

function setupDecimalInput(selector, defaultText, onValidNumber) {
  document.querySelectorAll(selector).forEach(input => {
    input.type = 'text';
    input.setAttribute('inputmode', 'decimal');
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.title = 'Aceita números inteiros e decimais com ponto (.)';

    input.addEventListener('focus', () => {
      if (input.value === defaultText) input.value = '';
    });

    input.addEventListener('blur', () => {
      if (input.value.trim() === '') input.value = defaultText;
    });

    input.addEventListener('input', () => {
      let v = input.value.replace(/[^0-9.]/g, '');
      const i = v.indexOf('.');
      if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');
      if (v.startsWith('.')) v = '0' + v;
      input.value = v;

      onValidNumber(/^\d+(\.\d+)?$/.test(v) ? parseFloat(v) : null);
    });
  });
}

setupDecimalInput('.editable-btn', 'Ext', n => { idaAnvisa = n; });
setupDecimalInput('.editable-int', 'Int', n => { idaSyngenta = n; });

// ---------------- (Opcional) Destaque visual ao replicar ----------------

function flashUpdate(el) {
  // Adiciona/remover uma classe que pode ter animação no CSS
  el.classList.add('flash-update');
  setTimeout(() => el.classList.remove('flash-update'), 600);
}

//------------------- POF 2008 --------------------------------------------
carregarTabelaPOF2008();

async function carregarTabelaPOF2008() {
  try {
    const response = await fetch("http://localhost:8000/dados");
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
      const tdTitulo = document.createElement("td");
      tdTitulo.textContent = metrica.replace("_", " ");
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

carregarTabelaPOF2017();

async function carregarTabelaPOF2017() {
  try {
    const response = await fetch("http://localhost:8000/dados");
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
      const tdTitulo = document.createElement("td");
      tdTitulo.textContent = metrica.replace("_", " ");
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

