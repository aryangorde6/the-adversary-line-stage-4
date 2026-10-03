'use strict';

// Stage 3 introduces policies: a restaurant may publish versions of its own rules, and every
// booking is decided under the policy in force on its local start date rather than under whatever
// the restaurant detail happens to say today.
//
// Two invariants shape everything here.
//
// Policy 0 is not stored. It is the fixture's own configuration, read through the same accessors
// as any published policy, so a restaurant that has published nothing behaves exactly as stage 2
// did and the detail endpoint keeps reporting the fixture rather than the newest policy.
//
// A booking carries the terms it accepted, not a pointer to a policy. Selection therefore happens
// exactly once, at the moment a booking is made or moved to a new date, and the snapshot is what
// every later check reads. That is what makes S3-054 (a publication changes no existing booking)
// true by construction rather than by remembering to skip existing rows.

const { fail } = require('./errors');
const time = require('./time');
const store = require('./state');
const { has, isPlainObject } = require('./fields');

const POLICY_FIELDS = [
  'effective_from',
  'slot_minutes',
  'reservation_duration_minutes',
  'cancellation_cutoff_minutes',
  'opening_hours',
  'capacities',
];

const POLICY_VERSION = 'policy_version';

const MAX_SLOT_MINUTES = 1440;
const MAX_CUTOFF_MINUTES = 10080;
const MAX_CAPACITY = 100;

// The terms a booking accepts are the policy minus effective_from. effective_from is excluded on
// purpose: it decided which policy applied, it is not a term the diner accepted, and carrying it
// would make two snapshots of the same rules look different because they were chosen on different
// days. S3-050 asserts the absence deliberately, so the exclusion is stated here rather than
// happening to fall out of a loop.
function acceptedTermsOf(policy) {
  return {
    [POLICY_VERSION]: policy.policy_version,
    slot_minutes: policy.slot_minutes,
    reservation_duration_minutes: policy.reservation_duration_minutes,
    cancellation_cutoff_minutes: policy.cancellation_cutoff_minutes,
    opening_hours: policy.opening_hours.map((day) => ({ ...day })),
    capacities: { ...policy.capacities },
  };
}

function policyZeroOf(restaurant) {
  const capacities = {};
  for (const table of restaurant.tables) capacities[table.id] = table.capacity;
  return {
    policy_version: 0,
    effective_from: null,
    slot_minutes: restaurant.slot_minutes,
    reservation_duration_minutes: restaurant.reservation_duration_minutes,
    cancellation_cutoff_minutes: restaurant.cancellation_cutoff_minutes,
    opening_hours: restaurant.opening_hours.map((day) => ({ ...day })),
    capacities,
  };
}

function policiesOf(state, restaurantId) {
  return state.policies.filter((policy) => policy.restaurant_id === restaurantId);
}

// Publication order, not effective-date order. S3-029 and S3-038 both require the list to read the
// way it was written, and selection is a separate question answered by policyForDate.
function listPolicies(state, restaurant) {
  return policiesOf(state, restaurant.id).map((policy) => ({
    policy_version: policy.policy_version,
    effective_from: policy.effective_from,
    slot_minutes: policy.slot_minutes,
    reservation_duration_minutes: policy.reservation_duration_minutes,
    cancellation_cutoff_minutes: policy.cancellation_cutoff_minutes,
    opening_hours: policy.opening_hours.map((day) => ({ ...day })),
    capacities: { ...policy.capacities },
  }));
}

function nextVersion(state, restaurantId) {
  const existing = policiesOf(state, restaurantId);
  if (existing.length === 0) return 1;
  return existing.reduce((greatest, policy) => Math.max(greatest, policy.policy_version), 0) + 1;
}

