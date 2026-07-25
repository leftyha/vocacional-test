(() => {
  const nativeFetch = window.fetch.bind(window);
  const jsonResponse = (data) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  const readJson = async (url, init) => {
    const response = await nativeFetch(url, { ...init, cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo cargar ${url}: HTTP ${response.status}`);
    return response.json();
  };
  const mergeTest = (base, overrides) => {
    const test = JSON.parse(JSON.stringify(base));
    const questions = new Map(test.blocks.flatMap((block) => block.questions).map((question) => [question.id, question]));
    Object.entries(overrides.questions || {}).forEach(([id, patch]) => {
      const question = questions.get(id); if (!question) return;
      if (patch.prompt) question.prompt = patch.prompt;
      if (patch.optionSet && overrides.sharedOptions?.[patch.optionSet]) question.options = overrides.sharedOptions[patch.optionSet];
      else if (patch.options) question.options = patch.options;
    });
    test.version = overrides.version || test.version;
    test.scoring = { ...test.scoring, ...(overrides.scoring || {}) };
    return test;
  };
  window.fetch = async (input, init = {}) => {
    const raw = typeof input === 'string' ? input : input.url;
    const url = new URL(raw, window.location.href);
    if (url.pathname.endsWith('/data/test.json')) {
      const [base, overrides] = await Promise.all([readJson(raw, init), readJson('./data/test-overrides.json', init)]);
      return jsonResponse(mergeTest(base, overrides));
    }
    if (url.pathname.endsWith('/data/careers.json')) {
      const manifest = await readJson(raw, init);
      if (!Array.isArray(manifest.parts)) return jsonResponse(manifest);
      const [parts, familyData] = await Promise.all([Promise.all(manifest.parts.map((part) => readJson(part, init))), manifest.families ? readJson(manifest.families, init) : Promise.resolve({ families: {} })]);
      const parseConstraints = (value = '') => Object.fromEntries(
        value.split(',').filter(Boolean).map((item) => {
          const [key, level] = item.split(':');
          return [key, Number(level)];
        }),
      );
      const fromRow = (row) => ({
        id: row[0],
        name: row[1],
        family: manifest.familyNames?.[row[2]] || 'Otros',
        cluster: row[3],
        hollandCode: row[4],
        aptitudeKeys: String(row[5] || '').split(',').filter(Boolean),
        valueKeys: String(row[6] || '').split(',').filter(Boolean),
        specializations: String(row[7] || '').split('|').filter(Boolean),
        constraints: parseConstraints(row[8]),
        hardConstraints: String(row[9] || '').split(',').filter(Boolean),
        educationLevel: row[10],
        description: row[11],
      });
      const careers = parts.flatMap((part) => (
        Array.isArray(part.rows) ? part.rows.map(fromRow) : (part.careers || [])
      ));
      if (manifest.count && careers.length !== manifest.count) throw new Error(`El catálogo esperaba ${manifest.count} carreras y cargó ${careers.length}.`);
      return jsonResponse({ version: manifest.version, compact: true, families: familyData.families || {}, careers });
    }
    return nativeFetch(input, init);
  };
})();
