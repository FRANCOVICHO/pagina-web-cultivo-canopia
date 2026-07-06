# Design Document — Hemp Plant Tracker

## Overview

Hemp Plant Tracker es una extensión de la web Canopia que permite a cultivadores registrar y hacer seguimiento del ciclo de vida de sus plantas de cáñamo. El sistema ya cuenta con una base funcional (login, CRUD de plantas, cálculo de etapas) desplegada en Cloudflare Pages con PocketBase como backend self-hosted.

Este diseño cubre las funcionalidades nuevas a implementar:
- Diario fotográfico por planta
- Registro de actividades con línea de tiempo
- Tareas automáticas y manuales
- Estadísticas del cultivador
- Fichas técnicas de genéticas con soporte de IA
- Asistente IA vía Cloudflare Worker + Groq API

La estética mantiene el lenguaje visual Canopia: fondo `#0d0d0d`, tarjetas con borde sutil, texto blanco, acento verde `#4caf50–#66bb6a`, sin barra de navegación superior.

---

## Architecture

El sistema sigue una arquitectura de tres capas desacopladas:

```
┌─────────────────────────────────────────┐
│         Cloudflare Pages (Frontend)     │
│  HTML/CSS/JS Vanilla + Views + Services │
└──────────────────┬──────────────────────┘
                   │ REST API (fetch)
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐   ┌──────────────────────┐
│  PocketBase   │   │  Cloudflare Worker   │
│  (self-hosted)│   │  /api/ai proxy       │
│  Ubuntu VPS   │   │  (custodia API key)  │
│  + CF Tunnel  │   └──────────┬───────────┘
└───────────────┘              │
                               ▼
                     ┌─────────────────┐
                     │   Groq API      │
                     │ llama-3.3-70b   │
                     └─────────────────┘
```

**Decisiones clave:**
- **Sin framework JS**: Se mantiene vanilla JS para coherencia con el código existente y simplicidad de despliegue.
- **SPA con vistas JS**: Cada sección (photo-diary, activities, tasks, stats, genetics-card) es un módulo JS independiente que renderiza HTML dinámico.
- **Cloudflare Worker como proxy seguro**: La API key de Groq nunca llega al navegador.
- **PocketBase como fuente de verdad**: Todos los datos se persisten en PocketBase; se abandona el localStorage de las versiones previas del diseño de requirements.
- **URL dinámica de PocketBase**: `config.js` sigue siendo el punto central de configuración; el Worker tiene su propio binding a la variable de entorno.

---

## Components and Interfaces

### Estructura de archivos

```
/
├── index.html              (existente — ampliar con contenedores de vistas)
├── style.css               (existente — ampliar con nuevos componentes)
├── config.js               (existente — POCKETBASE_URL + WORKER_URL)
├── app.js                  (existente — ampliar con router y eventos)
├── views/
│   ├── plant-detail.js     (tabs: diario, actividades, tareas, genética)
│   ├── photo-diary.js      (galería de fotos, upload, lightbox)
│   ├── activity-timeline.js(línea de tiempo, CRUD actividades)
│   ├── tasks.js            (vista Hoy/Mañana/Semana, CRUD tareas)
│   ├── stats.js            (estadísticas del cultivador)
│   └── genetics-card.js    (ficha técnica, edición)
├── services/
│   ├── api.js              (todos los calls a PocketBase)
│   ├── ai.js               (calls al Cloudflare Worker)
│   └── stage-calc.js       (cálculos de fechas — extraído de app.js)
├── worker/
│   └── index.js            (Cloudflare Worker — proxy Groq)
└── wrangler.toml           (configuración del Worker)
```

### `services/api.js` — Interfaz PocketBase

Centraliza todos los fetch a PocketBase. Exporta un objeto `API` con los siguientes métodos:

