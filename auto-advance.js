(() => {
  let timer = null;

  const getDelay = () => (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 90 : 360
  );

  document.addEventListener('click', (event) => {
    const answer = event.target.closest?.('[data-answer]');
    if (!answer) return;

    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const next = document.querySelector('.nav-next:not([disabled])');
      if (!next || next.offsetParent === null) return;
      next.click();
    }, getDelay());
  });
})();
