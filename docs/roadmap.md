# Roadmap del MVP — Sellaloo

> **Estado (2026-10-01):** aprobado; las 5 decisiones del final están aceptadas.
> **2026-10-02:** fases 1 a 6 terminadas en emuladores y fase 7 preparada en el código. De la fase 0 falta desplegar en Spark, que
> requiere el proyecto real de Firebase (ver `MEMORY.md`).
> **Fuente:** [producto/funcionalidades-mvp.md](producto/funcionalidades-mvp.md), transcrito de
> `Sellaloo_funcionalidades_MVP.docx`.
> **Regla de alcance del docx:** si un comercio puede pasar un mes sin una función, esa función
> queda fuera del MVP.

## Resumen

| Fase | Qué se consigue | Tamaño | Dónde corre |
|---|---|---|---|
| 0. Base | repositorio, emuladores, reglas, logins, esqueleto de la app y Hosting | M | Spark (0 €) |
| 1. Sello por QR | el flujo crítico completo, del mostrador al aviso en pantalla | L | emuladores |
| 2. Resto del motor de sellos | sellar por teléfono, alta manual, deshacer y canjear | M | emuladores |
| 3. Alta del comercio | registro, onboarding en menos de 5 minutos y ajustes | M | emuladores |
| 4. Clientes y panel | lista, búsqueda, ficha del cliente y panel mínimo | M | emuladores |
| 5. Zona del cliente | mis tarjetas, perfil y vinculación del teléfono o del correo | M | emuladores |
| 6. Administración | comercios, actividad, desactivar y uso | S | emuladores |
| 7. Lanzamiento piloto | Blaze con protecciones, dominio, textos legales y pruebas reales | M | Blaze |

El tamaño es relativo (S < M < L). No hay fechas.

**Hitos:**
- **A, tras la fase 2:** el motor de sellos está completo y probado en emuladores.
- **B, tras la fase 5:** el MVP está completo en emuladores y se puede enseñar a comercios.
- **C, en la fase 7:** piloto con 3–5 comercios reales.

### Por qué este orden

- **El QR va primero.** Es el flujo que decide si el producto sirve, porque tiene que durar menos
  de 10 segundos. También es el mayor riesgo técnico: arranque en frío de las Functions, tiempo
  real y lectura con la cámara nativa. Se construye con el comercio que crea el seed, sin esperar
  al onboarding.
- **El motor va antes que las pantallas.** Las fases 1 y 2 dejan toda la lógica de sellos en
  Functions con tests. Las demás fases son sobre todo pantallas que leen esos datos.
- **Todo se desarrolla en emuladores (0 €).** Blaze solo llega en la fase 7, cuando hay comercios
  reales.
- Las fases 4 y 5 no dependen entre sí y se pueden hacer en cualquier orden.

## Fase 0 — Base

Es el plan ya aprobado. Comprende:
- el repositorio y el stack;
- el modelo de datos con sus reglas y los tests de reglas;
- el login del comercio con correo y contraseña;
- el login del cliente con teléfono por SMS o con correo y contraseña;
- las rutas protegidas por rol;
- las pantallas provisionales;
- el seed;
- la CI;
- el despliegue de Hosting y de las reglas en Spark.

## Fase 1 — Sello por QR (el flujo que tiene que ser perfecto)

**Estado (2026-10-02): hecha.**
- Functions `issueQr` y `redeemQr`, dominio, reglas e índices, con 14 tests de dominio, 22 contra
  el emulador y 10 de reglas.
- Web: logins, `/negocio`, `/q/:token` y `/tarjetas`. Seed y CI.
- Probado en el navegador con dos sesiones (dueño en `localhost`, clienta en `127.0.0.1`): el aviso
  «Sello dado a María.» aparece en unos 3 s sin tocar nada. También el límite diario, el QR
  caducado, el login por SMS y «Salir».
- Sin probar en el navegador: «¡Premio conseguido!» en las dos pantallas (lo cubren los tests).
- Pendiente para otras fases: el teléfono opcional de los clientes por correo (fase 5), ocultar las
  tarjetas canjeadas (hecho en la fase 2), el icono PNG para iOS y
  partir el *chunk* de Firebase de más de 500 kB (hechos en la fase 7).

