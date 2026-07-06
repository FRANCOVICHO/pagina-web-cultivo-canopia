# Requirements Document

## Introduction

Hemp Plant Tracker es una página web derivada del sitio Canopia (Grow & Smoke Shop) que permite a los cultivadores registrar y hacer seguimiento del ciclo de vida de sus plantas de cáñamo. La aplicación calcula y muestra automáticamente las fechas estimadas de cada etapa del cultivo (germinación, vegetativo, floración, secado y punto óptimo de cosecha) a partir de los datos ingresados por el usuario. Además, incorpora un diario fotográfico por planta, registro de actividades con línea de tiempo, sugerencias de tareas automáticas, estadísticas personales del cultivador, fichas técnicas de genéticas enriquecidas con inteligencia artificial y un asistente IA basado en la API de Groq para apoyar la toma de decisiones. La estética sigue el lenguaje visual de Canopia: fondo oscuro, tarjetas con bordes sutiles, texto blanco/verde, sin barra de navegación superior.

---

## Glossary

- **Tracker**: La aplicación web Hemp Plant Tracker.
- **Planta**: Una planta de cáñamo registrada por el usuario en el Tracker.
- **Ciclo de cultivo**: La secuencia de etapas que atraviesa una Planta desde la siembra hasta la cosecha.
- **Etapa**: Fase concreta del Ciclo de cultivo: Germinación, Vegetativo, Floración, Secado.
- **Fecha de inicio**: La fecha en que el usuario inició el cultivo (siembra o germinación).
- **Genética**: La variedad o strain de cáñamo registrada para una Planta.
- **Tipo de floración**: Clasificación que indica si la Planta es de floración automática (autoflowering) o fotodependiente (photoperiod).
- **Duración estimada**: El número de días esperado para cada Etapa, derivado del Tipo de floración y la Genética.
- **Punto óptimo de cosecha**: La fecha calculada en que la Planta alcanza la madurez ideal para su cosecha.
- **Estado de la Planta**: Indicador de en qué Etapa se encuentra actualmente una Planta según la fecha actual.
- **Tarjeta de Planta**: Elemento visual que resume los datos y el progreso de una Planta concreta.
- **Formulario de registro**: Interfaz para ingresar los datos de una nueva Planta.
- **Diario fotográfico**: Colección de fotos ordenadas cronológicamente asociadas a una Planta.
- **Foto**: Imagen individual del Diario fotográfico con fecha de captura y, opcionalmente, notas.
- **Asistente_IA**: Módulo del Tracker que consulta la API de Groq (modelo llama-3.3-70b-versatile) a través de un Cloudflare Worker para generar sugerencias, calcular fechas estimadas y obtener información de Genéticas.
- **Cloudflare_Worker**: Función serverless de Cloudflare que actúa como proxy entre el Frontend y la API de Groq, custodiando la API key sin exponerla al navegador.
- **Ficha técnica**: Conjunto de datos descriptivos de una Genética: THC%, CBD%, banco de semillas, dominancia, altura estimada y notas.
- **Actividad**: Acción de cuidado registrada para una Planta en una fecha concreta (ej. riego, fertilización, poda).
- **Tipo de actividad**: Categoría de una Actividad, ya sea predefinida (Regar, Fertilizar, Poda, LST, Defoliación, Trasplante) o personalizada por el usuario.
- **Línea de tiempo**: Visualización cronológica de las Actividades registradas para una Planta.
- **Tarea**: Acción planificada a futuro asociada a una Planta con fecha programada y estado (pendiente/completada).
- **Estadísticas del cultivador**: Métricas personales del usuario calculadas a partir del historial de Ciclos de cultivo completados.
- **PocketBase**: Sistema de backend self-hosted utilizado para persistir todos los datos de la aplicación.
- **Usuario**: Persona con acceso autenticado al Tracker (menos de 20 usuarios en total).

---

## Requirements

### Requisito 1: Registro de plantas

**User Story:** Como cultivador, quiero registrar una planta de cáñamo con sus datos iniciales, para poder hacer seguimiento de su ciclo de vida.

#### Criterios de aceptación

1. THE Tracker SHALL proveer un Formulario de registro accesible desde la página principal.
2. WHEN el usuario completa el Formulario de registro con nombre, Genética, Tipo de floración y Fecha de inicio, THE Tracker SHALL persistir la Planta en el almacenamiento local del navegador.
3. IF el usuario intenta guardar el Formulario de registro con campos obligatorios vacíos, THEN THE Tracker SHALL mostrar un mensaje de error descriptivo junto al campo faltante sin descartar los datos ya ingresados.
4. WHEN la Planta es guardada exitosamente, THE Tracker SHALL mostrar la Tarjeta de Planta correspondiente en la vista principal.
5. THE Tracker SHALL soportar el registro de un mínimo de 50 Plantas simultáneas sin degradación de la interfaz.

