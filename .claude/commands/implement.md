---
description: Implementa las tareas de un fichero de tareas, una a una
argument-hint: [ruta del fichero de tareas] [T3 | todas]
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(git status:*), Bash(git diff:*), Bash(./mvnw:*), Bash(mvn:*), Bash(npm test:*), Bash(npm run:*)
---

Vas a implementar tareas de este fichero:

$ARGUMENTS

El primer argumento es la ruta del fichero de tareas (p. ej. `tasks/mi-feature.md`). El segundo es opcional:
- Sin segundo argumento: implementa **solo la siguiente tarea pendiente** y para.
- Un identificador (`T3`): implementa solo esa tarea.
- `todas`: implementa todas las pendientes en orden, parando si algo falla.

Si no he pasado ruta, lista `docs/specs/nombre de la implementacion/` y pregúntame cuál usar.

## Proceso

1. **Contexto**: lee el fichero de tareas y, desde su cabecera, el plan y la spec. Tenlos presentes para respetar el alcance y los criterios de aceptación.
2. **Elige la tarea**: la primera sin marcar (`- [ ]`) cuyas dependencias estén todas hechas. Si ninguna se puede empezar, dime qué la bloquea.
3. **Explora antes de tocar**: lee los archivos que indica la tarea y su entorno (convenciones, estilo, tests existentes). No asumas cómo es el código: compruébalo.
4. **Implementa solo esa tarea**: cambios mínimos y centrados en su objetivo. Sigue el estilo del proyecto.
5. **Verifica**: comprueba el "Hecho cuando" de la tarea. Ejecuta los tests relacionados y, si existen, los que cubren lo que has tocado.
6. **Marca la tarea**: cambia `- [ ]` por `- [x]` en el fichero de tareas, solo si la verificación ha pasado.
7. **Informa** con un resumen breve: qué has hecho, qué archivos has tocado, qué has comprobado y cuál es la siguiente tarea.

## Reglas

- Una tarea cada vez. No adelantes trabajo de tareas posteriores ni "aproveches" para refactorizar lo que no toca.
- Si la tarea no se puede cumplir tal como está escrita (la spec o el plan se contradicen, falta información, el código real no encaja), **para y pregúntame**. No improvises ni cambies el alcance por tu cuenta.
- Si un test falla, intenta arreglarlo dentro del alcance de la tarea. Si no lo consigues, no marques la tarea y explícame el error.
- No marques como hecha una tarea que no hayas verificado.
- No hagas commits ni push: eso lo decido yo después de revisar los cambios.
- Si detectas que falta una tarea o que una sobra, no edites la lista por tu cuenta: avísame.
- Escribe en español, con frases cortas y directas.