**Funcionalidades:**
- **Comercio (`/negocio`):**
  - selector de 1, 2 o 3 sellos (por defecto 1) y un botón grande «Generar QR»;
  - el QR aparece a pantalla completa con una cuenta atrás de 150 s;
  - cuando el cliente escanea, aparece «Sello dado a María» al momento y sin tocar nada, con
    vibración o sonido;
  - después, el botón «Generar otro»;
  - si el QR caduca: «Este QR ha caducado» y la opción de generar otro.
- **Cliente (`/q/:token`):**
  - escanea con la cámara del móvil;
  - **si ya tiene sesión**, recibe el sello al instante y ve una confirmación con el nombre del
    comercio, los sellos que lleva, cuántos le faltan y el premio;
  - **si no tiene sesión**, entra por teléfono o por correo, da su nombre y acepta la privacidad.
    Después recibe el sello sin hacer nada más.
- **Premio:** si un QR completa la tarjeta, las dos pantallas muestran «¡Premio conseguido!». Los
  sellos sobrantes pasan a la tarjeta siguiente.
- **Mensajes de error claros:**
  - QR caducado;
  - QR ya usado;
  - «Hoy ya has recibido tu sello aquí», por el límite diario;
  - comercio desactivado.

**Trabajo técnico:**
- **`functions/src/domain/`**: lógica pura con tests unitarios:
  - reparto de sellos entre tarjetas, con los sobrantes a la siguiente;
  - fecha local según la zona horaria del comercio;
  - comprobación del límite diario.
- **Callable `issueQr({ amount })`:**
  - comprueba que quien llama es el dueño y que el comercio está activo;
  - crea `qrTokens/{token}` con un token de 32 bytes en base64url, `createdAt` y `expiresAt` a
    +150 s.
- **Callable `redeemQr({ token })`**, todo en una sola transacción:
  1. comprueba que el token existe, no se ha usado y no ha caducado. Se mira `expiresAt`, porque la
     TTL de Firestore borra con retraso y solo sirve de limpieza;
  2. busca o crea la ficha del cliente en `members`;
  3. aplica `dailyVisitLimit` con el contador de `dailyVisits`;
  4. reparte los sellos;
  5. crea la `visit` con sus `allocations`;
  6. marca el token como usado y guarda `usedByName`;
  7. actualiza la ficha del cliente y las estadísticas del mes.
- **Políticas TTL** en `qrTokens.expiresAt` y en `dailyVisits`.
- **Pantalla del QR:** dibuja el código con `qrcode` y escucha el token con `onSnapshot`.
- **`/q/:token` ligera:** carga el mínimo de código y solo los módulos de Firebase que necesita,
  para que abra rápido con 4G.
- **Medición:** con `createdAt` y `usedAt` del token se calcula cuánto dura el flujo. Esa métrica
  se ve en la fase 6.
- **Tests de las Functions contra el emulador:**
  - token reutilizado;
  - token caducado;
  - límite diario;
  - dos escaneos a la vez (solo uno gana);
  - sellos sobrantes;
  - comercio desactivado.

**Riesgo: el arranque en frío.** Con 0 instancias mínimas, la primera llamada tras un rato sin uso
tarda unos segundos más. Se mide en el piloto. Si molesta, se pone `minInstances: 1` solo en
`redeemQr`, que cuesta unos pocos euros al mes.

**Hecho cuando:**
- en emuladores, con dos navegadores (el dueño y un cliente con sesión), el flujo completo dura
  menos de 10 segundos;
- el aviso aparece en la pantalla del dueño sin que toque nada.

## Fase 2 — Resto del motor de sellos

**Estado (2026-10-02): hecha (`4f78344`).**
- Functions `addMember`, `stampByPhone`, `undoLastVisit` y `redeemReward`. El reparto de sellos
  vive en `handlers/stamp.ts` y lo comparten el QR y el teléfono. 13 tests nuevos contra el
  emulador (`functions/test/phase2.test.ts`).
- Web `/negocio`: sellar por teléfono (con alta si el teléfono es nuevo), «Deshacer» tras cada
  sello y la lista «Premios pendientes» con «Entregar». `/tarjetas` oculta las canjeadas y muestra
  0 sellos si han caducado.
