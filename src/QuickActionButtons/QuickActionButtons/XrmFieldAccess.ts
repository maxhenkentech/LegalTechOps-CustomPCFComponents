// Reads/writes fields on the *current form* the control is embedded in, via the global
// Xrm.Page object -- not context.webAPI. This is a deliberate choice (confirmed with the
// user): setValue only, never formContext.data.save(), so a click behaves like a user typing
// into another field (works on unsaved/new records, respects the form's own dirty state) and
// never forces a persist. Xrm.Page is a deprecated-but-still-present global; there is no
// supported, non-deprecated way for a PCF control to reach the live formContext object of the
// page it's hosted in, and no prior art for this in the rest of the repo -- see this control's
// CLAUDE.md for the full rationale and risk callout.

import { ExprValue, FieldReader, LookupRef } from "./ExpressionEngine";

export interface WriteResult {
  ok: boolean;
  error?: string;
}

export interface FieldAccessor {
  formAvailable: boolean;
  readField: FieldReader;
  writeField: (fieldName: string, value: ExprValue) => WriteResult;
  fieldExists: (fieldName: string) => boolean;
  getCurrentUser: () => LookupRef | null;
  saveRecord: () => Promise<WriteResult>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getXrm(): any | undefined {
  // Deliberately window.Xrm only, not a window.top/window.parent fallback: model-driven PCF
  // controls run directly in the form's own top-level window (not a nested iframe), and the
  // Power Apps ESLint plugin flags window.top/parent access as a cross-origin risk in hosting
  // scenarios outside the primary web client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.Xrm?.Page ? w.Xrm : undefined;
}

const warnedKeys = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`[lops.QuickActionButtons] ${message}`);
}

// Xrm hands back/expects lookup GUIDs with curly braces in some places (e.g.
// context.getUserId()) and without in others -- normalize once so comparisons/writes are
// consistent regardless of source.
function normalizeGuid(id: string): string {
  return id.replace(/[{}]/g, "").trim();
}

function isLookupRef(value: ExprValue): value is LookupRef {
  return typeof value === "object" && value !== null && !(value instanceof Date) && "id" in value;
}

// A lookup control (attribute.controls.get(0)) exposes getEntityTypes() -- the table(s) it's
// configured to accept. When exactly one table is configured, we can write a lookup value
// without the maker having to spell out entityType explicitly (e.g. me() or a plain-GUID
// literal for a single-table lookup like a custom contract-to-contact field). A polymorphic
// lookup (e.g. ownerid: systemuser or team) has more than one, so there's no safe default --
// the maker must supply entityType explicitly in that case.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveSingleLookupTargetType(attribute: any): string | undefined {
  try {
    const control = attribute.controls?.get?.(0);
    const types: string[] | undefined = control?.getEntityTypes?.();
    if (types && types.length === 1) return types[0];
  } catch {
    // Fall through -- caller treats "undefined" as "ask the maker to specify entityType".
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coerceForAttribute(attribute: any, value: ExprValue): unknown {
  if (value === null || value === undefined) return null;

  const type: string | undefined = attribute.getAttributeType?.();
  switch (type) {
    case "string":
    case "memo":
      if (isLookupRef(value)) throw new Error("expects text, but got a lookup value");
      return value instanceof Date ? value.toISOString() : String(value);
    case "integer":
    case "decimal":
    case "double":
    case "money": {
      if (isLookupRef(value)) throw new Error("expects a number, but got a lookup value");
      const n = Number(value);
      return Number.isNaN(n) ? undefined : n;
    }
    case "lookup": {
      if (!isLookupRef(value)) {
        throw new Error(`expects a lookup value (from another lookup field, me(), or a literal {"id":"<guid>","entityType":"<table>"}) -- got ${JSON.stringify(value)}`);
      }
      const id = normalizeGuid(value.id);
      if (!id) throw new Error(`lookup value is missing an "id"`);
      const entityType = value.entityType || resolveSingleLookupTargetType(attribute);
      if (!entityType) {
        throw new Error(`could not determine the target table for this lookup automatically (it accepts more than one table) -- specify it explicitly, e.g. {"id":"${id}","entityType":"systemuser"}`);
      }
      return [{ id, entityType, name: value.name }];
    }
    case "multiselectoptionset": {
      // Accepted/produced as a comma-separated string of numeric option values -- the same
      // shape the Dataverse Web API uses for multi-select choice columns -- not a JS array, so
      // a maker can type "100000001,100000002" directly and field-to-field copies round-trip
      // through the same format (see readField below). The Xrm client's setValue, however,
      // wants an actual number[], so that conversion happens right here at write time.
      if (isLookupRef(value)) throw new Error("expects a comma-separated list of choice values, but got a lookup value");
      const parts = (typeof value === "number" ? [String(value)] : String(value).split(","))
        .map((p) => p.trim())
        .filter((p) => p !== "");
      const nums = parts.map(Number);
      if (nums.length === 0 || nums.some((n) => Number.isNaN(n))) return undefined;
      return nums;
    }
    case "datetime": {
      if (isLookupRef(value)) throw new Error("expects a date/time value, but got a lookup value");
      const date = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(date.getTime())) return undefined;

      // getAttributeType() reports "datetime" for both Date Only and Date and Time fields --
      // getFormat() is what actually distinguishes them ("date" vs "datetime"). Date Only
      // fields store a calendar day with no time-of-day, and the Xrm client reads the Date
      // object's *local* year/month/day to decide which day to store. Our expressions
      // (utcNow(), addDays(), etc.) all work in UTC, so handing that Date straight through can
      // land on the wrong calendar day whenever the browser's local offset crosses midnight
      // relative to UTC. Building a local-midnight Date from the UTC calendar date keeps the
      // intended day correct regardless of the user's timezone.
      if (attribute.getFormat?.() === "date") {
        return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      }
      return date;
    }
    case "boolean":
      if (isLookupRef(value)) throw new Error("expects true/false, but got a lookup value");
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      return String(value).toLowerCase() === "true";
    case "optionset": {
      // No label -> value resolution here (that would need a Web API metadata round trip this
      // control otherwise never makes) -- the expression/literal must already evaluate to the
      // underlying numeric option value. Field-to-field copies work because readField already
      // returns another choice field's raw numeric value.
      if (isLookupRef(value)) throw new Error("expects a choice's underlying numeric value, but got a lookup value");
      const n = typeof value === "number" ? value : Number(value);
      return Number.isNaN(n) ? undefined : n;
    }
    default:
      if (isLookupRef(value)) throw new Error("does not support lookup values");
      return value instanceof Date ? value.toISOString() : value;
  }
}

