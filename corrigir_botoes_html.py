import os
import re

BASE_DIR = "Frontend/html/Botoes_html"

# Padrões de substituição
replacements = {
    r'\.\./css/': '/css/',
    r'\.\./imagens/': '/imagens/',
    r'\.\./javascript/': '/javascript/',
    r'\.\./index\.html': '/index.html',
    r'\.\./calculatorHome\.html': '/calculatorHome.html',
    r'\.\./report\.html': '/report.html',
    r'\.\./LibraryHome\.html': '/LibraryHome.html',
    r'\.\./': '/'  # Corrige casos como ..//css/
}

def corrigir_botoes_html():
    alterados = []

    for root, _, files in os.walk(BASE_DIR):
        for file in files:
            if file.endswith(".html"):
                caminho = os.path.join(root, file)
                with open(caminho, "r", encoding="utf-8") as f:
                    conteudo = f.read()

                original = conteudo

                # Aplica as substituições
                for padrao, novo in replacements.items():
                    conteudo = re.sub(padrao, novo, conteudo)

                if conteudo != original:
                    # Salva backup
                    backup = caminho + ".bak"
                    with open(backup, "w", encoding="utf-8") as f:
                        f.write(original)
                    # Salva arquivo corrigido
                    with open(caminho, "w", encoding="utf-8") as f:
                        f.write(conteudo)
                    alterados.append(caminho)

    print(f"✅ Corrigidos {len(alterados)} arquivos:")
    for arq in alterados:
        print(f" - {arq}")

if __name__ == "__main__":
    corrigir_botoes_html()