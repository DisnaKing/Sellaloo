# Arquitectura — Sellaloo

Todo corre en Firebase (decisión del 2026-10-01). Modelo de datos en [modelo-datos.md](modelo-datos.md)
y costes en [costes.md](costes.md).

## Stack

- **Web:** una sola PWA instalable con React 19, Vite y TypeScript estricto. Rutas cargadas bajo
  demanda:
  - `/negocio` y `/negocio/entrar`: comercio;
  - `/entrar`, `/tarjetas` y `/q/:token`: cliente final;
  - `/admin`: administración.
- **Firebase:**
  - Hosting;
  - Auth: el comercio entra con correo y contraseña. El cliente elige entre teléfono con código por
    SMS o correo y contraseña; los que entran por correo no gastan SMS;
  - Firestore, que además da el tiempo real con `onSnapshot`;
  - Cloud Functions v2 *callable* en TypeScript y Node 22, en `europe-west1`;
  - Emulator Suite para todo el desarrollo.
- **Herramientas:** npm, oxlint, vitest, Testing Library y `@firebase/rules-unit-testing`.
  `firebase-tools` va como devDependency (`npx firebase`).

## Decisiones

1. **La lógica de sellos vive en Functions callable**, con transacciones de Firestore y el Admin
   SDK: emitir y canjear el QR, sellar por teléfono, deshacer y canjear el premio. El cliente nunca
   escribe documentos de negocio; las reglas lo impiden y solo dejan leer lo que corresponde a cada
   uno. Así se evitan trampas y dobles canjes.
2. **El QR es una URL** `https://<dominio>/q/<token>`, con un token aleatorio de 32 bytes en
   base64url, de un solo uso y válido 150 s. El cliente la escanea con la cámara nativa del móvil.
3. **Los sellos se aceptan siempre** y no hay estado «pendiente».
4. **El cliente se identifica por su `uid`; el teléfono es un dato de su perfil.**
   - Si entró por SMS, el teléfono queda verificado (`phoneVerified: true`). Si entró por correo,
     el teléfono es opcional y sin verificar, y solo sirve para que el dueño lo encuentre.
   - Las tarjetas que el dueño crea a mano para un teléfono sin cuenta no tienen `customerId`. Solo
     se le juntan a alguien con ese teléfono verificado por SMS, para que nadie vea las tarjetas de
     otro escribiendo su número.
   - Una cuenta de correo puede añadir y verificar su teléfono (`linkWithCredential`), y al revés,
     para no acabar con dos cuentas.
5. **El límite diario es configurable por comercio y cuenta visitas:** `dailyVisitLimit` (por
   defecto 1; nulo = sin límite), aplicado dentro de la transacción con el contador
   `dailyVisits/{businessId}_{memberId}_{fecha}`. El día se calcula en la zona horaria del comercio
   (por defecto `Europe/Madrid`).
6. **Tiempo real:** el comercio escucha con `onSnapshot` el documento del QR que acaba de generar.
   Cuando la Function lo marca como usado, aparece «Sello dado a María».
7. **Roles:**
   - **admin:** *custom claim* `admin: true`, que se asigna con `scripts/set-admin.ts`;
   - **comercio:** dueño de un `business`. Los documentos llevan `ownerUid` para que las reglas no
     tengan que hacer lecturas extra;
   - **cliente:** cualquier usuario con sesión que no sea dueño ni admin, con perfil
     `customers/{uid}`.
8. **Tipos compartidos** en `functions/src/shared/model.ts`. La web los importa con el alias
   `@shared`, y así viajan en el despliegue de Functions, que solo sube `functions/`.
9. **Errores:** las callables lanzan `HttpsError` con `details: { reason }` (`ErrorReason`). La web
   traduce cada `reason` a un mensaje.

## Capas de las Functions

- `src/domain/`: lógica pura (reparto de sellos, fecha local, límite diario) con tests unitarios.
- `src/handlers/`: cada callable recibe `{ db, now }` y no depende de `onCall`; los tests de
  `functions/test/` la llaman directamente contra el emulador.
- `src/index.ts`: envoltorios `onCall` finos, con `maxInstances: 10` y 0 instancias mínimas.

## Desarrollo local

- Proyecto `demo-sellaloo` en los emuladores: Auth 9099, Firestore 8080, Functions 5001, Storage
  9199, Hosting 5000 y UI 4000.
- `lib/firebase.ts` conecta con los emuladores en el mismo `location.hostname` de la página. Para
  probar dos sesiones en un navegador se usan `localhost:5173` y `127.0.0.1:5173` (Vite con
  `--host`). `[::1]` no sirve, porque los emuladores solo escuchan en IPv4.
- El emulador de Auth no envía SMS: el código se lee en
  `http://127.0.0.1:9099/emulator/v1/projects/demo-sellaloo/verificationCodes`.
