document.addEventListener("DOMContentLoaded", () => {
    const concInput = document.getElementById("inputConc");
    const adultoInput = document.getElementById("inputAdulto");
    const criancaInput = document.getElementById("inputCrianca");

    const LS_KEYS = {
        conc: "CRONICO_conc",
        adulto: "CRONICO_adulto",
        crianca: "CRONICO_crianca",
        idaAnvisa: "CRONICO_IDA_ANVISA_VAL",
        idaSyngenta: "CRONICO_IDA_SYNGENTA_VAL"
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
    // ---------------- Função para inputs decimais ----------------
    function setupDecimalInput(selector, onValidNumber) {
    document.querySelectorAll(selector).forEach(input => {
        const defaultText = input.dataset?.default ?? input.value ?? "";
        input.type = 'text';
        input.setAttribute('inputmode', 'decimal');
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.title = 'Accepts integers and decimals with dots (.)';

        if (!input.value && defaultText) input.value = defaultText;

        input.addEventListener('focus', () => {
            if (defaultText && input.value === defaultText) input.value = '';
        });

        input.addEventListener('blur', () => {
            if (input.value.trim() === '') {
                onValidNumber?.(null);
                if (defaultText) input.value = defaultText;
                atualizarCalculo();
            }
        });

        input.addEventListener('input', () => {
            let v = input.value.replace(/[^0-9.]/g, '');
            const firstDot = v.indexOf('.');
            if (firstDot !== -1) {
                v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
            }
            input.value = v;
            // Se quiser, pode adicionar setCaretToEnd(input);

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
        
    // Defina as variáveis ANTES de usar!
        const extAdulto = calc(2, pesoAdulto, idaAnvisa);
        const intAdulto = calc(2, pesoAdulto, idaSyngenta);
        const extCrianca = calc(1, pesoCrianca, idaAnvisa);
        const intCrianca = calc(1, pesoCrianca, idaSyngenta);

        document.getElementById("outExtAdulto").textContent = calc(2, pesoAdulto, idaAnvisa);
        document.getElementById("outIntAdulto").textContent = calc(2, pesoAdulto, idaSyngenta);
        document.getElementById("outExtCrianca").textContent = calc(1, pesoCrianca, idaAnvisa);
        document.getElementById("outIntCrianca").textContent = calc(1, pesoCrianca, idaSyngenta);

        localStorage.setItem("CRONICO_outExtAdulto", extAdulto);
        localStorage.setItem("CRONICO_outIntAdulto", intAdulto);
        localStorage.setItem("CRONICO_outExtCrianca", extCrianca);
        localStorage.setItem("CRONICO_outIntCrianca", intCrianca);

    }

    // ---------------- Botão Clear ----------------
    document.querySelector(".btn-clear").addEventListener("click", () => {
        concInput.value = "";
        adultoInput.value = "";
        criancaInput.value = "";

        document.querySelectorAll(".editable-btn").forEach(input => {
            input.value = input.dataset.default || "IDA_EXTERNA";
        });
        document.querySelectorAll(".editable-int").forEach(input => {
            input.value = input.dataset.default || "IDA_INTERNA";
        });

        idaAnvisa = null;
        idaSyngenta = null;

        localStorage.removeItem(LS_KEYS.conc);
        localStorage.removeItem(LS_KEYS.adulto);
        localStorage.removeItem(LS_KEYS.crianca);
        localStorage.removeItem(LS_KEYS.idaAnvisa);
        localStorage.removeItem(LS_KEYS.idaSyngenta);        
        localStorage.removeItem("CRONICO_outExtAdulto");
        localStorage.removeItem("CRONICO_outIntAdulto");
        localStorage.removeItem("CRONICO_outExtCrianca");
        localStorage.removeItem("CRONICO_outIntCrianca");


        atualizarCalculo();
    });

    // ---------------- Salvar valores ----------------
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

    setupDecimalInput('#inputConc', n => {
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

    setupDecimalInput('.editable-btn', n => {
        idaAnvisa = n;
        if (n === null) localStorage.removeItem(LS_KEYS.idaAnvisa);
        else localStorage.setItem(LS_KEYS.idaAnvisa, String(n));
        atualizarCalculo();
    });

    setupDecimalInput('.editable-int', n => {
        idaSyngenta = n;
        if (n === null) localStorage.removeItem(LS_KEYS.idaSyngenta);
        else localStorage.setItem(LS_KEYS.idaSyngenta, String(n));
        atualizarCalculo();
    });
});
    const modal = document.getElementById("btn-infoC");
    const btn = document.querySelector(".btn-infoC");
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
