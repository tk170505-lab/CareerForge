import React, { useEffect, useRef, useState } from 'react';
import { Award, CheckCircle2, Download, FileText, Search, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { apiFetch, getStoredToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { DashboardSkeleton, TiltGlassCard } from '../components/LiquidUI.jsx';

export default function CertificatesPage() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [certificates, setCertificates] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);

  const [verifyCode, setVerifyCode] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    issuer: '',
    issued_date: '2026-10-15',
    skill_id: '',
    file: null,
  });

  async function loadAll() {
    try {
      const [cRes, sRes] = await Promise.all([
        apiFetch('/api/certificates'),
        apiFetch('/api/skills'),
      ]);
      setCertificates(cRes.certificates || []);
      setSkills(sRes.skills || []);
      if (!form.skill_id && sRes.skills?.length > 0) {
        setForm((p) => ({ ...p, skill_id: String(sRes.skills[0].id) }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('issuer', form.issuer);
      fd.append('issued_date', form.issued_date);
      if (form.skill_id) fd.append('skill_id', form.skill_id);
      if (form.file) fd.append('file', form.file);

      const res = await apiFetch('/api/certificates', { method: 'POST', body: fd });
      setMessage(`Certificate uploaded! Verification Code: ${res.certificate.verification_code} (SHA-256 recorded)`);
      setForm((p) => ({ ...p, title: '', issuer: '', file: null }));
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function lookupCode(codeToCheck) {
    setVerifyResult(null);
    if (!codeToCheck.trim()) return;
    try {
      const res = await apiFetch(`/api/certificates/verify/${encodeURIComponent(codeToCheck.trim())}`);
      setVerifyResult(res);
    } catch (err) {
      setVerifyResult({ valid: false, error: err.message });
    }
  }

  async function handleLookup(e) {
    e.preventDefault();
    await lookupCode(verifyCode);
  }

  async function decide(certId, decision) {
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/certificates/${certId}/verify`, {
        method: 'PATCH',
        body: {
          decision,
          notes: decision === 'VERIFIED' ? 'Authenticated via CareerForge Trust Audit' : 'Issuer verification failed',
        },
      });
      setMessage(`Certificate #${certId} marked as ${decision}.`);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadFile(blobUrl, fileName) {
    const res = await fetch(blobUrl, {
      headers: { Authorization: `Bearer ${getStoredToken()}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setForm((p) => ({ ...p, file: dropped }));
  }

  if (loading) return <DashboardSkeleton />;

  const visibleCerts = certificates.filter((c) => statusFilter === 'ALL' || c.status === statusFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {/* Secure Verification Lookup & Audit History */}
      <div className="glass-panel-elevated">
        <div className="card-header">
          <div className="row">
            <ShieldCheck size={20} color="var(--accent-blue)" />
            <div>
              <h2 className="card-title">Cryptographic Certificate Verification</h2>
              <div className="muted" style={{ fontSize: '0.8rem' }}>
                Verify authenticity and inspect full verification audit history
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleLookup} className="row">
          <input
            className="input"
            style={{ flex: '1 1 240px' }}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            placeholder="Paste verification code e.g. CF-CERT-2026-8F4A19C2"
          />
          <button type="submit" className="btn btn-blue">
            <Search size={15} /> Verify Authenticity
          </button>
        </form>

        {verifyResult && (
          <div className={`alert ${verifyResult.valid ? 'alert-success' : 'alert-info'}`} style={{ marginTop: 14 }}>
            {verifyResult.certificate ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div className="between">
                  <div className="row">
                    <CheckCircle2 size={17} />
                    <strong>{verifyResult.certificate.certificate_title}</strong>
                  </div>
                  <span
                    className={`badge ${
                      verifyResult.certificate.status === 'VERIFIED'
                        ? 'badge-success'
                        : verifyResult.certificate.status === 'REJECTED'
                        ? 'badge-danger'
                        : 'badge-warning'
                    }`}
                  >
                    {verifyResult.certificate.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.84rem' }}>
                  Holder: <strong>{verifyResult.certificate.learner_name}</strong> · Issuer: {verifyResult.certificate.issuer} · Issued: {verifyResult.certificate.issued_date}
                </div>
                <div style={{ fontSize: '0.76rem', wordBreak: 'break-all' }}>
                  SHA-256 Digest: <code>{verifyResult.certificate.file_hash_sha256}</code>
                </div>
                {verifyResult.history?.length > 0 && (
                  <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid rgba(17,24,39,0.1)' }}>
                    <strong style={{ fontSize: '0.78rem' }}>Verification Audit Trail:</strong>
                    <div style={{ display: 'grid', gap: 4, marginTop: 4, fontSize: '0.78rem' }}>
                      {verifyResult.history.map((h, i) => (
                        <div key={i}>
                          • <strong>{h.decision}</strong> {h.verifier_name ? `by ${h.verifier_name}` : ''} — {h.notes} ({h.verified_at})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              verifyResult.error
            )}
          </div>
        )}
      </div>

      {/* Drag-and-Drop Certificate Upload for Learners */}
      {user.role === 'learner' && (
        <div className="glass-panel">
          <div className="card-header">
            <div className="row">
              <Upload size={18} color="var(--accent-blue)" />
              <h3 className="card-title">Upload Certificate (Azure Blob + SHA-256 Registry)</h3>
            </div>
          </div>

          <form onSubmit={handleUpload} className="grid-2">
            <div className="form-grid">
              <div>
                <label className="field-label">Certificate Title</label>
                <input
                  className="input"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Microsoft Certified: Azure Fundamentals"
                />
              </div>
              <div>
                <label className="field-label">Issuing Authority</label>
                <input
                  className="input"
                  required
                  value={form.issuer}
                  onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                  placeholder="e.g. Microsoft / Coursera / AWS"
                />
              </div>
              <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Issued Date</label>
                  <input
                    className="input"
                    type="date"
                    required
                    value={form.issued_date}
                    onChange={(e) => setForm({ ...form, issued_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Linked Skill</label>
                  <select
                    className="select"
                    value={form.skill_id}
                    onChange={(e) => setForm({ ...form, skill_id: e.target.value })}
                  >
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <div
                className={`dropzone ${dragging ? 'dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                  style={{ display: 'none' }}
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                />
                <FileText size={26} color="var(--accent-blue)" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  {form.file ? form.file.name : 'Drag & drop certificate file here, or click to browse'}
                </div>
                <div className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                  Supports PDF, PNG, JPG, TXT (max 5MB). Optional for instant verification receipt.
                </div>
              </div>

              <button type="submit" className="btn btn-primary">
                Upload &amp; Generate Verification Code
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Certificate Cards & Status Filtering */}
      <div className="glass-panel">
        <div className="card-header">
          <div className="row">
            <Award size={18} color="var(--accent-emerald)" />
            <h3 className="card-title">
              {user.role === 'learner' ? 'My Certificates' : 'Certificate Verification Registry'}
            </h3>
          </div>
          <div className="segmented-bar">
            {['ALL', 'VERIFIED', 'PENDING', 'REJECTED'].map((st) => (
              <button
                key={st}
                type="button"
                className={`segmented-pill ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          {visibleCerts.map((c) => {
            const statusColor =
              c.status === 'VERIFIED'
                ? 'var(--accent-emerald)'
                : c.status === 'REJECTED'
                ? 'var(--accent-rose)'
                : 'var(--accent-amber)';
            const badgeClass =
              c.status === 'VERIFIED'
                ? 'badge-success'
                : c.status === 'REJECTED'
                ? 'badge-danger'
                : 'badge-warning';

            return (
              <TiltGlassCard
                key={c.id}
                className="glass-panel-subtle"
                maxTilt={3}
                style={{ borderLeft: `4px solid ${statusColor}` }}
              >
                <div className="between" style={{ marginBottom: 8 }}>
                  <code>{c.verification_code}</code>
                  <span className={`badge ${badgeClass}`}>{c.status}</span>
                </div>

                <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{c.title}</h4>
                <div className="muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>
                  {c.issuer} · Issued {c.issued_date} {c.learner_name ? `· Holder: ${c.learner_name}` : ''}
                </div>

                {c.skill_name && (
                  <div style={{ marginTop: 8 }}>
                    <span className="badge badge-accent">Linked Skill: {c.skill_name}</span>
                  </div>
                )}

                <div className="muted" style={{ fontSize: '0.75rem', marginTop: 10, wordBreak: 'break-all' }}>
                  SHA-256: <code>{c.file_hash_sha256.slice(0, 24)}…</code>
                </div>

                <div className="row" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => downloadFile(c.blob_url, c.file_name)}
                  >
                    <Download size={13} /> Preview / Download
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setVerifyCode(c.verification_code);
                      lookupCode(c.verification_code);
                    }}
                  >
                    <Search size={13} /> Audit History
                  </button>
                  {['verifier', 'educator'].includes(user.role) && c.status === 'PENDING' && (
                    <>
                      <button type="button" className="btn btn-success btn-sm" onClick={() => decide(c.id, 'VERIFIED')}>
                        <CheckCircle2 size={13} /> Verify
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => decide(c.id, 'REJECTED')}>
                        <XCircle size={13} /> Reject
                      </button>
                    </>
                  )}
                </div>
              </TiltGlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
