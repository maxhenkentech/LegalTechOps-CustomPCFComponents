// Hand-rolled recursive-descent parser/evaluator for the Power-Automate-style expression
// language used inside a button's Actions JSON (e.g. "@{concat(toUpper(hek_first), ' ', hek_last)}").
// No operators are needed -- every supported capability (string/math/date functions, coalesce)
// is a function call, matching how Power Automate's own expression language is shaped. This is
// intentionally self-contained (no npm dependency) since this repo has no shared code between
// controls and the grammar is small enough not to need one.

// A lookup field's value (single-valued -- owner/customer/regarding, etc.). Produced by reading
// another lookup field, by me(), or by a maker-typed JSON literal {"id":"...","entityType":"..."}.
// entityType is optional on a literal/me() result only when the *target* field's lookup control
// accepts exactly one table -- see resolveSingleLookupTargetType in XrmFieldAccess.ts.
export interface LookupRef {
  id: string;
  entityType?: string;
  name?: string;
}

export type ExprValue = string | number | boolean | Date | LookupRef | null;

// Reads a field's current value off the record the button is acting on (the live form via
// Xrm.Page in production, or the test-mode fixture in the harness). Multi-select choice fields
// are represented as a comma-separated string of numeric option values -- the same shape the
// Dataverse Web API uses -- not a JS array, so ExprValue doesn't need an array variant just for
// this one field type.
export type FieldReader = (fieldName: string) => ExprValue;

// Threaded through expression evaluation so a function (currently just me()) can reach something
// beyond the current record's fields. Kept separate from FieldReader since most functions need
// neither -- FnImpl below accepts it but most entries in the FUNCTIONS catalog ignore it.
export interface EvalContext {
  readField: FieldReader;
  getCurrentUser: () => LookupRef | null;
}

// ---- Tokenizer ----

type TokenType = "IDENT" | "STRING" | "NUMBER" | "LPAREN" | "RPAREN" | "COMMA" | "EOF";

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const n = src.length;
  let i = 0;

  while (i < n) {
    const ch = src[i];

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }
    if (ch === "(") { tokens.push({ type: "LPAREN", value: "(" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "RPAREN", value: ")" }); i++; continue; }
    if (ch === ",") { tokens.push({ type: "COMMA", value: "," }); i++; continue; }

    if (ch === "'") {
      // '' escapes a single embedded quote, same convention as Power Automate/WDL string literals.
      let j = i + 1;
      let out = "";
      while (j < n) {
        if (src[j] === "'") {
          if (src[j + 1] === "'") { out += "'"; j += 2; continue; }
          break;
        }
        out += src[j];
        j++;
      }
      tokens.push({ type: "STRING", value: out });
      i = j + 1;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(src[i + 1] || ""))) {
      let j = i + 1;
      while (j < n && /[0-9.]/.test(src[j])) j++;
      tokens.push({ type: "NUMBER", value: src.substring(i, j) });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      tokens.push({ type: "IDENT", value: src.substring(i, j) });
      i = j;
      continue;
    }

    throw new Error(`Unexpected character "${ch}" at position ${i}`);
  }

  tokens.push({ type: "EOF", value: "" });
  return tokens;
}

// ---- Parser ----

