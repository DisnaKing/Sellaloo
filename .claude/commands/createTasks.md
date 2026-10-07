---
description: Crea un fichero de tareas a partir de un plan
argument-hint: [ruta del plan, p. ej. plans/mi-feature.md]
allowed-tools: Read, Glob, Grep, Write, Bash(ls:*)
---

Vas a crear el fichero de tareas a partir de este plan:

$ARGUMENTS

## Proceso

1. **Localiza el plan**: lee el archivo indicado. Si no he pasado ruta, lista `plans/` y pregúntame cuál usar.
2. **Lee también la spec** enlazada en el plan (campo `Spec:`) para tener a mano los criterios de aceptación.
3. **Descompón el plan en tareas**: cada paso del plan se convierte en una o varias tareas pequeñas, respetando el orden y las dependencias que indica el plan.
4. **Revisa la cobertura**: comprueba que todos los pasos del plan y todos los requisitos de la spec quedan cubiertos por alguna tarea. Si algo queda fuera, añádelo o avísame.
5. **Guarda el fichero** en `docs/specs/nombre-spec/tasks.md` (crea la carpeta si no existe) y dime la ruta.

## Plantilla del fichero de tareas

```
# Tareas: <título>

Spec: <ruta a la spec>
Plan: <ruta al plan>

## Tareas

- [ ] **T1 — <Título corto y accionable>**
  - Qué: descripción en 1-2 frases.
  - Archivos: `ruta/archivo`, ...
  - Depende de: — (o T0, T2...)
  - Hecho cuando: criterio concreto y verificable.

- [ ] **T2 — ...**
  ...

## Orden recomendado
Secuencia sugerida y qué tareas pueden hacerse en paralelo.
```

## Reglas

- Una tarea = un cambio pequeño y completable de una sentada, con un único objetivo. Si necesita más de dos frases para explicarse, divídela.
- Cada tarea lleva un "Hecho cuando" que se pueda comprobar (test que pasa, comportamiento observable, archivo creado...).
- Numera las tareas (T1, T2...) para poder referenciarlas en las dependencias y en los commits.
- Incluye tareas de pruebas siguiendo la estrategia de pruebas del plan, no las dejes para el final como algo opcional.
- No añadas tareas que no salgan del plan ni de la spec.
- Nada de código: describe el trabajo, no lo implementes.
- Escribe en español, con frases cortas y directas.
- No empieces a ejecutar ninguna tarea: este comando solo produce el fichero.