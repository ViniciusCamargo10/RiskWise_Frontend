// auth-check.js

console.log("Auth-check carregado");

if (localStorage.getItem("loggedIn") !== "true") {
    window.location.href = "login.html";
}