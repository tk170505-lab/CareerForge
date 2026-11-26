import React, { useEffect, useState } from 'react';
import { Activity, Database, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { DashboardSkeleton, TiltGlassCard } from '../components/LiquidUI.jsx';

export default function ArchitecturePage() {
  const [health, setHealth] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadHealth() {
    try {
      const data = await apiFetch('/api/analytics/system-health');
      setHealth(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  async function clearCache() {
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/analytics/cache/clear', { method: 'POST' });
      setMessage('In-memory TTL cache cleared.');
      await loadHealth();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!health) return <DashboardSkeleton />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {message && <div className="alert alert-success">{message}</div>}

      <div className="grid-3">
        <TiltGlassCard className="glass-panel" maxTilt={3}>
          <div className="between" style={{ marginBottom: 12 }}>
            <div className="row">
              <Server size={18} color="var(--accent-blue)" />
              <h3 className="card-title">Three-Tier System Design</h3>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearCache}>
              <RefreshCw size={13} /> Clear Cache
            </button>
          </div>
          <ul style={{ paddingLeft: 18, display: 'grid', gap: 6, fontSize: '0.86rem' }} className="muted">
            {health.architecture.tiers.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div style={{ marginTop: 14 }} className="row">
            <span className="badge badge-accent">Hits: {health.cache.hits}</span>
            <span className="badge badge-muted">Hit Rate: {health.cache.hitRatePercent}%</span>
            <span className="badge badge-primary">Active Keys: {health.cache.activeKeys}</span>
          </div>
        </TiltGlassCard>

        <TiltGlassCard className="glass-panel" maxTilt={3}>
          <div className="row" style={{ marginBottom: 12 }}>
            <Database size={18} color="var(--accent-cyan)" />
            <h3 className="card-title">RDBMS &amp; DP-900 Azure Data</h3>
          </div>
          <div style={{ display: 'grid', gap: 9, fontSize: '0.85rem' }}>
            <div className="between">
              <span className="muted">Database Engine</span>
              <span className="badge badge-primary">{health.architecture.dbClient} (T-SQL Ready)</span>
            </div>
            <div className="between">
              <span className="muted">Document Storage</span>
              <span className="badge badge-accent">{health.architecture.storageProvider}</span>
            </div>
            <div className="between">
              <span className="muted">vw_verified_certificates</span>
              <strong>{health.databaseViews.vw_verified_certificates_rows} rows</strong>
            </div>
            <div className="between">
              <span className="muted">vw_learner_skill_gaps</span>
              <strong>{health.databaseViews.vw_learner_skill_gaps_rows} rows</strong>
            </div>
          </div>
        </TiltGlassCard>

        <TiltGlassCard className="glass-panel" maxTilt={3}>
          <div className="row" style={{ marginBottom: 12 }}>
            <ShieldCheck size={18} color="var(--accent-emerald)" />
            <h3 className="card-title">Cloud Security Controls</h3>
          </div>
          <ul style={{ paddingLeft: 18, display: 'grid', gap: 5, fontSize: '0.83rem' }} className="muted">
            {health.architecture.securityControls.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </TiltGlassCard>
      </div>

      <div className="glass-panel">
        <div className="card-header">
          <h3 className="card-title">Academic Foundations &amp; Tech Stack Traceability</h3>
        </div>
        <div className="grid-2" style={{ gap: 14 }}>
          <div className="glass-panel-subtle">
            <strong>Earlier Subjects Applied</strong>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: 5 }}>
              Programming &amp; OOP (modular services/UI primitives), DSA (HashMap O(1) skill lookup &amp; priority matching), DBMS (3NF tables, views, triggers, stored procedures), Web Development, Computer Networks, Software Engineering, and Cloud Computing.
            </p>
          </div>
          <div className="glass-panel-subtle">
            <strong>Tech Stack Active</strong>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: 5 }}>
              React.js · HTML5 · CSS3 · JavaScript · Node.js · Express.js · Azure SQL Database / SQLite · Azure Blob Storage · Microsoft Power BI · JWT · bcrypt · Helmet · RBAC.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="card-header">
          <div className="row">
            <Activity size={18} color="var(--accent-amber)" />
            <h3 className="card-title">Live Security &amp; Database Trigger Activity Log</h3>
          </div>
          <span className="badge badge-muted">Latest 20 events</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {health.recentActivityLogs.map((log) => (
                <tr key={log.id}>
                  <td className="muted" style={{ fontSize: '0.78rem' }}>{log.created_at}</td>
                  <td><span className="badge badge-primary">{log.action}</span></td>
                  <td>{log.full_name || 'System / Anonymous'} {log.role ? `(${log.role})` : ''}</td>
                  <td className="muted">{log.entity_type || '—'} #{log.entity_id || '—'}</td>
                  <td style={{ fontSize: '0.84rem' }}>{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
