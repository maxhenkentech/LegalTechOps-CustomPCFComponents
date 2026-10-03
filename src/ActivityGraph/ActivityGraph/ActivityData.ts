// ---------------------------------------------------------------------------------------------
// Loading the record's history from the Dataverse Web API: audit entries, activities regarding
// the record, and notes. Raw fetch (as in RelationshipView) because we page through nextLinks and
// want FormattedValue annotations for user names and audit actions.
// ---------------------------------------------------------------------------------------------

export type Source = "Audit" | "Activities" | "Notes" | "ActivitiesAndNotes" | "All";
export type ActivityDate = "CreatedOn" | "CompletedOn";
export type ItemKind = "audit" | "activity" | "note";

export interface IHistoryItem {
	id: string;
	kind: ItemKind;
	// When it happened, real UTC instant.
	when: Date;
	title: string;
	// Who did it (audit user, activity/note created by).
	by?: string;
	// audit: Dataverse operation (1 Create, 2 Update, 3 Delete) - picks the icon.
	operation?: number;
	// audit: the changed columns' column numbers (from attributemask), named lazily via
	// loadColumns only when a square's details are opened.
	columnNumbers?: number[];
	// activity: its logical name (email, phonecall, ...) - icon, and the form to open.
	activityType?: string;
	// note: start of the note text.
	snippet?: string;
}

export interface ISourceProblem {
	kind: ItemKind;
	// "disabled": auditing is off for the environment or table. "denied": 403. "error": anything else.
	reason: "disabled" | "denied" | "error";
	message?: string;
}

export interface ILoadResult {
	items: IHistoryItem[];
	problems: ISourceProblem[];
	// More than MAX_ITEMS_PER_SOURCE in range - the newest are kept, the summary says "+".
	truncated: boolean;
}

export const MAX_ITEMS_PER_SOURCE = 20000;
const PAGE_SIZE = 5000;
const API = "/api/data/v9.2";
const HEADERS = {
	Accept: "application/json",
	"OData-MaxVersion": "4.0",
	"OData-Version": "4.0",
	Prefer: `odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=${PAGE_SIZE}`,
};
const FORMATTED = "@OData.Community.Display.V1.FormattedValue";

export const sourceKinds = (source: Source): ItemKind[] => {
	switch (source) {
		case "Activities":
			return ["activity"];
		case "Notes":
			return ["note"];
		case "ActivitiesAndNotes":
			return ["activity", "note"];
		case "All":
			return ["audit", "activity", "note"];
		default:
			return ["audit"];
	}
};

class HttpError extends Error {
	constructor(public status: number, message: string) {
		super(message);
	}
}

async function getJson(url: string): Promise<Record<string, unknown>> {
	const response = await fetch(url, { headers: HEADERS, credentials: "same-origin" });
	if (!response.ok) {
		let message = `${response.status} ${response.statusText}`;
		try {
			const body = (await response.json()) as { error?: { message?: string } };
			if (body.error?.message) message = body.error.message;
		} catch {
			// keep the status line
		}
		throw new HttpError(response.status, message);
	}
	return (await response.json()) as Record<string, unknown>;
}

// Follows @odata.nextLink until MAX_ITEMS_PER_SOURCE rows (queries are ordered newest first, so
// a cut keeps the newest).
async function getAll(url: string): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }> {
	const rows: Record<string, unknown>[] = [];
	let next: string | undefined = url;
	while (next) {
		const page = await getJson(next);
		rows.push(...((page.value as Record<string, unknown>[]) ?? []));
		if (rows.length >= MAX_ITEMS_PER_SOURCE) return { rows: rows.slice(0, MAX_ITEMS_PER_SOURCE), truncated: true };
		next = page["@odata.nextLink"] as string | undefined;
	}
	return { rows, truncated: false };
}

const cleanId = (id: string): string => id.replace(/[{}]/g, "").toLowerCase();
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

