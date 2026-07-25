const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value);

const GENERAL_COMPATIBILITY = { 1: 0, 2: 25, 3: 60, 4: 85, 5: 100 };

function flattenQuestions(test) {
  return test.blocks.flatMap((block, blockIndex) =>
    block.questions.map((question, questionIndex) => ({
      ...question,
      blockId: block.id,
      blockTitle: block.title,
      blockDescription: block.description,
      blockColor: block.color,
      blockIndex,
      questionIndex,
    })),
  );
}

function isAnswerComplete(question, answer) {
  if (question.type === 'ranked') {
    return Array.isArray(answer) && answer.length === 2 && answer[0] !== answer[1];
  }
  return answer !== undefined && answer !== null && answer !== '';
}

function scoreInterests(test, answers) {
  const trueFalse = Object.fromEntries(Object.keys(test.dimensions.interests).map((key) => [key, 0]));
  const situations = Object.fromEntries(Object.keys(test.dimensions.interests).map((key) => [key, 0]));

  const interestBlock = test.blocks.find((block) => block.id === 'interests');
  interestBlock.questions.forEach((question) => {
    const selected = question.options.find((option) => option.id === answers[question.id]);
    if (selected) trueFalse[question.dimension] += Number(selected.value || 0);
  });

  const situationBlock = test.blocks.find((block) => block.id === 'situations');
  situationBlock.questions.forEach((question) => {
    const selected = answers[question.id];
    if (!Array.isArray(selected)) return;
    const first = question.options.find((option) => option.id === selected[0]);
    const second = question.options.find((option) => option.id === selected[1]);
    if (first) situations[first.dimension] += test.scoring.rankedPoints.first;
    if (second) situations[second.dimension] += test.scoring.rankedPoints.second;
  });

  const result = {};
  Object.keys(trueFalse).forEach((dimension) => {
    const blockOne = (trueFalse[dimension] / 20) * 100;
    const blockTwo = (situations[dimension] / 54) * 100;
    result[dimension] = round(
      blockOne * test.scoring.interestBlockWeights.interests +
      blockTwo * test.scoring.interestBlockWeights.situations,
    );
  });

  return { normalized: result, raw: { trueFalse, situations } };
}

function scoreGroupedScale(test, answers, blockId, dimensions, minTotal, range) {
  const block = test.blocks.find((item) => item.id === blockId);
  const totals = Object.fromEntries(Object.keys(dimensions).map((key) => [key, { sum: 0, count: 0 }]));

  block.questions.forEach((question) => {
    const answer = Number(answers[question.id]);
    if (!Number.isFinite(answer)) return;
    totals[question.dimension].sum += answer;
    totals[question.dimension].count += 1;
  });

  return Object.fromEntries(Object.entries(totals).map(([dimension, value]) => {
    if (!value.count) return [dimension, 0];
    const normalized = ((value.sum - minTotal) / range) * 100;
    return [dimension, round(clamp(normalized))];
  }));
}

function scoreConstraints(test, answers) {
  const block = test.blocks.find((item) => item.id === 'constraints');
  const raw = {};
  const normalized = {};
  block.questions.forEach((question) => {
    const value = Number(answers[question.id]);
    raw[question.dimension] = value;
    normalized[question.dimension] = GENERAL_COMPATIBILITY[value] ?? 0;
  });
  return { raw, normalized };
}

function weightedInterestScore(userInterests, careerInterests) {
  let total = 0;
  let weight = 0;
  Object.entries(careerInterests).forEach(([dimension, importance]) => {
    total += (userInterests[dimension] || 0) * importance;
    weight += importance;
  });
  return weight ? total / weight : 0;
}

function aptitudeFit(userAptitudes, requirements) {
  let total = 0;
  let weight = 0;
  Object.entries(requirements).forEach(([dimension, target]) => {
    const user = userAptitudes[dimension] || 0;
    const fit = clamp((user / target) * 100);
    total += fit * target;
    weight += target;
  });
  return weight ? total / weight : 0;
}

function valueFit(userValues, desiredValues) {
  let total = 0;
  let weight = 0;
  Object.entries(desiredValues).forEach(([dimension, importance]) => {
    total += (userValues[dimension] || 0) * importance;
    weight += importance;
  });
  return weight ? total / weight : 0;
}

function singleConstraintFit(code, userLevel, requiredLevel) {
  if (!requiredLevel) return 100;
  if (!userLevel) return 0;

  if (code === 'EL') {
    const gap = userLevel - requiredLevel;
    if (gap >= 0) return 100;
    if (gap === -1) return 58;
    if (gap === -2) return 18;
    return 0;
  }

  const gap = userLevel - requiredLevel;
  if (gap >= 0) return 100;
  if (gap === -1) return 65;
  if (gap === -2) return 28;
  return 0;
}

