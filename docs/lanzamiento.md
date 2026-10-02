# Lanzamiento del piloto (fase 7)

Pasos para salir de los emuladores a un proyecto real. Casi todo se hace en consolas y con la
CLI, no en el código. En el orden en que conviene hacerlos.

## 1. Proyecto de Firebase

- [ ] Crear el proyecto en la consola de Firebase, por ejemplo `sellaloo-prod`.
- [ ] Crear Firestore en una ubicación de la UE (`eur3` o `europe-west1`). La política de privacidad
      dice que los datos están en la UE, y la ubicación no se puede cambiar después.
- [ ] Activar Auth con «Correo y contraseña» y «Teléfono».
- [ ] Activar Storage (para los logos).
- [ ] Registrar una app web y copiar su configuración en `.env.local` (ver `.env.example`).
- [ ] `npx firebase login` y `npx firebase use --add`, con el alias `prod`.
- [ ] Crear el admin: `scripts/set-admin.ts` va contra los emuladores, así que hay que adaptarlo o
      poner el *custom claim* `admin: true` con el Admin SDK y credenciales del proyecto real.

## 2. Plan Blaze con protecciones

- [ ] Pasar a Blaze.
- [ ] Alertas de presupuesto de 1 € y de 5 € en Google Cloud Billing.
- [ ] Limpieza de las imágenes de las Functions:
      `npx firebase functions:artifacts:setpolicy --location europe-west1 --days 1`.
- [ ] Las Functions ya llevan `maxInstances: 10` y 0 instancias mínimas (`functions/src/index.ts`).
- [ ] Auth, en Ajustes: política de región de SMS que solo permita España (+34).
- [ ] Auth, en «Teléfono»: números de prueba para las demos (no envían SMS).

## 3. App Check

La web y las Functions ya están preparadas; solo se activa con configuración.

- [ ] Crear una clave de reCAPTCHA Enterprise para el dominio y registrarla en App Check.
- [ ] Poner la clave en `VITE_APPCHECK_SITE_KEY` (`.env.local`) y volver a hacer el build.
- [ ] Desplegar y mirar unos días las métricas de App Check en la consola: las peticiones deben
      llegar verificadas.
- [ ] Exigirlo:
  - Functions: crear `functions/.env.<id del proyecto>` con `ENFORCE_APP_CHECK=true` y volver a
    desplegar. Con el sufijo del proyecto, los emuladores no lo leen.
  - Auth, Firestore y Storage: botón «Exigir» en la consola de App Check.

## 4. Despliegue y dominio

- [ ] `npm run build` y `npx firebase deploy`.
- [ ] Comprobar que se crean las TTL de `qrTokens` y `dailyVisits` (Firestore → TTL).
- [ ] Dominio propio en Hosting (el SSL es gratis) y añadirlo a los dominios autorizados de Auth y a
      la clave de reCAPTCHA.

## 5. Textos legales

- [ ] Rellenar los datos del titular en `src/pages/Legal.tsx` (`OWNER`).
- [ ] Revisar con un asesor la política de privacidad, el aviso legal y el contrato de encargo.
      Ya se enlazan desde la portada, el registro del cliente y el alta del comercio.

## 6. Copias de seguridad de Firestore

- [ ] Copia diaria con 7 días de retención:
      `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=7d`.

## 7. Pruebas en dispositivos reales

- [ ] iPhone: Safari y PWA instalada (icono de inicio, entrar por SMS, QR con la cámara nativa).
- [ ] Android: Chrome y PWA instalada.
- [ ] Con mala cobertura: dar un sello y que no se cuente dos veces.

## 8. Piloto

3–5 comercios durante 4 semanas. Las métricas están en `/admin`:

- el tiempo de onboarding (mediana del alta);
- la duración del flujo (mediana del QR);
- los comercios que siguen sellando (último sello y marca «abandonado»);
- el coste real: consola de Firebase → Uso y facturación.

**Hecho cuando** los comercios del piloto llevan 4 semanas dando sellos y el coste mensual está
dentro de lo previsto.