// Table/column metadata and the org audit switch are fixed for the life of a page and UCI keeps
// the bundle loaded across record navigations, so they're shared per page session: schema only,
// in memory, 5-minute expiry, failures not cached - the repo-wide convention (main CLAUDE.md,
// "Metadata caching"). Never record data.
const METADATA_TTL_MS = 5 * 60 * 1000;
const metadataCache = new Map<string, { at: number; pending: Promise<unknown> }>();
function cachedMetadata<T>(key: string, load: () => Promise<T>): Promise<T> {
	const hit = metadataCache.get(key);
	if (hit && Date.now() - hit.at < METADATA_TTL_MS) return hit.pending as Promise<T>;
	const pending = load();
	metadataCache.set(key, { at: Date.now(), pending });
	pending.catch(() => metadataCache.delete(key));
	return pending;
}

// Is auditing on for the environment and this table? Either off -> nothing new is recorded.
// Unknown (the metadata call itself failed) counts as on, so we never claim it's off wrongly.
function isAuditEnabled(entityLogicalName: string): Promise<boolean> {
	return cachedMetadata(`audit:${entityLogicalName}`, async () => {
		const [org, entity] = await Promise.all([
			getJson(`${API}/organizations?$select=isauditenabled`).catch(() => undefined),
			getJson(`${API}/EntityDefinitions(LogicalName='${entityLogicalName}')?$select=IsAuditEnabled`).catch(() => undefined),
		]);
		const orgOn = (org?.value as { isauditenabled?: boolean }[] | undefined)?.[0]?.isauditenabled;
		const tableOn = (entity?.IsAuditEnabled as { Value?: boolean } | undefined)?.Value;
		return orgOn !== false && tableOn !== false;
	});
}

export interface IColumnMeta {
	logicalName: string;
	displayName: string;
	attributeType?: string;
	attributeTypeName?: string;
}

// Column number -> column, for the "Changed: ..." line and the expandable change table of an
// audit entry. A number missing from the map is a column that no longer exists on the table.
export function loadColumns(entityLogicalName: string): Promise<Map<number, IColumnMeta>> {
	return cachedMetadata(`columns:${entityLogicalName}`, async () => {
		const body = await getJson(`${API}/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes?$select=LogicalName,ColumnNumber,DisplayName,AttributeType,AttributeTypeName`);
		const map = new Map<number, IColumnMeta>();
		for (const a of (body.value as {
			LogicalName: string;
			ColumnNumber?: number;
			DisplayName?: { UserLocalizedLabel?: { Label?: string } };
			AttributeType?: string;
			AttributeTypeName?: { Value?: string };
		}[]) ?? []) {
			if (typeof a.ColumnNumber !== "number") continue;
			map.set(a.ColumnNumber, {
				logicalName: a.LogicalName,
				displayName: a.DisplayName?.UserLocalizedLabel?.Label || a.LogicalName,
				attributeType: a.AttributeType,
				attributeTypeName: a.AttributeTypeName?.Value,
			});
		}
		return map;
	});
}

// ---------------------------------------------------------------------------------------------
// Field-level change details (the chevron on an audit row)
// ---------------------------------------------------------------------------------------------

// A value as shown in the change table. null = the column was empty (a change from or to
// nothing - "(empty)"); undefined = not known (e.g. the audit detail didn't carry the column).
export type CellValue = string | null | undefined;

export interface IAuditChange {
	previous: CellValue;
	next: CellValue;
}

const LOOKUP_TYPES = new Set(["Lookup", "Customer", "Owner"]);
// Types a record $select can return. Image and File are selectable through their companions
// (keyFor); PartyList, CalendarRules and other Virtual columns are not -> current value n/a.
const SELECTABLE_TYPES = new Set(["String", "Memo", "Integer", "BigInt", "Decimal", "Double", "Money", "Boolean", "DateTime", "Picklist", "State", "Status", "Lookup", "Customer", "Owner", "Uniqueidentifier", "EntityName", "ManagedProperty"]);
const SELECTABLE_TYPE_NAMES = new Set(["MultiSelectPicklistType", "ImageType", "FileType"]);

