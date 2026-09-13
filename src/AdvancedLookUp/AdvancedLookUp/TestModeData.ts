// Canned data for the local PCF test harness (no live Dataverse connection available there),
// following the same TEST_MODE_* convention as the other controls in this repo.

export interface ITestModeTargetRecord {
  id: string;
  name: string;
  // Simulates an alternate label column (e.g. an account number/short code) so the harness can
  // exercise labelColumnName without a real EntityDefinitions call - see resolveTestModeLabel.
  altLabel: string;
  // Per-record MDL2 icon name - only meaningful when the harness's "Icon Column" value is being
  // simulated as a text icon-name column (see resolveTestModeIconMode below).
  iconName: string;
  tooltip: string;
  isActive: boolean;
  // Simulates a picture/image column value — a data URI pointing to a small colored square with
  // the record's first letter, used by test mode when iconMode is "image".
  pictureUrl: string;
  // Simulates a Choice column's selected-option label - only meaningful when the harness's "Icon
  // Column" value is being simulated as a choice column (see resolveTestModeIconMode below). Most
  // records hold an MDL2 icon name here (the common case); one deliberately holds an image-
  // extension label instead, to exercise the "choice label names a web resource" branch too.
  choiceIconLabel: string;
}

export const TEST_MODE_TARGET_ENTITY_LOGICAL_NAME = "lops_testrecord";

const _PICTURE_COLORS = [
  "#0078d4", // blue (Acme Corporation)
  "#107c71", // teal (Acme Industries)
  "#8b6bca", // purple (Acme Legal Services)
  "#00b7c3", // cyan (Contoso Ltd)
  "#ca5010", // orange (Contoso Pharmaceuticals)
  "#da70d6", // magenta (Fabrikam Inc)
  "#4982e2", // light blue (Fabrikam Residences)
  "#e3008c", // pink (Northwind Traders)
];

