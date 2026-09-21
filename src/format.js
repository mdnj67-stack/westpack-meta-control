/**
 * One place that decides how a number looks.
 *
 * Before this, money was formatted five different ways. The Meta dashboard pinned en-GB
 * with two decimals ("DKK 248,388.13"), the expansion tables and the whole Klaviyo side
 * followed the reader's browser locale, and two of those used no decimals while the
 * others used two. On a Danish machine that put "DKK 248,388.13" and "93.175,00 kr." on
 * the same screen, describing the same currency.
 *
 * So the locale is pinned, once, here. It is Danish because the people who read this are
 * the Danish marketing department and the account reports in DKK - and because half the
 * product already rendered that way. Changing it for the whole application is now a
 * one-line edit.
 *
 * The server formats a handful of figures before they reach the browser
 * (api/meta/account-snapshot.js). There is no bundler in this repo, so that file carries
 * its own copy of these two constants and tests/number-format-parity.test.js fails if the
 * two ever drift.
 */

export const NUMBER_LOCALE = "da-DK";

// Money is shown in whole units. Every amount on this account is at least tens of kroner,
// so the øre were noise in a column the reader is scanning for magnitude.
export const MONEY_FRACTION_DIGITS = 0;

const FALLBACK = "--";

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** An amount of money, in whole units of the account currency. */
export function formatMoney(value, currency = "DKK", fallback = FALLBACK) {
  const number = toNumber(value);
  if (number === null) return fallback;
  return new Intl.NumberFormat(NUMBER_LOCALE, {
    style: "currency",
    currency: String(currency || "DKK").trim().toUpperCase() || "DKK",
    minimumFractionDigits: MONEY_FRACTION_DIGITS,
    maximumFractionDigits: MONEY_FRACTION_DIGITS
  }).format(number);
}

/** A count of things: people, purchases, campaigns. Never fractional. */
export function formatCount(value, fallback = FALLBACK) {
  const number = toNumber(value);
  if (number === null) return fallback;
  return new Intl.NumberFormat(NUMBER_LOCALE, { maximumFractionDigits: 0 }).format(number);
}

/** A ratio that is not a percentage - ROAS, frequency. */
export function formatDecimal(value, digits = 2, fallback = FALLBACK) {
  const number = toNumber(value);
  if (number === null) return fallback;
  return new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(number);
}

/** A percentage, given as the percentage itself (12.4 renders as 12,4%). */
export function formatPercent(value, digits = 1, fallback = FALLBACK) {
  const number = toNumber(value);
  if (number === null) return fallback;
  return `${formatDecimal(number, digits)}%`;
}

/**
 * A signed change, for a badge beside a figure. The sign is part of the meaning, so it is
 * always shown - "+0,0%" and "0,0%" say different things about a metric that moved.
 */
export function formatSignedPercent(value, digits = 1, fallback = FALLBACK) {
  const number = toNumber(value);
  if (number === null) return fallback;
  return `${number > 0 ? "+" : ""}${formatPercent(number, digits)}`;
}
