// calculator.js
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