---

### Requisito 2: Cálculo de fechas estimadas por etapa

**User Story:** Como cultivador, quiero ver las fechas estimadas de cada etapa de cultivo, para planificar mis actividades de cuidado y cosecha.

#### Criterios de aceptación

1. WHEN una Planta es registrada con Tipo de floración automática, THE Tracker SHALL calcular las duraciones estimadas usando los rangos estándar: Germinación 3–7 días, Vegetativo 20–30 días, Floración 50–70 días, Secado 7–14 días.
2. WHEN una Planta es registrada con Tipo de floración fotodependiente, THE Tracker SHALL calcular las duraciones estimadas usando los rangos estándar: Germinación 3–7 días, Vegetativo 28–56 días, Floración 56–70 días, Secado 7–14 días.
3. WHEN el cálculo de fechas es ejecutado, THE Tracker SHALL derivar la fecha de inicio de cada Etapa sumando la duración acumulada de las Etapas previas a la Fecha de inicio de la Planta.
4. THE Tracker SHALL mostrar en la Tarjeta de Planta la fecha de inicio estimada de cada Etapa en formato DD/MM/AAAA.
5. THE Tracker SHALL mostrar el Punto óptimo de cosecha calculado como la fecha de inicio del Secado más la duración máxima del Secado.
6. WHERE el usuario ingresa duraciones personalizadas para una Planta, THE Tracker SHALL recalcular todas las fechas de Etapa utilizando las duraciones personalizadas en lugar de los valores estándar.

---

### Requisito 3: Visualización del estado actual de la planta

**User Story:** Como cultivador, quiero ver en qué etapa del ciclo se encuentra cada planta hoy, para saber qué cuidados aplicar en este momento.

#### Criterios de aceptación

1. WHEN la vista principal es cargada, THE Tracker SHALL comparar la fecha actual con las fechas estimadas de cada Etapa y determinar el Estado de la Planta.
2. THE Tracker SHALL resaltar visualmente la Etapa activa en la Tarjeta de Planta diferenciándola del resto de Etapas con color de acento verde.
3. WHILE una Planta se encuentra en la Etapa de Floración, THE Tracker SHALL mostrar un contador de días restantes hasta el Punto óptimo de cosecha en la Tarjeta de Planta.
4. WHEN la fecha actual supera el Punto óptimo de cosecha de una Planta, THE Tracker SHALL mostrar una alerta visual en la Tarjeta de Planta indicando que la cosecha está lista o es urgente.
5. THE Tracker SHALL actualizar el Estado de la Planta automáticamente al cargar la página sin requerir acción del usuario.

---

### Requisito 4: Gestión de plantas registradas

**User Story:** Como cultivador, quiero editar y eliminar plantas registradas, para mantener mi lista de cultivos actualizada.

#### Criterios de aceptación

1. WHEN el usuario selecciona la opción de editar en una Tarjeta de Planta, THE Tracker SHALL mostrar el Formulario de registro pre-poblado con los datos actuales de la Planta.
2. WHEN el usuario guarda cambios en el Formulario de registro de una Planta existente, THE Tracker SHALL actualizar los datos persistidos y recalcular todas las fechas de Etapa.
3. WHEN el usuario selecciona la opción de eliminar en una Tarjeta de Planta, THE Tracker SHALL solicitar confirmación antes de eliminar la Planta del almacenamiento local.
4. IF el usuario confirma la eliminación, THEN THE Tracker SHALL remover la Tarjeta de Planta de la vista principal de forma inmediata.
5. IF el usuario cancela la eliminación, THEN THE Tracker SHALL mantener la Planta sin cambios.

---

### Requisito 5: Interfaz visual con estética Canopia

**User Story:** Como usuario del ecosistema Canopia, quiero que la aplicación tenga la misma estética que el sitio principal, para tener una experiencia visual coherente.

#### Criterios de aceptación

