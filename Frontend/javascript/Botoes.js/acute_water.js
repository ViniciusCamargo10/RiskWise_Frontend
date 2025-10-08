document.addEventListener("DOMContentLoaded", () => {
    const concInput = document.getElementById("inputConc");
    const adultoInput = document.getElementById("inputAdulto");
    const criancaInput = document.getElementById("inputCrianca");

    const LS_KEYS = {
        conc: "conc",
        adulto: "adulto",
        crianca: "crianca",
        idaAnvisa: "IDA_ANVISA_VAL",
        idaSyngenta: "IDA_SYNGENTA_VAL"
    };

    let idaAnvisa = null;
    let idaSyngenta = null;

    // Carregar valores salvos
    concInput.value = localStorage.getItem(LS_KEYS.conc) || "";
    adultoInput.value = localStorage.getItem(LS_KEYS.adulto) || "";
    criancaInput.value = localStorage.getItem(LS_KEYS.crianca) || "";

    function carregarIDAsDeLocalStorage() {
        const ext = localStorage.getItem(LS_KEYS.idaAnvisa);
        const int = localStorage.getItem(LS_KEYS.idaSyngenta);
        idaAnvisa = ext ? Number(ext) : null;
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

            if (!input.value) input.value = defaultText;

            input.addEventListener('focus', () => {
                if (input.value === defaultText) input.value = '';
            });

            input.addEventListener('blur', () => {
                if (input.value.trim() === '') {
                    onValidNumber(null);
                    input.value = defaultText;
                    atualizarCalculo();
                }
            });

            
            input.addEventListener('input', () => {
                let v = input.value;

                // Remove tudo que não for número ou ponto
                v = v.replace(/[^0-9.]/g, '');

                // Se começar com ponto, adiciona zero antes
                if (v.startsWith('.')) {
                    v = '0' + v;
                }

                // Permite apenas um ponto
                const firstDot = v.indexOf('.');
                if (firstDot !== -1) {
                    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
                }

                input.value = v;

                const n = /^\d+(\.\d+)?$/.test(v) ? parseFloat(v) : null;
                onValidNumber(n);
                atualizarCalculo();
            });

        });
    }

    function atualizarCalculo() {
        const conc = parseFloat(concInput.value);
        const pesoAdulto = parseFloat(adultoInput.value);
        const pesoCrianca = parseFloat(criancaInput.value);

        const calc = (fator, peso, ida) => {
            if (!isNaN(conc) && !isNaN(peso) && ida && !isNaN(ida) && ida !== 0) {
                return (((fator * conc) / peso) / ida * 100).toFixed(2) + "%";
            }
            return "-";
        };

        document.getElementById("outExtAdulto").textContent = calc(2, pesoAdulto, idaAnvisa);
        document.getElementById("outIntAdulto").textContent = calc(2, pesoAdulto, idaSyngenta);
        document.getElementById("outExtCrianca").textContent = calc(1, pesoCrianca, idaAnvisa);
        document.getElementById("outIntCrianca").textContent = calc(1, pesoCrianca, idaSyngenta);
    }

    // Botão Clear Report
document.querySelector(".btn-clear").addEventListener("click", () => {
    // Limpar inputs principais
    concInput.value = "";
    adultoInput.value = "";
    criancaInput.value = "";

    // Limpar inputs DRFA
    document.querySelectorAll(".editable-btn").forEach(input => {
        input.value = input.dataset.default || "DRFA_EXTERNA";
    });
    document.querySelectorAll(".editable-int").forEach(input => {
        input.value = input.dataset.default || "DRFA_INTERNA";
    });

    // Resetar variáveis
    idaAnvisa = null;
    idaSyngenta = null;

    // Remover do localStorage
    localStorage.removeItem(LS_KEYS.conc);
    localStorage.removeItem(LS_KEYS.adulto);
    localStorage.removeItem(LS_KEYS.crianca);
    localStorage.removeItem(LS_KEYS.idaAnvisa);
    localStorage.removeItem(LS_KEYS.idaSyngenta);

    // Atualizar a tabela (colocar "-" nos resultados)
    atualizarCalculo();
});

    // Salvar valores sempre que mudar
    [concInput, adultoInput, criancaInput].forEach(input => {
        input.addEventListener("input", () => {
            localStorage.setItem(LS_KEYS.conc, concInput.value);
            localStorage.setItem(LS_KEYS.adulto, adultoInput.value);
            localStorage.setItem(LS_KEYS.crianca, criancaInput.value);
            atualizarCalculo();
        });
    });

    carregarIDAsDeLocalStorage();
    atualizarCalculo();

    setupDecimalInput('.editable-btn', n => {
        idaAnvisa = (n === null ? null : n);
        if (n === null) localStorage.removeItem(LS_KEYS.idaAnvisa);
        else localStorage.setItem(LS_KEYS.idaAnvisa, String(n));
        atualizarCalculo();
    });

    setupDecimalInput('.editable-int', n => {
        idaSyngenta = (n === null ? null : n);
        if (n === null) localStorage.removeItem(LS_KEYS.idaSyngenta);
        else localStorage.setItem(LS_KEYS.idaSyngenta, String(n));
        atualizarCalculo();
    });
});

