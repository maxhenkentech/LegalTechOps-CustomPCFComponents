// ---------------------------------------------------------------------------------------------
// Harness fixtures. The harness has no record, Web API or audit log, so test mode generates a
// deterministic history instead: the same calendar day always gets the same items (seeded by
// the day number), so reloads and screenshots are stable while "today" moves on.
//
// What each part exercises:
//  - weekday/weekend rates, two busy bursts and a quiet month -> all five color levels and
//    long empty runs (level 0), in Day, Week, Month and Year
//  - record created TEST_RECORD_AGE_DAYS ago -> automatic Years To Show (3 years for Week/Month/
//    Year), and no history before that date
//  - audit: one Create on the creation day, Updates with 1-3 changed columns (named through
//    TEST_COLUMNS - one column per Dataverse type, 99 deliberately unknown -> shown by number,
//    current n/a), Assign, Share. Expanding a row: testAuditChanges (from/to empty included) +
//    testCurrentValues, both read through the real readValue/formatRaw
//  - activities: every icon path (email, phonecall, task, appointment, a custom type), some
//    completed later than created (Activity Date = Completed on moves them)
//  - notes: with and without a subject, a long text (snippet truncation)
//
// URL switches (test mode only):
//  ?audit=off   audit source reports "auditing is turned off" (graph still drawn from old data)
//  ?denied      audit source fails with 403 (privilege message)
//  ?error       activity source fails with a generic error
//  ?empty       no history at all (empty graph, "No changes ..." summary)
//  ?unsaved     no record id (create form) -> "appears once the record is saved"
//  ?slow        2 s load delay (loading state)
//  ?readonly    accepted for the family's harness conventions; the control is display-only anyway
// ---------------------------------------------------------------------------------------------

import { CellValue, IAuditChange, IColumnMeta, IHistoryItem, ItemKind, isSelectable, readValue } from "./ActivityData";

export const TEST_ENTITY_LOGICAL_NAME = "hek_ltc_matter";
export const TEST_RECORD_ID = "00000000-0000-0000-0000-00000000a771";
export const TEST_RECORD_AGE_DAYS = 2 * 365 + 140;

const USERS = ["Maximilian Henkensiefken", "Aisha Patel", "Jonas Weber", "Chloé Martin", "Sam Okafor"];
const ACTIVITY_TYPES: { type: string; titles: string[] }[] = [
	{ type: "email", titles: ["Re: Draft amendment", "Signed NDA attached", "Question on clause 7.2", "Kick-off follow-up"] },
	{ type: "phonecall", titles: ["Call with counterparty counsel", "Budget check-in", "Escalation call"] },
	{ type: "task", titles: ["Review redline", "Update risk register", "Prepare board memo"] },
	{ type: "appointment", titles: ["Negotiation meeting", "Matter review", "Signing session"] },
	{ type: "hek_courtfiling", titles: ["Court filing"] },
];
const NOTE_TEXTS = [
	{ subject: "Call notes", text: "Counterparty accepts the liability cap but wants a carve-out for data protection breaches. Need to check with the client before Friday." },
	{ subject: "", text: "Client confirmed budget increase." },
	{ subject: "Internal", text: "Precedent from the 2023 matter applies - see the shared folder. ".repeat(6) },
];

// mulberry32 - tiny deterministic PRNG.
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const DAY_MS = 24 * 60 * 60 * 1000;
const KIND_SEED: Record<ItemKind, number> = { audit: 17, activity: 4099, note: 90001 };
const pick = <T>(r: () => number, list: T[]): T => list[Math.floor(r() * list.length)];

// Items per day: weekdays busier than weekends; days 40-50 and 200-215 ago are bursts; days
// 95-125 ago a quiet month (holiday). Rates per kind so "Everything" is visibly the sum.
function countFor(kind: ItemKind, daysAgo: number, weekday: number, r: () => number): number {
	const base = kind === "audit" ? 1.4 : kind === "activity" ? 0.55 : 0.18;
	let rate = weekday === 0 || weekday === 6 ? base * 0.08 : base;
	if ((daysAgo >= 40 && daysAgo <= 50) || (daysAgo >= 200 && daysAgo <= 215)) rate *= 4;
	if (daysAgo >= 95 && daysAgo <= 125) rate *= 0.05;
	// Busier in the most recent year, so the Year view isn't flat.
	if (daysAgo > 365) rate *= 0.6;
	let n = 0;
	// Poisson by inversion.
	let p = Math.exp(-rate);
	let s = p;
	const u = r();
	while (u > s && n < 30) {
		n++;
		p *= rate / n;
		s += p;
	}
	return n;
}

