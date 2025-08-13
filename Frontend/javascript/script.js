// Modal
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
}

// Clique nos cards
function handleCardClick(cardType, event) {
    const clickedCard = event.currentTarget;
    clickedCard.style.transform = 'scale(0.95)';
    setTimeout(() => {
        clickedCard.style.transform = '';
    }, 150);

    switch(cardType) {
        case 'home':
            alert('Você já está na home');
            break;
        case 'calculator':
            window.location.href = 'calculator.html';
            break;
        case 'document':
            alert('Funcionalidade Documentos - Em desenvolvimento');
            break;
        case 'search':
            alert('Funcionalidade Busca - Em desenvolvimento');
            break;
        default:
            alert('Ação não definida');
    }
}

// Tecla Enter ou Espaço ativa o card
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        const focusedElement = document.activeElement;
        if (focusedElement.classList.contains('card')) {
            focusedElement.click();
        }
    }
});

// Animações de entrada
window.addEventListener('load', function() {
    const cards = document.querySelectorAll('.card');
    const header = document.querySelector('.header');
    const footer = document.querySelector('.footer');

    header.style.opacity = '0';
    header.style.transform = 'translateY(-20px)';
    header.style.transition = 'all 0.6s ease';

    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.6s ease';
    });

    footer.style.opacity = '0';
    footer.style.transform = 'translateY(20px)';
    footer.style.transition = 'all 0.6s ease';

    setTimeout(() => {
        header.style.opacity = '1';
        header.style.transform = 'translateY(0)';
    }, 100);

    cards.forEach((card, index) => {
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 200 + (index * 100));
    });

    setTimeout(() => {
        footer.style.opacity = '1';
        footer.style.transform = 'translateY(0)';
    }, 600);
});