// Selection is on the local calendar date, never on a UTC one, and ties on effective_from are broken
// by the greater version. Comparing the two as strings is safe because effective_from is validated
// as a real YYYY-MM-DD date before it is ever stored, and such dates sort lexicographically.
function policyForDate(state, restaurant, dateString) {
  let chosen = null;
  for (const policy of policiesOf(state, restaurant.id)) {
    if (policy.effective_from > dateString) continue;
    if (chosen === null) { chosen = policy; continue; }
    if (policy.effective_from > chosen.effective_from) { chosen = policy; continue; }
    if (policy.effective_from === chosen.effective_from && policy.policy_version > chosen.policy_version) {
      chosen = policy;
    }
  }
  return chosen === null ? policyZeroOf(restaurant) : chosen;
}

function localDateOf(startsAtLocal) {
  return String(startsAtLocal).slice(0, 10);
}

function policyForStart(state, restaurant, startsAtLocal) {
  return policyForDate(state, restaurant, localDateOf(startsAtLocal));
}

function isManager(state, restaurant, user) {
  if (!user) return false;
  const managers = Array.isArray(restaurant.manager_user_ids) ? restaurant.manager_user_ids : [];
  return managers.indexOf(user.id) !== -1;
}

function requireManager(state, restaurant, user) {
  if (!isManager(state, restaurant, user)) {
    fail('forbidden', { resource: 'restaurant', restaurant_id: restaurant.id });
  }
}

// A wrong type is a validation failure here, not a malformed request. The distinction stage 1 draws
// between "the body was not JSON of the right shape" and "a field holds the wrong kind of value"
// does not survive here: a policy whose slot_minutes is the string "30" is a well-formed request
// carrying an unacceptable value, and S3-033 and S3-035 both ask for 422 on exactly those inputs.
function requireIntegerInRange(value, field, min, max) {
  // A boolean is not an integer even though JavaScript says typeof true === 'boolean' and
  // Number.isInteger(true) is false anyway; the explicit check documents that it was considered.
  if (typeof value !== 'number' || typeof value === 'boolean' || !Number.isInteger(value)) {
    fail('validation_failed', { field });
  }
  if (value < min || value > max) fail('validation_failed', { field });
  return value;
}

const CALENDAR_DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

function requireCalendarDate(value, field) {
  if (typeof value !== 'string') fail('malformed_request', { field });
  const match = CALENDAR_DATE.exec(value);
  if (!match) fail('validation_failed', { field, reason: 'date_format' });
  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);
  if (!time.isCalendarDate(y, mo, d)) fail('validation_failed', { field, reason: 'date_format' });
  return value;
}

function requireOpeningHours(value, field) {
  if (!Array.isArray(value)) fail('malformed_request', { field });
  const seen = new Set();
  return value.map((entry) => {
    if (!isPlainObject(entry)) fail('malformed_request', { field });
    if (typeof entry.weekday !== 'string') fail('malformed_request', { field });
    const weekday = entry.weekday.toLowerCase();
    if (!time.WEEKDAY_NAMES.includes(weekday)) fail('validation_failed', { field, reason: 'weekday' });
    if (seen.has(weekday)) fail('validation_failed', { field, reason: 'duplicate_weekday' });
    seen.add(weekday);
    const opens = time.parseHhmm(entry.opens);
    const closes = time.parseHhmm(entry.closes);
    if (opens === null || closes === null) fail('validation_failed', { field });
    // 24:00 is refused because parseHhmm does not produce it, and closes <= opens is refused
    // because a day that opens when it closes is not an opening.
    if (closes <= opens) fail('validation_failed', { field, reason: 'closing_not_after_opening' });
    return { weekday, opens: entry.opens, closes: entry.closes };
  });
}

// capacities must name exactly the restaurant's tables. Checking only the ids that are present is
// the half most implementations skip, and it lets a policy silently shrink a table to make a party
// fit, so both directions are asserted here.
function requireCapacities(value, restaurant, field) {
  if (!isPlainObject(value)) fail('malformed_request', { field });
  const wanted = new Set();
  for (const table of restaurant.tables) wanted.add(table.id);
  for (const id of Object.keys(value)) {
    if (!wanted.has(id)) fail('validation_failed', { field, reason: 'unknown_table' });
  }
  for (const table of restaurant.tables) {
    if (!has(value, table.id)) fail('validation_failed', { field, reason: 'missing_table' });
    requireIntegerInRange(value[table.id], field, 1, MAX_CAPACITY);
  }
  const capacities = {};
  for (const table of restaurant.tables) capacities[table.id] = value[table.id];
  return capacities;
}

