import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [error, setError] = useState('');
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

  const [verifyCode, setVerifyCode] = useState('CF-CERT-2026-8F4A19C2');
  const [verifyResult, setVerifyResult] = useState(null);

  useEffect(() => {
    apiFetch('/api/auth/demo-accounts')
      .then((d) => setDemoAccounts(d.accounts || []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDemoLogin(email) {
    setError('');
    setBusy(true);
    try {
      await login(email, 'Password123!');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePublicVerify(e) {
    e.preventDefault();
    setVerifyResult(null);
    try {
      const res = await apiFetch(`/api/certificates/verify/${encodeURIComponent(verifyCode.trim())}`);
      setVerifyResult(res);
    } catch (err) {
      setVerifyResult({ valid: false, error: err.message });
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="row">
            <div className="brand-mark" style={{ width: 44, height: 44, fontSize: '1.1rem' }}>CF</div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>CareerForge</h1>
              <p className="muted">Bridge the Skill Gap · Verify Credentials · Match Verified Talent</p>
            </div>
          </div>

          <div className="card">
            <div className="row" style={{ marginBottom: 10 }}>
              <Sparkles size={18} color="#67e8f9" />
              <strong>1-Click Demo Role Access</strong>
              <span className="badge badge-muted">Password: Password123!</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {demoAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  className="btn btn-secondary between"
                  style={{ width: '100%', justifyContent: 'space-between', textAlign: 'left' }}
                  disabled={busy}
                  onClick={() => handleDemoLogin(acc.email)}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{acc.full_name}</div>
                    <div className="muted" style={{ fontSize: '0.78rem' }}>{acc.email}</div>
                  </div>
                  <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{acc.role}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="row" style={{ marginBottom: 10 }}>
              <Award size={18} color="#6ee7b7" />
              <strong>Public Certificate Authenticity Check</strong>
            </div>
            <form onSubmit={handlePublicVerify} className="row">
              <input
                className="input"
                style={{ flex: 1 }}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="Enter CF-CERT-YYYY-XXXXXXXX"
              />
              <button type="submit" className="btn btn-secondary">Verify</button>
            </form>
            {verifyResult && (
              <div className={`alert ${verifyResult.valid ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 10 }}>
                {verifyResult.certificate ? (
                  <div>
                    <div className="row">
                      <CheckCircle2 size={16} />
                      <strong>{verifyResult.certificate.certificate_title}</strong>
                      <span className="badge badge-success">{verifyResult.certificate.status}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                      Holder: {verifyResult.certificate.learner_name} · Issuer: {verifyResult.certificate.issuer}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: 2, wordBreak: 'break-all' }}>
                      SHA-256: {verifyResult.certificate.file_hash_sha256}
                    </div>
                  </div>
                ) : (
                  verifyResult.error
                )}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="between" style={{ marginBottom: 18 }}>
            <div className="row">
              <Lock size={18} color="#a5b4fc" />
              <h2 style={{ fontSize: '1.2rem' }}>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
            >
              {mode === 'login' ? 'Need an account?' : 'Back to Sign In'}
            </button>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}

          <form onSubmit={handleSubmit} className="form-grid">
            {mode === 'register' && (
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
                    <option value="learner">Student / Job Seeker (Learner)</option>
                    <option value="educator">Educator / Instructor</option>
                    <option value="employer">Employer / Recruiter</option>
                    <option value="verifier">Certificate Verifier</option>
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
              {busy ? 'Authenticating...' : mode === 'login' ? 'Sign In with JWT' : 'Register & Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
