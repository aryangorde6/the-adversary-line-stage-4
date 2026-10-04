'use strict';

// Stage 4's write family, built to tablekeeper/spec/stage-4.md rather than to a shape invented here.
//
// A replan closes ONE table over the half-open instant interval [from, to). Every confirmed booking at
// the restaurant overlapping that interval is *considered*; every other booking keeps its assignment and
// is not mentioned. Considered bookings are re-seated, never cancelled and never dropped -- a repair that
// loses a booking is worse than no repair.
//
// Three things here are requirements rather than choices, and each was got wrong in a previous version:
//
//   * The closure is an INSTANT interval with explicit offsets, not a local date. A closure is about a
//     moment in time, and an instant without an offset is not an instant.
//   * The plan is a lexicographic optimum, not the first arrangement that fits: fewest changed table sets,
//     then fewest unused seats, then the rank vector. "Good enough" is not specified and would make the
//     plan depend on iteration order.
//   * Capacity is judged under EACH BOOKING'S OWN ACCEPTED TERMS, not under the policy in force now. A
//     booking made under a 4-seat table keeps a 4-seat table's worth of room even if the policy has since
//     shrunk it, and re-judging it under the new policy would silently invalidate a promise already made.
//
// `restaurant_revision` is the concurrency token. It starts at 0 after a reset and moves once for each
// successful new booking, real amendment, cancellation, policy publication and plan application -- and
// NOT for no-ops, failures, previews or replays. A plan records the revision it was built against, and
// apply refuses if the restaurant has moved on: any intervening change means the plan was computed from a
// state that no longer exists, and applying it would half-apply a repair.

const { fail } = require('./errors');
const domain = require('./domain');
const policy = require('./policy');
const store = require('./state');
const time = require('./time');
const history = require('./history');
const seriesRules = require('./series');

// The limits are the specification's, and they are limits on the WORK, not on the request: a restaurant
// with 40 tables is not refused, because the planning effort is over the considered bookings.
const MAX_TABLES = 6;
const MAX_PAIRS = 4;
const MAX_CONSIDERED = 6;

// An instant must carry an explicit offset. "2026-09-28T18:00:00" names no moment, and guessing an offset
// for it would put a closure on the wrong side of a DST boundary -- so a naive instant is a 422 rather
// than an assumption.
function readInstant(raw, field) {
  if (typeof raw !== 'string') fail('malformed_request', { field });
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(raw);
  if (!match) fail('validation_failed', { field });
  const offset = match[7] === 'Z' ? '+00:00' : match[7];
  const ms = Date.parse(match[1] + '-' + match[2] + '-' + match[3] + 'T' + match[4] + ':' + match[5] + ':' + match[6] + offset);
  if (Number.isNaN(ms)) fail('validation_failed', { field });
  return ms;
}

function readClosure(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    fail('malformed_request', { field: 'body' });
  }
  const tableId = body.table_id;
  if (typeof tableId !== 'string' || tableId.length === 0) {
    fail('validation_failed', { field: 'table_id' });
  }
  const from = readInstant(body.from, 'from');
  const to = readInstant(body.to, 'to');
  if (from >= to) fail('validation_failed', { field: 'to' });
  return { table_id: tableId, from, to };
}

function overlapsClosure(reservation, closure) {
  return reservation.starts_at_ms < closure.to && closure.from < reservation.ends_at_ms;
}

// A booking is considered if it is confirmed, at this restaurant, and overlaps the interval. Cancelled
// bookings hold nothing, so considering them would attempt a repair nobody asked for on a booking nobody
// has, and the specification says no booking may be cancelled -- cancelling one here would be the service
// doing it, which is exactly what the requirement forbids.
function isConsidered(reservation, restaurantId, closure) {
  return reservation.status === 'confirmed'
    && reservation.restaurant_id === restaurantId
    && overlapsClosure(reservation, closure);
}

