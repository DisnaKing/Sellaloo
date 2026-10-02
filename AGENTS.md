# AGENTS.md — Sellaloo

Guía permanente para cualquier agente que trabaje en este repositorio.
Aquí solo van **decisiones consolidadas**. Lo temporal o en curso va en `MEMORY.md`.

## Flujo de memoria

1. Al empezar una sesión, lee `AGENTS.md` y después `MEMORY.md`.
2. Durante el trabajo, anota en `MEMORY.md` el contexto, las tareas y las decisiones provisionales.
3. Cuando una decisión pasa a ser **permanente**, sácala de `MEMORY.md` y llévala a su sitio:
   - Convenciones, arquitectura, comandos o normas de trabajo → este fichero.
   - Documentación específica (API, despliegue, diseño, etc.) → el fichero que le corresponda
     (por ejemplo `docs/`, `README.md`, `DESIGN.md`). Si no existe, créalo y enlázalo aquí.
4. Mantén `MEMORY.md` en unas **50 líneas** como máximo: resume o borra lo que ya esté cerrado.

## Proyecto

- **Nombre:** Sellaloo
- **Descripción:** app de fidelización por sellos para comercios pequeños. Tiene tres zonas: la del
  comercio (`/negocio`), la del cliente final (`/tarjetas` y `/q/:token`) y la de administración
  (`/admin`).
- **Stack:**
  - **Web:** una sola PWA hecha con React 19.3, Vite 8.3, TypeScript 7.0 y react-router 8.4.
  - **Firebase:**
    - Hosting y Auth;
    - Firestore, usando `onSnapshot` para el tiempo real;
    - Cloud Functions v2 *callable* con Node 22, en `europe-west1`.
  - **Tests y calidad:** vitest 5 (con `test.projects`), Testing Library, oxlint y
    @firebase/rules-unit-testing.

## Estructura

```
functions/               Cloud Functions (paquete npm propio)
  src/shared/model.ts    tipos y constantes compartidos con la web (alias @shared)
  src/domain/            lógica pura con tests unitarios (*.test.ts al lado)
  src/handlers/          lógica de cada callable: recibe {db, now}, sin depender de onCall
  src/index.ts           envoltorios onCall finos
  test/                  tests contra el emulador de Firestore
firestore.rules  firestore.indexes.json  storage.rules  firebase.json  .firebaserc (demo-sellaloo)
docs/                    roadmap y documentación
src/                     web (pages/, lib/firebase.ts, auth.tsx)
scripts/                 seed.ts, set-admin.ts (Admin SDK contra los emuladores)
tests/rules/             tests de firestore.rules y storage.rules contra el emulador
```

## Comandos

| Acción | Comando |
|---|---|
| Instalar | `npm install` (instala también `functions/` con `postinstall`) |
| Desarrollo | `npm run emulators`, `npm run seed` (`-- --muchos` añade 300 clientes) y `npm run dev -- --host` |
| Tests unitarios | `npm test` |
| Tests contra el emulador | `npm run test:emulator` |
| Typecheck | `npm run typecheck` (solo de Functions: `npm --prefix functions run typecheck`) |
| Build | `npm run build` |

## Convenciones

- Idioma de la documentación y de la comunicación: español. Identificadores en inglés.
- Escribe código coherente con el que lo rodea (nombres, estilo, densidad de comentarios).
- Cambios pequeños y verificables; no amplíes el alcance sin confirmarlo.
- Interfaz: letra base de 18 px como mínimo y botones de 56 px de alto como mínimo.
- Los errores de las callables son `HttpsError` con `details: { reason }` (ver `ErrorReason` en
  `functions/src/shared/model.ts`). La web traduce cada `reason` a un mensaje.
- Las transacciones de Firestore hacen todas las lecturas antes de la primera escritura.
- Los tests de emulador solo usan proyectos `demo-*` (`functions/test/setup.ts` lo exige).

## Decisiones permanentes

<!-- Formato: - AAAA-MM-DD — Decisión. Motivo. -->
- 2026-10-01 — Todo en Firebase (Hosting, Auth, Firestore, Functions). Lo pidió el usuario.
- 2026-10-01 — El comercio entra con correo y contraseña. El cliente entra con teléfono y SMS, o con
  correo y contraseña; en ese caso el teléfono es opcional y no se verifica. El admin se identifica
  con el *custom claim* `admin: true`.
- 2026-10-01 — Al cliente lo identifica su `uid`; el teléfono es un dato de su perfil. Las tarjetas
  creadas a mano solo se le juntan si tiene ese teléfono verificado por SMS.
- 2026-10-01 — Toda la lógica de sellos vive en las callables, dentro de transacciones. El cliente
  nunca escribe documentos de negocio. Así se evitan trampas y dobles canjes.
- 2026-10-01 — El QR es la URL `/q/:token`:
  - token de 32 bytes en base64url;
  - un solo uso;
  - caduca a los 150 s;
  - vale 1, 2 o 3 sellos.

  El cliente lo escanea con la cámara nativa del móvil.
- 2026-10-01 — Los sellos se aceptan siempre. `dailyVisitLimit` es configurable por comercio:
  - por defecto vale 1, y nulo significa sin límite;
  - cuenta visitas por día, en la zona horaria del comercio.

  Una tarjeta llena pasa a `reward_pending` y los sellos que sobran van a una tarjeta nueva.
- 2026-10-01 — Cada documento de un comercio lleva `ownerUid`, para que las reglas no tengan que
  hacer lecturas extra.
- 2026-10-01 — Decisiones del roadmap:
  - plan gratuito = la cuota de Firebase;
  - la caducidad de los sellos va en la fase 2;
  - solo se puede deshacer la última visita, el mismo día y si su premio no se ha canjeado;
  - el logo va en Cloud Storage, a 256 px y en WebP;
  - 0 instancias mínimas.
- 2026-10-01 — Coste: se desarrolla en los emuladores; Blaze solo se activa al lanzar, con alertas
  de presupuesto. Las Functions tienen `maxInstances: 10`.

## Documentos relacionados

- `MEMORY.md`: memoria de trabajo del agente actual.
- `docs/roadmap.md`: fases del MVP, criterios de «hecho» y decisiones.
- `docs/producto/funcionalidades-mvp.md`: funcionalidades del MVP (transcripción del docx).
- `docs/arquitectura.md`: stack, decisiones de arquitectura y desarrollo local.
- `docs/modelo-datos.md`: colecciones, reglas e índices de Firestore.
- `docs/costes.md`: planes de Firebase, estrategia de coste y control de SMS.
- `docs/lanzamiento.md`: checklist para pasar a producción y lanzar el piloto.
