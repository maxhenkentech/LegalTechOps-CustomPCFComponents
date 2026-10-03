// ---------------------------------------------------------------------------------------------
// Calendar math for the graph. Every Date here is a "wall-clock" date: the user's local time
// (their Dataverse time zone, see toUserTime) stored in the UTC fields of a Date, so only the
// getUTC*/setUTC* methods are ever used and the browser's own time zone can't shift a bucket.
// ---------------------------------------------------------------------------------------------

export type Aggregation = "Day" | "Week" | "Month" | "Year";

const DAY_MS = 24 * 60 * 60 * 1000;

export function toUserTime(utc: Date, offsetMinutes: (d: Date) => number): Date {
	return new Date(utc.getTime() + offsetMinutes(utc) * 60 * 1000);
}

export function startOfDay(d: Date): Date {
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, days: number): Date {
	return new Date(d.getTime() + days * DAY_MS);
}

// firstDayOfWeek: 0 = Sunday ... 6 = Saturday (PCF's DayOfWeek uses the same numbering).
export function startOfWeek(d: Date, firstDayOfWeek: number): Date {
	const day = startOfDay(d);
	return addDays(day, -((day.getUTCDay() - firstDayOfWeek + 7) % 7));
}

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
export const dayKey = (d: Date): string => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const monthKey = (d: Date): string => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
const yearKey = (d: Date): string => `${d.getUTCFullYear()}`;

// The bucket an event at wall-clock time `d` is counted in. A week belongs to the date it
// starts on, so a week that spans New Year counts in the old year's row (its tooltip says so).
export function bucketKey(d: Date, aggregation: Aggregation, firstDayOfWeek: number): string {
	switch (aggregation) {
		case "Week":
			return dayKey(startOfWeek(d, firstDayOfWeek));
		case "Month":
			return monthKey(d);
		case "Year":
			return yearKey(d);
		default:
			return dayKey(d);
	}
}

export interface ICell {
	key: string;
	// First day of the bucket and the day after its last day (exclusive), wall-clock.
	start: Date;
	end: Date;
	row: number;
	col: number;
	// After today: drawn (calendar-year grids show the whole year, as GitHub does) but quiet.
	isFuture: boolean;
}

export interface ILabel {
	index: number;
	text: string;
}

export interface IBlock {
	id: string;
	// Heading above the block - the year, for one Day grid per calendar year.
	title?: string;
	rows: number;
	cols: number;
	cells: ICell[];
	rowLabels: ILabel[];
	colLabels: ILabel[];
	colLabelsBelow: boolean;
}

export interface IGridLayout {
	blocks: IBlock[];
	// Wall-clock [start, end) covered by all drawn cells - events outside it are not counted.
	rangeStart: Date;
	rangeEnd: Date;
	// true for the automatic Day view (the last 12 months, GitHub's profile graph).
	rolling: boolean;
	firstYear: number;
	lastYear: number;
}

export interface ILocaleNames {
	// 12 abbreviated month names, January first.
	months: string[];
	// 7 abbreviated weekday names, Sunday first.
	weekdays: string[];
}

export const MAX_YEARS = 20;
export const MAX_AUTO_YEARS = 10;

// How many calendar years to draw. yearsToShow > 0 is taken literally; 0 means automatic:
// every year since the record was created, at most MAX_AUTO_YEARS.
export function resolveYears(yearsToShow: number, today: Date, createdOn: Date | undefined): number {
	if (yearsToShow > 0) return Math.min(yearsToShow, MAX_YEARS);
	if (!createdOn) return 1;
	const span = today.getUTCFullYear() - createdOn.getUTCFullYear() + 1;
	return Math.max(1, Math.min(span, MAX_AUTO_YEARS));
}

// Month labels along a row of week columns: each month is named over the first column whose
// week starts in it, and skipped when it would crowd the previous label (GitHub does the same).
function monthLabelsForWeeks(firstWeekStart: Date, cols: number, names: ILocaleNames, minGap: number): ILabel[] {
	const labels: ILabel[] = [];
	let lastMonth = -1;
	for (let col = 0; col < cols; col++) {
		const weekStart = addDays(firstWeekStart, col * 7);
		// The month a column is named after is the one its week mostly lies in, so a week
		// starting on 29 Mar is already "Apr" - the label then sits over April's first full week.
		const month = addDays(weekStart, 3).getUTCMonth();
		if (month === lastMonth) continue;
		lastMonth = month;
		const previous = labels[labels.length - 1];
		if (previous && col - previous.index < minGap) labels.pop();
		if (col <= cols - minGap || labels.length === 0) labels.push({ index: col, text: names.months[month] });
	}
	return labels;
}

function weekdayLabels(firstDayOfWeek: number, names: ILocaleNames): ILabel[] {
	// Monday, Wednesday and Friday, wherever the chosen first day puts them.
	return [1, 3, 5].map((weekday) => ({ index: (weekday - firstDayOfWeek + 7) % 7, text: names.weekdays[weekday] }));
}

function dayBlock(id: string, from: Date, to: Date, today: Date, firstDayOfWeek: number, names: ILocaleNames, title?: string): IBlock {
	// from/to: first and last day drawn (inclusive). Columns are whole weeks; days of the first
	// and last week outside [from, to] are left out, so a calendar year starts mid-column.
	const firstWeekStart = startOfWeek(from, firstDayOfWeek);
	const cols = Math.floor((startOfWeek(to, firstDayOfWeek).getTime() - firstWeekStart.getTime()) / (7 * DAY_MS)) + 1;
	const cells: ICell[] = [];
	for (let d = startOfDay(from); d.getTime() <= to.getTime(); d = addDays(d, 1)) {
		const offset = Math.round((d.getTime() - firstWeekStart.getTime()) / DAY_MS);
		cells.push({ key: dayKey(d), start: d, end: addDays(d, 1), row: offset % 7, col: Math.floor(offset / 7), isFuture: d.getTime() > today.getTime() });
	}
	return {
		id,
		title,
		rows: 7,
		cols,
		cells,
		rowLabels: weekdayLabels(firstDayOfWeek, names),
		colLabels: monthLabelsForWeeks(firstWeekStart, cols, names, 3),
		colLabelsBelow: false,
	};
}