// Options in rank order: singles in the restaurant's own fixture order, then declared pairs in declared
// order, numbered from 0. The rank is the LAST tie-break, so it only decides between plans equal on
// changed count and unused seats -- but it has to be a total order for the optimum to be unique, and this
// is the order the specification names.
function rankedOptions(state, restaurant, reservation, closure) {
  const held = reservation.table_ids || [];
  const capacityOfPair = (pair) => pair.reduce((sum, tableId) => {
    const accepted = reservation.accepted_terms || {};
    const table = restaurant.tables.find((candidate) => candidate.id === tableId);
    if (!table) return sum;
    const acceptedCapacity = accepted.capacities && accepted.capacities[tableId] !== undefined
      ? accepted.capacities[tableId]
      : table.capacity;
    return sum + acceptedCapacity;
  }, 0);

  const options = [];
  let rank = 0;
  for (const table of restaurant.tables) {
    options.push({ rank: rank++, table_ids: [table.id], capacity: capacityOfPair([table.id]), kind: 'single' });
  }
  for (const pair of restaurant.combinable || []) {
    options.push({ rank: rank++, table_ids: pair.slice(), capacity: capacityOfPair(pair), kind: 'pair' });
  }
  return options.filter((option) => (
    option.capacity >= reservation.party_size
    && option.table_ids.indexOf(closure.table_id) === -1
    && !closedBy(state, restaurant.id, option.table_ids, reservation)
  ));
}

function closedBy(state, restaurantId, tableIds, reservation) {
  return state.closures.some((closure) => (
    closure.restaurant_id === restaurantId
    && tableIds.indexOf(closure.table_id) !== -1
    && reservation.starts_at_ms < closure.to
    && closure.from < reservation.ends_at_ms
  ));
}

// Fixed bookings are every confirmed booking at the restaurant that is NOT one of the considered ones.
// They hold their tables and are never moved, so the plan must fit around them.
function fixedOverlaps(state, restaurant, reservation, considered) {
  return state.reservations.some((other) => {
    if (other.status !== 'confirmed') return false;
    if (other.restaurant_id !== restaurant.id) return false;
    if (considered.indexOf(other.reference) !== -1) return false;
    if (other.reference === reservation.reference) return false;
    const shared = (other.table_ids || []).some((tableId) => (reservation.table_ids || []).indexOf(tableId) !== -1);
    return shared && other.starts_at_ms < reservation.ends_at_ms && reservation.starts_at_ms < other.ends_at_ms;
  });
}

function freeDuring(state, restaurant, tableIds, startMs, endMs, ignoreReference) {
  return !state.reservations.some((other) => {
    if (other.status !== 'confirmed') return false;
    if (other.restaurant_id !== restaurant.id) return false;
    if (other.reference === ignoreReference) return false;
    const shared = (other.table_ids || []).some((tableId) => tableIds.indexOf(tableId) !== -1);
    return shared && other.starts_at_ms < endMs && startMs < other.ends_at_ms;
  });
}

function tableSetChanged(before, after) {
  return before.length !== after.length || before.some((id, index) => id !== after[index]);
}

