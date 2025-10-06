document.addEventListener("DOMContentLoaded", async () => {
  'use strict';

  const API_URL = "http://localhost:8000/acute/dados";
  const tbody = document.getElementById("tabela-dados");

  // Estado dos filtros
  const estadoFiltros = { Cultivo: "Todos", ANO_POF: "Todos" };

  // Colunas na ordem desejada
  const COLUNAS = [
    "Cultivo/ Matriz Animal",
    "ANO POF",
    "Região",
    "Caso Fórmula",
    "LMR (mg/kg)",
    "HR/MCR (mg/kg)",
    "MREC/STMR (mg/kg)",
    "%DRFA ANVISA",
    "%DRFA SYNGENTA"
  ];

  let dadosOriginais = [];
  let idaExterna = null;
  let idaInterna = null;

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

  // ---------------- Criação de Input Numérico para tabela ----------------
  function criarInputNumerico(valorInicial, onValidChange) {
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "-";
    input.className = "editable-cell";
    input.value = (valorInicial === "-" ? "" : (valorInicial ?? "")).toString();

    const regexParcial = /^\d*\.?\d*$/;
    const regexFinal = /^\d+(\.\d+)?$/;

    let prev = input.value;

    input.addEventListener("input", () => {
      const v = input.value;
      if (!regexParcial.test(v)) {
        input.value = prev;
        return;
      }
      prev = v;
      onValidChange(regexFinal.test(v) ? parseFloat(v) : null);
    });

    return input;
  }

  // ---------------- Função para inputs principais (IDA_EXTERNA / IDA_INTERNA) ----------------
  function setupDecimalInput(selector, onValidNumber) {
    document.querySelectorAll(selector).forEach(input => {
      const defaultText = input.dataset.default || input.value;
      input.type = 'text';
      input.setAttribute('inputmode', 'decimal');
      input.autocomplete = 'off';
      input.spellcheck = false;

      if (!input.value) input.value = defaultText;

      input.addEventListener('focus', () => {
        if (input.value === defaultText) input.value = '';
      });

      input.addEventListener('blur', () => {
        if (input.value.trim() === '') {
          onValidNumber(null);
          input.value = defaultText;
        }
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

  // ---------------- Carregar dados ----------------
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
      tbody.innerHTML = `<tr><td colspan="${COLUNAS.length}" class="no-data">Falha ao carregar os dados.</td></tr>`;
    }
  }

  // ---------------- Renderização ----------------
  function renderizarTabela(data) {
    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${COLUNAS.length}" class="no-data">Nenhum dado encontrado.</td></tr>`;
      return;
    }

    data.forEach(item => {
      const tr = document.createElement("tr");

      COLUNAS.forEach(col => {
        const td = document.createElement("td");
        const valor = fmt(getCampo(item, col));

        if (["LMR (mg/kg)", "HR/MCR (mg/kg)", "MREC/STMR (mg/kg)"].includes(col)) {
          const input = criarInputNumerico(valor, (novoValor) => {
            item[col] = novoValor;
            // Futuro: recalcular IMEA e %DRFA aqui
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
    const cultivos = [...new Set(data.map(i => getCampo(i, "Cultivo/ Matriz Animal")))].filter(Boolean);
    const anos = [...new Set(data.map(i => getCampo(i, "ANO POF")))].filter(Boolean);

    console.log("Cultivos:", cultivos);
    console.log("Anos:", anos);
  }

  // ---------------- Inicialização ----------------
  await carregarTabela();

  // Inicializa inputs principais com lógica visual + numérica
  setupDecimalInput('.editable-btn', n => { idaExterna = n; /* lógica futura */ });
  setupDecimalInput('.editable-int', n => { idaInterna = n; /* lógica futura */ });

  // Botão Clear
  document.querySelector(".btn-clear").addEventListener("click", () => {
    dadosOriginais.forEach(item => {
      item["LMR (mg/kg)"] = null;
      item["HR/MCR (mg/kg)"] = null;
      item["MREC/STMR (mg/kg)"] = null;
    });
    renderizarTabela(dadosOriginais);

    // Restaura rótulos visuais nos inputs principais
    document.querySelectorAll(".editable-btn, .editable-int").forEach(input => {
      const defaultText = input.dataset.default || input.value;
      input.value = defaultText;
    });

    idaExterna = null;
    idaInterna = null;
  });
});