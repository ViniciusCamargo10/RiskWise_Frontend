document.addEventListener("DOMContentLoaded", () => {
    const concInput = document.getElementById("inputConc");
    const adultoInput = document.getElementById("inputAdulto");
    const criancaInput = document.getElementById("inputCrianca");

    const LS_KEYS = {
        conc: "conc",
        adulto: "adulto",
        crianca: "crianca",
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
            inp.value = (idaAnvisa !== null && Number.isFinite(idaAnvisa))
                ? String(idaAnvisa)
                : (inp.dataset.default || "IDA_EXTERNA");
        });
        document.querySelectorAll('.editable-int').forEach(inp => {
            inp.value = (idaSyngenta !== null && Number.isFinite(idaSyngenta))
                ? String(idaSyngenta)
                : (inp.dataset.default || "IDA_INTERNA");
        });
    }

    // ---------------- Função para inputs decimais ----------------
    function setupDecimalInput(selector, onValidNumber) {
        document.querySelectorAll(selector).forEach(input => {
            const defaultText = input.dataset.default || input.value;
            input.type = 'text';
            input.setAttribute('inputmode', 'decimal');
            input.autocomplete = 'off';
            input.spellcheck = false;
            input.title = 'Aceita números inteiros e decimais com ponto (.)';

            // Mostra rótulo inicial se vazio
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

    const modal = document.getElementById("info-buttonC");
    const btn = document.querySelector(".info-buttonC");
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


});