import React, { useState } from 'react';

export function ReadinessGauge({ score, title = 'Employability Readiness' }) {
  const safe = Math.max(0, Math.min(100, Number(score) || 0));
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  let tier = 'Developing';
  let tierClass = 'badge-warning';
  if (safe >= 80) {
    tier = 'Career Ready';
    tierClass = 'badge-success';
  } else if (safe >= 60) {
    tier = 'On Track';
    tierClass = 'badge-accent';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 144, height: 144, flexShrink: 0 }}>
        <svg width="144" height="144" viewBox="0 0 144 144">
          <defs>
            <linearGradient id="appleRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0071e3" />
              <stop offset="55%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          <circle cx="72" cy="72" r={radius} fill="none" stroke="rgba(17, 24, 39, 0.08)" strokeWidth="12" />
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke="url(#appleRingGrad)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 72 72)"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
          <text x="72" y="70" textAnchor="middle" fill="#1d1d1f" fontSize="26" fontWeight="800">
            {safe}%
          </text>
          <text x="72" y="88" textAnchor="middle" fill="#6e6e73" fontSize="10.5" fontWeight="600">
            READINESS
          </text>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: '1.08rem', color: 'var(--graphite)' }}>{title}</span>
          <span className={`badge ${tierClass}`}>{tier}</span>
        </div>
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          Weighted across top job skill alignment (45%), verified skill depth (25%), completed courses (15%), and SHA-256 verified certificates (15%).
        </p>
      </div>
    </div>
  );
}

export function CertificateDonutChart({ breakdown = [] }) {
  const [hovered, setHovered] = useState(null);
  const counts = { VERIFIED: 0, PENDING: 0, REJECTED: 0 };
  for (const row of breakdown) {
    counts[row.status] = Number(row.count || 0);
  }
  const sum = counts.VERIFIED + counts.PENDING + counts.REJECTED;
  const total = Math.max(1, sum);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { label: 'Verified', value: counts.VERIFIED, color: '#059669' },
    { label: 'Pending', value: counts.PENDING, color: '#d97706' },
    { label: 'Rejected', value: counts.REJECTED, color: '#dc2626' },
  ];

  let cumulative = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <svg width="124" height="124" viewBox="0 0 124 124">
        <circle cx="62" cy="62" r={radius} fill="none" stroke="rgba(17, 24, 39, 0.08)" strokeWidth="14" />
        {segments.map((seg) => {
          const frac = seg.value / total;
          const dash = frac * circumference;
          const offset = -cumulative * circumference;
          cumulative += frac;
          if (seg.value === 0) return null;
          const isHov = hovered === seg.label;
          return (
            <circle
              key={seg.label}
              cx="62"
              cy="62"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={isHov ? 17 : 14}
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={offset}
              transform="rotate(-90 62 62)"
              style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease' }}
              onMouseEnter={() => setHovered(seg.label)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
        <text x="62" y="60" textAnchor="middle" fill="#1d1d1f" fontSize="19" fontWeight="800">
          {hovered ? segments.find((s) => s.label === hovered)?.value : sum}
        </text>
        <text x="62" y="75" textAnchor="middle" fill="#6e6e73" fontSize="9.5" fontWeight="600">
          {hovered ? hovered.toUpperCase() : 'TOTAL'}
        </text>
      </svg>

      <div style={{ display: 'grid', gap: 8, fontSize: '0.86rem', flex: 1 }}>
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="between"
            onMouseEnter={() => setHovered(seg.label)}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: '6px 10px',
              borderRadius: 10,
              background: hovered === seg.label ? 'rgba(17,24,39,0.05)' : 'transparent',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <div className="row">
              <span style={{ width: 9, height: 9, borderRadius: 99, background: seg.color, display: 'inline-block' }} />
              <span>{seg.label}</span>
            </div>
            <strong>{seg.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkillDemandSupplyChart({ data = [] }) {
  const [activeId, setActiveId] = useState(null);
  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.job_demand_count || 0, d.learner_supply_count || 0))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row" style={{ fontSize: '0.79rem', color: 'var(--text-secondary)' }}>
        <span className="row">
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#1d1d1f', display: 'inline-block' }} /> Employer Demand
        </span>
        <span className="row">
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#0071e3', display: 'inline-block' }} /> Learner Supply
        </span>
        <span className="row">
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#059669', display: 'inline-block' }} /> Verified Learners
        </span>
      </div>

      {data.map((row) => {
        const isActive = activeId === row.skill_id;
        return (
          <div
            key={row.skill_id}
            onMouseEnter={() => setActiveId(row.skill_id)}
            onMouseLeave={() => setActiveId(null)}
            style={{
              display: 'grid',
              gap: 5,
              padding: '8px 10px',
              borderRadius: 12,
              background: isActive ? 'rgba(255,255,255,0.75)' : 'transparent',
              border: isActive ? '1px solid rgba(17,24,39,0.08)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <div className="between" style={{ fontSize: '0.84rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--graphite)' }}>{row.skill_name}</span>
              <span className="muted" style={{ fontSize: '0.78rem' }}>
                Demand {row.job_demand_count} · Supply {row.learner_supply_count} · Verified {row.verified_learner_count} · Avg Lvl {row.avg_proficiency}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <div className="progress-track" style={{ height: 6 }}>
                <div
                  style={{
                    width: `${(row.job_demand_count / maxVal) * 100}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: '#1d1d1f',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
              <div className="progress-track" style={{ height: 6 }}>
                <div
                  style={{
                    width: `${(row.learner_supply_count / maxVal) * 100}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #0071e3, #059669)',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SkillProficiencyChart({ skills = [] }) {
  if (!skills.length) {
    return <p className="muted" style={{ fontSize: '0.86rem' }}>No skills recorded yet.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 11 }}>
      {skills.map((sk) => {
        const pct = Math.round((sk.proficiency_level / 5) * 100);
        return (
          <div key={sk.id || sk.skill_id} style={{ display: 'grid', gap: 5 }}>
            <div className="between" style={{ fontSize: '0.84rem' }}>
              <div className="row">
                <strong style={{ color: 'var(--graphite)' }}>{sk.skill_name}</strong>
                <span className={`badge ${sk.verified ? 'badge-success' : 'badge-muted'}`}>
                  {sk.verified ? 'Verified' : sk.source}
                </span>
              </div>
              <span className="muted">Level {sk.proficiency_level}/5</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${pct}%`,
                  background: sk.verified
                    ? 'linear-gradient(90deg, #0071e3, #059669)'
                    : 'linear-gradient(90deg, #64748b, #0ea5e9)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
