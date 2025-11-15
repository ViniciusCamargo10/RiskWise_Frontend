# RiskWise

## Introdução
RiskWise é uma ferramenta web para cálculo de risco dietário agudo, crônico e água, integrando dados de consumo e limites máximos de resíduos (LMR) para culturas agrícolas e água.  
O projeto foi desenvolvido com **HTML, CSS, JavaScript, FastAPI (Python)** e está preparado para **deploy no Vercel**.

---

## 🛠 Tecnologias
- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Python (FastAPI)
- **Infra:** Vercel
- **Dados:** Planilhas Excel
---

## 📂 Estrutura do Projeto
RiskWise/
│
├── api/
│   ├── index.py
│   └── requirements.txt
│
├── Backend/
│   ├── data/
│   ├── routes/
│   ├── utils/
│   ├── main.py
│   └── venv/
│
├── Frontend/
│   ├── css/
│   ├── html/
│   ├── imagens/
│   ├── javascript/
│   └── favicon.ico
│
├── legacy/
├── corrigir_botoes_html.py
├── corrigir_caminhos.py
├── vercel.json
└── .gitignore
--

## Funcionalidades

Login: Campos username, password e botão Login.
Dashboard: Botões principais:

Calculator → Calculadoras (MX Crop, BR Crop, Water, Animal).
Documents → Exportação de relatórios (Excel, PDF, Word).
Search → Guidelines, dados POF e tabelas Excel.
--

## Calculadoras

MX Crop:
Cálculo crônico com campos LMR, R, C e resultados (BW, SUM, IDMT, %ADI).

BR Crop:
Acute: DRFA Ext/Int, filtros (Cultivo, Ano POF, Região), resultados (%DRFA).
Chronic: IDA Ext/Int, POF 2008/2017, Market Share.

Water:
Acute: DRFA Ext/Int, campos para concentração de água e pesos.
Chronic: IDA Ext/Int, mesma lógica.
--

## Exportação
Relatórios disponíveis em Excel, PDF e Word.
--

## Segurança
Dados anonimizados.
Sistema de Login.
--

📈 Roadmap

Implementar calculadora Animal.
Melhorar integração com banco de dados.
