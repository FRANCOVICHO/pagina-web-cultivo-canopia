// services/ai.js
// Módulo de comunicación con el Cloudflare Worker (proxy hacia Groq)
// Se expone como window.AI para uso desde el frontend sin bundler
// Depende de window.WORKER_URL (definido en config.js)

(function () {

  const TIMEOUT_MS = 15000;

  function showToast(msg) {
    // Usa la función global showToast si existe, sino console.warn
    if (typeof window.showToast === 'function') {
      window.showToast(msg, 'warning');
    } else {
      console.warn('[AI]', msg);
    }
  }

  async function callWorker(token, payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${WORKER_URL}/api/ai`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': token,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[AI] Worker error:', err.error || res.status);
        return null;
      }

      return await res.json();
    } catch (e) {
      if (e.name === 'AbortError') {
        showToast('Tiempo de espera agotado para la IA');
      } else {
        console.error('[AI] Fetch error:', e.message);
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const AI = {
    /**
     * Obtiene la ficha técnica de una genética via IA.
     * @param {string} token  PocketBase auth token
     * @param {string} geneticsName  Nombre del strain
     * @returns {Promise<{thc_pct,cbd_pct,bank,dominance,height_cm,notes}|null>}
     */
    async getGeneticsInfo(token, geneticsName) {
      return callWorker(token, { type: 'genetics_info', genetics: geneticsName });
    },

    /**
     * Obtiene duraciones de etapa sugeridas para una genética.
     * @param {string} token
     * @param {string} geneticsName
     * @param {string} floweringType  'autoflowering' | 'photoperiod'
     * @returns {Promise<{germination,vegetative,flowering,drying}|null>}
     */
    async getStageDurations(token, geneticsName, floweringType) {
      return callWorker(token, {
        type: 'stage_durations',
        genetics: geneticsName,
        flowering_type: floweringType,
      });
    },

    /**
     * Obtiene sugerencias de actividades para la etapa actual.
     * @param {string} token
     * @param {string} plantStage  Nombre de la etapa (ej: 'Floración')
     * @returns {Promise<string[]|null>}
     */
    async getActivitySuggestions(token, plantStage) {
      return callWorker(token, { type: 'activity_suggestions', stage: plantStage });
    },
  };

  window.AI = AI;

})();
