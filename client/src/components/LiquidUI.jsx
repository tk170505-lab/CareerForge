import React, { useEffect, useRef, useState } from 'react';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Interactive 3D Liquid Glass card with subtle perspective tilt and specular sheen.
 */
export function TiltGlassCard({ children, className = 'glass-panel', style = {}, maxTilt = 5, onClick }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 20 });

  function handleMove(e) {
    if (prefersReducedMotion() || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const ry = (px - 0.5) * maxTilt * 2;
    const rx = (0.5 - py) * maxTilt * 2;
    setTilt({ rx, ry, gx: Math.round(px * 100), gy: Math.round(py * 100) });
  }

  function handleLeave() {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 20 });
  }

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`${className} tilt-card`}
      style={{
        ...style,
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
      }}
    >
      <div
        className="tilt-sheen"
        style={{
          background: `radial-gradient(360px circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.65), transparent 65%)`,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Scroll-triggered reveal wrapper using IntersectionObserver.
 */
export function Reveal({ children, delayMs = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(prefersReducedMotion());

  useEffect(() => {
    if (visible || !ref.current || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Smoothly animates numeric dashboard counters.
 */
export function AnimatedNumber({ value, suffix = '', durationMs = 700 }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(prefersReducedMotion() ? target : 0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(target);
      return;
    }
    let rafId;
    const start = performance.now();
    const initial = 0;

    function tick(now) {
      const elapsed = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplay(Math.round(initial + (target - initial) * eased));
      if (elapsed < 1) rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs]);

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="grid-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-panel">
            <div className="skeleton" style={{ height: 14, width: '48%', marginBottom: 14 }} />
            <div className="skeleton" style={{ height: 34, width: '62%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 12, width: '75%' }} />
          </div>
        ))}
      </div>
      <div className="grid-2">
        <div className="glass-panel">
          <div className="skeleton" style={{ height: 220 }} />
        </div>
        <div className="glass-panel">
          <div className="skeleton" style={{ height: 220 }} />
        </div>
      </div>
    </div>
  );
}