// A policy is a complete replacement, not a patch: every field is required and there is no merge
// with the fixture. Omitting a field is 422 rather than "inherit", because a policy that silently
// inherited half its rules from the fixture would be a second source of truth for the same numbers.
function readCompletePolicy(body, restaurant) {
  if (!isPlainObject(body)) fail('malformed_request', { field: 'policy' });
  for (const field of POLICY_FIELDS) {
    if (!has(body, field)) fail('validation_failed', { field });
  }
  const effectiveFrom = requireCalendarDate(body.effective_from, 'effective_from');
  const slotMinutes = requireIntegerInRange(body.slot_minutes, 'slot_minutes', 1, MAX_SLOT_MINUTES);
  const duration = requireIntegerInRange(body.reservation_duration_minutes, 'reservation_duration_minutes', 1, MAX_SLOT_MINUTES);
  const cutoff = requireIntegerInRange(body.cancellation_cutoff_minutes, 'cancellation_cutoff_minutes', 0, MAX_CUTOFF_MINUTES);
  const openingHours = requireOpeningHours(body.opening_hours, 'opening_hours');
  const capacities = requireCapacities(body.capacities, restaurant, 'capacities');
  return {
    effective_from: effectiveFrom,
    slot_minutes: slotMinutes,
    reservation_duration_minutes: duration,
    cancellation_cutoff_minutes: cutoff,
    opening_hours: openingHours,
    capacities,
  };
}

// Every check that could reject a policy happens here, before a version number is allocated. A
// version is the restaurant's promise that a publication happened; an allocation on a refused
// request would leave a gap that S3-026 and S3-036 both forbid.
function publishPolicy(state, restaurant, body) {
  const policy = readCompletePolicy(body, restaurant);
  policy.restaurant_id = restaurant.id;
  policy.policy_version = nextVersion(state, restaurant.id);
  policy.created_at = null;
  state.policies.push(policy);
  return policy;
}

function policyCapacity(policy, tableId) {
  const value = policy.capacities[tableId];
  return typeof value === 'number' ? value : 0;
}

// A pair's capacity is the sum of the selected policy's capacities, not the fixture's. Reading the
// fixture here is the fixture-cached-sum failure S3-130 exists to catch.
function capacityUnder(policy, tableIds) {
  return tableIds.reduce((total, id) => total + policyCapacity(policy, id), 0);
}

function dayOpeningHoursOf(policy, wall) {
  const name = time.WEEKDAY_NAMES[time.weekdayOf(wall.y, wall.mo, wall.d)];
  const entry = policy.opening_hours.find((day) => day.weekday === name);
  if (!entry) return null;
  return { opens: time.parseHhmm(entry.opens), closes: time.parseHhmm(entry.closes) };
}

function acceptedTermsFor(state, restaurant, startsAtLocal) {
  return acceptedTermsOf(policyForStart(state, restaurant, startsAtLocal));
}

module.exports = {
  POLICY_FIELDS,
  POLICY_VERSION,
  MAX_SLOT_MINUTES,
  MAX_CUTOFF_MINUTES,
  MAX_CAPACITY,
  acceptedTermsOf,
  policyZeroOf,
  policiesOf,
  listPolicies,
  nextVersion,
  policyForDate,
  policyForStart,
  localDateOf,
  isManager,
  requireManager,
  requireCalendarDate,
  requireOpeningHours,
  requireCapacities,
  requireIntegerInRange,
  readCompletePolicy,
  publishPolicy,
  policyCapacity,
  capacityUnder,
  dayOpeningHoursOf,
  acceptedTermsFor,
};