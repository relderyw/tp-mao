import pandas as pd
df = pd.read_excel('Mapeamento  Importado 103ki.xlsx', header=None)
for i, row in df.head(100).iterrows():
    print(f"L{i} | C4:{row[4]} | C5:{row[5]} | C25:{row[25]}")
