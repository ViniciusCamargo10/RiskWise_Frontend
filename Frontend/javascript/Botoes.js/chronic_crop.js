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

