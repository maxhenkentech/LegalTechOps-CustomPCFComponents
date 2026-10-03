import * as React from "react";
import { Icon } from "@fluentui/react/lib/Icon";
import { Tooltip } from "@fluentui/react/lib/Tooltip";
import { Callout, DirectionalHint } from "@fluentui/react/lib/Callout";
import { Aggregation, IBlock, ICell, ILocaleNames, MAX_AUTO_YEARS, buildLayout, bucketKey, levelFor, toUserTime } from "./Calendar";
import { ActivityDate, CellValue, IAuditChange, IColumnMeta, IHistoryItem, ILoadResult, ISourceProblem, ItemKind, Source, loadAuditDetail, loadColumns, loadCurrentValues, loadHistory, readValue, sourceKinds } from "./ActivityData";
import { TEST_COLUMNS, TEST_RECORD_AGE_DAYS, testCurrentValues, applyTestActivityDate, generateTestHistory, testAuditChanges } from "./TestModeData";

export interface IActivityGraphProps {
	source: Source;
	activityDate: ActivityDate;
	aggregation: Aggregation;
	yearsToShow: number;
	firstDayOfWeek: number;
	showDetails: boolean;
	showSummary: boolean;
	showLegend: boolean;
	cellShape: string;
	colorScheme: string;
	customColor?: string;
	entityTypeName?: string;
	entityId?: string;
	webAPI: ComponentFramework.WebApi;
	navigation: ComponentFramework.Navigation;
	// Minutes to add to a UTC instant to get the user's wall-clock time (Dataverse personal
	// settings time zone, not the browser's).
	timeZoneOffset: (d: Date) => number;
	isTestMode: boolean;
	// The theme font stack (ThemeFont.tsx). The details Callout renders in a Layer under <body>,
	// outside the control's DOM, so its non-Fluent content needs the font inline.
	fontFamily: string;
}

// ---------------------------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------------------------

