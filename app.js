
const app = document.querySelector('#app');
let test;
let careers;
let config;
let questions = [];
let previousProgress = 0;

const state = {
  screen: 'loading',
  currentIndex: 0,
  pendingIndex: null,
  answers: {},
  results: null,
};

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const icon = (name, size = 22) => {
  const paths = {
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
    spark: '<path d="m12 3-1.4 4.1a5 5 0 0 1-3.5 3.5L3 12l4.1 1.4a5 5 0 0 1 3.5 3.5L12 21l1.4-4.1a5 5 0 0 1 3.5-3.5L21 12l-4.1-1.4a5 5 0 0 1-3.5-3.5L12 3Z"/>',
    chart: '<path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/>',
    shield: '<path d="M12 3 5 6v5c0 4.4 2.7 8 7 10 4.3-2 7-5.6 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M5 21h14"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
};

function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(config.storageKey));
    if (!parsed || parsed.version !== test.version) return;
    state.answers = parsed.answers || {};
    state.currentIndex = Math.min(parsed.currentIndex || 0, questions.length - 1);
    state.results = parsed.results || null;
  } catch {
    localStorage.removeItem(config.storageKey);
  }
}

function persist() {
  localStorage.setItem(config.storageKey, JSON.stringify({
    version: test.version,
    currentIndex: state.currentIndex,
    answers: state.answers,
    results: state.results,
    updatedAt: new Date().toISOString(),
  }));
}

function answeredCount() {
  return questions.filter((question) => isAnswerComplete(question, state.answers[question.id])).length;
}

function completionPercent() {
  return Math.round((answeredCount() / questions.length) * 100);
}

function setScreen(screen) {
  state.screen = screen;
  window.scrollTo({ top: 0, behavior: 'instant' });
  render();
}

function renderLoading(message = 'Preparando tu prueba…') {
  app.innerHTML = `
    <main class="loading-screen">
      <div class="loading-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
      <p>${escapeHtml(message)}</p>
    </main>`;
}

function renderError(error) {
  app.innerHTML = `
    <main class="error-screen page-shell">
      <div class="error-card">
        <div class="brand-mark">${icon('compass', 28)}</div>
        <h1>No pudimos abrir los datos</h1>
        <p>La aplicación necesita ejecutarse desde un servidor estático para poder leer sus archivos JSON.</p>
        <code>python3 -m http.server 4173</code>
        <p class="muted">Después abre <strong>http://localhost:4173</strong>.</p>
        <details><summary>Detalle técnico</summary><pre>${escapeHtml(error?.message || error)}</pre></details>
      </div>
    </main>`;
}