```js
// Plantas (ya implementado en app.js, migrar aquí)
API.getPlants(token, userId)
API.createPlant(token, formData)
API.updatePlant(token, id, formData)
API.deletePlant(token, id)

// Fotos
API.getPhotos(token, plantId)          // GET /photos?filter=(plant="id")&sort=-capture_date
API.createPhoto(token, formData)       // POST /photos (multipart)
API.deletePhoto(token, id)             // DELETE /photos/:id

// Actividades
API.getActivities(token, plantId)      // GET /activities?filter=(plant="id")&sort=-activity_date
API.createActivity(token, data)        // POST /activities
API.updateActivity(token, id, data)    // PATCH /activities/:id
API.deleteActivity(token, id)          // DELETE /activities/:id

// Tipos de actividad personalizados
API.getCustomTypes(token, userId)      // GET /custom_activity_types?filter=(user="id")
API.createCustomType(token, data)      // POST /custom_activity_types
API.deleteCustomType(token, id)        // DELETE /custom_activity_types/:id

// Tareas
API.getTasks(token, userId)            // GET /tasks?filter=(user="id")&sort=scheduled_date
API.createTask(token, data)            // POST /tasks
API.updateTask(token, id, data)        // PATCH /tasks/:id
API.deleteTask(token, id)              // DELETE /tasks/:id

// Genéticas
API.getGenetics(token, name)           // GET /genetics_db?filter=(name~"query")
API.createGenetics(token, data)        // POST /genetics_db
API.updateGenetics(token, id, data)    // PATCH /genetics_db/:id

// Cosechas
API.createHarvest(token, data)         // POST /harvests
API.getHarvests(token, userId)         // GET /harvests?filter=(user="id")
```

### `services/ai.js` — Interfaz Cloudflare Worker

```js
// Obtener ficha técnica de una genética
AI.getGeneticsInfo(token, geneticsName)
// → POST WORKER_URL/api/ai { type: "genetics_info", genetics: name }

// Obtener duraciones sugeridas para una variedad
AI.getStageDurations(token, geneticsName, floweringType)
// → POST WORKER_URL/api/ai { type: "stage_durations", genetics: name, type: "autoflowering"|"photoperiod" }

// Obtener sugerencias de actividades para una etapa
AI.getActivitySuggestions(token, plantStage)
// → POST WORKER_URL/api/ai { type: "activity_suggestions", stage: stageName }
```

Todos los métodos incluyen:
- Header `Authorization: token` enviado al Worker para validación
- Timeout de 15 segundos con `AbortController`
- Retorno de `null` en caso de error (sin propagar excepciones al caller)

### `services/stage-calc.js` — Cálculo de etapas

Extracción de las funciones ya implementadas en `app.js`:

```js
calcStages(plant)       // → { dur, germStart, vegStart, florStart, dryStart, harvestDate }
getCurrentStage(stages) // → string (etapa actual)
stageProgress(stages, stageName) // → { pct, dayIn, total }
formatDate(date)        // → "DD/MM/AAAA"
daysUntil(date)         // → número de días
generateAutoTasks(plant, stages) // → Task[]  (nueva función)
```

### `worker/index.js` — Cloudflare Worker

```
POST /api/ai
  Headers: Authorization: <PocketBase token>
  Body: { type: "genetics_info"|"stage_durations"|"activity_suggestions", ...params }

Flujo:
  1. Validar token con PocketBase (GET /api/collections/users/auth-refresh)
  2. Construir prompt según type
  3. POST Groq API con GROQ_API_KEY (desde env)
  4. Parsear respuesta JSON del LLM
  5. Retornar JSON estructurado al Frontend
  6. Si falla en cualquier paso: retornar { error: mensaje } con status 4xx/5xx
```

Prompts por tipo de request:

| type | Prompt base |
|------|-------------|
| `genetics_info` | "Provide technical data for cannabis strain {name}: THC%, CBD%, breeder/bank, dominance (Indica/Sativa/Hybrid), estimated height in cm, and cultivation notes. Respond ONLY with valid JSON." |
| `stage_durations` | "For {type} cannabis strain {name}, give estimated grow stage durations in days: germination, vegetative, flowering, drying. Respond ONLY with valid JSON." |
| `activity_suggestions` | "Suggest 3-5 care activities for a cannabis plant in the {stage} stage. Respond ONLY with a JSON array of strings." |

---

## Data Models

### Colecciones PocketBase existentes

```
plants: id, user(rel), name, genetics, type(select: autoflowering|photoperiod),
        environment(select: Interior|Exterior), start_date(text YYYY-MM-DD),
        dur_germination, dur_vegetative, dur_flowering, dur_drying(number),
        image(file)
```

### Nuevas colecciones

```
photos:
  id, plant(rel→plants), image(file), capture_date(text YYYY-MM-DD),
  notes(text, max 500), user(rel→users), created

activities:
  id, plant(rel→plants), activity_type(text), activity_date(text YYYY-MM-DD),
  notes(text, max 500), user(rel→users), is_custom(bool), created

custom_activity_types:
  id, name(text, max 50), user(rel→users), created

tasks:
  id, plant(rel→plants), activity_type(text), scheduled_date(text YYYY-MM-DD),
  completed(bool, default false), completed_date(text YYYY-MM-DD, nullable),
  user(rel→users), auto_generated(bool, default false), created

genetics_db:
  id, name(text), thc_pct(text), cbd_pct(text), bank(text),
  dominance(select: Índica|Sativa|Híbrida), height_cm(text),
  notes(text), ai_generated(bool, default false), created

harvests:
  id, plant(rel→plants), harvest_date(text YYYY-MM-DD),
  weight_grams(number), notes(text), user(rel→users), created
```

