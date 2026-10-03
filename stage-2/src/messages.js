"use strict";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_BY_KEY = Object.freeze({
  sun: WEEKDAYS[0],
  mon: WEEKDAYS[1],
  tue: WEEKDAYS[2],
  wed: WEEKDAYS[3],
  thu: WEEKDAYS[4],
  fri: WEEKDAYS[5],
  sat: WEEKDAYS[6],
});

const RESOURCE_NOUNS = Object.freeze({
  reservation: "booking",
  restaurant: "restaurant",
  table: "table",
});

const FIELD_NOUNS = Object.freeze({
  email: "email address",
  password: "password",
  display_name: "name",
  party_size: "number of people",
  starts_at_local: "start time",
  table_id: "table",
  restaurant_id: "restaurant",
  date: "date",
  reference: "booking reference",
  moves: "list of bookings",
  restaurant: "restaurant",
  table: "table",
  name: "restaurant name",
  timezone: "time zone",
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
  combination_not_allowed: 422,
  invalid_local_time: 422,
});

const FALLBACK =
  "Something went wrong at our end and we could not finish that. Please try again in a moment.";

function word(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : "";
}

function noun(ctx, key) {
  return RESOURCE_NOUNS[ctx[key]] || "";
}

function fieldNoun(ctx) {
  return FIELD_NOUNS[word(ctx.field)] || "";
}

// Stage 2 books a set of tables. Labels are preferred so a sentence reads "Tables 1 and 2" rather
// than "Tables t_1 and t_2". A caller may pass labels as an array or as a joined string; the joined
// form is split, which is a guess, so an array is the better contract and the caller should send one.
// Table ids are never printed: a diner picks tables by label, so naming ids back at them helps
// nobody, and the specification asks for identifiers to stay out of the way.
function tableSet(ctx) {
  const fromArray = (value) => (Array.isArray(value) ? value.map(word).filter(Boolean) : []);
  const fromJoined = (value) => {
    const joined = word(value);
    if (!joined) return [];
    return joined.includes(" and ") ? joined.split(" and ").map(word).filter(Boolean) : [joined];
  };
  const sources = [() => fromArray(ctx.tables), () => fromJoined(ctx.tables), () => fromArray(ctx.table_labels)];
  for (const source of sources) {
    const found = source();
    if (found.length) return found;
  }
  return fromJoined(ctx.table);
}

function setSize(ctx) {
  const counts = [ctx.tables, ctx.table_labels, ctx.table_ids].map((value) =>
    Array.isArray(value) ? value.filter((v) => word(v) !== "").length : 0
  );
  return Math.max(tableSet(ctx).length, ...counts);
}

function tablePhrase(set) {
  if (set.length === 1) return `Table ${set[0]}`;
  if (set.length === 2) return `Tables ${set[0]} and ${set[1]}`;
  if (set.length > 2) return `Tables ${set.slice(0, -1).join(", ")} and ${set[set.length - 1]}`;
  return "";
}

function span(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return "";
  const whole = Math.round(n);
  return `${whole} ${whole === 1 ? "minute" : "minutes"}`;
}

function dayName(ctx) {
  const key = String(ctx.weekday || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(WEEKDAY_BY_KEY, key) ? WEEKDAY_BY_KEY[key] : "";
}

function longDate(value) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(word(value));
  if (!parts) return "";
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const stamp = Date.UTC(year, month - 1, day);
  const back = new Date(stamp);
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) {
    return "";
  }
  return `${WEEKDAYS[back.getUTCDay()]} ${day} ${MONTHS[month - 1]} ${year}`;
}

function localMoment(value) {
  const found = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(word(value));
  if (!found) return "";
  const hours = Number(found[2]);
  const minutes = Number(found[3]);
  if (hours > 23 || minutes > 59) return "";
  const when = longDate(found[1]);
  return when ? `${when} at ${found[2]}:${found[3]}` : "";
}