function renderHome() {
  const progress = completionPercent();
  const hasProgress = progress > 0 && progress < 100;
  const hasResults = Boolean(state.results);
  app.innerHTML = `
    <main class="home-page">
      <nav class="top-nav page-shell">
        <a class="brand" href="#" data-action="home" aria-label="Ir al inicio">
          <span class="brand-mark">${icon('compass', 24)}</span>
          <span>${escapeHtml(config.brand.name)}</span>
        </a>
        <span class="nav-badge">100% privado</span>
      </nav>

      <section class="hero page-shell">
        <div class="hero-copy reveal">
          <span class="eyebrow"><span class="eyebrow-dot"></span> Orientación vocacional integral</span>
          <h1>No te diremos solo <em>qué tipo eres.</em><br />Te mostraremos <strong>cinco carreras concretas.</strong></h1>
          <p>Una prueba mobile-first que cruza intereses, fortalezas, valores y límites reales para construir recomendaciones explicables.</p>
          <div class="hero-actions">
            ${hasResults ? `<button class="button button-primary" data-action="view-results">Ver mis resultados ${icon('arrow', 19)}</button>` : ''}
            ${hasProgress ? `<button class="button button-primary" data-action="resume">Continuar prueba · ${progress}% ${icon('arrow', 19)}</button>` : `<button class="button button-primary" data-action="start">Comenzar prueba ${icon('arrow', 19)}</button>`}
            ${(hasProgress || hasResults) ? `<button class="button button-ghost" data-action="restart">Empezar de nuevo</button>` : ''}
          </div>
          <div class="hero-meta">
            <span>${icon('clock', 18)} ${test.estimatedMinutes} min aprox.</span>
            <span>${icon('layers', 18)} ${questions.length} preguntas</span>
            <span>${icon('lock', 18)} Sin registro</span>
          </div>
        </div>

        <div class="hero-visual reveal">
          <div class="orbit-card">
            <div class="orbit orbit-one"></div>
            <div class="orbit orbit-two"></div>
            <div class="center-orb"><span>5</span><small>carreras</small></div>
            <article class="floating-card card-a"><b>Diseño UX/UI</b><span>86% afinidad</span></article>
            <article class="floating-card card-b"><b>Psicología</b><span>82% afinidad</span></article>
            <article class="floating-card card-c"><b>Ingeniería</b><span>78% afinidad</span></article>
          </div>
        </div>
      </section>

      <section class="how page-shell">
        <div class="section-heading reveal">
          <span class="eyebrow">Una decisión mejor informada</span>
          <h2>El resultado se construye en cuatro capas</h2>
        </div>
        <div class="feature-grid">
          <article class="feature-card reveal"><span class="feature-icon mint">${icon('compass')}</span><b>Intereses</b><p>Qué actividades te atraen incluso sin recompensa externa.</p></article>
          <article class="feature-card reveal"><span class="feature-icon violet">${icon('spark')}</span><b>Aptitudes</b><p>Qué habilidades ya demuestras y cuáles podrías desarrollar.</p></article>
          <article class="feature-card reveal"><span class="feature-icon orange">${icon('chart')}</span><b>Valores</b><p>Qué necesitas del trabajo para sentirte satisfecho.</p></article>
          <article class="feature-card reveal"><span class="feature-icon blue">${icon('shield')}</span><b>Compatibilidad</b><p>Qué condiciones pueden favorecer o descartar una opción.</p></article>
        </div>
      </section>

      <footer class="page-shell footer">Los resultados orientan la exploración; no sustituyen una evaluación psicométrica profesional.</footer>
    </main>`;
  requestAnimationFrame(() => animateIn('.reveal', 'up', 70));
}

function renderTestHeader(question) {
  const progress = Math.round((state.currentIndex / questions.length) * 100);
  return `
    <header class="test-header">
      <button class="icon-button" data-action="exit-test" aria-label="Salir de la prueba">${icon('close', 22)}</button>
      <div class="progress-track" aria-label="Progreso de la prueba"><div class="progress-fill" style="width:${previousProgress}%"></div></div>
      <span class="progress-number">${progress}%</span>
    </header>`;
}

function booleanOptions(question, answer) {
  return `<div class="answer-list boolean-list">
    ${question.options.map((option) => `
      <button class="answer-card ${answer === option.id ? 'selected' : ''}" data-answer="${option.id}">
        <span class="answer-symbol">${option.id === 'true' ? icon('check', 24) : icon('close', 24)}</span>
        <span><b>${escapeHtml(option.label)}</b><small>${option.id === 'true' ? 'Se parece a cómo eres normalmente' : 'No describe bien tus preferencias'}</small></span>
      </button>`).join('')}
  </div>`;
}

function scaleOptions(question, answer) {
  return `<div class="scale-list" role="radiogroup" aria-label="Opciones de respuesta">
    ${question.options.map((option, index) => `
      <button class="scale-option ${Number(answer) === option.value ? 'selected' : ''}" data-answer="${option.id}" role="radio" aria-checked="${Number(answer) === option.value}">
        <span class="scale-number">${index + 1}</span>
        <span>${escapeHtml(option.label)}</span>
      </button>`).join('')}
  </div>`;
}

