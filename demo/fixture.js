'use strict';

// Sample data for the live demo. Ours, written after the run; not part of any stage.
// Dates are computed when the service starts, so the seeded bookings are always tomorrow.

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const everyDay = (opens, closes) => DAYS.map((weekday) => ({ weekday, opens, closes }));

// The restaurant's own calendar date `offset` days from now, as YYYY-MM-DD.
function localDate(timeZone, offset) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + offset * 86400000));
}

const RESTAURANTS = [
  {
    id: 'r_anker', name: 'Zum Anker', timezone: 'Europe/Berlin',
    slot_minutes: 30, reservation_duration_minutes: 90, cancellation_cutoff_minutes: 120,
    opening_hours: everyDay('17:00', '23:00'),
    tables: [
      { id: 't_1', label: 'Window 1', capacity: 2 }, { id: 't_2', label: 'Garden 2', capacity: 4 },
      { id: 't_3', label: 'Booth 3', capacity: 4 }, { id: 't_4', label: 'Bar 4', capacity: 2 },
      { id: 't_5', label: 'Terrace 5', capacity: 6 },
    ],
    combinable: [['t_2', 't_3'], ['t_1', 't_4']],
  },
  {
    id: 'r_lotus', name: 'Lotus Garden', timezone: 'Asia/Kolkata',
    slot_minutes: 15, reservation_duration_minutes: 60, cancellation_cutoff_minutes: 60,
    opening_hours: everyDay('12:00', '22:00'),
    tables: [
      { id: 't_10', label: 'Terrace', capacity: 6 }, { id: 't_11', label: 'Courtyard 1', capacity: 2 },
      { id: 't_12', label: 'Courtyard 2', capacity: 2 },
    ],
    combinable: [['t_11', 't_12']],
  },
  {
    id: 'r_harbor', name: 'Harbor Oyster House', timezone: 'America/New_York',
    slot_minutes: 30, reservation_duration_minutes: 120, cancellation_cutoff_minutes: 180,
    opening_hours: everyDay('16:00', '22:30'),
    tables: [
      { id: 't_20', label: 'Bar seat', capacity: 2 }, { id: 't_21', label: 'Booth A', capacity: 4 },
      { id: 't_22', label: 'Booth B', capacity: 4 }, { id: 't_23', label: 'Long table', capacity: 8 },
    ],
    combinable: [['t_21', 't_22']],
  },
];

function demoFixture() {
  const anker = localDate('Europe/Berlin', 1);
  const lotus = localDate('Asia/Kolkata', 1);
  const harbor = localDate('America/New_York', 1);
  return {
    users: [
      { id: 'u_demo', email: 'demo@tablekeeper.test', password: 'tablekeeper-demo', display_name: 'Demo Diner' },
      { id: 'u_guest', email: 'guest@tablekeeper.test', display_name: 'Another Guest' },
    ],
    restaurants: RESTAURANTS,
    reservations: [
      { reference: 'DEMOBOOK1', user_id: 'u_demo', restaurant_id: 'r_anker', table_id: 't_2', starts_at_local: `${anker}T19:00`, party_size: 3 },
      { reference: 'GUEST0001', user_id: 'u_guest', restaurant_id: 'r_anker', table_id: 't_1', starts_at_local: `${anker}T19:00`, party_size: 2 },
      { reference: 'GUEST0002', user_id: 'u_guest', restaurant_id: 'r_anker', table_id: 't_3', starts_at_local: `${anker}T19:30`, party_size: 4 },
      { reference: 'GUEST0003', user_id: 'u_guest', restaurant_id: 'r_lotus', table_id: 't_10', starts_at_local: `${lotus}T13:00`, party_size: 5 },
      { reference: 'GUEST0004', user_id: 'u_guest', restaurant_id: 'r_harbor', table_id: 't_23', starts_at_local: `${harbor}T18:00`, party_size: 7 },
    ],
  };
}

module.exports = { demoFixture, RESTAURANTS };
