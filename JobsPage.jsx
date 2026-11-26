import React, { useEffect, useState } from 'react';
import { Briefcase, Building2, CheckCircle2, MapPin, Plus, Search, Users } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { DashboardSkeleton, TiltGlassCard } from '../components/LiquidUI.jsx';

export default function JobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [skills, setSkills] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [minMatch, setMinMatch] = useState(0);

  const [selectedJobApplicants, setSelectedJobApplicants] = useState(null);
  const [coverNotes, setCoverNotes] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [newJob, setNewJob] = useState({
    title: '',
    company: user?.organization || 'CloudScale Systems Pvt Ltd',
    location: 'Bengaluru / Hybrid',
    employment_type: 'Full-time',
    salary_range: '₹10L – ₹15L / yr',
    description: '',
    skill_id: '',
    required_level: 4,
  });

  async function loadAll() {
    try {
      const [jobsRes, skillsRes] = await Promise.all([
        apiFetch('/api/jobs'),
        apiFetch('/api/skills'),
      ]);
      setJobs(jobsRes.jobs || []);
      setSkills(skillsRes.skills || []);
      if (!newJob.skill_id && skillsRes.skills?.length > 0) {
        setNewJob((p) => ({ ...p, skill_id: String(skillsRes.skills[0].id) }));
      }
      if (user.role === 'learner') {
        const appsRes = await apiFetch('/api/jobs/my/applications');
        setMyApps(appsRes.applications || []);
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

  async function applyToJob(jobId) {
    setError('');
    setMessage('');
    try {
      const res = await apiFetch(`/api/jobs/${jobId}/apply`, {
        method: 'POST',
        body: { cover_note: coverNotes[jobId] || '' },
      });
      setMessage(`Application submitted with ${res.match.matchScore}% verified skill match!`);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createJob(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/jobs', {
        method: 'POST',
        body: {
          title: newJob.title,
          company: newJob.company,
          location: newJob.location,
          employment_type: newJob.employment_type,
          salary_range: newJob.salary_range,
          description: newJob.description,
          skills: newJob.skill_id
            ? [{ skill_id: Number(newJob.skill_id), required_level: Number(newJob.required_level), is_mandatory: true }]
            : [],
        },
      });
      setMessage('Job requisition published and matched against learner profiles.');
      setNewJob((p) => ({ ...p, title: '', description: '' }));
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function viewApplicants(jobId) {
    setError('');
    try {
      const res = await apiFetch(`/api/jobs/${jobId}/applicants`);
      setSelectedJobApplicants(res);
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateAppStatus(appId, status) {
    setError('');
    try {
      await apiFetch(`/api/jobs/applications/${appId}/status`, {
        method: 'PATCH',
        body: { status },
      });
      if (selectedJobApplicants?.job?.id) {
        await viewApplicants(selectedJobApplicants.job.id);
      }
      setMessage(`Updated candidate status to ${status} (audit trigger logged).`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <DashboardSkeleton />;

  const filteredJobs = jobs.filter((job) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesText =
      !q ||
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q) ||
      (job.requiredSkills || []).some((s) => s.skill_name.toLowerCase().includes(q));
    if (!matchesText) return false;
    if (user.role === 'learner' && job.match) {
      return job.match.matchScore >= minMatch;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {/* Search & Match Filter Bar */}
      <div className="glass-panel between">
        <div className="row" style={{ flex: '1 1 300px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            className="input"
            style={{ flex: 1, maxWidth: 420 }}
            placeholder="Search by job title, company, location, or skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {user.role === 'learner' && (
          <div className="segmented-bar">
            {[
              { label: 'All Matches', val: 0 },
              { label: '50%+ Match', val: 50 },
              { label: '75%+ Match', val: 75 },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                className={`segmented-pill ${minMatch === opt.val ? 'active' : ''}`}
                onClick={() => setMinMatch(opt.val)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Employer Job Publisher */}
      {user.role === 'employer' && (
        <div className="glass-panel-elevated">
          <div className="card-header">
            <div className="row">
              <Plus size={18} color="var(--accent-blue)" />
              <h2 className="card-title">Post New Job Requisition</h2>
            </div>
          </div>
          <form onSubmit={createJob} className="grid-2">
            <div className="form-grid">
              <div>
                <label className="field-label">Job Title</label>
                <input
                  className="input"
                  required
                  value={newJob.title}
                  onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                  placeholder="e.g. Cloud Data Platform Engineer"
                />
              </div>
              <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Company</label>
                  <input
                    className="input"
                    required
                    value={newJob.company}
                    onChange={(e) => setNewJob({ ...newJob, company: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Location</label>
                  <input
                    className="input"
                    required
                    value={newJob.location}
                    onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Role Description</label>
                <textarea
                  className="textarea"
                  rows={3}
                  required
                  value={newJob.description}
                  onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                  placeholder="Responsibilities, stack, and Azure/RDBMS expectations..."
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Employment Type</label>
                  <input
                    className="input"
                    value={newJob.employment_type}
                    onChange={(e) => setNewJob({ ...newJob, employment_type: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Compensation Range</label>
                  <input
                    className="input"
                    value={newJob.salary_range}
                    onChange={(e) => setNewJob({ ...newJob, salary_range: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Core Mandatory Skill</label>
                  <select
                    className="select"
                    value={newJob.skill_id}
                    onChange={(e) => setNewJob({ ...newJob, skill_id: e.target.value })}
                  >
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Min Level</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={5}
                    value={newJob.required_level}
                    onChange={(e) => setNewJob({ ...newJob, required_level: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">Publish Job Role</button>
            </div>
          </form>
        </div>
      )}

      {/* Ranked Applicants Drawer/Panel */}
      {selectedJobApplicants && (
        <div className="glass-panel-elevated page-enter">
          <div className="card-header">
            <div>
              <h3 className="card-title">Ranked Applicants — {selectedJobApplicants.job.title}</h3>
              <div className="muted" style={{ fontSize: '0.82rem' }}>
                Sorted by Skill Match % and Verified Certificates
              </div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedJobApplicants(null)}>
              Close
            </button>
          </div>
          {selectedJobApplicants.applicants.length === 0 ? (
            <p className="muted">No candidates have applied yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Match Score</th>
                    <th>Verified Trust</th>
                    <th>Status</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedJobApplicants.applicants.map((app) => (
                    <tr key={app.id}>
                      <td>
                        <strong>{app.full_name}</strong>
                        <div className="muted" style={{ fontSize: '0.78rem' }}>{app.email} · {app.headline}</div>
                      </td>
                      <td>
                        <span className="badge badge-success">{app.match_score}%</span>
                      </td>
                      <td className="muted">
                        {app.verified_skills_count} verified skills · {app.verified_certs_count} verified certs
                      </td>
                      <td>
                        <span className="badge badge-primary">{app.status}</span>
                      </td>
                      <td>
                        <select
                          className="select"
                          style={{ maxWidth: 160 }}
                          value={app.status}
                          onChange={(e) => updateAppStatus(app.id, e.target.value)}
                        >
                          <option value="APPLIED">APPLIED</option>
                          <option value="SHORTLISTED">SHORTLISTED</option>
                          <option value="INTERVIEW">INTERVIEW</option>
                          <option value="OFFERED">OFFERED</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Job Matching Cards */}
      <div className="grid-2">
        {filteredJobs.map((job) => {
          const matchedIds = new Set((job.match?.matchedSkills || []).map((m) => m.skill_id));
          return (
            <TiltGlassCard key={job.id} className="glass-panel" maxTilt={3}>
              <div className="between" style={{ marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 700 }}>{job.title}</h3>
                  <div className="row muted" style={{ fontSize: '0.81rem', marginTop: 3 }}>
                    <span className="row" style={{ gap: 4 }}><Building2 size={13} /> {job.company}</span>
                    <span className="row" style={{ gap: 4 }}><MapPin size={13} /> {job.location}</span>
                    <span>{job.salary_range || job.employment_type}</span>
                  </div>
                </div>
                {job.match && (
                  <span className={`badge ${job.match.matchScore >= 75 ? 'badge-success' : 'badge-warning'}`}>
                    {job.match.matchScore}% Match
                  </span>
                )}
              </div>

              <p className="muted" style={{ fontSize: '0.88rem', marginBottom: 14, flex: 1 }}>
                {job.description}
              </p>

              {/* Required vs. Possessed Skill Matrix */}
              <div style={{ marginBottom: 14 }}>
                <div className="stat-label" style={{ marginBottom: 6 }}>
                  Required vs. Your Skills
                </div>
                <div className="row">
                  {(job.requiredSkills || []).map((req) => {
                    const isMet = matchedIds.has(req.skill_id);
                    const gapInfo = job.match?.gaps?.find((g) => g.skill_id === req.skill_id);
                    const label = job.match
                      ? isMet
                        ? `${req.skill_name} ✓`
                        : `${req.skill_name} (${gapInfo?.current_level ?? 0}/${req.required_level})`
                      : `${req.skill_name} ≥ ${req.required_level}/5`;

                    return (
                      <span
                        key={req.skill_id}
                        className={`badge ${
                          job.match ? (isMet ? 'badge-success' : 'badge-warning') : 'badge-muted'
                        }`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {user.role === 'learner' && (
                job.myApplication ? (
                  <div className="badge badge-success" style={{ alignSelf: 'flex-start', padding: '7px 13px' }}>
                    <CheckCircle2 size={14} /> Applied · Status: {job.myApplication.status}
                  </div>
                ) : (
                  <div className="row" style={{ marginTop: 4 }}>
                    <input
                      className="input"
                      style={{ flex: '1 1 220px' }}
                      placeholder="Optional short cover note..."
                      value={coverNotes[job.id] || ''}
                      onChange={(e) => setCoverNotes({ ...coverNotes, [job.id]: e.target.value })}
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => applyToJob(job.id)}>
                      <Briefcase size={14} /> Apply Now
                    </button>
                  </div>
                )
              )}

              {user.role === 'employer' && job.employer_id === user.id && (
                <div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => viewApplicants(job.id)}>
                    <Users size={14} /> View Ranked Applicants
                  </button>
                </div>
              )}
            </TiltGlassCard>
          );
        })}
      </div>

      {user.role === 'learner' && myApps.length > 0 && (
        <div className="glass-panel">
          <div className="card-header">
            <h3 className="card-title">My Job Applications</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Match Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {myApps.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.job_title}</strong></td>
                    <td>{a.company}</td>
                    <td><span className="badge badge-accent">{a.match_score}%</span></td>
                    <td><span className="badge badge-primary">{a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