function rankedOptions(question, answer = []) {
  return `<div class="rank-help">
      <span class="rank-pill ${answer.length >= 1 ? 'done' : ''}"><b>1</b> Primera opción</span>
      <span class="rank-line"></span>
      <span class="rank-pill ${answer.length >= 2 ? 'done' : ''}"><b>2</b> Segunda opción</span>
    </div>
    <div class="answer-list ranked-list">
      ${question.options.map((option) => {
        const rank = answer.indexOf(option.id);
        return `<button class="answer-card ranked ${rank >= 0 ? 'selected' : ''}" data-answer="${option.id}">
          <span class="rank-badge">${rank >= 0 ? rank + 1 : option.id}</span>
          <span><b>${escapeHtml(option.label)}</b></span>
        </button>`;
      }).join('')}
    </div>`;
}

function renderQuestion() {
  const question = questions[state.currentIndex];
  const answer = state.answers[question.id];
  const block = test.blocks[question.blockIndex];
  const complete = isAnswerComplete(question, answer);
  const withinBlock = question.questionIndex + 1;

  app.innerHTML = `
    <main class="test-page theme-${question.blockColor}">
      <div class="test-shell">
        ${renderTestHeader(question)}
        <section class="question-stage" data-question-stage>
          <div class="question-context">
            <span class="block-chip">${escapeHtml(block.eyebrow)}</span>
            <span>${withinBlock} de ${block.questions.length}</span>
          </div>
          ${question.title ? `<p class="scenario-title">${escapeHtml(question.title)}</p>` : ''}
          <h1>${escapeHtml(question.prompt)}</h1>
          ${question.type === 'ranked' ? `<p class="question-note">Tu orden importa: la primera elección pesa más que la segunda.</p>` : ''}
          <div class="question-options">
            ${question.type === 'boolean' ? booleanOptions(question, answer) : ''}
            ${question.type === 'scale' ? scaleOptions(question, answer) : ''}
            ${question.type === 'ranked' ? rankedOptions(question, answer) : ''}
          </div>
        </section>
        <footer class="test-actions">
          <button class="button button-ghost nav-back" data-action="previous" ${state.currentIndex === 0 ? 'disabled' : ''}>${icon('back', 20)} Atrás</button>
          <button class="button button-primary nav-next" data-action="next" ${complete ? '' : 'disabled'}>${state.currentIndex === questions.length - 1 ? 'Ver resultados' : 'Continuar'} ${icon('arrow', 19)}</button>
        </footer>
      </div>
    </main>`;

  const fill = document.querySelector('.progress-fill');
  const nextProgress = Math.round((state.currentIndex / questions.length) * 100);
  requestAnimationFrame(() => {
    animateProgress(fill, previousProgress, nextProgress);
    animateQuestion(document.querySelector('[data-question-stage]'));
  });
  previousProgress = nextProgress;
}

function renderCheckpoint() {
  const completedBlock = test.blocks[state.pendingIndex ? questions[state.pendingIndex - 1].blockIndex : 0];
  const nextBlock = test.blocks[questions[state.pendingIndex].blockIndex];
  const percent = Math.round((state.pendingIndex / questions.length) * 100);
  app.innerHTML = `
    <main class="checkpoint-page theme-${nextBlock.color}">
      <section class="checkpoint-card reveal">
        <div class="checkpoint-orb">${icon('check', 40)}</div>
        <span class="eyebrow">${percent}% completado</span>
        <h1>${escapeHtml(completedBlock.title)} listo</h1>
        <p>Ya tenemos una capa más de tu perfil. No mostramos conclusiones todavía para no influir en tus siguientes respuestas.</p>
        <div class="next-block-preview">
          <span>Ahora sigue</span>
          <b>${escapeHtml(nextBlock.title)}</b>
          <small>${escapeHtml(nextBlock.description)}</small>
        </div>
        <button class="button button-primary button-wide" data-action="continue-block">Continuar ${icon('arrow', 19)}</button>
      </section>
    </main>`;
  requestAnimationFrame(() => animateIn('.reveal', 'pop'));
}

