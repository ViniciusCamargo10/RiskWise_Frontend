console.log("Auth-check carregado");

// Verifica se está no navegador (evita erro em SSR)
if (typeof window !== "undefined") {
    const isLoggedIn = localStorage.getItem("loggedIn") === "true";
    const currentPath = window.location.pathname;

    // Se não estiver logado e não estiver na página de login, redireciona
    if (!isLoggedIn && currentPath !== "/login.html") {
        window.location.href = "/login.html"; // Use caminho absoluto
    }
}