1. THE Tracker SHALL utilizar un fondo de color #0d0d0d o equivalente oscuro como color de fondo principal de la página.
2. THE Tracker SHALL renderizar las Tarjetas de Planta con bordes sutiles de baja opacidad y esquinas redondeadas sobre el fondo oscuro.
3. THE Tracker SHALL mostrar textos principales en color blanco (#ffffff o próximo) y elementos de acento en color verde (rango #4caf50–#66bb6a o equivalente de la paleta Canopia).
4. THE Tracker SHALL renderizar la página SIN barra de navegación superior (sin ítems de menú como Grow, En vivo, Catálogo, ni logotipo de navegación).
5. THE Tracker SHALL ser completamente responsive, adaptando el layout de Tarjetas de Planta a una columna en dispositivos móviles (viewport ≤ 768px) y a múltiples columnas en escritorio.
6. WHEN la página es cargada sin Plantas registradas, THE Tracker SHALL mostrar un estado vacío con mensaje descriptivo e invitación a registrar la primera Planta.

---

### Requisito 6: Persistencia local de datos

**User Story:** Como cultivador, quiero que mis plantas registradas se conserven entre sesiones del navegador, para no perder mi seguimiento al cerrar la página.

#### Criterios de aceptación

1. THE Tracker SHALL guardar todos los datos de las Plantas en el localStorage del navegador usando una clave de almacenamiento identificable (por ejemplo `canopia_plants`).
2. WHEN la página es cargada, THE Tracker SHALL leer el localStorage y restaurar todas las Plantas previamente registradas sin requerir autenticación.
3. IF el localStorage no contiene datos previos, THEN THE Tracker SHALL inicializar la aplicación con una lista de Plantas vacía.
4. WHEN los datos de una Planta son modificados o eliminados, THE Tracker SHALL actualizar el estado persistido en localStorage de forma sincrónica con la acción del usuario.
5. IF el localStorage del navegador está lleno o no disponible, THEN THE Tracker SHALL mostrar un aviso al usuario indicando que los datos no pueden ser guardados en este dispositivo.

---

### Requisito 7: Diario fotográfico por planta

**User Story:** Como cultivador, quiero registrar fotos de cada planta a lo largo del tiempo, para visualizar su evolución visual durante el Ciclo de cultivo.

#### Criterios de aceptación

1. WHEN el Usuario abre el detalle de una Planta, THE Tracker SHALL mostrar el Diario fotográfico de esa Planta con las Fotos ordenadas de más reciente a más antigua.
2. THE Tracker SHALL permitir al Usuario agregar una Foto al Diario fotográfico seleccionando una imagen desde el sistema de archivos del dispositivo.
3. WHERE el dispositivo del Usuario dispone de cámara, THE Tracker SHALL ofrecer la opción de capturar una Foto directamente desde la cámara.
4. WHEN el Usuario agrega una Foto, THE Tracker SHALL registrar la fecha de captura (por defecto la fecha actual, editable por el Usuario) y almacenar la imagen en PocketBase.
5. THE Tracker SHALL mostrar las Fotos del Diario fotográfico en una galería con miniatura, fecha de captura y, si existe, la nota asociada.
6. WHEN el Usuario selecciona una Foto de la galería, THE Tracker SHALL mostrarla en vista ampliada con sus metadatos (fecha y nota).
7. WHEN el Usuario solicita eliminar una Foto, THE Tracker SHALL solicitar confirmación antes de borrar la Foto de PocketBase.
8. IF el Usuario confirma la eliminación, THEN THE Tracker SHALL remover la Foto de la galería de forma inmediata.
9. THE Tracker SHALL aceptar imágenes en formatos JPEG, PNG y WebP con un tamaño máximo de 10 MB por Foto.
10. IF el Usuario intenta subir una imagen que supera 10 MB o tiene un formato no soportado, THEN THE Tracker SHALL mostrar un mensaje de error descriptivo sin iniciar la subida.

---

### Requisito 8: Asistente IA para genéticas y sugerencias

**User Story:** Como cultivador, quiero que la aplicación use inteligencia artificial para obtener información técnica sobre la genética de mis plantas y sugerir actividades según la etapa, para tomar mejores decisiones de cultivo.

#### Criterios de aceptación

1. WHEN el Usuario registra o edita una Planta con un nombre de Genética, THE Asistente_IA SHALL consultar la API de Groq (modelo llama-3.3-70b-versatile) a través del Cloudflare_Worker para obtener la Ficha técnica de esa Genética.
2. WHEN el Asistente_IA recibe la respuesta de la API de Groq, THE Tracker SHALL poblar automáticamente los campos disponibles de la Ficha técnica (THC%, CBD%, banco, dominancia, altura estimada y notas) con la información retornada.
3. WHEN el Usuario solicita calcular fechas estimadas para una Planta, THE Asistente_IA SHALL consultar la API de Groq con la Genética y el Tipo de floración para obtener duraciones de Etapa específicas para esa variedad, en lugar de usar únicamente los rangos estándar.
4. WHEN el Asistente_IA retorna duraciones específicas para la Genética, THE Tracker SHALL mostrar estas duraciones como sugerencia diferenciada de los valores estándar, permitiendo al Usuario aceptarlas o mantener los valores previos.
5. WHEN el Usuario está registrando una Actividad para una Planta, THE Asistente_IA SHALL sugerir Tipos de actividad apropiados según la Etapa actual de la Planta.
6. THE Cloudflare_Worker SHALL leer la API key de Groq desde variables de entorno de Cloudflare y nunca exponer la API key en respuestas al Frontend.
7. IF la API de Groq no está disponible o retorna un error, THEN THE Tracker SHALL mostrar un mensaje de aviso no bloqueante y permitir al Usuario continuar usando la aplicación con los valores estándar o datos ingresados manualmente.
8. WHEN el Cloudflare_Worker recibe una solicitud del Frontend, THE Cloudflare_Worker SHALL validar que la solicitud proviene de un Usuario autenticado antes de reenviarla a la API de Groq.
9. THE Asistente_IA SHALL responder a cada consulta en un plazo máximo de 15 segundos; IF el plazo es superado, THEN THE Tracker SHALL cancelar la solicitud y mostrar un mensaje de tiempo de espera agotado.

---

### Requisito 9: Registro de actividades con línea de tiempo

**User Story:** Como cultivador, quiero registrar las actividades de cuidado realizadas en cada planta y verlas en una línea de tiempo, para mantener un historial ordenado de lo que hice en cada momento del cultivo.

#### Criterios de aceptación

1. THE Tracker SHALL proveer los siguientes Tipos de actividad predefinidos: Regar, Fertilizar, Poda, LST, Defoliación, Trasplante.
2. THE Tracker SHALL permitir al Usuario crear Tipos de actividad personalizados con un nombre único por usuario de hasta 50 caracteres.
3. WHEN el Usuario crea una Actividad para una Planta, THE Tracker SHALL requerir el Tipo de actividad y la fecha, y aceptar notas opcionales de hasta 500 caracteres.
4. WHEN una Actividad es guardada, THE Tracker SHALL persistirla en PocketBase asociada a la Planta correspondiente y al Usuario autenticado.
5. WHEN el Usuario abre el detalle de una Planta, THE Tracker SHALL mostrar la Línea de tiempo con todas las Actividades de esa Planta ordenadas cronológicamente de más reciente a más antigua.
6. THE Tracker SHALL mostrar en cada entrada de la Línea de tiempo el Tipo de actividad, la fecha en formato DD/MM/AAAA y las notas si existen.
7. WHEN el Usuario selecciona una Actividad en la Línea de tiempo, THE Tracker SHALL permitir editar el Tipo de actividad, la fecha y las notas.
8. WHEN el Usuario guarda los cambios de una Actividad, THE Tracker SHALL actualizar los datos en PocketBase de forma inmediata.
9. WHEN el Usuario solicita eliminar una Actividad, THE Tracker SHALL solicitar confirmación antes de borrarla de PocketBase.
10. IF el Usuario confirma la eliminación de una Actividad, THEN THE Tracker SHALL remover la entrada de la Línea de tiempo de forma inmediata.
11. WHERE el Asistente_IA está disponible, THE Tracker SHALL mostrar sugerencias de Tipos de actividad relevantes para la Etapa actual de la Planta al momento de crear una nueva Actividad.

---

### Requisito 10: Próximas tareas automáticas y personalizables

**User Story:** Como cultivador, quiero ver y gestionar las tareas de cuidado próximas para cada planta, para no olvidar ninguna acción importante durante el cultivo.

#### Criterios de aceptación

1. WHEN una Planta avanza a una nueva Etapa, THE Tracker SHALL generar automáticamente un conjunto de Tareas sugeridas apropiadas para esa Etapa y asignarles fechas programadas razonables.
2. THE Tracker SHALL mostrar una vista de Tareas organizada en tres secciones: Hoy, Mañana y Esta semana.
3. WHEN el Usuario abre la vista de Tareas, THE Tracker SHALL listar las Tareas pendientes agrupadas por sección temporal, mostrando para cada Tarea la Planta asociada, el Tipo de actividad y la fecha programada.
4. THE Tracker SHALL permitir al Usuario crear Tareas manualmente especificando la Planta asociada, el Tipo de actividad, la fecha programada y un estado inicial pendiente.
5. WHEN el Usuario edita una Tarea, THE Tracker SHALL permitir modificar el Tipo de actividad, la fecha programada y el estado (pendiente/completada).
6. WHEN el Usuario marca una Tarea como completada, THE Tracker SHALL registrar la fecha de completado y mover la Tarea a la sección de Tareas completadas de esa Planta.
7. WHEN el Usuario solicita eliminar una Tarea, THE Tracker SHALL solicitar confirmación antes de borrarla de PocketBase.
8. IF el Usuario confirma la eliminación de una Tarea, THEN THE Tracker SHALL remover la Tarea de la vista de forma inmediata.
9. THE Tracker SHALL persistir todas las Tareas en PocketBase asociadas al Usuario autenticado y a la Planta correspondiente.
10. IF una Tarea programada no fue completada y su fecha programada ya pasó, THEN THE Tracker SHALL mostrarla visualmente destacada como vencida en la vista de Tareas.

---

### Requisito 11: Estadísticas del cultivador

**User Story:** Como cultivador, quiero ver estadísticas de mi historial de cultivos, para entender mis patrones de cultivo y mejorar mis resultados.

#### Criterios de aceptación

1. THE Tracker SHALL calcular y mostrar las Estadísticas del cultivador en una sección dedicada accesible desde la vista principal.
2. THE Tracker SHALL mostrar el número total de Ciclos de cultivo completados por el Usuario.
3. WHEN el Usuario registra la cosecha de una Planta ingresando el peso en gramos, THE Tracker SHALL persistir el dato en PocketBase asociado a ese Ciclo de cultivo.
4. THE Tracker SHALL calcular y mostrar el promedio de duración en días de los Ciclos de cultivo completados por el Usuario.
5. THE Tracker SHALL calcular y mostrar la mayor producción registrada en gramos entre todos los Ciclos de cultivo del Usuario.
6. THE Tracker SHALL calcular y mostrar la Genética más cultivada por el Usuario como la variedad con mayor cantidad de Plantas registradas en el historial.
7. THE Tracker SHALL mostrar las Estadísticas del cultivador exclusivamente con datos del Usuario autenticado, sin mezclar datos entre Usuarios distintos.
8. IF el Usuario no tiene Ciclos de cultivo completados, THEN THE Tracker SHALL mostrar un estado vacío descriptivo en la sección de estadísticas indicando que aún no hay datos disponibles.
9. WHEN el Usuario completa un Ciclo de cultivo, THE Tracker SHALL actualizar las Estadísticas del cultivador de forma inmediata sin requerir recarga de página.

---

### Requisito 12: Ficha técnica de genética

**User Story:** Como cultivador, quiero ver la información técnica de la genética de cada planta, para conocer los parámetros esperados de THC%, CBD%, dominancia y altura antes y durante el cultivo.

#### Criterios de aceptación

1. THE Tracker SHALL mantener en PocketBase una base de datos de Fichas técnicas pre-cargadas con las 30 variedades de cáñamo más comunes, incluyendo los campos: nombre, THC%, CBD%, banco, dominancia (Índica/Sativa/Híbrida), altura estimada en cm y notas.
2. WHEN el Usuario abre el detalle de una Planta, THE Tracker SHALL mostrar la Ficha técnica de la Genética correspondiente si existe en PocketBase.
3. WHEN la Genética de una Planta no existe en la base de datos local, THE Asistente_IA SHALL consultar la API de Groq para obtener la Ficha técnica y almacenar el resultado en PocketBase para consultas futuras.
4. THE Tracker SHALL mostrar en la Ficha técnica los siguientes campos: nombre de la Genética, THC% (rango estimado), CBD% (rango estimado), banco de semillas, dominancia, altura estimada en cm y notas adicionales.
5. WHERE algún campo de la Ficha técnica no esté disponible ni en la base de datos ni en la respuesta del Asistente_IA, THE Tracker SHALL mostrar el campo con el valor "No disponible" en lugar de ocultarlo.
6. THE Tracker SHALL permitir al Usuario editar manualmente cualquier campo de la Ficha técnica de una Genética y persistir los cambios en PocketBase.
7. WHEN el Usuario edita la Ficha técnica de una Genética, THE Tracker SHALL aplicar los cambios a todas las Plantas del Usuario que compartan esa misma Genética.
8. IF la Ficha técnica obtenida del Asistente_IA contiene datos en un formato inesperado, THEN THE Tracker SHALL registrar el error en logs internos y mostrar los campos disponibles sin interrumpir la carga del detalle de la Planta.
