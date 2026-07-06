// services/api.js
// Módulo centralizado de llamadas a PocketBase
// Se expone como window.API para uso desde app.js sin bundler
// Depende de window.POCKETBASE_URL (definido en config.js)

(function () {

  async function request(url, options = {}) {
    const res = await fetch(url, options);
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Error HTTP ${res.status}`);
    return data;
  }

  function authHeaders(token) {
    return { 'Authorization': token };
  }

  function jsonHeaders(token) {
    return { 'Content-Type': 'application/json', 'Authorization': token };
  }

  const API = {

    // ===== AUTH =====
    async login(email, password) {
      return request(`${POCKETBASE_URL}/api/collections/users/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password })
      });
    },

    // ===== PLANTAS =====
    async getPlants(token, userId) {
      return request(
        `${POCKETBASE_URL}/api/collections/plants/records?filter=(user="${userId}")&sort=-created`,
        { headers: authHeaders(token) }
      );
    },

    async createPlant(token, formData) {
      return request(`${POCKETBASE_URL}/api/collections/plants/records`, {
        method: 'POST',
        headers: authHeaders(token),
        body: formData
      });
    },

    async updatePlant(token, id, formData) {
      return request(`${POCKETBASE_URL}/api/collections/plants/records/${id}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: formData
      });
    },

    async deletePlant(token, id) {
      return request(`${POCKETBASE_URL}/api/collections/plants/records/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token)
      });
    },

    // ===== FOTOS =====
    async getPhotos(token, plantId) {
      return request(
        `${POCKETBASE_URL}/api/collections/photos/records?filter=(plant="${plantId}")&sort=-capture_date`,
        { headers: authHeaders(token) }
      );
    },

    async createPhoto(token, formData) {
      return request(`${POCKETBASE_URL}/api/collections/photos/records`, {
        method: 'POST',
        headers: authHeaders(token),
        body: formData
      });
    },

    async deletePhoto(token, id) {
      return request(`${POCKETBASE_URL}/api/collections/photos/records/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token)
      });
    },

    // ===== ACTIVIDADES =====
    async getActivities(token, plantId) {
      return request(
        `${POCKETBASE_URL}/api/collections/activities/records?filter=(plant="${plantId}")&sort=-activity_date`,
        { headers: authHeaders(token) }
      );
    },

    async createActivity(token, data) {
      return request(`${POCKETBASE_URL}/api/collections/activities/records`, {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify(data)
      });
    },

    async updateActivity(token, id, data) {
      return request(`${POCKETBASE_URL}/api/collections/activities/records/${id}`, {
        method: 'PATCH',
        headers: jsonHeaders(token),
        body: JSON.stringify(data)
      });
    },

    async deleteActivity(token, id) {
      return request(`${POCKETBASE_URL}/api/collections/activities/records/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token)
      });
    },

    // ===== TIPOS PERSONALIZADOS =====
    async getCustomTypes(token, userId) {
      return request(
        `${POCKETBASE_URL}/api/collections/custom_activity_types/records?filter=(user="${userId}")`,
        { headers: authHeaders(token) }
      );
    },

    async createCustomType(token, data) {
      return request(`${POCKETBASE_URL}/api/collections/custom_activity_types/records`, {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify(data)
      });
    },

    async deleteCustomType(token, id) {
      return request(`${POCKETBASE_URL}/api/collections/custom_activity_types/records/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token)
      });
    },

    // ===== TAREAS =====
    async getTasks(token, userId) {
      return request(
        `${POCKETBASE_URL}/api/collections/tasks/records?filter=(user="${userId}")&sort=scheduled_date`,
        { headers: authHeaders(token) }
      );
    },

    async createTask(token, data) {
      return request(`${POCKETBASE_URL}/api/collections/tasks/records`, {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify(data)
      });
    },

    async updateTask(token, id, data) {
      return request(`${POCKETBASE_URL}/api/collections/tasks/records/${id}`, {
        method: 'PATCH',
        headers: jsonHeaders(token),
        body: JSON.stringify(data)
      });
    },

    async deleteTask(token, id) {
      return request(`${POCKETBASE_URL}/api/collections/tasks/records/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token)
      });
    },

    // ===== GENÉTICAS =====
    async getGenetics(token, name) {
      const encoded = encodeURIComponent(name);
      return request(
        `${POCKETBASE_URL}/api/collections/genetics_db/records?filter=(name~"${encoded}")`,
        { headers: authHeaders(token) }
      );
    },

    async createGenetics(token, data) {
      return request(`${POCKETBASE_URL}/api/collections/genetics_db/records`, {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify(data)
      });
    },

    async updateGenetics(token, id, data) {
      return request(`${POCKETBASE_URL}/api/collections/genetics_db/records/${id}`, {
        method: 'PATCH',
        headers: jsonHeaders(token),
        body: JSON.stringify(data)
      });
    },

    // ===== COSECHAS =====
    async createHarvest(token, data) {
      return request(`${POCKETBASE_URL}/api/collections/harvests/records`, {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify(data)
      });
    },

    async getHarvests(token, userId) {
      return request(
        `${POCKETBASE_URL}/api/collections/harvests/records?filter=(user="${userId}")`,
        { headers: authHeaders(token) }
      );
    }
  };

  window.API = API;

})();