function constraintFit(userConstraints, career) {
  const entries = Object.entries(career.constraints || {});
  if (!entries.length) return { score: 100, discarded: false, warnings: [] };

  let total = 0;
  const warnings = [];
  let discarded = false;

  entries.forEach(([code, required]) => {
    const user = userConstraints[code];
    const fit = singleConstraintFit(code, user, required);
    total += fit;
    if (fit < 65) warnings.push({ code, fit, user, required });
    if ((career.hardConstraints || []).includes(code) && fit <= 28) discarded = true;
  });

  return { score: total / entries.length, discarded, warnings };
}

function topMatches(userScores, careerScores, labels, count = 3) {
  return Object.keys(careerScores)
    .map((key) => ({
      key,
      label: labels[key] || key,
      user: userScores[key] || 0,
      importance: careerScores[key] || 0,
      match: (userScores[key] || 0) * (careerScores[key] || 0),
    }))
    .sort((a, b) => b.match - a.match)
    .slice(0, count);
}

function resultLabel(score, labels) {
  return labels.find((item) => score >= item.min)?.label || 'Afinidad exploratoria';
}

function scoreCareer(career, profile, test, config) {
  const interest = weightedInterestScore(profile.interests, career.interests);
  const aptitude = aptitudeFit(profile.aptitudes, career.aptitudes);
  const values = valueFit(profile.values, career.values);
  const constraints = constraintFit(profile.constraintsRaw, career);
  const weights = test.scoring.careerWeights;

  let score =
    interest * weights.interests +
    aptitude * weights.aptitudes +
    values * weights.values +
    constraints.score * weights.constraints;

  if (constraints.discarded) score *= 0.48;
  score = round(clamp(score));

  return {
    ...career,
    score,
    label: resultLabel(score, config.resultLabels),
    discarded: constraints.discarded,
    breakdown: {
      interests: round(interest),
      aptitudes: round(aptitude),
      values: round(values),
      constraints: round(constraints.score),
    },
    warnings: constraints.warnings,
    matches: {
      interests: topMatches(profile.interests, career.interests, test.dimensions.interests, 3),
      aptitudes: topMatches(profile.aptitudes, career.aptitudes, test.dimensions.aptitudes, 3),
      values: topMatches(profile.values, career.values, test.dimensions.values, 2),
    },
  };
}

function diversify(scored, config) {
  const selected = [];
  const familyCounts = {};
  const pool = scored.filter((item) => !item.discarded).slice(0, config.diversification.topPool || 20);

  for (const career of pool) {
    const count = familyCounts[career.family] || 0;
    if (count >= config.diversification.maxPerFamily) continue;
    selected.push(career);
    familyCounts[career.family] = count + 1;
    if (selected.length === 5) break;
  }

  if (selected.length < 5) {
    for (const career of scored) {
      if (career.discarded || selected.some((item) => item.id === career.id)) continue;
      selected.push(career);
      if (selected.length === 5) break;
    }
  }

  return selected;
}

function calculateConfidence(answers, questions, scored) {
  const answered = questions.filter((question) => isAnswerComplete(question, answers[question.id])).length;
  const completion = answered / questions.length;
  const scaleQuestions = questions.filter((question) => question.type === 'scale');
  const neutral = scaleQuestions.filter((question) => Number(answers[question.id]) === 3).length;
  const neutralRate = scaleQuestions.length ? neutral / scaleQuestions.length : 0;
  const gap = scored.length > 1 ? scored[0].score - scored[1].score : 0;
  const confidence = 65 + completion * 22 - neutralRate * 12 + Math.min(gap, 12) * 0.5;
  return round(clamp(confidence, 55, 95));
}

function calculateResults(test, careersData, config, answers) {
  const questions = flattenQuestions(test);
  const interestData = scoreInterests(test, answers);
  const aptitudes = scoreGroupedScale(test, answers, 'aptitudes', test.dimensions.aptitudes, 3, 12);
  const values = scoreGroupedScale(test, answers, 'values', test.dimensions.values, 2, 8);
  const constraintsData = scoreConstraints(test, answers);

  const profile = {
    interests: interestData.normalized,
    aptitudes,
    values,
    constraints: constraintsData.normalized,
    constraintsRaw: constraintsData.raw,
  };

  const allCareers = careersData.careers
    .map((career) => scoreCareer(career, profile, test, config))
    .sort((a, b) => b.score - a.score);

  const recommendations = diversify(allCareers, config);
  const interestRanking = Object.entries(profile.interests).sort((a, b) => b[1] - a[1]);
  const aptitudeRanking = Object.entries(profile.aptitudes).sort((a, b) => b[1] - a[1]);
  const valueRanking = Object.entries(profile.values).sort((a, b) => b[1] - a[1]);

  return {
    generatedAt: new Date().toISOString(),
    profile,
    recommendations,
    allCareers,
    confidence: calculateConfidence(answers, questions, allCareers),
    hollandCode: interestRanking.slice(0, 3).map(([key]) => key).join(''),
    rankings: {
      interests: interestRanking,
      aptitudes: aptitudeRanking,
      values: valueRanking,
    },
  };
}
