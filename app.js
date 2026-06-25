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

    buttons.forEach(function (btn) {
      const active = btn.dataset.view === view;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    homeView.hidden = isDemo;
    demoView.hidden = !isDemo;

    if (nav) {
      nav.hidden = isDemo;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setView(btn.dataset.view);
    });
  });

  document.querySelectorAll('.demo-option').forEach(function (option) {
    option.addEventListener('click', function () {
      document.querySelectorAll('.demo-option').forEach(function (el) {
        el.classList.remove('is-selected');
      });
      option.classList.add('is-selected');
    });
  });
})();
