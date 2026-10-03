'use strict';

const COLOURS = {
  ink: '#2b2118',
  muted: '#6f5f4e',
  line: '#e3d7c6',
  paper: '#fdfaf5',
  card: '#ffffff',
  warm: '#8c3b12',
  warmSoft: '#f6e7dc',
  green: '#1f6b45',
  greenSoft: '#e3f2e9',
  red: '#9a2c1c',
  redSoft: '#fbe9e5',
  amber: '#8a5a06',
  amberSoft: '#fdf1da',
};

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function styles() {
  return `
  :root { color-scheme: light; }
  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: ${COLOURS.paper};
    color: ${COLOURS.ink};
    font: 16px/1.55 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  }
  a { color: ${COLOURS.warm}; }
  :focus-visible {
    outline: 3px solid ${COLOURS.warm};
    outline-offset: 2px;
    border-radius: 4px;
  }
  /* A native date input has its own segments inside it, and each is a separate place the keyboard
     can be. Drawing the ring on the field itself, in :focus rather than :focus-visible, is what
     keeps an indicator on screen at every one of those stops. */
  input:focus, select:focus, textarea:focus {
    outline: 3px solid ${COLOURS.warm};
    outline-offset: 1px;
  }
  input[type="date"]:focus { border-color: ${COLOURS.warm}; }
  /* A native date field holds several places the keyboard can be, and at one of them the browser
     will not even match :focus. The field's wrapper is told when the keyboard is inside it, so the
     ring can be drawn around the whole field and be seen at every one of those places. */
  [data-date-field].kb-focus { outline: 3px solid ${COLOURS.warm}; outline-offset: 2px; border-radius: 8px; }
  [data-date-field].kb-focus input { border-color: ${COLOURS.warm}; }
  .skip {
    position: absolute; left: -9999px; top: 0;
    background: ${COLOURS.card}; padding: 0.6rem 1rem; z-index: 10;
  }
  .skip:focus { left: 0.5rem; top: 0.5rem; }
  header.site {
    border-bottom: 1px solid ${COLOURS.line};
    background: ${COLOURS.card};
  }
  .bar {
    max-width: 68rem; margin: 0 auto; padding: 0.85rem 1rem;
    display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; align-items: baseline;
  }
  .brand {
    font-size: 1.3rem; font-weight: 700; letter-spacing: 0.01em;
    text-decoration: none; color: ${COLOURS.ink}; margin-right: auto;
  }
  .brand span { color: ${COLOURS.warm}; }
  nav.pages { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; }
  nav.pages a { text-decoration: none; padding: 0.2rem 0; border-bottom: 2px solid transparent; }
  nav.pages a[aria-current="page"] { border-bottom-color: ${COLOURS.warm}; color: ${COLOURS.ink}; }
  .who { display: flex; align-items: baseline; gap: 0.6rem; }
  .who span { color: ${COLOURS.muted}; font-size: 0.95rem; }
  main { max-width: 68rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
  h1 { font-size: 1.7rem; line-height: 1.2; margin: 0 0 0.35rem; }
  h2 { font-size: 1.2rem; margin: 1.8rem 0 0.6rem; }
  p.lede { color: ${COLOURS.muted}; margin: 0 0 1.4rem; max-width: 46rem; }
  .card {
    background: ${COLOURS.card}; border: 1px solid ${COLOURS.line};
    border-radius: 12px; padding: 1.1rem 1.2rem; margin: 0 0 1.2rem;
  }
  .grid-fields {
    display: grid; gap: 0.9rem 1rem;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    align-items: end;
  }
  label { display: block; font-weight: 600; font-size: 0.92rem; margin-bottom: 0.25rem; }
  .hint { display: block; font-weight: 400; color: ${COLOURS.muted}; font-size: 0.85rem; margin-top: 0.2rem; }
  input, select, button { font: inherit; color: inherit; }
  input, select {
    width: 100%; padding: 0.55rem 0.65rem; min-height: 2.75rem;
    border: 1px solid ${COLOURS.line}; border-radius: 8px; background: ${COLOURS.card};
  }
  input:invalid:not(:placeholder-shown) { border-color: ${COLOURS.red}; }
  button {
    min-height: 2.75rem; padding: 0.55rem 1.1rem; cursor: pointer;
    border: 1px solid ${COLOURS.warm}; border-radius: 8px;
    background: ${COLOURS.warm}; color: #fff; font-weight: 600;
  }
  button.secondary { background: ${COLOURS.card}; color: ${COLOURS.warm}; }
  button:hover { filter: brightness(1.06); }
  button[disabled] { opacity: 0.55; cursor: progress; }
  .row { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
  .msg { border-radius: 10px; padding: 0.7rem 0.9rem; margin: 0 0 1rem; border: 1px solid transparent; }
  .msg[hidden] { display: none; }
  .msg.error { background: ${COLOURS.redSoft}; border-color: #e8c3ba; color: ${COLOURS.red}; }
  .msg.uncertain { background: ${COLOURS.amberSoft}; border-color: #ecd6a4; color: ${COLOURS.amber}; }
  .msg.good { background: ${COLOURS.greenSoft}; border-color: #bcdfcb; color: ${COLOURS.green}; }
  .msg.empty { background: ${COLOURS.warmSoft}; border-color: #e8cdb9; color: ${COLOURS.muted}; }
  /* Looking for tables is not the same as nothing to show yet: one is dashed and open, the other is
     settled, so the two are never mistaken for each other. */
  .msg.loading {
    background: ${COLOURS.card}; border: 1px dashed #d9b89c; color: ${COLOURS.muted};
  }
  .grid-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table.grid { border-collapse: collapse; width: 100%; min-width: 34rem; }
  table.grid caption { text-align: left; color: ${COLOURS.muted}; font-size: 0.9rem; padding-bottom: 0.5rem; }
  table.grid th, table.grid td { padding: 0.3rem 0.35rem; }
  table.grid thead th {
    font-size: 0.82rem; font-weight: 600; color: ${COLOURS.muted};
    text-align: center; white-space: nowrap;
  }
  table.grid th.rowhead { text-align: left; white-space: nowrap; font-size: 0.95rem; padding-right: 0.7rem; }
  table.grid tbody tr.pair th.rowhead { color: ${COLOURS.warm}; }
  td.cell { text-align: center; }
  button.cellbtn {
    width: 100%; min-width: 3.1rem; min-height: 2.5rem; padding: 0.2rem;
    border-radius: 7px; font-size: 0.9rem; font-weight: 600;
    background: ${COLOURS.card}; color: ${COLOURS.muted}; border: 1px solid ${COLOURS.line};
  }
  button.cellbtn[data-available="true"] {
    background: ${COLOURS.greenSoft}; border-color: #a9d3bb; color: ${COLOURS.green};
  }
  button.cellbtn[data-available="true"]::after { content: "\\2713"; }
  button.cellbtn[data-available="true"]:hover { background: #d2ebdd; }
  button.cellbtn[data-available="false"] { cursor: default; opacity: 0.75; }
  button.cellbtn[data-available="false"]::after { content: "\\2013"; }
  button.cellbtn:focus-visible { outline: 3px solid ${COLOURS.warm}; outline-offset: 1px; }
  /* The table a diner has chosen must not look like one they could still choose: a different
     background, a different border and a different mark, all clear of the contrast floor. */
  button.cellbtn[data-selected="true"] {
    background: ${COLOURS.warmSoft}; border: 2px solid ${COLOURS.warm}; color: ${COLOURS.warm};
  }
  button.cellbtn[data-selected="true"]::after { content: "\\25C6"; }
  .ref {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 1.3rem; letter-spacing: 0.08em; font-weight: 700;
  }
  dl.facts { display: grid; grid-template-columns: auto 1fr; gap: 0.35rem 0.9rem; margin: 0.6rem 0 0; }
  dl.facts dt { color: ${COLOURS.muted}; font-size: 0.92rem; }
  dl.facts dd { margin: 0; }
  .pill {
    display: inline-block; padding: 0.1rem 0.55rem; border-radius: 999px;
    font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .pill.confirmed { background: ${COLOURS.greenSoft}; color: ${COLOURS.green}; }
  .pill.cancelled { background: ${COLOURS.redSoft}; color: ${COLOURS.red}; }
  footer.site {
    border-top: 1px solid ${COLOURS.line}; color: ${COLOURS.muted};
    font-size: 0.85rem; padding: 1.2rem 1rem; text-align: center;
  }
  @media (max-width: 30rem) {
    .bar { padding: 0.7rem 0.8rem; }
    main { padding: 1.1rem 0.8rem 3rem; }
    h1 { font-size: 1.45rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }`;
}

