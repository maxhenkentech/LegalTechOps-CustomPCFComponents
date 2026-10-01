// Raw same-origin Web API helpers. Everything except the N:N section is a port of
// AdvancedLookUpControl.tsx's module-level functions (metadata, column classification, icon
// fallback chain, display columns), duplicated per this repo's no-shared-code convention - see
// src/AdvancedLookUp/CLAUDE.md for the history behind each one before "simplifying" it.

const API = "/api/data/v9.2";

const getJson = async <T>(url: string, what: string): Promise<T> => {
  const response = await fetch(url, { headers: { Accept: "application/json", "OData-MaxVersion": "4.0", "OData-Version": "4.0" } });
  if (!response.ok) throw new Error(`${what} (${response.status} ${response.statusText})`);
  return (await response.json()) as T;
};

const escapeOData = (value: string): string => value.replace(/'/g, "''");

// Table/column metadata is fixed for the life of a page, and every subgrid/tab mounts its own
// control instance that asks the same questions - so metadata GETs are shared per page session
// (the in-flight promise too, so parallel instances don't duplicate a request). A failed request is
// dropped so the next mount retries. Deliberately not sessionStorage: a maker editing columns would
// then see stale metadata after a reload. UCI keeps this bundle loaded across record navigations,
// so the cache also covers moving between records of the same table.
// Entries expire after METADATA_TTL_MS, so a schema change made while a user has the app open
// (a new column, a renamed navigation property, another N:N) reaches them within 5 minutes even
// without a refresh. Only schema is cached here - never record data.
const METADATA_TTL_MS = 5 * 60 * 1000;
const metadataCache = new Map<string, { at: number; pending: Promise<unknown> }>();
const getMetadata = <T>(url: string, what: string): Promise<T> => {
  const hit = metadataCache.get(url);
  if (hit && Date.now() - hit.at < METADATA_TTL_MS) return hit.pending as Promise<T>;
  const pending = getJson<T>(url, what);
  metadataCache.set(url, { at: Date.now(), pending });
  pending.catch(() => metadataCache.delete(url));
  return pending;
};

export interface IEntityMeta {
  logicalName: string;
  entitySetName: string;
  primaryIdAttribute: string;
  primaryNameAttribute: string;
}

export async function resolveEntityMetadata(entityLogicalName: string): Promise<IEntityMeta> {
  const data = await getMetadata<{ EntitySetName: string; PrimaryIdAttribute: string; PrimaryNameAttribute: string }>(
    `${API}/EntityDefinitions(LogicalName='${entityLogicalName}')?$select=EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute`,
    `Failed to resolve metadata for table "${entityLogicalName}"`
  );
  return { logicalName: entityLogicalName, entitySetName: data.EntitySetName, primaryIdAttribute: data.PrimaryIdAttribute, primaryNameAttribute: data.PrimaryNameAttribute };
}

export interface IAttributeInfo {
  // Logical name (lowercased) -> AttributeType: column-existence validation and the Lookup-vs-plain
  // $select key decision.
  types: Map<string, string>;
  // Lowercased logical names of Image columns (AttributeTypeName "ImageType" - AttributeType alone
  // reports them as "Virtual"). Read in the same call, so classifying Icon Column entries costs no
  // request of its own (was one filtered Attributes call per entry, sequential after the list).
  imageColumns: Set<string>;
}

export async function resolveAttributeInfo(entityLogicalName: string): Promise<IAttributeInfo> {
  const data = await getMetadata<{ value: { LogicalName: string; AttributeType?: string; AttributeTypeName?: { Value: string } }[] }>(
    `${API}/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes?$select=LogicalName,AttributeType,AttributeTypeName`,
    `Failed to resolve the columns of table "${entityLogicalName}"`
  );
  return {
    types: new Map(data.value.map((a) => [a.LogicalName.toLowerCase(), a.AttributeType || ""])),
    imageColumns: new Set(data.value.filter((a) => a.AttributeTypeName?.Value === "ImageType").map((a) => a.LogicalName.toLowerCase())),
  };
}

export async function resolveLookupTarget(entityLogicalName: string, lookupField: string): Promise<string | undefined> {
  const data = await getMetadata<{ Targets?: string[] }>(
    `${API}/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${escapeOData(lookupField)}')/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=Targets`,
    `Failed to resolve lookup field "${lookupField}"`
  );
  return data.Targets?.[0];
}

// The real single-valued navigation property of a lookup - not reliably its logical name.
export async function resolveLookupNavigationProperty(entityLogicalName: string, lookupField: string): Promise<string | undefined> {
  const data = await getMetadata<{ value: { ReferencingEntityNavigationPropertyName?: string }[] }>(
    `${API}/EntityDefinitions(LogicalName='${entityLogicalName}')/ManyToOneRelationships?$filter=ReferencingAttribute eq '${escapeOData(lookupField)}'&$select=ReferencingEntityNavigationPropertyName`,
    `Failed to resolve the navigation property of lookup "${lookupField}"`
  );
  return data.value[0]?.ReferencingEntityNavigationPropertyName;
}

export const isLookupLikeAttributeType = (type: string | undefined): boolean => type === "Lookup" || type === "Owner" || type === "Customer";
// contains() only works on String/Memo - anything else 400s the whole query.
export const isTextSearchableAttributeType = (type: string | undefined): boolean => type === "String" || type === "Memo";

// ---------------------------------------------------------------------------------------------
// N:N relationship
// ---------------------------------------------------------------------------------------------

export interface IRelationship {
  schemaName: string;
  // Collection-valued navigation property on the PARENT (form) table that lists the related records.
  navigationProperty: string;
}

interface IManyToManyMeta {
  SchemaName: string;
  Entity1LogicalName: string;
  Entity2LogicalName: string;
  Entity1NavigationPropertyName: string;
  Entity2NavigationPropertyName: string;
  IntersectEntityName: string;
}

// Picks the N:N relationship between the form's table and the subgrid's table:
//   1. Relationship Name, when the maker set it (must exist and connect these two tables);
//   2. the only N:N between the two tables;
//   3. the one whose intersect table the subgrid's own query links through (dataset.linking) -
//      on a real form this list came back without the intersect table (2026-10-01), so:
//   4. the one whose related records, read through its navigation property, are exactly the
//      subgrid's records (`probe`). An empty subgrid can't tell them apart.
// Anything else is ambiguous and reported with the candidate names, so the maker can pick one.
export async function resolveRelationship(
  parentEntity: string,
  targetEntity: string,
  configuredName: string,
  linkedEntityNames: string[],
  subgridIds: string[],
  probe?: (navigationProperty: string) => Promise<string[]>
): Promise<IRelationship> {
  const data = await getMetadata<{ value: IManyToManyMeta[] }>(
    `${API}/EntityDefinitions(LogicalName='${parentEntity}')/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,Entity1NavigationPropertyName,Entity2NavigationPropertyName,IntersectEntityName`,
    `Failed to read the N:N relationships of table "${parentEntity}"`
  );
  const connecting = data.value.filter((r) =>
    (r.Entity1LogicalName === parentEntity && r.Entity2LogicalName === targetEntity) ||
    (r.Entity2LogicalName === parentEntity && r.Entity1LogicalName === targetEntity));

  let match: IManyToManyMeta | undefined;
  if (configuredName) {
    match = data.value.find((r) => r.SchemaName.toLowerCase() === configuredName.toLowerCase());
    if (!match) throw new Error(`Relationship Name "${configuredName}" is not an N:N relationship of table "${parentEntity}".`);
    if (!connecting.includes(match)) throw new Error(`Relationship "${match.SchemaName}" does not connect "${parentEntity}" with "${targetEntity}", the table of this subgrid.`);
  } else if (connecting.length === 1) {
    match = connecting[0];
  } else if (connecting.length === 0) {
    throw new Error(`There is no N:N relationship between "${parentEntity}" and "${targetEntity}". Place this control on a subgrid of an N:N relationship.`);
  } else {
    const linked = new Set(linkedEntityNames.map((n) => n.toLowerCase()));
    const viaLink = connecting.filter((r) => linked.has(r.IntersectEntityName.toLowerCase()));
    if (viaLink.length === 1) {
      match = viaLink[0];
    } else if (probe && subgridIds.length > 0) {
      const wanted = [...subgridIds].map((id) => id.toLowerCase()).sort().join(",");
      const results = await Promise.all(connecting.map(async (r) => {
        const ids = await probe(navigationPropertyFor(r, parentEntity)).catch(() => undefined);
        return ids && ids.map((id) => id.toLowerCase()).sort().join(",") === wanted;
      }));
      const viaData = connecting.filter((_, i) => results[i]);
      if (viaData.length === 1) match = viaData[0];
    }
    if (!match) {
      throw new Error(`Several N:N relationships connect "${parentEntity}" and "${targetEntity}" - set Relationship Name to one of: ${connecting.map((r) => r.SchemaName).join(", ")}.`);
    }
  }

  return { schemaName: match.SchemaName, navigationProperty: navigationPropertyFor(match, parentEntity) };
}

// Self-referential N:N: both sides name the same table, and Entity1's navigation property is the
// one the platform's own subgrid uses.
const navigationPropertyFor = (r: IManyToManyMeta, parentEntity: string): string =>
  r.Entity1LogicalName === parentEntity ? r.Entity1NavigationPropertyName : r.Entity2NavigationPropertyName;

// Ids of the records related to the form record through one navigation property (the probe for
// resolveRelationship's data tie-breaker).
export async function listRelatedIds(parent: IEntityMeta, parentId: string, navigationProperty: string, target: IEntityMeta): Promise<string[]> {
  const data = await getJson<{ value: Record<string, string>[] }>(
    `${API}/${parent.entitySetName}(${parentId})/${navigationProperty}?$select=${target.primaryIdAttribute}`,
    `Failed to list the records related through "${navigationProperty}"`
  );
  return data.value.map((r) => r[target.primaryIdAttribute]);
}

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body?.error?.message) return body.error.message;
  } catch {
    // not JSON - fall through to the status line
  }
  return `${response.status} ${response.statusText}`;
};

const writeHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json; charset=utf-8",
  "OData-MaxVersion": "4.0",
  "OData-Version": "4.0",
};

export async function associate(parent: IEntityMeta, parentId: string, relationship: IRelationship, target: IEntityMeta, targetId: string): Promise<void> {
  const response = await fetch(`${API}/${parent.entitySetName}(${parentId})/${relationship.navigationProperty}/$ref`, {
    method: "POST",
    headers: writeHeaders,
    // @odata.id must be absolute. The control runs same-origin with the app, like every other
    // relative /api/data call in this repo.
    body: JSON.stringify({ "@odata.id": `${window.location.origin}${API}/${target.entitySetName}(${targetId})` }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
}

export async function disassociate(parent: IEntityMeta, parentId: string, relationship: IRelationship, targetId: string): Promise<void> {
  const response = await fetch(`${API}/${parent.entitySetName}(${parentId})/${relationship.navigationProperty}(${targetId})/$ref`, {
    method: "DELETE",
    headers: writeHeaders,
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
}

// ---------------------------------------------------------------------------------------------
// Icon Column fallback chain (AdvancedLookUp's IconCandidate machinery, unchanged)
// ---------------------------------------------------------------------------------------------

export type IconCandidateKind = "image" | "text" | "choice" | "fixed";
export interface IIconCandidate {
  kind: IconCandidateKind;
  column?: string;
  fixedValue?: string;
  // Set for a "<lookupField>.<column>" entry: the icon lives on the record that lookup points to.
  lookupFieldLogicalName?: string;
  lookupTargetEntityLogicalName?: string;
  lookupTargetEntitySetName?: string;
}

export interface IIconResult {
  iconValue?: string;
  thumbnailUrl?: string;
}

export function parseIconColumnRef(entry: string): { lookupFieldLogicalName?: string; columnLogicalName: string } {
  const dot = entry.indexOf(".");
  if (dot <= 0 || dot === entry.length - 1) return { columnLogicalName: entry };
  return { lookupFieldLogicalName: entry.slice(0, dot), columnLogicalName: entry.slice(dot + 1) };
}

// Semicolon-separated column list (fallback chain, or Additional Display Columns' "show all").
export function parseColumnList(value: string | undefined): string[] {
  return (value || "").split(";").map((c) => c.trim()).filter((c) => c.length > 0);
}

// A Choice option label naming an image file is a web resource; anything else an MDL2 name.
const WEB_RESOURCE_ICON_PATTERN = /\.(png|jpe?g|gif|svg|ico|bmp)$/i;

// Test-harness hook (AdvancedMultiChoice's setWebResourceUrlOverrides): the harness serves nothing
// at /webresources, so index.ts maps a few names to inline images in test mode only.
let webResourceUrlOverrides: Record<string, string> = {};
export const setWebResourceUrlOverrides = (overrides: Record<string, string>): void => {
  webResourceUrlOverrides = overrides;
};

export function resolveChoiceIconLabel(label: string): IIconResult {
  const trimmed = label.trim();
  if (!trimmed) return {};
  if (WEB_RESOURCE_ICON_PATTERN.test(trimmed)) {
    return { thumbnailUrl: webResourceUrlOverrides[trimmed.toLowerCase()] ?? `/webresources/${encodeURIComponent(trimmed)}` };
  }
  return { iconValue: trimmed };
}

export const readFormatted = (record: ComponentFramework.WebApi.Entity, key: string): string | undefined =>
  record[`${key}@OData.Community.Display.V1.FormattedValue`] as string | undefined;

// An Image column's picture URL from its "<column>_url" companion attribute: the app's own image
// handler (/Image/download.aspx?...&Timestamp=...), which the browser caches (private, 7 days; the
// Timestamp changes with the picture) - unlike /$value (no-cache, re-fetched per search). Same 144px
// thumbnail. Null when there is no picture, so an empty image costs no request. See CLAUDE.md.
const imageUrlFromRecord = (record: ComponentFramework.WebApi.Entity, column: string): string | undefined =>
  (record[`${column}_url`] as string | undefined) || undefined;

async function resolveDotNotationIcon(candidate: IIconCandidate, targetId: string): Promise<IIconResult> {
  const set = candidate.lookupTargetEntitySetName;
  const column = candidate.column;
  if (!set || !column) return {};
  // An image needs only its "_url" companion (small JSON), never the picture bytes.
  const selectKey = candidate.kind === "image" ? `${column}_url` : column;
  const response = await fetch(`${API}/${set}(${targetId})?$select=${selectKey}`, { headers: { Accept: "application/json", Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' } });
  if (!response.ok) return {};
  const record = (await response.json()) as ComponentFramework.WebApi.Entity;
  if (candidate.kind === "image") {
    const url = imageUrlFromRecord(record, column);
    return url ? { thumbnailUrl: url } : {};
  }
  if (candidate.kind === "choice") {
    const label = readFormatted(record, column);
    return label ? resolveChoiceIconLabel(label) : {};
  }
  const v = record[column] as string | undefined;
  return v ? { iconValue: v } : {};
}

// Only dot notation needs a request now: an own Image column's URL arrives with the row.
export const needsAsyncIconResolution = (candidates: IIconCandidate[]): boolean =>
  candidates.some((c) => !!c.lookupFieldLogicalName);

// Only valid when needsAsyncIconResolution is false.
export function resolveIconSync(candidates: IIconCandidate[], record: ComponentFramework.WebApi.Entity): IIconResult {
  for (const c of candidates) {
    if (c.kind === "fixed") return { iconValue: c.fixedValue };
    if (c.lookupFieldLogicalName || !c.column) continue;
    if (c.kind === "text") {
      const v = record[c.column] as string | undefined;
      if (v) return { iconValue: v };
    } else if (c.kind === "choice") {
      const label = readFormatted(record, c.column);
      if (label) return resolveChoiceIconLabel(label);
    } else if (c.kind === "image") {
      const url = imageUrlFromRecord(record, c.column);
      if (url) return { thumbnailUrl: url };
    }
  }
  return {};
}

// Walks the chain in order; image and dot-notation entries need a fetch to know whether they are
// empty. The cache de-dupes rows that point at the same related record (in-flight promises too).
export async function resolveIconAsync(
  candidates: IIconCandidate[],
  record: ComponentFramework.WebApi.Entity,
  entitySetName: string,
  recordId: string,
  cache: Map<string, Promise<IIconResult>>
): Promise<IIconResult> {
  for (const c of candidates) {
    if (c.kind === "fixed") return { iconValue: c.fixedValue };
    if (c.lookupFieldLogicalName) {
      const targetId = record[`_${c.lookupFieldLogicalName}_value`] as string | undefined;
      if (!targetId) continue;
      const key = `${c.lookupTargetEntityLogicalName}::${targetId}::${c.column}::${c.kind}`;
      let pending = cache.get(key);
      if (!pending) {
        pending = resolveDotNotationIcon(c, targetId);
        cache.set(key, pending);
      }
      const result = await pending;
      if (result.iconValue !== undefined || result.thumbnailUrl !== undefined) return result;
      continue;
    }
    if (!c.column) continue;
    if (c.kind === "text") {
      const v = record[c.column] as string | undefined;
      if (v) return { iconValue: v };
    } else if (c.kind === "choice") {
      const label = readFormatted(record, c.column);
      if (label) return resolveChoiceIconLabel(label);
    } else if (c.kind === "image") {
      const url = imageUrlFromRecord(record, c.column);
      if (url) return { thumbnailUrl: url };
    }
  }
  return {};
}

// ---------------------------------------------------------------------------------------------
// Label / tooltip / display columns
// ---------------------------------------------------------------------------------------------

// `_col_value` for a Lookup-like column, the bare name for everything else.
export function selectKey(column: string, attributeTypes: Map<string, string> | undefined): string {
  return isLookupLikeAttributeType(attributeTypes?.get(column.toLowerCase())) ? `_${column}_value` : column;
}

export function buildSelectColumns(
  meta: IEntityMeta,
  iconCandidates: IIconCandidate[],
  tooltipColumns: string[],
  labelColumns: string[],
  displayColumns: string[],
  attributeTypes: Map<string, string> | undefined
): string[] {
  const cols = new Set<string>([meta.primaryIdAttribute, meta.primaryNameAttribute]);
  iconCandidates.forEach((c) => {
    if (c.lookupFieldLogicalName) cols.add(`_${c.lookupFieldLogicalName}_value`);
    else if ((c.kind === "text" || c.kind === "choice") && c.column) cols.add(c.column);
    else if (c.kind === "image" && c.column) cols.add(`${c.column}_url`);
  });
  [...tooltipColumns, ...labelColumns, ...displayColumns].forEach((c) => cols.add(selectKey(c, attributeTypes)));
  return Array.from(cols);
}

// Formatted value first (choice label, lookup name, currency, localized date/number), then raw.
function readColumnText(record: ComponentFramework.WebApi.Entity, column: string, attributeTypes: Map<string, string> | undefined): string | undefined {
  const key = selectKey(column, attributeTypes);
  const formatted = readFormatted(record, key);
  if (formatted) return formatted;
  const raw = record[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  return String(raw);
}

// First non-empty column wins (Label/Tooltip Column fallback chains).
export function firstColumnText(record: ComponentFramework.WebApi.Entity, columns: string[], attributeTypes: Map<string, string> | undefined): string | undefined {
  for (const c of columns) {
    const v = readColumnText(record, c, attributeTypes);
    if (v) return v;
  }
  return undefined;
}

// Every column shown, joined (Additional Display Columns).
export function buildContextText(record: ComponentFramework.WebApi.Entity, columns: string[], attributeTypes: Map<string, string> | undefined): string | undefined {
  const parts = columns.map((c) => readColumnText(record, c, attributeTypes)).filter((v): v is string => !!v);
  return parts.length ? parts.join(" · ") : undefined;
}
