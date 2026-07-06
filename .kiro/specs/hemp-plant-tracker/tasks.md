# Implementation Plan: Hemp Plant Tracker — Nuevas Funcionalidades

## Overview

Implementar las funcionalidades nuevas sobre el código base existente (login, CRUD de plantas, cálculo de etapas, drag&drop de imagen principal). Las tareas siguen la estructura de archivos definida en el diseño: módulos `services/`, `views/` y `worker/`. Se usa JavaScript vanilla, PocketBase como backend y un Cloudflare Worker como proxy seguro hacia la API de Groq.

---

## Tasks

- [x] 1. Refactorizar código base y crear estructura de módulos
  - [x] 1.1 Crear `services/stage-calc.js` extrayendo `calcStages`, `getCurrentStage`, `stageProgress`, `formatDate` y `daysUntil` de `app.js`
    - Exportar todas las funciones con `export`
    - Asegurarse de que `app.js` importe desde el nuevo módulo
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [ ]* 1.2 Escribir property test — Property 1: round-trip de cálculo de etapas
    - **Property 1: Round-trip de cálculo de etapas**
    - **Validates: Requirements 2.3, 2.5, 2.6**
    - Archivo: `tests/properties/stage-calc.test.js`
  - [ ]* 1.3 Escribir property test — Property 2: formato de fecha DD/MM/AAAA
    - **Property 2: Formato de fecha DD/MM/AAAA**
    - **Validates: Requirements 2.4**
    - Archivo: `tests/properties/stage-calc.test.js`
  - [ ]* 1.4 Escribir property test — Property 3: determinismo del estado actual de la planta
    - **Property 3: Determinismo del estado actual de la planta**
    - **Validates: Requirements 3.1, 3.2**
    - Archivo: `tests/properties/stage-calc.test.js`
  - [x] 1.5 Crear `services/api.js` extrayendo el objeto `API` existente de `app.js` y agregando todos los métodos nuevos del diseño (fotos, actividades, tipos personalizados, tareas, genéticas, cosechas)
    - Exportar el objeto `API`
    - `app.js` importa desde `services/api.js`
    - _Requirements: 7.4, 9.4, 9.8, 10.9, 12.1_
  - [ ]* 1.6 Escribir property test — Property 5: round-trip de persistencia de planta
    - **Property 5: Round-trip de persistencia de planta**
    - **Validates: Requirements 1.2, 4.2**
    - Archivo: `tests/properties/api.test.js` (mock PocketBase)
  - [x] 1.7 Agregar `WORKER_URL` a `config.js` para que el Worker sea configurable desde un único punto
    - _Requirements: 8.6_

- [x] 2. Configurar entorno de testing
  - [x] 2.1 Inicializar proyecto Node.js con `package.json`, instalar `vitest` y `fast-check`
    - Crear `tests/` con subcarpetas `properties/`, `examples/`, `integration/`
    - Agregar script `"test": "vitest --run"` en `package.json`
    - _Requirements: (soporte transversal de tests)_

- [x] 3. Checkpoint — Verificar módulos base
  - Asegurar que `services/stage-calc.js` y `services/api.js` exportan correctamente, que `app.js` funciona igual que antes y que los tests de propiedades 1, 2 y 3 pasan.

- [x] 4. Implementar Cloudflare Worker (proxy Groq)
  - [x] 4.1 Crear `worker/index.js` con la lógica de proxy: validación de token PocketBase, construcción de prompts según `type`, llamada a Groq API, parseo de respuesta JSON, manejo de errores
    - Soportar los tres tipos: `genetics_info`, `stage_durations`, `activity_suggestions`
    - Leer `GROQ_API_KEY` desde `env` (nunca en respuesta)
    - _Requirements: 8.1, 8.3, 8.6, 8.8, 8.9_
  - [x] 4.2 Crear `wrangler.toml` con nombre del worker y binding de variable de entorno `GROQ_API_KEY`
    - _Requirements: 8.6_
  - [ ]* 4.3 Escribir property test — Property 9: autorización en el Cloudflare Worker
    - **Property 9: Autorización en el Cloudflare Worker**
    - **Validates: Requirements 8.8**
    - Archivo: `tests/properties/worker.test.js`

- [x] 5. Implementar `services/ai.js`
  - [x] 5.1 Crear `services/ai.js` con los métodos `AI.getGeneticsInfo`, `AI.getStageDurations` y `AI.getActivitySuggestions`
    - Incluir timeout de 15 s con `AbortController`
    - Retornar `null` en cualquier fallo sin propagar excepciones
    - Mostrar toast "Tiempo de espera agotado para la IA" en caso de `AbortError`
    - _Requirements: 8.1, 8.3, 8.5, 8.7, 8.9_