**Nota de diseño**: Los campos de fecha se almacenan como `text` en formato `YYYY-MM-DD` para coherencia con el código existente (`plant.start_date`). El formateo a `DD/MM/AAAA` ocurre exclusivamente en la capa de presentación.

### Modelo de Tarea — generación automática

Cuando `getCurrentStage` detecta que la planta avanzó a una nueva etapa (comparando etapa guardada vs etapa calculada), `generateAutoTasks` produce:

| Etapa | Tareas generadas | scheduled_date |
|-------|-----------------|----------------|
| Germinación | Verificar humedad de germinación | stageStart + 1 |
| Vegetativo | Primer riego, Primer fertilizado | stageStart + 1, stageStart + 7 |
| Floración | Cambio de nutrientes a floración, Control de trichomas | stageStart + 1, stageStart + 21 |
| Secado | Colgar y verificar humedad | stageStart + 1 |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Round-trip de cálculo de etapas

*For any* planta con fecha de inicio y duraciones válidas (custom o por defecto), la fecha de inicio de cada etapa debe ser exactamente igual a `start_date + suma acumulada de las duraciones de etapas previas`.

**Validates: Requirements 2.3, 2.5, 2.6**

### Property 2: Formato de fecha DD/MM/AAAA

*For any* objeto `Date` válido, la función `formatDate` debe producir una cadena que coincida con el patrón `DD/MM/AAAA` (dos dígitos día, dos dígitos mes, cuatro dígitos año separados por `/`).

**Validates: Requirements 2.4**

### Property 3: Determinismo del estado actual de la planta

*For any* planta y cualquier fecha simulada como "hoy", `getCurrentStage` debe retornar la etapa cuyo rango `[stageStart, nextStageStart)` contiene esa fecha, sin solapamientos ni huecos entre etapas.

**Validates: Requirements 3.1, 3.2**

### Property 4: Formulario de edición pre-poblado

*For any* planta guardada con cualquier combinación de campos válidos, abrir el formulario de edición debe resultar en que cada input del formulario contenga exactamente el valor correspondiente del registro de la planta.

**Validates: Requirements 4.1**

### Property 5: Round-trip de persistencia de planta

*For any* conjunto de datos válidos de una planta (nombre, genética, tipo, ambiente, fecha de inicio), guardar y luego recuperar desde PocketBase debe producir un registro con todos los campos iguales a los enviados.

**Validates: Requirements 1.2, 4.2**

### Property 6: Validación de archivos de foto

*For any* archivo de imagen, el sistema debe aceptarlo si y solo si su tipo MIME es `image/jpeg`, `image/png` o `image/webp` Y su tamaño es ≤ 10 MB. Cualquier archivo que no cumpla ambas condiciones debe ser rechazado sin iniciar la subida.

**Validates: Requirements 7.9, 7.10**

### Property 7: Orden cronológico del diario fotográfico

*For any* colección de fotos con distintas `capture_date`, la galería del diario debe mostrarlas ordenadas de más reciente a más antigua (descendente por `capture_date`), sin excepción.

**Validates: Requirements 7.1**

### Property 8: Renderizado completo de entradas de galería

*For any* registro de foto en PocketBase, la entrada renderizada en la galería debe contener: miniatura de la imagen, `capture_date` en formato DD/MM/AAAA, y las notas si la propiedad `notes` no está vacía.

**Validates: Requirements 7.5**

### Property 9: Autorización en el Cloudflare Worker

*For any* solicitud al endpoint `POST /api/ai`, el Worker debe rechazar con status 401 las solicitudes con token ausente o inválido, y solo reenviar a Groq las solicitudes con token PocketBase válido.

**Validates: Requirements 8.8**

### Property 10: Mapeo completo de la respuesta de IA a ficha técnica

*For any* respuesta JSON del Worker de tipo `genetics_info` que contenga cualquier subconjunto de los campos `{thc_pct, cbd_pct, bank, dominance, height_cm, notes}`, el Tracker debe poblar exactamente los campos presentes y mostrar "No disponible" para los ausentes.

**Validates: Requirements 8.2, 12.4, 12.5**

### Property 11: Validación de longitud de tipos de actividad personalizados