type AstNode =
  | { kind: "literal"; value: ExprValue; isFloat?: boolean }
  | { kind: "field"; name: string }
  | { kind: "call"; name: string; args: AstNode[] };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.pos]; }
  private next(): Token { return this.tokens[this.pos++]; }

  private expect(type: TokenType): Token {
    const t = this.next();
    if (t.type !== type) throw new Error(`Expected ${type} but found "${t.value}"`);
    return t;
  }

  parseExpr(): AstNode {
    const t = this.peek();

    if (t.type === "STRING") { this.next(); return { kind: "literal", value: t.value }; }
    if (t.type === "NUMBER") { this.next(); return { kind: "literal", value: parseFloat(t.value), isFloat: /[.eE]/.test(t.value) }; }

    if (t.type === "IDENT") {
      const name = t.value;
      // true/false/null are reserved literal keywords, not field names or zero-arg calls.
      if (name === "true") { this.next(); return { kind: "literal", value: true }; }
      if (name === "false") { this.next(); return { kind: "literal", value: false }; }
      if (name === "null") { this.next(); return { kind: "literal", value: null }; }

      this.next();
      if (this.peek().type === "LPAREN") {
        this.next();
        const args: AstNode[] = [];
        if (this.peek().type !== "RPAREN") {
          args.push(this.parseExpr());
          while (this.peek().type === "COMMA") {
            this.next();
            args.push(this.parseExpr());
          }
        }
        this.expect("RPAREN");
        return { kind: "call", name, args };
      }
      // A bare identifier not followed by "(" is a reference to another field on the current record.
      return { kind: "field", name };
    }

    throw new Error(`Unexpected token "${t.value}"`);
  }

  expectEnd(): void {
    const t = this.peek();
    if (t.type !== "EOF") throw new Error(`Unexpected trailing input starting at "${t.value}"`);
  }
}

// ---- Evaluation helpers ----

// .NET ticks (100ns units) between 0001-01-01T00:00:00 and the Unix epoch -- needed to
// replicate Power Automate's ticks() function, which counts from the .NET epoch, not Unix time.
const TICKS_AT_UNIX_EPOCH = 621355968000000000;
const TICKS_PER_MS = 10000;

// Reads a date/time written as text, always as UTC when the text has no zone - the same convention as every
// date function here - instead of JavaScript's Date parser, which reads "1/31/2026 10:20 AM" and
// "2026-01-31 10:20" as browser-local time and rejects "31.01.2026". Accepts ISO 8601 (with or without
// time, "T" or a space, fractions, Z or +hh:mm), everything formatDateTime() prints (all standard formats
// except the time-only "t"/"T"), and numeric dates: dots or dashes are day-first (31.01.2026), slashes
// month-first like Power Automate's "d" format (1/31/2026), unless the first number can't be a month.
// Returns null when the text isn't a date. (2026-10-03, user: "make sure the results can go into a
// date/datetime field properly".)
// en-US names, used by both parseTimestamp and formatDateTime.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_INDEX: Record<string, number> = {};
MONTHS.forEach((m, i) => { MONTH_INDEX[m.toLowerCase()] = i; MONTH_INDEX[m.substring(0, 3).toLowerCase()] = i; });

