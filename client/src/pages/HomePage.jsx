import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Cloud,
  Code2,
  Database,
  GraduationCap,
  Layers,
  Lock,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { AnimatedNumber, Reveal, TiltGlassCard } from '../components/LiquidUI.jsx';

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Assess Skills & Pinpoint Gaps',
    desc: 'Interactive technical evaluations and proficiency benchmarking against live job requisitions.',
    icon: Target,
  },
  {
    step: '02',
    title: 'Follow Targeted Learning',
    desc: 'Courses and educator-led modules ranked dynamically by how many skill deficits they close.',
    icon: BookOpen,
  },
  {
    step: '03',
    title: 'Verify Every Certificate',
    desc: 'Cryptographic SHA-256 digests, unique verification codes, and auditor sign-off stored in Azure Blob.',
    icon: Award,
  },
  {
    step: '04',
    title: 'Match With Verified Roles',
    desc: 'Weighted DSA matching ranks candidates and opportunities transparently with readiness scores.',
    icon: Briefcase,
  },
];

const TARGET_USERS = [
  { title: 'Students', role: 'learner', desc: 'Benchmark technical competencies early and follow structured pathways before graduation.' },
  { title: 'Fresh Graduates', role: 'learner', desc: 'Convert academic achievements and verified certificates into measurable job readiness.' },
  { title: 'Job Seekers', role: 'learner', desc: 'Expose exact skill gaps for target roles and apply with transparent match scores.' },
  { title: 'Educators', role: 'educator', desc: 'Publish skill-mapped courses, monitor completion outcomes, and close market deficits.' },
  { title: 'Certification Providers', role: 'verifier', desc: 'Audit submitted documents, validate authenticity, and record tamper-evident trust logs.' },
  { title: 'Employers', role: 'employer', desc: 'Define role skill matrices and shortlist candidates ranked by verified, job-ready talent.' },
];

const BLUEPRINT_TABS = {
  system: {
    label: 'System Design',
    icon: Server,
    summary: 'Scalable Three-Tier Architecture with REST APIs & TTL Caching',
    points: [
      'Presentation Tier: React.js SPA (HTML5, CSS3, JavaScript) with Apple Liquid Glass surfaces and responsive 3D depth.',
      'Application Tier: Express.js REST APIs covering auth, skills, assessments, learning, certificates, jobs, and analytics.',
      'Data Tier: Normalized relational SQL database paired with Blob storage abstraction for uploaded certificate artifacts.',
      'TTL Caching Layer: Cache-aside service in server/src/utils/cache.js with automatic prefix invalidation on mutations.',
    ],
  },
  rdbms: {
    label: 'RDBMS',
    icon: Database,
    summary: 'Normalized 3NF Relational Schema with Views, Triggers & Procedures',
    points: [
      '15 Normalized Tables: users, skills, user_skills, assessments, assessment_questions, assessment_attempts, courses, course_skills, enrollments, certificates, certificate_verifications, jobs, job_skills, applications, activity_logs.',
      'Integrity & Speed: Primary/foreign keys, CHECK/UNIQUE constraints, composite junction keys, and targeted indexes.',
      'Relational Views: vw_verified_certificates, vw_learner_skill_gaps, and vw_analytics_overview power BI and dashboards.',
      'Transactions, Triggers & Procedures: Atomic multi-table updates (sp_VerifyCertificate, sp_CompleteCourseAndUpdateSkill) and audit triggers.',
    ],
  },
  dp900: {
    label: 'DP-900 (Azure Data)',
    icon: Cloud,
    summary: 'Azure SQL Database, Azure Blob Storage & Microsoft Power BI',
    points: [
      'Azure SQL Database: Production T-SQL DDL in database/azure_sql_schema.sql handles structured ACID workloads.',
      'Azure Blob Storage: Certificate documents store SHA-256 digests and container-scoped URLs with local emulator fallback.',
      'Microsoft Power BI: Connects to relational views via DirectQuery or consumes /api/analytics/powerbi-feed (JSON & CSV).',
    ],
  },
  security: {
    label: 'Cloud Security',
    icon: ShieldCheck,
    summary: 'JWT Authentication, RBAC, Validation & Activity Auditing',
    points: [
      'Authentication & Hashing: Signed JWT Bearer tokens and adaptive salted bcrypt password hashing.',
      'Role-Based Access Control: Middleware enforces strict permissions across learner, educator, employer, and verifier roles.',
      'Injection & XSS Protection: Parameterized SQL queries, script-stripping validation, Helmet headers, CORS allowlist, and rate limiting.',
      'Cloud & Network Hygiene: Externalized .env secrets, HTTPS/TLS transport design, DB network rules, and live activity_logs auditing.',
    ],
  },
  subjects: {
    label: 'Earlier Subjects',
    icon: GraduationCap,
    summary: 'Core Computer Science & Engineering Foundations Applied',
    points: [
      'Programming & OOP: Modular ES services, reusable React UI primitives, and clean domain separation.',
      'Data Structures & Algorithms: O(1) HashMap skill lookup and priority-sorted weighted job matching.',
      'DBMS & Web Development: 3NF normalization, transactions, REST semantics, and responsive SPA engineering.',
      'Computer Networks, Software Engineering & Cloud Computing: TLS/CORS security, automated integration tests, and Azure cloud readiness.',
    ],
  },
  stack: {
    label: 'Planned Tech Stack',
    icon: Layers,
    summary: 'Complete Production & Academic Stack Alignment',
    points: [
      'Frontend: React.js, HTML5, CSS3, JavaScript (Liquid Glass Design System)',
      'Backend: Node.js, Express.js REST API with TTL Cache',
      'Database & Storage: Azure SQL Database (SQLite mirror for instant local run), Azure Blob Storage',
      'Analytics & Cloud: Microsoft Power BI, Microsoft Azure',
      'Security: JWT authentication, bcrypt password hashing, HTTPS, input validation & RBAC',
    ],
  },
};