// GitHub's light contribution scale (Primer --contribution-default-bgColor-0..4), and the 5%
// outline its squares carry so level 0 still reads as a square on white.
const GITHUB_GREENS = ["#eff2f5", "#aceebb", "#4ac26b", "#2da44e", "#116329"];
const CELL_OUTLINE = "rgba(31, 35, 40, 0.05)";
// The family blue (main CLAUDE.md "Blue series": #EDF3FB backdrop, #255BA4 label).
const FAMILY_BLUE = "#255BA4";

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
function parseHex(value: string | undefined): [number, number, number] | undefined {
	const m = value?.trim().match(HEX);
	if (!m) return undefined;
	const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
	return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const toHex = (rgb: number[]): string => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

// Levels 1-4 as white blended toward the base color - level 4 is exactly the base (the
// configured hex, never an approximation). Level 0 stays GitHub's grey for every scheme.
function scaleFrom(base: [number, number, number]): string[] {
	return [GITHUB_GREENS[0], ...[0.3, 0.55, 0.8, 1].map((t) => toHex(base.map((c) => 255 + (c - 255) * t)))];
}

// Color Scheme -> a base color (levels 1-4 blended from white, scaleFrom) or a full 5-step
// multi-hue scale. Single-hue bases are GitHub Primer colors where Primer has one (purple
// "done", orange "severe", red "danger", pink "sponsors", gray "neutral"); Halloween is the
// scale GitHub itself showed on 31 October; Heat and Ocean are ColorBrewer YlOrRd / YlGnBu.
const LEVEL0 = GITHUB_GREENS[0];
const SCHEMES: Record<string, string | string[]> = {
	Green: GITHUB_GREENS,
	Blue: FAMILY_BLUE,
	Purple: "#8250DF",
	Orange: "#BC4C00",
	Red: "#CF222E",
	Pink: "#BF3989",
	Teal: "#1B7C83",
	Gray: "#424A53",
	Halloween: [LEVEL0, "#FFEE4A", "#FFC501", "#FE9600", "#03001C"],
	Heat: [LEVEL0, "#FED976", "#FD8D3C", "#E31A1C", "#800026"],
	Ocean: [LEVEL0, "#C7E9B4", "#41B6C4", "#225EA8", "#081D58"],
};

export function resolvePalette(colorScheme: string, customColor: string | undefined): string[] {
	if (colorScheme === "Custom") {
		const base = parseHex(customColor);
		// No/invalid hex (the harness pre-fills "val") -> GitHub green, so the graph still reads.
		return base ? scaleFrom(base) : GITHUB_GREENS;
	}
	const scheme = SCHEMES[colorScheme] ?? GITHUB_GREENS;
	return Array.isArray(scheme) ? scheme : scaleFrom(parseHex(scheme)!);
}

// ---------------------------------------------------------------------------------------------
// Words and dates
// ---------------------------------------------------------------------------------------------

function nounFor(source: Source, count: number): string {
	const one = count === 1;
	switch (source) {
		case "Activities":
			return one ? "activity" : "activities";
		case "Notes":
			return one ? "note" : "notes";
		case "ActivitiesAndNotes":
			return one ? "activity or note" : "activities and notes";
		case "All":
			return one ? "event" : "events";
		default:
			return one ? "change" : "changes";
	}
}

const LOCALE = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
// Wall-clock dates live in the UTC fields (Calendar.ts), so every formatter pins timeZone UTC.
const fmt = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" });
const FMT_DAY = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const FMT_DATE = fmt({ day: "numeric", month: "short", year: "numeric" });
const FMT_MONTH = fmt({ month: "long", year: "numeric" });
const FMT_TIME = fmt({ hour: "2-digit", minute: "2-digit" });
const FMT_DATE_TIME = fmt({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const LOCALE_NAMES: ILocaleNames = {
	months: Array.from({ length: 12 }, (_, m) => fmt({ month: "short" }).format(new Date(Date.UTC(2024, m, 1)))),
	// 7 Jan 2024 was a Sunday.
	weekdays: Array.from({ length: 7 }, (_, d) => fmt({ weekday: "short" }).format(new Date(Date.UTC(2024, 0, 7 + d)))),
};

function periodPhrase(cell: ICell, aggregation: Aggregation): string {
	switch (aggregation) {
		case "Week":
			return `in the week of ${FMT_DATE.format(cell.start)}`;
		case "Month":
			return `in ${FMT_MONTH.format(cell.start)}`;
		case "Year":
			return `in ${cell.start.getUTCFullYear()}`;
		default:
			return `on ${FMT_DAY.format(cell.start)}`;
	}
}

function countPhrase(count: number, source: Source): string {
	return count === 0 ? `No ${nounFor(source, 2)}` : `${count.toLocaleString(LOCALE)} ${nounFor(source, count)}`;
}

// ---------------------------------------------------------------------------------------------
// Icons for the details list (all registered MDL2 names - checked against FLUENT_ICONS.md)
// ---------------------------------------------------------------------------------------------

const ACTIVITY_ICONS: Record<string, string> = {
	email: "Mail",
	phonecall: "Phone",
	task: "TaskLogo",
	appointment: "Calendar",
	recurringappointmentmaster: "Calendar",
	letter: "Mail",
	fax: "Fax",
};

function iconFor(item: IHistoryItem): string {
	if (item.kind === "note") return "QuickNote";
	if (item.kind === "activity") return ACTIVITY_ICONS[item.activityType ?? ""] ?? "Event";
	if (item.operation === 1) return "Add";
	if (item.operation === 3) return "Delete";
	return "Edit";
}

// ---------------------------------------------------------------------------------------------
// Sizing: squares grow to fill the width (up to a per-aggregation cap, so a 12-column month grid
// doesn't become huge) and shrink down to MIN_CELL, below which the graph scrolls horizontally,
// newest end in view - as GitHub's graph does on a narrow screen.
// ---------------------------------------------------------------------------------------------

const MIN_CELL = 8;
const MAX_CELL: Record<Aggregation, number> = { Day: 15, Week: 15, Month: 36, Year: 48 };
const ROW_LABEL_WIDTH: Record<Aggregation, number> = { Day: 30, Week: 38, Month: 38, Year: 0 };
const HEADER_HEIGHT = 18;

function sizeFor(width: number, aggregation: Aggregation, cols: number): { size: number; gap: number } {
	const avail = width - ROW_LABEL_WIDTH[aggregation];
	for (const gap of [aggregation === "Month" || aggregation === "Year" ? 4 : 3, 2]) {
		const size = Math.floor((avail - gap * (cols - 1)) / cols);
		if (size >= 10 || gap === 2) return { size: Math.max(MIN_CELL, Math.min(MAX_CELL[aggregation], size)), gap };
	}
	return { size: MIN_CELL, gap: 2 };
}

// The narrowest field that shows every column of the aggregation at MIN_CELL with the smallest
// gap - below it the graph has to scroll. Used for the form designer warning.
function minWidthFor(aggregation: Aggregation, cols: number): number {
	return ROW_LABEL_WIDTH[aggregation] + cols * MIN_CELL + (cols - 1) * 2;
}

// The modern form designer previews the form in an iframe on the org's own host - measured
// 2026-10-03: https://<org>.crm4.dynamics.com/uclient/main.htm?cmdbar=false&channelId=...
// &flags=DisableFormHandlers - while a live form is /main.aspx. A new record on a live form also
// has no id, so the page decides, not the missing id. (The harness simulates it with ?designer.)
function isFormDesignerHost(): boolean {
	try {
		const { pathname, search } = window.location;
		return /\/uclient\/main\.htm$/i.test(pathname) || /flags=DisableFormHandlers/i.test(search);
	} catch {
		return false;
	}
}

function radiusFor(shape: string, size: number): string {
	if (shape === "Square") return "0";
	if (shape === "Round") return "50%";
	// GitHub: 2px on its 10px squares.
	return `${Math.max(2, Math.round(size * 0.2))}px`;
}

// ---------------------------------------------------------------------------------------------
// Test mode (harness) switches - see TestModeData.ts's header.
// ---------------------------------------------------------------------------------------------

function testSwitch(name: string): string | null {
	try {
		return new URLSearchParams(window.location.search).get(name);
	} catch {
		return null;
	}
}

async function loadTestHistory(kinds: ItemKind[], activityDate: ActivityDate, now: Date): Promise<ILoadResult> {
	if (testSwitch("slow") !== null) await new Promise((resolve) => setTimeout(resolve, 2000));
	const problems: ISourceProblem[] = [];
	let useKinds = kinds;
	if (testSwitch("empty") !== null) useKinds = [];
	if (kinds.includes("audit") && testSwitch("denied") !== null) {
		problems.push({ kind: "audit", reason: "denied", message: "Principal user is missing prvReadAuditSummary privilege" });
		useKinds = useKinds.filter((k) => k !== "audit");
	}
	if (kinds.includes("activity") && testSwitch("error") !== null) {
		problems.push({ kind: "activity", reason: "error", message: "Test error: the activity query failed" });
		useKinds = useKinds.filter((k) => k !== "activity");
	}
	if (kinds.includes("audit") && testSwitch("audit") === "off") problems.push({ kind: "audit", reason: "disabled" });
	const items = applyTestActivityDate(generateTestHistory(useKinds, now), activityDate === "CompletedOn", now);
	return { items, problems, truncated: false };
}

const KIND_LABEL: Record<ItemKind, string> = { audit: "the audit history", activity: "related activities", note: "notes" };

function problemText(p: ISourceProblem): string {
	if (p.reason === "disabled") return "Auditing is turned off for this table or environment, so new changes are not recorded. Ask your administrator to turn on auditing.";
	if (p.reason === "denied") return `You don't have permission to view ${KIND_LABEL[p.kind]} of this record.`;
	return `Could not load ${KIND_LABEL[p.kind]}${p.message ? `: ${p.message}` : "."}`;
}

// ---------------------------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------------------------

const DETAILS_PAGE = 50;

// Money: RetrieveAuditDetails doesn't always send a FormattedValue for a money column, so one row
// could read "25,000.00 | EUR40,000.00" (measured on the test record). When any of the row's
// values carries the currency (symbol before or after the number), the bare numbers get the same
// prefix and suffix.
const MONEY = /^(\D*?)\s*([-+]?[\d.,\u00a0\u202f\u2019' ]*\d)\s*(\D*)$/;
function harmonizeMoney(values: CellValue[]): CellValue[] {
	const template = values.map((v) => (typeof v === "string" ? v.match(MONEY) : null)).find((m) => m && (m[1].trim() || m[3].trim()));
	if (!template) return values;
	const [, prefix, , suffix] = template;
	const spaced = (affix: string, before: boolean): string => {
		const original = template[0];
		const gap = before ? original.slice(prefix.length).match(/^\s*/)?.[0] ?? "" : original.slice(0, original.length - suffix.length).match(/\s*$/)?.[0] ?? "";
		return before ? `${affix}${gap}` : `${gap}${affix}`;
	};
	return values.map((v) => {
		if (typeof v !== "string") return v;
		const m = v.match(MONEY);
		if (!m || m[1].trim() || m[3].trim()) return v;
		return `${prefix ? spaced(prefix, true) : ""}${m[2]}${suffix ? spaced(suffix, false) : ""}`;
	});
}

// One cell of the change table. undefined -> "-" (not applicable: no previous value on a create,
// or the audit detail didn't carry it); null -> "(empty)" (set from or to nothing).
function ValueCell(props: { value: CellValue; muted?: boolean; title?: string }): React.ReactElement {
	const { value } = props;
	if (value === undefined) return <td className="lops-ag-value lops-ag-value-none" title={props.title}>{"\u2013"}</td>;
	if (value === null) return <td className="lops-ag-value lops-ag-value-empty" title={props.title}>(empty)</td>;
	return (
		<td className={`lops-ag-value${props.muted ? " lops-ag-value-same" : ""}`} title={props.title ?? value}>
			{/* Long values (descriptions, rich text) stop at 3 lines; the full value is the tooltip. */}
			<span className="lops-ag-value-text">{value}</span>
		</td>
	);
}

interface IPlacedCell extends ICell {
	blockId: string;
	id: string;
}

export const ActivityGraphControl: React.FC<IActivityGraphProps> = (props) => {
	const { source, activityDate, aggregation, yearsToShow, firstDayOfWeek, entityTypeName, isTestMode } = props;
	const entityId = isTestMode ? (testSwitch("unsaved") !== null || testSwitch("designer") !== null ? undefined : "test") : props.entityId;

	const [width, setWidth] = React.useState(0);
	const [loading, setLoading] = React.useState(true);
	const [result, setResult] = React.useState<ILoadResult | undefined>(undefined);
	const [createdOn, setCreatedOn] = React.useState<Date | undefined>(undefined);
	const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined);
	const [focusId, setFocusId] = React.useState<string | undefined>(undefined);
	const [hover, setHover] = React.useState<{ el: HTMLElement; id: string } | undefined>(undefined);
	const [detailsLimit, setDetailsLimit] = React.useState(DETAILS_PAGE);
	const [columns, setColumns] = React.useState<Map<number, IColumnMeta> | undefined>(undefined);
	// Field-level change tables (the chevron on an audit row), per audit id.
	const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
	const [auditChanges, setAuditChanges] = React.useState<Map<string, { changes?: Map<number, IAuditChange>; error?: string }>>(new Map());
	// The record's saved values of changed columns (logical name -> value), fetched once per
	// load for every column any expanded row needs. "loaded" lists what was asked, so a column
	// asked for but missing from the map is one that can't be selected -> n/a.
	const [current, setCurrent] = React.useState<{ values: Map<string, CellValue>; loaded: Set<string>; error?: string }>({ values: new Map(), loaded: new Set() });

	const rootRef = React.useRef<HTMLDivElement>(null);
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const detailsRef = React.useRef<HTMLDivElement>(null);
	const cellRefs = React.useRef(new Map<string, HTMLDivElement>());

	const offset = props.timeZoneOffset;
	const today = toUserTime(new Date(), offset);
	const todayKey = `${today.getUTCFullYear()}-${today.getUTCMonth()}-${today.getUTCDate()}`;
	const kinds = React.useMemo(() => sourceKinds(source), [source]);
	const needsCreatedOn = yearsToShow <= 0 && aggregation !== "Day";

	// Width: the squares are sized to the field.
	React.useEffect(() => {
		const el = rootRef.current;
		if (!el) return undefined;
		setWidth(el.clientWidth);
		const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)));
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const layout = React.useMemo(
		() => buildLayout(aggregation, yearsToShow, today, createdOn, firstDayOfWeek, LOCALE_NAMES),
		// todayKey, not today: rebuild when the date changes, not on every render.
		[aggregation, yearsToShow, todayKey, createdOn, firstDayOfWeek]
	);

	// Load: the record's created on (only for automatic Week/Month/Year), then every source from
	// the start of the drawn range.
	React.useEffect(() => {
		let cancelled = false;
		async function load(): Promise<void> {
			setLoading(true);
			if (!entityId) {
				setResult({ items: [], problems: [], truncated: false });
				setLoading(false);
				return;
			}
			let created: Date | undefined;
			if (isTestMode) {
				created = new Date(Date.now() - TEST_RECORD_AGE_DAYS * 24 * 3600 * 1000);
			} else if (needsCreatedOn && entityTypeName) {
				try {
					const record = await props.webAPI.retrieveRecord(entityTypeName, entityId, "?$select=createdon");
					if (record.createdon) created = new Date(record.createdon as string);
				} catch {
					// Unknown -> resolveYears falls back to 1 year.
				}
			}
			let createdWall = created ? toUserTime(created, offset) : undefined;
			// Automatic Week/Month/Year: load the longest automatic span, then start the graph at
			// the earlier of created on and the oldest item - history can predate the record
			// (migrated or backdated activities; measured on the test record: created today,
			// activities from 2024, and the graph showed only this year).
			const nowWall = toUserTime(new Date(), offset);
			const loadFrom = needsCreatedOn ? new Date(Date.UTC(nowWall.getUTCFullYear() - MAX_AUTO_YEARS + 1, 0, 1)) : createdWall;
			const range = buildLayout(aggregation, yearsToShow, nowWall, loadFrom, firstDayOfWeek, LOCALE_NAMES);
			// Wall-clock range start back to UTC, with a day of slack for the offset's own DST shift.
			const since = new Date(range.rangeStart.getTime() - offset(range.rangeStart) * 60000 - 24 * 3600 * 1000);
			const loaded = isTestMode ? await loadTestHistory(kinds, activityDate, new Date()) : await loadHistory(entityTypeName ?? "", entityId, kinds, since, activityDate);
			if (cancelled) return;
			if (needsCreatedOn && loaded.items.length > 0) {
				const oldest = toUserTime(new Date(loaded.items.reduce((min, i) => Math.min(min, i.when.getTime()), Infinity)), offset);
				if (!createdWall || oldest < createdWall) createdWall = oldest;
			}
			setCreatedOn(createdWall);
			setResult(loaded);
			setExpanded(new Set());
			setAuditChanges(new Map());
			setCurrent({ values: new Map(), loaded: new Set() });
			setLoading(false);
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [entityId, entityTypeName, kinds, activityDate, aggregation, yearsToShow, firstDayOfWeek, needsCreatedOn]);

	// A different view: forget the selected square.
	React.useEffect(() => {
		setSelectedId(undefined);
		setFocusId(undefined);
	}, [aggregation, yearsToShow, firstDayOfWeek, source, activityDate]);

	// Items per square, keyed by block+cell (a key can't repeat within a block).
	const { byCell, cells, total, max } = React.useMemo(() => {
		const keyToIds = new Map<string, string[]>();
		const placed: IPlacedCell[] = [];
		for (const block of layout.blocks) {
			for (const cell of block.cells) {
				const id = `${block.id}|${cell.key}`;
				placed.push({ ...cell, blockId: block.id, id });
				keyToIds.set(cell.key, [...(keyToIds.get(cell.key) ?? []), id]);
			}
		}
		const grouped = new Map<string, IHistoryItem[]>();
		let count = 0;
		for (const item of result?.items ?? []) {
			const wall = toUserTime(item.when, offset);
			if (wall < layout.rangeStart || wall >= layout.rangeEnd) continue;
			const ids = keyToIds.get(bucketKey(wall, aggregation, firstDayOfWeek));
			if (!ids) continue;
			count++;
			for (const id of ids) grouped.set(id, [...(grouped.get(id) ?? []), item]);
		}
		let busiest = 0;
		grouped.forEach((list) => (busiest = Math.max(busiest, list.length)));
		return { byCell: grouped, cells: placed, total: count, max: busiest };
	}, [layout, result, aggregation, firstDayOfWeek, offset]);

	const cellById = React.useMemo(() => new Map(cells.map((c) => [c.id, c])), [cells]);
	const palette = resolvePalette(props.colorScheme, props.customColor);
	const cols = Math.max(...layout.blocks.map((b) => b.cols), 1);
	const { size, gap } = sizeFor(width || 600, aggregation, cols);
	const radius = radiusFor(props.cellShape, size);

	// Form designer only: warn the maker when the column is too narrow for the aggregation (the
	// graph would have to scroll). Users on a live form just get the scroll.
	const inDesigner = !entityId && (isTestMode ? testSwitch("designer") !== null : isFormDesignerHost());
	const minWidth = minWidthFor(aggregation, cols);
	const widthError = inDesigner && width > 0 && width < minWidth;
	const fittingAggregations = (["Day", "Week", "Month", "Year"] as Aggregation[]).filter(
		(a) => a !== aggregation && width >= minWidthFor(a, Math.max(...buildLayout(a, yearsToShow, today, createdOn, firstDayOfWeek, LOCALE_NAMES).blocks.map((b) => b.cols), 1))
	);

	// Narrow field: start scrolled to the newest end (right), as GitHub does.
	React.useLayoutEffect(() => {
		const el = scrollRef.current;
		if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth;
	}, [size, cols, layout]);

	// Lazy: audit columns (names for "Changed: ...", logical names and types for the change table)
	// only once a square with audit items is opened.
	const selectedItems = selectedId ? byCell.get(selectedId) ?? [] : [];
	const needsColumns = selectedItems.some((i) => i.kind === "audit" && (i.columnNumbers?.length ?? 0) > 0);
	React.useEffect(() => {
		if (!needsColumns || columns) return;
		if (isTestMode) {
			setColumns(TEST_COLUMNS);
			return;
		}
		if (!entityTypeName) return;
		loadColumns(entityTypeName).then(setColumns).catch(() => setColumns(new Map()));
	}, [needsColumns, columns, entityTypeName, isTestMode]);

	const toggleExpanded = (item: IHistoryItem): void => {
		const opening = !expanded.has(item.id);
		setExpanded((set) => {
			const next = new Set(set);
			if (next.has(item.id)) next.delete(item.id);
			else next.add(item.id);
			return next;
		});
		if (!opening) return;
		void loadChangeDetails(item);
	};

	async function loadChangeDetails(item: IHistoryItem): Promise<void> {
		const numbers = item.columnNumbers ?? [];
		const cols = isTestMode ? TEST_COLUMNS : entityTypeName ? await loadColumns(entityTypeName).catch(() => new Map<number, IColumnMeta>()) : new Map<number, IColumnMeta>();
		if (!auditChanges.has(item.id)) {
			try {
				let changes: Map<number, IAuditChange>;
				if (isTestMode) {
					changes = testAuditChanges(item);
				} else {
					const detail = await loadAuditDetail(item.id);
					changes = new Map();
					for (const n of numbers) {
						const meta = cols.get(n);
						changes.set(n, {
							// A create has no previous value - "-", not "(empty)".
							previous: item.operation === 1 || !meta ? undefined : readValue(detail.oldValue, meta),
							next: meta ? readValue(detail.newValue, meta) : undefined,
						});
					}
				}
				setAuditChanges((m) => new Map(m).set(item.id, { changes }));
			} catch (e) {
				setAuditChanges((m) => new Map(m).set(item.id, { error: e instanceof Error ? e.message : String(e) }));
			}
		}
		// Current values: every still-existing column this row needs that isn't loaded yet.
		const missing = numbers.map((n) => cols.get(n)).filter((c): c is IColumnMeta => !!c && !current.loaded.has(c.logicalName));
		if (missing.length === 0) return;
		try {
			const values = isTestMode
				? testCurrentValues(missing)
				: await loadCurrentValues(props.webAPI, entityTypeName ?? "", props.entityId ?? "", missing);
			setCurrent((c) => ({ values: new Map([...c.values, ...values]), loaded: new Set([...c.loaded, ...missing.map((m) => m.logicalName)]), error: c.error }));
		} catch (e) {
			setCurrent((c) => ({ ...c, loaded: new Set([...c.loaded, ...missing.map((m) => m.logicalName)]), error: e instanceof Error ? e.message : String(e) }));
		}
	}

	const tooltipFor = (cell: ICell, id: string): string => `${countPhrase(byCell.get(id)?.length ?? 0, source)} ${periodPhrase(cell, aggregation)}`;

	// Roving tabindex: one square is tabbable (selected, else today/newest); arrows move.
	const lastCellId = (cells.filter((c) => !c.isFuture).pop() ?? cells[cells.length - 1])?.id;
	const tabStopId = focusId && cellById.has(focusId) ? focusId : selectedId && cellById.has(selectedId) ? selectedId : lastCellId;

	const moveFocus = (from: IPlacedCell, dRow: number, dCol: number): void => {
		const target = cells.find((c) => c.blockId === from.blockId && c.row === from.row + dRow && c.col === from.col + dCol);
		if (!target) return;
		setFocusId(target.id);
		const el = cellRefs.current.get(target.id);
		el?.focus();
	};

	const onCellKeyDown = (e: React.KeyboardEvent, cell: IPlacedCell): void => {
		const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
		const move = moves[e.key];
		if (move) {
			e.preventDefault();
			moveFocus(cell, move[0], move[1]);
		} else if ((e.key === "Enter" || e.key === " ") && props.showDetails) {
			e.preventDefault();
			toggleSelected(cell.id);
		} else if (e.key === "Escape") {
			setHover(undefined);
			setSelectedId(undefined);
		}
	};

	const toggleSelected = (id: string): void => {
		// An empty square has nothing to list - its tooltip already says "No changes ...".
		if (!byCell.get(id)?.length && selectedId !== id) return;
		setDetailsLimit(DETAILS_PAGE);
		setSelectedId((current) => (current === id ? undefined : id));
	};

	const rowLabelWidth = ROW_LABEL_WIDTH[aggregation];

	// The expanded audit row: one line per changed column - Previous, New and the record's
	// Current (saved) value. Current is n/a when the column no longer exists or its type can't be
	// read back (e.g. a party list); Current equal to New is greyed, so later changes stand out.
	const renderChanges = (item: IHistoryItem): React.ReactElement => {
		const detail = auditChanges.get(item.id);
		if (detail?.error) return <div className="lops-ag-changes-note">Could not load the field changes: {detail.error}</div>;
		return (
			<table className="lops-ag-changes">
				<thead>
					<tr>
						<th>Field</th>
						<th>Previous</th>
						<th>New</th>
						<th>Current</th>
					</tr>
				</thead>
				<tbody>
					{(item.columnNumbers ?? []).map((n) => {
						const column = columns?.get(n);
						const raw = detail?.changes?.get(n);
						const currentRaw = column && current.values.has(column.logicalName) ? current.values.get(column.logicalName) : undefined;
						const [previousValue, nextValue, currentValue] =
							column?.attributeType === "Money" ? harmonizeMoney([raw?.previous, raw?.next, currentRaw]) : [raw?.previous, raw?.next, currentRaw];
						const change = raw ? { previous: previousValue, next: nextValue } : undefined;
						let currentCell: React.ReactElement;
						if (!column) currentCell = <td className="lops-ag-value lops-ag-value-none" title="This field no longer exists">n/a</td>;
						else if (!current.loaded.has(column.logicalName)) currentCell = <td className="lops-ag-value lops-ag-value-none">{"\u2026"}</td>;
						else if (current.values.has(column.logicalName)) {
							currentCell = <ValueCell value={currentValue} muted={!!change && currentValue === change.next} />;
						} else currentCell = <td className="lops-ag-value lops-ag-value-none" title={current.error ? `Could not load: ${current.error}` : "This field type can't be shown"}>n/a</td>;
						return (
							<tr key={n}>
								<th scope="row" title={column?.logicalName}>
									{column?.displayName ?? `Column ${n}`}
								</th>
								{detail ? <ValueCell value={change?.previous} /> : <td className="lops-ag-value lops-ag-value-none">{"\u2026"}</td>}
								{detail ? <ValueCell value={change?.next} /> : <td className="lops-ag-value lops-ag-value-none">{"\u2026"}</td>}
								{currentCell}
							</tr>
						);
					})}
				</tbody>
			</table>
		);
	};

	const renderBlock = (block: IBlock): React.ReactElement => {
		const headerRows = block.colLabelsBelow ? 0 : 1;
		// Labels under/above narrow squares would collide: thin them out to every 2nd/3rd.
		const labelEvery = aggregation === "Month" ? (size >= 26 ? 1 : size >= 14 ? 2 : 3) : aggregation === "Year" ? (size >= 30 ? 1 : 2) : 1;
		return (
			<div key={block.id} className="lops-ag-block">
				{block.title && <div className="lops-ag-block-title">{block.title}</div>}
				<div
					className="lops-ag-grid"
					style={{
						gridTemplateColumns: `${rowLabelWidth ? `${rowLabelWidth - gap}px ` : ""}repeat(${block.cols}, ${size}px)`,
						gridTemplateRows: `${headerRows ? `${HEADER_HEIGHT - gap}px ` : ""}repeat(${block.rows}, ${size}px)${block.colLabelsBelow ? ` ${HEADER_HEIGHT}px` : ""}`,
						gap: `${gap}px`,
					}}
				>
					{block.colLabels
						.filter((l) => l.index % labelEvery === 0)
						.map((l) => (
							<span
								key={`c${l.index}`}
								className={`lops-ag-label lops-ag-col-label${block.colLabelsBelow ? " lops-ag-col-label-below" : ""}${aggregation === "Month" || aggregation === "Year" ? " lops-ag-col-label-center" : ""}`}
								// A week label may run over the next columns, but never past the last one (that would
								// make the grid add implicit columns).
								style={{ gridColumn: `${l.index + (rowLabelWidth ? 2 : 1)} / span ${aggregation === "Month" || aggregation === "Year" ? 1 : Math.max(1, Math.min(4, block.cols - l.index))}`, gridRow: block.colLabelsBelow ? block.rows + 1 : 1 }}
							>
								{l.text}
							</span>
						))}
					{rowLabelWidth > 0 &&
						block.rowLabels.map((l) => (
							<span key={`r${l.index}`} className="lops-ag-label lops-ag-row-label" style={{
									gridColumn: 1,
									gridRow: l.index + 1 + headerRows,
									lineHeight: `${size}px`,
									// Week/Month label every row (one year each, one square high): at 10px squares the 12px
									// year labels crowded each other (docs screenshot, 2026-10-03), so they shrink with the
									// row. Day labels sit on every other row and keep 12px.
									fontSize: aggregation === "Day" ? undefined : `${Math.min(12, size + gap - 2)}px`,
								}}>
								{l.text}
							</span>
						))}
					{block.cells.map((cell) => {
						const id = `${block.id}|${cell.key}`;
						const placed = cellById.get(id)!;
						const count = byCell.get(id)?.length ?? 0;
						const level = levelFor(count, max);
						const selected = selectedId === id;
						const label = tooltipFor(cell, id);
						return (
							<div
								key={id}
								ref={(el) => {
									if (el) cellRefs.current.set(id, el);
									else cellRefs.current.delete(id);
								}}
								className={`lops-ag-cell${selected ? " lops-ag-cell-selected" : ""}${props.showDetails && count > 0 ? " lops-ag-cell-clickable" : ""}${cell.isFuture ? " lops-ag-cell-future" : ""}`}
								role={props.showDetails ? "button" : "img"}
								aria-label={label}
								aria-pressed={props.showDetails ? selected : undefined}
								tabIndex={id === tabStopId ? 0 : -1}
								data-level={level}
								data-count={count}
								style={{
									gridColumn: cell.col + (rowLabelWidth ? 2 : 1),
									gridRow: cell.row + 1 + headerRows,
									background: palette[level],
									borderRadius: radius,
									outlineColor: selected ? undefined : CELL_OUTLINE,
								}}
								onMouseEnter={(e) => setHover({ el: e.currentTarget, id })}
								onMouseLeave={() => setHover((h) => (h?.id === id ? undefined : h))}
								onFocus={(e) => {
									setFocusId(id);
									setHover({ el: e.currentTarget, id });
								}}
								onBlur={() => setHover((h) => (h?.id === id ? undefined : h))}
								onClick={() => props.showDetails && toggleSelected(id)}
								onKeyDown={(e) => onCellKeyDown(e, placed)}
							/>
						);
					})}
				</div>
			</div>
		);
	};

	const summaryRange = layout.rolling ? "in the last year" : layout.firstYear === layout.lastYear ? `in ${layout.lastYear}` : `in ${layout.firstYear} – ${layout.lastYear}`;
	const summary = loading ? "Loading activity…" : `${countPhrase(total, source)}${result?.truncated ? "+" : ""} ${summaryRange}`;
	const hoveredCell = hover ? cellById.get(hover.id) : undefined;
	const selectedCell = selectedId ? cellById.get(selectedId) : undefined;
	const selectedTarget = selectedId ? cellRefs.current.get(selectedId) : undefined;
	// The callout opens inward: a square in the right half of the graph anchors the callout's right
	// edge on it, one in the left half its left edge, so it stays within the graph's width instead of
	// spilling over the next form column (user, 2026-10-03: today's square is the right-most one, and
	// a centered callout stuck out ~215px past the graph).
	const calloutHint = (() => {
		const root = rootRef.current?.getBoundingClientRect();
		const cell = selectedTarget?.getBoundingClientRect();
		if (!root || !cell) return DirectionalHint.bottomCenter;
		return cell.left + cell.width / 2 > root.left + root.width / 2 ? DirectionalHint.bottomRightEdge : DirectionalHint.bottomLeftEdge;
	})();

	// Close the details callout on any press outside it. Fluent's own onDismiss listens for click
	// and focus on the document, but a host can swallow those first: the harness's .control-pane
	// did, so clicking a blank part of the page never reached it (measured with a log in
	// onDismiss). A capture-phase mousedown on the document can't be stopped by the page's own
	// handlers. Presses on the open square are left to its onClick toggle.
	React.useEffect(() => {
		if (!selectedId) return undefined;
		const onPress = (ev: MouseEvent): void => {
			const target = ev.target as Node | null;
			if (!target) return;
			if (detailsRef.current?.contains(target)) return;
			if (cellRefs.current.get(selectedId)?.contains(target)) return;
			// Another square with items: its onClick switches the callout to it.
			if (target instanceof HTMLElement && target.classList.contains("lops-ag-cell-clickable")) return;
			setSelectedId(undefined);
		};
		document.addEventListener("mousedown", onPress, true);
		return () => document.removeEventListener("mousedown", onPress, true);
	}, [selectedId]);

	return (
		<div ref={rootRef} className={`lops-ag-root${loading ? " lops-ag-loading" : ""}`}>
			{widthError && (
				<div className="lops-ag-config-error" role="alert">
					<div className="lops-ag-config-error-title">Activity Graph: configuration error</div>
					<div>
						This column is {width}px wide, but {aggregation} aggregation needs at least {minWidth}px to show all {cols} columns without scrolling. Place the
						control in a wider column or a one-column section{fittingAggregations.length > 0 ? `, or choose ${fittingAggregations.join(" or ")} aggregation` : ""}.
					</div>
				</div>
			)}
			{props.showSummary && entityId && (
				<div className="lops-ag-summary" aria-live="polite">
					{summary}
				</div>
			)}
			<div ref={scrollRef} className="lops-ag-scroll" role="group" aria-label={`Activity graph: ${summary}`}>
				{layout.blocks.map(renderBlock)}
			</div>
			{(props.showLegend || !entityId) && (
				<div className="lops-ag-footer">
					{/* Legend left-aligned under the graph (user request 2026-10-03). */}
					{props.showLegend && (
						<span className="lops-ag-legend" aria-hidden="true">
							<span className="lops-ag-label">Less</span>
							{palette.map((color, level) => (
								<span key={level} className="lops-ag-legend-cell" style={{ background: color, borderRadius: radiusFor(props.cellShape, 10), outlineColor: CELL_OUTLINE }} />
							))}
							<span className="lops-ag-label">More</span>
						</span>
					)}
					{!entityId && <span className="lops-ag-footnote">The activity graph appears once the record is saved.</span>}
				</div>
			)}
			{result?.problems.map((p, i) => (
				<div key={i} className="lops-ag-problem">
					<Icon iconName={p.reason === "disabled" ? "Info" : "Warning"} className="lops-ag-problem-icon" />
					<span>{problemText(p)}</span>
				</div>
			))}
			{props.showDetails && selectedCell && selectedTarget && (
				<Callout
					target={selectedTarget}
					directionalHint={calloutHint}
					gapSpace={4}
					beakWidth={10}
					role="dialog"
					ariaLabel={`${countPhrase(selectedItems.length, source)} ${periodPhrase(selectedCell, aggregation)}`}
					// Clicking the open square again closes via its own onClick toggle - not also here,
					// or the dismiss + toggle would reopen it.
					onDismiss={(ev) => {
						if (ev && ev.target instanceof Node && selectedTarget.contains(ev.target)) return;
						setSelectedId(undefined);
					}}
					// Long lists scroll inside the callout instead of growing past the form.
					calloutMaxHeight={380}
				>
					<div ref={detailsRef} className="lops-ag-details" style={{ fontFamily: props.fontFamily }}>
						<div className="lops-ag-details-header">
							<span>
								{countPhrase(selectedItems.length, source)} {periodPhrase(selectedCell, aggregation)}
							</span>
							<button type="button" className="lops-ag-close" aria-label="Close details" onClick={() => setSelectedId(undefined)}>
								<Icon iconName="ChromeClose" />
							</button>
						</div>
						{[...selectedItems]
							.sort((a, b) => b.when.getTime() - a.when.getTime())
							.slice(0, detailsLimit)
							.map((item) => {
								const wall = toUserTime(item.when, offset);
								const time = aggregation === "Day" ? FMT_TIME.format(wall) : FMT_DATE_TIME.format(wall);
								const canOpen = item.kind === "activity" && !!item.activityType && !isTestMode;
								const changed =
									item.kind === "audit" && item.columnNumbers && item.columnNumbers.length > 0
										? item.columnNumbers.map((n) => columns?.get(n)?.displayName ?? `Column ${n}`).join(", ")
										: undefined;
								return (
									<div key={`${item.kind}-${item.id}`} className="lops-ag-item">
										<span className="lops-ag-item-icon" style={{ color: palette[4], background: `${palette[1]}66` }}>
											<Icon iconName={iconFor(item)} />
										</span>
										<span className="lops-ag-item-body">
											<span className="lops-ag-item-title">
												{canOpen ? (
													<button
														type="button"
														className="lops-ag-link"
														onClick={() => void props.navigation.openForm({ entityName: item.activityType!, entityId: item.id })}
													>
														{item.title}
													</button>
												) : (
													item.title
												)}
											</span>
											<span className="lops-ag-item-meta">{[item.by, time].filter(Boolean).join(" · ")}</span>
											{changed && <span className="lops-ag-item-meta">Changed: {columns ? changed : "…"}</span>}
											{item.snippet && <span className="lops-ag-item-meta lops-ag-item-snippet">{item.snippet}</span>}
										</span>
										{changed && (
											<button
												type="button"
												className="lops-ag-chevron"
												aria-expanded={expanded.has(item.id)}
												aria-label={expanded.has(item.id) ? "Hide field changes" : "Show field changes"}
												title={expanded.has(item.id) ? "Hide field changes" : "Show field changes"}
												onClick={() => toggleExpanded(item)}
											>
												<Icon iconName="ChevronDown" style={{ transform: expanded.has(item.id) ? "rotate(180deg)" : undefined }} />
											</button>
										)}
										{changed && expanded.has(item.id) && renderChanges(item)}
									</div>
								);
							})}
						{selectedItems.length > detailsLimit && (
							<button type="button" className="lops-ag-link lops-ag-more" onClick={() => setDetailsLimit((n) => n + DETAILS_PAGE)}>
								Show {Math.min(DETAILS_PAGE, selectedItems.length - detailsLimit)} more of {selectedItems.length - detailsLimit}
							</button>
						)}
					</div>
				</Callout>
			)}
			{hover && hoveredCell && hover.el.isConnected && hover.id !== selectedId && (
				<Tooltip
					targetElement={hover.el}
					content={tooltipFor(hoveredCell, hover.id)}
					directionalHint={DirectionalHint.topCenter}
					// Same tooltip width/wrapping as the rest of the family.
					styles={{ content: { maxWidth: 280, whiteSpace: "normal" } }}
					calloutProps={{ gapSpace: 4, beakWidth: 8, doNotLayer: false, isBeakVisible: true }}
				/>
			)}
		</div>
	);
};
