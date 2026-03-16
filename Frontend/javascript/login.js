console.log("Script carregado");

const USERS = {
    "tomate9671": "6316laranja",
    "tomate7345": "9908laranja",
    "tomate4190": "4935laranja",
    "tomate3948": "3754laranja",
    "tomate5705": "6855laranja",
    "tomate1372": "5393laranja",
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