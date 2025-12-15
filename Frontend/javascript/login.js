console.log("Script carregado");

const USERS = {
    "tomate5234": "2242laranja",
    "tomate3034": "5491laranja",
    "tomate7928": "4624laranja",
    "tomate7060": "6939laranja",
    "tomate3486": "6123laranja",
    "tomate8346": "4139laranja"
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