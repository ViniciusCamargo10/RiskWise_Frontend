// calculator.js para home
document.addEventListener("DOMContentLoaded", () => {
  const homeBtn = document.getElementById("btn-home");
  if (!homeBtn) {
    console.warn("Botão Home (#btn-home) não encontrado na calculadora.");
    return;
  }

  // Clique do mouse
  homeBtn.addEventListener("click", () => {
    window.location.href = "./index.html";
  });

  // Acessibilidade (Enter/Espaço)
  homeBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      window.location.href = "./index.html";
    }
  });
});

// library.js para calculadora
document.addEventListener("DOMContentLoaded", () => {
  const calculatorBtn = document.getElementById("btn-calculator");
  if (!calculatorBtn) {
    console.warn("Botão Calculator (#btn-calculator) não encontrado na calculadora.");
    return;
  }

  // Clique do mouse
  homeBtn.addEventListener("click", () => {
    window.location.href = "./calculator.html";
  });

  // Acessibilidade (Enter/Espaço)
  homeBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      window.location.href = "./calculator.html";
    }
  });
});

// calculator.js para report 
document.addEventListener("DOMContentLoaded", () => {
  const reportBtn = document.getElementById("btn-report");
  if (!reportBtn) {
    console.warn("Botão report (#btn-report) não encontrado na calculadora.");
    return;
  }

  // Clique do mouse
  homeBtn.addEventListener("click", () => {
    window.location.href = "./report.html";
  });

  // Acessibilidade (Enter/Espaço)
  homeBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      window.location.href = "./report.html";
    }
  });
});

// calculator.js para library 
document.addEventListener("DOMContentLoaded", () => {
  const libraryBtn = document.getElementById("btn-library");
  if (!libraryBtn) {
    console.warn("Botão library (#btn-library) não encontrado na calculadora.");
    return;
  }

  // Clique do mouse
  homeBtn.addEventListener("click", () => {
    window.location.href = "./library.html";
  });

  // Acessibilidade (Enter/Espaço)
  homeBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      window.location.href = "./library.html";
    }
  });
});

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


fetch('../../javascript/Botoes.js/acute_crop.json')
  .then(response => response.json())
  .then(data => {
    renderTabela(data);
  });

function renderTabela(dados) {
  const tabela = document.getElementById('tabela-dados');
  tabela.innerHTML = '';
  tabela.innerHTML += `
    <tr>
      <th>Cultivo</th>
      <th>Ano POF</th>
      <th>Região</th>
      <th>Caso Fórmula</th>
      <th>LMR (mg/kg)</th>
      <th>HR/MCR (mg/kg)</th>
      <th>MREC/STMR (mg/kg)</th>
      <th>IMEA (mg/kg p.c/dia)</th>
      <th>%DRFA ANVISA</th>
      <th>%DRFA SYNGENTA</th>
    </tr>
  `;
  dados.forEach(item => {
    tabela.innerHTML += `
      <tr>
        <td>${item['Cultivo/ Matriz Animal'] || ''}</td>
        <td>${item['ANO POF'] || ''}</td>
        <td>${item['Região'] || ''}</td>
        <td>${item['Caso Fórmula'] || ''}</td>
        <td>${item['LMR (mg/kg)'] || ''}</td>
        <td>${item['HR/MCR (mg/kg)'] || ''}</td>
        <td>${item['MREC/STMR (mg/kg)'] || ''}</td>
        <td>${item['IMEA (mg/kg p.c./dia)'] || ''}</td>
        <td>${item['%DRFA ANVISA'] || ''}</td>
        <td>${item['%DRFA SYNGENTA'] || ''}</td>
      </tr>
    `;
  });
}

