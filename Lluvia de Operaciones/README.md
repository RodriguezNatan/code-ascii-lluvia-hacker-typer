# Lluvia de Operaciones

Juego de cálculo con dificultad progresiva. Requiere Python 3.12 y Kivy.

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python main.py
```

Escribe la respuesta y pulsa Enter. Retroceso borra, Supr limpia y P/Esc pausa. Usa 1–4 para las opciones de álgebra.

La configuración permite ajustar el tiempo inicial entre 5 y 120 segundos.

Para ejecutar las pruebas:

```powershell
python -m unittest discover -p "test_*.py"
```

Licencia: MIT; consulta `LICENSE`.
