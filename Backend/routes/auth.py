from fastapi import APIRouter, Form
from fastapi.responses import RedirectResponse, HTMLResponse
import os

router = APIRouter()

# Credenciais fixas
USERS = {
    "admin": "1234",
    "vinicius": "senha123",
    "josiani": "syngenta2025"
}

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "Frontend", "html")

@router.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    if username in USERS and USERS[username] == password:
        # ✅ Redireciona para index.html
        return RedirectResponse(url="/index.html", status_code=303)
    return HTMLResponse("<h1>Login inválido</h1>")