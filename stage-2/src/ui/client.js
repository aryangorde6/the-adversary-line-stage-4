(function () {
  'use strict';

  var COOKIE = 'tk_token';

  function readToken() {
    var parts = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < parts.length; i += 1) {
      var pair = parts[i].trim();
      if (pair.indexOf(COOKIE + '=') === 0) return decodeURIComponent(pair.slice(COOKIE.length + 1));
    }
    return '';
  }

  function writeToken(token) {
    document.cookie = COOKIE + '=' + encodeURIComponent(token) + '; path=/; SameSite=Lax';
  }

  function clearToken() {
    document.cookie = COOKIE + '=; path=/; Max-Age=0; SameSite=Lax';
  }

  function pick(id) {
    return document.querySelector('[data-testid="' + id + '"]');
  }

  function show(node, text) {
    if (!node) return;
    node.textContent = text;
    node.hidden = false;
  }

  function hide(node) {
    if (!node) return;
    node.textContent = '';
    node.hidden = true;
  }

  function api(method, path, body, headers) {
    var init = { method: method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined && body !== null) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    if (readToken()) init.headers.Authorization = 'Bearer ' + readToken();
    if (headers) {
      for (var name in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, name)) init.headers[name] = headers[name];
      }
    }
    return fetch(path, init).then(function (response) {
      if (response.status === 204) return { status: 204, body: null };
      return response.text().then(function (text) {
        var parsed = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch (err) {
          parsed = null;
        }
        return { status: response.status, body: parsed };
      });
    });
  }

  function boot() {
    try {
      return JSON.parse(document.getElementById('tk-bootstrap').textContent) || {};
    } catch (err) {
      return {};
    }
  }

  function messageOf(result, fallback) {
    if (result && result.body && result.body.error && result.body.error.message) {
      return result.body.error.message;
    }
    return fallback;
  }

  function codeOf(result) {
    if (result && result.body && result.body.error) return result.body.error.code || '';
    return '';
  }

  function joinList(items) {
    if (items.length === 1) return items[0];
    if (items.length === 2) return items[0] + ' and ' + items[1];
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function labelTime(startsAtLocal) {
    var parts = String(startsAtLocal || '').split('T');
    if (parts.length !== 2) return String(startsAtLocal || '');
    return parts[1].slice(0, 5);
  }

  function longDate(startsAtLocal) {
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];
    var date = String(startsAtLocal || '').slice(0, 10).split('-');
    if (date.length !== 3) return String(startsAtLocal || '');
    var made = new Date(Date.UTC(Number(date[0]), Number(date[1]) - 1, Number(date[2])));
    if (Number.isNaN(made.getTime())) return String(startsAtLocal || '');
    return days[made.getUTCDay()] + ' ' + Number(date[2]) + ' ' + months[Number(date[1]) - 1] + ' ' + date[0];
  }

  function newKey() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'tk-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  var restaurantCache = {};

  function restaurantOf(id) {
    if (restaurantCache[id]) return Promise.resolve(restaurantCache[id]);
    return api('GET', '/restaurants/' + encodeURIComponent(id)).then(function (result) {
      if (result.status !== 200 || !result.body) throw new Error('restaurant unavailable');
      restaurantCache[id] = result.body;
      return result.body;
    });
  }

  function labelForTable(restaurant, tableId) {
    var found = (restaurant.tables || []).filter(function (t) {
      return t.id === tableId;
    })[0];
    return found ? (found.label || found.id) : tableId;
  }

  var signOut = pick('logout-button');
  if (signOut) {
    signOut.addEventListener('click', function () {
      clearToken();
      window.location.href = '/';
    });
  }

  function wireAuthForm(testid, path, redirect) {
    var form = document.querySelector('[data-testid="' + testid + '"]');
    if (!form) return;
    var errorBox = pick('auth-error');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      hide(errorBox);
      var data = new FormData(form);
      var payload = {};
      for (var pair of data.entries()) payload[pair[0]] = pair[1];
      var button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      api('POST', path, payload).then(function (result) {
        if (button) button.disabled = false;
        if (result.status === 200 || result.status === 201) {
          if (result.body && result.body.token) writeToken(result.body.token);
          window.location.href = redirect;
          return;
        }
        show(errorBox, messageOf(result, 'We could not sign you in. Please try again.'));
      }).catch(function () {
        if (button) button.disabled = false;
        show(errorBox, 'We could not reach the restaurant service. Please try again.');
      });
    });
  }

  wireAuthForm('signup-form', '/auth/signup', '/');
  wireAuthForm('login-form', '/auth/login', '/');

  var searchForm = document.getElementById('search-form');
  if (searchForm) {
    var restaurantSelect = pick('restaurant-select');
    var dateInput = pick('date-input');
    var partyInput = pick('party-size-input');
    var grid = pick('availability-grid');
    var gridHead = pick('grid-head');
    var gridBody = pick('grid-body');
    var gridCaption = pick('grid-caption');
    var gridLoading = pick('grid-loading');
    var noSlots = pick('no-slots');
    var searchStatus = pick('search-status');
    var authErrorBox = pick('auth-error');
    var searchButton = pick('search-button');

    var bookingSection = pick('booking-section');
    var bookingForm = document.querySelector('[data-testid="booking-form"]');
    var bookingSummary = pick('booking-summary');
    var bookingParty = pick('booking-party-size');
    var bookingSubmit = pick('booking-submit');
    var bookingError = pick('booking-error');
    var bookingUncertain = pick('booking-uncertain');
    var confirmation = pick('confirmation');
    var confirmationRef = pick('confirmation-reference');
    var confirmationTables = pick('confirmation-tables');
    var confirmationDetails = pick('confirmation-details');

    var issued = 0;
    var applied = 0;
    var selection = null;
    var currentRestaurant = null;
    var currentSlots = [];

    function resetBooking() {
      selection = null;
      if (bookingSection) bookingSection.hidden = true;
      hide(bookingError);
      hide(bookingUncertain);
    }

    function signatureOf(choice) {
      return choice.tableIds.slice().sort().join(',') + '|' + choice.startsAtLocal + '|' + choice.partySize;
    }

    function describe(choice) {
      var labels = choice.labels;
      var when = longDate(choice.startsAtLocal) + ' at ' + labelTime(choice.startsAtLocal);
      return joinList(labels) + ' · ' + when;
    }

    function renderGrid(restaurant, slots, partySize) {
      gridHead.textContent = '';
      gridBody.textContent = '';
      while (gridHead.firstChild) gridHead.removeChild(gridHead.firstChild);

      var headCorner = document.createElement('th');
      headCorner.className = 'rowhead';
      headCorner.scope = 'col';
      headCorner.textContent = 'Table';
      gridHead.appendChild(headCorner);
      slots.forEach(function (slot) {
        var th = document.createElement('th');
        th.scope = 'col';
        th.textContent = labelTime(slot.starts_at_local);
        gridHead.appendChild(th);
      });

      var rows = [];
      (restaurant.tables || []).forEach(function (table) {
        rows.push({ kind: 'single', ids: [table.id], labels: [table.label || table.id], pair: false });
      });
      var seenPairs = {};
      slots.forEach(function (slot) {
        (slot.available_options || []).forEach(function (option) {
          if (!option.table_ids || option.table_ids.length !== 2) return;
          var key = option.table_ids.join('+');
          if (seenPairs[key]) return;
          seenPairs[key] = true;
          rows.push({
            kind: 'pair',
            ids: option.table_ids.slice(),
            labels: option.table_ids.map(function (id) {
              return labelForTable(restaurant, id);
            }),
            pair: true,
          });
        });
      });

      rows.forEach(function (row) {
        var tr = document.createElement('tr');
        if (row.pair) tr.className = 'pair';
        var th = document.createElement('th');
        th.className = 'rowhead';
        th.scope = 'row';
        th.textContent = row.pair ? 'Tables ' + joinList(row.labels) : 'Table ' + row.labels[0];
        tr.appendChild(th);

        slots.forEach(function (slot) {
          var td = document.createElement('td');
          td.className = 'cell';
          var available;
          if (row.pair) {
            var wanted = row.ids.join('+');
            available = (slot.available_options || []).some(function (option) {
              return option.table_ids && option.table_ids.join('+') === wanted;
            });
          } else {
            available = (slot.available_table_ids || []).indexOf(row.ids[0]) !== -1;
          }
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'cellbtn';
          button.setAttribute('data-available', available ? 'true' : 'false');
          button.setAttribute('data-testid', 'slot-' + row.ids.join('+') + '-' + labelTime(slot.starts_at_local));
          button.setAttribute('aria-label', (row.pair ? 'Tables ' + joinList(row.labels) : 'Table ' + row.labels[0])
            + ' at ' + labelTime(slot.starts_at_local) + (available ? ', free' : ', taken'));
          if (available) {
            button.addEventListener('click', function () {
              if (!readToken()) {
                show(authErrorBox, 'Please sign in to book a table.');
                return;
              }
              openBooking({
                tableIds: row.ids.slice(),
                labels: row.labels.slice(),
                startsAtLocal: slot.starts_at_local,
                partySize: partySize,
                restaurantId: restaurant.id,
                restaurantName: restaurant.name,
              });
            });
          }
          td.appendChild(button);
          tr.appendChild(td);
        });
        gridBody.appendChild(tr);
      });

      gridCaption.textContent = 'Free tables on ' + longDate(slots.length ? slots[0].starts_at_local : '')
        + ' for ' + partySize + ' ' + (partySize === 1 ? 'person' : 'people') + '.';
    }

    function apply(restaurant, result) {
      var slots = (result.body && result.body.slots) || [];
      currentRestaurant = restaurant;
      currentSlots = slots;
      if (!slots.length) {
        grid.hidden = true;
        hide(gridLoading);
        noSlots.hidden = false;
        resetBooking();
        return;
      }
      noSlots.hidden = true;
      grid.hidden = false;
      hide(gridLoading);
      renderGrid(restaurant, slots, Number(partyInput.value));
    }

    function refreshAvailability() {
      var query = '?restaurant_id=' + encodeURIComponent(restaurantSelect.value)
        + '&date=' + encodeURIComponent(dateInput.value)
        + '&party_size=' + encodeURIComponent(partyInput.value);
      return restaurantOf(restaurantSelect.value).then(function (restaurant) {
        return api('GET', '/availability' + query).then(function (result) {
          if (result.status !== 200) return null;
          apply(restaurant, result);
          return result;
        });
      });
    }

    function openBooking(choice) {
      hide(bookingError);
      hide(bookingUncertain);
      hide(confirmation);
      selection = choice;
      selection.signature = signatureOf(choice);
      selection.key = newKey();
      bookingSummary.textContent = describe(choice);
      bookingParty.value = String(choice.partySize);
      bookingSection.hidden = false;
      if (bookingSubmit) bookingSubmit.focus();
    }

    if (bookingForm) {
      bookingForm.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!selection) return;
        hide(bookingError);
        hide(bookingUncertain);

        var partySize = Number(bookingParty.value);
        if (!Number.isFinite(partySize) || partySize < 1) {
          show(bookingError, 'Please choose how many people are coming.');
          return;
        }
        var attempt = {
          tableIds: selection.tableIds.slice(),
          labels: selection.labels.slice(),
          startsAtLocal: selection.startsAtLocal,
          partySize: partySize,
          restaurantId: selection.restaurantId,
          restaurantName: selection.restaurantName,
        };
        var signature = signatureOf(attempt);
        if (signature !== selection.signature) {
          selection.signature = signature;
          selection.key = newKey();
        }

        var payload = {
          restaurant_id: attempt.restaurantId,
          table_ids: attempt.tableIds,
          starts_at_local: attempt.startsAtLocal,
          party_size: attempt.partySize,
        };
        if (attempt.tableIds.length === 1) payload.table_id = attempt.tableIds[0];

        if (bookingSubmit) bookingSubmit.disabled = true;
        api('POST', '/reservations', payload, { 'Idempotency-Key': selection.key }).then(function (result) {
          if (bookingSubmit) bookingSubmit.disabled = false;
          if (result.status >= 200 && result.status < 300) {
            renderConfirmation(attempt, result.body);
            return;
          }
          show(bookingError, messageOf(result, 'We could not complete that booking.'));
          if (codeOf(result) === 'table_unavailable' || result.status === 409) {
            refreshAvailability();
          }
        }).catch(function () {
          if (bookingSubmit) bookingSubmit.disabled = false;
          show(bookingUncertain,
            'We have not heard back about this booking, so we cannot say whether it went through. '
            + 'Your details are still here. Press book again and we will check safely, without booking twice.');
        });
      });
    }

    function renderConfirmation(attempt, body) {
      var reference = body && body.reference ? body.reference : '';
      var labels = attempt.labels.slice();
      var when = longDate(attempt.startsAtLocal) + ' at ' + labelTime(attempt.startsAtLocal);
      hide(bookingError);
      hide(bookingUncertain);
      confirmationRef.textContent = reference;
      confirmationTables.textContent = 'Table' + (labels.length > 1 ? 's' : '') + ' ' + joinList(labels);
      confirmationDetails.textContent = attempt.restaurantName + ' · ' + joinList(labels) + ' · ' + when
        + ' · ' + attempt.partySize + (attempt.partySize === 1 ? ' person' : ' people');
      confirmation.hidden = false;
    }

    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      hide(authErrorBox);
      var mine = issued += 1;
      searchButton.disabled = true;
      hide(searchStatus);
      if (grid) grid.hidden = false;
      hide(gridLoading);
      noSlots.hidden = true;
      resetBooking();

      restaurantOf(restaurantSelect.value).then(function (restaurant) {
        return api('GET', '/availability?restaurant_id=' + encodeURIComponent(restaurantSelect.value)
          + '&date=' + encodeURIComponent(dateInput.value)
          + '&party_size=' + encodeURIComponent(partyInput.value)).then(function (result) {
          if (mine <= applied) return;
          applied = mine;
          searchButton.disabled = false;
          if (result.status !== 200) {
            grid.hidden = true;
            hide(gridLoading);
            show(searchStatus, messageOf(result, 'We could not load availability just now.'));
            return;
          }
          apply(restaurant, result);
        });
      }).catch(function () {
        if (mine <= applied) return;
        applied = mine;
        searchButton.disabled = false;
        grid.hidden = true;
        hide(gridLoading);
        show(searchStatus, 'We could not reach the restaurant service. Please try again.');
      });
    });
  }

  var lookupForm = document.querySelector('[data-testid="lookup-form"]');
  if (lookupForm) {
    var referenceInput = pick('lookup-reference-input');
    var lookupError = pick('reservation-error');
    var detail = pick('reservation-detail');
    var statusPill = pick('reservation-status');
    var detailTables = pick('reservation-tables');
    var detailReference = pick('reservation-reference');
    var detailRestaurant = pick('reservation-restaurant');
    var detailWhen = pick('reservation-when');
    var detailParty = pick('reservation-party');
    var cancelButton = pick('reservation-cancel-button');
    var current = null;

    function labelFor(reference, tableIds) {
      if (!current || !current.restaurant) return joinList(tableIds);
      return joinList(tableIds.map(function (id) {
        return labelForTable(current.restaurant, id);
      }));
    }

    function paint(body) {
      if (body.restaurant) current = { restaurant: body.restaurant };
      if (!current) current = { restaurant: null };
      var ids = body.table_ids || (body.table_id ? [body.table_id] : []);
      detailTables.textContent = 'Table' + (ids.length > 1 ? 's' : '') + ' ' + labelFor(body.reference, ids);
      detailReference.textContent = body.reference || '';
      detailRestaurant.textContent = current.restaurant ? current.restaurant.name : '';
      detailWhen.textContent = longDate(body.starts_at_local) + ' at ' + labelTime(body.starts_at_local);
      detailParty.textContent = String(body.party_size);
      statusPill.textContent = body.status === 'cancelled' ? 'cancelled' : 'confirmed';
      statusPill.className = 'pill ' + (body.status === 'cancelled' ? 'cancelled' : 'confirmed');
      detail.hidden = false;
      if (body.status === 'cancelled' && cancelButton && cancelButton.parentNode) {
        cancelButton.parentNode.removeChild(cancelButton);
      }
    }

    function load(reference) {
      return api('GET', '/reservations/' + encodeURIComponent(reference)).then(function (result) {
        if (result.status !== 200 || !result.body) {
          detail.hidden = true;
          show(lookupError, messageOf(result, 'We could not find that booking.'));
          return false;
        }
        var body = result.body;
        hide(lookupError);
        if (current && current.restaurant) {
          paint(body);
          return true;
        }
        return restaurantOf(body.restaurant_id).then(function (restaurant) {
          paint(Object.assign({}, body, { restaurant: restaurant }));
          return true;
        }).catch(function () {
          paint(body);
          return true;
        });
      });
    }

    lookupForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var reference = String(referenceInput.value || '').trim().toUpperCase();
      if (!reference) {
        show(lookupError, 'Please enter the reference from your confirmation.');
        return;
      }
      hide(lookupError);
      load(reference).catch(function () {
        show(lookupError, 'We could not reach the restaurant service. Please try again.');
      });
    });

    if (cancelButton) {
      cancelButton.addEventListener('click', function () {
        if (!current) return;
        var reference = detailReference.textContent;
        cancelButton.disabled = true;
        api('POST', '/reservations/' + encodeURIComponent(reference) + '/cancel').then(function (result) {
          cancelButton.disabled = false;
          if (result.status === 200 && result.body) {
            hide(lookupError);
            paint(result.body);
            return;
          }
          show(lookupError, messageOf(result, 'We could not cancel that booking.'));
        }).catch(function () {
          cancelButton.disabled = false;
          show(lookupError, 'We could not reach the restaurant service. Please try again.');
        });
      });
    }
  }
})();