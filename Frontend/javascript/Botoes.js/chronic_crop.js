document.addEventListener("DOMContentLoaded", () => {
    const API_URL = "http://localhost:8000/dados";
    const tbody = document.getElementById("tabela-dados");
    const filtroCultivo = document.getElementById("filtro-cultivo");
    const filtroAno = document.getElementById("filtro-ano");
    const btnFiltro = document.getElementById("btn-filtro");
    const containerFiltros = document.getElementById("filtros-container");

    let dadosOriginais = [];

    // Botão para expandir/recolher filtros
    btnFiltro.addEventListener("click", () => {
        const visivel = containerFiltros.style.display === "block";
        containerFiltros.style.display = visivel ? "none" : "block";
        btnFiltro.textContent = visivel ? "Filtros ▼" : "Filtros ▲";
    });

    async function carregarTabela() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error("Erro ao buscar dados");
            const data = await response.json();
            dadosOriginais = data;

            preencherFiltros(data);
            renderizarTabela(data);
        } catch (error) {
            console.error("Erro ao carregar tabela:", error);
        }
    }

    function preencherFiltros(data) {
        const cultivosUnicos = [...new Set(data.map(item => item["Cultivo"]))];
        const anosUnicos = [...new Set(data.map(item => item["ANO_POF"]))];

        filtroCultivo.innerHTML = "<option value=''>Todos os cultivos</option>";
        cultivosUnicos.forEach(cultivo => {
            const opt = document.createElement("option");
            opt.value = cultivo;
            opt.textContent = cultivo;
            filtroCultivo.appendChild(opt);
        });

        filtroAno.innerHTML = "<option value=''>Todos os anos</option>";
        [2008, 2017].forEach(ano => {
            const opt = document.createElement("option");
            opt.value = ano;
            opt.textContent = ano;
            filtroAno.appendChild(opt);
        });
    }

    function renderizarTabela(data) {
        tbody.innerHTML = "";
        data.forEach(item => {
            const tr = document.createElement("tr");
            if (item["Região"]?.trim() === "Brasil") {
                tr.classList.add("linha-verde");
            }

            const colunas = [
                "Cultivo",
                "ANO_POF",
                "Região",
                "LMR (mg_kg)",
                "MREC_STMR (mg_kg)",
                "Market Share",
                "IDMT (Numerador)",
                "Contribuição Individual do Cultivo"
            ];

            colunas.forEach((col, index) => {
                const td = document.createElement("td");
                if (["LMR (mg_kg)", "MREC_STMR (mg_kg)", "Market Share"].includes(col)) {
                    const input = document.createElement("input");
                    input.type = "number";
                    input.value = item[col] ?? "";
                    input.className = "editable-cell";
                    input.step = "any";

                    input.addEventListener("input", () => {
                        const cultivo = tr.querySelector("td").textContent;
                        const allRows = document.querySelectorAll("#tabela-dados tr");
                        allRows.forEach(row => {
                            const cultivoCell = row.querySelector("td");
                            if (cultivoCell && cultivoCell.textContent === cultivo) {
                                const targetInput = row.children[index].querySelector("input");
                                if (targetInput && targetInput !== input) {
                                    targetInput.value = input.value;
                                }
                            }
                        });
                    });

                    td.appendChild(input);
                } else {
                    td.textContent = item[col] ?? "-";
                }
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });
    }

    function aplicarFiltros() {
        const cultivoSelecionado = filtroCultivo.value;
        const anoSelecionado = filtroAno.value;

        const filtrados = dadosOriginais.filter(item => {
            const cultivoMatch = cultivoSelecionado ? item["Cultivo"] === cultivoSelecionado : true;
            const anoMatch = anoSelecionado ? item["ANO_POF"] === parseInt(anoSelecionado) : true;
            return cultivoMatch && anoMatch;
        });

        renderizarTabela(filtrados);
    }

    filtroCultivo.addEventListener("change", aplicarFiltros);
    filtroAno.addEventListener("change", aplicarFiltros);

    carregarTabela();
});
