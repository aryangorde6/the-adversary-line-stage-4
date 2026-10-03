'use strict';

const fs = require('node:fs');
const path = require('node:path');

const pages = require('./pages');
const store = require('../state');

const PAGES = {
  '/': { render: (ctx) => pages.searchPage(ctx) },
  '/signup': { render: (ctx) => pages.signupPage(ctx) },
  '/login': { render: (ctx) => pages.loginPage(ctx) },
  '/lookup': { render: (ctx) => pages.lookupPage(ctx) },
};

let cachedClient = null;

function clientSource() {
  if (cachedClient === null) {
    cachedClient = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8');
  }
  return cachedClient;
}

function isPage(pathname) {
  return Object.prototype.hasOwnProperty.call(PAGES, pathname);
}

function cookieValue(header, name) {
  const parts = String(header || '').split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.indexOf(name + '=') !== 0) continue;
    try {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    } catch {
      return '';
    }
  }
  return '';
}

// The API authenticates with a bearer token, but a page has to render who is signed in before any
// script runs, so the token also travels in a cookie the server can read. There is one source of
// truth: the token the API accepts. A cookie the API would refuse must not render a name that no
// request could use, so this resolves the token exactly the way the API does and renders a user
// only when it really authenticates.
function currentUser(ctx) {
  const token = cookieValue(ctx.req.headers.cookie, 'tk_token');
  if (!token) return null;
  const state = ctx.state || store.getState();
  const entry = (state.tokens || []).filter((candidate) => candidate.token === token)[0];
  if (!entry) return null;
  const user = store.findUserById(state, entry.user_id);
  if (!user) return null;
  return { id: user.id, display_name: user.display_name };
}

function todayIn(timezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function page(pathname, ctx) {
  const entry = PAGES[pathname];
  if (!entry) return null;
  const state = ctx.state || store.getState();
  const user = currentUser({ req: ctx.req, state });
  const base = { user, state, req: ctx.req };

  if (pathname === '/') {
    const restaurants = (state.restaurants || []).map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      timezone: restaurant.timezone,
    }));
    const first = restaurants[0];
    return entry.render(Object.assign({}, base, {
      restaurants,
      defaults: {
        restaurantId: first ? first.id : '',
        date: todayIn(first ? first.timezone : 'UTC'),
        partySize: '2',
      },
    }));
  }

  if (pathname === '/login') {
    const notice = cookieValue(ctx.req.headers.cookie, 'tk_notice');
    return entry.render(Object.assign({}, base, { notice }));
  }

  return entry.render(base);
}

function asset(name) {
  if (name !== 'client.js') return null;
  return {
    status: 200,
    type: 'text/javascript; charset=utf-8',
    body: clientSource(),
  };
}

module.exports = { page, asset, isPage, PAGES, clientSource };