(() => {
  const root = document.documentElement;
  let preference = 'system';
  try {
    const saved = localStorage.getItem('theme');
    if (['light', 'dark'].includes(saved)) preference = saved;
  } catch (error) {
    // Storage may be disabled; theme changes still work for this page.
    console.warn('Theme preference cannot be read from browser storage.', error);
  }
  root.dataset.theme = preference;
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.querySelector('#theme');
    select.value = preference;
    select.parentElement.hidden = false;
    select.addEventListener('change', () => {
      root.dataset.theme = select.value;
      try {
        localStorage.setItem('theme', select.value);
      } catch (error) {
        console.warn('Theme preference cannot be saved to browser storage.', error);
      }
    });
  });
})();
