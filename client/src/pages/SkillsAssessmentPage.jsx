import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Play, Sparkles, Target } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { DashboardSkeleton, TiltGlassCard } from '../components/LiquidUI.jsx';

export default function SkillsAssessmentPage({ onNavigate }) {
  const [catalog, setCatalog] = useState([]);
  const [mySkills, setMySkills] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [gapData, setGapData] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loading, setLoading] = useState(true);

  const [activeQuiz, setActiveQuiz] = useState(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);

  const [selfSkillId, setSelfSkillId] = useState('');
  const [selfLevel, setSelfLevel] = useState(3);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadAll(jobIdParam = selectedJobId) {
    try {
      const [catRes, myRes, assessRes, gapRes] = await Promise.all([
        apiFetch('/api/skills'),
        apiFetch('/api/skills/my'),
        apiFetch('/api/assessments'),
        apiFetch(`/api/skills/gap-analysis${jobIdParam ? `?jobId=${jobIdParam}` : ''}`),
      ]);
      setCatalog(catRes.skills || []);
      setMySkills(myRes.skills || []);
      setAssessments(assessRes.assessments || []);
      setGapData(gapRes);
      if (!selectedJobId && gapRes?.targetJob?.id) {
        setSelectedJobId(String(gapRes.targetJob.id));
      }
      if (!selfSkillId && catRes.skills?.length > 0) {
        setSelfSkillId(String(catRes.skills[0].id));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll('');
  }, []);

  async function handleJobChange(jobId) {
    setSelectedJobId(jobId);
    await loadAll(jobId);
  }

  async function startAssessment(id) {
    setError('');
    setQuizResult(null);
    setAnswers({});
    setQuestionIdx(0);
    try {
      const data = await apiFetch(`/api/assessments/${id}`);
      setActiveQuiz(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitQuiz(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch(`/api/assessments/${activeQuiz.assessment.id}/submit`, {
        method: 'POST',
        body: { answers },
      });
      setQuizResult(res);
      await loadAll(selectedJobId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveSelfSkill(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await apiFetch('/api/skills/my', {
        method: 'POST',
        body: { skill_id: Number(selfSkillId), proficiency_level: Number(selfLevel) },
      });
      setMessage('Skill proficiency saved and gap analysis refreshed.');
      await loadAll(selectedJobId);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <DashboardSkeleton />;

  const currentQuestion = activeQuiz?.questions?.[questionIdx] || null;
  const totalQuestions = activeQuiz?.questions?.length || 0;
  const answeredCount = activeQuiz ? Object.keys(answers).length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {/* Interactive Quiz Stage */}
      {activeQuiz && (
        <div className="glass-panel-elevated page-enter">
          <div className="card-header">
            <div>
              <span className="badge badge-accent" style={{ marginBottom: 6 }}>
                Interactive Assessment · {activeQuiz.assessment.skill_name}
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{activeQuiz.assessment.title}</h3>
              <div className="muted" style={{ fontSize: '0.82rem' }}>
                Pass threshold: {activeQuiz.assessment.pass_score}% · Progress: {answeredCount}/{totalQuestions} answered
              </div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveQuiz(null)}>
              Close Assessment
            </button>
          </div>

          <div className="progress-track" style={{ marginBottom: 18 }}>
            <div
              className="progress-fill"
              style={{ width: `${totalQuestions ? ((questionIdx + 1) / totalQuestions) * 100 : 0}%` }}
            />
          </div>

          {quizResult ? (
            <div className={`alert ${quizResult.passed ? 'alert-success' : 'alert-error'}`}>
              <div className="between">
                <div className="row">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong style={{ fontSize: '1rem' }}>
                      Score: {quizResult.score}% — {quizResult.passed ? 'Passed & Skill Verified' : 'Below Pass Threshold'}
                    </strong>
                    <div style={{ fontSize: '0.84rem' }}>
                      Awarded Proficiency Level: {quizResult.awardedLevel}/5 (saved to RDBMS)
                    </div>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveQuiz(null)}>
                  Done
                </button>
              </div>
            </div>
          ) : currentQuestion && (
            <form onSubmit={submitQuiz} style={{ display: 'grid', gap: 16 }}>
              <div className="glass-panel-subtle" style={{ padding: 20 }}>
                <div className="muted" style={{ fontSize: '0.76rem', fontWeight: 700, marginBottom: 8 }}>
                  QUESTION {questionIdx + 1} OF {totalQuestions}
                </div>
                <div style={{ fontSize: '1.04rem', fontWeight: 700, marginBottom: 14 }}>
                  {currentQuestion.question_text}
                </div>
                <div style={{ display: 'grid', gap: 9 }}>
                  {currentQuestion.options.map((opt, optIdx) => {
                    const selected = Number(answers[currentQuestion.id]) === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => setAnswers({ ...answers, [currentQuestion.id]: optIdx })}
                        className="glass-panel-subtle"
                        style={{
                          textAlign: 'left',
                          cursor: 'pointer',
                          padding: '12px 15px',
                          borderColor: selected ? 'var(--accent-blue)' : 'rgba(255,255,255,0.8)',
                          background: selected ? 'rgba(0, 113, 227, 0.1)' : 'rgba(255,255,255,0.72)',
                          fontWeight: selected ? 600 : 500,
                          color: 'var(--charcoal)',
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="between">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={questionIdx === 0}
                  onClick={() => setQuestionIdx((i) => Math.max(0, i - 1))}
                >
                  <ArrowLeft size={14} /> Previous
                </button>

                <div className="row">
                  {questionIdx < totalQuestions - 1 ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setQuestionIdx((i) => Math.min(totalQuestions - 1, i + 1))}
                    >
                      Next Question <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="btn btn-blue btn-sm"
                      disabled={answeredCount < totalQuestions}
                    >
                      Submit &amp; Grade Assessment
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Target Role Gap Comparison */}
      <div className="glass-panel-elevated">
        <div className="card-header">
          <div className="row">
            <Target size={19} color="var(--accent-blue)" />
            <div>
              <h2 className="card-title">Target Role Skill Gap Analysis</h2>
              <div className="muted" style={{ fontSize: '0.8rem' }}>
                Compare your current competencies against job requirements
              </div>
            </div>
          </div>

          {gapData?.allTargetJobs && (
            <select
              className="select"
              style={{ maxWidth: 330 }}
              value={selectedJobId}
              onChange={(e) => handleJobChange(e.target.value)}
            >
              {gapData.allTargetJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.company}
                </option>
              ))}
            </select>
          )}
        </div>

        {gapData && (
          <div className="grid-2">
            <div>
              <div className="between" style={{ marginBottom: 12 }}>
                <span className="muted" style={{ fontWeight: 600 }}>Target Role Match</span>
                <span className={`badge ${gapData.analysis.matchScore >= 75 ? 'badge-success' : 'badge-warning'}`}>
                  {gapData.analysis.matchScore}% · {gapData.analysis.readinessLabel}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {[...gapData.analysis.gaps, ...gapData.analysis.matchedSkills].map((sk) => {
                  const pct = Math.round((sk.current_level / 5) * 100);
                  const reqPct = Math.round((sk.required_level / 5) * 100);
                  return (
                    <div key={sk.skill_id} className="glass-panel-subtle">
                      <div className="between" style={{ marginBottom: 6 }}>
                        <div>
                          <strong style={{ fontSize: '0.9rem' }}>{sk.skill_name}</strong>
                          {sk.is_mandatory && (
                            <span className="badge badge-primary" style={{ marginLeft: 8 }}>Mandatory</span>
                          )}
                        </div>
                        <span className={`badge ${sk.gap_level === 0 ? 'badge-success' : 'badge-danger'}`}>
                          {sk.gap_level === 0 ? 'Requirement Met' : `Gap: -${sk.gap_level} lvl`}
                        </span>
                      </div>
                      <div className="muted" style={{ fontSize: '0.79rem', marginBottom: 6 }}>
                        Yours: {sk.current_level}/5 {sk.verified ? '(Verified)' : '(Unverified)'} · Target: {sk.required_level}/5
                      </div>
                      <div className="progress-track" style={{ position: 'relative' }}>
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                        <div
                          title={`Target level ${sk.required_level}/5`}
                          style={{
                            position: 'absolute',
                            left: `${reqPct}%`,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            background: 'var(--graphite)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="between" style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: '0.95rem' }}>Recommended Pathways to Close Gaps</strong>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('learning')}>
                  Open Learning Hub
                </button>
              </div>
              {gapData.recommendedCourses.length === 0 ? (
                <div className="alert alert-success">
                  All skill requirements for this role are currently met!
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {gapData.recommendedCourses.map((c) => (
                    <TiltGlassCard key={c.id} className="glass-panel-subtle" maxTilt={3}>
                      <div className="between" style={{ marginBottom: 6 }}>
                        <strong>{c.title}</strong>
                        <span className="badge badge-accent">{c.duration_hours}h</span>
                      </div>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        Upgrades: {c.addressesGaps.map((g) => `${g.skill_name} (→ Lvl ${g.target_level})`).join(', ')}
                      </div>
                    </TiltGlassCard>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assessments & Self-Assessment */}
      <div className="grid-2">
        <div className="glass-panel">
          <div className="card-header">
            <div className="row">
              <Sparkles size={17} color="var(--accent-blue)" />
              <h3 className="card-title">Verified Skill Assessments</h3>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {assessments.map((a) => (
              <div key={a.id} className="glass-panel-subtle between">
                <div>
                  <strong style={{ fontSize: '0.92rem' }}>{a.title}</strong>
                  <div className="muted" style={{ fontSize: '0.79rem', marginTop: 2 }}>
                    {a.skill_name} · {a.difficulty} · {a.question_count} questions
                  </div>
                  {a.userProgress && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 600, marginTop: 3 }}>
                      Best: {a.userProgress.best_score}% ({a.userProgress.ever_passed ? 'Passed' : 'Attempted'})
                    </div>
                  )}
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => startAssessment(a.id)}>
                  <Play size={13} /> {a.userProgress ? 'Retake' : 'Start'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel">
          <div className="card-header">
            <h3 className="card-title">Self-Rate Competency</h3>
          </div>
          <form onSubmit={saveSelfSkill} className="form-grid">
            <div>
              <label className="field-label">Select Skill</label>
              <select className="select" value={selfSkillId} onChange={(e) => setSelfSkillId(e.target.value)}>
                {catalog.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                ))}
              </select>
            </div>
            <div>
              <div className="between" style={{ marginBottom: 6 }}>
                <label className="field-label" style={{ marginBottom: 0 }}>Proficiency Level</label>
                <span className="badge badge-accent">Level {selfLevel} / 5</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={selfLevel}
                onChange={(e) => setSelfLevel(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
            </div>
            <button type="submit" className="btn btn-secondary">Save Skill Level</button>
          </form>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>Your Recorded Skills ({mySkills.length})</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {mySkills.map((sk) => (
                <div key={sk.id} className="between" style={{ fontSize: '0.84rem' }}>
                  <span>{sk.skill_name}</span>
                  <span className="muted">Lvl {sk.proficiency_level}/5 · {sk.verified ? 'Verified' : sk.source}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