function renderProcessing() {
  app.innerHTML = `
    <main class="processing-page">
      <div class="processing-copy">
        <div class="profile-loader" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <span class="eyebrow">Cruzando tus respuestas</span>
        <h1>Construyendo tus cinco caminos</h1>
        <p>Comparamos tu perfil con ${careers.careers.length} carreras concretas y descartamos incompatibilidades importantes.</p>
      </div>
    </main>`;
  requestAnimationFrame(() => animateIn('.processing-copy > *', 'up', 100));
}

function scoreRing(score, rank) {
  return `<div class="score-ring" style="--score:${score}" aria-label="${score}% de afinidad"><span>${score}<small>%</small></span><em>#${rank}</em></div>`;
}

function breakdownRow(label, value) {
  return `<div class="breakdown-row"><div><span>${escapeHtml(label)}</span><b>${value}%</b></div><div class="mini-track"><span style="width:${value}%"></span></div></div>`;
}

function careerCard(career, index) {
  const warnings = career.warnings.slice(0, 2).map((warning) => test.dimensions.constraints[warning.code]);
  const reasonNames = career.matches.interests.slice(0, 2).map((item) => item.label.toLowerCase());
  const aptitudeNames = career.matches.aptitudes.slice(0, 2).map((item) => item.label.toLowerCase());
  return `
    <article class="career-card reveal" data-career="${career.id}">
      <button class="career-summary" data-action="toggle-career" data-career-id="${career.id}" aria-expanded="${index === 0}">
        ${scoreRing(career.score, index + 1)}
        <div class="career-title">
          <span>${escapeHtml(career.family)}</span>
          <h3>${escapeHtml(career.name)}</h3>
          <p>${escapeHtml(career.label)}</p>
        </div>
        <span class="career-chevron">${icon('chevron', 22)}</span>
      </button>
      <div class="career-details ${index === 0 ? 'open' : ''}">
        <p class="career-description">${escapeHtml(career.description)}</p>
        <div class="reason-box">
          <b>Por qué aparece</b>
          <p>Tu combinación de <strong>${escapeHtml(reasonNames.join(' y '))}</strong>, junto con fortalezas en <strong>${escapeHtml(aptitudeNames.join(' y '))}</strong>, encaja con las exigencias centrales de esta carrera.</p>
        </div>
        <div class="breakdown-grid">
          ${breakdownRow('Intereses', career.breakdown.interests)}
          ${breakdownRow('Aptitudes', career.breakdown.aptitudes)}
          ${breakdownRow('Valores', career.breakdown.values)}
          ${breakdownRow('Compatibilidad', career.breakdown.constraints)}
        </div>
        <div class="detail-columns">
          <div><b>Áreas para explorar</b><div class="tag-list">${career.specializations.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div></div>
          <div><b>Actividades habituales</b><ul>${career.dailyTasks.map((task) => `<li>${escapeHtml(task)}</li>`).join('')}</ul></div>
        </div>
        ${warnings.length ? `<div class="warning-box"><b>Conviene comprobar</b><p>${escapeHtml(warnings.join(' y '))}. No descarta la carrera, pero puede afectar tu experiencia.</p></div>` : ''}
      </div>
    </article>`;
}

