console.log("Script carregado");

const USERS = {
    "tomate2273": "7519laranja",
    "tomate9883": "5658laranja",
    "tomate5623": "8299laranja",
    "tomate7539": "9646laranja",
    "tomate9783": "2154laranja",
    "tomate1111": "7503laranja"
};

document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const username = document.querySelector("[name=username]").value.trim();
    const password = document.querySelector("[name=password]").value.trim();

    if (USERS[username] && USERS[username] === password) {
        sessionStorage.setItem("loggedIn", "true");
        window.location.href = "index.html";
    } else {
        document.getElementById("errorMsg").style.display = "block";
    }
});