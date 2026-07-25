(() => {
  const V = window.VocationalV2;

  const weightedCoverage = (user, target) => {
    let total = 0;
    let weight = 0;
    Object.entries(target || {}).forEach(([key, importance]) => {
      total += Number(user[key] || 0) * importance;
      weight += importance;
    });
    return weight ? total / weight : 0;
  };

  const requirementFit = (user, target) => {
    let total = 0;
    let weight = 0;
    Object.entries(target || {}).forEach(([key, required]) => {
      total += V.clamp((Number(user[key] || 0) / Math.max(required, 1)) * 100) * required;
      weight += required;
    });
    return weight ? total / weight : 0;
  };

  const constraintFit = (user, career) => {
    const entries = Object.entries(career.constraints || {});
    if (!entries.length) return { score: 100, discarded: false, warnings: [] };
    let total = 0;
    let discarded = false;
    const warnings = [];

    entries.forEach(([code, required]) => {
      const level = user[code];
      const gap = Number(level || 0) - required;
      const fit = gap >= 0
        ? 100
        : gap === -1
          ? (code === 'EL' ? 58 : 65)
          : gap === -2
            ? (code === 'EL' ? 18 : 28)
            : 0;
      total += fit;
      if (fit < 65) warnings.push({ code, fit, user: level, required });
      if ((career.hardConstraints || []).includes(code) && fit <= 28) discarded = true;
    });

    return { score: total / entries.length, discarded, warnings };
  };

  const topMatches = (user, target, labels, count) => Object.keys(target || {})
    .map((key) => ({
      key,
      label: labels[key] || key,
      user: user[key] || 0,
      importance: target[key] || 0,
      match: (user[key] || 0) * (target[key] || 0),
    }))
    .sort((a, b) => b.match - a.match)
    .slice(0, count);

  const resultLabel = (score, labels) => (
    labels.find((item) => score >= item.min)?.label || 'Afinidad exploratoria'
  );

  const scoreCareerV2 = (career, profile, test, config) => {
    const interest = weightedCoverage(profile.interests, career.interests) * 0.72
      + V.similarity(profile.interests, career.interests) * 0.28;
    const aptitude = requirementFit(profile.aptitudes, career.aptitudes) * 0.72
      + V.similarity(profile.aptitudes, career.aptitudes) * 0.28;
    const values = weightedCoverage(profile.values, career.values) * 0.78
      + V.similarity(profile.values, career.values) * 0.22;
    const constraints = constraintFit(profile.constraintsRaw, career);
    const weights = test.scoring.careerWeights;

    let score = interest * weights.interests
      + aptitude * weights.aptitudes
      + values * weights.values
      + constraints.score * weights.constraints;
    if (constraints.discarded) score *= 0.48;
    score = V.round(V.clamp(score));

    return {
      ...career,
      score,
      label: resultLabel(score, config.resultLabels),
      discarded: constraints.discarded,
      breakdown: {
        interests: V.round(interest),
        aptitudes: V.round(aptitude),
        values: V.round(values),
        constraints: V.round(constraints.score),
      },
      warnings: constraints.warnings,
      matches: {
        interests: topMatches(profile.interests, career.interests, test.dimensions.interests, 3),
        aptitudes: topMatches(profile.aptitudes, career.aptitudes, test.dimensions.aptitudes, 3),
        values: topMatches(profile.values, career.values, test.dimensions.values, 2),
      },
    };
  };

  const diversifyV2 = (scored, config) => {
    const settings = config.diversification || {};
    const selected = [];
    const families = {};
    const clusters = {};
    const pool = scored
      .filter((item) => !item.discarded)
      .slice(0, settings.topPool || 50);

    const add = (career) => {
      selected.push(career);
      families[career.family] = (families[career.family] || 0) + 1;
      const cluster = career.cluster || career.id;
      clusters[cluster] = (clusters[cluster] || 0) + 1;
    };

    for (const career of pool) {
      if ((families[career.family] || 0) >= (settings.maxPerFamily || 2)) continue;
      if ((clusters[career.cluster || career.id] || 0) >= (settings.maxPerCluster || 1)) continue;
      add(career);
      if (selected.length === 5) return selected;
    }

    for (const career of scored) {
      if (career.discarded || selected.some((item) => item.id === career.id)) continue;
      add(career);
      if (selected.length === 5) break;
    }
    return selected;
  };

  const responseQuality = (test, answers, interests, aptitudes) => {
    const questions = flattenQuestions(test);
    const completed = questions.filter(
      (question) => isAnswerComplete(question, answers[question.id]),
    ).length;
    const completion = questions.length ? completed / questions.length : 0;
    const diagnostics = aptitudes.diagnostics;
    const differentiation = V.clamp(
      (diagnostics.standardDeviation / 1.05) * 100,
    ) / 100;
    const score = V.clamp(
      completion * 45
      + (interests.consistency / 100) * 30
      + Math.min(differentiation, 1) * 25
      - (Math.max(0, diagnostics.highEndorsementRate - 55) / 100) * 18
      - (Math.max(0, diagnostics.dominantAnswerRate - 72) / 100) * 14,
      35,
      100,
    );
    const flags = [];
    if (interests.consistency < 48) {
      flags.push('Tus preferencias directas y tus elecciones situacionales difieren bastante.');
    }
    if (diagnostics.highEndorsementRate > 65) {
      flags.push('Marcaste el nivel máximo en muchas aptitudes; el sistema redujo ese sesgo.');
    }
    if (diagnostics.dominantAnswerRate > 78) {
      flags.push('Las respuestas de aptitud tienen poca diferenciación entre fortalezas.');
    }
    return { score: V.round(score), flags };
  };

  const validate = (careers) => {
    const ids = new Set();
    const names = new Set();
    careers.forEach((career) => {
      const name = String(career.name || '').trim().toLocaleLowerCase('es');
      if (!career.id || ids.has(career.id) || !name || names.has(name)) {
        throw new Error(`Carrera duplicada: ${career.name || career.id}`);
      }
      ids.add(career.id);
      names.add(name);
    });
  };

  window.calculateResults = (test, careersData, config, answers) => {
    const questions = flattenQuestions(test);
    const interestData = V.scoreInterests(test, answers);
    const aptitudeData = V.scoreAptitudes(test, answers, interestData.normalized);
    const values = V.scoreValues(test, answers);
    const constraints = V.scoreConstraints(test, answers);
    const profile = {
      interests: interestData.normalized,
      aptitudes: aptitudeData.normalized,
      aptitudeComponents: aptitudeData.components,
      values,
      constraints: constraints.normalized,
      constraintsRaw: constraints.raw,
    };
    const normalizedCareers = (careersData.careers || []).map(
      (career) => V.expandCareer(career, careersData.families || {}),
    );
    validate(normalizedCareers);
    const allCareers = normalizedCareers
      .map((career) => scoreCareerV2(career, profile, test, config))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'es'));
    const quality = responseQuality(test, answers, interestData, aptitudeData);
    const gap = allCareers.length > 1 ? allCareers[0].score - allCareers[1].score : 0;
    const spread = allCareers.length > 4 ? allCareers[0].score - allCareers[4].score : gap;
    const confidence = V.round(V.clamp(
      24
      + 16
      + quality.score * 0.40
      + Math.min(gap, 12) * 0.5
      + Math.min(spread, 20) * 0.25,
      48,
      94,
    ));
    const interestRanking = Object.entries(profile.interests)
      .sort((a, b) => b[1] - a[1]);

    return {
      generatedAt: new Date().toISOString(),
      profile,
      recommendations: diversifyV2(allCareers, config),
      allCareers,
      responseQuality: quality,
      confidence,
      hollandCode: interestRanking.slice(0, 3).map(([key]) => key).join(''),
      rankings: {
        interests: interestRanking,
        aptitudes: Object.entries(profile.aptitudes).sort((a, b) => b[1] - a[1]),
        values: Object.entries(profile.values).sort((a, b) => b[1] - a[1]),
      },
    };
  };
})();
