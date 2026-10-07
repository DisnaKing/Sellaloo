---
description: Crea una spec a partir de una idea, aclarando dudas antes de escribirla
argument-hint: [idea o funcionalidad a especificar]
allowed-tools: Read, Glob, Grep, Write, Bash(git log:*), Bash(git status:*)
---

Vas a crear una especificación (spec) para esta idea:

$ARGUMENTS

## Proceso

1. **Contexto**: explora el proyecto (estructura, convenciones, código relacionado) para entender dónde encaja la idea. No asumas nada que puedas comprobar leyendo el código.
2. **Aclaraciones**: antes de escribir, hazme las preguntas necesarias sobre lo que sea ambiguo o falte (alcance, casos límite, restricciones), concretas y agrupadas en un solo mensaje. Espera mis respuestas.
3. **Redacción**: con las respuestas, escribe la spec siguiendo la plantilla de abajo.
4. **Guardado**: guárdala en `docs/specs/<nombre-en-kebab-case>-XXX/spec.md(el numero que continue para tener un orden).md` (crea la carpeta si no existe) y dime la ruta.

## Plantilla de la spec

```
# <Título>

## Objetivo
Qué problema resuelve y por qué importa (2-3 frases).

## Alcance
- Incluye: ...
- No incluye: ...

## Requisitos funcionales
Lista numerada, cada requisito verificable y sin ambigüedad.

## Requisitos no funcionales
Rendimiento, seguridad, compatibilidad, etc. (solo si aplican).

## Comportamiento esperado
Flujo principal y casos límite o de error, descritos paso a paso.

## Modelo de datos / interfaces
Entidades, campos y contratos relevantes (sin implementación).

## Criterios de aceptación
Lista de condiciones que deben cumplirse para dar la spec por cumplida.

## Preguntas abiertas
Lo que quede por decidir.
```

## Reglas

- La spec describe el **qué** y el **porqué**, no el cómo: nada de código ni pseudocódigo.
- Escribe en español, con frases cortas y directas.
- Si algo no está decidido, déjalo en "Preguntas abiertas" en lugar de inventarlo.
- No empieces a implementar nada: este comando solo produce la spec.