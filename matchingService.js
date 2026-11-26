/**
 * Skill Gap Analysis & Job Matching Engine
 * Uses HashMap lookups (O(1) per skill) and weighted scoring across
 * proficiency ratios, mandatory skill penalties, and verified credentials.
 */

export function buildUserSkillMap(userSkills) {
  const map = new Map();
  for (const us of userSkills) {
    map.set(us.skill_id, us);
  }
  return map;
}

export function computeJobMatch(userSkillMap, jobRequirements) {
  if (!jobRequirements || jobRequirements.length === 0) {
    return {
      matchScore: 100,
      readinessLabel: 'Strong Match',
      matchedSkills: [],
      gaps: [],
      verifiedCount: 0,
      totalRequired: 0,
    };
  }

  let totalWeight = 0;
  let earnedWeight = 0;
  let verifiedCount = 0;
  const matchedSkills = [];
  const gaps = [];

  for (const req of jobRequirements) {
    const weight = req.is_mandatory ? 1.5 : 1.0;
    totalWeight += weight;

    const userSkill = userSkillMap.get(req.skill_id);
    const currentLevel = userSkill ? userSkill.proficiency_level : 0;
    const isVerified = Boolean(userSkill?.verified);

    if (isVerified) verifiedCount += 1;

    const coverage = Math.min(1, currentLevel / req.required_level);
    // Small verification trust bonus (up to 10% boost per skill, capped at weight)
    const verifiedBonus = isVerified && coverage > 0 ? 0.08 * weight : 0;
    earnedWeight += Math.min(weight, coverage * weight + verifiedBonus);

    const detail = {
      skill_id: req.skill_id,
      skill_name: req.skill_name,
      category: req.category,
      required_level: req.required_level,
      current_level: currentLevel,
      verified: isVerified,
      is_mandatory: Boolean(req.is_mandatory),
      gap_level: Math.max(0, req.required_level - currentLevel),
    };

    if (detail.gap_level === 0) {
      matchedSkills.push(detail);
    } else {
      gaps.push(detail);
    }
  }

  // Sort gaps by mandatory first, then largest deficit
  gaps.sort((a, b) => Number(b.is_mandatory) - Number(a.is_mandatory) || b.gap_level - a.gap_level);

  const matchScore = Math.min(100, Math.round((earnedWeight / totalWeight) * 100));
  let readinessLabel = 'Needs Upskilling';
  if (matchScore >= 85) readinessLabel = 'Strong Match';
  else if (matchScore >= 65) readinessLabel = 'Good Fit';
  else if (matchScore >= 45) readinessLabel = 'Developing';

  return {
    matchScore,
    readinessLabel,
    matchedSkills,
    gaps,
    verifiedCount,
    totalRequired: jobRequirements.length,
  };
}

/**
 * Recommends courses prioritized by how effectively they close the user's skill gaps.
 */
export function recommendCoursesForGaps(gaps, coursesWithSkills, enrolledCourseIds = new Set()) {
  const gapMap = new Map(gaps.map((g) => [g.skill_id, g]));

  const ranked = coursesWithSkills.map((course) => {
    let relevanceScore = 0;
    const addressesGaps = [];

    for (const cs of course.skills || []) {
      const gap = gapMap.get(cs.skill_id);
      if (gap) {
        const gain = Math.min(gap.gap_level, Math.max(1, cs.target_level - gap.current_level));
        relevanceScore += (gap.is_mandatory ? 20 : 12) + gain * 10;
        addressesGaps.push({
          skill_id: cs.skill_id,
          skill_name: cs.skill_name,
          current_level: gap.current_level,
          target_level: cs.target_level,
          required_level: gap.required_level,
        });
      }
    }

    return {
      ...course,
      isEnrolled: enrolledCourseIds.has(course.id),
      relevanceScore,
      addressesGaps,
    };
  });

  ranked.sort((a, b) => b.relevanceScore - a.relevanceScore || a.duration_hours - b.duration_hours);
  return ranked;
}