function navLinks(current) {
  const links = [
    { href: '/', label: 'Find a table' },
    { href: '/lookup', label: 'My booking' },
  ];
  return links
    .map((link) => {
      const here = link.href === current ? ' aria-current="page"' : '';
      return `<a href="${escapeHtml(link.href)}"${here}>${escapeHtml(link.label)}</a>`;
    })
    .join('');
}

function layout({ title, current, user, body, script, bootstrap }) {
  const who = user
    ? `<div class="who"><span data-testid="current-user">${escapeHtml(user.display_name)}</span>` +
      `<button type="button" class="secondary" data-testid="logout-button">Sign out</button></div>`
    : `<div class="who"><a href="/login">Sign in</a></div>`;

  const boot = bootstrap ? `<script id="tk-bootstrap" type="application/json">${JSON.stringify(bootstrap).replace(/</g, '\\u003c')}</script>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} &middot; Tablekeeper</title>
<style>${styles()}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site">
  <div class="bar">
    <a class="brand" href="/">Table<span>keeper</span></a>
    <nav class="pages" aria-label="Main">${navLinks(current)}</nav>
    ${who}
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site">Tablekeeper &middot; reservations for people who like to be seated properly</footer>
${boot}
<script src="/ui/client.js" defer></script>
</body>
</html>`;
}

module.exports = { escapeHtml, layout, styles, COLOURS };