*For any* cadena de texto ingresada como nombre de tipo de actividad personalizado, el sistema debe aceptarla si su longitud es ≤ 50 caracteres y rechazarla con mensaje de error si supera 50 caracteres.

**Validates: Requirements 9.2**

### Property 12: Validación de campos obligatorios de actividad

*For any* intento de crear una actividad, la operación debe fallar con error descriptivo si falta el `activity_type` o la `activity_date`, y debe aceptar notas de hasta 500 caracteres mientras rechaza notas que superen ese límite.

**Validates: Requirements 9.3**

### Property 13: Orden cronológico de la línea de tiempo de actividades

*For any* colección de actividades con distintas `activity_date`, la línea de tiempo debe mostrarlas ordenadas de más reciente a más antigua (descendente por `activity_date`).

**Validates: Requirements 9.5**

### Property 14: Agrupación temporal de tareas

*For any* tarea pendiente con una `scheduled_date`, debe aparecer en exactamente una sección: "Hoy" si `scheduled_date === today`, "Mañana" si `scheduled_date === today + 1`, "Esta semana" si `today + 2 <= scheduled_date <= today + 7`, y en ninguna sección visible si está fuera de ese rango (salvo que sea vencida).

**Validates: Requirements 10.2**

### Property 15: Marcado de tareas vencidas

*For any* tarea con `completed = false` y `scheduled_date < today`, el sistema debe renderizarla con el indicador visual de vencida. Tareas con `scheduled_date >= today` o `completed = true` no deben tener dicho indicador.

**Validates: Requirements 10.10**

### Property 16: Registro de fecha de completado de tarea

*For any* tarea pendiente, al marcarla como completada la propiedad `completed_date` debe quedar registrada con la fecha actual y `completed` debe ser `true`.

**Validates: Requirements 10.6**

### Property 17: Exactitud de estadísticas calculadas

*For any* conjunto de registros de cosecha del usuario autenticado, las tres métricas calculadas deben ser matemáticamente correctas: (a) el total de ciclos completados es `harvests.length`, (b) el promedio de duración es la media aritmética de las duraciones en días de cada ciclo, y (c) la mayor producción es el máximo de `weight_grams`.

**Validates: Requirements 11.2, 11.4, 11.5**

### Property 18: Aislamiento de estadísticas por usuario

*For any* sesión autenticada, todas las estadísticas mostradas deben calcularse exclusivamente con registros donde `user === currentUser.id`. Registros de otros usuarios no deben influir en ninguna métrica.

**Validates: Requirements 11.7**

### Property 19: Propagación de cambios de genética a todas las plantas del usuario

*For any* genética en `genetics_db` compartida por N plantas del usuario, al actualizar cualquier campo de esa genética, los N detalles de plantas deben reflejar los nuevos valores sin requerir acción adicional del usuario.

**Validates: Requirements 12.7**

---

## Error Handling

### Errores de red / PocketBase no disponible

- Todos los métodos de `api.js` lanzan errores tipados (`PBError`) con `status` y `message`.
- La capa de vista (`views/*.js`) captura estos errores y muestra un toast no bloqueante.
- La aplicación sigue siendo navegable en modo degradado (datos ya cargados en memoria).

### Errores del Cloudflare Worker / Groq no disponible

- `ai.js` retorna `null` en cualquier fallo (timeout, 4xx, 5xx, JSON inválido).
- Cada vista verifica `result !== null` antes de aplicar datos de IA.
- Se muestra un banner amarillo informativo: *"IA no disponible. Usá los valores manuales."*
- El timeout de 15 s se implementa con `AbortController`:

```js
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);
try {
  const res = await fetch(url, { signal: controller.signal, ...opts });
  return await res.json();
} catch (e) {
  if (e.name === 'AbortError') showToast('Tiempo de espera agotado para la IA');
  return null;
} finally {
  clearTimeout(timeoutId);
}
```

### Validación de archivos de foto

- Validación **en cliente** antes de iniciar cualquier fetch.
- Errores mostrados inline debajo del drop zone.
- Formatos aceptados verificados por `file.type` y extensión (doble check).

### Respuesta de IA con formato inesperado (Req 12.8)

- El Worker intenta `JSON.parse` de la respuesta del LLM.
- Si falla el parse o faltan campos esperados, el Worker retorna los campos disponibles con `null` para los ausentes.
- El Frontend normaliza: `field ?? 'No disponible'`.
- El error queda registrado en `console.error` (logs de Cloudflare Worker).

### URL dinámica de PocketBase (trycloudflare.com)

- `config.js` es el único punto de configuración; se actualiza manualmente cuando cambia el tunnel.
- Para minimizar interrupciones: se recomienda configurar un subdominio fijo en Cloudflare Tunnel en lugar de usar la URL temporal.

