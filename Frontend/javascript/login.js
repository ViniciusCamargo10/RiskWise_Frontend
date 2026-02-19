console.log("Script carregado");

const USERS = {
    "tomate6895": "2739laranja",
    "tomate8177": "3746laranja",
    "tomate6902": "5316laranja",
    "tomate7414": "5491laranja",
    "tomate5301": "3125laranja",
    "tomate9649": "3950laranja",
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