export function buildLayout(aggregation: Aggregation, yearsToShow: number, todayInput: Date, createdOn: Date | undefined, firstDayOfWeek: number, names: ILocaleNames): IGridLayout {
	const today = startOfDay(todayInput);
	const thisYear = today.getUTCFullYear();

	// Automatic Day view: GitHub's rolling year - 53 week columns ending with this week.
	if (aggregation === "Day" && yearsToShow <= 0) {
		const from = startOfWeek(addDays(today, -364), firstDayOfWeek);
		const block = dayBlock("rolling", from, today, today, firstDayOfWeek, names);
		return { blocks: [block], rangeStart: from, rangeEnd: addDays(today, 1), rolling: true, firstYear: from.getUTCFullYear(), lastYear: thisYear };
	}

	const years = resolveYears(yearsToShow, today, createdOn);
	const firstYear = thisYear - years + 1;
	const yearList: number[] = [];
	for (let y = thisYear; y >= firstYear; y--) yearList.push(y); // newest first

	if (aggregation === "Day") {
		const blocks = yearList.map((y) => dayBlock(`y${y}`, new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y, 11, 31)), today, firstDayOfWeek, names, `${y}`));
		return { blocks, rangeStart: new Date(Date.UTC(firstYear, 0, 1)), rangeEnd: new Date(Date.UTC(thisYear + 1, 0, 1)), rolling: false, firstYear, lastYear: thisYear };
	}

	if (aggregation === "Year") {
		const ascending = [...yearList].reverse();
		const cells = ascending.map((y, col) => ({
			key: `${y}`,
			start: new Date(Date.UTC(y, 0, 1)),
			end: new Date(Date.UTC(y + 1, 0, 1)),
			row: 0,
			col,
			isFuture: false,
		}));
		const block: IBlock = { id: "years", rows: 1, cols: ascending.length, cells, rowLabels: [], colLabels: ascending.map((y, col) => ({ index: col, text: `${y}` })), colLabelsBelow: true };
		return { blocks: [block], rangeStart: new Date(Date.UTC(firstYear, 0, 1)), rangeEnd: new Date(Date.UTC(thisYear + 1, 0, 1)), rolling: false, firstYear, lastYear: thisYear };
	}

	if (aggregation === "Month") {
		const cells: ICell[] = [];
		yearList.forEach((y, row) => {
			for (let m = 0; m < 12; m++) {
				const start = new Date(Date.UTC(y, m, 1));
				cells.push({ key: monthKey(start), start, end: new Date(Date.UTC(y, m + 1, 1)), row, col: m, isFuture: start.getTime() > today.getTime() });
			}
		});
		const block: IBlock = {
			id: "months",
			rows: yearList.length,
			cols: 12,
			cells,
			rowLabels: yearList.map((y, row) => ({ index: row, text: `${y}` })),
			colLabels: names.months.map((text, index) => ({ index, text })),
			colLabelsBelow: false,
		};
		return { blocks: [block], rangeStart: new Date(Date.UTC(firstYear, 0, 1)), rangeEnd: new Date(Date.UTC(thisYear + 1, 0, 1)), rolling: false, firstYear, lastYear: thisYear };
	}

	// Week: one row per year; column n is the year's (n+1)th week by start date. A week starting
	// in late December belongs to the old year (bucketKey), so the first column of a row is the
	// first week starting on or after 1 January.
	const cells: ICell[] = [];
	let cols = 0;
	yearList.forEach((y, row) => {
		const jan1 = new Date(Date.UTC(y, 0, 1));
		let weekStart = startOfWeek(jan1, firstDayOfWeek);
		if (weekStart.getTime() < jan1.getTime()) weekStart = addDays(weekStart, 7);
		for (let col = 0; weekStart.getUTCFullYear() === y; col++, weekStart = addDays(weekStart, 7)) {
			cells.push({ key: dayKey(weekStart), start: weekStart, end: addDays(weekStart, 7), row, col, isFuture: weekStart.getTime() > today.getTime() });
			cols = Math.max(cols, col + 1);
		}
	});
	let labelYearFirstWeek = startOfWeek(new Date(Date.UTC(thisYear, 0, 1)), firstDayOfWeek);
	if (labelYearFirstWeek.getUTCFullYear() < thisYear) labelYearFirstWeek = addDays(labelYearFirstWeek, 7);
	const block: IBlock = {
		id: "weeks",
		rows: yearList.length,
		cols,
		cells,
		rowLabels: yearList.map((y, row) => ({ index: row, text: `${y}` })),
		colLabels: monthLabelsForWeeks(labelYearFirstWeek, cols, names, 3),
		colLabelsBelow: false,
	};
	// Range: from the first week of the oldest year to the end of the newest year's last week.
	const lastCell = cells.filter((c) => c.row === 0).pop();
	const firstCell = cells.filter((c) => c.row === yearList.length - 1)[0];
	return { blocks: [block], rangeStart: firstCell.start, rangeEnd: lastCell ? lastCell.end : addDays(today, 1), rolling: false, firstYear, lastYear: thisYear };
}

// GitHub's levels: 0 for nothing, otherwise quartiles of the busiest square in view.
export function levelFor(count: number, max: number): number {
	if (count <= 0 || max <= 0) return 0;
	return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}