- [x] 6. Diario fotográfico (`views/photo-diary.js`)
  - [x] 6.1 Crear `views/photo-diary.js` con la galería de miniaturas ordenada de más reciente a más antigua, incluyendo `capture_date` en DD/MM/AAAA y notas si existen
    - Leer fotos desde `API.getPhotos`
    - _Requirements: 7.1, 7.5_
  - [ ]* 6.2 Escribir property test — Property 7: orden cronológico del diario fotográfico
    - **Property 7: Orden cronológico del diario fotográfico**
    - **Validates: Requirements 7.1**
    - Archivo: `tests/properties/photo-diary.test.js`
  - [ ]* 6.3 Escribir property test — Property 8: renderizado completo de entradas de galería
    - **Property 8: Renderizado completo de entradas de galería**
    - **Validates: Requirements 7.5**
    - Archivo: `tests/properties/photo-diary.test.js`
  - [x] 6.4 Implementar formulario de subida de fotos con validación cliente (JPEG/PNG/WebP, máx 10 MB), captura desde cámara si está disponible, y campo de fecha editable (default hoy)
    - Llamar a `API.createPhoto` con `FormData`
    - _Requirements: 7.2, 7.3, 7.4, 7.9, 7.10_
  - [ ]* 6.5 Escribir property test — Property 6: validación de archivos de foto
    - **Property 6: Validación de archivos de foto**
    - **Validates: Requirements 7.9, 7.10**
    - Archivo: `tests/properties/photo-diary.test.js`
  - [x] 6.6 Implementar vista ampliada (lightbox) al seleccionar una foto, con confirmación de eliminación que llama a `API.deletePhoto` y elimina la miniatura de forma inmediata
    - _Requirements: 7.6, 7.7, 7.8_

- [x] 7. Checkpoint — Diario fotográfico funcional
  - Asegurar que subida, galería, lightbox y eliminación de fotos funcionan correctamente y que los tests de propiedades 6, 7 y 8 pasan.

- [x] 8. Registro de actividades con línea de tiempo (`views/activity-timeline.js`)
  - [x] 8.1 Crear `views/activity-timeline.js` con la línea de tiempo: listado de actividades ordenadas de más reciente a más antigua, mostrando tipo, fecha en DD/MM/AAAA y notas
    - Leer desde `API.getActivities`
    - _Requirements: 9.5, 9.6_
  - [ ]* 8.2 Escribir property test — Property 13: orden cronológico de la línea de tiempo
    - **Property 13: Orden cronológico de la línea de tiempo de actividades**
    - **Validates: Requirements 9.5**
    - Archivo: `tests/properties/activity-timeline.test.js`
  - [x] 8.3 Implementar formulario de creación de actividad con selector de tipos predefinidos (Regar, Fertilizar, Poda, LST, Defoliación, Trasplante) más tipos personalizados del usuario
    - Validar `activity_type` y `activity_date` como obligatorios, notas máx 500 caracteres
    - Mostrar sugerencias del `AI.getActivitySuggestions` si está disponible
    - Persistir en `API.createActivity`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.11_
  - [ ]* 8.4 Escribir property test — Property 12: validación de campos obligatorios de actividad
    - **Property 12: Validación de campos obligatorios de actividad**
    - **Validates: Requirements 9.3**
    - Archivo: `tests/properties/activity-timeline.test.js`
  - [x] 8.5 Implementar gestión de tipos de actividad personalizados: creación (máx 50 caracteres), listado desde `API.getCustomTypes` y eliminación con `API.deleteCustomType`
    - _Requirements: 9.2_
  - [ ]* 8.6 Escribir property test — Property 11: validación de longitud de tipos de actividad personalizados
    - **Property 11: Validación de longitud de tipos de actividad personalizados**
    - **Validates: Requirements 9.2**
    - Archivo: `tests/properties/activity-timeline.test.js`
  - [x] 8.7 Implementar edición y eliminación de actividades en la línea de tiempo con confirmación antes de borrar, actualizando PocketBase con `API.updateActivity` / `API.deleteActivity`
    - _Requirements: 9.7, 9.8, 9.9, 9.10_

