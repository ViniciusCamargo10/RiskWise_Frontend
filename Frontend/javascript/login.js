console.log("Script carregado");

const USERS = {
    "tomate3728": "5483laranja",
    "tomate6640": "6073laranja",
    "tomate5410": "1874laranja",
    "tomate3168": "8346laranja",
    "tomate1484": "3767laranja",
    "tomate5207": "5531laranja"
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