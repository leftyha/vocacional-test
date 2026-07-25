(() => {
  const V = window.VocationalV2 = window.VocationalV2 || {};
  V.clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
  V.round = (value) => Math.round(value);
  V.mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  V.sd = (values) => {
    if (values.length < 2) return 0;
    const average = V.mean(values);
    return Math.sqrt(V.mean(values.map((value) => (value - average) ** 2)));
  };
  V.similarity = (left, right, keys = null) => {
    const dimensions = keys || [...new Set([...Object.keys(left || {}), ...Object.keys(right || {})])];
    let dot = 0;
    let aNorm = 0;
    let bNorm = 0;
    dimensions.forEach((key) => {
      const a = Number(left?.[key] || 0);
      const b = Number(right?.[key] || 0);
      dot += a * b;
      aNorm += a * a;
      bNorm += b * b;
    });
    return aNorm && bNorm
      ? V.clamp((dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm))) * 100)
      : 0;
  };

  V.aptitudeInterestSupport = {
    NUM: { I: 0.65, C: 0.35 },
    VER: { A: 0.35, S: 0.35, E: 0.30 },
    LOG: { I: 0.70, C: 0.30 },
    ESP: { R: 0.40, A: 0.35, I: 0.25 },
    CIE: { I: 0.75, R: 0.25 },
    DIG: { I: 0.45, R: 0.30, C: 0.25 },
    INT: { S: 0.60, E: 0.40 },
    EMP: { S: 0.85, A: 0.15 },
    CREA: { A: 0.75, I: 0.25 },
    ORG: { C: 0.70, E: 0.30 },
    LID: { E: 0.75, S: 0.25 },
    MAN: { R: 0.85, I: 0.15 },
  };

  V.scoreInterests = (test, answers) => {
    const dimensions = Object.keys(test.dimensions.interests);
    const directRaw = Object.fromEntries(dimensions.map((key) => [key, 0]));
    const directMax = Object.fromEntries(dimensions.map((key) => [key, 0]));
    const situationalRaw = Object.fromEntries(dimensions.map((key) => [key, 0]));
    const situationalMax = Object.fromEntries(dimensions.map((key) => [key, 0]));

    const interestBlock = test.blocks.find((block) => block.id === 'interests');
    interestBlock.questions.forEach((question) => {
      const selected = question.options.find((option) => option.id === answers[question.id]);
      directMax[question.dimension] += Math.max(
        ...question.options.map((option) => Number(option.value || 0)),
      );
      if (selected) directRaw[question.dimension] += Number(selected.value || 0);
    });

    const situationBlock = test.blocks.find((block) => block.id === 'situations');
    situationBlock.questions.forEach((question) => {
      new Set(question.options.map((option) => option.dimension)).forEach((dimension) => {
        situationalMax[dimension] += Number(test.scoring.rankedPoints.first || 3);
      });
      const selected = answers[question.id];
      if (!Array.isArray(selected)) return;
      const first = question.options.find((option) => option.id === selected[0]);
      const second = question.options.find((option) => option.id === selected[1]);
      if (first) situationalRaw[first.dimension] += Number(test.scoring.rankedPoints.first || 3);
      if (second) situationalRaw[second.dimension] += Number(test.scoring.rankedPoints.second || 1);
    });

    const direct = {};
    const situations = {};
    const normalized = {};
    dimensions.forEach((dimension) => {
      direct[dimension] = directMax[dimension]
        ? V.clamp((directRaw[dimension] / directMax[dimension]) * 100)
        : 0;
      situations[dimension] = situationalMax[dimension]
        ? V.clamp((situationalRaw[dimension] / situationalMax[dimension]) * 100)
        : 0;
      normalized[dimension] = V.round(
        direct[dimension] * test.scoring.interestBlockWeights.interests
        + situations[dimension] * test.scoring.interestBlockWeights.situations,
      );
    });

    return {
      normalized,
      direct,
      situations,
      consistency: V.round(V.similarity(direct, situations, dimensions)),
    };
  };

  V.groupScale = (test, answers, blockId, dimensions) => {
    const block = test.blocks.find((item) => item.id === blockId);
    const totals = Object.fromEntries(Object.keys(dimensions).map((key) => [key, []]));
    const all = [];
    block.questions.forEach((question) => {
      const answer = Number(answers[question.id]);
      if (!Number.isFinite(answer)) return;
      totals[question.dimension].push(answer);
      all.push(answer);
    });
    return { totals, all };
  };

  V.scoreAptitudes = (test, answers, interests) => {
    const { totals, all } = V.groupScale(
      test,
      answers,
      'aptitudes',
      test.dimensions.aptitudes,
    );
    const overallMean = V.mean(all);
    const overallSd = V.sd(all);
    const frequencies = all.reduce((acc, value) => {
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
    const highRate = all.length
      ? all.filter((value) => value === 5).length / all.length
      : 0;
    const dominantRate = all.length
      ? Math.max(...Object.values(frequencies)) / all.length
      : 0;
    const penalty = Math.max(0, highRate - 0.55) * 18
      + Math.max(0, dominantRate - 0.72) * 14;
    const calibration = test.scoring.aptitudeCalibration || {
      absoluteWeight: 0.55,
      relativeWeight: 0.30,
      behavioralSupportWeight: 0.15,
    };
    const normalized = {};
    const components = {};

    Object.entries(totals).forEach(([dimension, values]) => {
      if (!values.length) {
        normalized[dimension] = 0;
        return;
      }
      const dimensionMean = V.mean(values);
      const absolute = V.clamp(((dimensionMean - 1) / 4) * 100);
      const relative = overallSd < 0.30
        ? 50
        : V.clamp(
          50 + ((dimensionMean - overallMean) / Math.max(overallSd, 0.65)) * 20,
        );
      const mapping = V.aptitudeInterestSupport[dimension] || {};
      let support = 0;
      let supportWeight = 0;
      Object.entries(mapping).forEach(([interest, weight]) => {
        support += Number(interests[interest] || 0) * weight;
        supportWeight += weight;
      });
      support = supportWeight ? support / supportWeight : 50;
      normalized[dimension] = V.round(V.clamp(
        absolute * calibration.absoluteWeight
        + relative * calibration.relativeWeight
        + support * calibration.behavioralSupportWeight
        - penalty,
      ));
      components[dimension] = {
        observedFrequency: V.round(absolute),
        relativeStrength: V.round(relative),
        behavioralSupport: V.round(support),
      };
    });

    return {
      normalized,
      components,
      diagnostics: {
        standardDeviation: Number(overallSd.toFixed(2)),
        highEndorsementRate: V.round(highRate * 100),
        dominantAnswerRate: V.round(dominantRate * 100),
        calibrationPenalty: V.round(penalty),
      },
    };
  };

  V.scoreValues = (test, answers) => {
    const { totals } = V.groupScale(test, answers, 'values', test.dimensions.values);
    return Object.fromEntries(Object.entries(totals).map(([key, values]) => [
      key,
      values.length ? V.round(V.clamp(((V.mean(values) - 1) / 4) * 100)) : 0,
    ]));
  };

  V.scoreConstraints = (test, answers) => {
    const compatibility = { 1: 0, 2: 25, 3: 60, 4: 85, 5: 100 };
    const block = test.blocks.find((item) => item.id === 'constraints');
    const raw = {};
    const normalized = {};
    block.questions.forEach((question) => {
      const value = Number(answers[question.id]);
      raw[question.dimension] = value;
      normalized[question.dimension] = compatibility[value] ?? 0;
    });
    return { raw, normalized };
  };

  V.expandCareer = (career, families = {}) => {
    if (!Array.isArray(career.aptitudeKeys)) return career;
    const interests = { R: 18, I: 18, A: 18, S: 18, E: 18, C: 18 };
    [...String(career.hollandCode || '')].forEach((key, index) => {
      if (key in interests) interests[key] = [100, 78, 58][index] || 48;
    });
    const aptitudes = Object.fromEntries(
      (career.aptitudeKeys || []).map((key, index) => [key, [92, 82, 72, 62, 54][index] || 50]),
    );
    const values = Object.fromEntries(
      (career.valueKeys || []).map((key, index) => [key, [92, 78, 64, 54][index] || 50]),
    );
    const family = families[career.family] || {};
    return {
      ...career,
      interests,
      aptitudes,
      values,
      dailyTasks: family.dailyTasks || [],
      environment: family.environment || [],
    };
  };
})();
