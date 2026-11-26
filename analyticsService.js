import { queryAll, queryOne } from '../config/db.js';
import { cache } from '../utils/cache.js';
import { buildUserSkillMap, computeJobMatch } from './matchingService.js';

export function getPlatformOverview() {
  const cached = cache.get('analytics:overview');
  if (cached) return cached;

  const overview = queryOne('SELECT * FROM vw_analytics_overview');
  const skillDemandVsSupply = queryAll(`
    SELECT
      s.id AS skill_id,
      s.name AS skill_name,
      s.category,
      COUNT(DISTINCT js.job_id) AS job_demand_count,
      COUNT(DISTINCT us.user_id) AS learner_supply_count,
      SUM(CASE WHEN us.verified = 1 THEN 1 ELSE 0 END) AS verified_learner_count,
      ROUND(AVG(COALESCE(us.proficiency_level, 0)), 2) AS avg_proficiency
    FROM skills s
    LEFT JOIN job_skills js ON js.skill_id = s.id
    LEFT JOIN user_skills us ON us.skill_id = s.id
    GROUP BY s.id, s.name, s.category
    ORDER BY job_demand_count DESC, learner_supply_count DESC
  `);

  const certificateBreakdown = queryAll(`
    SELECT status, COUNT(*) AS count
    FROM certificates
    GROUP BY status
  `);

  const applicationFunnel = queryAll(`
    SELECT status, COUNT(*) AS count
    FROM applications
    GROUP BY status
  `);

  const result = {
    overview,
    skillDemandVsSupply,
    certificateBreakdown,
    applicationFunnel,
  };

  return cache.set('analytics:overview', result, 20_000);
}

export function getUserDashboard(user) {
  const platform = getPlatformOverview();

  if (user.role === 'learner') {
    const userSkills = queryAll(
      `SELECT us.*, s.name AS skill_name, s.category
       FROM user_skills us
       JOIN skills s ON s.id = us.skill_id
       WHERE us.user_id = ?
       ORDER BY us.proficiency_level DESC`,
      user.id
    );

    const enrollments = queryAll(
      `SELECT e.*, c.title, c.provider, c.difficulty, c.duration_hours
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = ?
       ORDER BY e.enrolled_at DESC`,
      user.id
    );

    const certificates = queryAll(
      `SELECT c.*, s.name AS skill_name
       FROM certificates c
       LEFT JOIN skills s ON s.id = c.skill_id
       WHERE c.user_id = ?
       ORDER BY c.uploaded_at DESC`,
      user.id
    );

    const applications = queryAll(
      `SELECT a.*, j.title AS job_title, j.company, j.location
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE a.user_id = ?
       ORDER BY a.applied_at DESC`,
      user.id
    );

    const openJobs = queryAll(`SELECT * FROM jobs WHERE is_open = 1`);
    const jobSkills = queryAll(
      `SELECT js.*, s.name AS skill_name, s.category
       FROM job_skills js
       JOIN skills s ON s.id = js.skill_id`
    );

    const skillMap = buildUserSkillMap(userSkills);
    const jobMatches = openJobs.map((job) => {
      const reqs = jobSkills.filter((js) => js.job_id === job.id);
      const match = computeJobMatch(skillMap, reqs);
      return {
        jobId: job.id,
        title: job.title,
        company: job.company,
        matchScore: match.matchScore,
        readinessLabel: match.readinessLabel,
        gapCount: match.gaps.length,
      };
    });
    jobMatches.sort((a, b) => b.matchScore - a.matchScore);

    const bestJobMatch = jobMatches.length > 0 ? jobMatches[0].matchScore : 0;
    const completedCourses = enrollments.filter((e) => e.status === 'completed').length;
    const verifiedCerts = certificates.filter((c) => c.status === 'VERIFIED').length;
    const verifiedSkills = userSkills.filter((s) => s.verified === 1).length;

    const skillScore = Math.min(100, userSkills.length * 10 + verifiedSkills * 10);
    const learningScore = enrollments.length === 0 ? 20 : Math.round((completedCourses / enrollments.length) * 100);
    const certScore = Math.min(100, verifiedCerts * 35);
    const employabilityReadiness = Math.round(
      bestJobMatch * 0.45 + skillScore * 0.25 + learningScore * 0.15 + certScore * 0.15
    );

    return {
      role: user.role,
      employabilityReadiness,
      summary: {
        totalSkills: userSkills.length,
        verifiedSkills,
        enrolledCourses: enrollments.length,
        completedCourses,
        verifiedCertificates: verifiedCerts,
        pendingCertificates: certificates.filter((c) => c.status === 'PENDING').length,
        applicationsSubmitted: applications.length,
        topJobMatchScore: bestJobMatch,
      },
      userSkills,
      topJobMatches: jobMatches.slice(0, 4),
      recentEnrollments: enrollments.slice(0, 4),
      recentApplications: applications.slice(0, 4),
      platform,
    };
  }

  if (user.role === 'educator') {
    const myCourses = queryAll(
      `SELECT c.*,
              COUNT(DISTINCT e.id) AS enrolled_count,
              SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END) AS completed_count
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id
       WHERE c.educator_id = ?
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      user.id
    );
    return {
      role: user.role,
      myCourses,
      platform,
    };
  }

  if (user.role === 'employer') {
    const myJobs = queryAll(
      `SELECT j.*, COUNT(DISTINCT a.id) AS applicant_count,
              ROUND(AVG(a.match_score), 1) AS avg_match_score
       FROM jobs j
       LEFT JOIN applications a ON a.job_id = j.id
       WHERE j.employer_id = ?
       GROUP BY j.id
       ORDER BY j.created_at DESC`,
      user.id
    );
    return {
      role: user.role,
      myJobs,
      platform,
    };
  }

  // Verifier dashboard
  const pendingQueue = queryAll(`SELECT * FROM vw_verified_certificates WHERE status = 'PENDING'`);
  return {
    role: user.role,
    pendingQueue,
    platform,
  };
}

export function getPowerBiFeed() {
  const platform = getPlatformOverview();
  const verifiedCertificates = queryAll(`SELECT * FROM vw_verified_certificates ORDER BY issued_date DESC`);
  const topSkillGaps = queryAll(`
    SELECT skill_name,
           COUNT(*) AS gap_occurrences,
           ROUND(AVG(gap_level), 2) AS avg_gap_level
    FROM vw_learner_skill_gaps
    WHERE gap_level > 0
    GROUP BY skill_name
    ORDER BY gap_occurrences DESC
  `);

  return {
    generatedAt: new Date().toISOString(),
    source: 'Azure SQL / CareerForge Views',
    views: ['vw_analytics_overview', 'vw_verified_certificates', 'vw_learner_skill_gaps'],
    ...platform,
    topSkillGaps,
    verifiedCertificates,
  };
}
