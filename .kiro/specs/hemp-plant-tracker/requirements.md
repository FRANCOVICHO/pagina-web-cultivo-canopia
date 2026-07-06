# Documento de Requisitos

## Introducción

Hemp Plant Tracker es una página web derivada del sitio Canopia (Grow & Smoke Shop) que permite a los cultivadores registrar y hacer seguimiento del ciclo de vida de sus plantas de cáñamo. La aplicación calcula y muestra automáticamente las fechas estimadas de cada etapa del cultivo (germinación, vegetativo, floración, secado y punto óptimo de cosecha) a partir de los datos ingresados por el usuario. La estética sigue el lenguaje visual de Canopia: fondo oscuro, tarjetas con bordes sutiles, texto blanco/verde, sin barra de navegación superior.

---

## Glosario

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

---

## Requisitos

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
