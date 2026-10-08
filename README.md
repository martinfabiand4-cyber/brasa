# Brasa

Lector personal de libros EPUB y PDF para Windows y Linux. Todo se guarda en tu equipo: no hay cuentas, red ni sincronización.

Versión 0.1: biblioteca, lectura de EPUB y PDF, marcadores, índice, progreso y ajustes. Está hecha con Tauri 2, React y TypeScript.

## Qué incluye la 0.1

- **Biblioteca** con portadas en tonos carmesí, orden alfabético, más reciente o descargado recientemente, y filtro de favoritos.
- **Importar** con el botón o arrastrando archivos a la ventana. Solo acepta `.epub` y `.pdf`. Un libro duplicado (mismo contenido) se rechaza, y un archivo dañado muestra un aviso sin dejar basura en la biblioteca.
- **Lectura paginada o en desplazamiento**, para ambos formatos.
- **Zonas de toque**: el 30 % izquierdo retrocede, el 30 % derecho avanza y el centro muestra u oculta los menús.
- **Índice**, **marcadores** y **barra de progreso** con la posición.
- **Ajustes**: idioma (español o inglés), tema Noche o Papel, transición de página (deslizar, desvanecer o ninguna), flujo, tamaño de texto del EPUB y zoom del PDF.
- **Teclado**: flechas, `Re Pág`/`Av Pág` y espacio para cambiar de página; `M` para mostrar u ocultar los menús; `Esc` para volver a la biblioteca.

No incluye todavía (planeado para versiones siguientes): resaltados y notas, búsqueda de texto, desplazamiento automático, pasar página "tipo papel" (curva), contraseñas de PDF, lectura en voz alta, diccionario y sincronización.

## Dónde se guardan los datos

- **Windows:** `%APPDATA%\com.brasa.reader\` (biblioteca en `library.json`, libros en `books\`).
- **Linux:** `~/.local/share/com.brasa.reader/`.

Al importar, el libro se copia a esa carpeta. Borrar un libro en la app también borra su copia.

## Requisitos

### Windows 10 u 11

1. **Node.js LTS** (20 o superior): https://nodejs.org
2. **Rust** con rustup: https://rustup.rs (acepta la instalación por defecto, con el toolchain MSVC).
3. **Visual Studio Build Tools** con la carga de trabajo *Desarrollo para escritorio con C++*. Rustup te lo indicará si falta.
4. **WebView2**: viene instalado en Windows 10 y 11. Si no está, instala el *Runtime* de Microsoft Edge WebView2.

### Linux (Debian o Ubuntu y derivados)

```bash
sudo apt update
sudo apt install -y build-essential curl wget file libxdo-dev libssl-dev \
  libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

Después instala **Node.js LTS** y **Rust** con rustup (https://rustup.rs). Para otras distribuciones, sigue la guía de Tauri para tu sistema: https://tauri.app/start/prerequisites/

## Windows sin instalar nada: construir en GitHub

Es la forma más sencilla si solo quieres usar Brasa en Windows. GitHub compila el instalador en sus máquinas con Windows.

1. Crea una cuenta gratuita en https://github.com si no tienes una.
2. Instala **GitHub Desktop** (https://desktop.github.com), inicia sesión y ve a *File → Add local repository*. Elige la carpeta `brasa`. Si te pregunta si quieres crear un repositorio ahí, acepta. Luego pulsa *Publish repository* (puedes dejarlo privado).
3. En github.com, abre tu repositorio, entra en la pestaña **Actions**, elige **Build Windows** y pulsa **Run workflow**.
4. Espera unos 10 a 15 minutos. Cuando termine, abre esa ejecución y descarga el archivo **brasa-windows** en la sección *Artifacts*.
5. Descomprímelo. Ahí están `Brasa_0.1.0_x64-setup.exe` (instalador) y `brasa.exe` (sin instalar; necesita WebView2, que ya viene en Windows 10 y 11).

Windows mostrará una advertencia de SmartScreen porque la app no está firmada: pulsa *Más información* y luego *Ejecutar de todas formas*.

## Ejecutar en tu computadora

Desde la carpeta del proyecto:

```bash
npm install          # instala las dependencias (una sola vez)
npm run tauri dev    # abre la app en modo desarrollo
```

La primera vez, Rust compila las dependencias y puede tardar varios minutos. Las siguientes veces es rápido.

Para generar un instalador o paquete:

```bash
npm run tauri build
```

- En Windows, el instalador queda en `src-tauri\target\release\bundle\nsis\`.
- En Linux, el paquete `.deb` queda en `src-tauri/target/release/bundle/deb/`.

Para correr las pruebas unitarias y la verificación de tipos:

```bash
npm test
npm run typecheck
```

## Estructura

- `src/lib/`: formatos, orden, ajustes, almacenamiento e importación (sin dependencias de interfaz).
- `src/engine/`: motores de lectura (`epub.js` y `pdf.js`).
- `src/reader/`: lectores de EPUB y PDF, paginados y en desplazamiento.
- `src/views/`, `src/components/`, `src/state/`: biblioteca, lector, paneles y estado.
- `src/styles/`: tokens de color y tipografía en `tokens.css`.
- `src-tauri/`: la aplicación de escritorio (Rust) y sus permisos en `capabilities/default.json`.

## Estado de las pruebas (0.1)

Probado en Linux (Ubuntu, WebKitGTK), con libros de prueba: importar EPUB y PDF, rechazar duplicados, rechazar un EPUB dañado sin dejar archivos, leer EPUB y PDF por páginas, zonas de toque de los bordes, teclado, barra de progreso y reanudar donde quedaste. Las pruebas unitarias (19) pasan.

Todavía sin probar en esta versión: arrastrar archivos a la ventana, modo de desplazamiento, marcadores, índice, ajustes (idioma, tema, transición, tamaño de texto y zoom) y la compilación en Windows.

## Limitaciones conocidas

- **Clics dentro del EPUB en Linux:** en mis pruebas con WebKitGTK, el motor no entregó clics al contenido del libro (ni siquiera a un marco de prueba mínimo). Por eso las zonas de toque de los bordes están sobre el libro y funcionan en ambos sistemas, y el centro se controla con `M`. En Windows, el motor (WebView2, basado en Chromium) entrega los clics normalmente. Esto no pude confirmarlo en un escritorio Linux real.
- **PDF en memoria:** el archivo completo se carga en memoria al abrirlo. Libros muy grandes consumen RAM proporcional a su tamaño.
- **PDF protegidos con contraseña** se rechazan con un aviso; la app no pide la contraseña todavía.
- **DRM:** los libros con protección DRM no se pueden abrir.
- **Windows:** la compilación para Windows no se probó en esta versión; el código es el mismo, pero conviene verificar el instalador en tu equipo.
