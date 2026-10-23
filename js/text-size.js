/*
 * Text-size control (A / A+ / A++) shown in every page header.
 *
 * A classic script loaded in <head>, so the saved size is applied before the page paints
 * (no flash of small text). Every font size in the stylesheets is written as
 * calc(<size> * var(--ts, 1)), so one variable on <html> scales all page text.
 * SVG drawings are not scaled by it: they already grow with their container.
 * The choice is kept in this browser only (localStorage, wrapped in try/catch because
 * storage can be blocked, for example in some Canvas embeds or private windows).
 */
(function () {
  var KEY = 'ipl-text-size';
  var SIZES = [
    { id: 'base', label: 'A', name: 'standard text', scale: 1 },
    { id: 'large', label: 'A+', name: 'large text', scale: 1.15 },
    { id: 'xlarge', label: 'A++', name: 'extra-large text', scale: 1.3 },
  ];
  var root = document.documentElement;

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(id) {
    try { localStorage.setItem(KEY, id); } catch (e) { /* storage unavailable: size lasts for this page only */ }
  }
  function apply(id) {
    var size = SIZES.filter(function (s) { return s.id === id; })[0] || SIZES[0];
    root.style.setProperty('--ts', String(size.scale));
    root.dataset.textSize = size.id;
    return size.id;
  }

  var current = apply(read());

  function build() {
    var header = document.querySelector('.site-header');
    if (!header || header.querySelector('.text-size')) return;
    var group = document.createElement('div');
    group.className = 'text-size';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Text size');
    var caption = document.createElement('span');
    caption.className = 'text-size-caption';
    caption.textContent = 'Text';
    caption.setAttribute('aria-hidden', 'true');
    group.appendChild(caption);
    SIZES.forEach(function (size) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'text-size-' + size.id;
      // Visible "A+" stays part of the accessible name ("A+ large text").
      button.textContent = size.label;
      var hint = document.createElement('span');
      hint.className = 'sr-only';
      hint.textContent = ' ' + size.name;
      button.appendChild(hint);
      button.title = size.name.charAt(0).toUpperCase() + size.name.slice(1);
      button.setAttribute('aria-pressed', String(size.id === current));
      button.addEventListener('click', function () {
        current = apply(size.id);
        save(current);
        group.querySelectorAll('button').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === button));
        });
        // Layout-dependent widgets (e.g. the graph-column resizer) re-measure on resize.
        window.dispatchEvent(new Event('resize'));
      });
      group.appendChild(button);
    });
    // Keep the header's two-sided layout: brand on the left, tools on the right.
    var tools = document.createElement('div');
    tools.className = 'header-tools';
    var last = header.lastElementChild;
    if (last && !last.classList.contains('brand')) tools.appendChild(last);
    tools.insertBefore(group, tools.firstChild);
    header.appendChild(tools);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
