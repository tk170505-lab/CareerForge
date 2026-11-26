import React, { useEffect, useState } from 'react';
import {
  Award,
  Bell,
  BookOpen,
  Briefcase,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard, roles: ['learner', 'educator', 'employer', 'verifier'] },
  { id: 'skills', label: 'Skill Assessment & Gaps', icon: Target, roles: ['learner'] },
  { id: 'learning', label: 'Personalized Learning', icon: BookOpen, roles: ['learner', 'educator', 'employer', 'verifier'] },
  { id: 'certificates', label: 'Certificate Verification', icon: Award, roles: ['learner', 'educator', 'employer', 'verifier'] },
  { id: 'jobs', label: 'Jobs & Skill Matching', icon: Briefcase, roles: ['learner', 'employer', 'educator', 'verifier'] },
  { id: 'architecture', label: 'System, Azure & Security', icon: ShieldCheck, roles: ['learner', 'educator', 'employer', 'verifier'] },
];

export default function Layout({ activeTab, onTabChange, children }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [recentLogs, setRecentLogs] = useState([]);

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  useEffect(() => {
    apiFetch('/api/analytics/system-health')
      .then((res) => setRecentLogs((res.recentActivityLogs || []).slice(0, 5)))
      .catch(() => {});
  }, [activeTab]);

  function selectTab(id) {
    onTabChange(id);
    setMobileOpen(false);
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.28)', zIndex: 28 }}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="between" style={{ padding: '2px 4px' }}>
          <div className="brand">
            <div className="brand-mark">CF</div>
            {!collapsed && (
              <div>
                <div className="brand-title">CareerForge</div>
                <div className="brand-sub">Verified Talent OS</div>
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm desktop-only"
            style={{ padding: '6px 8px' }}
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm mobile-only"
            style={{ padding: '6px 8px' }}
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={15} />
          </button>
        </div>

        <nav className="nav-list">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
                onClick={() => selectTab(item.id)}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="glass-panel-subtle" style={{ padding: collapsed ? 10 : 14 }}>
          {!collapsed && (
            <>
              <div className="muted" style={{ fontSize: '0.73rem', fontWeight: 600 }}>ACTIVE WORKSPACE</div>
              <div style={{ fontWeight: 700, marginTop: 3, fontSize: '0.92rem' }}>{user.full_name}</div>
              <div style={{ marginTop: 6 }}>
                <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                  {user.role}
                </span>
              </div>
            </>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', marginTop: collapsed ? 0 : 12, padding: collapsed ? '8px' : undefined }}
            onClick={logout}
            title="Sign Out"
          >
            <LogOut size={14} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary btn-sm mobile-only"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={16} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {visibleNav.find((n) => n.id === activeTab)?.label || 'CareerForge'}
              </h1>
              <div className="muted" style={{ fontSize: '0.8rem' }}>
                {user.headline || user.organization || 'Career Intelligence & Verification Workspace'}
              </div>
            </div>
          </div>

          <div className="row" style={{ position: 'relative' }}>
            <span className="badge badge-success desktop-only">Azure DP-900 Ready</span>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setProfileOpen(false);
                }}
                aria-label="Notifications"
              >
                <Bell size={15} />
                <span className="desktop-only">Activity</span>
                {recentLogs.length > 0 && <span className="badge badge-accent">{recentLogs.length}</span>}
              </button>

              {notifOpen && (
                <div className="popover-menu">
                  <div className="between" style={{ marginBottom: 10 }}>
                    <strong style={{ fontSize: '0.88rem' }}>Recent Platform Activity</strong>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNotifOpen(false)}>
                      Close
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {recentLogs.length === 0 ? (
                      <div className="muted" style={{ fontSize: '0.82rem' }}>No recent events yet.</div>
                    ) : (
                      recentLogs.map((log) => (
                        <div
                          key={log.id}
                          style={{ padding: 8, borderRadius: 10, background: 'rgba(17,24,39,0.04)', fontSize: '0.8rem' }}
                        >
                          <div style={{ fontWeight: 600 }}>{log.action}</div>
                          <div className="muted">{log.details}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setProfileOpen((o) => !o);
                  setNotifOpen(false);
                }}
              >
                <span>{user.full_name.split(' ')[0]}</span>
                <ChevronDown size={14} />
              </button>

              {profileOpen && (
                <div className="popover-menu" style={{ width: 250 }}>
                  <div style={{ fontWeight: 700 }}>{user.full_name}</div>
                  <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 10 }}>{user.email}</div>
                  <div className="row" style={{ marginBottom: 12 }}>
                    <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{user.role}</span>
                    {user.organization && <span className="badge badge-muted">{user.organization}</span>}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%' }}
                    onClick={logout}
                  >
                    <LogOut size={14} /> Sign Out &amp; Switch Role
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="page-content page-enter">{children}</main>
      </div>
    </div>
  );
}
