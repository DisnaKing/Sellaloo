# MEMORY.md — memoria de trabajo del agente

> Memoria a corto plazo. Límite aproximado: **50 líneas**. Lo permanente va a `AGENTS.md`.

**Última actualización:** 2026-10-02

## Objetivo actual

- **Fase 6 (administración) hecha, sin commit.** Commit y siguiente fase solo cuando lo pida el
  usuario; estado en `docs/roadmap.md`.

## Estado

- [x] Fases 1 a 4 con commit (`34f6915`, `4f78344`, `90ff097`, `b722615`).
- [x] Fase 5 con commit (`bf16c67`).
- [x] Fase 6: `/admin` y `/admin/:businessId`; admin entra por `/negocio/entrar`.
- [ ] Repositorio en GitHub: **espera el OK del usuario**.
- [ ] Pregunta pendiente: emuladores en `0.0.0.0` para probar desde el móvil.
- [ ] Desplegar la base en Spark (fase 0): necesita el proyecto real de Firebase.

## Contexto relevante

- react-router 8.4: entradas `react-router` y `react-router/dom`.
- TypeScript 7 nativo: sin `baseUrl` y con `types` explícitos.
- Los tests de emulador llaman a los handlers directamente (`functions/test/helpers.ts`).
- Las consultas del dueño sobre `cards` tienen que filtrar por `ownerUid`, o las reglas las rechazan.
- Sin comprobar todavía: las TTL de `firestore.indexes.json` al desplegar.
- Tras vincular teléfono o correo hay que renovar el token (`getIdToken(true)`): las reglas lo comparan.
- Seed: `dueno@demo.es` (dueño de `demo-cafe`), `juan@demo.es` (8 sellos, sin teléfono),
  `admin@demo.es` y María por SMS (`+34600000001`, 3 sellos). Contraseña en la salida del seed.
- El seed no escribe `stats`: el panel sale a cero hasta que se dan sellos.

## Notas y aprendizajes

- **Emuladores en este entorno (Java 25, sandbox):**
  - Firestore falla con `Unable to establish loopback connection` salvo con
    `JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=<carpeta temporal existente>"`;
  - Functions tarda unos 38 s en cargar en frío: usar `FUNCTIONS_DISCOVERY_TIMEOUT=60`;
  - parar una tarea en segundo plano deja procesos huérfanos (Storage usa el 9199): revisar los puertos
    (`Get-NetTCPConnection`) y matarlos con `Stop-Process`.
- Dos sesiones en un navegador: `localhost:5173` y `127.0.0.1:5173` (Vite con `--host`). `[::1]`
  no sirve.
- Código SMS del emulador: `curl http://127.0.0.1:9099/emulator/v1/projects/demo-sellaloo/verificationCodes`.
- En Chrome, los clics por coordenadas funcionan mejor que por referencia. Con la pestaña oculta
  fallan las capturas: leer con JS y enviar formularios con `requestSubmit()`. Para subir un fichero:
  JS que pinta un canvas, crea un `File`, lo mete con `DataTransfer` en `input.files` y lanza `change`.
- En Bash, usar rutas absolutas: el directorio de trabajo cambia entre la raíz y `functions/`.

## Riesgos y avisos para el usuario

- Un cliente nuevo que se registra por SMS puede tardar más de 150 s y el QR caducar: el dueño
  genera otro.
- Lo que tiene que hacer el usuario: crear el proyecto de Firebase, `npx firebase login`,
  `npx firebase use --add`, activar Auth y, al lanzar, el plan Blaze.
