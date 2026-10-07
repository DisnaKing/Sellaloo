# Diseño: estilo «Tinta»

La tarjeta de sellos de cartón de toda la vida, en digital: sellos de tinta un poco torcidos, un borde
perforado y un sello rojo de «¡PREMIO!». Se eligió el 2026-10-07 entre varias propuestas (Nothing,
Bloque, Perforada, Riso, Kraft y Azulejo).

Todo vive en `src/styles.css`; las pantallas solo usan clases.

## Colores

| Variable | Valor | Uso |
|---|---|---|
| `--ink` | `#1d3bb3` | Marca, botón principal, sellos, enlaces. También `theme-color` y el icono. |
| `--ink-soft` | `#e8ecfa` | Fondo de los avisos (`.notice`). |
| `--red` | `#c2361f` | **Solo premios**: casilla del premio, sello «¡PREMIO!», botón de entregar o canjear (`.reward`). |
| `--text` | `#14161f` | Texto y bordes de tarjetas, paneles, campos y botones secundarios. |
| `--muted` | `#4a4f63` | Texto secundario. |
| `--line` | `#d3d6e0` | Separadores discontinuos. |
| `--bg` | `#f3f4f7` | Fondo de la página. |
| `--paper` | `#ffffff` | Tarjetas, paneles y campos. |

Todos los textos cumplen un contraste AA (4,5:1) sobre su fondo.

## Tipografía

- **Atkinson Hyperlegible** (400 y 700): el texto. Está pensada para leerse bien con vista cansada.
- **Bricolage Grotesque** (variable): títulos, números y botones grandes.
- Se sirven desde la app con `@fontsource`, sin pedirlas a Google Fonts (RGPD). Se importan en `src/main.tsx`.
- Siguen valiendo las normas de `AGENTS.md`: letra base de 18 px y botones de 56 px de alto como mínimo.

## Componentes

- **Botones:** `button` y `.button` son el principal (tinta). `.secondary` es blanco con borde oscuro. `.link`
  parece un enlace. `.reward` es el rojo de premio. `.big` es el botón grande de «Generar QR».
- **Selector de sellos** (`.amounts`): el elegido va en tinta con un anillo blanco por dentro.
- **Tarjeta de sellos del cliente** (`.stamp-card`, en `Cards.tsx`):
  - una cabecera de tinta con el logo o las iniciales del comercio (`.mark`) y la cuenta («8/10»);
  - las casillas (`.slots`): `.on` es un sello con doble anillo y estrella, y cae girado con `nth-child`;
    `.prize` es la última casilla vacía, con un regalo rojo;
  - un pie con borde discontinuo. Si hay premio pendiente, el pie lleva el sello `.prize-stamp`.
- **Paneles:** cada `section` es un panel blanco con borde. `.card` y `.stats` también.
- **Listas** (`.row`): filas separadas con una línea discontinua.

El lienzo con las propuestas está en https://claude.ai/artifact/1oVX44PZCxiYdQAHn38abX (privado).
