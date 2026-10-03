'use strict';

const { escapeHtml, layout } = require('./html');

function authErrorBlock() {
  return '<p class="msg error" data-testid="auth-error" role="alert" hidden></p>';
}

function searchPage({ user, restaurants, defaults }) {
  const options = restaurants
    .map((r) => `<option value="${escapeHtml(r.id)}"${r.id === defaults.restaurantId ? ' selected' : ''}>${escapeHtml(r.name)}</option>`)
    .join('');

  const body = `
<h1>Find a table</h1>
<p class="lede">Choose a restaurant, a date and how many you are, then pick a time. Tables marked
with a tick are free for your whole visit.</p>

<form class="card" id="search-form" novalidate>
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
  ${authErrorBlock()}
</form>

<p class="msg empty" data-testid="search-status" role="status" hidden></p>

<section aria-labelledby="grid-heading">
  <h2 id="grid-heading">Availability</h2>
  <div class="card">
    <p class="msg empty" data-testid="no-slots" hidden>No tables are free on this date. Try another date, or a
    smaller party, and we will find you something.</p>
    <div class="grid-scroll" data-testid="availability-grid" hidden>
      <p class="msg empty" data-testid="grid-loading" role="status">Looking for tables&hellip;</p>
      <table class="grid">
        <caption data-testid="grid-caption"></caption>
        <thead><tr data-testid="grid-head"></tr></thead>
        <tbody data-testid="grid-body"></tbody>
      </table>
    </div>
  </div>
</section>

<section aria-labelledby="booking-heading" data-testid="booking-section" hidden>
  <h2 id="booking-heading">Your booking</h2>
  <form class="card" data-testid="booking-form" novalidate>
    <p data-testid="booking-summary"></p>
    <div class="grid-fields">
      <div>
        <label for="booking-party-size">People</label>
        <input id="booking-party-size" data-testid="booking-party-size" name="party_size" type="number"
               min="1" max="20" step="1" inputmode="numeric" required>
      </div>
      <div class="row"><button type="submit" data-testid="booking-submit">Book this table</button></div>
    </div>
    <p class="msg error" data-testid="booking-error" role="alert" hidden></p>
    <p class="msg uncertain" data-testid="booking-uncertain" role="alert" hidden></p>
  </form>
</section>

<section aria-labelledby="confirmed-heading" data-testid="confirmation" hidden>
  <h2 id="confirmed-heading">Booked</h2>
  <div class="card">
    <p>Your reference is</p>
    <p class="ref" data-testid="confirmation-reference"></p>
    <p data-testid="confirmation-tables"></p>
    <p data-testid="confirmation-details"></p>
    <p class="msg good" data-testid="confirmation-note">Keep this reference. You can look the booking up any time.</p>
  </div>
</section>`;

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
<form class="card" data-testid="signup-form" novalidate>
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
  ${authErrorBlock()}
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
<form class="card" data-testid="login-form" novalidate>
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
  ${authErrorBlock()}
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
<form class="card" data-testid="lookup-form" novalidate>
  <div class="grid-fields">
    <div>
      <label for="lookup-reference-input">Booking reference</label>
      <input id="lookup-reference-input" data-testid="lookup-reference-input" name="reference" type="text"
             autocomplete="off" spellcheck="false" required style="text-transform:uppercase">
      <span class="hint">Eight letters and numbers.</span>
    </div>
    <div class="row"><button type="submit" data-testid="lookup-submit">Find booking</button></div>
  </div>
  <p class="msg error" data-testid="reservation-error" role="alert" hidden></p>
</form>

<section aria-labelledby="detail-heading" data-testid="reservation-detail" hidden>
  <h2 id="detail-heading">Your booking</h2>
  <div class="card">
    <p>Status: <span class="pill" data-testid="reservation-status"></span></p>
    <p data-testid="reservation-tables"></p>
    <dl class="facts">
      <dt>Reference</dt><dd class="ref" data-testid="reservation-reference"></dd>
      <dt>Where</dt><dd data-testid="reservation-restaurant"></dd>
      <dt>When</dt><dd data-testid="reservation-when"></dd>
      <dt>People</dt><dd data-testid="reservation-party"></dd>
    </dl>
    <div class="row" style="margin-top:1rem">
      <button type="button" class="secondary" data-testid="reservation-cancel-button">Cancel booking</button>
    </div>
  </div>
</section>`;
  return layout({ title: 'My booking', current: '/lookup', user, body, bootstrap: { signedIn: Boolean(user) } });
}

module.exports = { searchPage, signupPage, loginPage, lookupPage };