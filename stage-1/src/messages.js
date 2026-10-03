"use strict";

const WEEKDAY_NAMES = Object.freeze({
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
});

const RESOURCE_NOUNS = Object.freeze({
  reservation: "booking",
  restaurant: "restaurant",
  table: "table",
});

const STATUS_BY_CODE = Object.freeze({
  malformed_request: 400,
  missing_idempotency_key: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  idempotency_key_reuse: 409,
  email_taken: 409,
  table_unavailable: 409,
  cutoff_passed: 409,
  reservation_cancelled: 409,
  validation_failed: 422,
  not_on_slot_grid: 422,
  outside_opening_hours: 422,
  party_exceeds_capacity: 422,
  invalid_local_time: 422,
  internal_error: 500,
});

const FALLBACK =
  "Something went wrong at our end and we could not finish that. Please try again in a moment.";

function text(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : "";
}

function span(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return "";
  const whole = Math.round(n);
  return `${whole} ${whole === 1 ? "minute" : "minutes"}`;
}

function noun(ctx) {
  return RESOURCE_NOUNS[ctx.resource] || "";
}

function dayName(ctx) {
  const key = String(ctx.weekday || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(WEEKDAY_NAMES, key) ? WEEKDAY_NAMES[key] : "";
}

const MESSAGES = Object.freeze({
  malformed_request: () =>
    "We could not read what you sent. Some of the details were in the wrong form. Check them and try again.",

  missing_idempotency_key: () =>
    "We could not book this without a repeat-protection key, which is what stops us booking you twice by accident. Please try again.",

  unauthenticated: (ctx) =>
    ctx.reason === "sign_in"
      ? "That email address and password do not match an account. Check for typing mistakes and try again."
      : "You are not signed in, or your sign-in has expired. Please sign in again to carry on.",

  forbidden: (ctx) =>
    noun(ctx)
      ? `You are not allowed to change that ${noun(ctx)}. If you booked it with another account, sign in with that account and try again.`
      : "You are not allowed to do that here. Check you are signed in with the right account, and try again.",

  not_found: (ctx) => {
    switch (ctx.resource) {
      case "reservation":
        return "We could not find that booking. Check the reference and try again.";
      case "restaurant":
        return "We could not find that restaurant. It may no longer be listed.";
      case "table":
        return "We could not find that table in this restaurant. Check the restaurant and the table you picked.";
      default:
        return "We could not find what you asked for. Check the details and try again.";
    }
  },

  idempotency_key_reuse: () =>
    "That repeat-protection key was already used for a different booking, so nothing was changed. Use a fresh key for a new booking, or resend the original details unchanged.",

  email_taken: () =>
    "There is already an account with that email address. Sign in instead, or sign up with a different email address.",

  table_unavailable: () =>
    "That table is already booked for part of that time. Pick another table, or another time.",

  not_on_slot_grid: (ctx) => {
    const step = span(ctx.slot_minutes);
    const opens = text(ctx.opens);
    return step && opens
      ? `Bookings start every ${step} from ${opens}. Pick one of the start times shown.`
      : "That is not one of the booking start times. Pick one of the times shown.";
  },

  outside_opening_hours: (ctx) => {
    const opens = text(ctx.opens);
    const closes = text(ctx.closes);
    const hours = opens && closes ? `${opens} to ${closes}` : "";
    const day = dayName(ctx);
    if (hours && day) {
      return `On ${day}s the restaurant is open ${hours}, and a booking has to finish before closing. Pick a start time inside those hours.`;
    }
    return hours
      ? `The restaurant is open ${hours}, and a booking has to finish before closing. Pick a start time inside those hours.`
      : "That time is outside the restaurant's opening hours, or the booking would run past closing time. Pick a time inside opening hours.";
  },

  party_exceeds_capacity: (ctx) => {
    const capacity = Math.floor(Number(ctx.capacity));
    return Number.isFinite(capacity) && capacity >= 1
      ? `That table seats ${capacity} at most. Book for fewer people, or pick a larger table.`
      : "That table is too small for your party. Book for fewer people, or pick a larger table.";
  },

  invalid_local_time: () =>
    "That time does not exist on that date, because the clocks change that day and skip it. Pick a time after the change.",

  cutoff_passed: (ctx) => {
    const cutoff = span(ctx.cutoff_minutes);
    return cutoff
      ? `Bookings can only be changed or cancelled more than ${cutoff} before they start, and this one is too close. Please call the restaurant instead.`
      : "This booking is too close to its start time to be changed or cancelled. Please call the restaurant instead.";
  },

  reservation_cancelled: () =>
    "That booking is cancelled, so it cannot be changed. Make a new booking instead.",

  internal_error: () => FALLBACK,

  validation_failed: (ctx) => {
    switch (ctx.reason) {
      case "password_too_short":
        return "Passwords need at least 8 characters. Make it a little longer and try again.";
      case "email_format":
        return "That does not look like an email address. Use the form name@example.com and try again.";
      case "party_size":
        return "The number of people has to be a whole number of at least 1. Check it and try again.";
      case "time_format":
        return "That start time is not a date and time we recognise. Pick one of the times shown.";
      case "key_length":
        return "A repeat-protection key has to be between 1 and 255 characters. Shorten it and try again.";
      case "moves_shape":
        return "Changing several bookings at once needs between 1 and 8 bookings, each listed once. Check the list and try again.";
      case "single_restaurant":
        return "Bookings changed together have to be at the same restaurant. Try again with bookings from one restaurant.";
      case "missing_search_details":
        return "To show you free times we need a restaurant, a date and the number of people. Fill in what is missing.";
      default:
        return "Some of the details you entered are not valid. Check them and try again.";
    }
  },
});

function message(code, ctx) {
  const entry = MESSAGES[code];
  if (typeof entry === "function") return entry(ctx && typeof ctx === "object" ? ctx : {});
  if (typeof entry === "string") return entry;
  return FALLBACK;
}

function statusFor(code) {
  return STATUS_BY_CODE[code] || 500;
}

function isKnownCode(code) {
  return Object.prototype.hasOwnProperty.call(MESSAGES, code);
}

function errorBody(code, ctx) {
  return { error: { code, message: message(code, ctx) } };
}

module.exports = {
  MESSAGES,
  STATUS_BY_CODE,
  WEEKDAY_NAMES,
  FALLBACK,
  message,
  statusFor,
  isKnownCode,
  errorBody,
};