---

## Testing Strategy

Este feature combina lógica pura de cálculo de fechas/estadísticas (altamente testeable con PBT) con operaciones de UI e integración con servicios externos (PocketBase, Groq). Se aplica una estrategia dual.

### Property-Based Testing (PBT)

Librería: **fast-check** (JavaScript, compatible con vanilla JS y Node.js).

Configuración: mínimo 100 iteraciones por propiedad (`numRuns: 100`).

Las pruebas de propiedades se implementan en `tests/properties/` y cubren las 19 propiedades del apartado anterior. Cada test se etiqueta con un comentario:

```js
// Feature: hemp-plant-tracker, Property 1: round-trip cálculo de etapas
```

Las funciones bajo test en `stage-calc.js`, `services/ai.js` y helpers de estadísticas son **funciones puras** (o fácilmente mockeable), lo que las hace ideales para PBT.

**Ejemplo de test para Property 1:**

```js
import fc from 'fast-check';
import { calcStages } from '../../services/stage-calc.js';

// Feature: hemp-plant-tracker, Property 1: round-trip cálculo de etapas
test('stage start dates equal start_date + cumulative prior durations', () => {
  fc.assert(
    fc.property(
      fc.record({
        start_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') })
          .map(d => d.toISOString().slice(0, 10)),
        dur_germination: fc.integer({ min: 1, max: 30 }),
        dur_vegetative:  fc.integer({ min: 1, max: 120 }),
        dur_flowering:   fc.integer({ min: 1, max: 120 }),
        dur_drying:      fc.integer({ min: 1, max: 30 }),
        type: fc.constantFrom('autoflowering', 'photoperiod')
      }),
      (plant) => {
        const s = calcStages(plant);
        const start = new Date(plant.start_date);
        const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

        expect(s.vegStart.getTime()).toBe(addDays(start, s.dur.germination).getTime());
        expect(s.florStart.getTime()).toBe(addDays(start, s.dur.germination + s.dur.vegetative).getTime());
        expect(s.dryStart.getTime()).toBe(addDays(start, s.dur.germination + s.dur.vegetative + s.dur.flowering).getTime());
        expect(s.harvestDate.getTime()).toBe(addDays(start, s.dur.germination + s.dur.vegetative + s.dur.flowering + s.dur.drying).getTime());
      }
    ),
    { numRuns: 100 }
  );
});
```

**Ejemplo de test para Property 2 (formatDate):**

```js
// Feature: hemp-plant-tracker, Property 2: formato de fecha DD/MM/AAAA
test('formatDate always produces DD/MM/AAAA pattern', () => {
  fc.assert(
    fc.property(
      fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') }),
      (date) => {
        const result = formatDate(date);
        expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Tests de ejemplo (unit tests)

Tests de `tests/examples/` cubren comportamientos específicos no universales:

- Login correcto muestra la app; login incorrecto muestra error.
- Formulario vacío muestra errores por campo.
- Estado vacío (0 plantas) muestra empty state.
- Planta en estado de cosecha muestra alerta de urgencia.
- Los 6 tipos de actividad predefinidos están presentes en el selector.
- Sección de estadísticas muestra "Sin datos" cuando no hay cosechas.

### Tests de integración

Tests de `tests/integration/` con mocks de PocketBase y del Worker:

- Guardar foto → el record de PocketBase contiene `plant`, `capture_date` y `image`.
- Worker rechaza solicitudes sin token (status 401).
- Worker no expone `GROQ_API_KEY` en el body de respuesta.
- AI call a PocketBase falla → la app continúa sin datos de IA.
- Genética no encontrada en BD → se hace call al Worker → resultado almacenado en `genetics_db`.

### Tests de smoke

Verificación manual o automatizada con Playwright (opcional):

- Página carga sin errores de consola.
- Responsive: layout correcto a 375px y 1280px.
- Colores y ausencia de barra de navegación.
- 30 genéticas pre-cargadas accesibles desde la ficha técnica.

### Cobertura objetivo

| Capa | Estrategia | Objetivo |
|------|-----------|---------|
| `stage-calc.js` | PBT (Properties 1, 2, 3) | 100% funciones |
| `services/ai.js` | PBT (Prop 9) + integración | Token validation |
| Estadísticas (`stats.js`) | PBT (Prop 17, 18) | 100% funciones cálculo |
| CRUD vistas | Ejemplo + integración | Happy path + errores comunes |
| Worker (`worker/index.js`) | Integración + smoke | Auth, key no expuesta, timeout |
