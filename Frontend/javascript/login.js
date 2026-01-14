console.log("Script carregado");

const USERS = {
    "tomate2070": "6378laranja",
    "tomate8362": "2968laranja",
    "tomate2467": "8212laranja",
    "tomate2821": "9114laranja",
    "tomate2525": "1791laranja",
    "tomate2880": "2896laranja"
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