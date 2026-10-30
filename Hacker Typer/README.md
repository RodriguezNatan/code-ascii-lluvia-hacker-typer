# Hacker Typer

Juego de terminal con misiones, habilidades, combate y progresión.

## Jugar en el navegador

Desde esta carpeta, ejecuta:

```powershell
python -m http.server 8000 --directory public
```

Abre http://localhost:8000 en el navegador.

## Desarrollo

Requiere Node.js. Edita `src` y reconstruye las versiones web:

```powershell
npm run build
npm test
```

`public` contiene la versión para jugar. `development` se genera al compilar y contiene las herramientas de desarrollo de `dev`.

`desktop` contiene el contenedor Electron para Windows. Para usar `npm start`, instala el runtime de Electron correspondiente a `desktop/runtime-info.json` en `runtime`. Los ejecutables no se incluyen en este repositorio.