- Probado en el navegador: alta y sello de Pepe, «Deshacer», QR de 2 que completa la tarjeta de
  Juan y entrega del premio.
- Cambio respecto al plan: en vez del aviso «María tiene un premio pendiente · Canjear», el dueño
  ve siempre la lista de premios pendientes.
- Límite conocido: si los sellos caducan al sellar y luego se deshace esa visita, los sellos
  caducados no vuelven.

- **Alta manual de un cliente:**
  - el dueño escribe nombre y teléfono, y el teléfono se normaliza a +34 con `libphonenumber-js`;
  - se crea una ficha sin cuenta (`customerId` nulo);
  - no se permiten fichas repetidas con el mismo teléfono dentro del comercio.
- **Sellar por teléfono:** el dueño escribe el teléfono y elige 1, 2 o 3 sellos. La callable
  `stampByPhone` busca al cliente en este orden:
  1. una cuenta con ese teléfono verificado (`getUserByPhoneNumber`);
  2. una ficha del comercio con ese teléfono declarado;
  3. si no lo encuentra, ofrece el alta manual.

  Usa el mismo reparto y el mismo límite diario que el QR.
- **Deshacer el último sello:** la callable `undoLastVisit` revierte las `allocations` de la última
  visita del comercio:
  - resta los sellos;
  - devuelve a `active` una tarjeta que había pasado a `reward_pending`;
  - borra la tarjeta nueva si quedó vacía;
  - descuenta `dailyVisits` y las estadísticas.

  Ver la decisión abierta 3.
- **Canjear el premio:**
  - la callable `redeemReward({ cardId })` pasa la tarjeta de `reward_pending` a `redeemed`;
  - cuando un cliente con un premio pendiente escanea o recibe un sello, el dueño ve «María tiene
    un premio pendiente · Canjear».
- **Caducidad de los sellos:** es opcional y está desactivada por defecto. Se comprueba al sellar y
  al mostrar la tarjeta, sin tareas programadas. Ver la decisión abierta 2.

**Hecho cuando** el dueño, en emuladores, puede hacer todo esto:
- dar de alta a alguien sin móvil, sellarle por teléfono y deshacer el sello;
- completar una tarjeta y canjear el premio.

Todo esto queda cubierto por los tests de las Functions.

## Fase 3 — Alta del comercio y onboarding (menos de 5 minutos)

**Estado (2026-10-02): hecha (`90ff097`).**
- Callable `createBusiness` y 4 tests contra el emulador (`functions/test/phase3.test.ts`). El
  primer sello de cada comercio guarda `firstStampAt`, que sirve para la métrica.
- Web: «Crear mi comercio» en la portada y en el login del dueño, asistente `/negocio/alta`, aviso
  de bienvenida en `/negocio` y `/negocio/ajustes`.
- Reglas: el dueño edita su programa (sellos, premio y caducidad) y sube su logo a
  `logos/{uid}/logo` (`storage.rules`).
- Probado en el navegador: alta de «Horno de Prueba» con logo, primer sello por teléfono y cambio
  de ajustes.
- Cambios respecto al plan:
  - las plantillas viven en el código (`PROGRAM_TEMPLATES`), no en una colección;
  - el logo se guarda en WebP, o en JPEG si el navegador no sabe generar WebP (Safari);
  - las tarjetas del cliente piden el logo a Storage una vez por tarjeta (no se copia en `cards`);
  - en Ajustes, el límite diario es 1, 2, 3 o sin límite, y la caducidad 3, 6 o 12 meses.
- Falta el cronometraje con una persona real.

- **Entrada:**
  - en la portada, «Soy un comercio» y «Crear mi comercio»;
  - registro con correo y contraseña;
  - se envía un correo de verificación, pero no bloquea, para no frenar el alta.
- **Asistente en 4 pasos de una pantalla cada uno:**
  1. nombre y tipo de negocio;
  2. logo, que es opcional y se puede saltar;
  3. la tarjeta, con la plantilla del tipo de negocio ya rellenada (sellos y premio) y editable;
  4. «Da tu primer sello»: lleva a la pantalla del QR con un mensaje de ayuda.
