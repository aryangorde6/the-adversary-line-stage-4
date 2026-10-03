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
    node.hidden = true;
  }

  // auth-error, booking-error, booking-uncertain and reservation-error are specified as present only
  // in their state, so they are inserted when there is something to say and removed when there is
  // not. A permanently hidden element would let an assertion pass against something no diner can
  // see, and it would put a testid in the document that the product can never actually produce.
  var KINDS = { error: 'msg error', uncertain: 'msg uncertain', empty: 'msg empty',
    loading: 'msg loading' };

  function hostFor(key) {
    if (!key) return document.querySelector('[data-msg-host]');
    return pick(key) || document.getElementById(key);
  }

  function showMessage(hostTestId, testid, kind, text) {
    var host = hostFor(hostTestId);
    if (!host) return null;
    var node = host.querySelector('[data-testid="' + testid + '"]');
    if (!node) {
      node = document.createElement('p');
      node.className = KINDS[kind] || KINDS.error;
      node.setAttribute('data-testid', testid);
      node.setAttribute('role', kind === 'empty' || kind === 'loading' ? 'status' : 'alert');
      host.appendChild(node);
    }
    node.textContent = text;
    return node;
  }

  function clearMessage(hostTestId, testid) {
    var host = hostFor(hostTestId);
    if (!host) return;
    var node = host.querySelector('[data-testid="' + testid + '"]');
    if (node && node.parentNode) node.parentNode.removeChild(node);
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
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearMessage(testid, 'auth-error');
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
        showMessage(testid, 'auth-error', 'error',
          messageOf(result, 'We could not sign you in. Please try again.'));
      }).catch(function () {
        if (button) button.disabled = false;
        showMessage(testid, 'auth-error', 'error',
          'We could not reach the restaurant service. Please try again.');
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
    var searchStatus = pick('search-status');

    // These regions are removed from the document when their state does not exist, so the handles
    // below are re-bound every time a region is built rather than captured once at load.
    var grid = null;
    var gridHead = null;
    var gridBody = null;
    var gridCaption = null;
    var gridEmpty = null;
    var gridTable = null;
    var bookingSection = null;
    var bookingForm = null;
    var bookingSummary = null;
    var bookingParty = null;
    var bookingSubmit = null;

    // The date field's wrapper carries the focus ring, because the browser stops matching :focus on
    // one of the field's inner segments while the keyboard is still inside it.
    //
    // The ring is not stored, it is read: on every event that could mean the keyboard has arrived,
    // gone, or arrived again, the class is recomputed from where the focus actually is. An earlier
    // version added the class on focusin and removed it on three different exits, and that left the
    // ring dead after the two exits which fire without any focus event -- the window losing focus,
    // and the page being hidden -- because coming back fires no focus event either, so nothing put
    // the class back. Recomputing means no path can leave it stale.
    //
    // One rule, not two: the ring says where the keyboard is, and nothing else. Losing the window
    // is not the keyboard leaving the field, so nothing clears the ring when the window goes; the
    // ring goes when the focus goes and comes back when the focus comes back.
    var dateField = document.querySelector('[data-date-field]');
    if (dateField) {
      var syncDateRing = function () {
        var inside = dateField.contains(document.activeElement);
        dateField.classList.toggle('kb-focus', inside);
      };
      // focusout is in the list because a field can also be emptied without any other event:
      // calling blur() on it fires this and nothing else, and a ring left on a field the keyboard
      // has left is the same defect as a ring missing from one the keyboard is inside.
      ['focusin', 'focusout', 'focus', 'pointerdown', 'keydown', 'touchstart'].forEach(function (name) {
        document.addEventListener(name, syncDateRing, true);
      });
      document.addEventListener('visibilitychange', syncDateRing);
      window.addEventListener('focus', syncDateRing);
      // No timer. An earlier version recomputed the ring twice a second as well, on the belief that
      // focus could return to the field without firing any event. Measured, it cannot: every way the
      // focus arrives fires something this list already hears, and the paths that change the page
      // rather than the focus leave the containment answer unchanged. A poll that fixes nothing is a
      // mechanism nobody can later justify, so it is gone rather than defended.
      syncDateRing();
    }

    var issued = 0;
    var applied = 0;
    var selection = null;
    var currentRestaurant = null;
    var currentSlots = [];
    var selectedCellId = null;

    bindGrid();
    bindBooking();

    // The results region exists only while there is something to show results in: it is built on
    // load and rebuilt after a search, and taken out of the document entirely when the day has no
    // slots, because "shown instead of the grid" is not satisfied by a grid left behind, hidden.
    function bindGrid() {
      grid = pick('availability-grid');
      gridEmpty = grid ? grid.querySelector('[data-testid="grid-empty"]') : null;
      gridTable = grid ? grid.querySelector('table') : null;
      gridHead = pick('grid-head');
      gridBody = pick('grid-body');
      gridCaption = pick('grid-caption');
    }

    function buildGridRegion() {
      if (pick('availability-grid')) {
        bindGrid();
        return;
      }
      var host = pick('availability-panel') || searchForm.parentNode;
      var region = document.createElement('div');
      region.className = 'grid-scroll';
      region.setAttribute('data-testid', 'availability-grid');
      var empty = document.createElement('p');
      empty.className = 'msg empty grid-empty';
      empty.setAttribute('data-testid', 'grid-empty');
      empty.textContent = 'Choose a restaurant, a date and how many people are coming, then search. '
        + 'We will show you every table that is free for the whole of your visit, and any pairs of '
        + 'tables the restaurant sets together for larger parties.';
      var table = document.createElement('table');
      table.className = 'grid';
      table.hidden = true;
      var caption = document.createElement('caption');
      caption.setAttribute('data-testid', 'grid-caption');
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      headRow.setAttribute('data-testid', 'grid-head');
      thead.appendChild(headRow);
      var tbody = document.createElement('tbody');
      tbody.setAttribute('data-testid', 'grid-body');
      table.appendChild(caption);
      table.appendChild(thead);
      table.appendChild(tbody);
      region.appendChild(empty);
      region.appendChild(table);
      host.insertBefore(region, host.firstChild);
      bindGrid();
    }

    function removeGridRegion() {
      var existing = pick('availability-grid');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      bindGrid();
    }

    // The booking form exists only while a booking is being made: it is built when a free table is
    // chosen and taken out again when that attempt is abandoned or the search changes.
    function bindBooking() {
      bookingSection = pick('booking-section');
      bookingForm = bookingSection ? bookingSection.querySelector('[data-testid="booking-form"]') : null;
      bookingSummary = pick('booking-summary');
      bookingParty = pick('booking-party-size');
      bookingSubmit = pick('booking-submit');
    }

    function removeBooking() {
      var existing = pick('booking-section');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      bindBooking();
    }

    function buildBooking() {
      if (pick('booking-section')) {
        bindBooking();
        return;
      }
      var section = document.createElement('section');
      section.setAttribute('aria-labelledby', 'booking-heading');
      section.setAttribute('data-testid', 'booking-section');
      var heading = document.createElement('h2');
      heading.setAttribute('id', 'booking-heading');
      heading.textContent = 'Your booking';
      var form = document.createElement('form');
      form.className = 'card';
      form.setAttribute('data-testid', 'booking-form');
      form.setAttribute('data-msg-host', '');
      form.setAttribute('novalidate', '');
      var summary = document.createElement('p');
      summary.setAttribute('data-testid', 'booking-summary');
      var fields = document.createElement('div');
      fields.className = 'grid-fields';
      var field = document.createElement('div');
      var label = document.createElement('label');
      label.setAttribute('for', 'booking-party-size');
      label.textContent = 'People';
      var input = document.createElement('input');
      input.setAttribute('id', 'booking-party-size');
      input.setAttribute('data-testid', 'booking-party-size');
      input.setAttribute('name', 'party_size');
      input.setAttribute('type', 'number');
      input.setAttribute('min', '1');
      input.setAttribute('max', '20');
      input.setAttribute('step', '1');
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('required', '');
      var actions = document.createElement('div');
      actions.className = 'row';
      actions.style.marginTop = '0.9rem';
      var submit = document.createElement('button');
      submit.setAttribute('type', 'submit');
      submit.setAttribute('data-testid', 'booking-submit');
      submit.textContent = 'Book this table';
      actions.appendChild(submit);
      field.appendChild(label);
      field.appendChild(input);
      fields.appendChild(field);
      fields.appendChild(actions);
      form.appendChild(summary);
      form.appendChild(fields);
      section.appendChild(heading);
      section.appendChild(form);
      searchForm.parentNode.appendChild(section);
      bindBooking();
    }

    function resetBooking() {
      selection = null;
      selectedCellId = null;
      markSelected();
      removeBooking();
      removeConfirmation();
      clearMessage('booking-form', 'booking-error');
      clearMessage('booking-form', 'booking-uncertain');
    }

    // A confirmation that belongs to an attempt which did not go through is not a confirmation: it
    // is built when a booking succeeds and torn out when an attempt fails or is abandoned, so the
    // two can never be on the page together.
    function removeConfirmation() {
      var existing = pick('confirmation');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    }

    function buildConfirmation() {
      removeConfirmation();
      var section = document.createElement('section');
      section.setAttribute('aria-labelledby', 'confirmed-heading');
      section.setAttribute('data-testid', 'confirmation');
      var heading = document.createElement('h2');
      heading.setAttribute('id', 'confirmed-heading');
      heading.textContent = 'Booked';
      var card = document.createElement('div');
      card.className = 'card';
      var lead = document.createElement('p');
      lead.textContent = 'Your reference is';
      var reference = document.createElement('p');
      reference.className = 'ref';
      reference.setAttribute('data-testid', 'confirmation-reference');
      var tables = document.createElement('p');
      tables.setAttribute('data-testid', 'confirmation-tables');
      var details = document.createElement('p');
      details.setAttribute('data-testid', 'confirmation-details');
      var note = document.createElement('p');
      note.className = 'msg good';
      note.setAttribute('data-testid', 'confirmation-note');
      note.textContent = 'Keep this reference. You can look the booking up any time.';
      [lead, reference, tables, details, note].forEach(function (node) { card.appendChild(node); });
      section.appendChild(heading);
      section.appendChild(card);
      searchForm.parentNode.appendChild(section);
      return {
        reference: reference,
        tables: tables,
        details: details,
      };
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
          var cellId = 'slot-' + row.ids.join('+') + '-' + labelTime(slot.starts_at_local);
          button.setAttribute('data-testid', cellId);
          if (selectedCellId === cellId) button.setAttribute('data-selected', 'true');
          button.setAttribute('aria-label', (row.pair ? 'Tables ' + joinList(row.labels) : 'Table ' + row.labels[0])
            + ' at ' + labelTime(slot.starts_at_local) + (available ? ', free' : ', taken'));
          if (available) {
            button.addEventListener('click', function () {
              if (!readToken()) {
                showMessage('search-form', 'auth-error', 'error', 'Please sign in to book a table.');
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
          } else {
            // A cell that is not free is inert: it cannot be activated by a click, a tap or a key,
            // so it can never open a booking form for a table the diner cannot have.
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
          }
          td.appendChild(button);
          tr.appendChild(td);
        });
        gridBody.appendChild(tr);
      });

      gridCaption.textContent = 'Free tables on ' + longDate(slots.length ? slots[0].starts_at_local : '')
        + ' for ' + partySize + ' ' + (partySize === 1 ? 'person' : 'people') + '.';
    }

    // A day with no slots is a day the restaurant is not serving, which is a different thing from a
    // day whose tables are all taken. Saying "no tables are free" when the doors are shut would be
    // a claim about the restaurant that is not true.
    function closedDayText(restaurant) {
      var name = restaurant && restaurant.name ? restaurant.name : 'The restaurant';
      return name + ' is closed on ' + longDate(dateInput.value) + ', so there is nothing to book that day. '
        + 'Try another date, or a smaller party on a day it is open.';
    }

    function apply(restaurant, result) {
      var slots = (result.body && result.body.slots) || [];
      currentRestaurant = restaurant;
      currentSlots = slots;
      if (!slots.length) {
        clearMessage('availability-panel', 'grid-loading');
        removeGridRegion();
        showMessage('availability-panel', 'no-slots', 'empty', closedDayText(restaurant));
        resetBooking();
        return;
      }
      clearMessage('availability-panel', 'no-slots');
      buildGridRegion();
      grid.hidden = false;
      if (gridTable) gridTable.hidden = false;
      if (gridEmpty) gridEmpty.hidden = true;
      clearMessage('availability-panel', 'grid-loading');
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

    // The cell the diner has chosen is marked in the grid itself, so the state they are in is
    // visible where they chose it and not only in the form below.
    function markSelected() {
      var cells = document.querySelectorAll('[data-selected], [data-testid^="slot-"]');
      for (var i = 0; i < cells.length; i += 1) {
        var cell = cells[i];
        if (cell.getAttribute('data-testid') === selectedCellId) cell.setAttribute('data-selected', 'true');
        else cell.removeAttribute('data-selected');
      }
    }

    function openBooking(choice) {
      clearMessage('booking-form', 'booking-error');
      clearMessage('booking-form', 'booking-uncertain');
      removeConfirmation();
      buildBooking();
      selectedCellId = 'slot-' + choice.tableIds.join('+') + '-' + labelTime(choice.startsAtLocal);
      markSelected();
      selection = choice;
      selection.signature = signatureOf(choice);
      selection.key = newKey();
      bookingSummary.textContent = describe(choice);
      bookingParty.value = String(choice.partySize);
      if (bookingSubmit) bookingSubmit.focus();
    }

    // The form is built when a free table is chosen, so its submit is caught once on the document
    // rather than bound to an element that may not exist yet.
    document.addEventListener('submit', function (event) {
      var form = event.target;
      if (!form || form.getAttribute('data-testid') !== 'booking-form') return;
      {
        event.preventDefault();
        if (!selection) return;
        clearMessage('booking-form', 'booking-error');
        clearMessage('booking-form', 'booking-uncertain');

        var partySize = Number(bookingParty.value);
        if (!Number.isFinite(partySize) || partySize < 1) {
          showMessage('booking-form', 'booking-error', 'error', 'Please choose how many people are coming.');
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

        if (bookingSubmit) bookingSubmit.disabled = true;
        api('POST', '/reservations', payload, { 'Idempotency-Key': selection.key }).then(function (result) {
          if (bookingSubmit) bookingSubmit.disabled = false;
          if (result.status >= 200 && result.status < 300) {
            renderConfirmation(attempt, result.body);
            return;
          }
          removeConfirmation();
          showMessage('booking-form', 'booking-error', 'error', messageOf(result, 'We could not complete that booking.'));
          if (codeOf(result) === 'table_unavailable' || result.status === 409) {
            refreshAvailability();
          }
        }).catch(function () {
          if (bookingSubmit) bookingSubmit.disabled = false;
          removeConfirmation();
          showMessage('booking-form', 'booking-uncertain', 'uncertain',
            'We have not heard back about this booking, so we cannot say whether it went through. '
            + 'Your details are still here. Press book again and we will check safely, without booking twice.');
        });
      }
    });

    function renderConfirmation(attempt, body) {
      var reference = body && body.reference ? body.reference : '';
      var labels = attempt.labels.slice();
      var when = longDate(attempt.startsAtLocal) + ' at ' + labelTime(attempt.startsAtLocal);
      clearMessage('booking-form', 'booking-error');
      clearMessage('booking-form', 'booking-uncertain');
      var parts = buildConfirmation();
      parts.reference.textContent = reference;
      parts.tables.textContent = 'Table' + (labels.length > 1 ? 's' : '') + ' ' + joinList(labels);
      parts.details.textContent = attempt.restaurantName + ' · ' + joinList(labels) + ' · ' + when
        + ' · ' + attempt.partySize + (attempt.partySize === 1 ? ' person' : ' people');
    }

    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      clearMessage('search-form', 'auth-error');
      var mine = issued += 1;
      hide(searchStatus);
      buildGridRegion();
      grid.hidden = false;
      if (gridEmpty) gridEmpty.hidden = true;
      if (gridTable) gridTable.hidden = true;
      showMessage('availability-panel', 'grid-loading', 'loading', 'Looking for tables' + String.fromCharCode(8230));
      clearMessage('availability-panel', 'no-slots');
      resetBooking();

      restaurantOf(restaurantSelect.value).then(function (restaurant) {
        return api('GET', '/availability?restaurant_id=' + encodeURIComponent(restaurantSelect.value)
          + '&date=' + encodeURIComponent(dateInput.value)
          + '&party_size=' + encodeURIComponent(partyInput.value)).then(function (result) {
          if (mine <= applied) return;
          applied = mine;
          if (result.status !== 200) {
            clearMessage('availability-panel', 'grid-loading');
            if (gridEmpty) gridEmpty.hidden = false;
            show(searchStatus, messageOf(result, 'We could not load availability just now.'));
            return;
          }
          apply(restaurant, result);
        });
      }).catch(function () {
        if (mine <= applied) return;
        applied = mine;
        if (gridEmpty) gridEmpty.hidden = false;
        clearMessage('availability-panel', 'grid-loading');
        show(searchStatus, 'We could not reach the restaurant service. Please try again.');
      });
    });
  }

  var lookupForm = document.querySelector('[data-testid="lookup-form"]');
  if (lookupForm) {
    var referenceInput = pick('lookup-reference-input');
    var detailHost = document.querySelector('[data-detail-host]');
    var current = null;

    // A booking that was not found must leave nothing behind that reads like one. The detail
    // section is built when a booking is found and torn out when one is not, so reservation-detail,
    // reservation-status and reservation-cancel-button are absent from the document rather than
    // present and invisible.
    function removeDetail() {
      var existing = pick('reservation-detail');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    }

    function buildDetail() {
      removeDetail();
      var section = document.createElement('section');
      section.setAttribute('aria-labelledby', 'detail-heading');
      section.setAttribute('data-testid', 'reservation-detail');
      var heading = document.createElement('h2');
      heading.setAttribute('id', 'detail-heading');
      heading.textContent = 'Your booking';
      var card = document.createElement('div');
      card.className = 'card';

      var statusLine = document.createElement('p');
      statusLine.appendChild(document.createTextNode('Status: '));
      var pill = document.createElement('span');
      pill.className = 'pill';
      pill.setAttribute('data-testid', 'reservation-status');
      statusLine.appendChild(pill);

      var tables = document.createElement('p');
      tables.setAttribute('data-testid', 'reservation-tables');

      var facts = document.createElement('dl');
      facts.className = 'facts';
      [['Reference', 'reservation-reference', true], ['Where', 'reservation-restaurant', false],
       ['When', 'reservation-when', false], ['People', 'reservation-party', false]]
        .forEach(function (row) {
          var dt = document.createElement('dt');
          dt.textContent = row[0];
          var dd = document.createElement('dd');
          dd.setAttribute('data-testid', row[1]);
          if (row[2]) dd.className = 'ref';
          facts.appendChild(dt);
          facts.appendChild(dd);
        });

      var row = document.createElement('div');
      row.className = 'row';
      row.style.marginTop = '1rem';
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'secondary';
      cancel.setAttribute('data-testid', 'reservation-cancel-button');
      cancel.textContent = 'Cancel booking';
      row.appendChild(cancel);

      card.appendChild(statusLine);
      card.appendChild(tables);
      card.appendChild(facts);
      card.appendChild(row);
      section.appendChild(heading);
      section.appendChild(card);
      detailHost.appendChild(section);
      return {
        section: section,
        statusPill: pill,
        tables: tables,
        cancelButton: cancel,
        reference: facts.querySelector('[data-testid="reservation-reference"]'),
        restaurant: facts.querySelector('[data-testid="reservation-restaurant"]'),
        when: facts.querySelector('[data-testid="reservation-when"]'),
        party: facts.querySelector('[data-testid="reservation-party"]'),
      };
    }

    function labelFor(reference, tableIds) {
      if (!current || !current.restaurant) return joinList(tableIds);
      return joinList(tableIds.map(function (id) {
        return labelForTable(current.restaurant, id);
      }));
    }

    function paint(body) {
      if (body.restaurant) current = { restaurant: body.restaurant };
      if (!current) current = { restaurant: null };
      var parts = pick('reservation-detail') ? {
        statusPill: pick('reservation-status'),
        tables: pick('reservation-tables'),
        cancelButton: pick('reservation-cancel-button'),
        reference: pick('reservation-reference'),
        restaurant: pick('reservation-restaurant'),
        when: pick('reservation-when'),
        party: pick('reservation-party'),
      } : buildDetail();
      var ids = body.table_ids || (body.table_id ? [body.table_id] : []);
      parts.tables.textContent = 'Table' + (ids.length > 1 ? 's' : '') + ' ' + labelFor(body.reference, ids);
      parts.reference.textContent = body.reference || '';
      parts.restaurant.textContent = current.restaurant ? current.restaurant.name : '';
      parts.when.textContent = longDate(body.starts_at_local) + ' at ' + labelTime(body.starts_at_local);
      parts.party.textContent = String(body.party_size);
      parts.statusPill.textContent = body.status === 'cancelled' ? 'cancelled' : 'confirmed';
      parts.statusPill.className = 'pill ' + (body.status === 'cancelled' ? 'cancelled' : 'confirmed');
      if (body.status === 'cancelled' && parts.cancelButton && parts.cancelButton.parentNode) {
        parts.cancelButton.parentNode.removeChild(parts.cancelButton);
      }
      return parts;
    }

    function load(reference) {
      return api('GET', '/reservations/' + encodeURIComponent(reference)).then(function (result) {
        if (result.status !== 200 || !result.body) {
          removeDetail();
          showMessage('lookup-form', 'reservation-error', 'error', messageOf(result, 'We could not find that booking.'));
          return false;
        }
        var body = result.body;
        clearMessage('lookup-form', 'reservation-error');
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
        showMessage('lookup-form', 'reservation-error', 'error',
          'Please enter the reference from your confirmation.');
        return;
      }
      clearMessage('lookup-form', 'reservation-error');
      load(reference).catch(function () {
        showMessage('lookup-form', 'reservation-error', 'error', 'We could not reach the restaurant service. Please try again.');
      });
    });

    // The cancel button is created with the detail section, so the handler is bound once on the
    // host and reads whichever button is currently in the document.
    detailHost.addEventListener('click', function (event) {
      var button = event.target && event.target.closest
        ? event.target.closest('[data-testid="reservation-cancel-button"]')
        : null;
      if (!button) return;
      if (!current) return;
      var referenceNode = pick('reservation-reference');
      var reference = referenceNode ? referenceNode.textContent.trim() : '';
      if (!reference) return;
      button.disabled = true;
      api('POST', '/reservations/' + encodeURIComponent(reference) + '/cancel').then(function (result) {
        button.disabled = false;
        if (result.status === 200 && result.body) {
          clearMessage('lookup-form', 'reservation-error');
          paint(result.body);
          return;
        }
        showMessage('lookup-form', 'reservation-error', 'error', messageOf(result, 'We could not cancel that booking.'));
      }).catch(function () {
        button.disabled = false;
        showMessage('lookup-form', 'reservation-error', 'error', 'We could not reach the restaurant service. Please try again.');
      });
    });
  }
})();