export function parseTimestamp(text: string): Date | null {
  const s = text.trim();
  const utc = (y: number, mo: number, d: number, h = 0, mi = 0, sec = 0, ms = 0): Date | null => {
    if (mo < 0 || mo > 11 || d < 1 || h > 23 || mi > 59 || sec > 59) return null;
    const date = new Date(Date.UTC(y, mo, d, h, mi, sec, ms));
    date.setUTCFullYear(y); // Date.UTC maps years 0-99 to 1900-1999
    return date.getUTCDate() === d ? date : null; // rejects 31 February
  };
  const fullYear = (y: string) => (y.length <= 2 ? 2000 + Number(y) : Number(y));

  // ISO 8601: 2026-01-31, 2026-01-31T10:20, 2026-01-31 10:20:30.1234567Z, 2026-01-31T10:20:30+02:00
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,7}))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i);
  if (iso) {
    const ms = iso[7] ? Math.round(Number(`0.${iso[7]}`) * 1000) : 0;
    const date = utc(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0), ms);
    if (date && iso[8] && iso[8].toUpperCase() !== "Z") {
      const [, sign, hh, mm] = iso[8].match(/([+-])(\d{2}):?(\d{2})?/) as RegExpMatchArray;
      date.setTime(date.getTime() - (sign === "-" ? -1 : 1) * (Number(hh) * 60 + Number(mm ?? 0)) * 60000);
    }
    return date;
  }

  // A clock time anywhere in the text: 10:20, 10:20:30, 10:20:30.123, optional AM/PM
  let h = 0, mi = 0, sec = 0, ms = 0, rest = s;
  const time = s.match(/(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,7}))?)?\s*([AaPp][Mm]?)?(?=\s|$|\s*(?:GMT|UTC|Z)\b)/);
  if (time) {
    h = Number(time[1]); mi = Number(time[2]); sec = Number(time[3] ?? 0); ms = time[4] ? Math.round(Number(`0.${time[4]}`) * 1000) : 0;
    const ampm = time[5]?.[0].toUpperCase();
    if (ampm && (h < 1 || h > 12)) return null;
    if (ampm === "P" && h < 12) h += 12;
    if (ampm === "A" && h === 12) h = 0;
    rest = (s.substring(0, time.index) + " " + s.substring((time.index ?? 0) + time[0].length)).trim();
  }
  rest = rest.replace(/\b(GMT|UTC|Z)\b/i, "").replace(/[,]+/g, " ").trim();

  // Numeric dates: 31.01.2026, 31-01-2026, 1/31/2026, 2026/01/31, 31.01.26
  const num = rest.match(/^(\d{1,4})([./-])(\d{1,2})\2(\d{1,4})$/);
  if (num) {
    const [a, sep, b, c] = [num[1], num[2], num[3], num[4]];
    if (a.length === 4) return utc(+a, +b - 1, +c, h, mi, sec, ms);
    const dayFirst = sep !== "/" || Number(a) > 12;
    return dayFirst ? utc(fullYear(c), +b - 1, +a, h, mi, sec, ms) : utc(fullYear(c), +a - 1, +b, h, mi, sec, ms);
  }

  // Month names: "Saturday, January 31, 2026", "Sat, 31 Jan 2026", "January 31", "January 2026", "31 January 2026"
  const words = rest.split(/\s+/).filter((w) => w !== "");
  const monthWord = words.find((w) => MONTH_INDEX[w.toLowerCase().replace(/\.$/, "")] !== undefined);
  if (monthWord !== undefined) {
    const mo = MONTH_INDEX[monthWord.toLowerCase().replace(/\.$/, "")];
    const nums = words.filter((w) => /^\d+$/.test(w));
    const others = words.filter((w) => w !== monthWord && !/^\d+$/.test(w));
    if (others.some((w) => !DAYS.some((d) => d.toLowerCase() === w.toLowerCase() || d.substring(0, 3).toLowerCase() === w.toLowerCase()))) return null;
    const yearWord = nums.find((w) => w.length === 4);
    const dayWord = nums.find((w) => w.length <= 2);
    if (nums.length > 2) return null;
    const year = yearWord ? Number(yearWord) : new Date().getUTCFullYear(); // "MMMM d" (format "M") has no year
    return utc(year, mo, dayWord ? Number(dayWord) : 1, h, mi, sec, ms); // "MMMM yyyy" (format "Y") has no day
  }
  return null;
}

function toDate(value: ExprValue): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = parseTimestamp(value);
    if (!d) throw new Error(`"${value}" is not a valid date/time value`);
    return d;
  }
  if (value === null) {
    throw new Error("Expected a date/time value, but the referenced field is empty");
  }
  throw new Error(`Expected a date/time value, but got ${JSON.stringify(value)}`);
}

function toNum(value: ExprValue): number {
  if (isLookupRef(value)) throw new Error("Cannot use a lookup value where a number is expected");
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`"${String(value)}" is not a valid number`);
  return n;
}

function isLookupRef(value: unknown): value is LookupRef {
  return typeof value === "object" && value !== null && !(value instanceof Date) && "id" in value;
}

function toStr(value: ExprValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatTimestamp(value);
  if (isLookupRef(value)) return value.name || value.id;
  return String(value);
}

function isEmpty(value: ExprValue): boolean {
  return value === null || value === undefined || value === "";
}