- **Callable `createBusiness`:**
  - crea el comercio y su programa en una sola transacción;
  - permite un comercio por dueño en el MVP;
  - pone los valores por defecto: `dailyVisitLimit` 1, zona horaria `Europe/Madrid` y caducidad
    desactivada.
- **Ajustes:**
  - se pueden cambiar nombre, tipo, logo, premio y número de sellos, límite diario y caducidad;
  - las tarjetas en curso conservan los valores con los que se crearon, porque se copian en la
    tarjeta.
- **Logo:**
  - se reduce en el navegador a 256 px en WebP;
  - se sube a Cloud Storage, que en los proyectos nuevos exige Blaze, igual que las Functions.
- **Plantillas por tipo:** peluquería, estética, cafetería, panadería y otros (`PROGRAM_TEMPLATES`).
- **Métrica:** tiempo desde el alta del comercio hasta su primer sello.

**Hecho cuando** una persona que no conoce la app crea su comercio y da su primer sello en menos de
5 minutos, cronometrados.

## Fase 4 — Clientes y panel mínimo

- **Lista de clientes:**
  - ordenada por la última visita;
  - búsqueda por nombre o por teléfono;
  - para buscar, el nombre se guarda en `searchName`, en minúsculas y sin acentos;
  - la búsqueda es por prefijo, con índices, y muestra 20 resultados;
  - así no hace falta un buscador externo de pago.
- **Ficha del cliente:** sellos actuales, cuántos le faltan, premios pendientes (con el botón
  Canjear) y las últimas visitas.
- **Panel:**
  - muestra clientes totales, sellos dados este mes y premios canjeados;
  - los datos salen de `businesses/{id}/stats/{AAAA-MM}` y de `stats/total`;
  - las Functions los actualizan en la misma transacción que el sello, así que el panel cuesta una
    lectura en lugar de contar documentos.

**Hecho cuando:**
- con 300 clientes de prueba, buscar por las primeras letras responde en menos de 1 segundo;
- el panel cuadra con las visitas, también después de deshacer un sello.

**Estado (2026-10-02): hecha (`b722615`).** Probada en el navegador con `npm run seed -- --muchos`.
El nombre solo se busca por el principio (no por el apellido) y un teléfono sin prefijo se toma como
español (+34). El panel lee el mes y el total con una consulta de rango sobre `stats`, porque las
reglas rechazan el `get` de un mes que todavía no tiene documento.

## Fase 5 — Zona del cliente

- **`/tarjetas`:**
  - todas sus tarjetas, en tiempo real;
  - los sellos dibujados como casillas, cuántos faltan y el premio;
  - «Premio pendiente: enséñaselo al comercio».
- **Atajo:** tras el primer sello, se invita al cliente a añadir la web a la pantalla de inicio,
  que es el «enlace atajo» del docx. En iPhone se le muestran instrucciones; en Android, el aviso
  del navegador.
- **Perfil:** nombre, teléfono, cerrar sesión y eliminar la cuenta, que es un derecho del RGPD.
- **Vinculación:**
  - una cuenta de correo puede añadir el teléfono verificándolo por SMS (`linkWithCredential`);
  - una cuenta de teléfono puede añadir un correo;
  - la callable `claimPhoneCards` le junta las tarjetas que el dueño creó a mano para ese teléfono
    y une las fichas repetidas.
- **Sesión larga en iPhone:**
  - una Function pone la cookie `__session` y devuelve un *custom token*;
  - así Safari no borra la sesión a los 7 días;
  - va detrás de un *rewrite* de Hosting, que solo deja pasar esa cookie.
- **Callable `deleteAccount`:** borra el perfil y la cuenta, y anonimiza sus fichas en los
  comercios. Los totales del panel se mantienen.

**Hecho cuando** un cliente que entró por correo verifica su teléfono y le aparecen las tarjetas
que el dueño le había creado a mano. Nadie más puede verlas.

**Estado (2026-10-02): hecha.** Probada en el navegador: Juan (correo) añade en
`/perfil` el teléfono de una ficha manual y su tarjeta pasa de 8 a 9 sellos. Lo que falta o se
simplificó:
- **Sesión larga en iPhone:** aplazada. Una web añadida a la pantalla de inicio no tiene el límite
  de 7 días de Safari, así que el atajo ya lo cubre en la mayoría de casos.
