/**
 * Admin dashboard — Rictei Smart Waste
 * Side nav, panels, pending reports, heat map, add drive, collectors.
 * Depends: ../js/api.js (WasteData)
 */
(function() {
  'use strict';

  function showPanel(panelId) {
    document.querySelectorAll('.admin-panel').forEach(function(p) { p.classList.remove('active'); });
    document.querySelectorAll('.sidebar-link').forEach(function(a) { a.classList.remove('active'); });
    var panel = document.getElementById('panel-' + panelId);
    var link = document.querySelector('.sidebar-link[data-panel="' + panelId + '"]');
    if (panel) panel.classList.add('active');
    if (link) link.classList.add('active');
    // Re-render specific panels when shown
    if (panelId === 'heatmap') {
      setTimeout(function() {
        renderHeatMap().catch(function() {});
        // Invalidate map size to ensure it renders correctly
        if (heatMapInstance) {
          setTimeout(function() {
            heatMapInstance.invalidateSize();
          }, 200);
        }
      }, 100);
    } else if (panelId === 'dashboard') {
      renderDashboard().catch(function() {});
    }
  }

  document.querySelectorAll('.sidebar-link').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      showPanel(a.dataset.panel);
    });
  });

  // Quick action buttons - navigate to panels
  document.querySelectorAll('.quick-action-btn, .stat-link').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (btn.dataset.panel) {
        showPanel(btn.dataset.panel);
      }
    });
  });

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  var heatMapInstance = null;
  var heatLayer = null;

  async function renderHeatMap() {
    var locations = await WasteData.getCollectionLocations();
    var mapContainer = document.getElementById('heatmap-map');
    var heatmapPanel = document.getElementById('panel-heatmap');
    var empty = document.getElementById('heatmap-empty');
    var planContent = document.getElementById('management-plan-content');
    
    // Check if heatmap panel is visible before initializing map
    if (!mapContainer || !heatmapPanel) return;
    
    var isPanelVisible = heatmapPanel.classList.contains('active');
    
    // Always show the map container
    mapContainer.style.display = 'block';
    
    // Show/hide empty message based on data
    if (locations.length === 0) {
      if (empty) empty.style.display = 'block';
      if (planContent) planContent.innerHTML = '<div class="plan-card"><p class="empty-state">No report data available for analysis. The map will show heat zones as reports are submitted.</p></div>';
    } else {
      if (empty) empty.style.display = 'none';
    }

    // Initialize or clear map
    if (heatMapInstance) {
      heatMapInstance.remove();
      heatMapInstance = null;
    }
    
    if (!mapContainer) return;
    
    // Default center: Chuka Technical and Vocational College
    var countyCenter = [-0.3345, 37.6478];
    var countyBounds = [
      [-0.5, 37.5], // Southwest
      [-0.1, 38.1]   // Northeast
    ];
    
    // Only initialize map if panel is visible, or initialize and invalidate later
    if (!isPanelVisible && heatMapInstance) {
      // Panel is hidden, don't reinitialize, just return
      return;
    }
    
    // Always create map centered on Tharaka Nithi County
    if (!heatMapInstance) {
      heatMapInstance = L.map('heatmap-map').setView(countyCenter, 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(heatMapInstance);

      // Add county boundary rectangle (visual reference)
      L.rectangle(countyBounds, {
        color: '#0d5c3d',
        weight: 2,
        fillColor: 'transparent',
        fillOpacity: 0,
        dashArray: '5, 5'
      }).addTo(heatMapInstance).bindPopup('<strong>Tharaka Nithi County</strong>');
      
      // Fit map to county bounds initially
      heatMapInstance.fitBounds(countyBounds);
    }
    
    // If no locations, just show the county map and return
    if (locations.length === 0) {
      // Invalidate size if panel just became visible
      if (isPanelVisible) {
        setTimeout(function() {
          if (heatMapInstance) heatMapInstance.invalidateSize();
        }, 100);
      }
      return;
    }

    var allReports = await WasteData.getAll();
    var maxCount = Math.max.apply(null, locations.map(function(l) { return l.count; })) || 1;
    
    // Build location groups: prefer lat/lng from analytics, fallback to all reports
    var locationGroups = {};
    locations.forEach(function(l) {
      locationGroups[l.location] = {
        location: l.location,
        count: l.count,
        lat: l.lat,
        lng: l.lng
      };
    });
    allReports.forEach(function(r) {
      var loc = (r.location || 'Unknown').trim() || 'Unknown';
      if (!locationGroups[loc]) {
        locationGroups[loc] = { location: loc, count: 0, lat: r.lat, lng: r.lng };
      }
      if (r.lat && r.lng && !locationGroups[loc].lat) {
        locationGroups[loc].lat = r.lat;
        locationGroups[loc].lng = r.lng;
      }
    });

    // Prepare heat map data points
    var heatPoints = [];
    var markers = [];
    var bounds = [];
    
    // Process locations and create heat points
    Object.keys(locationGroups).forEach(function(loc) {
      var group = locationGroups[loc];
      var coords = null;
      
      if (group.lat && group.lng) {
        coords = [group.lat, group.lng];
      } else {
        // Try to geocode within Tharaka Nithi County
        geocodeLocationInCounty(loc, group.count, function(lat, lng) {
          if (lat && lng) {
            addHeatPoint(lat, lng, group.count, maxCount);
          }
        });
        return; // Skip this iteration, will be added async
      }
      
      if (coords) {
        // Add multiple points for intensity (more reports = more points)
        for (var i = 0; i < group.count; i++) {
          // Add slight random offset to create heat spread
          var offsetLat = coords[0] + (Math.random() - 0.5) * 0.01;
          var offsetLng = coords[1] + (Math.random() - 0.5) * 0.01;
          heatPoints.push([offsetLat, offsetLng, group.count]);
        }
        
        markers.push({
          lat: coords[0],
          lng: coords[1],
          count: group.count,
          location: loc
        });
        bounds.push(coords);
      }
    });

    // Add heat layer if we have points
    if (heatPoints.length > 0) {
      addHeatLayer(heatPoints);
    }

    // Add markers with popups
    markers.forEach(function(m) {
      var intensity = m.count / maxCount;
      var radius = Math.max(15, Math.min(50, 15 + intensity * 35));
      
      L.circleMarker([m.lat, m.lng], {
        radius: radius,
        fillColor: intensity > 0.7 ? '#c0392b' : intensity > 0.4 ? '#e74c3c' : '#ff6b6b',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.6
      }).addTo(heatMapInstance).bindPopup(
        '<strong>' + escapeHtml(m.location) + '</strong><br>' +
        m.count + ' report' + (m.count !== 1 ? 's' : '') + '<br>' +
        '<small>High activity area</small>'
      );
    });

    // Fit map to markers if we have them, otherwise keep county bounds
    if (bounds.length > 0) {
      var group = new L.featureGroup(markers.map(function(m) {
        return L.marker([m.lat, m.lng]);
      }));
      heatMapInstance.fitBounds(group.getBounds().pad(0.1));
    }

    // Generate management plan
    generateManagementPlan(locations, allReports);
  }

  function addHeatLayer(points) {
    if (heatLayer) {
      heatLayer.forEach(function(layer) {
        heatMapInstance.removeLayer(layer);
      });
      heatLayer = [];
    } else {
      heatLayer = [];
    }
    
    // Create heat visualization using circles (works without heat plugin)
    // More reports = larger, more opaque red circles
    var maxIntensity = Math.max.apply(null, points.map(function(p) { return p[2] || 1; })) || 1;
    
    points.forEach(function(point) {
      var lat = point[0];
      var lng = point[1];
      var intensity = point[2] || 1;
      var normalizedIntensity = intensity / maxIntensity;
      
      // Create overlapping circles for heat effect
      var radius = 200 + (normalizedIntensity * 300); // 200-500 meters
      var opacity = 0.3 + (normalizedIntensity * 0.4); // 0.3-0.7 opacity
      
      // Color based on intensity: light pink to dark red
      var color = normalizedIntensity > 0.7 ? '#c0392b' : 
                  normalizedIntensity > 0.5 ? '#e74c3c' : 
                  normalizedIntensity > 0.3 ? '#ef5350' : '#ffcdd2';
      
      var circle = L.circle([lat, lng], {
        radius: radius,
        fillColor: color,
        color: color,
        weight: 0,
        fillOpacity: opacity
      }).addTo(heatMapInstance);
      
      heatLayer.push(circle);
    });
  }

  function addHeatPoint(lat, lng, count, maxCount) {
    if (!heatMapInstance) return;
    
    var normalizedIntensity = count / maxCount;
    var radius = 200 + (normalizedIntensity * 300);
    var opacity = 0.3 + (normalizedIntensity * 0.4);
    var color = normalizedIntensity > 0.7 ? '#c0392b' : 
                normalizedIntensity > 0.5 ? '#e74c3c' : 
                normalizedIntensity > 0.3 ? '#ef5350' : '#ffcdd2';
    
    var circle = L.circle([lat, lng], {
      radius: radius,
      fillColor: color,
      color: color,
      weight: 0,
      fillOpacity: opacity
    }).addTo(heatMapInstance);
    
    if (!heatLayer) heatLayer = [];
    heatLayer.push(circle);
  }

  function geocodeLocationInCounty(locationName, count, callback) {
    // Geocode with county context
    var query = locationName + ', Tharaka Nithi County, Kenya';
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=1', {
      headers: { 'Accept': 'application/json' }
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.length > 0) {
          var lat = parseFloat(data[0].lat);
          var lng = parseFloat(data[0].lon);
          callback(lat, lng);
        }
      })
      .catch(function() {
        callback(null, null);
      });
  }

  function generateManagementPlan(locations, reports) {
    var planContent = document.getElementById('management-plan-content');
    if (!planContent) return;

    var totalReports = reports.length;
    var topHotspots = locations.slice(0, 5);
    var highActivity = locations.filter(function(l) { return l.count >= 3; });
    var lowActivity = locations.filter(function(l) { return l.count === 1; });

    var html = '';

    // Top Hotspots Card
    html += '<div class="plan-card plan-card-highlight">';
    html += '<h3>🔥 Most Reported Locations</h3>';
    if (topHotspots.length > 0) {
      html += '<ul class="plan-list">';
      topHotspots.forEach(function(loc, idx) {
        var pct = totalReports > 0 ? Math.round((loc.count / totalReports) * 100) : 0;
        html += '<li><strong>' + (idx + 1) + '. ' + escapeHtml(loc.location) + '</strong> — ' + loc.count + ' report' + (loc.count !== 1 ? 's' : '') + ' (' + pct + '% of total)</li>';
      });
      html += '</ul>';
      html += '<p class="plan-recommendation"><strong>Recommendation:</strong> Increase collection frequency at these locations. Consider adding more bins or scheduling daily pickups.</p>';
    } else {
      html += '<p>No hotspots identified yet.</p>';
    }
    html += '</div>';

    // Collection Frequency Analysis
    html += '<div class="plan-card">';
    html += '<h3>📅 Collection Frequency Plan</h3>';
    html += '<p><strong>High Activity Areas (' + highActivity.length + '):</strong> Require frequent collection (daily or every 2 days)</p>';
    html += '<p><strong>Medium Activity Areas:</strong> Standard collection schedule (weekly)</p>';
    html += '<p><strong>Low Activity Areas (' + lowActivity.length + '):</strong> Can be collected less frequently (bi-weekly)</p>';
    html += '<p class="plan-recommendation"><strong>Action:</strong> Create collection routes prioritizing high-activity zones. Assign dedicated collectors to hotspots.</p>';
    html += '</div>';

    // Resource Allocation
    html += '<div class="plan-card">';
    html += '<h3>👷 Resource Allocation</h3>';
    var collectorsNeeded = Math.ceil(highActivity.length / 3);
    html += '<p><strong>Current Status:</strong> ' + totalReports + ' total reports across ' + locations.length + ' locations</p>';
    html += '<p><strong>Recommended:</strong> ' + collectorsNeeded + ' collector' + (collectorsNeeded !== 1 ? 's' : '') + ' assigned to high-activity zones</p>';
    html += '<p class="plan-recommendation"><strong>Strategy:</strong> Distribute collectors based on collection density. High-density areas need more resources.</p>';
    html += '</div>';

    // Route Optimization
    html += '<div class="plan-card">';
    html += '<h3>🗺️ Route Optimization</h3>';
    html += '<p><strong>Efficiency Tip:</strong> Group nearby high-activity locations into single routes to reduce travel time.</p>';
    if (topHotspots.length >= 2) {
      html += '<p><strong>Suggested Route:</strong> ';
      html += topHotspots.slice(0, 3).map(function(l) { return escapeHtml(l.location); }).join(' → ');
      html += '</p>';
    }
    html += '<p class="plan-recommendation"><strong>Benefit:</strong> Optimized routes can reduce collection time by 20-30% and fuel costs.</p>';
    html += '</div>';

    // Bin Placement Recommendations
    html += '<div class="plan-card">';
    html += '<h3>🗑️ Bin Placement Strategy</h3>';
    html += '<p><strong>High-Demand Areas:</strong> Consider adding additional bins at top ' + Math.min(3, topHotspots.length) + ' hotspot' + (topHotspots.length !== 1 ? 's' : '') + '</p>';
    html += '<p><strong>Coverage:</strong> Ensure bins are within 200m of high-activity zones</p>';
    html += '<p class="plan-recommendation"><strong>Impact:</strong> More bins reduce overflow and improve citizen satisfaction.</p>';
    html += '</div>';

    planContent.innerHTML = html;
  }

  var allReportsFilter = 'all';
  var allReportsSearch = '';
  var allReportsSort = 'newest';
  var pendingSearch = '';
  var pendingSort = 'newest';
  var selectedPendingReports = [];

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    var d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function renderAllReports() {
    var all = await WasteData.getAll();
    var tbody = document.getElementById('all-reports-list');
    var tableEl = document.getElementById('reports-table');
    var emptyEl = document.getElementById('all-reports-empty');
    if (!tbody) return;

    // Update stats
    var pending = await WasteData.getPending();
    var approved = await WasteData.getApproved();
    var collected = await WasteData.getCollected();
    var totalEl = document.getElementById('all-reports-total');
    var pendingEl = document.getElementById('all-reports-pending');
    var approvedEl = document.getElementById('all-reports-approved');
    var collectedEl = document.getElementById('all-reports-collected');
    if (totalEl) totalEl.textContent = all.length;
    if (pendingEl) pendingEl.textContent = pending.length;
    if (approvedEl) approvedEl.textContent = approved.length;
    if (collectedEl) collectedEl.textContent = collected.length;

    // Filter by status
    var filtered = all;
    if (allReportsFilter !== 'all') {
      filtered = all.filter(function(r) { return r.status === allReportsFilter; });
    }

    // Search filter
    if (allReportsSearch) {
      var searchLower = allReportsSearch.toLowerCase();
      filtered = filtered.filter(function(r) {
        var id = (r.id || '').toLowerCase();
        var name = (r.name || '').toLowerCase();
        var location = (r.location || '').toLowerCase();
        return id.includes(searchLower) || name.includes(searchLower) || location.includes(searchLower);
      });
    }

    // Sort
    filtered = filtered.slice();
    if (allReportsSort === 'newest') {
      filtered.sort(function(a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    } else if (allReportsSort === 'oldest') {
      filtered.sort(function(a, b) {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });
    } else if (allReportsSort === 'status') {
      var statusOrder = { pending: 1, approved: 2, collected: 3 };
      filtered.sort(function(a, b) {
        return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      });
    }

    // Render table
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';
    if (tableEl) tableEl.style.display = filtered.length === 0 ? 'none' : 'table';

    filtered.forEach(function(r) {
      var tr = document.createElement('tr');
      var actionsHtml = '<button type="button" class="btn btn-sm btn-view" data-id="' + escapeHtml(r.id) + '">View</button>';
      if (r.status === 'pending') {
        actionsHtml += '<button type="button" class="btn btn-sm btn-approve" data-id="' + escapeHtml(r.id) + '">Approve</button>';
        actionsHtml += '<button type="button" class="btn btn-sm btn-reject" data-id="' + escapeHtml(r.id) + '">Reject</button>';
      } else if (r.status === 'approved') {
        actionsHtml += '<button type="button" class="btn btn-sm btn-collect" data-id="' + escapeHtml(r.id) + '">Mark Collected</button>';
      }
      tr.innerHTML =
        '<td><a href="#" class="report-id-link" data-id="' + escapeHtml(r.id) + '">#' + escapeHtml((r.id || '').slice(1, 9)) + '</a></td>' +
        '<td>' + escapeHtml(r.name || 'Anonymous') + '</td>' +
        '<td>' + escapeHtml(r.location || 'Unknown') + '</td>' +
        '<td>' + escapeHtml(r.wasteType || 'N/A') + '</td>' +
        '<td>' + (r.fillLevel || 0) + '%</td>' +
        '<td><span class="report-badge ' + r.status + '">' + r.status + '</span></td>' +
        '<td>' + formatDate(r.createdAt) + '</td>' +
        '<td class="table-actions">' + actionsHtml + '</td>';
      tbody.appendChild(tr);
    });

    // Attach event listeners
    tbody.querySelectorAll('.btn-view, .report-id-link').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        showReportDetails(btn.dataset.id).catch(function() {});
      });
    });
    tbody.querySelectorAll('.btn-approve').forEach(function(btn) {
      btn.addEventListener('click', function() {
        WasteData.approve(btn.dataset.id).then(function(ok) { if (ok) render(); });
      });
    });
    tbody.querySelectorAll('.btn-reject').forEach(function(btn) {
      btn.addEventListener('click', function() {
        WasteData.reject(btn.dataset.id).then(function(ok) { if (ok) render(); });
      });
    });
    tbody.querySelectorAll('.btn-collect').forEach(function(btn) {
      btn.addEventListener('click', function() {
        WasteData.markCollected(btn.dataset.id).then(function(ok) { if (ok) render(); });
      });
    });
  }

  async function showReportDetails(id) {
    var report = await WasteData.getReport(id);
    if (!report) return;
    var modal = document.getElementById('report-details-modal');
    var content = document.getElementById('report-details-content');
    if (!modal || !content) return;
    content.innerHTML =
      '<div class="detail-row"><strong>Report ID:</strong> <span>#' + escapeHtml((report.id || '').slice(1)) + '</span></div>' +
      '<div class="detail-row"><strong>Status:</strong> <span class="report-badge ' + report.status + '">' + report.status + '</span></div>' +
      '<div class="detail-row"><strong>Reporter:</strong> <span>' + escapeHtml(report.name || 'Anonymous') + '</span></div>' +
      '<div class="detail-row"><strong>Location:</strong> <span>' + escapeHtml(report.location || 'Unknown') + '</span></div>' +
      '<div class="detail-row"><strong>Waste Type:</strong> <span>' + escapeHtml(report.wasteType || 'N/A') + '</span></div>' +
      '<div class="detail-row"><strong>Fill Level:</strong> <span>' + (report.fillLevel || 0) + '%</span></div>' +
      '<div class="detail-row"><strong>Created:</strong> <span>' + formatDate(report.createdAt) + '</span></div>' +
      (report.approvedAt ? '<div class="detail-row"><strong>Approved:</strong> <span>' + formatDate(report.approvedAt) + '</span></div>' : '') +
      (report.collectedAt ? '<div class="detail-row"><strong>Collected:</strong> <span>' + formatDate(report.collectedAt) + '</span></div>' : '') +
      '<div class="detail-actions" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">' +
      (report.status === 'pending' ? '<button type="button" class="btn btn-approve" data-id="' + escapeHtml(report.id) + '">Approve</button> <button type="button" class="btn btn-reject" data-id="' + escapeHtml(report.id) + '">Reject</button>' : '') +
      (report.status === 'approved' ? '<button type="button" class="btn btn-collect" data-id="' + escapeHtml(report.id) + '">Mark Collected</button>' : '') +
      '</div>';
    modal.classList.remove('is-hidden');
    content.querySelectorAll('.btn-approve').forEach(function(btn) {
      btn.addEventListener('click', function() {
        WasteData.approve(btn.dataset.id).then(function(ok) {
          if (ok) { modal.classList.add('is-hidden'); render(); }
        });
      });
    });
    content.querySelectorAll('.btn-reject').forEach(function(btn) {
      btn.addEventListener('click', function() {
        WasteData.reject(btn.dataset.id).then(function(ok) {
          if (ok) { modal.classList.add('is-hidden'); render(); }
        });
      });
    });
    content.querySelectorAll('.btn-collect').forEach(function(btn) {
      btn.addEventListener('click', function() {
        WasteData.markCollected(btn.dataset.id).then(function(ok) {
          if (ok) { modal.classList.add('is-hidden'); render(); }
        });
      });
    });
  }

  async function renderPendingReports() {
    var pending = await WasteData.getPending();
    var tbody = document.getElementById('pending-list');
    var tableEl = document.getElementById('pending-table');
    var emptyEl = document.getElementById('pending-empty');
    var statCount = document.getElementById('pending-stat-count');
    var statUrgent = document.getElementById('pending-stat-urgent');
    
    if (!tbody) return;
    
    // Update stats
    var urgentCount = pending.filter(function(r) { return (r.fillLevel || 0) >= 80; }).length;
    if (statCount) statCount.textContent = pending.length;
    if (statUrgent) statUrgent.textContent = urgentCount;
    
    // Filter by search
    var filtered = pending.slice();
    if (pendingSearch) {
      var searchLower = pendingSearch.toLowerCase();
      filtered = filtered.filter(function(r) {
        var id = (r.id || '').toLowerCase();
        var name = (r.name || '').toLowerCase();
        var location = (r.location || '').toLowerCase();
        return id.includes(searchLower) || name.includes(searchLower) || location.includes(searchLower);
      });
    }
    
    // Sort
    if (pendingSort === 'newest') {
      filtered.sort(function(a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    } else if (pendingSort === 'oldest') {
      filtered.sort(function(a, b) {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });
    } else if (pendingSort === 'fill-high') {
      filtered.sort(function(a, b) {
        return (b.fillLevel || 0) - (a.fillLevel || 0);
      });
    } else if (pendingSort === 'fill-low') {
      filtered.sort(function(a, b) {
        return (a.fillLevel || 0) - (b.fillLevel || 0);
      });
    }
    
    // Render table
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';
    if (tableEl) tableEl.style.display = filtered.length === 0 ? 'none' : 'table';
    
    filtered.forEach(function(r) {
      var tr = document.createElement('tr');
      var isUrgent = (r.fillLevel || 0) >= 80;
      var fillClass = isUrgent ? 'fill-urgent' : (r.fillLevel || 0) >= 50 ? 'fill-warning' : 'fill-ok';
      var isSelected = selectedPendingReports.indexOf(r.id) !== -1;
      
      tr.innerHTML =
        '<td><input type="checkbox" class="pending-checkbox" data-id="' + escapeHtml(r.id) + '"' + (isSelected ? ' checked' : '') + '></td>' +
        '<td><a href="#" class="report-id-link" data-id="' + escapeHtml(r.id) + '">#' + escapeHtml((r.id || '').slice(1, 9)) + '</a></td>' +
        '<td>' + escapeHtml(r.name || 'Anonymous') + '</td>' +
        '<td>' + escapeHtml(r.location || 'Unknown') + '</td>' +
        '<td>' + escapeHtml(r.wasteType || 'N/A') + '</td>' +
        '<td><span class="fill-badge ' + fillClass + '">' + (r.fillLevel || 0) + '%</span>' + (isUrgent ? ' <span class="urgent-indicator">⚠</span>' : '') + '</td>' +
        '<td>' + formatDate(r.createdAt) + '</td>' +
        '<td class="table-actions">' +
          '<button type="button" class="btn btn-sm btn-view" data-id="' + escapeHtml(r.id) + '">View</button>' +
          '<button type="button" class="btn btn-sm btn-approve" data-id="' + escapeHtml(r.id) + '">Approve</button>' +
          '<button type="button" class="btn btn-sm btn-reject" data-id="' + escapeHtml(r.id) + '">Reject</button>' +
        '</td>';
      tbody.appendChild(tr);
    });
    
    // Attach event listeners
    tbody.querySelectorAll('.btn-view, .report-id-link').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        showReportDetails(btn.dataset.id).catch(function() {});
      });
    });
    tbody.querySelectorAll('.btn-approve').forEach(function(btn) {
      btn.addEventListener('click', function() {
        WasteData.approve(btn.dataset.id).then(function(ok) { if (ok) render(); });
      });
    });
    tbody.querySelectorAll('.btn-reject').forEach(function(btn) {
      btn.addEventListener('click', function() {
        WasteData.reject(btn.dataset.id).then(function(ok) { if (ok) render(); });
      });
    });
    tbody.querySelectorAll('.pending-checkbox').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var id = cb.dataset.id;
        var idx = selectedPendingReports.indexOf(id);
        if (cb.checked && idx === -1) {
          selectedPendingReports.push(id);
        } else if (!cb.checked && idx !== -1) {
          selectedPendingReports.splice(idx, 1);
        }
        updateSelectAllCheckbox();
      });
    });
  }
  
  function updateSelectAllCheckbox() {
    var selectAll = document.getElementById('pending-select-all');
    var checkboxes = document.querySelectorAll('.pending-checkbox');
    if (!selectAll || checkboxes.length === 0) return;
    selectAll.checked = checkboxes.length > 0 && selectedPendingReports.length === checkboxes.length;
  }

  async function renderCollectors() {
    var collectors = await WasteData.getCollectors();
    var tbody = document.getElementById('collectors-list');
    var tableEl = document.getElementById('collectors-table');
    var emptyEl = document.getElementById('collectors-empty');
    var select = document.getElementById('drive-collector');
    if (tbody) tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = collectors.length === 0 ? 'block' : 'none';
    if (tableEl) tableEl.style.display = collectors.length ? 'table' : 'none';
    if (select) {
      select.innerHTML = '<option value="">— Select —</option>';
      collectors.forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c.username;
        opt.textContent = c.username;
        select.appendChild(opt);
      });
    }
    if (tbody) {
      collectors.forEach(function(c) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td class="collector-username">' + escapeHtml(c.username) + '</td>' +
          '<td><span class="report-badge collected">Collector</span></td>' +
          '<td><span class="status-badge status-active">Active</span></td>' +
          '<td><button type="button" class="btn btn-remove-collector" data-username="' + escapeHtml(c.username) + '" title="Remove collector">Remove</button></td>';
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll('.btn-remove-collector').forEach(function(btn) {
        btn.addEventListener('click', function() {
          WasteData.removeUser(btn.dataset.username).then(function(ok) { if (ok) render(); });
        });
      });
    }
  }

  async function renderDashboard() {
    var all = await WasteData.getAll();
    var pending = await WasteData.getPending();
    var approved = await WasteData.getApproved();
    var collected = await WasteData.getCollected();
    var collectors = await WasteData.getCollectors();

    // Main stats
    var statTotal = document.getElementById('stat-total');
    var statPending = document.getElementById('stat-pending');
    var statApproved = document.getElementById('stat-approved');
    var statCollected = document.getElementById('stat-collected');
    if (statTotal) statTotal.textContent = all.length;
    if (statPending) statPending.textContent = pending.length;
    if (statApproved) statApproved.textContent = approved.length;
    if (statCollected) statCollected.textContent = collected.length;

    // Secondary stats
    var urgentCount = pending.filter(function(r) { return (r.fillLevel || 0) >= 80; }).length;
    var statUrgent = document.getElementById('stat-urgent');
    var statCollectors = document.getElementById('stat-collectors');
    var statRate = document.getElementById('stat-rate');
    var statToday = document.getElementById('stat-today');
    
    if (statUrgent) statUrgent.textContent = urgentCount;
    if (statCollectors) statCollectors.textContent = collectors.length;
    if (statRate) {
      var rate = all.length > 0 ? Math.round((collected.length / all.length) * 100) : 0;
      statRate.textContent = rate + '%';
    }
    
    // Today's activity (reports created today)
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayCount = all.filter(function(r) {
      if (!r.createdAt) return false;
      var created = new Date(r.createdAt);
      return created >= today;
    }).length;
    if (statToday) statToday.textContent = todayCount;

    // Progress bars
    var total = all.length || 1;
    var pendingPct = Math.round((pending.length / total) * 100);
    var approvedPct = Math.round((approved.length / total) * 100);
    var collectedPct = Math.round((collected.length / total) * 100);
    
    var progressPendingBar = document.getElementById('progress-pending-bar');
    var progressApprovedBar = document.getElementById('progress-approved-bar');
    var progressCollectedBar = document.getElementById('progress-collected-bar');
    var progressPendingCount = document.getElementById('progress-pending-count');
    var progressApprovedCount = document.getElementById('progress-approved-count');
    var progressCollectedCount = document.getElementById('progress-collected-count');
    
    if (progressPendingBar) progressPendingBar.style.width = pendingPct + '%';
    if (progressApprovedBar) progressApprovedBar.style.width = approvedPct + '%';
    if (progressCollectedBar) progressCollectedBar.style.width = collectedPct + '%';
    if (progressPendingCount) progressPendingCount.textContent = pending.length;
    if (progressApprovedCount) progressApprovedCount.textContent = approved.length;
    if (progressCollectedCount) progressCollectedCount.textContent = collected.length;

    // Quick actions badge
    var quickPendingCount = document.getElementById('quick-pending-count');
    if (quickPendingCount) {
      quickPendingCount.textContent = pending.length;
      quickPendingCount.style.display = pending.length > 0 ? 'inline-block' : 'none';
    }

    // Recent pending reports preview
    renderPendingPreview(pending.slice(0, 5));

    // Recent activity
    renderRecentActivity(all.slice(0, 10));
  }

  function renderPendingPreview(pendingReports) {
    var container = document.getElementById('dashboard-pending-preview');
    if (!container) return;
    
    if (pendingReports.length === 0) {
      container.innerHTML = '<p class="empty-state">No pending reports.</p>';
      return;
    }

    container.innerHTML = '';
    pendingReports.forEach(function(r) {
      var isUrgent = (r.fillLevel || 0) >= 80;
      var card = document.createElement('div');
      card.className = 'pending-preview-card';
      card.innerHTML =
        '<div class="preview-header">' +
          '<span class="preview-id">#' + escapeHtml((r.id || '').slice(1, 9)) + '</span>' +
          '<span class="report-badge pending">Pending</span>' +
        '</div>' +
        '<div class="preview-body">' +
          '<p><strong>' + escapeHtml(r.name || 'Anonymous') + '</strong> — ' + escapeHtml(r.location || 'Unknown') + '</p>' +
          '<p class="preview-meta">Type: ' + escapeHtml(r.wasteType || 'N/A') + ' · Fill: ' + (r.fillLevel || 0) + '%' + (isUrgent ? ' <span class="urgent-indicator">⚠ Urgent</span>' : '') + '</p>' +
        '</div>' +
        '<div class="preview-actions">' +
          '<button type="button" class="btn btn-sm btn-approve" data-id="' + escapeHtml(r.id) + '">Approve</button>' +
          '<button type="button" class="btn btn-sm btn-reject" data-id="' + escapeHtml(r.id) + '">Reject</button>' +
        '</div>';
      container.appendChild(card);
    });

    // Attach event listeners
    container.querySelectorAll('.btn-approve').forEach(function(btn) {
      btn.addEventListener('click', function() {
        WasteData.approve(btn.dataset.id).then(function(ok) { if (ok) render(); });
      });
    });
    container.querySelectorAll('.btn-reject').forEach(function(btn) {
      btn.addEventListener('click', function() {
        WasteData.reject(btn.dataset.id).then(function(ok) { if (ok) render(); });
      });
    });
  }

  function renderRecentActivity(reports) {
    var container = document.getElementById('recent-activity-list');
    if (!container) return;
    
    if (reports.length === 0) {
      container.innerHTML = '<p class="empty-state">No recent activity.</p>';
      return;
    }

    container.innerHTML = '';
    reports.forEach(function(r) {
      var activity = document.createElement('div');
      activity.className = 'activity-item';
      var statusIcon = r.status === 'pending' ? '⏳' : r.status === 'approved' ? '✓' : '✓✓';
      var statusColor = r.status === 'pending' ? 'var(--status-warning)' : r.status === 'approved' ? 'var(--status-ok)' : 'var(--primary)';
      activity.innerHTML =
        '<span class="activity-icon" style="color: ' + statusColor + ';">' + statusIcon + '</span>' +
        '<div class="activity-content">' +
          '<p><strong>' + escapeHtml(r.name || 'Anonymous') + '</strong> — ' + escapeHtml(r.location || 'Unknown') + '</p>' +
          '<p class="activity-meta">' + formatDate(r.createdAt) + ' · <span class="report-badge ' + r.status + '">' + r.status + '</span></p>' +
        '</div>';
      container.appendChild(activity);
    });
  }

  function render() {
    renderDashboard().catch(function() {});
    renderPendingReports().catch(function() {});
    // Only render heatmap if panel is visible (will be rendered when panel is shown)
    var heatmapPanel = document.getElementById('panel-heatmap');
    if (heatmapPanel && heatmapPanel.classList.contains('active')) {
      renderHeatMap().catch(function() {});
    }
    renderAllReports().catch(function() {});
    renderCollectors().catch(function() {});
  }

  var addDriveForm = document.getElementById('add-drive-form');
  if (addDriveForm) {
    addDriveForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var name = document.getElementById('drive-name').value.trim();
      var zone = document.getElementById('drive-zone').value.trim();
      var schedule = document.getElementById('drive-schedule').value;
      var collector = document.getElementById('drive-collector').value;
      var msg = document.getElementById('drive-message');
      if (msg) {
        msg.style.display = 'block';
        msg.textContent = 'Drive "' + name + '" created for ' + (zone || 'general area') + ' (' + schedule + ')' + (collector ? ', assigned to ' + collector : '') + '.';
        msg.style.color = 'var(--status-ok)';
      }
    });
  }

  var btnShowAddCollector = document.getElementById('btn-show-add-collector');
  var addCollectorFormWrap = document.getElementById('add-collector-form-wrap');
  var btnCloseAddCollector = document.getElementById('btn-close-add-collector');

  function closeAddCollectorModal() {
    if (addCollectorFormWrap) addCollectorFormWrap.classList.add('is-hidden');
  }

  function openAddCollectorModal() {
    if (addCollectorFormWrap) addCollectorFormWrap.classList.remove('is-hidden');
  }

  if (btnShowAddCollector && addCollectorFormWrap) {
    btnShowAddCollector.addEventListener('click', openAddCollectorModal);
  }
  if (btnCloseAddCollector) {
    btnCloseAddCollector.addEventListener('click', closeAddCollectorModal);
  }
  if (addCollectorFormWrap) {
    addCollectorFormWrap.addEventListener('click', function(e) {
      if (e.target === addCollectorFormWrap) closeAddCollectorModal();
    });
  }

  // Pending Reports filters and search
  var pendingSearchInput = document.getElementById('pending-search');
  if (pendingSearchInput) {
    pendingSearchInput.addEventListener('input', function() {
      pendingSearch = this.value.trim();
      renderPendingReports().catch(function() {});
    });
  }

  var pendingSortSelect = document.getElementById('pending-sort');
  if (pendingSortSelect) {
    pendingSortSelect.addEventListener('change', function() {
      pendingSort = this.value;
      renderPendingReports().catch(function() {});
    });
  }

  // Select all checkbox
  var pendingSelectAll = document.getElementById('pending-select-all');
  if (pendingSelectAll) {
    pendingSelectAll.addEventListener('change', function() {
      var checkboxes = document.querySelectorAll('.pending-checkbox');
      checkboxes.forEach(function(cb) {
        cb.checked = pendingSelectAll.checked;
        var id = cb.dataset.id;
        var idx = selectedPendingReports.indexOf(id);
        if (pendingSelectAll.checked && idx === -1) {
          selectedPendingReports.push(id);
        } else if (!pendingSelectAll.checked && idx !== -1) {
          selectedPendingReports.splice(idx, 1);
        }
      });
    });
  }

  // Bulk actions
  var btnSelectAllPending = document.getElementById('btn-select-all-pending');
  if (btnSelectAllPending) {
    btnSelectAllPending.addEventListener('click', function() {
      var selectAll = document.getElementById('pending-select-all');
      if (selectAll) {
        selectAll.checked = !selectAll.checked;
        selectAll.dispatchEvent(new Event('change'));
      }
    });
  }

  var btnBulkApprove = document.getElementById('btn-bulk-approve');
  if (btnBulkApprove) {
    btnBulkApprove.addEventListener('click', function() {
      if (selectedPendingReports.length === 0) {
        alert('Please select at least one report to approve.');
        return;
      }
      Promise.all(selectedPendingReports.map(function(id) { return WasteData.approve(id); }))
        .then(function(results) {
          var approved = results.filter(Boolean).length;
          selectedPendingReports = [];
          alert('Approved ' + approved + ' report' + (approved !== 1 ? 's' : '') + '.');
          render();
        });
    });
  }

  var btnBulkReject = document.getElementById('btn-bulk-reject');
  if (btnBulkReject) {
    btnBulkReject.addEventListener('click', function() {
      if (selectedPendingReports.length === 0) {
        alert('Please select at least one report to reject.');
        return;
      }
      if (!confirm('Are you sure you want to reject ' + selectedPendingReports.length + ' report' + (selectedPendingReports.length !== 1 ? 's' : '') + '?')) {
        return;
      }
      var ids = selectedPendingReports.slice();
      selectedPendingReports = [];
      Promise.all(ids.map(function(id) { return WasteData.reject(id); }))
        .then(function(results) {
          var rejected = results.filter(Boolean).length;
          alert('Rejected ' + rejected + ' report' + (rejected !== 1 ? 's' : '') + '.');
          render();
        });
    });
  }

  // All Reports filters and search
  document.querySelectorAll('.btn-filter').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.btn-filter').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      allReportsFilter = btn.dataset.filter;
      renderAllReports().catch(function() {});
    });
  });

  var reportsSearch = document.getElementById('reports-search');
  if (reportsSearch) {
    reportsSearch.addEventListener('input', function() {
      allReportsSearch = this.value.trim();
      renderAllReports().catch(function() {});
    });
  }

  var reportsSort = document.getElementById('reports-sort');
  if (reportsSort) {
    reportsSort.addEventListener('change', function() {
      allReportsSort = this.value;
      renderAllReports().catch(function() {});
    });
  }

  // Modal close
  var modalCloseBtn = document.getElementById('modal-close-btn');
  var reportModal = document.getElementById('report-details-modal');
  if (modalCloseBtn && reportModal) {
    modalCloseBtn.addEventListener('click', function() {
      reportModal.classList.add('is-hidden');
    });
    reportModal.addEventListener('click', function(e) {
      if (e.target === reportModal) {
        reportModal.classList.add('is-hidden');
      }
    });
  }

  var addCollectorForm = document.getElementById('add-collector-form');
  if (addCollectorForm) {
    addCollectorForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var username = document.getElementById('collector-username').value.trim();
      var password = document.getElementById('collector-password').value;
      var confirmPassword = document.getElementById('collector-password-confirm').value;
      var msg = document.getElementById('collector-message');
      if (!msg) return;
      msg.style.display = 'block';
      if (password !== confirmPassword) {
        msg.textContent = 'Passwords do not match.';
        msg.style.color = 'var(--status-urgent)';
        return;
      }
      if (password.length < 6) {
        msg.textContent = 'Password must be at least 6 characters.';
        msg.style.color = 'var(--status-urgent)';
        return;
      }
      WasteData.registerUser(username, password, 'collector').then(function(ok) {
        if (ok) {
          msg.textContent = 'Collector "' + username + '" added.';
          msg.style.color = 'var(--status-ok)';
          addCollectorForm.reset();
          closeAddCollectorModal();
          render();
        } else {
          msg.textContent = 'Username already exists. Choose another.';
          msg.style.color = 'var(--status-urgent)';
        }
      });
    });
  }

  render().catch(function() {});
})();