// Month/year steps keep the day of the month, clamped to the target month's last day - Jan 31 + 1 month is
// Feb 28 (29 in a leap year), as in Power Automate (.NET AddMonths). A plain setUTCMonth() would overflow into
// March instead (found by the 2026-10-03 expression tests).
function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

function addToDate(date: Date, amount: number, unit: string): Date {
  const d = new Date(date.getTime());
  switch (unit.toLowerCase()) {
    case "second": case "seconds": d.setUTCSeconds(d.getUTCSeconds() + amount); return d;
    case "minute": case "minutes": d.setUTCMinutes(d.getUTCMinutes() + amount); return d;
    case "hour": case "hours": d.setUTCHours(d.getUTCHours() + amount); return d;
    case "day": case "days": d.setUTCDate(d.getUTCDate() + amount); return d;
    case "week": case "weeks": d.setUTCDate(d.getUTCDate() + amount * 7); return d;
    case "month": case "months": return addMonthsClamped(d, amount);
    case "year": case "years": return addMonthsClamped(d, amount * 12);
    default: throw new Error(`Unknown time unit "${unit}" (expected Second/Minute/Hour/Day/Week/Month/Year)`);
  }
}

// Power Automate's formatDateTime: .NET custom and standard date/time format strings, en-US, always UTC
// (2026-10-03: the old 6-token subset and the 3-decimal default were replaced, so results match Power Automate).
const STANDARD_FORMATS: Record<string, string> = {
  d: "M/d/yyyy", D: "dddd, MMMM d, yyyy", f: "dddd, MMMM d, yyyy h:mm tt", F: "dddd, MMMM d, yyyy h:mm:ss tt",
  g: "M/d/yyyy h:mm tt", G: "M/d/yyyy h:mm:ss tt", M: "MMMM d", m: "MMMM d",
  O: "yyyy'-'MM'-'dd'T'HH':'mm':'ss'.'fffffffK", o: "yyyy'-'MM'-'dd'T'HH':'mm':'ss'.'fffffffK",
  R: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", r: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", s: "yyyy'-'MM'-'dd'T'HH':'mm':'ss",
  t: "h:mm tt", T: "h:mm:ss tt", u: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", U: "dddd, MMMM d, yyyy h:mm:ss tt", Y: "MMMM yyyy", y: "MMMM yyyy",
};

function formatDateTime(date: Date, format?: string): string {
  let pattern = format === undefined || format === "" ? "o" : format;
  if (pattern.length === 1) {
    if (!STANDARD_FORMATS[pattern]) throw new Error(`"${pattern}" is not a valid date/time format`);
    pattern = STANDARD_FORMATS[pattern];
  }
  const pad = (num: number, width: number) => String(num).padStart(width, "0");
  const Y = date.getUTCFullYear(), Mo = date.getUTCMonth(), D = date.getUTCDate(), wd = date.getUTCDay();
  const H = date.getUTCHours(), Mi = date.getUTCMinutes(), S = date.getUTCSeconds(), ms = date.getUTCMilliseconds();
  const h12 = H % 12 === 0 ? 12 : H % 12;
  const fraction = pad(ms, 3) + "0000"; // 7 digits; JavaScript dates stop at milliseconds
  let out = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "'" || ch === '"') {
      const end = pattern.indexOf(ch, i + 1);
      if (end < 0) throw new Error(`Unterminated quote in date/time format "${pattern}"`);
      out += pattern.substring(i + 1, end);
      i = end + 1;
      continue;
    }
    if (ch === "\\") { out += pattern[i + 1] ?? ""; i += 2; continue; }
    if (ch === "%") { i++; continue; }
    let n = 1;
    while (pattern[i + n] === ch) n++;
    switch (ch) {
      case "y": out += n === 1 ? String(Y % 100) : n === 2 ? pad(Y % 100, 2) : pad(Y, n); break;
      case "M": out += n === 1 ? String(Mo + 1) : n === 2 ? pad(Mo + 1, 2) : n === 3 ? MONTHS[Mo].substring(0, 3) : MONTHS[Mo]; break;
      case "d": out += n === 1 ? String(D) : n === 2 ? pad(D, 2) : n === 3 ? DAYS[wd].substring(0, 3) : DAYS[wd]; break;
      case "H": out += n === 1 ? String(H) : pad(H, 2); break;
      case "h": out += n === 1 ? String(h12) : pad(h12, 2); break;
      case "m": out += n === 1 ? String(Mi) : pad(Mi, 2); break;
      case "s": out += n === 1 ? String(S) : pad(S, 2); break;
      case "f": out += fraction.substring(0, Math.min(n, 7)); break;
      case "F": out += fraction.substring(0, Math.min(n, 7)).replace(/0+$/, ""); break;
      case "t": out += n === 1 ? (H < 12 ? "A" : "P") : (H < 12 ? "AM" : "PM"); break;
      case "g": out += "A.D."; break;
      case "K": out += "Z"; break;
      case "z": out += n === 1 ? "+0" : n === 2 ? "+00" : "+00:00"; break;
      default: out += ch.repeat(n);
    }
    i += n;
  }
  return out;
}

