# MEMORY.md — memoria de trabajo del agente

> Memoria a corto plazo. Límite aproximado: **50 líneas**. Lo permanente va a `AGENTS.md`.

**Última actualización:** 2026-10-07

## Objetivo actual

- Fases 1 a 7 hechas en el código. El resto (proyecto real, Blaze, dominio, legales, dispositivos,
  piloto) lo hace el usuario con `docs/lanzamiento.md`.

## Estado

- [x] Fases 1 a 7 con commit (la 7 es `5f30977`).
- [x] Tras la 7 (`05e0f72`): logo en las tarjetas del cliente y versión de `/legal` aceptada
  (`LEGAL_VERSION`; cámbiala al cambiar los textos).
- [ ] Repositorio en GitHub: **espera el OK del usuario**.
- [x] Móvil: emuladores en `0.0.0.0` y `VITE_PUBLIC_ORIGIN` para el QR. Probado con el móvil real.
- [ ] Desplegar la base en Spark (fase 0): necesita el proyecto real de Firebase.
- [ ] Estilo «Tinta» aplicado (`docs/diseno.md`), **sin commit**. Revisado con capturas de un HTML de prueba;
  falta verlo con datos reales en los emuladores.

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

- **Emuladores en Windows (Java 25):** Firestore necesita `JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=<carpeta>"`,
  Functions `FUNCTIONS_DISCOVERY_TIMEOUT=60`, y al parar quedan procesos huérfanos (Storage usa el 9199).
- Dos sesiones en un navegador: `localhost:5173` y `127.0.0.1:5173` (Vite con `--host`); `[::1]` no sirve.
- Código SMS del emulador: `curl http://127.0.0.1:9099/emulator/v1/projects/demo-sellaloo/verificationCodes`.
- En Chrome, los clics por coordenadas funcionan mejor que por referencia. Con la pestaña oculta
  fallan las capturas: leer con JS y enviar formularios con `requestSubmit()`. Para subir un fichero:
  JS que pinta un canvas, crea un `File`, lo mete con `DataTransfer` en `input.files` y lanza `change`.
- En Bash, usar rutas absolutas: el directorio de trabajo cambia entre la raíz y `functions/`.
- El equipo Arch Linux no tiene Java: los emuladores no arrancan ahí. Sí hay `chromium` para capturas sin interfaz.

## Riesgos y avisos para el usuario

- Un cliente nuevo que se registra por SMS puede tardar más de 150 s y el QR caducar: el dueño genera otro.
- Lo que tiene que hacer el usuario: seguir `docs/lanzamiento.md`.
- `scripts/set-admin.ts` solo va contra los emuladores.
