'use strict';

const { escapeHtml, layout } = require('./html');

function searchPage({ user, restaurants, defaults }) {
  const options = restaurants
    .map((r) => `<option value="${escapeHtml(r.id)}"${r.id === defaults.restaurantId ? ' selected' : ''}>${escapeHtml(r.name)}</option>`)
    .join('');

  const body = `
<h1>Find a table</h1>
<p class="lede">Choose a restaurant, a date and how many you are, then pick a time. Tables marked
with a tick are free for your whole visit.</p>

<form class="card" id="search-form" data-msg-host novalidate>
  <div class="grid-fields">
    <div>
      <label for="restaurant-select">Restaurant</label>
      <select id="restaurant-select" data-testid="restaurant-select" name="restaurant_id">${options}</select>
    </div>
    <div>
      <label for="date-input">Date</label>
      <input id="date-input" data-testid="date-input" name="date" type="date" value="${escapeHtml(defaults.date)}" required>
      <span class="hint">Your local date at the restaurant.</span>
    </div>
    <div>
      <label for="party-size-input">People</label>
      <input id="party-size-input" data-testid="party-size-input" name="party_size" type="number"
             min="1" max="20" step="1" inputmode="numeric" value="${escapeHtml(defaults.partySize)}" required>
    </div>
    <div class="row"><button type="submit" data-testid="search-button">Search</button></div>
  </div>
</form>

<p class="msg empty" data-testid="search-status" role="status" hidden></p>

<section aria-labelledby="grid-heading">
  <h2 id="grid-heading">Availability</h2>
  <div class="card" data-testid="availability-panel" data-msg-host>
    <div class="grid-scroll" data-testid="availability-grid">
      <p class="msg empty grid-empty" data-testid="grid-empty">Choose a restaurant, a date and how many
      people are coming, then search. We will show you every table that is free for the whole of your
      visit, and any pairs of tables the restaurant sets together for larger parties.</p>
      <table class="grid" hidden>
        <caption data-testid="grid-caption"></caption>
        <thead><tr data-testid="grid-head"></tr></thead>
        <tbody data-testid="grid-body"></tbody>
      </table>
    </div>
  </div>
</section>

<section aria-labelledby="booking-heading" data-testid="booking-section" hidden>
  <h2 id="booking-heading">Your booking</h2>
  <form class="card" data-testid="booking-form" data-msg-host novalidate>
    <p data-testid="booking-summary"></p>
    <div class="grid-fields">
      <div>
        <label for="booking-party-size">People</label>
        <input id="booking-party-size" data-testid="booking-party-size" name="party_size" type="number"
               min="1" max="20" step="1" inputmode="numeric" required>
      </div>
      <div class="row"><button type="submit" data-testid="booking-submit">Book this table</button></div>
    </div>
  </form>
</section>
`;

  return layout({
    title: 'Find a table',
    current: '/',
    user,
    body,
    bootstrap: { signedIn: Boolean(user), restaurants, defaults },
  });
}

function signupPage({ user }) {
  const body = `
<h1>Create an account</h1>
<p class="lede">An account lets you book, change and cancel. It takes a moment.</p>
<form class="card" data-testid="signup-form" data-msg-host novalidate>
  <div class="grid-fields">
    <div>
      <label for="signup-display-name">Name</label>
      <input id="signup-display-name" data-testid="signup-display-name" name="display_name" type="text"
             autocomplete="name" required>
      <span class="hint">How we will greet you.</span>
    </div>
    <div>
      <label for="signup-email">Email</label>
      <input id="signup-email" data-testid="signup-email" name="email" type="email"
             autocomplete="email" required>
    </div>
    <div>
      <label for="signup-password">Password</label>
      <input id="signup-password" data-testid="signup-password" name="password" type="password"
             autocomplete="new-password" minlength="8" required>
      <span class="hint">At least 8 characters.</span>
    </div>
  </div>
  <div class="row" style="margin-top:0.9rem">
    <button type="submit" data-testid="signup-submit">Create account</button>
    <span class="hint">Already have one? <a href="/login">Sign in</a>.</span>
  </div>
</form>`;
  return layout({ title: 'Create an account', current: '/signup', user, body, bootstrap: { signedIn: Boolean(user) } });
}

function loginPage({ user, notice }) {
  const body = `
<h1>Sign in</h1>
<p class="lede">Welcome back. Your bookings are waiting.</p>
${notice ? `<p class="msg empty" role="status">${escapeHtml(notice)}</p>` : ''}
<form class="card" data-testid="login-form" data-msg-host novalidate>
  <div class="grid-fields">
    <div>
      <label for="login-email">Email</label>
      <input id="login-email" data-testid="login-email" name="email" type="email" autocomplete="email" required>
    </div>
    <div>
      <label for="login-password">Password</label>
      <input id="login-password" data-testid="login-password" name="password" type="password"
             autocomplete="current-password" required>
    </div>
  </div>
  <div class="row" style="margin-top:0.9rem">
    <button type="submit" data-testid="login-submit">Sign in</button>
    <span class="hint">No account yet? <a href="/signup">Create one</a>.</span>
  </div>
</form>`;
  return layout({ title: 'Sign in', current: '/login', user, body, bootstrap: { signedIn: Boolean(user) } });
}

function lookupPage({ user }) {
  const body = `
<h1>My booking</h1>
<p class="lede">Enter the reference from your confirmation to see the booking, or to cancel it.</p>
<form class="card" data-testid="lookup-form" data-msg-host novalidate>
  <div class="grid-fields">
    <div>
      <label for="lookup-reference-input">Booking reference</label>
      <input id="lookup-reference-input" data-testid="lookup-reference-input" name="reference" type="text"
             autocomplete="off" spellcheck="false" required style="text-transform:uppercase">
      <span class="hint">Eight letters and numbers.</span>
    </div>
    <div class="row"><button type="submit" data-testid="lookup-submit">Find booking</button></div>
  </div>
</form>

<div data-detail-host></div>`;
  return layout({ title: 'My booking', current: '/lookup', user, body, bootstrap: { signedIn: Boolean(user) } });
}

module.exports = { searchPage, signupPage, loginPage, lookupPage };