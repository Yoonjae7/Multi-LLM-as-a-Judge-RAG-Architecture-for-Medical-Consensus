(function () {
  const diagram = document.getElementById('arch-diagram');
  if (!diagram) return;

  const nodes = diagram.querySelectorAll('.arch-node[data-tooltip]');
  nodes.forEach(function (node) {
    const tooltip = document.createElement('div');
    tooltip.className = 'node-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.textContent = node.getAttribute('data-tooltip');
    node.appendChild(tooltip);
  });

  const layers = diagram.querySelectorAll('.layer-animate');
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  layers.forEach(function (layer) {
    observer.observe(layer);
  });
})();
