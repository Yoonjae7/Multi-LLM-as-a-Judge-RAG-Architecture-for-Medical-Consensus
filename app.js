(function () {
  const toggle = document.querySelector('.view-toggle');
  const buttons = document.querySelectorAll('.toggle-btn');
  const homeView = document.getElementById('home-view');
  const demoView = document.getElementById('demo-view');
  const nav = document.querySelector('.nav');

  if (!toggle || !homeView || !demoView) return;

  function setView(view) {
    const isDemo = view === 'demo';

    document.body.classList.toggle('demo-mode', isDemo);
    toggle.classList.toggle('is-demo', isDemo);

    buttons.forEach(function (button) {
      const active = button.dataset.view === view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    homeView.hidden = isDemo;
    demoView.hidden = !isDemo;
    if (nav) nav.hidden = isDemo;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      setView(button.dataset.view);
    });
  });

  let requestedDemo = window.location.hash === '#demo';
  try {
    if (sessionStorage.getItem('medirag:openDemo') === '1') {
      sessionStorage.removeItem('medirag:openDemo');
      requestedDemo = true;
    }
  } catch (error) {
    // Storage can be disabled; the page still works without deep-link state.
  }

  if (requestedDemo) setView('demo');
})();
