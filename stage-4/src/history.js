'use strict';

// History is a record, not a view. Every entry carries the revision that resulted from its own
// event and the terms in force after it, so reading history after two policy publications shows
// what the diner accepted at each moment rather than what the newest policy says. S3-079 is the
// row this exists for, and the reason nothing here reads the current policy is that a live read
// would be indistinguishable from a view.
//
// seq is per reservation and starts at 1, so two writes in the same second still have a total
// order (S3-073). Nothing is ever renumbered: a cancelled reservation keeps its history, and a
// no-op amendment writes nothing at all rather than consuming a seq (S3-076).

const store = require('./state');

function historyFor(state, reference) {
  const entries = state.history.filter((entry) => entry.reference === reference);
  entries.sort((a, b) => a.seq - b.seq);
  return entries;
}

function nextSeq(state, reference) {
  const entries = state.history.filter((entry) => entry.reference === reference);
  if (entries.length === 0) return 1;
  return entries.reduce((greatest, entry) => Math.max(greatest, entry.seq), 0) + 1;
}

// The three changeable fields, in the order the specification names them. The order is part of the
// assertion in S3-075, so it is written down once here rather than being left to object key order.
const CHANGE_ORDER = ['table_id', 'starts_at_local', 'party_size'];

function append(state, reservation, kind, changes, nowMs, extra) {
  // The entry names what happened in a field called event. "kind" was the first name and it reads
  // as a classification rather than as the thing that happened; event is also what a caller
  // branching on created/changed/cancelled is looking for.
  const entry = {
    reference: reservation.reference,
    seq: nextSeq(state, reservation.reference),
    at: new Date(nowMs).toISOString(),
    event: kind,
    changes: changes || [],
    revision: reservation.revision,
    accepted_terms: JSON.parse(JSON.stringify(reservation.accepted_terms)),
  };
  // `extra` carries an event's own fields rather than the booking's. A reassigned entry names the plan
  // that moved it; nothing else does, and a field only some entries have is the honest shape here --
  // every entry claiming a plan_id would be a lie about the ones that were not repairs.
  if (extra) Object.assign(entry, extra);
  state.history.push(entry);
  return entry;
}

// A creation names every field it set, each from null, because there was no previous value. A pair
// booking names table_ids instead of table_id (S3-132), so the shape follows the set rather than
// always naming the single-table field.
function creationChanges(reservation) {
  const tableIds = Array.isArray(reservation.table_ids) ? reservation.table_ids : [];
  const changes = [];
  if (tableIds.length === 1) {
    changes.push({ field: 'table_id', from: null, to: tableIds[0] });
  } else {
    changes.push({ field: 'table_ids', from: null, to: tableIds.slice() });
  }
  changes.push({ field: 'starts_at_local', from: null, to: reservation.starts_at_local });
  changes.push({ field: 'party_size', from: null, to: reservation.party_size });
  return changes;
}

// Only fields that actually changed are named. A field set to the value it already holds is absent
// rather than present with from equal to to, which is the half S3-075 asserts and the half a blanket
// "record what the patch mentioned" implementation gets wrong.
function amendmentChanges(before, after) {
  const beforeIds = Array.isArray(before.table_ids) ? before.table_ids : [];
  const afterIds = Array.isArray(after.table_ids) ? after.table_ids : [];
  const sameSet = beforeIds.length === afterIds.length && beforeIds.every((id, index) => id === afterIds[index]);
  const single = afterIds.length === 1 && beforeIds.length === 1;
  const changes = [];
  if (!sameSet) {
    if (single) changes.push({ field: 'table_id', from: beforeIds[0], to: afterIds[0] });
    else changes.push({ field: 'table_ids', from: beforeIds.slice(), to: afterIds.slice() });
  }
  if (before.starts_at_local !== after.starts_at_local) {
    changes.push({ field: 'starts_at_local', from: before.starts_at_local, to: after.starts_at_local });
  }
  if (before.party_size !== after.party_size) {
    changes.push({ field: 'party_size', from: before.party_size, to: after.party_size });
  }
  // Listed in the specification's order regardless of the order the patch mentioned them in.
  return changes.sort((a, b) => CHANGE_ORDER.indexOf(a.field) - CHANGE_ORDER.indexOf(b.field));
}

// A seating repair is its own event, not an ordinary amendment. It is distinguishable from a diner's change
// because the person who caused it was an operator closing a table, and a record that cannot tell those two
// apart cannot answer "why is this booking on a different table". The plan_id is in the entry so the repair
// can be traced to the closure that caused it.
function appendReassigned(state, reservation, beforeTableIds, planId, nowMs) {
  return append(state, reservation, 'reassigned', [
    { field: 'table_ids', from: beforeTableIds.slice(), to: (reservation.table_ids || []).slice() },
  ], nowMs, { plan_id: planId });
}

function hasHistory(state, reference) {
  return state.history.some((entry) => entry.reference === reference);
}

module.exports = {
  CHANGE_ORDER,
  historyFor,
  nextSeq,
  append,
  appendReassigned,
  creationChanges,
  amendmentChanges,
  hasHistory,
};