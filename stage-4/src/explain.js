'use strict';

// explain answers "why is this table not offered", and the whole risk of stage 3 is that it can be
// present, ordered and complete-looking while agreeing with nothing. So every value here is
// computed from the same primitives the booking path uses rather than from the answer the booking
// path reached, and nothing in this file reads `available`.
//
// The order is fixed by S3-003 and S3-004: tables in the restaurant's own fixture order, and within
// each table the rules in the order capacity then no_overlap. Both are asserted from outside, so
// they are written down once here instead of being left to however an object happened to be built.

const policy = require('./policy');
const store = require('./state');

const RULE_ORDER = ['capacity', 'no_overlap'];

// A slot's occupancy is a question about confirmed bookings only. A cancelled booking holds
// nothing, which is why S3-006 cancels one and re-reads the same slot rather than asserting the rule
// in the abstract.
function confirmedOverlaps(state, restaurantId, tableId, startMs, endMs) {
  return state.reservations.some((reservation) => {
    if (reservation.status !== 'confirmed') return false;
    if (reservation.restaurant_id !== restaurantId) return false;
    const held = Array.isArray(reservation.table_ids) ? reservation.table_ids : [];
    if (held.indexOf(tableId) === -1) return false;
    return reservation.starts_at_ms < endMs && startMs < reservation.ends_at_ms;
  });
}

// Both halves are computed here and neither is derived from the other, so S3-005's assertion that
// available equals (capacity && no_overlap) is a real comparison rather than a tautology.
function explainTable(state, restaurant, selectedPolicy, table, partySize, startMs, endMs, date) {
  const capacity = policy.policyCapacity(selectedPolicy, table.id);
  const capacityHolds = partySize <= capacity;
  // An applied closure is reported through no_overlap rather than as a third rule, so the rule list is
  // still the two S3-003 fixes and the availability the grid renders is the same conjunction.
  const noOverlapHolds = !confirmedOverlaps(state, restaurant.id, table.id, startMs, endMs)
    && !store.isTableClosed(state, restaurant.id, table.id, date);
  const rules = RULE_ORDER.map((rule) => ({
    rule,
    holds: rule === 'capacity' ? capacityHolds : noOverlapHolds,
  }));
  return {
    table_id: table.id,
    label: table.label === undefined || table.label === null ? table.id : table.label,
    capacity,
    available: capacityHolds && noOverlapHolds,
    policy_version: selectedPolicy.policy_version,
    rules,
  };
}

function explainForSlot(state, restaurant, selectedPolicy, partySize, startMs, endMs, date) {
  // The searched date travels with the call, so a closure on THAT date is the one consulted. Reading it
  // off the restaurant would consult a field no caller sets, which is the shut-day silence in a new
  // place: the answer would be silently "not closed" for every date.
  return restaurant.tables.map((table) => (
    explainTable(state, restaurant, selectedPolicy, table, partySize, startMs, endMs, date)
  ));
}

// A pair is explained as its own entry, because a pair's capacity is the sum of the selected
// policy's capacities and a pair can be available while neither member is available alone. The
// entry names the pair in the restaurant's declared order.
function explainForPair(state, restaurant, selectedPolicy, pair, partySize, startMs, endMs, date) {
  const capacity = policy.capacityUnder(selectedPolicy, pair);
  const capacityHolds = partySize <= capacity;
  // A closed table takes the pair out, for the same reason it takes the single out. A summed capacity
  // that ignored a closed member would offer a table set nobody can book, and S4-160's pair population
  // is exactly where that would show up.
  const free = pair.every((tableId) => (
    !confirmedOverlaps(state, restaurant.id, tableId, startMs, endMs)
    && !store.isTableClosed(state, restaurant.id, tableId, date)
  ));
  const noOverlapHolds = free;
  const rules = RULE_ORDER.map((rule) => ({
    rule,
    holds: rule === 'capacity' ? capacityHolds : noOverlapHolds,
  }));
  return {
    table_ids: pair.slice(),
    capacity,
    available: capacityHolds && noOverlapHolds,
    policy_version: selectedPolicy.policy_version,
    rules,
  };
}

module.exports = {
  RULE_ORDER,
  confirmedOverlaps,
  explainTable,
  explainForSlot,
  explainForPair,
};
