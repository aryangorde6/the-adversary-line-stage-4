'use strict';

const { formatInZone } = require('./time');
const { randomId, randomToken, newReference } = require('./accounts');

function emptyState() {
  return {
    users: [],
    tokens: [],
    restaurants: [],
    reservations: [],
    idempotency: [],
    // Stage 3 adds three stores beside the stage 1 ones. All three default to empty so a stage 1
    // or stage 2 export imports into a stage 3 service without a migration step (S3-121), and a
    // reservation that predates stage 3 still reads as revision 1 under policy 0 (S3-052).
    policies: [],
    history: [],
    series: [],
    // The batch counter S3-118 and S3-139 name. Stages 1 and 2 have no such field, so it is created
    // here and the ledger's S3-A1 is answered by reading exactly this: one counter per restaurant,
    // moved by one per operation rather than by one per booking inside it.
    batch_counters: {},
  };
}

let current = emptyState();

function getState() {
  return current;
}

function setState(next) {
  current = next;
}

function findUserById(state, userId) {
  return state.users.find((user) => user.id === userId) || null;
}

function findUserByEmail(state, email) {
  const wanted = String(email).toLowerCase();
  return state.users.find((user) => user.email === wanted) || null;
}

function issueToken(state, userId) {
  const token = randomToken();
  state.tokens.push({ token, user_id: userId });
  return token;
}

function findRestaurant(state, restaurantId) {
  return state.restaurants.find((restaurant) => restaurant.id === restaurantId) || null;
}

function findTable(restaurant, tableId) {
  return restaurant.tables.find((table) => table.id === tableId) || null;
}

function findReservation(state, reference) {
  return state.reservations.find((reservation) => reservation.reference === reference) || null;
}

function findOwnReservation(state, userId, reference) {
  const reservation = findReservation(state, reference);
  if (!reservation || reservation.user_id !== userId) return null;
  return reservation;
}

function isReferenceTaken(state, reference) {
  return state.reservations.some((reservation) => reservation.reference === reference);
}

function allocateUserId(state) {
  let id = randomId('u_');
  while (findUserById(state, id) !== null) id = randomId('u_');
  return id;
}

function allocateReservationId(state) {
  let id = randomId('res_');
  while (state.reservations.some((reservation) => reservation.id === id)) id = randomId('res_');
  return id;
}

function allocateReference(state) {
  return newReference((reference) => isReferenceTaken(state, reference));
}

// table_ids is always present because a booking is a set. table_id is kept only when the set has a
// single member, which is what a stage 1 client reads and what a one-table booking still expects.
function reservationView(state, reservation) {
  const restaurant = findRestaurant(state, reservation.restaurant_id);
  const timeZone = restaurant ? restaurant.timezone : 'UTC';
  const tableIds = Array.isArray(reservation.table_ids) ? reservation.table_ids : [];
  const view = {
    reservation_id: reservation.id,
    reference: reservation.reference,
    restaurant_id: reservation.restaurant_id,
    table_ids: tableIds.slice(),
    party_size: reservation.party_size,
    status: reservation.status,
    starts_at_local: reservation.starts_at_local,
    starts_at: formatInZone(timeZone, reservation.starts_at_ms),
    ends_at: formatInZone(timeZone, reservation.ends_at_ms),
    created_at: reservation.created_at,
  };
  if (tableIds.length === 1) view.table_id = tableIds[0];
  // Stage 3 adds two fields to every reservation response. revision is always an integer and
  // accepted_terms is the snapshot the booking accepted, never the policy in force now (S3-050,
  // S3-051), which is why it is stored on the reservation rather than looked up here.
  view.revision = typeof reservation.revision === 'number' ? reservation.revision : 1;
  view.accepted_terms = reservation.accepted_terms || null;
  return view;
}

module.exports = {
  randomId,
  emptyState,
  getState,
  setState,
  findUserById,
  findUserByEmail,
  issueToken,
  findRestaurant,
  findTable,
  findReservation,
  findOwnReservation,
  isReferenceTaken,
  allocateUserId,
  allocateReservationId,
  allocateReference,
  reservationView,
};