export default function HomePage() {
  const { login, register } = useAuth();
  const [summary, setSummary] = useState(null);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [activeBlueprint, setActiveBlueprint] = useState('system');

  const [verifyCode, setVerifyCode] = useState('CF-CERT-2026-8F4A19C2');
  const [verifyResult, setVerifyResult] = useState(null);

  const [authModal, setAuthModal] = useState(null); // 'login' | 'register' | null
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'learner',
    headline: '',
    organization: '',
    target_role: 'Full-Stack Cloud Engineer',
  });

  useEffect(() => {
    apiFetch('/api/analytics/public-summary').then(setSummary).catch(() => {});
    apiFetch('/api/auth/demo-accounts').then((d) => setDemoAccounts(d.accounts || [])).catch(() => {});
  }, []);

  async function handleDemoLogin(email) {
    setBusy(true);
    setAuthError('');
    try {
      await login(email, 'Password123!');
    } catch (err) {
      setAuthError(err.message);
      setAuthModal('login');
    } finally {
      setBusy(false);
    }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError('');
    setBusy(true);
    try {
      if (authModal === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePublicVerify(e) {
    e.preventDefault();
    setVerifyResult(null);
    if (!verifyCode.trim()) return;
    try {
      const res = await apiFetch(`/api/certificates/verify/${encodeURIComponent(verifyCode.trim())}`);
      setVerifyResult(res);
    } catch (err) {
      setVerifyResult({ valid: false, error: err.message });
    }
  }

  const overview = summary?.overview || {};
  const activeBp = BLUEPRINT_TABS[activeBlueprint];
  const ActiveBpIcon = activeBp.icon;

  return (
    <div>
      {/* Floating Liquid Glass Navbar */}
      <div className="floating-nav-wrap">
        <header className="floating-nav">
          <div className="brand">
            <div className="brand-mark">CF</div>
            <div>
              <div className="brand-title">CareerForge</div>
              <div className="brand-sub">Skills · Trust · Careers</div>
            </div>
          </div>

          <nav className="nav-links-pill">
            <a className="nav-link-item" href="#how-it-works">How It Works</a>
            <a className="nav-link-item" href="#showcases">Platform</a>
            <a className="nav-link-item" href="#verify">Verify Certificate</a>
            <a className="nav-link-item" href="#blueprint">Architecture</a>
          </nav>

          <div className="row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setAuthError('');
                setAuthModal('login');
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setAuthError('');
                setAuthModal('register');
              }}
            >
              Get Started <ArrowRight size={14} />
            </button>
          </div>
        </header>
      </div>

      {/* Hero Section with 3D Liquid Glass Preview */}
      <section className="hero-shell">
        <div className="page-enter">
          <span className="eyebrow">
            <Sparkles size={13} color="var(--accent-blue)" />
            Azure DP-900 · Normalized RDBMS · RBAC Secured
          </span>

          <h1 className="hero-headline">
            Forge Verified Skills into{' '}
            <span className="hero-headline-accent">Real Careers.</span>
          </h1>

          <p className="muted" style={{ fontSize: '1.06rem', maxWidth: 540 }}>
            CareerForge bridges the divide between learner capabilities and employer expectations—combining interactive skill assessments, gap-driven learning, cryptographic certificate verification, and intelligent job matching.
          </p>

          <div className="row" style={{ marginTop: 26 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => handleDemoLogin('aarav@careerforge.dev')}
            >
              Get Started — Launch Demo <ArrowRight size={16} />
            </button>
            <a className="btn btn-secondary" href="#showcases">
              Explore Careers &amp; Platform
            </a>
          </div>

          {demoAccounts.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="muted" style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 8 }}>
                INSTANT ROLE WORKSPACE PREVIEW (PASSWORD: <code>Password123!</code>)
              </div>
              <div className="row">
                {demoAccounts.slice(0, 5).map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => handleDemoLogin(acc.email)}
                  >
                    <span>{acc.full_name.split(' ')[0]}</span>
                    <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                      {acc.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3D Interactive VisionOS-inspired Career Growth Stage */}
        <div className="hero-stage">
          <div className="floating-badge float-3d" style={{ top: -2, right: 10 }}>
            <div className="row">
              <CheckCircle2 size={15} color="var(--accent-emerald)" />
              <strong>SHA-256 Verified</strong>
            </div>
            <div className="muted" style={{ fontSize: '0.72rem' }}>DP-900 &amp; OpenJS Registry</div>
          </div>

          <div className="floating-badge float-3d" style={{ bottom: -4, left: 10, animationDelay: '1.5s' }}>
            <div className="row">
              <TrendingUp size={15} color="var(--accent-blue)" />
              <strong>96% Match</strong>
            </div>
            <div className="muted" style={{ fontSize: '0.72rem' }}>Azure Data &amp; BI Track</div>
          </div>

          <div className="hero-device">
            <div className="between" style={{ marginBottom: 18 }}>
              <div>
                <div className="muted" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                  CAREER INTELLIGENCE PREVIEW
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.08rem' }}>Full-Stack Cloud Engineer</div>
              </div>
              <span className="badge badge-success">Live RDBMS</span>
            </div>

            <div className="glass-panel-subtle" style={{ marginBottom: 14 }}>
              <div className="between" style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>Employability Readiness</span>
                <strong style={{ color: 'var(--accent-blue)' }}>80%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: '80%' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {(summary?.topSkills || []).slice(0, 4).map((sk, idx) => (
                <div key={sk.skill_id} className="glass-panel-subtle" style={{ padding: '10px 14px' }}>
                  <div className="between" style={{ fontSize: '0.84rem' }}>
                    <span style={{ fontWeight: 600 }}>{sk.skill_name}</span>
                    <span className="badge badge-primary">{sk.job_demand_count} open roles</span>
                  </div>
                  <div className="progress-track" style={{ height: 5, marginTop: 7 }}>
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(100, 45 + (4 - idx) * 14)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Live Animated Statistics Strip */}
      <section className="section-container" style={{ paddingTop: 12, paddingBottom: 32 }}>
        <Reveal>
          <div className="grid-4">
            <TiltGlassCard className="glass-panel" maxTilt={4}>
              <div className="stat-label">Active Learners</div>
              <div className="stat-value"><AnimatedNumber value={overview.total_learners ?? 2} /></div>
              <div className="muted" style={{ fontSize: '0.82rem' }}>Students &amp; job seekers assessed</div>
            </TiltGlassCard>
            <TiltGlassCard className="glass-panel" maxTilt={4}>
              <div className="stat-label">Verified Certificates</div>
              <div className="stat-value"><AnimatedNumber value={overview.verified_certificates ?? 2} /></div>
              <div className="muted" style={{ fontSize: '0.82rem' }}>SHA-256 &amp; auditor validated</div>
            </TiltGlassCard>
            <TiltGlassCard className="glass-panel" maxTilt={4}>
              <div className="stat-label">Learning Pathways</div>
              <div className="stat-value"><AnimatedNumber value={overview.total_courses ?? 5} /></div>
              <div className="muted" style={{ fontSize: '0.82rem' }}>Educator-curated skill modules</div>
            </TiltGlassCard>
            <TiltGlassCard className="glass-panel" maxTilt={4}>
              <div className="stat-label">Open Job Roles</div>
              <div className="stat-value"><AnimatedNumber value={overview.open_jobs ?? 4} /></div>
              <div className="muted" style={{ fontSize: '0.82rem' }}>Matched via verified competencies</div>
            </TiltGlassCard>
          </div>
        </Reveal>
      </section>

      {/* How CareerForge Works */}
      <section id="how-it-works" className="section-container">
        <Reveal>
          <div style={{ marginBottom: 28, maxWidth: 640 }}>
            <span className="eyebrow">How CareerForge Works</span>
            <h2 className="section-title" style={{ marginTop: 12 }}>
              A closed-loop system from assessment to verified employment.
            </h2>
          </div>
        </Reveal>

        <div className="grid-4">
          {WORKFLOW_STEPS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.step} delayMs={idx * 70}>
                <TiltGlassCard className="glass-panel" style={{ height: '100%' }}>
                  <div className="between" style={{ marginBottom: 14 }}>
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(0, 113, 227, 0.1)',
                        color: 'var(--accent-blue)',
                      }}
                    >
                      <Icon size={20} />
                    </span>
                    <span className="badge badge-muted">{item.step}</span>
                  </div>
                  <h3 className="card-title" style={{ marginBottom: 8 }}>{item.title}</h3>
                  <p className="muted" style={{ fontSize: '0.87rem' }}>{item.desc}</p>
                </TiltGlassCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Varied Showcases: Assessment, Learning, Job Matching, Analytics */}
      <section id="showcases" className="section-container" style={{ paddingTop: 20 }}>
        <Reveal>
          <div style={{ marginBottom: 28 }}>
            <span className="eyebrow">Five Core Capabilities</span>
            <h2 className="section-title" style={{ marginTop: 12 }}>
              Designed for clarity, depth, and real career outcomes.
            </h2>
          </div>
        </Reveal>

        <div className="grid-2" style={{ marginBottom: 20 }}>
          <Reveal>
            <TiltGlassCard className="glass-panel-elevated" style={{ height: '100%' }}>
              <span className="badge badge-accent" style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
                01 · Skill Assessment &amp; Gap Analysis
              </span>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 8 }}>
                Know precisely what stands between you and your target role.
              </h3>
              <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 16 }}>
                Take server-graded technical quizzes across Azure Data Services, RDBMS, Cloud Security, React, and System Design. Compare your verified level against mandatory job requirements.
              </p>
              <div className="glass-panel-subtle">
                <div className="between" style={{ fontSize: '0.84rem', marginBottom: 6 }}>
                  <strong>Azure Data Services (DP-900)</strong>
                  <span className="badge badge-warning">Gap: -1 level</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: '50%' }} />
                </div>
              </div>
            </TiltGlassCard>
          </Reveal>

          <Reveal delayMs={80}>
            <TiltGlassCard className="glass-panel-elevated" style={{ height: '100%' }}>
              <span className="badge badge-success" style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
                02 · Personalized Learning &amp; Teaching
              </span>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 8 }}>
                Courses prioritized by the skill deficits they resolve.
              </h3>
              <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 16 }}>
                Educators publish skill-mapped labs while learners receive gap-ranked recommendations. Completing a course executes an atomic RDBMS transaction that upgrades proficiency levels.
              </p>
              <div className="glass-panel-subtle">
                <div className="between" style={{ fontSize: '0.84rem' }}>
                  <strong>Azure Data Services (DP-900) Mastery Lab</strong>
                  <span className="badge badge-accent">14 hrs · +2 Lvl</span>
                </div>
              </div>
            </TiltGlassCard>
          </Reveal>
        </div>

        <div className="grid-2">
          <Reveal>
            <TiltGlassCard className="glass-panel" style={{ height: '100%' }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <Briefcase size={18} color="var(--accent-blue)" />
                <span className="badge badge-primary">04 · Job &amp; Skill Matching</span>
              </div>
              <h3 style={{ fontSize: '1.22rem', fontWeight: 700, marginBottom: 8 }}>
                Algorithmic talent matching with transparent breakdowns.
              </h3>
              <p className="muted" style={{ fontSize: '0.88rem' }}>
                Employers publish weighted mandatory and optional skills; learners see exact match scores, verified skill bonuses, and real-time application status tracking.
              </p>
            </TiltGlassCard>
          </Reveal>

          <Reveal delayMs={80}>
            <TiltGlassCard className="glass-panel" style={{ height: '100%' }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <BarChart3 size={18} color="var(--accent-emerald)" />
                <span className="badge badge-success">05 · Career Progress &amp; Power BI Analytics</span>
              </div>
              <h3 style={{ fontSize: '1.22rem', fontWeight: 700, marginBottom: 8 }}>
                Real-time employability telemetry &amp; BI-ready SQL views.
              </h3>
              <p className="muted" style={{ fontSize: '0.88rem' }}>
                Track employability readiness, course completion, certification status, and market skill demand vs. verified supply—exportable directly for Microsoft Power BI.
              </p>
            </TiltGlassCard>
          </Reveal>
        </div>
      </section>

      {/* 03 · Interactive Certificate Verification Showcase */}
      <section id="verify" className="section-container" style={{ paddingTop: 20 }}>
        <Reveal>
          <div className="glass-panel-elevated">
            <div className="grid-2" style={{ alignItems: 'center' }}>
              <div>
                <span className="badge badge-success" style={{ marginBottom: 10 }}>
                  03 · Cryptographic Certificate Verification
                </span>
                <h2 className="section-title" style={{ fontSize: '1.7rem', marginBottom: 10 }}>
                  Verify credential authenticity in milliseconds.
                </h2>
                <p className="muted" style={{ fontSize: '0.92rem' }}>
                  Every uploaded certificate is hashed with SHA-256, stored via Azure Blob Storage patterns, and audited by verifiers. Test live with{' '}
                  <code>CF-CERT-2026-8F4A19C2</code> or <code>CF-CERT-2026-A12C44E8</code>.
                </p>
              </div>

              <div>
                <form onSubmit={handlePublicVerify} className="row">
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="Enter CF-CERT-YYYY-XXXXXXXX"
                    aria-label="Certificate verification code"
                  />
                  <button type="submit" className="btn btn-blue">
                    <Search size={15} /> Verify Now
                  </button>
                </form>

                {verifyResult && (
                  <div className={`alert ${verifyResult.valid ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 12 }}>
                    {verifyResult.certificate ? (
                      <div>
                        <div className="row">
                          <CheckCircle2 size={16} />
                          <strong>{verifyResult.certificate.certificate_title}</strong>
                          <span className="badge badge-success">{verifyResult.certificate.status}</span>
                        </div>
                        <div style={{ fontSize: '0.83rem', marginTop: 4 }}>
                          Holder: {verifyResult.certificate.learner_name} · Issuer: {verifyResult.certificate.issuer} · Skill: {verifyResult.certificate.skill_name}
                        </div>
                        <div style={{ fontSize: '0.74rem', marginTop: 4, wordBreak: 'break-all' }}>
                          SHA-256: <code>{verifyResult.certificate.file_hash_sha256}</code>
                        </div>
                      </div>
                    ) : (
                      verifyResult.error
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Target Users */}
      <section className="section-container" style={{ paddingTop: 16 }}>
        <Reveal>
          <div style={{ marginBottom: 24 }}>
            <span className="eyebrow">
              <Users size={13} color="var(--accent-blue)" /> Ecosystem Roles
            </span>
            <h2 className="section-title" style={{ marginTop: 12 }}>
              Built for every stakeholder in talent development.
            </h2>
          </div>
        </Reveal>

        <div className="grid-3">
          {TARGET_USERS.map((u, idx) => (
            <Reveal key={u.title} delayMs={idx * 45}>
              <TiltGlassCard className="glass-panel" style={{ height: '100%' }}>
                <div className="between" style={{ marginBottom: 8 }}>
                  <strong>{u.title}</strong>
                  <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{u.role}</span>
                </div>
                <p className="muted" style={{ fontSize: '0.87rem' }}>{u.desc}</p>
              </TiltGlassCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Engineering, Azure DP-900, RDBMS, Cloud Security & Subjects Blueprint */}
      <section id="blueprint" className="section-container" style={{ paddingTop: 16 }}>
        <Reveal>
          <div style={{ marginBottom: 20 }}>
            <span className="eyebrow">
              <Code2 size={13} color="var(--accent-blue)" /> Technical Architecture
            </span>
            <h2 className="section-title" style={{ marginTop: 12 }}>
              System Design, RDBMS, DP-900 &amp; Cloud Security
            </h2>
          </div>

          <div className="segmented-bar" style={{ marginBottom: 18 }}>
            {Object.entries(BLUEPRINT_TABS).map(([key, item]) => (
              <button
                key={key}
                type="button"
                className={`segmented-pill ${activeBlueprint === key ? 'active' : ''}`}
                onClick={() => setActiveBlueprint(key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="glass-panel-elevated">
            <div className="row" style={{ marginBottom: 16 }}>
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(0, 113, 227, 0.1)',
                  color: 'var(--accent-blue)',
                }}
              >
                <ActiveBpIcon size={20} />
              </span>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{activeBp.summary}</h3>
                <div className="muted" style={{ fontSize: '0.82rem' }}>{activeBp.label} Architecture</div>
              </div>
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              {activeBp.points.map((pt) => (
                <div key={pt} className="glass-panel-subtle" style={{ fontSize: '0.88rem' }}>
                  {pt}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section className="section-container" style={{ paddingTop: 10 }}>
        <Reveal>
          <div className="glass-panel-elevated between" style={{ padding: '32px 34px' }}>
            <div>
              <h2 className="section-title" style={{ fontSize: '1.75rem' }}>
                Ready to experience CareerForge?
              </h2>
              <p className="muted" style={{ marginTop: 6 }}>
                Sign in with any role—Student, Educator, Employer, or Verifier—or create a new account.
              </p>
            </div>
            <div className="row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleDemoLogin('aarav@careerforge.dev')}
                disabled={busy}
              >
                Launch Student Demo
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setAuthError('');
                  setAuthModal('register');
                }}
              >
                Create Account
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Minimalist Footer */}
      <footer className="site-footer">
        <div className="between" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="row">
            <div className="brand-mark" style={{ width: 30, height: 30, fontSize: '0.8rem' }}>CF</div>
            <strong>CareerForge</strong>
            <span className="muted" style={{ fontSize: '0.84rem' }}>
              React.js · Node.js/Express · Azure SQL &amp; Blob · Power BI · JWT &amp; RBAC
            </span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAuthModal('login')}>
            Open Workspace
          </button>
        </div>
      </footer>

      {/* Liquid Glass Auth Modal */}
      {authModal && (
        <div className="modal-backdrop" onClick={() => setAuthModal(null)}>
          <div className="modal-card page-enter" onClick={(e) => e.stopPropagation()}>
            <div className="between" style={{ marginBottom: 16 }}>
              <div className="row">
                <Lock size={18} color="var(--accent-blue)" />
                <h2 style={{ fontSize: '1.22rem', fontWeight: 700 }}>
                  {authModal === 'login' ? 'Sign In to CareerForge' : 'Create Your Account'}
                </h2>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAuthModal(null)} aria-label="Close">
                <X size={15} />
              </button>
            </div>

            {authError && <div className="alert alert-error" style={{ marginBottom: 14 }}>{authError}</div>}

            <form onSubmit={handleAuthSubmit} className="form-grid">
              {authModal === 'register' && (
                <>
                  <div>
                    <label className="field-label">Full Name</label>
                    <input
                      className="input"
                      required
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="e.g. Rohan Mehta"
                    />
                  </div>
                  <div>
                    <label className="field-label">Account Role (RBAC)</label>
                    <select
                      className="select"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                    >
                      <option value="learner">Student / Fresh Graduate / Job Seeker</option>
                      <option value="educator">Educator / Instructor</option>
                      <option value="employer">Employer / Recruiter</option>
                      <option value="verifier">Certification Provider / Verifier</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Organization / University</label>
                    <input
                      className="input"
                      value={form.organization}
                      onChange={(e) => setForm({ ...form, organization: e.target.value })}
                      placeholder="e.g. NIT / CloudScale Systems"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="field-label">Email Address</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@careerforge.dev"
                />
              </div>

              <div>
                <label className="field-label">Password</label>
                <input
                  className="input"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={busy}>
                <ShieldCheck size={16} />
                {busy ? 'Authenticating...' : authModal === 'login' ? 'Sign In with JWT' : 'Create Account'}
              </button>
            </form>

            <div className="between" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
              <span className="muted" style={{ fontSize: '0.84rem' }}>
                {authModal === 'login' ? 'New to CareerForge?' : 'Already have an account?'}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setAuthError('');
                  setAuthModal(authModal === 'login' ? 'register' : 'login');
                }}
              >
                {authModal === 'login' ? 'Create Account' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
