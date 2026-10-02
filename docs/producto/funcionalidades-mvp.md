# Sellaloo — Funcionalidades del MVP

> Transcripción de `Sellaloo_funcionalidades_MVP.docx` (2026-10-01), con tres cambios decididos
> después:
> - **Supabase → Firebase:** la validación del QR la hace una Cloud Function, no una Edge Function.
> - **Límite diario configurable:** `dailyVisitLimit` por comercio, en visitas (por defecto 1; nulo
>   significa sin límite).
> - **El cliente también puede entrar con correo y contraseña**, además de con teléfono y SMS.

Funcionalidades organizadas por tipo de usuario, separando lo imprescindible para el MVP de lo que
puede esperar. **Regla para decidir:** si un comercio puede pasar un mes sin una función, esa función
queda fuera del MVP.

## 1. Cómo se dan los sellos

Hay dos métodos. El principal es el QR de un solo uso: generarlo ya es la aprobación del dueño. El
secundario, por teléfono, cubre a los clientes sin smartphone y los problemas de conexión.

### Método principal: QR de un solo uso

1. El cliente paga o termina el servicio.
2. El dueño elige cuántos sellos dar (1, 2 o 3; por defecto 1) y pulsa «Generar QR». El código
   aparece en su pantalla.
3. El cliente lo escanea con su móvil. Si no tiene cuenta, se registra en ese momento y queda dado
   de alta en el comercio.
4. El sello se confirma al instante y en la pantalla del dueño aparece «Sello dado a María» en
   tiempo real, sin tocar nada más.

### Requisitos del QR

- **Un solo uso:** en cuanto un cliente lo escanea, deja de valer. Una foto del código no sirve.
- **Caducidad corta:** 150 s. Si nadie lo escanea, se invalida solo.
- **Generado y validado en el servidor:** el QR lleva un token aleatorio que comprueba una Cloud
  Function, nunca datos que el cliente pueda falsificar.
- **Límite diario por cliente:** `dailyVisitLimit` visitas por cliente y día en cada comercio, como
  red de seguridad ante errores.

### Método secundario: por teléfono

- **Cliente sin smartphone:** el dueño teclea su teléfono y el sello queda confirmado. El cliente no
  hace nada.
- **Mala conexión:** el QR necesita internet en los dos móviles. Si el comercio tiene mala
  cobertura, este método sirve de alternativa.

### Correcciones

- El dueño puede **deshacer el último sello** por si se equivoca.

## 2. Comercio (app principal)

### Imprescindible en el MVP

- **Alta y acceso:** registro con correo, nombre del negocio, tipo (peluquería, estética,
  cafetería…) y logo opcional.
- **Crear su tarjeta:** número de sellos para el premio y descripción del premio, con plantillas
  por tipo de negocio ya rellenadas («10 cortes = 1 gratis»).
- **Dar sellos:** botón «Generar QR» con selector de 1, 2 o 3 sellos, y opción de sellar por
  teléfono.
- **Dar de alta un cliente a mano**, con nombre y teléfono, para el método por teléfono.
- **Deshacer el último sello.**
- **Canjear el premio:** con la tarjeta completa, el comercio lo marca como canjeado.
- **Lista de clientes:** buscar por nombre o teléfono y ver cuántos sellos lleva cada uno.
- **Panel mínimo:** clientes totales, sellos dados este mes y premios canjeados.

### Después del MVP

- Varios empleados con su propio acceso y registro de quién dio cada sello.
- Varias tarjetas o promociones a la vez.
- Estadísticas avanzadas: clientes que hace tiempo que no vienen, frecuencia media de visita.
- Mensajes a clientes («te falta 1 sello», «hace 2 meses que no vienes»).
- Varias sucursales con tarjeta compartida.
- Integración con TuCitero: sello automático al completar una cita.

## 3. Cliente final (web, sin instalar nada)

### Acceso

- Entra con su **teléfono y un código por SMS**, o con **correo y contraseña**.
- La sesión se queda abierta en su móvil: solo lo hace la primera vez.
- Dentro ve todas sus tarjetas de todos los comercios.

### Imprescindible en el MVP

- Escanear el QR del comercio para recibir sellos, registrándose en ese momento si aún no tiene
  cuenta.
- Ver sus tarjetas: sellos actuales, cuántos le faltan y el premio de cada comercio.
- Confirmación inmediata de cada sello recibido.

### Después del MVP

- Añadir la tarjeta a Apple Wallet o Google Wallet.
- Recibir avisos de sello sumado o de premio disponible.
- Historial de visitas y premios canjeados.

### A tener en cuenta

- **Coste de los SMS:** se cobran por mensaje. Con sesiones largas el volumen es bajo (ver
  [costes.md](../costes.md)).
- **Privacidad:** se guardan nombres y teléfonos, así que la política de privacidad tiene que
  explicar para qué se usan.

## 4. Administración (equipo)

### Imprescindible en el MVP

- Ver los comercios dados de alta y su actividad, para saber quién la usa de verdad.
- Desactivar un comercio o corregir datos si lo piden.
- Controlar el límite del plan gratuito.

### Después del MVP

- Gestión de suscripciones y pagos.
- Métricas globales para decidir si el producto funciona.

## 5. Reglas de negocio

| Regla | Decisión |
|---|---|
| Cómo se da un sello | QR de un solo uso generado por el dueño (principal) o por teléfono (secundario). |
| Aprobación | Automática: generar el QR ya es la aprobación. Sin estado «pendiente». |
| Sellos por QR | El dueño elige 1, 2 o 3 antes de generarlo; por defecto 1. |
| Límite diario | `dailyVisitLimit` visitas por cliente y día en cada comercio (por defecto 1). |
| Validez del QR | Un solo uso y 150 s. |
| Correcciones | El dueño puede deshacer el último sello. |
| Caducidad de sellos | Opcional por comercio y desactivada por defecto (por ejemplo, 12 meses). |
| Tarjeta completa | Pasa a «premio pendiente» y empieza una tarjeta nueva. Cada tarjeta completa es un premio. |
| Sellos sobrantes | Si un QR completa la tarjeta y sobran sellos, pasan a la siguiente. |

## 6. Requisitos no funcionales

- **Letra grande y pocos botones:** el usuario tipo es un comercio de gente mayor.
- **Tiempo real:** la pantalla del dueño refleja el escaneo al instante.
- **Alternativa sin conexión:** el método por teléfono cubre la mala cobertura.
- **Privacidad:** consentimiento al registrarse y política de privacidad visible.
- **Onboarding guiado:** en menos de 5 minutos, el comercio tiene su tarjeta y ha dado su primer
  sello.

## 7. El flujo que tiene que ser perfecto

Cliente en el mostrador, el dueño pulsa «Generar QR», el cliente escanea y el sello queda confirmado
en las dos pantallas. **Tiene que durar menos de 10 segundos**: si es más lento que poner un sello
de tinta en un cartón, el comercio lo dejará de usar.