// Column numbers as in attributemask, one per Dataverse column type, so expanding audit rows
// in the harness exercises every formatting path. 99 is deliberately missing (a column deleted
// since the change -> "Column 99", current n/a); 21 is a PartyList (can't be $selected ->
// current n/a).
const F = "@OData.Community.Display.V1.FormattedValue";
type TestValue = { raw: unknown; formatted?: string } | null;
const v = (raw: unknown, formatted?: string): TestValue => ({ raw, formatted });
const COLUMN_SPECS: [number, string, string, string, string | undefined, TestValue[]][] = [
	[1, "hek_name", "Name", "String", undefined, [v("Acme v. Globex"), v("Acme v. Globex Corp."), v("Project Falcon NDA")]],
	[2, "hek_status", "Status", "Picklist", undefined, [v(1, "Open"), v(2, "In Review"), v(3, "On Hold"), v(4, "Escalated"), v(5, "Closed")]],
	// No FormattedValue: an option deleted since the change -> "Option 100000009".
	[3, "hek_practicearea", "Practice Area", "Picklist", undefined, [v(100000001, "Corporate"), v(100000002, "Litigation"), v(100000009), null]],
	[4, "ownerid", "Owner", "Owner", undefined, [v("6e1f0c3a-0001-4000-8000-000000000001", "Maximilian Henkensiefken"), v("6e1f0c3a-0002-4000-8000-000000000002", "Aisha Patel")]],
	// Date-only without FormattedValue -> Intl medium date, no time.
	[5, "hek_duedate", "Due Date", "DateTime", undefined, [v("2026-11-30"), v("2026-12-15", "15/12/2026"), null]],
	[6, "hek_budget", "Budget", "Money", undefined, [v(25000, "€25,000.00"), v(40000), v(55500.5, "€55,500.50"), null]],
	// Rich text (HTML) -> tags stripped.
	[7, "hek_description", "Description", "Memo", undefined, [v("<p>Initial assessment of the <strong>counterparty claims</strong> and exposure.</p>"), v("Scope extended to cover the data protection carve-out and the amended liability cap in clause 7.2."), null]],
	[8, "hek_riskrating", "Risk Rating", "Picklist", undefined, [v(1, "Low"), v(2, "Medium"), v(3, "High"), null]],
	// Lookup without FormattedValue -> "Record 1a2b3c4d...".
	[9, "hek_responsiblelawyer", "Responsible Lawyer", "Lookup", undefined, [v("1a2b3c4d-0000-4000-8000-00000000000a", "Chloé Martin"), v("5e6f7a8b-0000-4000-8000-00000000000b"), null]],
	[10, "hek_contractfile", "Contract File", "Virtual", "FileType", [v("MSA-signed.pdf"), v("9d8c7b6a-0000-4000-8000-00000000000c"), null]],
	[11, "hek_confidential", "Confidential", "Boolean", undefined, [v(true, "Confidential"), v(false), null]],
	[12, "hek_tags", "Tags", "Virtual", "MultiSelectPicklistType", [v("1,3", "Contract; Urgent"), v("2,4"), null]],
	[13, "hek_logo", "Logo", "Virtual", "ImageType", [v("0f0e0d0c-0000-4000-8000-00000000000d"), null]],
	[14, "hek_hoursspent", "Hours Spent", "Integer", undefined, [v(12), v(1250, "1,250"), v(0)]],
	[15, "hek_externalid", "External ID", "Uniqueidentifier", undefined, [v("c0ffee00-1234-4abc-8def-000000000042"), null]],
	// DateTime with time, no FormattedValue -> Intl medium date + short time.
	[16, "hek_lastcontact", "Last Contact", "DateTime", undefined, [v("2026-09-14T13:45:00Z"), v("2026-10-01T08:05:00Z", "01/10/2026 10:05"), null]],
	[17, "hek_winprobability", "Win Probability", "Decimal", undefined, [v(0.35), v(0.8, "0.80"), null]],
	[18, "hek_ismanaged", "Customizable", "ManagedProperty", undefined, [v({ Value: true }), v({ Value: false })]],
	[21, "hek_attendees", "Attendees", "PartyList", undefined, [v("Aisha Patel; Jonas Weber"), null]],
];

export const TEST_COLUMNS = new Map<number, IColumnMeta>(COLUMN_SPECS.map(([n, logicalName, displayName, attributeType, attributeTypeName]) => [n, { logicalName, displayName, attributeType, attributeTypeName }]));
export const TEST_COLUMN_NUMBERS = [...COLUMN_SPECS.map(([n]) => n), 99];
const VALUE_POOLS = new Map(COLUMN_SPECS.map(([, logicalName, , , , pool]) => [logicalName, pool]));

// The property names readValue looks for: lookups _x_value; for the current record Image <col>_url
// and File <col>_name.
function putValue(record: Record<string, unknown>, c: IColumnMeta, value: TestValue, current: boolean): void {
	if (value === null) return; // empty columns are left out, as Dataverse does in audit details
	const lookup = c.attributeType === "Lookup" || c.attributeType === "Owner" || c.attributeType === "Customer";
	let key = lookup ? `_${c.logicalName}_value` : c.logicalName;
	let raw = value.raw;
	if (current && c.attributeTypeName === "ImageType") {
		key = `${c.logicalName}_url`;
		raw = `/Image/download.aspx?Entity=hek_ltc_matter&Attribute=${c.logicalName}`;
	}
	if (current && c.attributeTypeName === "FileType") key = `${c.logicalName}_name`;
	record[key] = raw;
	if (value.formatted !== undefined) record[`${key}${F}`] = value.formatted;
}