export const isSelectable = (c: IColumnMeta): boolean => (!!c.attributeType && SELECTABLE_TYPES.has(c.attributeType)) || (!!c.attributeTypeName && SELECTABLE_TYPE_NAMES.has(c.attributeTypeName));

// The property names a column can have in a Web API record, best first: lookups are _x_value;
// for the current record an Image is read through its <col>_url (no picture download) and a
// File through <col>_name (the file name).
function keyFor(c: IColumnMeta, forSelect = false): string[] {
	const n = c.logicalName;
	if (c.attributeType && LOOKUP_TYPES.has(c.attributeType)) return [`_${n}_value`, n];
	if (forSelect && c.attributeTypeName === "ImageType") return [`${n}_url`];
	if (forSelect && c.attributeTypeName === "FileType") return [`${n}_name`];
	return [n, `_${n}_value`];
}

// Minutes to add to UTC for the user's Dataverse time zone; index.ts sets it from
// userSettings.getTimeZoneOffsetMinutes (browser offset until then).
let userTimeZoneOffset: (d: Date) => number = (d) => -d.getTimezoneOffset();
export function setUserTimeZoneOffset(offset: (d: Date) => number): void {
	userTimeZoneOffset = offset;
}

const LOCALE = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
const stripHtml = (text: string): string =>
	/<[a-z][\s\S]*>/i.test(text)
		? text.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, " ").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim()
		: text;