- [x] 9. Tareas automáticas y manuales (`views/tasks.js`)
  - [x] 9.1 Crear `services/stage-calc.js` → función `generateAutoTasks(plant, stages)` que produce el conjunto de tareas predefinidas por etapa con `scheduled_date` calculadas según el diseño
    - _Requirements: 10.1_
  - [x] 9.2 Integrar `generateAutoTasks` en el flujo de carga de planta: detectar avance de etapa comparando etapa guardada vs calculada, y persistir las tareas nuevas en `API.createTask` con `auto_generated: true`
    - _Requirements: 10.1_
  - [x] 9.3 Crear `views/tasks.js` con la vista de tareas organizada en tres secciones (Hoy, Mañana, Esta semana) mostrando planta asociada, tipo de actividad y fecha programada
    - Resaltar visualmente tareas vencidas (`completed = false` y `scheduled_date < hoy`)
    - Leer desde `API.getTasks`
    - _Requirements: 10.2, 10.3, 10.10_
  - [ ]* 9.4 Escribir property test — Property 14: agrupación temporal de tareas
    - **Property 14: Agrupación temporal de tareas**
    - **Validates: Requirements 10.2**
    - Archivo: `tests/properties/tasks.test.js`
  - [ ]* 9.5 Escribir property test — Property 15: marcado de tareas vencidas
    - **Property 15: Marcado de tareas vencidas**
    - **Validates: Requirements 10.10**
    - Archivo: `tests/properties/tasks.test.js`
  - [x] 9.6 Implementar formulario de creación manual de tarea con campos: planta, tipo de actividad, fecha programada; persistir con `API.createTask` con estado inicial pendiente
    - _Requirements: 10.4_
  - [x] 9.7 Implementar edición de tarea (tipo, fecha, estado pendiente/completada), marcar como completada registrando `completed_date = hoy` y moviendo a sección completadas; confirmación antes de eliminar
    - _Requirements: 10.5, 10.6, 10.7, 10.8, 10.9_
  - [ ]* 9.8 Escribir property test — Property 16: registro de fecha de completado de tarea
    - **Property 16: Registro de fecha de completado de tarea**
    - **Validates: Requirements 10.6**
    - Archivo: `tests/properties/tasks.test.js`

- [x] 10. Checkpoint — Actividades y tareas funcionales
  - Asegurar que la línea de tiempo, los tipos personalizados, la vista de tareas y la generación automática funcionan correctamente y que los tests de propiedades 11, 12, 13, 14, 15 y 16 pasan.

- [x] 11. Estadísticas del cultivador (`views/stats.js`)
  - [x] 11.1 Crear `views/stats.js` con la sección de estadísticas: total de ciclos completados, promedio de duración en días, mayor producción en gramos y genética más cultivada
    - Calcular a partir de `API.getHarvests` filtrando por `currentUser.id`
    - Mostrar estado vacío descriptivo si no hay cosechas
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.6, 11.7, 11.8_
  - [ ]* 11.2 Escribir property test — Property 17: exactitud de estadísticas calculadas
    - **Property 17: Exactitud de estadísticas calculadas**
    - **Validates: Requirements 11.2, 11.4, 11.5**
    - Archivo: `tests/properties/stats.test.js`
  - [ ]* 11.3 Escribir property test — Property 18: aislamiento de estadísticas por usuario
    - **Property 18: Aislamiento de estadísticas por usuario**
    - **Validates: Requirements 11.7**
    - Archivo: `tests/properties/stats.test.js`
  - [x] 11.4 Implementar formulario de registro de cosecha en el detalle de planta: campo `harvest_date` y `weight_grams`, persistir con `API.createHarvest`, actualizar estadísticas de forma inmediata sin recargar página
    - _Requirements: 11.3, 11.9_

- [x] 12. Ficha técnica de genética (`views/genetics-card.js`)
  - [x] 12.1 Crear script de seed para pre-cargar las 30 variedades más comunes en la colección `genetics_db` de PocketBase con todos los campos (nombre, THC%, CBD%, banco, dominancia, altura, notas)
    - _Requirements: 12.1_
  - [x] 12.2 Crear `views/genetics-card.js` que busca la genética de la planta en `API.getGenetics`; si no existe, consulta `AI.getGeneticsInfo` y persiste el resultado en `API.createGenetics`; muestra "No disponible" en campos ausentes
    - _Requirements: 12.2, 12.3, 12.4, 12.5_
  - [ ]* 12.3 Escribir property test — Property 10: mapeo completo de la respuesta de IA a ficha técnica
    - **Property 10: Mapeo completo de la respuesta de IA a ficha técnica**
    - **Validates: Requirements 8.2, 12.4, 12.5**
    - Archivo: `tests/properties/genetics-card.test.js`
  - [x] 12.4 Implementar edición manual de la ficha técnica: formulario con todos los campos, guardar con `API.updateGenetics`, propagar cambios a todas las plantas del usuario que compartan esa genética actualizando la vista de forma inmediata
    - _Requirements: 12.6, 12.7_
  - [ ]* 12.5 Escribir property test — Property 19: propagación de cambios de genética a todas las plantas del usuario
    - **Property 19: Propagación de cambios de genética a todas las plantas del usuario**
    - **Validates: Requirements 12.7**
    - Archivo: `tests/properties/genetics-card.test.js`