- El aviso para instalar sale en cuanto hay una tarjeta, no solo tras el primer sello. En Android
  solo aparece si el navegador lanza `beforeinstallprompt`.
- `claimPhoneCards` hace una sola transacción (límite de 500 escrituras), no tiene en cuenta la
  caducidad de los sellos ni `stats`, y una visita juntada ya no se puede deshacer si su tarjeta
  se fusionó.
- Al cambiar el nombre en el perfil, las fichas de los comercios lo actualizan en el siguiente sello.

## Fase 6 — Administración

- **`/admin`:**
  - lista de comercios con su actividad: último sello, sellos y clientes del mes y días desde el
    alta;
  - marca de «abandonado» para los que llevan 14 días sin sellos.
- **Activar y desactivar comercios** con la callable `setBusinessActive`. Un comercio desactivado
  no puede generar QR ni sellar.
- **Corregir los datos** de un comercio.
- **Métricas del producto:** duración mediana del flujo del QR y del onboarding.
- **Uso frente al «plan gratuito»:** ver la decisión abierta 1.

**Hecho cuando** el admin del seed ve los comercios de prueba con datos correctos y, al desactivar
uno, ese comercio no puede sellar.

**Estado (2026-10-02): hecha.**
- `/admin`: contadores de uso, medianas del QR y del alta y lista de comercios. `/admin/:businessId`
  reutiliza la pantalla de Ajustes con un botón «Desactivar»/«Activar».
- **Cambio sobre el plan:** sin callable `setBusinessActive`. Las reglas dejan al admin editar los
  datos del comercio y del programa, y `active`; las Functions ya rechazaban sellar con
  `business-inactive`. Un test de reglas nuevo (15 de reglas y 46 de Functions contra el emulador).
- Probado en el navegador con `admin@demo.es`: el sello por teléfono del dueño aparece en la lista;
  tras renombrar y desactivar `demo-cafe`, el dueño ve «Este comercio no está activo ahora mismo.»
  al generar un QR y al sellar por teléfono.
- **Simplificaciones:**
  - el último sello sale de la última visita, aunque esté deshecha;
  - una consulta por comercio, sin paginar;
  - la mediana del QR usa las últimas 500 visitas;
  - el admin no cambia el logo, porque Storage solo deja subirlo al dueño.

## Fase 7 — Lanzamiento piloto

- **Pasar a Blaze con protecciones:**
  - alertas de presupuesto de 1 € y de 5 €;
  - `minInstances: 0`;
  - política de limpieza de Artifact Registry;
  - región de SMS solo +34;
  - App Check en las Functions y en Auth, contra el abuso de SMS;
  - números de teléfono de prueba.
- **Dominio propio** en Hosting. El SSL es gratis y el dominio cuesta unos 10–15 € al año.
- **Textos legales:**
  - política de privacidad y aviso legal visibles;
  - el consentimiento ya se pide en el registro;
  - contrato de encargado del tratamiento con los comercios, que conviene revisar con un asesor.
- **Copias de seguridad:** copias programadas de Firestore, con un coste mínimo de almacenamiento.
- **Pruebas en dispositivos reales:**
  - iPhone, en Safari y como PWA instalada;
  - Android, en Chrome y como PWA instalada;
  - la cámara nativa leyendo el QR;
  - con mala cobertura.
- **Piloto:** 3–5 comercios durante 4 semanas. Se mide:
  - el tiempo de onboarding;
  - la duración del flujo;
  - los comercios que siguen sellando cada semana;
  - el coste real.

**Hecho cuando** los comercios del piloto llevan 4 semanas dando sellos y el coste mensual está
dentro de lo previsto.

**Estado (2026-10-02): preparada en el código; el resto lo hace el usuario.**
- Checklist del lanzamiento en `docs/lanzamiento.md`.
- `/legal`: aviso legal, política de privacidad y contrato de encargo. Es un borrador con los datos
  del titular por rellenar, pendiente de revisar con un asesor. Se enlaza desde la portada, desde la
  casilla del registro del cliente y desde una casilla obligatoria nueva en el alta del comercio.