function renderResults() {
  const result = state.results;
  const topInterest = result.rankings.interests[0];
  const topAptitudes = result.rankings.aptitudes.slice(0, 4);
  const topValues = result.rankings.values.slice(0, 3);

  app.innerHTML = `
    <main class="results-page">
      <nav class="top-nav page-shell results-nav">
        <a class="brand" href="#" data-action="home"><span class="brand-mark">${icon('compass', 24)}</span><span>${escapeHtml(config.brand.name)}</span></a>
        <button class="button button-ghost button-small" data-action="download">${icon('download', 18)} Guardar resultado</button>
      </nav>

      <section class="result-hero page-shell">
        <div class="result-heading reveal">
          <span class="eyebrow"><span class="eyebrow-dot"></span> Tu mapa vocacional</span>
          <h1>Tu perfil combina <strong>${escapeHtml(test.dimensions.interests[topInterest[0]].toLowerCase())}</strong> con estas cinco rutas.</h1>
          <p>El código <b>${escapeHtml(result.hollandCode)}</b> resume tus intereses principales, pero el ranking también incorpora aptitudes, valores y límites personales.</p>
          <div class="result-stats">
            <div><span>${result.confidence}%</span><small>confianza del resultado</small></div>
            <div><span>${careers.careers.length}</span><small>carreras comparadas</small></div>
            <div><span>5</span><small>recomendaciones finales</small></div>
          </div>
        </div>
      </section>

      <section class="profile-section page-shell">
        <article class="profile-panel reveal">
          <div class="panel-heading"><div><span class="eyebrow">Intereses</span><h2>Tu perfil RIASEC</h2></div><span class="code-badge">${escapeHtml(result.hollandCode)}</span></div>
          <div id="interest-radar" class="radar-container"></div>
        </article>
        <article class="profile-panel reveal">
          <div class="panel-heading"><div><span class="eyebrow">Fortalezas</span><h2>Tus aptitudes más altas</h2></div></div>
          <div id="aptitude-radar" class="radar-container"></div>
          <div class="strength-list">${topAptitudes.map(([key, value]) => `<span><b>${escapeHtml(test.dimensions.aptitudes[key])}</b><em>${value}</em></span>`).join('')}</div>
        </article>
      </section>

      <section class="recommendations page-shell">
        <div class="section-heading reveal"><span class="eyebrow">Ranking personalizado</span><h2>Las cinco carreras más afines</h2><p>Abre cada opción para ver el motivo, el desglose y los puntos que conviene comprobar.</p></div>
        <div class="career-list">${result.recommendations.map(careerCard).join('')}</div>
      </section>

      <section class="values-strip page-shell reveal">
        <div><span class="eyebrow">Lo que más valoras</span><h2>${topValues.map(([key]) => test.dimensions.values[key]).join(' · ')}</h2></div>
        <p>Estas prioridades influyen en el orden final, incluso cuando dos carreras comparten intereses y habilidades similares.</p>
      </section>

      <section class="result-actions page-shell reveal">
        <div><h2>El resultado es un punto de partida</h2><p>Revisa planes de estudio, realiza un proyecto corto y conversa con profesionales antes de decidir.</p></div>
        <button class="button button-ghost" data-action="restart">${icon('rotate', 19)} Repetir prueba</button>
      </section>
      <footer class="page-shell footer">Tu información permanece en este navegador. No se envía a ningún servidor.</footer>
    </main>`;

  requestAnimationFrame(() => {
    animateIn('.reveal', 'up', 65);
    renderRadar(document.querySelector('#interest-radar'), result.profile.interests, test.dimensions.interests, { ariaLabel: 'Perfil de intereses RIASEC' });
    const aptitudeData = Object.fromEntries(topAptitudes.map(([key, value]) => [key, value]));
    renderRadar(document.querySelector('#aptitude-radar'), aptitudeData, test.dimensions.aptitudes, { ariaLabel: 'Fortalezas profesionales principales' });
  });
}

function render() {
  switch (state.screen) {
    case 'home': renderHome(); break;
    case 'test': renderQuestion(); break;
    case 'checkpoint': renderCheckpoint(); break;
    case 'processing': renderProcessing(); break;
    case 'results': renderResults(); break;
    default: renderLoading();
  }
}

function startNew() {
  state.answers = {};
  state.currentIndex = 0;
  state.results = null;
  previousProgress = 0;
  persist();
  setScreen('test');
}

function resume() {
  state.results = null;
  setScreen('test');
}

function selectAnswer(button) {
  const question = questions[state.currentIndex];
  const id = button.dataset.answer;
  if (question.type === 'ranked') {
    const selected = [...(state.answers[question.id] || [])];
    const existing = selected.indexOf(id);
    if (existing >= 0) selected.splice(existing, 1);
    else if (selected.length < 2) selected.push(id);
    else selected[1] = id;
    state.answers[question.id] = selected;
  } else {
    state.answers[question.id] = id;
  }
  persist();
  renderQuestion();
  requestAnimationFrame(() => animateSelection(document.querySelector(`[data-answer="${CSS.escape(id)}"]`)));
}

