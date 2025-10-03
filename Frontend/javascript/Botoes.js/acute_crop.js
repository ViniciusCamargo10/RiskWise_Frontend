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
    "IMEA (mg/kg p.c./dia)",
    "%DRFA ANVISA",
    "%DRFA SYNGENTA"
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

  // ---------------- Criação de Input Numérico ----------------
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

    // Aqui você pode criar dropdowns para filtros (igual ao crônico)
    // Por enquanto, apenas console.log:
    console.log("Cultivos:", cultivos);
    console.log("Anos:", anos);
  }

  // ---------------- Inicialização ----------------
  await carregarTabela();

  // Botão Clear
  document.querySelector(".btn-clear").addEventListener("click", () => {
    dadosOriginais.forEach(item => {
      item["LMR (mg/kg)"] = null;
      item["HR/MCR (mg/kg)"] = null;
      item["MREC/STMR (mg/kg)"] = null;
    });
    renderizarTabela(dadosOriginais);
  });
});