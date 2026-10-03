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

function reservationView(state, reservation) {
  const restaurant = findRestaurant(state, reservation.restaurant_id);
  const timeZone = restaurant ? restaurant.timezone : 'UTC';
  return {
    reservation_id: reservation.id,
    reference: reservation.reference,
    restaurant_id: reservation.restaurant_id,
    table_id: reservation.table_id,
    party_size: reservation.party_size,
    status: reservation.status,
    starts_at_local: reservation.starts_at_local,
    starts_at: formatInZone(timeZone, reservation.starts_at_ms),
    ends_at: formatInZone(timeZone, reservation.ends_at_ms),
    created_at: reservation.created_at,
  };
}

module.exports = {
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