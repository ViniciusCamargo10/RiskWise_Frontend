import os
import re

# Caminho base do Frontend
BASE_DIR = "Frontend"

# Padrões de substituição para HTML
html_replacements = {
    r'\.\./css/': '/css/',
    r'\.\./imagens/': '/imagens/',
    r'\.\./javascript/': '/javascript/',
    r'(\s)href="\./': r'\1href="/',  # Corrige links entre páginas
    r'(\s)src="\./': r'\1src="/'
}

# Padrões de substituição para CSS
css_replacements = {
    r'url\(["\']?\.\./imagens/': 'url("/imagens/',
    r'url\(["\']?fundo\.jpg["\']?\)': 'url("/imagens/fundo.jpg")'
}

# Corrigir também arquivos JS (caso tenham caminhos de imagens)
js_replacements = {
    r'\.\./imagens/': '/imagens/'
}

def corrigir_arquivos():
    alterados = []

    for root, _, files in os.walk(BASE_DIR):
        for file in files:
            if file.endswith((".html", ".css", ".js")):
                caminho = os.path.join(root, file)
                with open(caminho, "r", encoding="utf-8") as f:
                    conteudo = f.read()

                original = conteudo

                # Substituições
                if file.endswith(".html"):
                    for padrao, novo in html_replacements.items():
                        conteudo = re.sub(padrao, novo, conteudo)
                elif file.endswith(".css"):
                    for padrao, novo in css_replacements.items():
                        conteudo = re.sub(padrao, novo, conteudo)
                elif file.endswith(".js"):
                    for padrao, novo in js_replacements.items():
                        conteudo = re.sub(padrao, novo, conteudo)

                # Se houve alteração, salva backup e escreve novo conteúdo
                if conteudo != original:
                    backup = caminho + ".bak"
                    with open(backup, "w", encoding="utf-8") as f:
                        f.write(original)
                    with open(caminho, "w", encoding="utf-8") as f:
                        f.write(conteudo)
                    alterados.append(caminho)

    print(f" Corrigidos {len(alterados)} arquivos:")
    for arq in alterados:
        print(f" - {arq}")

if __name__ == "__main__":
    corrigir_arquivos()