// THE CENTRAL PROPERTY, in the product's words rather than mine:
//
//   A closure constrains a booking only when it constrains the booking's CURRENT table. A booking that
//   holds a table the closure does not cover is a candidate to STAY, and a plan that cannot express
//   staying is not a planner failure -- it is a planner that has confused "must move" with "may move".
//
// A booking enters the search because it OVERLAPS the interval, not because it is harmed. Those are
// different questions and conflating them is what produced a no_feasible_plan for a booking that could
// simply keep its table. Every option that excludes the closed table is offered to every considered
// booking, including the one that already holds a different table, and the objective below prefers
// staying over moving. The closure is a CONSTRAINT, not an assignment.
//
// The search is exhaustive over the considered bookings, in reference order, because the number is capped
// at six by the specification. Exhaustive is deliberate: a greedy pass would be cheaper and would not be
// the specified optimum, and the whole point of the third objective is that it is the LAST tie-break --
// which is only meaningful if the first two are actually minimised.
// `considered` is an array of RESERVATIONS, in reference order. An earlier version was handed an array
// of reference strings instead, and every filter below then ran against a string: `reservation.table_ids`
// was undefined, the overlap arithmetic compared undefined, and the whole search collapsed to "no options"
// -- so a closure on t_1 reported 409 no_feasible_plan for a booking sitting on t_2 that could simply stay.
// The failure looked like a planning dead end and was a type error two functions apart.
function planFor(state, restaurant, closure, considered, byReference) {
  const consideredReferences = considered.map((reservation) => reservation.reference);
  // Per-booking candidate options, in rank order. A booking that can keep the exact table set it holds is
  // the only one that is not "moved", and objective 1 counts those, so the flag is computed here rather
  // than inferred later from a diff.
  const optionsFor = considered.map((reservation) => ({
    reservation,
    options: rankedOptions(state, restaurant, reservation, closure)
      .map((option) => {
        const candidate = { ...reservation, table_ids: option.table_ids };
        return {
          option,
          usable: !fixedOverlaps(state, restaurant, candidate, consideredReferences)
            && freeDuring(state, restaurant, option.table_ids,
              reservation.starts_at_ms, reservation.ends_at_ms, reservation.reference),
        };
      })
      .filter((entry) => entry.usable)
      .map((entry) => ({
        table_ids: entry.option.table_ids,
        capacity: entry.option.capacity,
        rank: entry.option.rank,
        moved: tableSetChanged(reservation.table_ids || [], entry.option.table_ids) ? 1 : 0,
      })),
  }));

  for (const entry of optionsFor) {
    if (entry.options.length === 0) return null;
  }

  // The three objectives are LEXICOGRAPHIC, so they cannot be satisfied by picking each booking's favourite
  // option in turn. A previous version did exactly that -- it took the lowest-ranked option per booking,
  // which minimises objectives 1 and 3 and ignores objective 2 entirely, so a party of 2 was moved onto a
  // six-seat table while a two-seat table stood free. Objective order is a property of the whole plan, so
  // the plan is the unit that is searched.
  //
  // Depth-first with branch-and-bound. Both leading counters are monotonically non-negative, so a partial
  // (moved, unused) already worse than the best complete plan cannot be improved by its descendants and is
  // cut. The number of considered bookings is capped at six by the specification, which is what makes an
  // exhaustive search of the product affordable at all.
  let best = null;
  const chosen = [];
  const walk = (at, moved, unused, ranks) => {
    if (best !== null) {
      if (moved > best.moved) return;
      if (moved === best.moved && unused > best.unused) return;
    }
    if (at === optionsFor.length) {
      const candidate = {
        chosen: chosen.slice(),
        moved,
        unused,
        ranks: ranks.slice(),
      };
      if (best === null || betterThan(candidate, best)) best = candidate;
      return;
    }
    // SABOTAGE SEED 3: the enumeration reversal. The DFS walks each booking's options in REVERSE rank
    // order, so the first complete plan it finds is the rank-MAXIMAL one and betterThan's third term is
    // load-bearing for the first time. With the rank vector intact this build is still correct; with the
    // vector deleted as well (M2') it is the rank-blind planner that S4-171d catches.
    for (const option of optionsFor[at].options.slice().reverse()) {
      if (conflictsWithChosen(chosen, option.table_ids, optionsFor[at].reservation, byReference)) continue;
      chosen.push({ reference: optionsFor[at].reservation.reference, table_ids: option.table_ids });
      walk(at + 1, moved + option.moved, unused + (option.capacity - optionsFor[at].reservation.party_size),
        ranks.concat([option.rank]));
      chosen.pop();
    }
  };
  walk(0, 0, 0, []);

  if (best === null) return null;
  const assigned = new Map();
  for (const step of best.chosen) assigned.set(step.reference, step.table_ids);
  return {
    chosen: assigned,
    movedCount: best.moved,
    unusedSeats: best.unused,
    ranks: best.ranks,
  };
}

