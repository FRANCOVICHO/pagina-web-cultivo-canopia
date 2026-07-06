// services/stage-calc.js
// Módulo de cálculo de etapas del ciclo de cultivo
// Se expone como window.StageCalc para uso desde app.js sin bundler

(function () {

  const DEFAULT_DURATIONS = {
    autoflowering: { germination: 5, vegetative: 25, flowering: 60, drying: 10 },
    photoperiod:   { germination: 5, vegetative: 42, flowering: 63, drying: 10 }
  };

  const STAGE_IMAGES = {
    Germinación: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=80',
    Vegetativo:  'https://images.unsplash.com/photo-1535185384036-28bbc8035f28?w=400&q=80',
    Floración:   'https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=400&q=80',
    Secado:      'https://images.unsplash.com/photo-1585059895524-72359e06133a?w=400&q=80',
    Cosecha:     'https://images.unsplash.com/photo-1574482620826-f9cb4b8e4ca5?w=400&q=80'
  };

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function calcStages(plant) {
    const type = plant.type || 'autoflowering';
    const defaults = DEFAULT_DURATIONS[type];
    const dur = {
      germination: parseInt(plant.dur_germination) || defaults.germination,
      vegetative:  parseInt(plant.dur_vegetative)  || defaults.vegetative,
      flowering:   parseInt(plant.dur_flowering)   || defaults.flowering,
      drying:      parseInt(plant.dur_drying)      || defaults.drying
    };

    const start = new Date(plant.start_date);
    start.setHours(0, 0, 0, 0);

    const germStart   = start;
    const vegStart    = addDays(germStart, dur.germination);
    const florStart   = addDays(vegStart,  dur.vegetative);
    const dryStart    = addDays(florStart, dur.flowering);
    const harvestDate = addDays(dryStart,  dur.drying);

    return { dur, germStart, vegStart, florStart, dryStart, harvestDate };
  }

  function getCurrentStage(stages) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (now < stages.vegStart)    return 'Germinación';
    if (now < stages.florStart)   return 'Vegetativo';
    if (now < stages.dryStart)    return 'Floración';
    if (now < stages.harvestDate) return 'Secado';
    return 'Cosecha';
  }

  function stageProgress(stages, stageName) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const map = {
      'Germinación': { start: stages.germStart,  end: stages.vegStart,    total: stages.dur.germination },
      'Vegetativo':  { start: stages.vegStart,   end: stages.florStart,   total: stages.dur.vegetative  },
      'Floración':   { start: stages.florStart,  end: stages.dryStart,    total: stages.dur.flowering   },
      'Secado':      { start: stages.dryStart,   end: stages.harvestDate, total: stages.dur.drying      }
    };
    const s = map[stageName];
    if (!s) return { pct: 100, dayIn: 0, total: 0 };
    const elapsed = Math.max(0, Math.floor((now - s.start) / 86400000));
    const pct = Math.min(100, Math.round((elapsed / s.total) * 100));
    return { pct, dayIn: elapsed + 1, total: s.total };
  }

  function formatDate(date) {
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function daysUntil(date) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.ceil((date - now) / 86400000);
  }

  function generateAutoTasks(plant, stages) {
    const toISO = d => d.toISOString().slice(0, 10);
    const tasksByStage = {
      'Germinación': [
        { activity_type: 'Verificar humedad de germinación', offset: 1 }
      ],
      'Vegetativo': [
        { activity_type: 'Primer riego',       offset: 1 },
        { activity_type: 'Primer fertilizado', offset: 7 }
      ],
      'Floración': [
        { activity_type: 'Cambio de nutrientes a floración', offset: 1 },
        { activity_type: 'Control de tricomas',              offset: 21 }
      ],
      'Secado': [
        { activity_type: 'Colgar y verificar humedad', offset: 1 }
      ]
    };

    const stage = getCurrentStage(stages);
    const stageStartMap = {
      'Germinación': stages.germStart,
      'Vegetativo':  stages.vegStart,
      'Floración':   stages.florStart,
      'Secado':      stages.dryStart
    };

    const stageStart = stageStartMap[stage];
    if (!stageStart || !tasksByStage[stage]) return [];

    return tasksByStage[stage].map(t => ({
      activity_type:  t.activity_type,
      scheduled_date: toISO(addDays(stageStart, t.offset)),
      completed:      false,
      auto_generated: true
    }));
  }

  window.StageCalc = {
    DEFAULT_DURATIONS,
    STAGE_IMAGES,
    calcStages,
    getCurrentStage,
    stageProgress,
    formatDate,
    daysUntil,
    generateAutoTasks
  };

})();
