function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function fallbackAnimate(targets, keyframes, options = {}) {
  const list = typeof targets === 'string' ? [...document.querySelectorAll(targets)] :
    targets instanceof Element ? [targets] : [...(targets || [])];
  list.forEach((element, index) => {
    const delay = typeof options.delay === 'function' ? options.delay(element, index) : (options.delay || 0);
    element.animate(keyframes, {
      duration: options.duration || 350,
      easing: options.easing || 'cubic-bezier(.2,.8,.2,1)',
      fill: 'both',
      delay,
    });
  });
}

function animateIn(targets, variant = 'up', stagger = 45) {
  if (reducedMotion()) return;
  const animeAnimate = window.anime?.animate;
  const presets = {
    up: { opacity: [0, 1], y: [18, 0], scale: [0.985, 1] },
    right: { opacity: [0, 1], x: [20, 0] },
    pop: { opacity: [0, 1], scale: [0.82, 1] },
    soft: { opacity: [0, 1] },
  };
  const values = presets[variant] || presets.up;
  const elements = typeof targets === 'string' ? document.querySelectorAll(targets) : targets;
  if (animeAnimate) {
    animeAnimate(elements, {
      ...values,
      duration: 520,
      delay: (_el, i) => i * stagger,
      ease: 'out(4)',
    });
  } else {
    const from = {};
    const to = {};
    if (values.opacity) { from.opacity = values.opacity[0]; to.opacity = values.opacity[1]; }
    if (values.x) { from.transform = `translateX(${values.x[0]}px)`; to.transform = `translateX(${values.x[1]}px)`; }
    if (values.y) { from.transform = `translateY(${values.y[0]}px) scale(${values.scale?.[0] || 1})`; to.transform = `translateY(0) scale(1)`; }
    if (values.scale && !values.y) { from.transform = `scale(${values.scale[0]})`; to.transform = 'scale(1)'; }
    fallbackAnimate(elements, [from, to], { delay: (_e, i) => i * stagger, duration: 520 });
  }
}

function animateQuestion(container, direction = 1) {
  if (!container || reducedMotion()) return;
  const animeAnimate = window.anime?.animate;
  if (animeAnimate) {
    animeAnimate(container, { opacity: [0, 1], x: [direction * 24, 0], duration: 330, ease: 'out(4)' });
  } else {
    fallbackAnimate(container, [
      { opacity: 0, transform: `translateX(${direction * 24}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ], { duration: 330 });
  }
}

function animateSelection(element) {
  if (!element || reducedMotion()) return;
  const animeAnimate = window.anime?.animate;
  if (animeAnimate) {
    animeAnimate(element, { scale: [0.96, 1.025, 1], duration: 300, ease: 'out(4)' });
  } else {
    fallbackAnimate(element, [
      { transform: 'scale(.96)' },
      { transform: 'scale(1.025)' },
      { transform: 'scale(1)' },
    ], { duration: 300 });
  }
}

function animateProgress(element, from, to) {
  if (!element) return;
  if (reducedMotion()) { element.style.width = `${to}%`; return; }
  const holder = { value: from };
  const animeAnimate = window.anime?.animate;
  if (animeAnimate) {
    animeAnimate(holder, {
      value: to,
      duration: 420,
      ease: 'out(3)',
      onUpdate: () => { element.style.width = `${holder.value}%`; },
    });
  } else {
    element.animate([{ width: `${from}%` }, { width: `${to}%` }], { duration: 420, fill: 'forwards', easing: 'ease-out' });
  }
}

function animateRadar(polygon, points) {
  if (reducedMotion()) return;
  const elements = [polygon, ...points].filter(Boolean);
  const animeAnimate = window.anime?.animate;
  if (animeAnimate) {
    animeAnimate(elements, { opacity: [0, 1], scale: [0.1, 1], duration: 900, delay: (_el, i) => i * 55, ease: 'out(5)' });
  } else {
    fallbackAnimate(elements, [{ opacity: 0, transform: 'scale(.1)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 900, delay: (_e, i) => i * 55 });
  }
}