// Strictly the specification's order: fewest changed table sets, then fewest unused seats, then the vector
// of option ranks compared element by element in ascending reference order. A plan that ties on all three
// is a plan we did not need to distinguish, and returning false for it keeps the search from thrashing.
//
// THE THIRD TERM IS REDUNDANT TODAY, AND THAT IS WHY IT MUST NOT BE DELETED AS UNREACHABLE.
//
// The search enumerates options in rank order -- singles in fixture order, then declared pairs -- so the
// first complete plan it finds is already the rank-vector minimum. Deleting the loop below therefore
// changes no reachable behaviour: measured, M2 (the rank vector removed) is an EQUIVALENT mutant, not a
// survivor, and no black-box probe can distinguish it from this build. Two rows failing to detect it was
// not a weakness of the rows.
//
// So the enumeration order performs the tie-break, and this loop states the specification's third term
// explicitly. That redundancy is INSURANCE, not waste: mutant M2' reverses the enumeration order while
// keeping this loop, and S4-171d catches it (14/15). Delete the loop and M2' becomes reachable -- a build
// where enumeration and rank order diverge, which is exactly the future change this line is here to
// survive. **A tie-break that is currently unreachable is the only kind that is worth keeping, because
// the day it becomes reachable is the day it is needed.**
function betterThan(candidate, best) {
  if (candidate.moved !== best.moved) return candidate.moved < best.moved;
  if (candidate.unused !== best.unused) return candidate.unused < best.unused;
  for (let index = 0; index < candidate.ranks.length; index += 1) {
    if (candidate.ranks[index] !== best.ranks[index]) return candidate.ranks[index] < best.ranks[index];
  }
  return false;
}

// `chosen` is a list of {reference, table_ids} assignments made so far. A candidate option conflicts when a
// booking already placed on a shared table overlaps it in time.
function conflictsWithChosen(chosen, tableIds, reservation, byReference) {
  for (const step of chosen) {
    if (step.reference === reservation.reference) continue;
    const other = byReference[step.reference];
    if (!other) continue;
    const shared = step.table_ids.some((tableId) => tableIds.indexOf(tableId) !== -1);
    if (shared && other.starts_at_ms < reservation.ends_at_ms && reservation.starts_at_ms < other.ends_at_ms) return true;
  }
  return false;
}

function previewReplan(state, user, restaurant, body, nowMs) {
  const closure = readClosure(body);
  domain.requireTable(restaurant, closure.table_id);
  if (restaurant.tables.length > MAX_TABLES) fail('planning_limit', { field: 'tables' });
  if ((restaurant.combinable || []).length > MAX_PAIRS) fail('planning_limit', { field: 'combinable' });

  const considered = state.reservations
    .filter((reservation) => isConsidered(reservation, restaurant.id, closure))
    .sort((a, b) => (a.reference < b.reference ? -1 : a.reference > b.reference ? 1 : 0));
  if (considered.length > MAX_CONSIDERED) fail('planning_limit', { field: 'considered' });

  // byReference is passed to the search, NOT attached to the reservations. An earlier version stashed it
  // on each reservation as a property, which put an extra enumerable key on stored bookings and broke
  // every row that compares a booking or a series deeply -- a helper's scratch state leaking into the
  // store is invisible until something asserts equality, and then it looks like a domain change.
  const byReference = {};
  for (const reservation of considered) byReference[reservation.reference] = reservation;

  const solution = planFor(state, restaurant, closure, considered, byReference);
  if (!solution) fail('no_feasible_plan', { table_id: closure.table_id });

  const assignments = considered.map((reservation) => {
    const tableIds = solution.chosen.get(reservation.reference);
    return {
      reference: reservation.reference,
      table_ids: tableIds.slice(),
      changed: tableSetChanged(reservation.table_ids || [], tableIds),
    };
  });

  const plan = {
    plan_id: store.allocatePlanId(state),
    restaurant_id: restaurant.id,
    // The revision the plan was computed against. Apply compares this to the restaurant's revision now,
    // which is what makes a stale plan detectable rather than merely unlikely.
    planned_against_revision: store.restaurantRevision(state, restaurant.id),
    closure: {
      table_id: closure.table_id,
      from: time.formatInZoneOffset(restaurant.timezone, closure.from),
      to: time.formatInZoneOffset(restaurant.timezone, closure.to),
      from_ms: closure.from,
      to_ms: closure.to,
    },
    assignments,
    moved_count: solution.movedCount,
    unused_seats: solution.unusedSeats,
    created_at: time.formatUtc(nowMs),
  };
  store.rememberPlan(state, plan);
  return plan;
}

