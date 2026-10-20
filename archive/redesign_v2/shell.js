/**
 * MyAsset — Global Application Shell & Navigation Engine (shell.js)
 * Ensures one persistent, centralized navigation sidebar and header across all pages.
 */

(function () {
  'use strict';

  // Central Navigation Configuration
  const NAVIGATION_CONFIG = [
    {
      section: "MAIN",
      items: [
        {
          id: "overview",
          label: "Overview",
          path: "overview.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`
        },
        {
          id: "today",
          label: "Today",
          path: "admin.html?view=today",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`
        },
        {
          id: "activity",
          label: "Activity",
          path: "activity.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`
        },
        {
          id: "alerts",
          label: "Alerts",
          path: "alerts.html",
          badge: "2",
          badgeClass: "badge-danger",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`
        }
      ]
    },
    {
      section: "MANAGE",
      items: [
        {
          id: "assets",
          label: "Assets",
          path: "assets.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`
        },
        {
          id: "employees",
          label: "Employees",
          path: "employees.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`
        },
        {
          id: "assignments",
          label: "Assignments",
          path: "assignments.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`
        },
        {
          id: "checked-out",
          label: "Checked Out",
          path: "assignments.html?filter=checked-out",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`
        },
        {
          id: "locations",
          label: "Locations",
          path: "locations.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`
        },
        {
          id: "maintenance",
          label: "Maintenance",
          path: "maintenance.html",
          badge: "3",
          badgeClass: "badge-warn",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`
        },
        {
          id: "requests",
          label: "Requests",
          path: "requests.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`
        }
      ]
    },
    {
      section: "INSIGHTS",
      items: [
        {
          id: "reports",
          label: "Reports",
          path: "reports.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`
        }
      ]
    },
    {
      section: "SYSTEM",
      items: [
        {
          id: "settings",
          label: "Settings",
          path: "settings.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
        },
        {
          id: "admin",
          label: "Admin",
          path: "admin.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`
        }
      ]
    }
  ];

  // Helper to determine active link based on current location
  function getActiveId() {
    const page = window.location.pathname.split('/').pop() || 'overview.html';
    const search = window.location.search;

    if (page === 'admin.html' && search.includes('view=today')) return 'today';
    if (page === 'admin.html') return 'admin';
    if (page === 'assignments.html' && search.includes('filter=checked-out')) return 'checked-out';
    if (page === 'assignments.html') return 'assignments';
    if (page === 'asset-details.html') return 'assets';

    for (const group of NAVIGATION_CONFIG) {
      for (const item of group.items) {
        if (item.path.split('?')[0] === page) {
          return item.id;
        }
      }
    }
    return 'overview';
  }

  // Render Sidebar HTML
  function renderSidebar() {
    const activeId = getActiveId();
    let html = `<div class="sidebar-brand-header">
      <div class="brand-logo" onclick="window.location.href='overview.html'" style="cursor:pointer;">
        <div class="brand-icon">⚡</div>
        <span>MyAsset Pro</span>
      </div>
    </div>`;

    NAVIGATION_CONFIG.forEach(group => {
      html += `<div><div class="sidebar-group-title">${group.section}</div>`;
      group.items.forEach(item => {
        const isActive = item.id === activeId ? ' active' : '';
        const badgeHtml = item.badge ? `<span class="nav-badge ${item.badgeClass}">${item.badge}</span>` : '';
        html += `<a href="${item.path}" class="sidebar-link${isActive}">
          <div class="sidebar-link-content">
            ${item.icon}
            <span>${item.label}</span>
          </div>
          ${badgeHtml}
        </a>`;
      });
      html += `</div>`;
    });

    return html;
  }

  // Initialize Shell on DOM Content Loaded
  function initShell() {
    // 1. Target or create sidebar
    let sidebar = document.querySelector('.neu-sidebar');
    let appLayout = document.querySelector('.app-layout');

    if (!appLayout && document.body) {
      // Wrap content in app-layout if missing
      const stage = document.querySelector('.podium-stage') || document.body;
      const header = stage.querySelector('.top-navbar');
      const main = stage.querySelector('main') || stage.querySelector('.neu-panel');

      if (main && !appLayout) {
        appLayout = document.createElement('div');
        appLayout.className = 'app-layout';
        main.parentNode.insertBefore(appLayout, main);
        appLayout.appendChild(main);
      }
    }

    if (!sidebar && appLayout) {
      sidebar = document.createElement('aside');
      sidebar.className = 'neu-sidebar';
      appLayout.insertBefore(sidebar, appLayout.firstChild);
    }

    if (sidebar) {
      sidebar.innerHTML = renderSidebar();
    }

    // 2. Add Mobile Navigation Drawer Toggle if needed
    const header = document.querySelector('.top-navbar');
    if (header && !header.querySelector('.mobile-toggle-btn')) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'mobile-toggle-btn';
      toggleBtn.innerHTML = '☰';
      toggleBtn.onclick = function() {
        if (sidebar) {
          sidebar.classList.toggle('mobile-open');
        }
      };
      header.insertBefore(toggleBtn, header.firstChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShell);
  } else {
    initShell();
  }

})();
