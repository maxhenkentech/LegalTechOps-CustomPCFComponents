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
  | { kind: "literal"; value: ExprValue }
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
    if (t.type === "NUMBER") { this.next(); return { kind: "literal", value: parseFloat(t.value) }; }

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

function toDate(value: ExprValue): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new Error(`"${value}" is not a valid date/time value`);
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
  if (value instanceof Date) return value.toISOString();
  if (isLookupRef(value)) return value.name || value.id;
  return String(value);
}

function isEmpty(value: ExprValue): boolean {
  return value === null || value === undefined || value === "";
}

function addToDate(date: Date, amount: number, unit: string): Date {
  const d = new Date(date.getTime());
  switch (unit.toLowerCase()) {
    case "second": case "seconds": d.setUTCSeconds(d.getUTCSeconds() + amount); return d;
    case "minute": case "minutes": d.setUTCMinutes(d.getUTCMinutes() + amount); return d;
    case "hour": case "hours": d.setUTCHours(d.getUTCHours() + amount); return d;
    case "day": case "days": d.setUTCDate(d.getUTCDate() + amount); return d;
    case "week": case "weeks": d.setUTCDate(d.getUTCDate() + amount * 7); return d;
    case "month": case "months": d.setUTCMonth(d.getUTCMonth() + amount); return d;
    case "year": case "years": d.setUTCFullYear(d.getUTCFullYear() + amount); return d;
    default: throw new Error(`Unknown time unit "${unit}" (expected Second/Minute/Hour/Day/Week/Month/Year)`);
  }
}

// Small hand-rolled subset of .NET custom date format tokens -- not the full .NET format
// spec, just the handful (yyyy/MM/dd/HH/mm/ss) makers are likely to actually type.
function formatDateTime(date: Date, format?: string): string {
  if (!format) return date.toISOString();
  const pad = (num: number) => String(num).padStart(2, "0");
  const tokenValues: Record<string, string> = {
    yyyy: String(date.getUTCFullYear()),
    MM: pad(date.getUTCMonth() + 1),
    dd: pad(date.getUTCDate()),
    HH: pad(date.getUTCHours()),
    mm: pad(date.getUTCMinutes()),
    ss: pad(date.getUTCSeconds()),
  };
  return format.replace(/yyyy|MM|dd|HH|mm|ss/g, (token) => tokenValues[token]);
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

type FnImpl = (args: ExprValue[], ctx: EvalContext) => ExprValue;

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
  div: (args) => toNum(args[0]) / toNum(args[1]),
  mod: (args) => toNum(args[0]) % toNum(args[1]),
  min: (args) => Math.min(...args.map(toNum)),
  max: (args) => Math.max(...args.map(toNum)),
  abs: (args) => Math.abs(toNum(args[0])),
  round: (args) => {
    const digits = args.length >= 2 ? Math.trunc(toNum(args[1])) : 0;
    const factor = Math.pow(10, digits);
    return Math.round(toNum(args[0]) * factor) / factor;
  },

  utcnow: () => new Date(),
  addseconds: (args) => addToDate(toDate(args[0]), toNum(args[1]), "Second"),
  addminutes: (args) => addToDate(toDate(args[0]), toNum(args[1]), "Minute"),
  addhours: (args) => addToDate(toDate(args[0]), toNum(args[1]), "Hour"),
  adddays: (args) => addToDate(toDate(args[0]), toNum(args[1]), "Day"),
  addtotime: (args) => addToDate(toDate(args[0]), toNum(args[1]), toStr(args[2])),
  formatdatetime: (args) => formatDateTime(toDate(args[0]), args.length >= 2 ? toStr(args[1]) : undefined),
  ticks: (args) => Math.round(toDate(args[0]).getTime() * TICKS_PER_MS + TICKS_AT_UNIX_EPOCH),

  coalesce: (args) => {
    for (const a of args) if (!isEmpty(a)) return a;
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

function evalNode(node: AstNode, ctx: EvalContext): ExprValue {
  if (node.kind === "literal") return node.value;
  if (node.kind === "field") return ctx.readField(node.name);

  const fn = FUNCTIONS[node.name.toLowerCase()];
  if (!fn) throw new Error(`Unknown function "${node.name}"`);
  return fn(node.args.map((a) => evalNode(a, ctx)), ctx);
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
