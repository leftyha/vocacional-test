
const SVG_NS = 'http://www.w3.org/2000/svg';

function polarPoint(index, total, radius, center) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
}

function svgElement(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function renderRadar(container, data, labels, options = {}) {
  const entries = Object.entries(data);
  const size = options.size || 310;
  const center = size / 2;
  const radius = size * 0.32;
  const svg = svgElement('svg', { viewBox: `0 0 ${size} ${size}`, class: 'radar-svg', role: 'img', 'aria-label': options.ariaLabel || 'Gráfica de perfil' });

  const grid = svgElement('g', { class: 'radar-grid' });
  [0.25, 0.5, 0.75, 1].forEach((level) => {
    const points = entries.map((_entry, index) => {
      const point = polarPoint(index, entries.length, radius * level, center);
      return `${point.x},${point.y}`;
    }).join(' ');
    grid.appendChild(svgElement('polygon', { points }));
  });

  entries.forEach(([key], index) => {
    const end = polarPoint(index, entries.length, radius, center);
    grid.appendChild(svgElement('line', { x1: center, y1: center, x2: end.x, y2: end.y }));

    const labelPoint = polarPoint(index, entries.length, radius + 34, center);
    const text = svgElement('text', {
      x: labelPoint.x,
      y: labelPoint.y,
      'text-anchor': Math.abs(labelPoint.x - center) < 10 ? 'middle' : labelPoint.x > center ? 'start' : 'end',
      class: 'radar-label',
    });
    const title = svgElement('tspan', { x: labelPoint.x, dy: 0 });
    title.textContent = labels[key] || key;
    const score = svgElement('tspan', { x: labelPoint.x, dy: 16, class: 'radar-label-score' });
    score.textContent = `${Math.round(data[key])}`;
    text.append(title, score);
    grid.appendChild(text);
  });

  const profilePoints = entries.map(([, value], index) => {
    const point = polarPoint(index, entries.length, radius * (value / 100), center);
    return `${point.x},${point.y}`;
  }).join(' ');
  const polygon = svgElement('polygon', { points: profilePoints, class: 'radar-profile' });
  polygon.style.transformOrigin = `${center}px ${center}px`;

  const dots = entries.map(([, value], index) => {
    const point = polarPoint(index, entries.length, radius * (value / 100), center);
    const dot = svgElement('circle', { cx: point.x, cy: point.y, r: 4.5, class: 'radar-dot' });
    dot.style.transformOrigin = `${point.x}px ${point.y}px`;
    return dot;
  });

  svg.append(grid, polygon, ...dots);
  container.replaceChildren(svg);
  requestAnimationFrame(() => animateRadar(polygon, dots));
}
