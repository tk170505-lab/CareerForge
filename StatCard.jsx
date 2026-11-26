import React from 'react';
import { AnimatedNumber, TiltGlassCard } from './LiquidUI.jsx';

export default function StatCard({ label, value, suffix = '', subtitle, badge, icon: Icon }) {
  const isNumeric = typeof value === 'number';

  return (
    <TiltGlassCard className="glass-panel" maxTilt={4}>
      <div className="between">
        <span className="stat-label">{label}</span>
        {badge || (Icon && (
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(0, 113, 227, 0.1)',
              color: 'var(--accent-blue)',
            }}
          >
            <Icon size={15} />
          </span>
        ))}
      </div>
      <div className="stat-value">
        {isNumeric ? <AnimatedNumber value={value} suffix={suffix} /> : value}
      </div>
      {subtitle && <div className="muted" style={{ fontSize: '0.8rem' }}>{subtitle}</div>}
    </TiltGlassCard>
  );
}