const MESSAGES = {
  malformed_request: () =>
    "We could not read what you sent. Check the details you entered and try again.",

  missing_idempotency_key: () =>
    "We could not book this without an Idempotency-Key header, so nothing was booked. Please try again.",

  unauthenticated: (ctx) =>
    ctx.reason === "sign_in"
      ? "That email address and password do not match an account. Check for typing mistakes and try again."
      : "You are not signed in, or your sign-in has expired. Please sign in again to carry on.",

  forbidden: (ctx) => {
    const thing = noun(ctx, "resource");
    const who = word(ctx.restaurant);
    return thing
      ? `You are not allowed to change that ${thing}${at(who)}. If you booked it with another account, sign in with that one and try again.`
      : `You are not allowed to do that here${at(who)}. Check you are signed in with the right account, and try again.`;
  },

  not_found: (ctx) => {
    const ref = word(ctx.reference);
    const who = word(ctx.restaurant);
    switch (ctx.resource) {
      case "reservation":
        return ref
          ? `We could not find booking ${ref}${at(who)}. Check the reference and try again.`
          : `We could not find that booking${at(who)}. Check the reference and try again.`;
      case "restaurant":
        return "We could not find that restaurant. It may no longer be listed.";
      case "table":
        return "We could not find that table in this restaurant. Check the restaurant and the table you picked.";
      default:
        return "We could not find what you asked for. Check the details and try again.";
    }
  },

  idempotency_key_reuse: () =>
    "That Idempotency-Key was already used for a different booking, so nothing was changed. Use a fresh Idempotency-Key for a new booking.",

  validation_failed: (ctx) => {
    switch (ctx.reason) {
      case "password_too_short":
        return "Passwords need at least 8 characters. Make it a little longer and try again.";
      case "email_format":
        return "That does not look like an email address. It needs exactly one @ with something on both sides, in the form name@example.com. Check it and try again.";
      case "party_size":
        return "The number of people has to be a whole number of at least 1. Check it and try again.";
      case "time_format": {
        const when = longDate(ctx.date);
        return when
          ? `That start time is not a date and time we recognise for ${when}. Pick one of the times shown.`
          : "That start time is not a date and time we recognise. Pick one of the times shown.";
      }
      case "key_length":
        return "An Idempotency-Key has to be between 1 and 255 characters. Shorten it and try again.";
      case "moves_shape":
        return "Changing several bookings at once needs between 1 and 8 bookings, each listed once. Check the list and try again.";
      case "single_restaurant":
        return "Bookings changed together have to be at the same restaurant. Try again with bookings from one restaurant.";
      case "missing_search_details":
        return "To show you free times we need a restaurant, a date and the number of people. Fill in what is missing.";
      default: {
        const named = fieldNoun(ctx);
        return named
          ? `The ${named} you entered is not valid. Check it and try again.`
          : "Some of the details you entered are not valid. Check them and try again.";
      }
    }
  },

  email_taken: () =>
    "There is already an account with that email address. Sign in instead, or sign up with a different one.",

  table_unavailable: (ctx) => {
    const label = word(ctx.table);
    const when = localMoment(ctx.starts_at_local) || longDate(ctx.date);
    return label
      ? `Table ${label} is already booked${forWhen(when)}. Pick another table, or another time.`
      : `That table is already booked${forWhen(when)}. Pick another table, or another time.`;
  },

  not_on_slot_grid: (ctx) => {
    const step = span(ctx.slot_minutes);
    const opens = word(ctx.opens);
    return step && opens
      ? `Bookings start every ${step} from ${opens}. Pick one of the start times shown.`
      : "That is not one of the booking start times. Pick one of the times shown.";
  },

  outside_opening_hours: (ctx) => {
    const opens = word(ctx.opens);
    const closes = word(ctx.closes);
    const hours = opens && closes ? `${opens} to ${closes}` : "";
    const day = dayName(ctx);
    const who = word(ctx.restaurant);
    if (hours && day) {
      const where = who ? `at ${who}, ` : "";
      return `On ${day}s, ${where}the restaurant is open ${hours}, and a booking has to finish before closing. Pick a start time inside those hours.`;
    }
    if (hours) {
      const lead = who ? `The restaurant ${who}` : "The restaurant";
      return `${lead} is open ${hours}, and a booking has to finish before closing. Pick a start time inside those hours.`;
    }
    return "That time is outside the restaurant's opening hours, or the booking would run past closing time. Pick a time inside opening hours.";
  },

  party_exceeds_capacity: (ctx) => {
    const capacity = Math.floor(Number(ctx.capacity));
    const set = tableSet(ctx);
    const many = set.length > 1;
    const seats = Number.isFinite(capacity) && capacity >= 1
      ? `${many ? "seat" : "seats"} ${capacity} at most`
      : `${many ? "are" : "is"} too small`;
    const bigger = many ? "a larger option" : "a larger table";
    const named = tablePhrase(set);
    if (named) return `${named} ${seats}. Book for fewer people, or pick ${bigger}.`;
    return `That ${many ? "combination of tables" : "table"} ${seats}. Book for fewer people, or pick ${bigger}.`;
  },

  combination_not_allowed: (ctx) => {
    const set = tableSet(ctx);
    const named = tablePhrase(set);
    const offer = "Pick one table, or a pair the restaurant offers.";
    if (setSize(ctx) > 2) {
      return `A booking can use one table, or two tables that go together. ${offer}`;
    }
    return named
      ? `${named} cannot be booked together at this restaurant. ${offer}`
      : `That combination of tables cannot be booked at this restaurant. ${offer}`;
  },

  invalid_local_time: (ctx) => {
    const when = longDate(ctx.date);
    return when
      ? `That start time does not exist on ${when}, because the clocks change that day and skip it. Pick a time after the change.`
      : "That start time does not exist on that date, because the clocks change that day and skip it. Pick a time after the change.";
  },

  cutoff_passed: (ctx) => {
    const cutoff = span(ctx.cutoff_minutes) || span(ctx.minutes);
    const ref = word(ctx.reference);
    const who = ref ? `booking ${ref}` : "this booking";
    return cutoff
      ? `${cap(who)} can only be changed or cancelled more than ${cutoff} before it starts, and it is too close now. Please call the restaurant instead.`
      : `${cap(who)} is too close to its start time to be changed or cancelled. Please call the restaurant instead.`;
  },

  reservation_cancelled: (ctx) => {
    const ref = word(ctx.reference);
    return ref
      ? `Booking ${ref} is cancelled, so it cannot be changed. Make a new booking instead.`
      : "That booking is cancelled, so it cannot be changed. Make a new booking instead.";
  },
};

const ERROR_CODES = Object.freeze(Object.keys(MESSAGES));

function at(place) {
  const name = word(place);
  return name ? ` at ${name}` : "";
}

function forWhen(text) {
  return text ? ` for ${text}` : "";
}

function cap(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function messageFor(code, details) {
  const entry = MESSAGES[code];
  if (typeof entry !== "function") return FALLBACK;
  try {
    const value = entry(details && typeof details === "object" ? details : {});
    return typeof value === "string" && value.trim() !== "" ? value : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

function isKnownCode(code) {
  return Object.prototype.hasOwnProperty.call(MESSAGES, code);
}

function statusFor(code) {
  return STATUS_BY_CODE[code] || 500;
}

function errorBody(code, details) {
  return { error: { code, message: messageFor(code, details) } };
}

module.exports = {
  ERROR_CODES,
  MESSAGES,
  STATUS_BY_CODE,
  FALLBACK,
  messageFor,
  message: messageFor,
  isKnownCode,
  statusFor,
  errorBody,
};