- [ ] 13. Vista de detalle de planta con tabs (`views/plant-detail.js`)
  - [ ] 13.1 Crear `views/plant-detail.js` que sustituye al `openDetailModal` actual con una vista de tabs: Resumen, Diario, Actividades, Tareas, Genética
    - Ensamblar los módulos `photo-diary.js`, `activity-timeline.js`, `tasks.js` y `genetics-card.js`
    - Mantener la información actual de etapas y cosecha en el tab Resumen
    - _Requirements: 7.1, 9.5, 10.3, 12.2_
  - [x] 13.2 Integrar el flujo de sugerencias de IA al abrir el formulario de actividad dentro del detalle: llamar `AI.getActivitySuggestions` con la etapa actual y mostrar sugerencias como chips seleccionables
    - _Requirements: 8.5, 9.11_
  - [ ]* 13.3 Escribir property test — Property 4: formulario de edición pre-poblado
    - **Property 4: Formulario de edición pre-poblado**
    - **Validates: Requirements 4.1**
    - Archivo: `tests/properties/plant-detail.test.js`

- [x] 14. Integrar sugerencias de IA en el formulario de registro/edición de planta
  - [x] 14.1 En el formulario modal de agregar/editar planta, llamar a `AI.getStageDurations` al salir del campo genética y mostrar las duraciones sugeridas como valores diferenciados con opción de aceptar o ignorar
    - _Requirements: 8.3, 8.4_
  - [x] 14.2 En el mismo formulario, llamar a `AI.getGeneticsInfo` al guardar una planta nueva para pre-poblar la ficha técnica de la genética si no existe en `genetics_db`
    - _Requirements: 8.1, 8.2_

- [x] 15. Configurar colecciones PocketBase nuevas
  - [x] 15.1 Crear script `setup-new-collections.sh` (o instrucciones en README) para crear las colecciones `photos`, `activities`, `custom_activity_types`, `tasks`, `genetics_db` y `harvests` con los campos y tipos definidos en el diseño
    - _Requirements: 7.4, 9.4, 10.9, 12.1_

- [x] 16. Checkpoint final — Integración completa
  - Asegurar que todos los módulos están conectados en `index.html` y `app.js`, que el Worker está desplegado, que el seed de genéticas fue ejecutado y que el conjunto completo de property tests pasa.

---

## Notes

- Las sub-tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido.
- El diseño especifica JavaScript vanilla; no se introducen frameworks JS adicionales.
- Los módulos en `views/` y `services/` se agregan como scripts en `index.html` con `type="module"` o bien se concatenan manualmente si se prefiere evitar la dependencia de ES modules en el navegador.
- Los property tests requieren Node.js y `vitest` + `fast-check`; ejecutar con `npm test`.
- `WORKER_URL` se agrega a `config.js` de la misma forma que `POCKETBASE_URL`.
- La colección `genetics_db` se puede pre-poblar con el seed script antes de desplegar.
- Las 19 propiedades del diseño se testean con fast-check (mínimo 100 iteraciones por propiedad).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "1.7", "15.1"] },
    { "id": 1, "tasks": ["1.1", "1.5"] },
    { "id": 2, "tasks": ["1.2", "1.3", "1.4", "1.6", "4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "5.1"] },
    { "id": 4, "tasks": ["6.1", "8.1", "9.1", "11.1", "12.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4", "8.2", "8.3", "9.2", "9.3", "11.2", "11.3", "12.2"] },
    { "id": 6, "tasks": ["6.5", "6.6", "8.4", "8.5", "8.7", "9.4", "9.5", "9.6", "11.4", "12.3", "12.4"] },
    { "id": 7, "tasks": ["8.6", "9.7", "9.8", "12.5", "13.1"] },
    { "id": 8, "tasks": ["13.2", "13.3", "14.1"] },
    { "id": 9, "tasks": ["14.2"] }
  ]
}
```
