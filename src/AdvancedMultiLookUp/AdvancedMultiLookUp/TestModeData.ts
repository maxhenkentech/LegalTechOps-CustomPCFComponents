import { IIconCandidate, IIconResult, readFormatted, resolveChoiceIconLabel } from "./Dataverse";

// Harness-only fixtures - never used against live Dataverse.
//
// Unlike AdvancedLookUp's TestModeData (hand-written resolve* simulations per property), these
// records are shaped like real Web API entities: raw values plus FormattedValue annotations, under
// the same keys a live $select would return. So the harness runs the SAME label / tooltip /
// display-column / icon-chain code as a real form, and only the fetches are stubbed.
//
// Columns of the fake related table "lops_testrecord" (type in brackets) and what each exercises:
//   name          [String]   primary name, always searched
//   lops_code     [String]   Label Column / Additional Search Columns (e.g. "ACM-001")
//   lops_icon     [String]   Icon Column as an MDL2-name text column. Northwind holds "Balance",
//                            which is NOT a registered MDL2 name -> falls through the chain
//   lops_logo     [Image]    Icon Column as an Image column. Live, the picture comes back as the
//                            "lops_logo_url" companion; here that holds a data URI.
//                            Empty on Fabrikam Residences -> falls through the chain
//   lops_category [Picklist] Icon Column as a Choice column: option label = MDL2 name, or
//                            "contoso_logo.png" (web resource, see TEST_MODE_WEB_RESOURCES)
//   lops_city     [String]   Additional Display Columns
//   lops_revenue  [Money]    Additional Display Columns (formatted currency)
//   lops_parentid [Lookup]   Additional Display/Search Columns (formatted name), and dot
//                            notation: lops_parentid.lops_logo takes the parent's logo
//   lops_note     [Memo]     Tooltip Column; one long unbroken token tests wrapping
//   lops_empty    [String]   always blank - first entry of a fallback chain that must fall through
//   statecode     [State]    Show Inactive Records (Fabrikam Residences, Northwind are inactive)

export const TEST_MODE_TARGET_ENTITY = "lops_testrecord";
export const TEST_MODE_PRIMARY_ID = "lops_testrecordid";
export const TEST_MODE_PRIMARY_NAME = "name";

export const TEST_MODE_ATTRIBUTE_TYPES = new Map<string, string>([
  ["lops_testrecordid", "Uniqueidentifier"],
  ["name", "String"],
  ["lops_code", "String"],
  ["lops_icon", "String"],
  ["lops_logo", "Virtual"],
  ["lops_category", "Picklist"],
  ["lops_city", "String"],
  ["lops_revenue", "Money"],
  ["lops_parentid", "Lookup"],
  ["lops_note", "Memo"],
  ["lops_empty", "String"],
  ["statecode", "State"],
]);

// Stands in for resolveColumnKind's AttributeTypeName check (only Image columns need it).
export const TEST_MODE_IMAGE_COLUMNS = new Set(["lops_logo"]);
// The lookup's target is the same fake table, so dot notation resolves against these fixtures too.
export const TEST_MODE_LOOKUP_TARGETS: Record<string, string> = { lops_parentid: TEST_MODE_TARGET_ENTITY };