- App Check opcional: la web lo activa si hay `VITE_APPCHECK_SITE_KEY`, y las Functions lo exigen con
  `ENFORCE_APP_CHECK=true`. En los emuladores no se activa.
- Iconos PNG (`apple-touch-icon` de 180 px, 192 px y 512 px *maskable*), generados desde `icon.svg`.
- Firebase en su propio *chunk* (unos 600 kB, 180 kB con gzip), con el aviso subido a 800 kB.
- **Simplificaciones:**
  - la versión de `/legal` aceptada (`LEGAL_VERSION`) se guarda en `termsVersion` y `privacyVersion`, pero no hay que volver a aceptarla si cambia;
  - el SDK de App Check se carga aunque no haya clave (unos 14 kB).
- **Pendiente del usuario:** proyecto real, Blaze, dominio, datos legales, dispositivos y piloto.

## En todas las fases

- **Functions:** cada una tiene tests contra el emulador, y su lógica pura vive en `domain/` con
  tests unitarios.
- **Colecciones nuevas:** cada una lleva sus reglas y sus tests de reglas.
- **Accesibilidad:**
  - letra de 18 px como mínimo;
  - botones de 56 px de alto como mínimo;
  - contraste AA;
  - nada depende solo del color.
- **Rendimiento:** la pantalla del QR y `/q/:token` cargan rápido con 4G.
- **Documentación:**
  - `docs/` y `AGENTS.md` al día;
  - `MEMORY.md` con el estado de la fase.

### Cambios que este roadmap añade al modelo de datos

- `qrTokens.createdAt`, para medir la duración del flujo.
- `members.searchName`, para buscar.
- `businesses/{id}/stats/{AAAA-MM}` y `stats/total`, para el panel y para la administración.

## Decisiones (aceptadas el 2026-10-01 tal como se propusieron)

El logo se guarda en WebP. La caducidad de los sellos se hace en la fase 2.

| # | Decisión | Propuesta aceptada |
|---|---|---|
| 1 | En el docx, admin tiene que «controlar el límite del plan gratuito». ¿Es la cuota gratis de Firebase o un plan gratis de Sellaloo para los comercios? | Cuota de Firebase: alertas de presupuesto, más contadores propios en el panel de admin (comercios, clientes, sellos del mes, altas por teléfono) y un enlace a la consola de uso. |
| 2 | ¿Cómo caducan los sellos cuando el comercio activa la caducidad? | Si pasan N meses sin visitas, la tarjeta activa vuelve a 0. Es fácil de explicar y no exige guardar la fecha de cada sello. |
| 3 | ¿Hasta cuándo se puede deshacer? | Solo la última visita del comercio, el mismo día y si su premio no se ha canjeado. |
| 4 | ¿Dónde se guarda el logo? | En Cloud Storage, reducido a 256 px. |
| 5 | ¿Instancias mínimas para quitar el arranque en frío? | 0 al principio. Se mide en el piloto antes de pagar. |

## Después del MVP (del docx)

- **Comercio:**
  - varios empleados, con registro de quién dio cada sello;
  - varias tarjetas a la vez;
  - estadísticas avanzadas;
  - mensajes a clientes;
  - sucursales;
  - integración con TuCitero.
- **Cliente:**
  - Apple Wallet y Google Wallet:
    - el cliente añade la tarjeta escaneando un QR o pulsando un botón con el enlace
      `pay.google.com/gp/v/save/<JWT>` (Google) o con un `.pkpass` (Apple);
    - añadirla es fácil. El coste está en que el pase muestre los sellos al día: hace falta
      una cuenta de emisor en Google, una cuenta de servicio, firmar el JWT en una Function y
      llamar a la API en cada sello; en Apple, además, un certificado de 99 €/año y un
      servicio de actualización con push;
    - un pase fijo, como el de una tarjeta de visita, no sirve: los sellos no se actualizarían;
    - si se hace, empezar por Google Wallet y actualizar el pase desde `redeemQr`;
  - avisos de sello y de premio;
  - historial.
- **Administración:** suscripciones y pagos, y métricas globales.
- **Login del cliente por WhatsApp:** lo menciona el docx, pero Firebase Auth no lo trae de serie.
