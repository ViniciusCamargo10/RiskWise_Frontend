console.log("Auth-check carregado");

// Verifica se está no navegador
if (typeof window !== "undefined") {
    const isLoggedIn = sessionStorage.getItem("loggedIn") === "true";
    const currentPath = window.location.pathname;

    // Se não estiver logado e não estiver na página de login, redireciona
    if (!isLoggedIn && currentPath !== "/login.html") {
        window.location.href = "/login.html";
    }
}

function login() {
    // Depois de validar usuário e senha
    sessionStorage.setItem("loggedIn", "true");
    window.location.href = "/index.html"; // Página principal
}

function logout() {
    sessionStorage.removeItem("loggedIn");
    window.location.href = "/login.html";
}
