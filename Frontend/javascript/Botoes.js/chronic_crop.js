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

  // Cria input NUMÉRICO permitindo estados intermediários (., 10.)
  function criarInputNumerico(valorInicial, onValidChange, placeholderText = "-") {
    const input = document.createElement("input");
    input.type = "text";              // 'text' para controlar a entrada
    input.inputMode = "decimal";      // teclado decimal em mobile
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = placeholderText;
    input.className = "editable-cell";
    input.value = (valorInicial === "-" ? "" : (valorInicial ?? "")).toString();

    // Tooltip de ajuda
    input.title = "Aceita números inteiros e decimais com ponto (.)";

    // Estados válidos
    const regexParcial = /^\d*\.?\d*$/;     // permite '', '.', '10.', '10.5'
    const regexFinal   = /^\d+(\.\d+)?$/;   // aceita apenas '10' ou '10.5'

    // Guardar valor anterior para reverter quando necessário
    let prev = input.value;

    // Bloqueia caracteres inválidos na digitação
    input.addEventListener("beforeinput", (e) => {
      // Permitir deleção normalmente
      if (
        e.inputType === "deleteContentBackward" ||
        e.inputType === "deleteContentForward" ||
        e.inputType === "deleteByCut"
      ) return;

      // Colagem será tratada em 'paste'
      if (e.inputType === "insertFromPaste") return;

      // Inserção de caractere único
      const ch = e.data;
      if (typeof ch === "string") {
        // Apenas dígitos ou ponto
        if (!/[\d.]/.test(ch)) {
          e.preventDefault();
          return;
        }

        // Permite no máximo um ponto (respeitando seleção)
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

    // Sanear colagem: apenas dígitos e no máximo um ponto
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const clipboard = (e.clipboardData || window.clipboardData).getData("text") ?? "";
      let sanitized = clipboard.replace(/[^\d.]/g, ""); // remove tudo exceto dígitos e ponto

      // Construir valor final com no máximo um ponto
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

      // Aceitar apenas se for um estado parcial válido
      if (regexParcial.test(final)) {
        input.value = final;
        prev = input.value;
        validarAtualizar();
      }
      // se não for válido, simplesmente ignora a colagem
    });

    // Valida a cada alteração (inclui digitação/colagem)
    input.addEventListener("input", () => {
      validarAtualizar();
    });

    function validarAtualizar() {
      const v = input.value;

      // Se não bate com o padrão parcial, reverte imediatamente
      if (!regexParcial.test(v)) {
        // reverte mantendo o caret no fim
        input.value = prev;
        const caret = input.value.length;
        try { input.setSelectionRange(caret, caret); } catch {}
        input.style.borderColor = "#e53935"; // feedback rápido
        return;
      }

      // É parcial válido: manter
      input.style.borderColor = "#ccc";
      prev = v;

      // Atualiza modelo somente quando for final válido (número completo)
      if (typeof onValidChange === "function") {
        if (regexFinal.test(v)) {
          onValidChange(Number(v));
        } else if (v === "") {
          onValidChange(null);
        } else {
          // estado intermediário ('.' ou '10.'): não atualiza número
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
      dadosOriginais = Array.isArray(data) ? data : [];

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

      // Destaque de linha para "Brasil"
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

          const input = criarInputNumerico(valor, (novoValor) => {
            // Atualiza o item com Number ou null apenas quando final válido
            item[col] = novoValor;
          });

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

  // ---------------- Start ----------------
  carregarTabela();
});

document.querySelectorAll('.editable-btn').forEach(input => {
    input.addEventListener('focus', () => {
        if (input.value === 'Ext') {
            input.value = '';
        }
    });

    input.addEventListener('blur', () => {
        if (input.value.trim() === '') {
            input.value = 'Ext';
        }
    });

    input.addEventListener('input', () => {
        input.value = input.value.replace(/[^0-9]/g, '');
    });
});

document.querySelectorAll('.editable-int').forEach(input => {
    input.addEventListener('focus', () => {
        if (input.value === 'Int') {
            input.value = '';
        }
    });

    input.addEventListener('blur', () => {
        if (input.value.trim() === '') {
            input.value = 'Int';
        }
    });

    input.addEventListener('input', () => {
        input.value = input.value.replace(/[^0-9]/g, '');
    });
});

let idaAnvisa = null;
let idaSyngenta = null;

const extInput = document.querySelector('.editable-btn');
const intInput = document.querySelector('.editable-int');

// Captura e valida o valor do botão Ext (IDA ANVISA)
extInput.addEventListener('input', () => {
  const valor = extInput.value.replace(/[^0-9.]/g, '');
  extInput.value = valor;
  idaAnvisa = valor ? parseFloat(valor) : null;
});

// Captura e valida o valor do botão Int (IDA SYNGENTA)
intInput.addEventListener('input', () => {
  const valor = intInput.value.replace(/[^0-9.]/g, '');
  intInput.value = valor;
  idaSyngenta = valor ? parseFloat(valor) : null;
});

