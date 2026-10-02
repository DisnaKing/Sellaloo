# Modelo de datos — Sellaloo

La fuente de verdad de los campos son los tipos de `functions/src/shared/model.ts`. Aquí va el para
qué de cada colección y quién puede leerla.

## Colecciones (Firestore)

| Colección | Para qué | Campos clave |
|---|---|---|
| `businesses/{id}` | comercio | `ownerUid`, `name`, `type`, `logoUrl`, `timezone`, `dailyVisitLimit`, `plan`, `active`, `firstStampAt` (para la métrica del onboarding) |
| `businesses/{id}/programs/{id}` | tarjeta del comercio (una activa en el MVP) | `stampsRequired`, `rewardDescription`, `stampExpiryMonths` (nulo = no caducan), `active` |
| `businesses/{id}/members/{id}` | cliente dentro del comercio, para listar y buscar | `customerId` (nulo si lo creó el dueño a mano), `name`, `searchName` (nombre en minúsculas y sin acentos, para buscar por prefijo), `phone`, `phoneVerified`, `currentStamps`, `rewardsPending`, `activeCardId`, `lastVisitAt` |
| `businesses/{id}/stats/{AAAA-MM \| total}` | contadores del panel | `visits`, `qrVisits`, `phoneVisits`, `stamps`, `rewardsEarned`, `rewardsRedeemed`, `newMembers`, `phoneSignups`, `flowMsTotal`; se actualizan en la misma transacción que el sello (y se restan al deshacer). El panel los lee con `where(documentId(), '>=', mes)`: trae el mes y `total`, y no falla si el mes aún no existe |
| `customers/{uid}` | cliente final | `name`, `email`, `phone` (opcional), `phoneVerified`, `privacyAcceptedAt` |
| `cards/{id}` | tarjeta de un cliente | `businessId`, `businessName`, `ownerUid`, `memberId`, `customerId`, `customerPhone`, `stamps`, `stampsRequired`, `reward`, `status` (`active` / `reward_pending` / `redeemed`), `completedAt`, `redeemedAt`, `stampsExpireAt` (nulo = no caducan) |
| `qrTokens/{token}` | QR de un solo uso | `businessId`, `ownerUid`, `amount` (1–3), `createdAt`, `expiresAt` (+150 s), `usedAt`, `usedByName`, `result` |
| `visits/{id}` | una entrega de sellos | `businessId`, `ownerUid`, `memberId`, `amount`, `method` (`qr` / `phone`), `localDate`, `allocations` (`[{cardId, count, created}]`), `flowMs`, `undoneAt` |
| `dailyVisits/{businessId_memberId_fecha}` | contador del límite diario | `count`, `expiresAt` |

- `allocations` guarda cuántos sellos fueron a cada tarjeta. Sirve para los sellos que pasan a la
  tarjeta siguiente y para deshacer la visita.
- `visits.undoneAt` marca la visita deshecha. Solo se deshace la última visita del comercio, el mismo
  día local y si ninguna de sus tarjetas se ha canjeado.
- `cards.stampsExpireAt` se renueva con cada sello. Si ya pasó, el siguiente sello empieza desde 0 y
  `/tarjetas` muestra 0 sellos.
- `qrTokens.createdAt` y `usedAt` miden la duración del flujo (`visits.flowMs`).
- **TTL:** `qrTokens.expiresAt` y `dailyVisits.expiresAt`. La TTL de Firestore borra con retraso,
  así que `redeemQr` comprueba `expiresAt` por su cuenta; la TTL solo limpia.

## Reglas (`firestore.rules`)

- El dueño lee los documentos con su `ownerUid`. Sus consultas sobre `cards` tienen que filtrar por
  `ownerUid`, o las reglas las rechazan.
- El dueño puede editar los datos básicos de su comercio; el resto de escrituras de negocio solo las
  hacen las Functions.
- El cliente crea y edita su `customers/{uid}`: nombre, teléfono declarado y aceptación de la
  privacidad. `phoneVerified` tiene que coincidir con el teléfono de su login por SMS.
- El cliente lee las `cards` cuyo `customerId` es su `uid`.
- El dueño puede editar `stampsRequired`, `rewardDescription` y `stampExpiryMonths` de su programa.
- El admin lo lee todo.
- Nadie escribe en `cards`, `visits`, `qrTokens` ni `dailyVisits` desde el cliente.

Los tests están en `tests/rules/firestore.test.ts` (`npm run test:rules`).

## Cloud Storage (`storage.rules`)

- `logos/{uid}/logo`: lo sube el dueño con ese `uid`, en WebP o JPEG y con menos de 100 KB. La
  lectura es pública.
- Las plantillas por tipo de negocio no están en Firestore: son `PROGRAM_TEMPLATES` en
  `functions/src/shared/model.ts`.

Los tests están en `tests/rules/storage.test.ts`.

## Índices (`firestore.indexes.json`)

- `cards`: `customerId` + `status`; `customerPhone` + `customerId` (para juntar tarjetas al
  verificar el teléfono); `businessId` + `status`.
- `visits`: `businessId` + `createdAt` descendente; `ownerUid` + `memberId` + `createdAt`
  descendente, para las últimas visitas de la ficha.
- `members` (subcolección): `ownerUid` + `rewardsPending`, para la lista «Premios pendientes»;
  `ownerUid` + `lastVisitAt` descendente, `ownerUid` + `searchName` y `ownerUid` + `phone`, para la
  lista y la búsqueda de clientes.