export function createLiveFieldAccessor(): FieldAccessor {
  const xrm = getXrm();

  if (!xrm) {
    return {
      formAvailable: false,
      readField: () => null,
      writeField: () => ({ ok: false, error: "Xrm.Page is not available -- cannot read or write form fields." }),
      fieldExists: () => false,
      getCurrentUser: () => null,
      saveRecord: () => Promise.resolve({ ok: false, error: "Xrm.Page is not available -- cannot save." }),
    };
  }

  const fieldExists = (fieldName: string): boolean => !!xrm.Page.getAttribute(fieldName);

  const getCurrentUser = (): LookupRef | null => {
    try {
      // Xrm.Page.context, same deprecated-but-present family as Xrm.Page.getAttribute used
      // throughout this file -- there's no non-deprecated equivalent that's guaranteed to
      // resolve to *this* form's user context rather than some other frame's.
      const userId: string | undefined = xrm.Page.context?.getUserId?.();
      if (!userId) return null;
      const userName: string | undefined = xrm.Page.context?.getUserName?.();
      return { id: normalizeGuid(userId), entityType: "systemuser", name: userName || undefined };
    } catch {
      return null;
    }
  };

  const readField: FieldReader = (fieldName) => {
    const attribute = xrm.Page.getAttribute(fieldName);
    if (!attribute) {
      warnOnce(`read:${fieldName}`, `Field "${fieldName}" was not found on the current form; evaluated to null.`);
      return null;
    }
    const raw = attribute.getValue();
    if (raw === undefined || raw === null) return null;

    const attrType: string | undefined = attribute.getAttributeType?.();
    if (attrType === "lookup") {
      // Xrm.Page lookups are always an array (single-valued in practice for form fields) of
      // {id, entityType, name} -- take the first entry, or null when cleared ([] or null).
      const arr = raw as { id: string; entityType?: string; name?: string }[];
      if (!arr.length) return null;
      return { id: normalizeGuid(arr[0].id), entityType: arr[0].entityType, name: arr[0].name };
    }
    if (attrType === "multiselectoptionset") {
      // Normalize to the same comma-separated-string shape the Dataverse Web API uses, so a
      // field-to-field copy ("@{hek_othermultichoice}") round-trips through the same format a
      // maker would type as a literal -- see coerceForAttribute's multiselectoptionset case.
      const arr = raw as number[];
      return arr.length ? arr.join(",") : null;
    }
    return raw;
  };

  const writeField = (fieldName: string, value: ExprValue): WriteResult => {
    const attribute = xrm.Page.getAttribute(fieldName);
    if (!attribute) {
      const message = `Field "${fieldName}" was not found on the current form and was not updated.`;
      warnOnce(`write:${fieldName}`, message);
      return { ok: false, error: message };
    }

    let coerced: unknown;
    try {
      coerced = coerceForAttribute(attribute, value);
    } catch (e) {
      const message = `Field "${fieldName}" ${(e as Error).message} and was not updated.`;
      warnOnce(`write:${fieldName}`, message);
      return { ok: false, error: message };
    }
    if (coerced === undefined) {
      const message = `Field "${fieldName}" has a type Quick Action Buttons does not support as a target, or the value could not be converted, and was not updated.`;
      warnOnce(`write:${fieldName}`, message);
      return { ok: false, error: message };
    }

    attribute.setValue(coerced);
    // setValue() alone marks the field dirty but does NOT run any OnChange handlers
    // registered via addOnChange() or the form's OnChange designer config -- fireOnChange()
    // is required to make a button click behave like the user actually editing the field.
    attribute.fireOnChange();
    return { ok: true };
  };

  // Only invoked when the maker has explicitly turned on "Save record on click" (default off) --
  // see QuickActionButtonsControl.tsx's onClick, which calls this strictly after every
  // writeField() call for the click has already applied, never before.
  const saveRecord = (): Promise<WriteResult> => {
    try {
      return xrm.Page.data.save().then(
        () => ({ ok: true }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: any) => ({ ok: false, error: err?.message || "Save failed" })
      );
    } catch (e) {
      return Promise.resolve({ ok: false, error: (e as Error).message });
    }
  };

  return { formAvailable: true, readField, writeField, fieldExists, getCurrentUser, saveRecord };
}
