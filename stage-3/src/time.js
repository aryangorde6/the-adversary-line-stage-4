'use strict';

const MINUTE = 60000;

const formatterCache = new Map();

function formatterFor(timeZone) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function partsInZone(timeZone, instantMs) {
  const parts = formatterFor(timeZone).formatToParts(new Date(instantMs));
  const out = {};
  for (const part of parts) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return { y: out.year, mo: out.month, d: out.day, h: out.hour, mi: out.minute, s: out.second };
}

function offsetAt(timeZone, instantMs) {
  const p = partsInZone(timeZone, instantMs);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

function wallToInstants(timeZone, y, mo, d, h, mi) {
  const nominal = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
  const offsets = new Set([
    offsetAt(timeZone, nominal),
    offsetAt(timeZone, nominal - 24 * 60 * MINUTE),
    offsetAt(timeZone, nominal + 24 * 60 * MINUTE),
  ]);
  const found = [];
  for (const offset of offsets) {
    const candidate = nominal - offset;
    const p = partsInZone(timeZone, candidate);
    if (p.y === y && p.mo === mo && p.d === d && p.h === h && p.mi === mi && !found.includes(candidate)) {
      found.push(candidate);
    }
  }
  found.sort((a, b) => a - b);
  return found;
}

function resolveWallClock(timeZone, y, mo, d, h, mi) {
  const instants = wallToInstants(timeZone, y, mo, d, h, mi);
  return instants.length === 0 ? null : instants[0];
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}

function offsetString(offsetMs) {
  const total = Math.round(offsetMs / MINUTE);
  const sign = total < 0 ? '-' : '+';
  const abs = Math.abs(total);
  return `${sign}${pad(Math.floor(abs / 60), 2)}:${pad(abs % 60, 2)}`;
}

function formatInZone(timeZone, instantMs) {
  const p = partsInZone(timeZone, instantMs);
  const stamp = `${pad(p.y, 4)}-${pad(p.mo, 2)}-${pad(p.d, 2)}T${pad(p.h, 2)}:${pad(p.mi, 2)}:${pad(p.s, 2)}`;
  return stamp + offsetString(offsetAt(timeZone, instantMs));
}

function formatUtc(instantMs) {
  const d = new Date(instantMs);
  const stamp = `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}T${pad(d.getUTCHours(), 2)}:${pad(d.getUTCMinutes(), 2)}:${pad(d.getUTCSeconds(), 2)}`;
  return `${stamp}+00:00`;
}

function daysInMonth(y, mo) {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

function isCalendarDate(y, mo, d) {
  return Number.isInteger(y) && Number.isInteger(mo) && Number.isInteger(d) && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

function weekdayOf(y, mo, d) {
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const HHMM_PATTERN = /^([0-9]{1,2}):([0-9]{2})$/;

function parseHhmm(value) {
  if (typeof value !== 'string') return null;
  const match = HHMM_PATTERN.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const mi = Number(match[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function wallToString(wall) {
  return `${pad(wall.y, 4)}-${pad(wall.mo, 2)}-${pad(wall.d, 2)}T${pad(wall.h, 2)}:${pad(wall.mi, 2)}`;
}

function minutesToHhmm(minutesOfDay) {
  if (!Number.isInteger(minutesOfDay) || minutesOfDay < 0 || minutesOfDay > 24 * 60) return '';
  return `${pad(Math.floor(minutesOfDay / 60), 2)}:${pad(minutesOfDay % 60, 2)}`;
}

function wallFromMinutes(y, mo, d, minutesOfDay) {
  return { y, mo, d, h: Math.floor(minutesOfDay / 60), mi: minutesOfDay % 60 };
}

function parseWall(value) {
  if (typeof value !== 'string') return null;
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})$/.exec(value);
  if (!match) return null;
  const wall = {
    y: Number(match[1]),
    mo: Number(match[2]),
    d: Number(match[3]),
    h: Number(match[4]),
    mi: Number(match[5]),
  };
  if (!isCalendarDate(wall.y, wall.mo, wall.d)) return null;
  if (wall.h > 23 || wall.mi > 59) return null;
  return wall;
}

function dateToString(date) {
  return `${pad(date.y, 4)}-${pad(date.mo, 2)}-${pad(date.d, 2)}`;
}

function parseCalendarDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);
  if (!isCalendarDate(y, mo, d)) return null;
  return { y, mo, d };
}

module.exports = {
  MINUTE,
  WEEKDAY_NAMES,
  isValidTimeZone,
  partsInZone,
  offsetAt,
  wallToInstants,
  resolveWallClock,
  formatInZone,
  formatUtc,
  weekdayOf,
  parseHhmm,
  minutesToHhmm,
  wallToString,
  dateToString,
  wallFromMinutes,
  parseWall,
  parseCalendarDate,
  isCalendarDate,
  offsetString,
  pad,
};