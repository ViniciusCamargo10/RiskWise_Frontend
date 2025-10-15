console.log("Script carregado");

const USERS = {
    "banana9790": "1065chuchu",
    "banana7437": "4799chuchu"
};

document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault(); // ✅ Impede envio padrão

    const username = document.querySelector("[name=username]").value.trim();
    const password = document.querySelector("[name=password]").value.trim();

    if (USERS[username] && USERS[username] === password) {
        localStorage.setItem("loggedIn", "true");
        window.location.href = "index.html";
    } else {
        document.getElementById("errorMsg").style.display = "block";
    }
});