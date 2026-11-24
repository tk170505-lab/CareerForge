import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, Plus, Search, Sparkles } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { DashboardSkeleton, TiltGlassCard } from '../components/LiquidUI.jsx';

export default function LearningPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [newCourse, setNewCourse] = useState({
    title: '',
    provider: user?.organization || 'CareerForge Academy',
    description: '',
    difficulty: 'Intermediate',
    duration_hours: 10,
    resource_url: '',
    skill_id: '',
    target_level: 4,
  });

  async function loadData() {
    try {
      const [cRes, sRes] = await Promise.all([
        apiFetch('/api/learning/courses'),
        apiFetch('/api/skills'),
      ]);
      setCourses(cRes.courses || []);
      setSkills(sRes.skills || []);
      if (!newCourse.skill_id && sRes.skills?.length > 0) {
        setNewCourse((prev) => ({ ...prev, skill_id: String(sRes.skills[0].id) }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function enroll(courseId) {
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/learning/enroll', {
        method: 'POST',
        body: { course_id: courseId },
      });
      setMessage('Enrolled in learning pathway.');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function completeCourse(courseId) {
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/learning/courses/${courseId}/complete`, { method: 'POST' });
      setMessage('Course completed! Linked skill proficiencies upgraded in RDBMS transaction.');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createCourse(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/learning/courses', {
        method: 'POST',
        body: {
          title: newCourse.title,
          provider: newCourse.provider,
          description: newCourse.description,
          difficulty: newCourse.difficulty,
          duration_hours: Number(newCourse.duration_hours),
          resource_url: newCourse.resource_url,
          skills: newCourse.skill_id
            ? [{ skill_id: Number(newCourse.skill_id), target_level: Number(newCourse.target_level) }]
            : [],
        },
      });
      setMessage('Course published to the learning catalog.');
      setNewCourse((p) => ({ ...p, title: '', description: '', resource_url: '' }));
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <DashboardSkeleton />;

  const filtered = courses.filter((c) => {
    const matchesSearch =
      !query.trim() ||
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'Recommended') return c.relevanceScore > 0;
    if (filter === 'All') return true;
    return c.difficulty === filter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {/* Filter & Search Bar */}
      <div className="glass-panel between">
        <div className="segmented-bar">
          {['All', 'Recommended', 'Beginner', 'Intermediate', 'Advanced'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`segmented-pill ${filter === tab ? 'active' : ''}`}
              onClick={() => setFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="row" style={{ minWidth: 260, flex: '0 1 320px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Search courses or skills..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Educator Course Publisher */}
      {user.role === 'educator' && (
        <div className="glass-panel-elevated">
          <div className="card-header">
            <div className="row">
              <Plus size={18} color="var(--accent-blue)" />
              <h2 className="card-title">Publish Educator-Led Course</h2>
            </div>
          </div>
          <form onSubmit={createCourse} className="grid-2">
            <div className="form-grid">
              <div>
                <label className="field-label">Course Title</label>
                <input
                  className="input"
                  required
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  placeholder="e.g. Azure SQL Indexing & Query Tuning"
                />
              </div>
              <div>
                <label className="field-label">Description</label>
                <textarea
                  className="textarea"
                  rows={3}
                  required
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  placeholder="Learning outcomes and hands-on labs..."
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Difficulty</label>
                  <select
                    className="select"
                    value={newCourse.difficulty}
                    onChange={(e) => setNewCourse({ ...newCourse, difficulty: e.target.value })}
                  >
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Duration (Hours)</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={newCourse.duration_hours}
                    onChange={(e) => setNewCourse({ ...newCourse, duration_hours: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Primary Skill Taught</label>
                  <select
                    className="select"
                    value={newCourse.skill_id}
                    onChange={(e) => setNewCourse({ ...newCourse, skill_id: e.target.value })}
                  >
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Target Lvl</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={5}
                    value={newCourse.target_level}
                    onChange={(e) => setNewCourse({ ...newCourse, target_level: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">Publish Course</button>
            </div>
          </form>
        </div>
      )}

      {/* Course Cards */}
      <div className="grid-3">
        {filtered.map((course) => {
          const isCompleted = course.enrollment?.status === 'completed';
          const isEnrolled = Boolean(course.enrollment);
          const initials = (course.educator_name || 'CF')
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2);

          return (
            <TiltGlassCard key={course.id} className="glass-panel" maxTilt={4}>
              {/* Visual Course Preview Header */}
              <div
                style={{
                  borderRadius: 14,
                  padding: '14px 16px',
                  marginBottom: 14,
                  background:
                    course.difficulty === 'Advanced'
                      ? 'linear-gradient(135deg, rgba(17,19,23,0.9), rgba(30,41,59,0.85))'
                      : 'linear-gradient(135deg, rgba(0,113,227,0.12), rgba(5,150,105,0.12))',
                  color: course.difficulty === 'Advanced' ? '#ffffff' : 'var(--graphite)',
                }}
              >
                <div className="between">
                  <span
                    className="badge"
                    style={{
                      background: course.difficulty === 'Advanced' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.85)',
                      color: course.difficulty === 'Advanced' ? '#ffffff' : 'var(--graphite)',
                    }}
                  >
                    {course.difficulty}
                  </span>
                  <span className="row" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                    <Clock size={13} /> {course.duration_hours} hrs
                  </span>
                </div>
                {course.relevanceScore > 0 && (
                  <div className="row" style={{ marginTop: 10, fontSize: '0.76rem', fontWeight: 700 }}>
                    <Sparkles size={13} /> Recommended for your skill gaps
                  </div>
                )}
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 6 }}>{course.title}</h3>
              <p className="muted" style={{ fontSize: '0.86rem', flex: 1, marginBottom: 14 }}>
                {course.description}
              </p>

              <div className="row" style={{ marginBottom: 14 }}>
                {(course.skills || []).map((sk) => (
                  <span key={sk.skill_id} className="badge badge-muted">
                    {sk.skill_name} · Lvl {sk.target_level}
                  </span>
                ))}
              </div>

              <div className="between" style={{ paddingTop: 12, borderTop: '1px solid var(--hairline)', marginBottom: user.role === 'learner' ? 12 : 0 }}>
                <div className="row">
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 99,
                      background: 'rgba(17,24,39,0.08)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    {initials}
                  </span>
                  <div style={{ fontSize: '0.78rem' }}>
                    <div style={{ fontWeight: 600 }}>{course.educator_name}</div>
                    <div className="muted">{course.provider}</div>
                  </div>
                </div>
              </div>

              {user.role === 'learner' && (
                <div>
                  {isCompleted ? (
                    <div className="badge badge-success" style={{ padding: '7px 12px' }}>
                      <CheckCircle2 size={14} /> Completed (100%)
                    </div>
                  ) : isEnrolled ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${course.enrollment.progress_percent}%` }} />
                      </div>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => completeCourse(course.id)}
                      >
                        <CheckCircle2 size={14} /> Complete &amp; Upgrade Skills
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => enroll(course.id)}
                    >
                      <BookOpen size={14} /> Enroll in Pathway
                    </button>
                  )}
                </div>
              )}
            </TiltGlassCard>
          );
        })}
      </div>
    </div>
  );
}
