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

// === Carregar dados da API e preencher tabela ===
document.addEventListener("DOMContentLoaded", () => {
    const API_URL = "http://localhost:8000/dados"; // ajuste se necessário
    const tbody = document.getElementById("tabela-dados");

    if (!tbody) {
        console.warn("Elemento #tabela-dados não encontrado.");
        return;
    }

    async function carregarTabela() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error("Erro ao buscar dados");
            const data = await response.json();

            tbody.innerHTML = ""; // limpa linhas antigas

            data.forEach(item => {
                const tr = document.createElement("tr");

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

                colunas.forEach(col => {
                    const td = document.createElement("td");
                    td.textContent = item[col] ?? "-";
                    tr.appendChild(td);
                });

                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error("Erro ao carregar tabela:", error);
        }
    }

    carregarTabela();
});