// The record as it is "now" in the harness: each column's 2nd pool value (empty where that's
// null), so the Current column differs from some audit rows' new values.
export function testCurrentValues(columns: IColumnMeta[]): Map<string, CellValue> {
	const record: Record<string, unknown> = {};
	const selectable = columns.filter(isSelectable);
	for (const c of selectable) putValue(record, c, (VALUE_POOLS.get(c.logicalName) ?? [null])[1] ?? null, true);
	return new Map(selectable.map((c) => [c.logicalName, c.attributeTypeName === "ImageType" && readValue(record, c, true) ? "Picture" : readValue(record, c, true)]));
}

function hashString(text: string): number {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
	return h >>> 0;
}

// Deterministic per audit row and column, built as Web API OldValue/NewValue records and read
// back through the real readValue - the same code path as a live RetrieveAuditDetails.
export function testAuditChanges(item: IHistoryItem): Map<number, IAuditChange> {
	const changes = new Map<number, IAuditChange>();
	const oldValue: Record<string, unknown> = {};
	const newValue: Record<string, unknown> = {};
	for (const n of item.columnNumbers ?? []) {
		const column = TEST_COLUMNS.get(n);
		if (!column) continue;
		const pool = VALUE_POOLS.get(column.logicalName) ?? [null];
		const r = rng(hashString(`${item.id}:${n}`));
		const a = Math.floor(r() * pool.length);
		let b = Math.floor(r() * pool.length);
		if (b === a) b = (a + 1) % pool.length;
		putValue(oldValue, column, pool[a], false);
		putValue(newValue, column, pool[b], false);
	}
	for (const n of item.columnNumbers ?? []) {
		const column = TEST_COLUMNS.get(n);
		changes.set(n, column ? { previous: item.operation === 1 ? undefined : readValue(oldValue, column), next: readValue(newValue, column) } : { previous: undefined, next: undefined });
	}
	return changes;
}

export function generateTestHistory(kinds: ItemKind[], now: Date): IHistoryItem[] {
	const items: IHistoryItem[] = [];
	const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	const dayNumberToday = Math.floor(todayStart / DAY_MS);
	for (const kind of kinds) {
		for (let daysAgo = TEST_RECORD_AGE_DAYS; daysAgo >= 0; daysAgo--) {
			const dayNumber = dayNumberToday - daysAgo;
			const r = rng(dayNumber * 31 + KIND_SEED[kind]);
			const dayStart = dayNumber * DAY_MS;
			const weekday = new Date(dayStart).getUTCDay();
			let n = countFor(kind, daysAgo, weekday, r);
			if (kind === "audit" && daysAgo === TEST_RECORD_AGE_DAYS) n = Math.max(n, 1);
			for (let i = 0; i < n; i++) {
				// 08:00-18:00 UTC, but never in the future.
				const when = new Date(Math.min(dayStart + (8 + r() * 10) * 3600 * 1000, now.getTime() - (i + 1) * 60000));
				const by = pick(r, USERS);
				const id = `${kind}-${dayNumber}-${i}`;
				if (kind === "audit") {
					const isCreate = daysAgo === TEST_RECORD_AGE_DAYS && i === 0;
					const roll = r();
					const action = isCreate ? "Create" : roll < 0.06 ? "Assign" : roll < 0.09 ? "Share" : "Update";
					const columnNumbers = action === "Update" ? Array.from({ length: 1 + Math.floor(r() * 4) }, () => TEST_COLUMN_NUMBERS[Math.floor(r() * TEST_COLUMN_NUMBERS.length)]) : [];
					items.push({ id, kind, when, title: action, by, operation: isCreate ? 1 : 2, columnNumbers: Array.from(new Set(columnNumbers)) });
				} else if (kind === "activity") {
					const t = pick(r, ACTIVITY_TYPES);
					items.push({ id, kind, when, title: pick(r, t.titles), by, activityType: t.type, completedAfterDays: r() < 0.4 ? 1 + Math.floor(r() * 20) : undefined } as IHistoryItem);
				} else {
					const note = pick(r, NOTE_TEXTS);
					items.push({ id, kind, when, title: note.subject || "Note", by, snippet: note.text.slice(0, 200) });
				}
			}
		}
	}
	return items;
}

// Activity Date = Completed on, harness version: completed activities move later by their
// completedAfterDays (capped at now); open ones stay on their created date.
export function applyTestActivityDate(items: IHistoryItem[], completedOn: boolean, now: Date): IHistoryItem[] {
	if (!completedOn) return items;
	return items.map((item) => {
		const after = (item as IHistoryItem & { completedAfterDays?: number }).completedAfterDays;
		if (item.kind !== "activity" || !after) return item;
		return { ...item, when: new Date(Math.min(item.when.getTime() + after * DAY_MS, now.getTime())) };
	});
}
