/**
 * Shared data layer for Smart City Waste Management
 * Uses localStorage - users, reports flow: pending → approved → collected
 */
(function() {
  var STORAGE_KEY = 'wasteReports';
  var USERS_KEY = 'wasteUsers';

  function getUsers() {
    try {
      var data = localStorage.getItem(USERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function seedUsers() {
    if (getUsers().length === 0) {
      var defaultUsers = [
        { username: 'admin', password: 'admin123', role: 'admin' },
        { username: 'collector', password: 'collector123', role: 'collector' }
      ];
      localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
    }
  }

  seedUsers();

  window.WasteData = {
    getAll: function() {
      try {
        var data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
      } catch (e) {
        return [];
      }
    },
    save: function(reports) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    },
    addReport: function(report) {
      var reports = this.getAll();
      report.id = 'r' + Date.now();
      report.status = 'pending';
      report.createdAt = new Date().toISOString();
      report.approvedAt = null;
      report.collectedAt = null;
      reports.unshift(report);
      this.save(reports);
      return report.id;
    },
    getPending: function() {
      return this.getAll().filter(function(r) { return r.status === 'pending'; });
    },
    getApproved: function() {
      return this.getAll().filter(function(r) { return r.status === 'approved'; });
    },
    getCollected: function() {
      return this.getAll().filter(function(r) { return r.status === 'collected'; });
    },
    getReport: function(id) {
      return this.getAll().find(function(r) { return r.id === id; }) || null;
    },
    approve: function(id) {
      var reports = this.getAll();
      var found = reports.find(function(r) { return r.id === id && r.status === 'pending'; });
      if (found) {
        found.status = 'approved';
        found.approvedAt = new Date().toISOString();
        this.save(reports);
        return true;
      }
      return false;
    },
    reject: function(id) {
      var reports = this.getAll();
      var idx = reports.findIndex(function(r) { return r.id === id && r.status === 'pending'; });
      if (idx !== -1) {
        reports.splice(idx, 1);
        this.save(reports);
        return true;
      }
      return false;
    },
    markCollected: function(id) {
      var reports = this.getAll();
      var found = reports.find(function(r) { return r.id === id && r.status === 'approved'; });
      if (found) {
        found.status = 'collected';
        found.collectedAt = new Date().toISOString();
        this.save(reports);
        return true;
      }
      return false;
    },
    authenticate: function(username, password) {
      var users = getUsers();
      var user = users.find(function(u) {
        return u.username.toLowerCase() === username.toLowerCase() && u.password === password;
      });
      return user ? { username: user.username, role: user.role } : null;
    },
    registerUser: function(username, password, role) {
      var users = getUsers();
      if (users.some(function(u) { return u.username.toLowerCase() === username.toLowerCase(); })) {
        return false;
      }
      users.push({ username: username, password: password, role: role });
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return true;
    },
    getCollectors: function() {
      return getUsers().filter(function(u) { return u.role === 'collector'; }).map(function(u) {
        return { username: u.username };
      });
    },
    getCollectionLocations: function() {
      var collected = this.getCollected();
      var byLocation = {};
      collected.forEach(function(r) {
        var loc = (r.location || 'Unknown').trim() || 'Unknown';
        byLocation[loc] = (byLocation[loc] || 0) + 1;
      });
      return Object.keys(byLocation).map(function(loc) {
        return { location: loc, count: byLocation[loc] };
      }).sort(function(a, b) { return b.count - a.count; });
    },
    // Session management
    setSession: function(user) {
      sessionStorage.setItem('wasteUser', JSON.stringify({
        username: user.username,
        role: user.role,
        loggedInAt: new Date().toISOString()
      }));
    },
    getSession: function() {
      try {
        var data = sessionStorage.getItem('wasteUser');
        return data ? JSON.parse(data) : null;
      } catch (e) {
        return null;
      }
    },
    clearSession: function() {
      sessionStorage.removeItem('wasteUser');
    },
    isAuthenticated: function() {
      return this.getSession() !== null;
    },
    requireAuth: function(requiredRole) {
      var session = this.getSession();
      if (!session) {
        return false;
      }
      if (requiredRole && session.role !== requiredRole) {
        return false;
      }
      return true;
    }
  };
})();
