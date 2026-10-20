/**
 * MyAsset — Global Application Shell (shell.js)
 * Renders the single, shared navigation sidebar into #appSidebar on every page,
 * wires the mobile drawer, verifies the session and fills in the signed-in user.
 * Layout itself lives in css/app-shell.css.
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
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR', 'MAINTENANCE STAFF', 'FIELD WORKER']
        },
        {
          id: "today",
          label: "Today",
          path: "admin.html?view=today",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR', 'MAINTENANCE STAFF']
        },
        {
          id: "activity",
          label: "Activity",
          path: "activity.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']
        },
        {
          id: "alerts",
          label: "Alerts",
          path: "alerts.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']
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
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR', 'FIELD WORKER']
        },
        {
          id: "employees",
          label: "Employees",
          path: "employees.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']
        },
        {
          id: "assignments",
          label: "Assignments",
          path: "assignments.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']
        },
        {
          id: "checked-out",
          label: "Checked Out",
          path: "assignments.html?filter=checked-out",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']
        },
        {
          id: "locations",
          label: "Locations",
          path: "locations.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']
        },
        {
          id: "maintenance",
          label: "Maintenance",
          path: "maintenance.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER', 'MAINTENANCE STAFF']
        },
        {
          id: "requests",
          label: "Requests",
          path: "requests.html",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER', 'MAINTENANCE STAFF', 'SITE / CREW SUPERVISOR']
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
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER']
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
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
          roles: ['ADMIN', 'OPERATIONS MANAGER']
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

  // Render sidebar HTML (brand + grouped navigation)
  function renderSidebar() {
    const activeId = getActiveId();
    const userRole = window.currentUser ? (window.currentUser.role_name || window.currentUser.role || '').toUpperCase() : '';
    let html = `<div class="app-brand" data-href="overview.html" role="link" tabindex="0" aria-label="MyAsset Pro — Overview">
      <div class="app-brand-icon" aria-hidden="true">⚡</div>
      <span class="app-brand-text">MyAsset Pro</span>
    </div>
    <nav class="app-nav" aria-label="Primary">`;

    NAVIGATION_CONFIG.forEach(group => {
      let groupItemsHtml = '';
      group.items.forEach(item => {
        if (!item.roles || item.roles.includes(userRole) || userRole === 'ADMIN') {
          const isActive = item.id === activeId;
          const badgeHtml = item.badge ? `<span class="nav-badge ${item.badgeClass || ''}">${item.badge}</span>` : '';
          groupItemsHtml += `<a href="${item.path}" class="app-nav-link${isActive ? ' active' : ''}" title="${item.label}"${isActive ? ' aria-current="page"' : ''}>
            <span class="app-nav-link-content">
              ${item.icon}
              <span class="app-nav-label">${item.label}</span>
            </span>
            ${badgeHtml}
          </a>`;
        }
      });
      if (groupItemsHtml) {
        html += `<div class="app-nav-group"><div class="app-nav-title">${group.section}</div>${groupItemsHtml}</div>`;
      }
    });

    html += `</nav>`;
    return html;
  }

  // ───────── Mobile navigation drawer ─────────
  function setupDrawer(sidebar) {
    const menuBtn = document.getElementById('appMenuBtn');
    let scrim = document.getElementById('appScrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.className = 'app-scrim';
      scrim.id = 'appScrim';
      sidebar.parentNode.insertBefore(scrim, sidebar.nextSibling);
    }

    function setOpen(open) {
      sidebar.classList.toggle('is-open', open);
      scrim.classList.toggle('is-visible', open);
      document.body.classList.toggle('nav-open', open);
      if (menuBtn) {
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        menuBtn.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      }
    }

    if (menuBtn) {
      menuBtn.setAttribute('aria-controls', 'appSidebar');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.addEventListener('click', () => setOpen(!sidebar.classList.contains('is-open')));
    }
    scrim.addEventListener('click', () => setOpen(false));
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('a.app-nav-link')) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
        setOpen(false);
        if (menuBtn) menuBtn.focus();
      }
    });
    window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => {
      if (e.matches) setOpen(false);
    });
  }

  // ───────── Signed-in user chip ─────────
  function titleCase(str) {
    return String(str || '').toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
  }

  function initialsOf(str) {
    const words = String(str || '').split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (!words.length) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function renderUser(user) {
    const chip = document.getElementById('appUser');
    if (!chip || !user) return;
    const role = user.role_name || user.role || '';
    const label = titleCase(role) || 'Signed in';
    const avatar = chip.querySelector('.app-avatar');
    const name = chip.querySelector('.app-user-name');
    if (avatar) avatar.textContent = initialsOf(role);
    if (name) name.textContent = label;
    chip.title = label;
    chip.hidden = false;

    // Inject dropdown
    let dropdown = chip.querySelector('.app-user-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'app-user-dropdown';
      chip.appendChild(dropdown);
      
      chip.addEventListener('click', (e) => {
        dropdown.classList.toggle('is-open');
        e.stopPropagation();
      });
      document.addEventListener('click', () => {
        dropdown.classList.remove('is-open');
      });
    }

    const canSeeSettings = ['ADMIN', 'OPERATIONS MANAGER'].includes(role.toUpperCase());
    dropdown.innerHTML = `
      <div class="dropdown-header">
        <div class="dropdown-header-name">${user.first_name || 'User'} ${user.last_name || ''}</div>
        <div class="dropdown-header-email">${user.email}</div>
      </div>
      <div class="dropdown-item" onclick="window.showToast('Feature not yet available: Profile Editor', 'info')">Profile</div>
      ${canSeeSettings ? `<div class="dropdown-item" onclick="window.location.href='settings.html'">Settings</div>` : ''}
      <div class="dropdown-item text-danger" id="logoutBtn">Log out</div>
    `;

    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await fetch('/api/v1/auth/logout', { method: 'POST' });
      } catch(err) {
        // ignore network error on logout
      }
      window.currentUser = null;
      window.showToast('Signed out successfully', 'success');
      setTimeout(() => { window.location.href = '/pages/login.html'; }, 500);
    });
  }

    // ───────── Toast UI ─────────
    window.showToast = function(message, type = 'info') {
      let container = document.getElementById('toastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = `
          position: fixed;
          bottom: 24px;
          right: 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 9999;
        `;
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      const bgColors = { info: '#17201F', success: '#005B4F', error: '#D32F2F', warning: '#F57C00' };
      toast.style.cssText = `
        background: ${bgColors[type] || bgColors.info};
        color: #fff;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;
      toast.textContent = message;
      container.appendChild(toast);

      // trigger animation
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
      });

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    };

  // ───────── Global Fetch Interceptor ─────────
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    if (response.status === 401 && !window.location.pathname.includes('login.html')) {
      window.currentUser = null;
      window.location.href = '/pages/login.html';
    }
    return response;
  };

  // ───────── Init ─────────
  async function initShell() {
    // 2. Verify the session (every page except login)
    if (!window.location.pathname.includes('login.html')) {
      try {
        const res = await fetch('/api/v1/auth/session', { credentials: 'same-origin' });
        if (!res.ok) {
          window.location.href = '/pages/login.html';
          return;
        }
        const data = await res.json();
        window.currentUser = data.user;
        
        // 1. Sidebar renders only AFTER we have the user role
        const sidebar = document.getElementById('appSidebar');
        if (sidebar) {
          sidebar.innerHTML = renderSidebar();
          const brand = sidebar.querySelector('.app-brand');
          if (brand) {
            const go = () => { window.location.href = brand.dataset.href; };
            brand.addEventListener('click', go);
            brand.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
            });
          }
          setupDrawer(sidebar);
        }

        renderUser(data.user);
      } catch (e) {
        window.location.href = '/pages/login.html';
        return;
      }
    }

    // Let pages know the shell + session are ready
    window.dispatchEvent(new Event('shell-ready'));
  }

  // The script tag sits at the end of <body>, so #appSidebar already exists; only wait if it doesn't yet.
  if (document.getElementById('appSidebar') || document.readyState !== 'loading') {
    initShell();
  } else {
    document.addEventListener('DOMContentLoaded', initShell);
  }

})();
