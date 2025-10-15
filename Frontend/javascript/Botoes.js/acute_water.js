document.addEventListener("DOMContentLoaded", () => {
    const concInput = document.getElementById("inputConc");
    const adultoInput = document.getElementById("inputAdulto");
    const criancaInput = document.getElementById("inputCrianca");

    const LS_KEYS = {
        conc: "conc",
        adulto: "adulto",
        crianca: "crianca",
        idaAnvisa: "AGUDO_IDA_ANVISA_VAL",
        idaSyngenta: "AGUDO_IDA_SYNGENTA_VAL"
    };

    let idaAnvisa = null;
    let idaSyngenta = null;

    // ---------------- Carregar valores salvos ----------------
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

    // ---------------- Utilitário de cursor ----------------
    function setCaretToEnd(el) {
        try {
            const len = el.value.length;
            el.setSelectionRange(len, len);
        } catch {}
    }

    // ---------------- Função de input decimal (só ponto) + auto ponto após 0 ----------------
    function setupDecimalInput(selector, onValidNumber) {
        document.querySelectorAll(selector).forEach(input => {
            const defaultText = input.dataset?.default ?? input.value ?? "";
            input.type = 'text';
            input.setAttribute('inputmode', 'decimal');
            input.autocomplete = 'off';
            input.spellcheck = false;
            input.title = 'Accepts integers and decimals with dots (.)';

            // Se não houver valor, mantém como está (para .editable-* pode mostrar rótulo via dataset.default)
            if (!input.value && defaultText) input.value = defaultText;

            input.addEventListener('focus', () => {
                // Para .editable-*, se estiver mostrando o rótulo "bonito", limpa para digitar
                if (defaultText && input.value === defaultText) input.value = '';
            });

            input.addEventListener('blur', () => {
                // Se ficar vazio ao sair do foco: zera o valor lógico e restaura rótulo (se houver)
                if (input.value.trim() === '') {
                    onValidNumber?.(null);
                    if (defaultText) input.value = defaultText;
                    atualizarCalculo();
                }
            });

            
            input.addEventListener('input', () => {
                let v = input.value;

                // Remove tudo que não for número ou ponto
                v = v.replace(/[^0-9.]/g, '');

                // Permite apenas um ponto
                const firstDot = v.indexOf('.');
                if (firstDot !== -1) {
                        v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
                }

                input.value = v;
                setCaretToEnd(input);

                const isValidFinal = /^\d+(\.\d+)?$/.test(v);
                const n = isValidFinal ? parseFloat(v) : null;

                onValidNumber(n);
                atualizarCalculo();
            });


        });
    }

    // ---------------- Cálculo ----------------
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

    // ---------------- Botão Clear ----------------
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

    // ---------------- Salvar valores sempre que mudar (preserva até estados parciais como '0.') ----------------
    [concInput, adultoInput, criancaInput].forEach(input => {
        input.addEventListener("input", () => {
            localStorage.setItem(LS_KEYS.conc, concInput.value);
            localStorage.setItem(LS_KEYS.adulto, adultoInput.value);
            localStorage.setItem(LS_KEYS.crianca, criancaInput.value);
            atualizarCalculo();
        });
    });

    // ---------------- Inicialização ----------------
    carregarIDAsDeLocalStorage();
    atualizarCalculo();

    // Aplicar lógica aos inputs principais e salvar valores "bons" quando existirem
    setupDecimalInput('#inputConc', n => {
        // Armazena o número parseado quando completo; o listener acima já salva o texto parcial
        if (n !== null) localStorage.setItem(LS_KEYS.conc, String(n));
        atualizarCalculo();
    });
    setupDecimalInput('#inputAdulto', n => {
        if (n !== null) localStorage.setItem(LS_KEYS.adulto, String(n));
        atualizarCalculo();
    });
    setupDecimalInput('#inputCrianca', n => {
        if (n !== null) localStorage.setItem(LS_KEYS.crianca, String(n));
        atualizarCalculo();
    });

    // Aplicar lógica aos inputs de DRFA (editable)
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


    const modal = document.getElementById("btn-info");
    const btn = document.querySelector(".btn-info");
    const span = document.querySelector(".close");

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

