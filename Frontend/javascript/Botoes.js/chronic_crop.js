document.addEventListener("DOMContentLoaded", () => {
    const API_URL = "http://localhost:8000/dados";
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

                
                if (item["Região"]?.trim() === "Brasil") {
                    tr.classList.add("linha-verde");
                }


                colunas.forEach((col, index) => {
                    const td = document.createElement("td");

                    if (["LMR (mg_kg)", "MREC_STMR (mg_kg)", "Market Share"].includes(col)) {
                        const input = document.createElement("input");
                        input.type = "number"; // só aceita números
                        input.value = item[col] ?? "";
                        input.className = "editable-cell";
                        input.step = "any"; // permite decimais

                        // Evento para replicar valor para o mesmo cultivo
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
        } catch (error) {
            console.error("Erro ao carregar tabela:", error);
        }
    }

    carregarTabela();
});
