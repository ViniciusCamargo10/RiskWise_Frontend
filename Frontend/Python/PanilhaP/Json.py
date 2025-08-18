import pandas as pd

# Caminho do arquivo Excel
excel_file = "C:\\Users\\s1337626\\Downloads\\DietaAguda_Calculadora_V4.xlsx"

# Ler a planilha
df = pd.read_excel(excel_file)

# Converter para JSON
json_file = "acute_crop.json"
df.to_json(json_file, orient="records", force_ascii=False)

print(f"Arquivo JSON salvo em: {json_file}")
