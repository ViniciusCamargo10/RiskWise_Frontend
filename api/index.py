# api/index.py
from Backend.main import app

# O Vercel precisa que a variável "app" esteja disponível no escopo global
# Não precisa de nada além disso, pois o FastAPI já está configurado no main.py