function nextQuestion() {
  const question = questions[state.currentIndex];
  if (!isAnswerComplete(question, state.answers[question.id])) return;
  if (state.currentIndex === questions.length - 1) {
    finishTest();
    return;
  }

  const nextIndex = state.currentIndex + 1;
  if (questions[nextIndex].blockId !== question.blockId) {
    state.pendingIndex = nextIndex;
    persist();
    setScreen('checkpoint');
    return;
  }

  state.currentIndex = nextIndex;
  persist();
  renderQuestion();
}

function previousQuestion() {
  if (state.currentIndex <= 0) return;
  state.currentIndex -= 1;
  persist();
  renderQuestion();
}

function continueBlock() {
  state.currentIndex = state.pendingIndex;
  state.pendingIndex = null;
  persist();
  setScreen('test');
}

function finishTest() {
  if (answeredCount() !== questions.length) return;
  setScreen('processing');
  state.results = calculateResults(test, careers, config, state.answers);
  persist();
  window.setTimeout(() => setScreen('results'), 1150);
}

function toggleCareer(id, button) {
  const card = document.querySelector(`[data-career="${CSS.escape(id)}"]`);
  const details = card?.querySelector('.career-details');
  if (!details) return;
  const open = details.classList.toggle('open');
  button.setAttribute('aria-expanded', String(open));
  if (open) requestAnimationFrame(() => animateIn(details.querySelectorAll(':scope > *'), 'up', 45));
}

function downloadResults() {
  const result = state.results;
  const text = [
    'BRÚJULA — RESULTADO VOCACIONAL',
    `Código principal: ${result.hollandCode}`,
    `Confianza: ${result.confidence}%`,
    '',
    ...result.recommendations.map((career, index) => `${index + 1}. ${career.name} — ${career.score}% (${career.label})`),
    '',
    'Este resultado es orientativo y debe complementarse con exploración académica y profesional.',
  ].join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'resultado-vocacional-brujula.txt';
  link.click();
  URL.revokeObjectURL(url);
}

function confirmRestart() {
  if (!confirm('¿Quieres borrar el progreso y comenzar una prueba nueva?')) return;
  localStorage.removeItem(config.storageKey);
  startNew();
}

app.addEventListener('click', (event) => {
  const answer = event.target.closest('[data-answer]');
  if (answer) { selectAnswer(answer); return; }

  const button = event.target.closest('[data-action]');
  if (!button) return;
  event.preventDefault();
  const action = button.dataset.action;
  if (action === 'start') startNew();
  if (action === 'resume') resume();
  if (action === 'view-results') setScreen('results');
  if (action === 'home' || action === 'exit-test') setScreen('home');
  if (action === 'restart') confirmRestart();
  if (action === 'next') nextQuestion();
  if (action === 'previous') previousQuestion();
  if (action === 'continue-block') continueBlock();
  if (action === 'toggle-career') toggleCareer(button.dataset.careerId, button);
  if (action === 'download') downloadResults();
});

async function init() {
  renderLoading();
  try {
    const loadJson = async (url) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${url}: HTTP ${response.status}`);
      }
      return response.json();
    };

    [test, careers, config] = await Promise.all([
      loadJson('./data/test.json'),
      loadJson('./data/careers.json'),
      loadJson('./data/app-config.json'),
    ]);
    questions = flattenQuestions(test);
    loadSaved();
    state.screen = 'home';
    render();
  } catch (error) {
    renderError(error);
  }
}

function loadAnimeEnhancement() {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/animejs/dist/bundles/anime.umd.min.js';
  script.async = true;
  script.dataset.optionalEnhancement = 'animejs';
  script.onerror = () => script.remove();
  document.head.appendChild(script);
}

init();
window.addEventListener('load', loadAnimeEnhancement, { once: true });
