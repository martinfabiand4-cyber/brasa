# Brasa

Lector personal de libros EPUB y PDF para Windows y Linux. Todo se guarda en tu equipo: no hay cuentas, red ni sincronización.

Versión 0.1: biblioteca, lectura de EPUB y PDF, marcadores, índice, progreso y ajustes. Está hecha con Tauri 2, React y TypeScript.

## Qué incluye

- **Biblioteca** con portadas: las de los PDF y EPUB que la traen (la primera página en el caso de PDF); si no hay portada, un color generado en tonos carmesí. Orden alfabético, más reciente o descargado recientemente, y filtro de favoritos. Los libros importados antes de esta versión reciben su portada al abrir la biblioteca.
- **Importar** con el botón o arrastrando archivos a la ventana. Solo acepta `.epub` y `.pdf`. Un libro duplicado (mismo contenido) se rechaza, y un archivo dañado muestra un aviso sin dejar basura en la biblioteca.
- **Quitar un libro** pide confirmación con un diálogo del estilo de la app.
- **Lectura paginada o en desplazamiento**, para ambos formatos.
- **Zonas de toque**: el 30 % izquierdo retrocede, el 30 % derecho avanza y el centro muestra u oculta los menús.
- **Barra de herramientas** flotante a la izquierda, con índice, buscar, marcador, brillo y ajustes.
- **Buscar en todo el libro**: escribe una palabra y verás cada aparición, con el texto alrededor y el número de página o sección. Ignora mayúsculas y acentos, como el buscador de un navegador. Se detiene en 300 resultados.
- **Marcadores con nombre**: guarda la página actual con el nombre que quieras, uno de cuatro diseños (cinta, etiqueta, banderín o punto) y uno de seis colores. Puedes editarlos o quitarlos desde la lista de marcadores.
- **Brillo**: un control para atenuar o aumentar la luz de la página, en la barra de herramientas y en Ajustes.
- **Zoom con la rueda**: mantén `Ctrl` y mueve la rueda sobre el texto para acercar o alejar. En PDF cambia el zoom; en EPUB, el tamaño del texto.
- **Índice** y **barra de progreso** con la posición.
- **Ajustes**: idioma (español o inglés), tema Noche o Papel, transición de página (deslizar, desvanecer o ninguna), flujo, tamaño de texto del EPUB, zoom del PDF y brillo.
- **Teclado**: flechas, `Re Pág`/`Av Pág` y espacio para cambiar de página; `M` para mostrar u ocultar los menús; `Esc` para volver a la biblioteca.

No incluye todavía (planeado para versiones siguientes): subrayados y resaltados con colores y estilos, notas y comentarios, búsqueda de texto dentro de imágenes (OCR), desplazamiento automático, pasar página "tipo papel" (curva), contraseñas de PDF, lectura en voz alta, diccionario y sincronización.

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

## Estado de las pruebas

Probado en Linux (WebKitGTK, en una sesión virtual) con libros de prueba: importar EPUB y PDF, rechazar duplicados, rechazar un EPUB dañado sin dejar archivos, portada real de un PDF, búsqueda en PDF y EPUB, marcadores con nombre, diseño y color, brillo, zoom con `Ctrl` y rueda en PDF y EPUB, tema Papel, diálogo de confirmación al quitar un libro, y lectura paginada con zonas de toque, teclado y progreso. Las pruebas unitarias (37) pasan.

Todavía sin probar en esta versión: arrastrar archivos a la ventana, modo de desplazamiento, índice con marcadores en un escritorio Linux real, y la compilación para Windows.

## Limitaciones conocidas

- **Clics dentro del EPUB en Linux:** en mis pruebas con WebKitGTK, el motor no entregó clics al contenido del libro (ni siquiera a un marco de prueba mínimo). Por eso las zonas de toque de los bordes están sobre el libro y funcionan en ambos sistemas, y el centro se controla con `M`. En Windows, el motor (WebView2, basado en Chromium) entrega los clics normalmente. Esto no pude confirmarlo en un escritorio Linux real.
- **Zoom con `Ctrl` + rueda:** se usa `Ctrl` para que la rueda sola siga desplazando la página y pasando páginas. Si prefieres la rueda sin tecla, se puede cambiar.
- **Subrayados, resaltados y notas:** todavía no están. Para subrayar y anotar hace falta seleccionar texto con precisión, que en EPUB no pude probar aquí.
- **Búsqueda en imágenes (OCR):** la búsqueda solo encuentra texto que existe como texto. Un PDF escaneado sin capa de texto no devolverá resultados.
- **Resultados de búsqueda:** al saltar a un resultado no se resalta la palabra dentro de la página todavía.
- **PDF en memoria:** el archivo completo se carga en memoria al abrirlo. Libros muy grandes consumen RAM proporcional a su tamaño.
- **PDF protegidos con contraseña** se rechazan con un aviso; la app no pide la contraseña todavía.
- **DRM:** los libros con protección DRM no se pueden abrir.
- **Windows:** la compilación para Windows no se probó en esta versión; el código es el mismo, pero conviene verificar el instalador en tu equipo.