// A date/time as text, the way Power Automate prints timestamps ("o": 2026-01-31T10:20:30.0000000Z).
export function formatTimestamp(date: Date): string {
  return formatDateTime(date);
}

// Date functions take an optional last format argument in Power Automate (utcNow('yyyy-MM-dd'),
// addDays(ts, 1, 'dd.MM.yyyy')): without one they return the timestamp itself.
function withFormat(date: Date, format: ExprValue | undefined): ExprValue {
  return format === undefined || isEmpty(format) ? date : formatDateTime(date, toStr(format));
}

// Generates a random RFC4122 v4 GUID string. Prefers the platform's own crypto.randomUUID()
// (cast rather than typed against the DOM lib's Crypto interface directly, so this still compiles
// regardless of exactly which TS/lib version is resolved) and falls back to a Math.random-based
// generator on a host without it -- fine for a maker-facing convenience value, not a claim of
// cryptographic randomness.
function generateGuid(): string {
  const globalCrypto = (typeof crypto !== "undefined" ? crypto : undefined) as { randomUUID?: () => string } | undefined;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---- Function catalog ----
// Names and semantics deliberately mirror Power Automate's real expression functions so the
// syntax feels familiar. This is a documented, bounded set (see docs/QuickActionButtons.md's
// Expression Reference) -- not literally every function Power Automate has.

// floats[i]: whether argument i is a decimal number (a literal written with a decimal point, a non-whole value,
// or the result of decimal math), which Power Automate's div needs.
type FnImpl = (args: ExprValue[], ctx: EvalContext, floats: boolean[]) => ExprValue;

const FUNCTIONS: Record<string, FnImpl> = {
  concat: (args) => args.map(toStr).join(""),
  toupper: (args) => toStr(args[0]).toUpperCase(),
  tolower: (args) => toStr(args[0]).toLowerCase(),
  trim: (args) => toStr(args[0]).trim(),
  substring: (args) => {
    const text = toStr(args[0]);
    const start = Math.trunc(toNum(args[1]));
    if (args.length >= 3 && !isEmpty(args[2])) {
      return text.substring(start, start + Math.trunc(toNum(args[2])));
    }
    return text.substring(start);
  },
  // Replaces every occurrence, not just the first -- matches Power Automate's replace() semantics.
  replace: (args) => {
    const text = toStr(args[0]);
    const oldText = toStr(args[1]);
    const newText = toStr(args[2]);
    return oldText === "" ? text : text.split(oldText).join(newText);
  },
  length: (args) => toStr(args[0]).length,

  add: (args) => toNum(args[0]) + toNum(args[1]),
  sub: (args) => toNum(args[0]) - toNum(args[1]),
  mul: (args) => toNum(args[0]) * toNum(args[1]),
  // As in Power Automate: two whole numbers divide as whole numbers (div(7, 2) is 3, truncated toward zero),
  // a decimal on either side divides exactly (div(7, 2.0) is 3.5); dividing by zero is an error.
  div: (args, _ctx, floats) => {
    const a = toNum(args[0]), b = toNum(args[1]);
    if (b === 0) throw new Error("div() cannot divide by zero");
    return floats[0] || floats[1] ? a / b : Math.trunc(a / b);
  },
  mod: (args) => {
    const b = toNum(args[1]);
    if (b === 0) throw new Error("mod() cannot divide by zero");
    return toNum(args[0]) % b;
  },
  min: (args) => Math.min(...args.map(toNum)),
  max: (args) => Math.max(...args.map(toNum)),
  abs: (args) => Math.abs(toNum(args[0])),
  // Not a Power Automate function (nor is abs). Halves round away from zero (2.5 -> 3, -2.5 -> -3). Shifting
  // the decimal point in the number's text form avoids binary floating-point misses: 1.005 * 100 is
  // 100.49999..., so round(1.005, 2) used to give 1 instead of 1.01 (2026-10-03 expression tests).
  round: (args) => {
    const digits = args.length >= 2 ? Math.trunc(toNum(args[1])) : 0;
    const value = toNum(args[0]);
    const text = String(Math.abs(value));
    // Numbers JavaScript prints in exponent form (1e-7, 1e21) can't take another "e"; plain arithmetic is fine there.
    const result = /e/i.test(text)
      ? Math.round(Math.abs(value) * Math.pow(10, digits)) / Math.pow(10, digits)
      : Number(`${Math.round(Number(`${text}e${digits}`))}e${-digits}`);
    return value < 0 ? -result : result;
  },

  utcnow: (args) => withFormat(new Date(), args[0]),
  addseconds: (args) => withFormat(addToDate(toDate(args[0]), toNum(args[1]), "Second"), args[2]),
  addminutes: (args) => withFormat(addToDate(toDate(args[0]), toNum(args[1]), "Minute"), args[2]),
  addhours: (args) => withFormat(addToDate(toDate(args[0]), toNum(args[1]), "Hour"), args[2]),
  adddays: (args) => withFormat(addToDate(toDate(args[0]), toNum(args[1]), "Day"), args[2]),
  addtotime: (args) => withFormat(addToDate(toDate(args[0]), toNum(args[1]), toStr(args[2])), args[3]),
  formatdatetime: (args) => formatDateTime(toDate(args[0]), args.length >= 2 ? toStr(args[1]) : undefined),
  ticks: (args) => Math.round(toDate(args[0]).getTime() * TICKS_PER_MS + TICKS_AT_UNIX_EPOCH),

  // Power Automate: the first argument that isn't null - an empty string counts as a value.
  coalesce: (args) => {
    for (const a of args) if (a !== null && a !== undefined) return a;
    return null;
  },

  // A fresh random GUID string, e.g. for a maker-generated correlation/reference value.
  guid: () => generateGuid(),
  // Random integer, inclusive at min and exclusive at max -- matches Power Automate's rand().
  rand: (args) => {
    const min = Math.trunc(toNum(args[0]));
    const max = Math.trunc(toNum(args[1]));
    if (max <= min) throw new Error(`rand(min, max) requires max to be greater than min (got ${min}, ${max})`);
    return min + Math.floor(Math.random() * (max - min));
  },

  // Current user, for actions like "assign to me": me() -> {id, entityType: "systemuser", name}.
  // Only makes sense as (or inside) a value written to a lookup-typed target field.
  me: (_args, ctx) => {
    const user = ctx.getCurrentUser();
    if (!user) throw new Error("The current user is not available");
    return user;
  },
};

// Functions whose number result is a decimal whenever any argument is (add(1.5, 0.5) stays a decimal 2.0),
// so a later div() divides it exactly, as in Power Automate.
const FLOAT_PROPAGATING = new Set(["add", "sub", "mul", "div", "mod", "min", "max", "abs"]);

function isFloatValue(value: ExprValue, flagged: boolean): boolean {
  if (typeof value === "number") return flagged || !Number.isInteger(value);
  if (typeof value === "string") return /[.eE]/.test(value.trim()) && !Number.isNaN(Number(value));
  return false;
}

interface Typed { value: ExprValue; isFloat: boolean }

function evalTyped(node: AstNode, ctx: EvalContext): Typed {
  if (node.kind === "literal") return { value: node.value, isFloat: isFloatValue(node.value, !!node.isFloat) };
  if (node.kind === "field") {
    const value = ctx.readField(node.name);
    return { value, isFloat: isFloatValue(value, false) };
  }
  const name = node.name.toLowerCase();
  const fn = FUNCTIONS[name];
  if (!fn) throw new Error(`Unknown function "${node.name}"`);
  const args = node.args.map((a) => evalTyped(a, ctx));
  const floats = args.map((a) => a.isFloat);
  const value = fn(args.map((a) => a.value), ctx, floats);
  return { value, isFloat: isFloatValue(value, FLOAT_PROPAGATING.has(name) && floats.some((f) => f)) };
}

function evalNode(node: AstNode, ctx: EvalContext): ExprValue {
  return evalTyped(node, ctx).value;
}

export function evaluateExpression(source: string, ctx: EvalContext): ExprValue {
  const parser = new Parser(tokenize(source));
  const ast = parser.parseExpr();
  parser.expectEnd();
  return evalNode(ast, ctx);
}

const EXPRESSION_WRAPPER_PATTERN = /^@\{([\s\S]*)\}$/;

// A common typo: the delimiters reversed ("{@...}" instead of "@{...}"). Checked only for the
// validator's benefit (a helpful, specific error) -- resolveActionValue below intentionally
// still treats it as a literal, since guessing at "fixing" a maker's typo at write-time would be
// worse than clearly rejecting it at config-time instead.
const REVERSED_EXPRESSION_WRAPPER_PATTERN = /^\{@[\s\S]*\}$/;

// A maker-typed lookup literal in the Actions JSON, e.g. {"id":"<guid>","entityType":"systemuser"}.
// entityType/name are optional -- entityType can often be inferred at write time from the target
// field's own lookup control (see resolveSingleLookupTargetType in XrmFieldAccess.ts).
function isLookupLiteral(value: unknown): value is { id: unknown; entityType?: unknown; name?: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "id" in value;
}

// Resolves one JSON value from a button's Actions map: a string wrapped in @{...} is parsed
// and evaluated as an expression; a JSON object with an "id" property is a lookup-value literal;
// any other JSON string/number/boolean/null is used literally, so a maker who just wants a fixed
// value ("hek_status": "Approved") never has to touch @{}. Matching trims incidental
// leading/trailing whitespace around the @{...} wrapper (so "@{utcNow()} " still resolves as an
// expression) without altering the literal fallback value itself.
export function resolveActionValue(rawValue: unknown, ctx: EvalContext): ExprValue {
  if (typeof rawValue === "string") {
    const match = rawValue.trim().match(EXPRESSION_WRAPPER_PATTERN);
    if (match) return evaluateExpression(match[1], ctx);
    return rawValue;
  }
  if (rawValue === null || typeof rawValue === "number" || typeof rawValue === "boolean") {
    return rawValue;
  }
  if (isLookupLiteral(rawValue)) {
    return {
      id: String(rawValue.id),
      entityType: rawValue.entityType !== undefined ? String(rawValue.entityType) : undefined,
      name: rawValue.name !== undefined ? String(rawValue.name) : undefined,
    };
  }
  // Any other object/array JSON value isn't a valid single-field target -- stringify rather than
  // silently dropping the key, so a maker's mistake is visible in the field instead of vanishing.
  return JSON.stringify(rawValue);
}

// ---- Validation, used to surface config mistakes at render time instead of only on click.
// Two tiers: syntax (JSON well-formedness, expression grammar, unknown function names) always
// runs, since it needs no live data. Field-existence checking is opt-in via the `fieldExists`
// callback -- it needs a real record (Xrm.Page in production, or the test-mode fixture in the
// harness), which this control may not have available (e.g. before Xrm has loaded), so callers
// only pass it when `formAvailable` is true. ----

function checkFunctionNamesAreKnown(node: AstNode): void {
  if (node.kind === "call") {
    if (!FUNCTIONS[node.name.toLowerCase()]) {
      throw new Error(`Unknown function "${node.name}"`);
    }
    node.args.forEach(checkFunctionNamesAreKnown);
  }
}

function collectFieldReferences(node: AstNode, out: Set<string>): void {
  if (node.kind === "field") {
    out.add(node.name);
  } else if (node.kind === "call") {
    node.args.forEach((arg) => collectFieldReferences(arg, out));
  }
}

// Throws with a human-readable message on any syntax problem; returns the parsed AST so callers
// that also need field references (validateActionsJson) don't have to re-parse.
function parseAndCheckSyntax(source: string): AstNode {
  const parser = new Parser(tokenize(source));
  const ast = parser.parseExpr();
  parser.expectEnd();
  checkFunctionNamesAreKnown(ast);
  return ast;
}

export type ExpressionSyntaxResult = { valid: true } | { valid: false; error: string };

export function validateExpressionSyntax(source: string): ExpressionSyntaxResult {
  try {
    parseAndCheckSyntax(source);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

// Validates one button's raw Actions JSON: well-formed JSON, an object (not array/primitive),
// every @{...}-wrapped value syntactically valid, and -- only when `fieldExists` is supplied --
// that every target field (each JSON key) and every field referenced inside an expression
// actually exists on the current record. Returns one message per problem found, empty when
// there's nothing to report (including "no Actions configured").
export function validateActionsJson(rawJson: string | undefined, fieldExists?: (fieldName: string) => boolean): string[] {
  if (!rawJson || rawJson.trim() === "") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    return [`Invalid JSON: ${(e as Error).message}`];
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return ["Actions must be a JSON object mapping field names to values, e.g. {\"hek_status\":\"Approved\"}."];
  }

  const errors: string[] = [];
  for (const [field, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
    if (fieldExists && !fieldExists(field)) {
      errors.push(`Target field "${field}" was not found on the current form.`);
    }

    if (isLookupLiteral(rawValue)) {
      if (typeof rawValue.id !== "string" || rawValue.id.trim() === "") {
        errors.push(`Field "${field}": a lookup value must include a non-empty string "id" property, e.g. {"id":"<guid>","entityType":"systemuser"}.`);
      }
      continue;
    }

    if (typeof rawValue !== "string") continue;
    const trimmedValue = rawValue.trim();
    const match = trimmedValue.match(EXPRESSION_WRAPPER_PATTERN);
    if (!match) {
      if (REVERSED_EXPRESSION_WRAPPER_PATTERN.test(trimmedValue)) {
        errors.push(`Field "${field}": expression wrapper looks reversed -- use @{...} (at-sign, then brace), not {@...}.`);
      }
      continue;
    }

    let ast: AstNode;
    try {
      ast = parseAndCheckSyntax(match[1]);
    } catch (e) {
      errors.push(`Field "${field}": ${(e as Error).message}`);
      continue;
    }

    if (fieldExists) {
      const referenced = new Set<string>();
      collectFieldReferences(ast, referenced);
      referenced.forEach((name) => {
        if (!fieldExists(name)) {
          errors.push(`Field "${field}": expression references field "${name}", which was not found on the current form.`);
        }
      });
    }
  }
  return errors;
}
