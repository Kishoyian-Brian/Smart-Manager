/**
 * API-backed data layer for Smart City Waste Management
 * Replaces localStorage with real backend. Requires js/config.js
 * All data methods return Promises.
 */
(function() {
  'use strict';

  var API_BASE = (window.API_BASE || '').replace(/\/$/, '');
  var SESSION_KEY = 'wasteUser';

  function getSession() {
    try {
      var data = sessionStorage.getItem(SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function getAuthHeaders() {
    var session = getSession();
    if (!session || !session.token) return {};
    return { 'Authorization': 'Bearer ' + session.token };
  }

  function handleResponse(res) {
    if (res.status === 401) {
      sessionStorage.removeItem(SESSION_KEY);
      var loginPath = /\/admin\/|\/collector\//.test(window.location.pathname) ? '../login.html' : 'login.html';
      window.location.href = loginPath;
      return Promise.reject(new Error('Session expired'));
    }
    if (!res.ok) {
      return res.json().then(function(err) {
        throw new Error(err.message || 'Request failed');
      }).catch(function() {
        throw new Error('Request failed: ' + res.status);
      });
    }
    if (res.status === 204) return Promise.resolve(null);
    return res.json();
  }

  function apiFetch(path, options) {
    options = options || {};
    options.headers = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders(), options.headers || {});
    return fetch(API_BASE + path, options).then(handleResponse);
  }

  window.WasteData = {
    getAll: function() {
      return apiFetch('/reports').then(function(list) { return list || []; });
    },
    addReport: function(report) {
      var body = {
        name: report.name,
        location: report.location,
        wasteType: report.wasteType ? String(report.wasteType) : undefined,
        fillLevel: report.fillLevel != null ? String(report.fillLevel) : undefined,
        lat: report.lat,
        lng: report.lng
      };
      return apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify(body)
      }).then(function(r) { return r.id; });
    },
    getPending: function() {
      return apiFetch('/reports?status=pending').then(function(list) { return list || []; });
    },
    getApproved: function() {
      return apiFetch('/reports?status=approved').then(function(list) { return list || []; });
    },
    getCollected: function() {
      return apiFetch('/reports?status=collected').then(function(list) { return list || []; });
    },
    getReport: function(id) {
      return apiFetch('/reports/' + encodeURIComponent(id)).catch(function() { return null; });
    },
    approve: function(id) {
      return apiFetch('/reports/' + encodeURIComponent(id) + '/approve', { method: 'PATCH' })
        .then(function() { return true; })
        .catch(function() { return false; });
    },
    reject: function(id) {
      return apiFetch('/reports/' + encodeURIComponent(id) + '/reject', { method: 'PATCH' })
        .then(function() { return true; })
        .catch(function() { return false; });
    },
    markCollected: function(id) {
      return apiFetch('/reports/' + encodeURIComponent(id) + '/collect', { method: 'PATCH' })
        .then(function() { return true; })
        .catch(function() { return false; });
    },
    authenticate: function(username, password) {
      return apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username, password: password })
      }).then(function(res) {
        if (!res) return null;
        return {
          username: res.user.username,
          role: res.user.role,
          token: res.token,
          baseLat: res.user.baseLat,
          baseLng: res.user.baseLng,
          baseAddress: res.user.baseAddress
        };
      });
    },
    registerUser: function(username, password, role) {
      return apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ username: username, password: password, role: role })
      }).then(function() { return true; })
        .catch(function() { return false; });
    },
    removeUser: function(username) {
      return apiFetch('/users/' + encodeURIComponent(username), { method: 'DELETE' })
        .then(function() { return true; })
        .catch(function() { return false; });
    },
    getCollectors: function() {
      return apiFetch('/users/collectors').then(function(list) {
        return (list || []).map(function(u) { return { username: u.username }; });
      });
    },
    getCollectionLocations: function() {
      return apiFetch('/reports/analytics/locations').then(function(list) { return list || []; });
    },
    setSession: function(user, token) {
      var session = typeof user === 'object' ? { username: user.username, role: user.role } : user;
      if (token) session.token = token;
      if (user && user.token) session.token = user.token;
      if (user && (user.baseLat != null || user.baseAddress)) {
        session.baseLat = user.baseLat;
        session.baseLng = user.baseLng;
        session.baseAddress = user.baseAddress;
      }
      session.loggedInAt = new Date().toISOString();
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    },
    getSession: getSession,
    clearSession: function() {
      sessionStorage.removeItem(SESSION_KEY);
    },
    isAuthenticated: function() {
      return getSession() !== null;
    },
    requireAuth: function(requiredRole) {
      var session = getSession();
      if (!session) return false;
      if (requiredRole && session.role !== requiredRole) return false;
      return true;
    }
  };
})();