const logo = (letter: string, color: string): string =>
  "data:image/svg+xml;base64," +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="16" fill="${color}"/><text x="16" y="21" font-size="14" fill="#ffffff" text-anchor="middle" font-family="Segoe UI, sans-serif">${letter}</text></svg>`);

// Multi-color, so an image is visibly different from a one-color MDL2 glyph.
export const TEST_MODE_WEB_RESOURCES: Record<string, string> = {
  "contoso_logo.png":
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#00b7c3"/><path d="M4 8h8M8 4v8" stroke="#ffb900" stroke-width="2.2" stroke-linecap="round"/></svg>'
    ),
};

interface IFixture {
  id: string;
  name: string;
  code: string;
  icon: string;
  logo?: string;
  category: string;
  city: string;
  revenue: number;
  parentId?: string;
  note: string;
  active: boolean;
}

const id = (n: number): string => `11111111-1111-1111-1111-1111111111${String(n).padStart(2, "0")}`;

const FIXTURES: IFixture[] = [
  { id: id(1), name: "Acme Corporation", code: "ACM-001", icon: "CityNext", logo: logo("A", "#0078d4"), category: "CityNext", city: "New York", revenue: 1200000, note: "Primary account - New York HQ", active: true },
  { id: id(2), name: "Acme Industries", code: "ACM-002", icon: "Manufacturing", logo: logo("A", "#107c71"), category: "Manufacturing", city: "Chicago", revenue: 640000, parentId: id(1), note: "Manufacturing division", active: true },
  { id: id(3), name: "Acme Legal Services", code: "ACM-003", icon: "Library", logo: logo("A", "#8b6bca"), category: "Library", city: "Boston", revenue: 210000, parentId: id(1), note: "In-house legal services arm, handles contract review and outside counsel coordination for the whole group", active: true },
  { id: id(4), name: "Contoso Ltd", code: "CON-001", icon: "Globe", logo: logo("C", "#00b7c3"), category: "contoso_logo.png", city: "London", revenue: 980000, note: "International supplier", active: true },
  { id: id(5), name: "Contoso Pharmaceuticals", code: "CON-002", icon: "Health", logo: logo("C", "#ca5010"), category: "Health", city: "Basel", revenue: 2300000, parentId: id(4), note: "Regulated - requires signed NDA before sharing pricing", active: true },
  { id: id(6), name: "Fabrikam Inc", code: "FAB-001", icon: "Factory", logo: logo("F", "#da70d6"), category: "Factory", city: "Seattle", revenue: 455000, note: "Long-unbrokentokenwithnospacestostresstesttooltipwrapping", active: true },
  { id: id(7), name: "Fabrikam Residences", code: "FAB-002", icon: "HomeGroup", category: "HomeGroup", city: "Portland", revenue: 87000, parentId: id(6), note: "Residential property management", active: false },
  { id: id(8), name: "Northwind Traders", code: "NWT-001", icon: "Balance", logo: logo("N", "#e3008c"), category: "Shop", city: "Hamburg", revenue: 312000, note: "Retail partner, dissolved 2023", active: false },
  { id: id(9), name: "Litware Legal & Compliance Advisory Partners International", code: "LIT-001", icon: "Shield", logo: logo("L", "#498205"), category: "Shield", city: "Dublin", revenue: 150000, parentId: id(4), note: "A long name, to test truncation in pills and list rows", active: true },
  { id: id(10), name: "Woodgrove Bank", code: "WGB-001", icon: "Bank", logo: logo("W", "#004e8c"), category: "Bank", city: "Frankfurt", revenue: 5100000, note: "Banking relationship", active: true },
];

const F = "@OData.Community.Display.V1.FormattedValue";

const toEntity = (f: IFixture): ComponentFramework.WebApi.Entity => {
  const parent = FIXTURES.find((p) => p.id === f.parentId);
  return {
    lops_testrecordid: f.id,
    name: f.name,
    lops_code: f.code,
    lops_icon: f.icon,
    lops_logo_url: f.logo ?? null,
    lops_category: 100000000,
    [`lops_category${F}`]: f.category,
    lops_city: f.city,
    lops_revenue: f.revenue,
    [`lops_revenue${F}`]: `€${f.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    _lops_parentid_value: f.parentId ?? null,
    [`_lops_parentid_value${F}`]: parent?.name,
    lops_note: f.note,
    lops_empty: null,
    statecode: f.active ? 0 : 1,
    [`statecode${F}`]: f.active ? "Active" : "Inactive",
  };
};

export const TEST_MODE_RECORDS: ComponentFramework.WebApi.Entity[] = FIXTURES.map(toEntity);

export const findTestRecord = (recordId: string): ComponentFramework.WebApi.Entity | undefined =>
  TEST_MODE_RECORDS.find((r) => r[TEST_MODE_PRIMARY_ID] === recordId);

// Already related when the harness loads: one record per icon path, plus the long name.
export const TEST_MODE_DEFAULT_SELECTION = [id(1), id(4), id(7), id(8), id(9)];

// Stand-in for runSearch's $filter/$orderby/$top. Text matching mirrors the live query: contains()
// on the primary name, the text Label Columns and text Additional Search Columns, and the related
// record's name for a lookup search column.
export function searchTestRecords(
  term: string,
  searchColumns: string[],
  showInactive: boolean,
  sortColumn: string,
  limit: number
): ComponentFramework.WebApi.Entity[] {
  const needle = term.trim().toLowerCase();
  const textOf = (r: ComponentFramework.WebApi.Entity, col: string): string => {
    const isLookup = TEST_MODE_ATTRIBUTE_TYPES.get(col.toLowerCase()) === "Lookup";
    const v = isLookup ? r[`_${col}_value${F}`] : r[col];
    return typeof v === "string" ? v.toLowerCase() : "";
  };
  const sortKey = sortColumn || TEST_MODE_PRIMARY_NAME;
  return TEST_MODE_RECORDS
    .filter((r) => showInactive || r.statecode === 0)
    .filter((r) => !needle || [TEST_MODE_PRIMARY_NAME, ...searchColumns].some((c) => textOf(r, c).includes(needle)))
    .slice()
    .sort((a, b) => {
      const x = a[sortKey];
      const y = b[sortKey];
      if (typeof x === "number" && typeof y === "number") return x - y;
      return String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true, sensitivity: "base" });
    })
    .slice(0, limit);
}

// Test-mode counterpart of resolveIconSync/resolveIconAsync: same chain walk, but an Image column
// holds its data URI inline and a dot-notation entry reads the parent fixture instead of fetching.
export function resolveTestIcon(candidates: IIconCandidate[], record: ComponentFramework.WebApi.Entity): IIconResult {
  for (const c of candidates) {
    if (c.kind === "fixed") return { iconValue: c.fixedValue };
    if (!c.column) continue;
    if (c.lookupFieldLogicalName) {
      const parent = findTestRecord(record[`_${c.lookupFieldLogicalName}_value`] as string);
      if (!parent) continue;
      const result = resolveTestIcon([{ ...c, lookupFieldLogicalName: undefined }], parent);
      if (result.iconValue !== undefined || result.thumbnailUrl !== undefined) return result;
      continue;
    }
    if (c.kind === "image") {
      const v = record[`${c.column}_url`] as string | null;
      if (v) return { thumbnailUrl: v };
    } else if (c.kind === "choice") {
      const label = readFormatted(record, c.column);
      if (label) return resolveChoiceIconLabel(label);
    } else {
      const v = record[c.column] as string | null;
      if (v) return { iconValue: v };
    }
  }
  return {};
}