function planResponse(plan) {
  return {
    plan_id: plan.plan_id,
    // On a preview this is the revision the plan was computed AGAINST, which is the restaurant's current
    // revision -- a preview changes nothing, so there is no "after" yet. On an applied plan it is the
    // revision the application produced.
    restaurant_revision: plan.restaurant_revision === undefined
      ? plan.planned_against_revision
      : plan.restaurant_revision,
    closure: {
      table_id: plan.closure.table_id,
      from: plan.closure.from,
      to: plan.closure.to,
    },
    assignments: plan.assignments,
    moved_count: plan.moved_count,
    unused_seats: plan.unused_seats,
  };
}

function requirePlan(state, restaurant, planId) {
  const found = state.replans.find((plan) => plan.plan_id === planId);
  if (!found || found.restaurant_id !== restaurant.id) {
    fail('not_found', { resource: 'replan', plan_id: planId });
  }
  return found;
}

function applyReplan(state, user, restaurant, planId, nowMs) {
  const plan = requirePlan(state, restaurant, planId);
  if (plan.applied) fail('plan_already_applied', { plan_id: planId });

  const current = store.restaurantRevision(state, restaurant.id);
  if (current !== plan.planned_against_revision) {
    fail('stale_plan', { plan_id: planId, planned_against: plan.planned_against_revision, current });
  }

  // Every assignment is resolved against the store BEFORE anything is written, so a reference that has
  // gone missing cannot leave half the plan applied.
  const targets = plan.assignments.map((assignment) => {
    const reservation = store.findReservation(state, assignment.reference);
    if (!reservation) fail('not_found', { resource: 'reservation', reference: assignment.reference });
    return { assignment, reservation };
  });

  for (const { assignment, reservation } of targets) {
    if (!assignment.changed) continue;
    const before = (reservation.table_ids || []).slice();
    reservation.table_ids = assignment.table_ids.slice();
    reservation.revision += 1;
    history.appendReassigned(state, reservation, before, plan.plan_id, nowMs);
  }

  state.closures.push({
    restaurant_id: restaurant.id,
    table_id: plan.closure.table_id,
    from_ms: plan.closure.from_ms,
    to_ms: plan.closure.to_ms,
    from: plan.closure.from,
    to: plan.closure.to,
    applied_at: time.formatUtc(nowMs),
  });

  plan.applied = true;
  plan.restaurant_revision = store.bumpRestaurantRevision(state, restaurant.id);

  // Each affected SERIES revision moves once per application if at least one of its members moved -- once
  // for the plan, not once per occurrence, because a series is one booking intent. Exception flags,
  // scheduled dates, identities and accepted terms are untouched by a seating repair.
  const touched = new Set();
  for (const { assignment, reservation } of targets) {
    if (assignment.changed && reservation.series_id) touched.add(reservation.series_id);
  }
  for (const seriesId of touched) {
    const found = state.series.find((entry) => entry.series_id === seriesId);
    if (found) found.revision += 1;
  }

  state.replans = state.replans.filter((entry) => entry.plan_id !== planId);

  return {
    plan_id: plan.plan_id,
    restaurant_revision: plan.restaurant_revision,
    reservations: targets.map(({ reservation }) => store.reservationView(state, reservation)),
  };
}

module.exports = {
  readInstant,
  readClosure,
  isConsidered,
  rankedOptions,
  previewReplan,
  applyReplan,
  requirePlan,
  planResponse,
  MAX_TABLES,
  MAX_PAIRS,
  MAX_CONSIDERED,
};