// A raw value as text when Dataverse sent no FormattedValue for it, by column type - so every
// type reads meaningfully even then (an option deleted since the change, an audit detail
// without annotations, a value whose column metadata is gone).
export function formatRaw(raw: unknown, column?: IColumnMeta): string {
	const type = column?.attributeType;
	const typeName = column?.attributeTypeName;
	if (typeName === "ImageType") return "Picture";
	if (typeName === "FileType") return typeof raw === "string" && !/^[0-9a-f-]{36}$/i.test(raw) ? raw : "File";
	if (typeof raw === "boolean") return raw ? "Yes" : "No";
	if (raw && typeof raw === "object") {
		// ManagedProperty ({Value: true}) and any other complex value.
		const value = (raw as { Value?: unknown }).Value;
		if (value !== undefined) return formatRaw(value, column);
		return JSON.stringify(raw);
	}
	if (typeof raw === "number") {
		if (type === "Picklist" || type === "State" || type === "Status") return `Option ${raw}`;
		if (type === "Money") return raw.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		return raw.toLocaleString(LOCALE);
	}
	const text = String(raw);
	if (typeName === "MultiSelectPicklistType" || (type === "Virtual" && /^\d+(,\d+)*$/.test(text))) return text.split(",").map((v) => `Option ${v}`).join("; ");
	if (type === "DateTime" || /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(text)) {
		const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
		const d = new Date(dateOnly ? `${text}T00:00:00Z` : text);
		// Date only: no time zone. Date and time: in the user's Dataverse time zone, like the
		// graph's buckets and the platform's own FormattedValue.
		if (!isNaN(d.getTime())) {
			const shown = dateOnly ? d : new Date(d.getTime() + userTimeZoneOffset(d) * 60000);
			return new Intl.DateTimeFormat(LOCALE, dateOnly ? { dateStyle: "medium", timeZone: "UTC" } : { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(shown);
		}
	}
	if (type === "Boolean") return text === "true" ? "Yes" : text === "false" ? "No" : text;
	if (type && LOOKUP_TYPES.has(type) && /^[0-9a-f-]{36}$/i.test(text)) return `Record ${text.slice(0, 8)}\u2026`;
	return stripHtml(text);
}

// The value of a column in a Web API record, as display text. FormattedValue when present
// (choice labels, lookup names, Yes/No labels, dates/numbers/money in the user's own format),
// else formatRaw. null = empty: a key present with null, or absent from a record that lists the
// changed columns (Dataverse leaves an empty old/new value out) - "(empty)", the null->value and
// value->null changes. undefined = no record to read.
export function readValue(record: Record<string, unknown> | undefined, column: IColumnMeta, forSelect = false): CellValue {
	if (!record) return undefined;
	for (const key of keyFor(column, forSelect)) {
		if (!(key in record)) continue;
		const raw = record[key];
		if (raw === null || raw === undefined || raw === "") return null;
		const formatted = record[`${key}${FORMATTED}`];
		if (typeof formatted === "string" && formatted !== "") return column.attributeType === "Memo" || column.attributeType === "String" ? stripHtml(formatted) : formatted;
		return formatRaw(raw, column);
	}
	return null;
}

// RetrieveAuditDetails (bound function on the audit row) -> AttributeAuditDetail with OldValue and
// NewValue records holding only the changed columns. Needs prvReadRecordAuditHistory.
export async function loadAuditDetail(auditId: string): Promise<{ oldValue?: Record<string, unknown>; newValue?: Record<string, unknown> }> {
	const response = await fetch(`${API}/audits(${cleanId(auditId)})/Microsoft.Dynamics.CRM.RetrieveAuditDetails`, {
		headers: { ...HEADERS, Prefer: 'odata.include-annotations="*"' },
		credentials: "same-origin",
	});
	if (!response.ok) throw new HttpError(response.status, `${response.status} ${response.statusText}`);
	const body = (await response.json()) as { AuditDetail?: { OldValue?: Record<string, unknown>; NewValue?: Record<string, unknown> } };
	return { oldValue: body.AuditDetail?.OldValue ?? undefined, newValue: body.AuditDetail?.NewValue ?? undefined };
}

// The record's saved values of the given (still existing) columns, keyed by logical name.
// Columns that can't be $selected are left out - shown as n/a.
export async function loadCurrentValues(webAPI: ComponentFramework.WebApi, entityLogicalName: string, recordId: string, columns: IColumnMeta[]): Promise<Map<string, CellValue>> {
	const selectable = columns.filter(isSelectable);
	const result = new Map<string, CellValue>();
	if (selectable.length === 0) return result;
	const select = Array.from(new Set(selectable.map((c) => keyFor(c, true)[0]))).join(",");
	const record = (await webAPI.retrieveRecord(entityLogicalName, cleanId(recordId), `?$select=${select}`)) as Record<string, unknown>;
	for (const c of selectable) {
		const value = readValue(record, c, true);
		// A current Image/File is shown by presence; its companion carries no meaningful label.
		result.set(c.logicalName, c.attributeTypeName === "ImageType" && value ? "Picture" : value);
	}
	return result;
}

// attributemask is ",12,45,7," - the column numbers an update touched.
export const parseAttributeMask = (mask: unknown): number[] =>
	typeof mask === "string" ? mask.split(",").map((s) => parseInt(s, 10)).filter((n) => !isNaN(n)) : [];

async function loadAudit(recordId: string, sinceIso: string): Promise<{ items: IHistoryItem[]; truncated: boolean }> {
	// operation 4 is "Access" (read auditing) - not a modification.
	const filter = `_objectid_value eq ${recordId} and operation ne 4 and createdon ge ${sinceIso}`;
	const { rows, truncated } = await getAll(`${API}/audits?$select=auditid,createdon,operation,action,attributemask,_userid_value&$filter=${encodeURIComponent(filter)}&$orderby=createdon desc`);
	const items = rows.map((r): IHistoryItem => ({
		id: r.auditid as string,
		kind: "audit",
		when: new Date(r.createdon as string),
		title: str(r[`action${FORMATTED}`]) ?? str(r[`operation${FORMATTED}`]) ?? "Change",
		by: str(r[`_userid_value${FORMATTED}`]),
		operation: r.operation as number,
		columnNumbers: parseAttributeMask(r.attributemask),
	}));
	return { items, truncated };
}

async function loadActivities(recordId: string, sinceIso: string, activityDate: ActivityDate): Promise<{ items: IHistoryItem[]; truncated: boolean }> {
	// An activity created long ago but completed in range still counts for "Completed on".
	const dateFilter = activityDate === "CompletedOn" ? `(createdon ge ${sinceIso} or actualend ge ${sinceIso})` : `createdon ge ${sinceIso}`;
	const filter = `_regardingobjectid_value eq ${recordId} and ${dateFilter}`;
	const { rows, truncated } = await getAll(`${API}/activitypointers?$select=activityid,activitytypecode,subject,createdon,actualend,statecode,_createdby_value&$filter=${encodeURIComponent(filter)}&$orderby=createdon desc`);
	const items = rows.map((r): IHistoryItem => {
		// statecode 1 = Completed. actualend on an open activity is a planned end, not a fact.
		const completed = r.statecode === 1 && str(r.actualend);
		const when = activityDate === "CompletedOn" && completed ? (r.actualend as string) : (r.createdon as string);
		return {
			id: r.activityid as string,
			kind: "activity",
			when: new Date(when),
			title: str(r.subject) ?? str(r[`activitytypecode${FORMATTED}`]) ?? "Activity",
			by: str(r[`_createdby_value${FORMATTED}`]),
			activityType: r.activitytypecode as string,
		};
	});
	return { items, truncated };
}

async function loadNotes(recordId: string, sinceIso: string): Promise<{ items: IHistoryItem[]; truncated: boolean }> {
	const filter = `_objectid_value eq ${recordId} and createdon ge ${sinceIso}`;
	const { rows, truncated } = await getAll(`${API}/annotations?$select=annotationid,subject,notetext,createdon,_createdby_value&$filter=${encodeURIComponent(filter)}&$orderby=createdon desc`);
	const items = rows.map((r): IHistoryItem => ({
		id: r.annotationid as string,
		kind: "note",
		when: new Date(r.createdon as string),
		title: str(r.subject) ?? "Note",
		by: str(r[`_createdby_value${FORMATTED}`]),
		snippet: str(r.notetext)?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
	}));
	return { items, truncated };
}

const problemFor = (kind: ItemKind, e: unknown): ISourceProblem => ({
	kind,
	reason: e instanceof HttpError && e.status === 403 ? "denied" : "error",
	message: e instanceof Error ? e.message : String(e),
});

// Each source loads independently: one failing (e.g. no audit privilege) doesn't hide the others.
export async function loadHistory(entityLogicalName: string, recordIdRaw: string, kinds: ItemKind[], sinceUtc: Date, activityDate: ActivityDate): Promise<ILoadResult> {
	const recordId = cleanId(recordIdRaw);
	const sinceIso = sinceUtc.toISOString();
	const problems: ISourceProblem[] = [];
	let truncated = false;
	const loaders: Promise<IHistoryItem[]>[] = kinds.map(async (kind) => {
		try {
			const result =
				kind === "audit" ? await loadAudit(recordId, sinceIso) : kind === "activity" ? await loadActivities(recordId, sinceIso, activityDate) : await loadNotes(recordId, sinceIso);
			truncated = truncated || result.truncated;
			return result.items;
		} catch (e) {
			problems.push(problemFor(kind, e));
			return [];
		}
	});
	if (kinds.includes("audit")) {
		loaders.push(
			isAuditEnabled(entityLogicalName).then((on) => {
				if (!on) problems.push({ kind: "audit", reason: "disabled" });
				return [];
			}, () => [])
		);
	}
	const items = (await Promise.all(loaders)).flat();
	return { items, problems, truncated };
}
