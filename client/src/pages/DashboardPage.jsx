import React, { useEffect, useState } from 'react';
import { Award, BookOpen, Briefcase, Download, Sparkles, Target, TrendingUp } from 'lucide-react';
import { apiFetch, getStoredToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatCard from '../components/StatCard.jsx';
import { DashboardSkeleton, TiltGlassCard } from '../components/LiquidUI.jsx';
import {
  CertificateDonutChart,
  ReadinessGauge,
  SkillDemandSupplyChart,
  SkillProficiencyChart,
} from '../components/SimpleCharts.jsx';

export default function DashboardPage({ onNavigate }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/analytics/dashboard')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  async function downloadPowerBiCsv() {
    const res = await fetch('/api/analytics/powerbi-feed?format=csv', {
      headers: { Authorization: `Bearer ${getStoredToken()}` },
    });
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'careerforge-powerbi-skills.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <DashboardSkeleton />;

  const overview = data.platform?.overview || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Personalized Welcome Banner */}
      <div className="glass-panel-elevated between">
        <div>
          <span className="eyebrow" style={{ marginBottom: 10 }}>
            <Sparkles size={13} color="var(--accent-blue)" />
            <span style={{ textTransform: 'capitalize' }}>{user.role} Command Center</span>
          </span>
          <h2 style={{ fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
            Welcome back, {user.full_name}
          </h2>
          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 3 }}>
            {user.target_role
              ? `Target Career Path: ${user.target_role}`
              : user.headline || 'Real-time overview of skills, learning progress, verification trust, and talent demand.'}
          </p>
        </div>

        <div className="row">
          {user.role === 'learner' && (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('skills')}>
                <Target size={14} /> Run Gap Analysis
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('jobs')}>
                <Briefcase size={14} /> Explore Matches
              </button>
            </>
          )}
          {user.role === 'educator' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('learning')}>
              <BookOpen size={14} /> Publish Course
            </button>
          )}
          {user.role === 'employer' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('jobs')}>
              <Briefcase size={14} /> Manage Requisitions
            </button>
          )}
          {user.role === 'verifier' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('certificates')}>
              <Award size={14} /> Open Verification Queue
            </button>
          )}
        </div>
      </div>

      {data.role === 'learner' && (
        <>
          <div className="grid-2">
            <TiltGlassCard className="glass-panel-elevated" maxTilt={3}>
              <ReadinessGauge score={data.employabilityReadiness} />
            </TiltGlassCard>

            <div className="grid-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <StatCard
                label="Verified Skills"
                value={`${data.summary.verifiedSkills} / ${data.summary.totalSkills}`}
                subtitle="Assessments & certificates"
                icon={Target}
              />
              <StatCard
                label="Top Job Match"
                value={data.summary.topJobMatchScore}
                suffix="%"
                subtitle="Live algorithmic match"
                icon={TrendingUp}
              />
              <StatCard
                label="Courses Completed"
                value={`${data.summary.completedCourses} / ${data.summary.enrolledCourses}`}
                subtitle="Active learning paths"
                icon={BookOpen}
              />
              <StatCard
                label="Verified Certs"
                value={data.summary.verifiedCertificates}
                subtitle={`${data.summary.pendingCertificates} pending review`}
                icon={Award}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="glass-panel">
              <div className="card-header">
                <h3 className="card-title">Recommended Jobs &amp; Match Scores</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('jobs')}>
                  View All
                </button>
              </div>
              <div style={{ display: 'grid', gap: 14 }}>
                {data.topJobMatches.map((job) => (
                  <div key={job.jobId} className="glass-panel-subtle">
                    <div className="between" style={{ marginBottom: 8 }}>
                      <div>
                        <strong style={{ fontSize: '0.95rem' }}>{job.title}</strong>
                        <div className="muted" style={{ fontSize: '0.79rem' }}>{job.company}</div>
                      </div>
                      <span className={`badge ${job.matchScore >= 75 ? 'badge-success' : 'badge-warning'}`}>
                        {job.matchScore}% Match · {job.gapCount} gaps
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${job.matchScore}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel">
              <div className="card-header">
                <h3 className="card-title">Skills Proficiency Overview</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('skills')}>
                  Assess Skills
                </button>
              </div>
              <SkillProficiencyChart skills={data.userSkills} />
            </div>
          </div>

          <div className="grid-2">
            <div className="glass-panel">
              <div className="card-header">
                <h3 className="card-title">Learning Progress</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('learning')}>
                  All Courses
                </button>
              </div>
              {data.recentEnrollments.length === 0 ? (
                <p className="muted" style={{ fontSize: '0.88rem' }}>No course enrollments yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.recentEnrollments.map((en) => (
                    <div key={en.id} className="glass-panel-subtle">
                      <div className="between" style={{ marginBottom: 6 }}>
                        <strong style={{ fontSize: '0.9rem' }}>{en.title}</strong>
                        <span className={`badge ${en.status === 'completed' ? 'badge-success' : 'badge-accent'}`}>
                          {en.progress_percent}% · {en.status}
                        </span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${en.progress_percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel">
              <div className="card-header">
                <h3 className="card-title">Recent Applications</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('jobs')}>
                  Track Status
                </button>
              </div>
              {data.recentApplications.length === 0 ? (
                <p className="muted" style={{ fontSize: '0.88rem' }}>You have not applied to any roles yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.recentApplications.map((app) => (
                    <div key={app.id} className="glass-panel-subtle between">
                      <div>
                        <strong style={{ fontSize: '0.9rem' }}>{app.job_title}</strong>
                        <div className="muted" style={{ fontSize: '0.78rem' }}>{app.company} · {app.location}</div>
                      </div>
                      <div className="row">
                        <span className="badge badge-accent">{app.match_score}%</span>
                        <span className="badge badge-primary">{app.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {data.role === 'educator' && (
        <div className="glass-panel">
          <div className="card-header">
            <h3 className="card-title">Your Published Courses &amp; Completion Impact</h3>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('learning')}>
              Manage Courses
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Difficulty</th>
                  <th>Enrolled</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {data.myCourses.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.title}</strong></td>
                    <td><span className="badge badge-muted">{c.difficulty}</span></td>
                    <td>{c.enrolled_count}</td>
                    <td>{c.completed_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.role === 'employer' && (
        <div className="glass-panel">
          <div className="card-header">
            <h3 className="card-title">Your Open Requisitions &amp; Candidate Pipeline</h3>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('jobs')}>
              Inspect Applicants
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Applicants</th>
                  <th>Avg Match Score</th>
                </tr>
              </thead>
              <tbody>
                {data.myJobs.map((j) => (
                  <tr key={j.id}>
                    <td><strong>{j.title}</strong></td>
                    <td>{j.location}</td>
                    <td>{j.applicant_count}</td>
                    <td>{j.avg_match_score ? <span className="badge badge-success">{j.avg_match_score}%</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.role === 'verifier' && (
        <div className="glass-panel">
          <div className="card-header">
            <h3 className="card-title">Pending Verification Queue ({data.pendingQueue.length})</h3>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('certificates')}>
              Audit Certificates
            </button>
          </div>
          {data.pendingQueue.length === 0 ? (
            <p className="muted">All submitted certificates have been audited.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Certificate</th>
                    <th>Learner</th>
                    <th>Issuer</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingQueue.map((c) => (
                    <tr key={c.certificate_id}>
                      <td><code>{c.verification_code}</code></td>
                      <td>{c.certificate_title}</td>
                      <td>{c.learner_name}</td>
                      <td>{c.issuer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Platform KPIs */}
      <div className="grid-4">
        <StatCard label="Platform Learners" value={overview.total_learners ?? 0} subtitle="Active students & job seekers" />
        <StatCard label="Verified Certificates" value={overview.verified_certificates ?? 0} subtitle="SHA-256 & auditor verified" />
        <StatCard label="Completed Courses" value={overview.completed_enrollments ?? 0} subtitle="Across educator pathways" />
        <StatCard label="Open Job Roles" value={overview.open_jobs ?? 0} subtitle={`${overview.total_applications ?? 0} applications`} />
      </div>

      {/* Power BI Analytics Row */}
      <div className="grid-2">
        <div className="glass-panel">
          <div className="card-header">
            <div>
              <h3 className="card-title">Skill Demand vs. Verified Supply</h3>
              <div className="muted" style={{ fontSize: '0.8rem' }}>
                SQL Views: <code>vw_analytics_overview</code>, <code>vw_learner_skill_gaps</code>
              </div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={downloadPowerBiCsv}>
              <Download size={14} /> Export Power BI CSV
            </button>
          </div>
          <SkillDemandSupplyChart data={data.platform?.skillDemandVsSupply || []} />
        </div>

        <div className="glass-panel">
          <div className="card-header">
            <div>
              <h3 className="card-title">Certificate Verification &amp; Funnel</h3>
              <div className="muted" style={{ fontSize: '0.8rem' }}>
                Hover segments to inspect real-time verification counts
              </div>
            </div>
          </div>
          <CertificateDonutChart breakdown={data.platform?.certificateBreakdown || []} />
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>Application Pipeline Funnel</div>
            <div className="row">
              {(data.platform?.applicationFunnel || []).map((row) => (
                <span key={row.status} className="badge badge-primary">
                  {row.status}: {row.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
