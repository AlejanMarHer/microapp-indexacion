import pandas as pd
import json

def procesar_archivo_banrep():
    archivo_banrep = "2_IPC_2018_por_division_de_gasto_iqy.xlsx"
    print(f"Leyendo el archivo oficial: {archivo_banrep}...")
    
    try:
        df = pd.read_excel(archivo_banrep, header=None)
    except FileNotFoundError:
        print(f"Error: Asegúrate de que el archivo {archivo_banrep} esté en la carpeta.")
        return

    # Buscar dinámicamente la fila de inicio (donde dice 'Fecha (Mes año)')
    fila_fechas = df[df.eq('Fecha (Mes año)').any(axis=1)].index[0]
    
    # Rastrear las columnas para ubicar el cruce entre "Total" e "Índice"
    # AQUÍ ESTÁ EL CAMBIO: Usamos .ffill() directo para versiones modernas de Pandas
    categorias = df.iloc[fila_fechas - 1].ffill()
    sub_encabezados = df.iloc[fila_fechas]
    
    col_indice_total = None
    for col in df.columns:
        if str(categorias[col]).strip() == 'Total' and str(sub_encabezados[col]).strip() == 'Índice':
            col_indice_total = col
            break
            
    if col_indice_total is None:
        print("Error: No se encontró la columna de Índice Total.")
        return
        
    # Extraer únicamente las columnas de Fecha e Índice Total
    df_limpio = df.iloc[fila_fechas + 1:, [0, col_indice_total]].copy()
    df_limpio.columns = ['Fecha', 'Indice']
    
    # Limpiar y parsear fechas
    df_limpio = df_limpio.dropna()
    df_limpio['Fecha'] = pd.to_datetime(df_limpio['Fecha'], errors='coerce')
    df_limpio = df_limpio.dropna()
    df_limpio = df_limpio.sort_values('Fecha')
    
    # Construir el Diccionario para la app
    ipc_data = {}
    for index, row in df_limpio.iterrows():
        ano = row['Fecha'].year
        mes = row['Fecha'].month
        indice = float(row['Indice'])
        
        # Formato YYYY-MM para búsquedas instantáneas
        llave = f"{ano}-{mes:02d}"
        
        ipc_data[llave] = {
            "ano": ano,
            "mes": mes,
            "indice": round(indice, 5)
        }

    # Sobrescribir nuestro archivo de base de datos
    with open('ipc_data.json', 'w', encoding='utf-8') as f:
        json.dump(ipc_data, f, indent=2)
        
    fecha_min = df_limpio['Fecha'].min().date()
    fecha_max = df_limpio['Fecha'].max().date()
    print(f"¡Éxito total! Se procesaron {len(ipc_data)} meses.")
    print(f"La base histórica ahora va desde {fecha_min} hasta {fecha_max}.")

if __name__ == "__main__":
    procesar_archivo_banrep()