# Costes — Sellaloo

Objetivo: un MVP gratis o casi. Precios consultados en firebase.google.com/pricing (2026-10-01).

## Planes de Firebase

- **Spark (gratis):** incluye Hosting, Firestore y Auth por correo. **No** incluye Cloud Functions
  ni el envío de SMS del login por teléfono.
- **Blaze (pago por uso):** las mismas cuotas gratis, que sobran para un MVP:
  - Functions: 2 M de invocaciones al mes;
  - Firestore: 50 K lecturas y 20 K escrituras al día;
  - Hosting: 10 GB y 360 MB al día;
  - Auth: 50 K usuarios activos al mes.
- **Los SMS se cobran por mensaje:** unos céntimos cada uno, según el país.
- **Cloud Storage** (el logo) exige Blaze en los proyectos nuevos.

## Estrategia

1. **Desarrollo 100 % en emuladores** con el proyecto `demo-sellaloo`, sin proyecto real ni
   tarjeta. El emulador de Auth no envía SMS. Coste: 0 €.
2. **La base puede desplegarse en Spark** (Hosting y reglas de Firestore). Coste: 0 €.
3. **Blaze solo al lanzar** con comercios reales (fase 7), porque hacen falta las Functions y los
   SMS. Protecciones:
   - alertas de presupuesto de 1 € y de 5 €;
   - Functions en `europe-west1` con 0 instancias mínimas y `maxInstances: 10`;
   - política de limpieza de Artifact Registry (`firebase functions:artifacts:setpolicy`), para que
     las imágenes de las Functions no ocupen espacio de pago;
   - App Check en las Functions y en Auth.

## SMS: el único coste real

- **Sesión persistente:** un SMS al iniciar sesión, no en cada visita.
  - *Excepción:* Safari en iPhone borra la sesión si el cliente no abre la web en 7 días de uso del
    navegador, y le llega otro SMS. Las PWA instaladas no tienen ese límite. Mejora prevista
    (fase 5): una Function pone la cookie `__session` y, desde ella, devuelve un *custom token*.
- **Política de región de SMS** que solo permita +34, contra el fraude de bombeo de SMS.
- **Números de prueba** para las demos.
- **El alta manual por teléfono** que hace el dueño no envía ningún SMS.
- Los clientes que entran con correo y contraseña no gastan SMS.

## Otros costes

- **Arranque en frío:** con 0 instancias mínimas, la primera llamada tras un rato sin uso tarda unos
  segundos más. Se mide en el piloto; si molesta, `minInstances: 1` solo en `redeemQr` cuesta unos
  pocos euros al mes.
- **Dominio propio:** unos 10–15 € al año. El SSL de Hosting es gratis.
- **Copias de seguridad de Firestore:** coste mínimo de almacenamiento.