function _makePictureUrl(letter: string, color: string): string {
  return (
    "data:image/svg+xml;base64," +
    btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="16" fill="${color}"/><text x="16" y="21" font-size="14" fill="#ffffff" text-anchor="middle" font-family="Segoe UI, sans-serif">${letter}</text></svg>`
    )
  );
}

export const TEST_MODE_TARGET_RECORDS: ITestModeTargetRecord[] = [
  { id: "11111111-1111-1111-1111-111111111101", name: "Acme Corporation", altLabel: "ACM-001", iconName: "CityNext", tooltip: "Primary account - New York HQ", isActive: true, pictureUrl: _makePictureUrl("A", _PICTURE_COLORS[0]), choiceIconLabel: "CityNext" },
  { id: "11111111-1111-1111-1111-111111111102", name: "Acme Industries", altLabel: "ACM-002", iconName: "Manufacturing", tooltip: "Manufacturing division", isActive: true, pictureUrl: _makePictureUrl("A", _PICTURE_COLORS[1]), choiceIconLabel: "Manufacturing" },
  { id: "11111111-1111-1111-1111-111111111103", name: "Acme Legal Services", altLabel: "ACM-003", iconName: "Balance", tooltip: "In-house legal services arm, handles contract review and outside counsel coordination for the whole group", isActive: true, pictureUrl: _makePictureUrl("A", _PICTURE_COLORS[2]), choiceIconLabel: "Balance" },
  // Deliberately an image-extension label - simulates a maker's Choice option pointing at a web
  // resource (e.g. a custom logo) rather than an MDL2 icon name. See resolveTestModeIconForRecord.
  { id: "11111111-1111-1111-1111-111111111104", name: "Contoso Ltd", altLabel: "CON-001", iconName: "Globe", tooltip: "International supplier", isActive: true, pictureUrl: _makePictureUrl("C", _PICTURE_COLORS[3]), choiceIconLabel: "contoso_logo.png" },
  { id: "11111111-1111-1111-1111-111111111105", name: "Contoso Pharmaceuticals", altLabel: "CON-002", iconName: "Health", tooltip: "Regulated - requires signed NDA before sharing pricing", isActive: true, pictureUrl: _makePictureUrl("C", _PICTURE_COLORS[4]), choiceIconLabel: "Health" },
  { id: "11111111-1111-1111-1111-111111111106", name: "Fabrikam Inc", altLabel: "FAB-001", iconName: "Factory", tooltip: "Long-unbrokentokenwithnospacestostresstesttooltipwrapping", isActive: true, pictureUrl: _makePictureUrl("F", _PICTURE_COLORS[5]), choiceIconLabel: "Factory" },
  { id: "11111111-1111-1111-1111-111111111107", name: "Fabrikam Residences", altLabel: "FAB-002", iconName: "HomeGroup", tooltip: "Residential property management", isActive: false, pictureUrl: _makePictureUrl("F", _PICTURE_COLORS[6]), choiceIconLabel: "HomeGroup" },
  { id: "11111111-1111-1111-1111-111111111108", name: "Northwind Traders", altLabel: "NWT-001", iconName: "Shop", tooltip: "Retail partner, dissolved 2023", isActive: false, pictureUrl: _makePictureUrl("N", _PICTURE_COLORS[7]), choiceIconLabel: "Shop" },
];

// Kept for backwards compatibility — resolves to the first record's pictureUrl.
export const TEST_MODE_IMAGE_DATA_URI = TEST_MODE_TARGET_RECORDS[0].pictureUrl;

// Simulates the real "known column logical names on the target table" set that validateConfig()
// (AdvancedLookUpControl.tsx) checks Label Column/Tooltip Column/Additional Search Columns
// against - real mode gets this from a live EntityDefinitions(...)/Attributes call, which doesn't
// exist in the local harness. Lets a maker exercise the config-error panel (e.g. type a typo'd
// column name) against the local test data without a live Dataverse connection. Deliberately does
// NOT include iconColumnName's possible values - that property is exempt from validation
// entirely, since a non-matching value is its own documented "fixed icon name" feature, not a typo.
// "emptycolumn" is a real entry here (not a typo standing in for something else) specifically so
// it passes validation while ALSO being recognized by the "empty"-simulation heuristic in
// resolveTestModeIconForRecord/resolveTestModeLabel/resolveTestModeTooltip - without it, a maker
// couldn't locally test a fallback chain's first-entry-blank case without the validator flagging
// their test column name as nonexistent.
// "choicecolumn" is a real entry here too (not in the schema, just a documented test-mode-only
// convention, same reasoning as "iconname"/"pictureurl" below) so a maker can exercise Icon
// Column's Choice-column branch locally without tripping the (now-active, see AdvancedLookUpControl
// v1.6.0 notes) column-existence check on Icon Column itself.
// A Map (logical name -> simulated Dataverse AttributeType), not a plain Set, mirroring real
// mode's resolveAttributeLogicalNames - existence checks still just call `.has(name)`. Every entry
// is "String" except "choicecolumn" ("Picklist", already meaningful for Icon Column's Choice-column
// branch) and "lookupcolumn" (new, "Lookup" - lets a maker exercise Additional Display Columns'
// Lookup-type handling locally; see getTestModeDisplayValue, which maps it to a record's own name
// as a stand-in for "the referenced record's name").
export const TEST_MODE_KNOWN_COLUMNS = new Map<string, string>([
  ["lops_testrecordid", "Uniqueidentifier"],
  ["name", "String"],
  ["altlabel", "String"],
  ["iconname", "String"],
  ["tooltip", "String"],
  ["statecode", "State"],
  ["pictureurl", "String"],
  ["emptycolumn", "String"],
  ["choicecolumn", "Picklist"],
  ["lookupcolumn", "Lookup"],
]);

export type TestModeIconMode = "image" | "text" | "choice" | "fixed" | "none";

// Mirrors RelationshipView's TestModeData "contains 'icon'"/"contains 'image'" naming heuristic
// for simulating column-type detection without a live EntityDefinitions call. "choice" must be
// checked before the "icon" text check below, or a name like "iconchoice" would misclassify.
// Never returns "fixed" - unlike real mode's now-retired "unmatched name = fixed icon" behavior,
// test mode's "fixed" kind is only ever constructed explicitly from iconFixedName (see
// resolveTestModeIconCandidates), matching Icon Column's own real-mode behavior where every column
// entry must resolve to an actual column type. An entry that matches none of the heuristics below
// just defaults to "text", harmlessly - real mode would report it as a validation error the same
// way any other unrecognized column name does, so there's nothing meaningful to simulate here.
export function resolveTestModeIconMode(iconColumnName: string | undefined): TestModeIconMode {
  if (!iconColumnName) return "none";
  const lower = iconColumnName.toLowerCase();
  if (lower.includes("image") || lower.includes("picture") || lower.includes("photo")) return "image";
  if (lower.includes("choice")) return "choice";
  return "text";
}

// Splits Icon Column/Tooltip Column/Label Column's semicolon-separated fallback-chain syntax
// (see AdvancedLookUpControl.tsx's parseColumnList - duplicated here rather than imported, since
// TestModeData is imported BY the control file and this repo's controls don't share code across
// files that would create a cycle).
function splitColumnList(value: string | undefined): string[] {
  return (value || "")
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

export interface TestModeIconCandidate {
  kind: TestModeIconMode;
  name: string;
}

// Per-entry version of resolveTestModeIconMode, for the fallback-chain syntax - each semicolon
// entry is independently classified image/text/choice exactly as a single Icon Column value always
// was. `kind` is never actually "none" here since splitColumnList already drops empty entries;
// kept as TestModeIconMode (not a narrower type) so this doesn't need an unsafe cast to line up
// with resolveTestModeIconMode's own return type. iconFixedName (Fixed Icon Name, a separate
// property - see AdvancedLookUpControl.tsx's IconCandidateKind comment) is appended as its own
// "fixed"-kind candidate, always last - mirrors real mode's resolveMetadata effect exactly:
// Icon Column's own chain is tried first, in order, and Fixed Icon Name is only ever the
// lowest-priority fallback, never a substitute for an unmatched column name anymore.
export function resolveTestModeIconCandidates(iconColumnName: string | undefined, iconFixedName: string | undefined): TestModeIconCandidate[] {
  const candidates = splitColumnList(iconColumnName).map((name) => ({ kind: resolveTestModeIconMode(name), name }));
  const fixed = (iconFixedName || "").trim();
  if (fixed) candidates.push({ kind: "fixed", name: fixed });
  return candidates;
}

// Per-record resolution of a candidate chain, mirroring resolveIconForRecord's real-mode priority
// order (first candidate to actually produce a value wins) without needing a live fetch - test
// mode's pictureUrl is already an in-memory data URI, so unlike the real Web API path there's no
// async/sync split to worry about here at all.
//
// A configured entry containing "empty" (case-insensitive) simulates a column that's always blank
// on every record, regardless of what "real" data it would otherwise map to - the only way to
// locally exercise the fallback actually falling through to a second entry, since this harness's
// canned records don't have a second real icon/picture field to fall back to. E.g.
// "emptycolumn;iconname" demonstrates falling through past a blank first choice.
// Web-resource-vs-icon-name detection duplicated from AdvancedLookUpControl's
// WEB_RESOURCE_ICON_PATTERN, same reasoning as splitColumnList's duplication comment above - this
// file is imported BY the control, so importing back from it would be a cycle.
const _WEB_RESOURCE_ICON_PATTERN = /\.(png|jpe?g|gif|svg|ico|bmp)$/i;

export function resolveTestModeIconForRecord(
  candidates: TestModeIconCandidate[],
  record: ITestModeTargetRecord
): { iconValue?: string; pictureUrl?: string } {
  for (const c of candidates) {
    const simulateEmpty = c.name.toLowerCase().includes("empty");
    if (c.kind === "fixed") return { iconValue: c.name };
    if (c.kind === "text" && !simulateEmpty && record.iconName) return { iconValue: record.iconName };
    if (c.kind === "choice" && !simulateEmpty && record.choiceIconLabel) {
      // A web-resource-labeled choice option has no real web resource to fetch locally - reusing
      // the record's own pictureUrl data URI here (instead of a "/webresources/..." path, which
      // would just 404 in the harness) so the harness still visibly demonstrates the "choice label
      // names an image" branch rendering an <img>, not just the "names an MDL2 icon" branch.
      if (_WEB_RESOURCE_ICON_PATTERN.test(record.choiceIconLabel)) return { pictureUrl: record.pictureUrl };
      return { iconValue: record.choiceIconLabel };
    }
    if (c.kind === "image" && !simulateEmpty && record.pictureUrl) return { pictureUrl: record.pictureUrl };
  }
  return {};
}

// Simulates Label Column's fallback-chain syntax without a real EntityDefinitions/attribute-value
// lookup: the first configured entry not simulated as blank (see the "empty" heuristic above)
// switches the display label from the record's name to its altLabel; an empty list, or every
// entry simulated blank, falls back to the record's real name - standing in for "none of the
// configured columns had a value, use the primary name column" in real mode.
export function resolveTestModeLabel(record: ITestModeTargetRecord, labelColumnNames: string[]): string {
  const hasUsableEntry = labelColumnNames.some((c) => !c.toLowerCase().includes("empty"));
  return hasUsableEntry ? record.altLabel : record.name;
}

// Same fallback-chain simulation as resolveTestModeLabel, for Tooltip Column.
export function resolveTestModeTooltip(record: ITestModeTargetRecord, tooltipColumnNames: string[]): string | undefined {
  const hasUsableEntry = tooltipColumnNames.some((c) => !c.toLowerCase().includes("empty"));
  return hasUsableEntry ? record.tooltip : undefined;
}

// Mirrors real mode's effectiveSortColumn (AdvancedLookUpControl.tsx's runSearch) - maps a
// logical column name to the corresponding field on the canned test record, the same way
// TEST_MODE_KNOWN_COLUMNS' entries correspond to ITestModeTargetRecord's own fields. "statecode"
// resolves to a number (0 = active, 1 = inactive) specifically so a maker can exercise ascending
// sort on a genuinely numeric value locally, not just strings - real mode needs no equivalent
// mapping at all, since OData's $orderby sorts by whatever the real attribute's own type is.
// Blank or unrecognized names (including "emptycolumn"/"choicecolumn", which exist only to
// exercise other properties) fall back to the primary name column, same as real mode's own
// blank-Sort-Column default - a genuinely invalid name is already caught by configErrors before
// this ever runs.
function getTestModeSortValue(record: ITestModeTargetRecord, sortColumnName: string): string | number {
  switch (sortColumnName.toLowerCase()) {
    case "altlabel":
      return record.altLabel;
    case "iconname":
      return record.iconName;
    case "tooltip":
      return record.tooltip;
    case "pictureurl":
      return record.pictureUrl;
    case "statecode":
      return record.isActive ? 0 : 1;
    default:
      return record.name;
  }
}

function compareSortValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function filterTestModeRecords(
  searchText: string,
  showInactiveRecords: boolean,
  resultLimit: number,
  sortColumnName?: string
): ITestModeTargetRecord[] {
  const needle = searchText.trim().toLowerCase();
  const sortCol = (sortColumnName || "").trim() || "name";
  return TEST_MODE_TARGET_RECORDS.filter((r) => (showInactiveRecords || r.isActive) && (!needle || r.name.toLowerCase().includes(needle) || r.altLabel.toLowerCase().includes(needle)))
    .slice()
    .sort((a, b) => compareSortValues(getTestModeSortValue(a, sortCol), getTestModeSortValue(b, sortCol)))
    .slice(0, resultLimit);
}

// Additional Display Columns' test-mode simulation - same field-name mapping convention as
// getTestModeSortValue, but real mode's underlying value-reading is type-agnostic (see
// readContextColumnValue in AdvancedLookUpControl.tsx), so there's no equivalent per-type branching
// needed here either. "lookupcolumn" maps to the record's own name, standing in for "the referenced
// record's name" a real Lookup-type column would show - there's no actual second table to look up
// in the canned test data, so this is the closest local stand-in for exercising that code path.
function getTestModeDisplayValue(record: ITestModeTargetRecord, columnName: string): string | undefined {
  switch (columnName.toLowerCase()) {
    case "altlabel":
      return record.altLabel;
    case "iconname":
      return record.iconName;
    case "tooltip":
      return record.tooltip;
    case "pictureurl":
      return record.pictureUrl;
    case "statecode":
      return record.isActive ? "Active" : "Inactive";
    case "lookupcolumn":
      return record.name;
    case "emptycolumn":
      return undefined;
    default:
      return undefined;
  }
}

// Mirrors real mode's buildContextText exactly - every configured column's value, joined with the
// same middle-dot separator, a column with no value on this record simply omitted.
export function resolveTestModeContextText(record: ITestModeTargetRecord, columnNames: string[]): string | undefined {
  const parts = columnNames.map((c) => getTestModeDisplayValue(record, c)).filter((v): v is string => !!v);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
