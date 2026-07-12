import * as React from "react";
import { Icon } from "@fluentui/react/lib/Icon";
import { Callout } from "@fluentui/react/lib/Callout";
import {
  TEST_MODE_CHOICE_COLORS,
  TEST_MODE_CURRENT_RECORD_ID,
  TEST_MODE_ENTITY_LOGICAL_NAME,
  TEST_MODE_ICON_NAMES,
  TEST_MODE_QUICK_VIEW_COLUMNS,
  TEST_MODE_RECORDS,
  TEST_MODE_THUMBNAIL_DATA_URI,
  ITestModeRecord,
} from "./TestModeData";

const MAX_TOTAL_NODES = 250;

interface IAttributeValue {
  text: string;
  lookup?: { entityLogicalName: string; id: string };
  // base64 is the low-res thumbnail Dataverse embeds directly in a $select response for an Image
  // column - entityLogicalName/recordId/logicalName (when known - i.e. not test mode) let the
  // callout fetch the full-resolution original via the model-driven app's own image handler
  // instead, for a sharper enlarged view (see formatAttributeValue's ImageType branch for why the
  // Web API's /$value endpoint doesn't actually give a higher-resolution copy).
  image?: { base64: string; entityLogicalName?: string; recordId?: string; logicalName?: string };
  file?: { fileName: string; downloadUrl: string };
  choiceColor?: string;
}

interface IAttributeMeta {
  logicalName: string;
  attributeType: string;
  attributeTypeName?: string;
  dateFormat?: string;
}

// raw is the value actually compared (a number for Money/WholeNumber/Decimal, an ISO date string
// for DateTime, a Lookup/Customer/Owner GUID, etc.); text is the FormattedValue fallback used for
// anything that isn't numeric/date-shaped (Lookup names, Choice labels, plain text) - see
// compareSortValues.
interface ISortValue {
  raw: unknown;
  text: string;
}

interface ITreeRecord {
  id: string;
  entityLogicalName: string;
  name: string;
  parentId?: string;
  isActive: boolean;
  stateLabel: string;
  attr1?: IAttributeValue;
  attr2?: IAttributeValue;
  attr3?: IAttributeValue;
  // Set only when thumbnailColumnName resolves to a text column instead of an Image column - the
  // raw MDL2 icon name string, rendered via Thumbnail instead of a fetched image.
  thumbnailIconName?: string;
  // Set only when sortByColumnName is configured - used to order records within the same tree
  // level (buildVirtualRoots), never rendered directly.
  sortValue?: ISortValue;
}

interface IDescendantNode {
  record: ITreeRecord;
  children: IDescendantNode[];
}

interface IVNode {
  record: ITreeRecord;
  isCurrent: boolean;
  children: IVNode[];
}

interface IEntityMeta {
  entitySetName: string;
  primaryIdAttribute: string;
  primaryNameAttribute: string;
}

interface IQuickViewField {
  logicalName: string;
  label: string;
}

// One <section> of a form's <column>, in document order. tabIndex/columnIndex identify which
// tab/column this section's fields came from (tabIndex -1 = a control found outside any <column>,
// e.g. a header field, or the common case of a Quick View Form that doesn't wrap its fields in a
// <tabs>/<columns> structure at all); widthPercent is read from the column's own "width" attribute
// so the expandable panel can mirror the form's actual column proportions, not just an even split.
// sectionLabel is only populated when the section's own label should actually be shown - i.e. the
// section has showlabel="true" and a non-empty label (hidden fields/sections never make it into a
// group at all - see isFormElementHidden).
interface IQuickViewSectionGroup {
  tabIndex: number;
  columnIndex: number;
  widthPercent?: number;
  sectionLabel?: string;
  fields: IQuickViewField[];
}

interface IQuickViewEntry {
  status: "loading" | "ready" | "error";
  valuesByField?: Record<string, IAttributeValue>;
  error?: string;
}

export interface IRelationshipViewProps {
  parentLookupProperty: ComponentFramework.PropertyTypes.LookupProperty;
  showState: boolean;
  showInactiveRecords: boolean;
  maxParentLevels: number;
  maxChildLevels: number;
  siblingDisplay: string;
  sortByColumnName?: string;
  sortDirection: string;
  customAttribute1?: string;
  customAttribute2?: string;
  customAttribute3?: string;
  thumbnailColumnName?: string;
  thumbnailStyle: string;
  thumbnailRenderingOption: string;
  quickViewFormName?: string;
  choiceColorDisplay: string;
  currentRecordHighlightColor: string;
  indentation: string;
  webAPI: ComponentFramework.WebApi;
  navigation: ComponentFramework.Navigation;
  mode: ComponentFramework.Mode;
  utils: ComponentFramework.Utility;
  isTestMode: boolean;
}

function resolveCurrentRecordContext(
  mode: ComponentFramework.Mode,
  utils: ComponentFramework.Utility
): { entityTypeName?: string; entityId?: string } {
  // Neither of these is part of the published PCF typings; both are populated at runtime on a
  // real model-driven form (mirrors the fallback approach AdvancedOptionsControl.tsx uses for
  // the same problem).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modeAny = mode as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const utilsAny = utils as any;

  let entityTypeName: string | undefined = modeAny?.contextInfo?.entityTypeName;
  let entityId: string | undefined = modeAny?.contextInfo?.entityId;

  if (!entityTypeName || !entityId) {
    const page = utilsAny?.page;
    entityTypeName = entityTypeName || page?.entityTypeName;
    entityId = entityId || page?.entityId;
  }

  return { entityTypeName, entityId };
}

async function resolveEntityMetadata(entityLogicalName: string): Promise<IEntityMeta> {
  const url = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')?$select=EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to resolve entity metadata (${response.status} ${response.statusText})`);
  }
  const data = (await response.json()) as {
    EntitySetName: string;
    PrimaryIdAttribute: string;
    PrimaryNameAttribute: string;
  };
  return { entitySetName: data.EntitySetName, primaryIdAttribute: data.PrimaryIdAttribute, primaryNameAttribute: data.PrimaryNameAttribute };
}

async function resolveAttributeMetadata(entityLogicalName: string, logicalNames: string[]): Promise<Record<string, IAttributeMeta>> {
  const uniqueNames = Array.from(new Set(logicalNames));
  if (uniqueNames.length === 0) return {};

  const filter = uniqueNames.map((name) => `LogicalName eq '${name.replace(/'/g, "''")}'`).join(" or ");
  // AttributeTypeName distinguishes File/Image columns - both report AttributeType "Virtual",
  // with AttributeTypeName.Value being "FileType" or "ImageType" respectively.
  const url = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes?$select=LogicalName,AttributeType,AttributeTypeName&$filter=${filter}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to resolve attribute metadata (${response.status} ${response.statusText})`);
  }
  const data = (await response.json()) as {
    value: { LogicalName: string; AttributeType: string; AttributeTypeName?: { Value: string } }[];
  };

  const result: Record<string, IAttributeMeta> = {};
  data.value.forEach((a) => {
    result[a.LogicalName] = { logicalName: a.LogicalName, attributeType: a.AttributeType, attributeTypeName: a.AttributeTypeName?.Value };
  });

  // DateTime's date-only-vs-date-and-time distinction lives on a derived metadata type, so it
  // needs one extra cast query per DateTime attribute found above.
  const dateTimeNames = Object.values(result)
    .filter((a) => a.attributeType === "DateTime")
    .map((a) => a.logicalName);

  await Promise.all(
    dateTimeNames.map(async (name) => {
      const formatUrl = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${name}')/Microsoft.Dynamics.CRM.DateTimeAttributeMetadata?$select=Format`;
      const formatResponse = await fetch(formatUrl, { headers: { Accept: "application/json" } });
      if (formatResponse.ok) {
        const formatData = (await formatResponse.json()) as { Format: string };
        result[name].dateFormat = formatData.Format;
      }
    })
  );

  return result;
}

// Formats one attribute's value per its Dataverse type: Lookup/Customer/Owner become a clickable
// {name, target} pair (read from the "_<name>_value" keys Dataverse returns for lookups, not
// "<name>"); Money is rebuilt as "<symbol> <value>" (the platform's own FormattedValue doesn't
// reliably put a space there); DateTime is reformatted from the raw value using the browser's
// locale, since FormattedValue reflects the server/org's date settings, not the viewer's. Every
// other type (choice/status/text/number/etc.) already gets a correct label from FormattedValue.
function formatAttributeValue(
  record: ComponentFramework.WebApi.Entity,
  logicalName: string,
  meta: IAttributeMeta | undefined,
  entityLogicalName: string,
  entitySetName: string,
  recordId: string,
  choiceColors: Record<string, Record<number, string>> = {}
): IAttributeValue | undefined {
  const type = meta?.attributeType;

  if (type === "Lookup" || type === "Customer" || type === "Owner") {
    const valueKey = `_${logicalName}_value`;
    const id = record[valueKey] as string | undefined;
    if (!id) return undefined;
    const name = record[`${valueKey}@OData.Community.Display.V1.FormattedValue`] as string | undefined;
    const targetEntity = record[`${valueKey}@Microsoft.Dynamics.CRM.lookuplogicalname`] as string | undefined;
    return { text: name ?? id, lookup: targetEntity ? { entityLogicalName: targetEntity, id } : undefined };
  }

  // Image columns come back as base64 content directly in $select results (unlike File columns,
  // which only expose their "_name" companion field this way - the bytes need /$value) - but that
  // embedded base64 is a small, compressed preview, not the original upload. The actual full-
  // resolution image is served by the model-driven app's own image handler, NOT the Web API's
  // /$value endpoint (confirmed by comparing against the URL the real form's "view image" link
  // uses: /Image/download.aspx?Entity=<logical name>&Attribute=<column>&Id=<id>&Full=true) - so
  // entityLogicalName/recordId/logicalName are carried along for ImageAttributeValue to build that
  // URL on demand instead of only ever showing the low-res preview enlarged.
  if (meta?.attributeTypeName === "ImageType") {
    const base64 = record[logicalName] as string | undefined;
    return base64 ? { text: "", image: { base64, entityLogicalName, recordId, logicalName } } : undefined;
  }

  if (meta?.attributeTypeName === "FileType") {
    const fileName = record[`${logicalName}_name`] as string | undefined;
    if (!fileName) return undefined;
    return { text: fileName, file: { fileName, downloadUrl: `/api/data/v9.2/${entitySetName}(${recordId})/${logicalName}/$value` } };
  }

  const rawValue = record[logicalName];
  if (rawValue === undefined || rawValue === null) return undefined;
  const formatted = record[`${logicalName}@OData.Community.Display.V1.FormattedValue`] as string | undefined;

  if (type === "Money") {
    const numeric = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!isNaN(numeric)) {
      const numberText = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
      const symbolMatch = formatted?.match(/^-?\s*([^\d\s.,+-]+)/);
      const symbol = symbolMatch?.[1];
      return { text: symbol ? `${symbol} ${numberText}` : numberText };
    }
  }

  if (type === "DateTime") {
    const date = new Date(rawValue as string);
    if (!isNaN(date.getTime())) {
      const options: Intl.DateTimeFormatOptions =
        meta?.dateFormat === "DateOnly" ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" };
      return { text: new Intl.DateTimeFormat(undefined, options).format(date) };
    }
  }

  if (type === "Picklist" && typeof rawValue === "number") {
    const color = choiceColors[logicalName]?.[rawValue];
    if (color) return { text: formatted ?? String(rawValue), choiceColor: color };
  }

  return { text: formatted ?? String(rawValue) };
}

// Fetches the option colors for a set of Choice (Picklist) attributes, keyed by logical name and
// then by numeric option value. Options without an explicitly configured color are omitted -
// there is nothing to display for those, so callers should treat a missing entry as "no color".
// Reuses the same PicklistAttributeMetadata + $expand=OptionSet endpoint AdvancedDropDown already
// uses for its ExternalValue-as-icon feature, just reading Color instead.
async function resolveChoiceColors(entityLogicalName: string, logicalNames: string[]): Promise<Record<string, Record<number, string>>> {
  const uniqueNames = Array.from(new Set(logicalNames));
  const result: Record<string, Record<number, string>> = {};

  await Promise.all(
    uniqueNames.map(async (name) => {
      const url = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${name}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$expand=OptionSet`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) return;
      const data = (await response.json()) as { OptionSet?: { Options?: { Value: number; Color?: string }[] } };
      const options = data.OptionSet?.Options;
      if (!options) return;
      const map: Record<number, string> = {};
      options.forEach((opt) => {
        if (opt.Color) map[opt.Value] = opt.Color;
      });
      result[name] = map;
    })
  );

  return result;
}

// Dataverse's Web API only allows $select-ing a Lookup/Customer/Owner attribute via its
// "_<logicalname>_value" bound-value form - the plain logical name is a navigation property
// (valid for $expand only) and is either rejected outright or silently returns nothing useful
// via $select. Shared by every place that builds a $select clause, including Quick View fields.
// A logical name can expand to more than one $select entry: a File column has no directly
// selectable content (only its "<name>_name" companion field, used for the download link's
// file name - the bytes themselves come from the /$value endpoint, same as PDFGallery's PDFs).
function toWebApiSelectFields(logicalName: string, attributeMeta: Record<string, IAttributeMeta>): string[] {
  const meta = attributeMeta[logicalName];
  if (meta?.attributeType === "Lookup" || meta?.attributeType === "Customer" || meta?.attributeType === "Owner") {
    return [`_${logicalName}_value`];
  }
  if (meta?.attributeTypeName === "FileType") {
    return [`${logicalName}_name`];
  }
  return [logicalName];
}

// thumbnailColumnName is only added to the $select when it resolves to a text column (icon-name
// mode) - an Image-column thumbnail is deliberately NOT selected here, since its bytes are already
// fetched lazily per-visible-record via fetchThumbnailUrl; embedding it here too would pull a
// base64 blob into every single row of the tree/ancestor/descendant/sibling queries.
function buildSelectClause(
  primaryNameAttribute: string,
  parentAttributeLogicalName: string,
  customAttributes: (string | undefined)[],
  attributeMeta: Record<string, IAttributeMeta>,
  thumbnailColumnName: string | undefined,
  sortByColumnName: string | undefined
): string {
  const fixedFields = [primaryNameAttribute, "statecode", `_${parentAttributeLogicalName}_value`];
  const customFields = customAttributes
    .filter((value): value is string => !!value)
    .flatMap((value) => toWebApiSelectFields(value, attributeMeta));
  const thumbnailFields =
    thumbnailColumnName && attributeMeta[thumbnailColumnName]?.attributeType === "String"
      ? toWebApiSelectFields(thumbnailColumnName, attributeMeta)
      : [];
  const sortFields = sortByColumnName ? toWebApiSelectFields(sortByColumnName, attributeMeta) : [];
  return [...fixedFields, ...customFields, ...thumbnailFields, ...sortFields].join(",");
}

// Reads the value used to sort records within the same tree level. Lookup/Customer/Owner read
// from the "_<name>_value" bound-value key (same reasoning as toWebApiSelectFields - the plain key
// only exists as a navigation property). raw is kept as-is (a number for Money/WholeNumber/
// Decimal, an ISO date string for DateTime) so compareSortValues can compare those numerically/
// chronologically instead of as text; text is the FormattedValue annotation, used for anything
// that isn't numeric/date-shaped (a Lookup's raw GUID or a Choice's raw option number would sort
// meaninglessly on their own).
function readSortValue(record: ComponentFramework.WebApi.Entity, logicalName: string, meta: IAttributeMeta | undefined): ISortValue | undefined {
  const isLookupLike = meta?.attributeType === "Lookup" || meta?.attributeType === "Customer" || meta?.attributeType === "Owner";
  const valueKey = isLookupLike ? `_${logicalName}_value` : logicalName;
  const raw = record[valueKey];
  if (raw === undefined || raw === null) return undefined;
  const formatted = record[`${valueKey}@OData.Community.Display.V1.FormattedValue`] as string | undefined;
  return { raw, text: formatted ?? String(raw) };
}

// undefined sortValue sorts last regardless of direction (dir is applied by the caller to the
// non-undefined cases only) - a record with no value for the sort column shouldn't jump to the
// top just because "Descending" was picked.
function compareSortValues(a: ISortValue | undefined, b: ISortValue | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  if (typeof a.raw === "number" && typeof b.raw === "number") return a.raw - b.raw;
  if (typeof a.raw === "string" && typeof b.raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(a.raw) && /^\d{4}-\d{2}-\d{2}/.test(b.raw)) {
    const aDate = Date.parse(a.raw);
    const bDate = Date.parse(b.raw);
    if (!isNaN(aDate) && !isNaN(bDate)) return aDate - bDate;
  }
  return a.text.localeCompare(b.text, undefined, { numeric: true, sensitivity: "base" });
}

function mapWebApiRecordToTreeRecord(
  record: ComponentFramework.WebApi.Entity,
  entityLogicalName: string,
  id: string,
  primaryNameAttribute: string,
  parentAttributeLogicalName: string,
  attributeMeta: Record<string, IAttributeMeta>,
  entitySetName: string,
  customAttribute1?: string,
  customAttribute2?: string,
  customAttribute3?: string,
  thumbnailColumnName?: string,
  sortByColumnName?: string
): ITreeRecord {
  const stateRaw = record.statecode as number | undefined;
  const stateFormatted = record["statecode@OData.Community.Display.V1.FormattedValue"] as string | undefined;
  const parentRef = record[`_${parentAttributeLogicalName}_value`] as string | undefined;

  const readAttr = (logicalName?: string): IAttributeValue | undefined => {
    if (!logicalName) return undefined;
    return formatAttributeValue(record, logicalName, attributeMeta[logicalName], entityLogicalName, entitySetName, id);
  };

  const thumbnailIconName =
    thumbnailColumnName && attributeMeta[thumbnailColumnName]?.attributeType === "String"
      ? (record[thumbnailColumnName] as string | undefined)
      : undefined;

  return {
    id,
    entityLogicalName,
    name: (record[primaryNameAttribute] as string) ?? "(no name)",
    parentId: parentRef || undefined,
    isActive: stateRaw === 0,
    stateLabel: stateFormatted ?? (stateRaw === 0 ? "Active" : "Inactive"),
    attr1: readAttr(customAttribute1),
    attr2: readAttr(customAttribute2),
    attr3: readAttr(customAttribute3),
    thumbnailIconName: thumbnailIconName || undefined,
    sortValue: sortByColumnName ? readSortValue(record, sortByColumnName, attributeMeta[sortByColumnName]) : undefined,
  };
}

async function walkAncestors(
  webAPI: ComponentFramework.WebApi,
  entityLogicalName: string,
  startParentId: string,
  selectClause: string,
  primaryNameAttribute: string,
  parentAttributeLogicalName: string,
  attributeMeta: Record<string, IAttributeMeta>,
  entitySetName: string,
  customAttribute1: string | undefined,
  customAttribute2: string | undefined,
  customAttribute3: string | undefined,
  thumbnailColumnName: string | undefined,
  sortByColumnName: string | undefined,
  maxLevels: number,
  visited: Set<string>,
  budget: { remaining: number }
): Promise<ITreeRecord[]> {
  const result: ITreeRecord[] = [];
  let currentId: string | undefined = startParentId;
  let levels = 0;

  while (currentId && budget.remaining > 0 && (maxLevels === -1 || levels < maxLevels)) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    budget.remaining--;

    const record = await webAPI.retrieveRecord(entityLogicalName, currentId, `?$select=${selectClause}`);
    const mapped = mapWebApiRecordToTreeRecord(
      record,
      entityLogicalName,
      currentId,
      primaryNameAttribute,
      parentAttributeLogicalName,
      attributeMeta,
      entitySetName,
      customAttribute1,
      customAttribute2,
      customAttribute3,
      thumbnailColumnName,
      sortByColumnName
    );
    result.unshift(mapped);
    currentId = mapped.parentId;
    levels++;
  }

  return result;
}

async function walkDescendants(
  webAPI: ComponentFramework.WebApi,
  entityLogicalName: string,
  parentId: string,
  primaryIdAttribute: string,
  selectClause: string,
  primaryNameAttribute: string,
  parentAttributeLogicalName: string,
  attributeMeta: Record<string, IAttributeMeta>,
  entitySetName: string,
  customAttribute1: string | undefined,
  customAttribute2: string | undefined,
  customAttribute3: string | undefined,
  thumbnailColumnName: string | undefined,
  sortByColumnName: string | undefined,
  maxLevels: number,
  level: number,
  visited: Set<string>,
  budget: { remaining: number },
  includeInactive: boolean
): Promise<IDescendantNode[]> {
  if (budget.remaining <= 0) return [];
  if (maxLevels !== -1 && level >= maxLevels) return [];

  // includeInactive=false prunes inactive records - and, since they're never fetched, their whole
  // subtree along with them - directly at the query, rather than fetching then discarding, so an
  // inactive branch never counts against the MAX_TOTAL_NODES budget either.
  const filter = includeInactive
    ? `_${parentAttributeLogicalName}_value eq ${parentId}`
    : `_${parentAttributeLogicalName}_value eq ${parentId} and statecode eq 0`;
  const response = await webAPI.retrieveMultipleRecords(entityLogicalName, `?$select=${selectClause}&$filter=${filter}`);

  const nodes: IDescendantNode[] = [];
  for (const record of response.entities) {
    if (budget.remaining <= 0) break;
    const id = record[primaryIdAttribute] as string;
    if (!id || visited.has(id)) continue;
    visited.add(id);
    budget.remaining--;

    const mapped = mapWebApiRecordToTreeRecord(
      record,
      entityLogicalName,
      id,
      primaryNameAttribute,
      parentAttributeLogicalName,
      attributeMeta,
      entitySetName,
      customAttribute1,
      customAttribute2,
      customAttribute3,
      thumbnailColumnName,
      sortByColumnName
    );
    const children = await walkDescendants(
      webAPI,
      entityLogicalName,
      id,
      primaryIdAttribute,
      selectClause,
      primaryNameAttribute,
      parentAttributeLogicalName,
      attributeMeta,
      entitySetName,
      customAttribute1,
      customAttribute2,
      customAttribute3,
      thumbnailColumnName,
      sortByColumnName,
      maxLevels,
      level + 1,
      visited,
      budget,
      includeInactive
    );
    nodes.push({ record: mapped, children });
  }

  return nodes;
}

// "Sister" records: other records sharing the current record's own immediate parent (siblingId
// itself is excluded implicitly - it's already in the shared visited set before this runs).
// includeChildren=false (siblingDisplay "DirectOnly") stops at the sister records themselves;
// includeChildren=true (siblingDisplay "SistersAndChildren") also walks each sister's own
// descendant tree via the same walkDescendants used for the current record's own children,
// sharing the same visited/budget guards.
async function fetchSiblings(
  webAPI: ComponentFramework.WebApi,
  entityLogicalName: string,
  parentId: string,
  primaryIdAttribute: string,
  selectClause: string,
  primaryNameAttribute: string,
  parentAttributeLogicalName: string,
  attributeMeta: Record<string, IAttributeMeta>,
  entitySetName: string,
  customAttribute1: string | undefined,
  customAttribute2: string | undefined,
  customAttribute3: string | undefined,
  thumbnailColumnName: string | undefined,
  sortByColumnName: string | undefined,
  includeChildren: boolean,
  maxChildLevels: number,
  visited: Set<string>,
  budget: { remaining: number },
  includeInactive: boolean
): Promise<IDescendantNode[]> {
  if (budget.remaining <= 0) return [];

  const filter = includeInactive
    ? `_${parentAttributeLogicalName}_value eq ${parentId}`
    : `_${parentAttributeLogicalName}_value eq ${parentId} and statecode eq 0`;
  const response = await webAPI.retrieveMultipleRecords(entityLogicalName, `?$select=${selectClause}&$filter=${filter}`);

  const nodes: IDescendantNode[] = [];
  for (const record of response.entities) {
    if (budget.remaining <= 0) break;
    const id = record[primaryIdAttribute] as string;
    if (!id || visited.has(id)) continue;
    visited.add(id);
    budget.remaining--;

    const mapped = mapWebApiRecordToTreeRecord(
      record,
      entityLogicalName,
      id,
      primaryNameAttribute,
      parentAttributeLogicalName,
      attributeMeta,
      entitySetName,
      customAttribute1,
      customAttribute2,
      customAttribute3,
      thumbnailColumnName,
      sortByColumnName
    );

    const children = includeChildren
      ? await walkDescendants(
          webAPI,
          entityLogicalName,
          id,
          primaryIdAttribute,
          selectClause,
          primaryNameAttribute,
          parentAttributeLogicalName,
          attributeMeta,
          entitySetName,
          customAttribute1,
          customAttribute2,
          customAttribute3,
          thumbnailColumnName,
          sortByColumnName,
          maxChildLevels,
          0,
          visited,
          budget,
          includeInactive
        )
      : [];

    nodes.push({ record: mapped, children });
  }

  return nodes;
}

// A tab/section/cell can each carry visible="false" in FormXML (used for JS/business-rule
// controlled show-hide, e.g. Case form's success/failure outcome sections) - absence of the
// attribute means visible. Checked up the whole ancestor chain, not just the element itself,
// since a section nested in a hidden tab is just as invisible as one hidden directly.
function isFormElementHidden(el: Element): boolean {
  let current: Element | null = el;
  while (current) {
    if (current.getAttribute("visible") === "false") return true;
    current = current.parentElement;
  }
  return false;
}

// Walks a form's parsed FormXML for <control datafieldname="..."> elements, grouping them by the
// <tab>/<column>/<section> they live in (in document order) so the caller can reproduce the
// form's own layout instead of flattening everything into one list. A control with no <column>
// ancestor (a header field, or a Quick View Form that doesn't use the <tabs>/<columns> wrapper at
// all) is bucketed into a synthetic tabIndex -1 / columnIndex 0 group instead of being dropped.
function parseFormLayout(doc: XMLDocument): IQuickViewSectionGroup[] {
  const groups: IQuickViewSectionGroup[] = [];
  const groupsByKey = new Map<string, IQuickViewSectionGroup>();
  const tabIndexByElement = new Map<Element, number>();
  const sectionKeyByElement = new Map<Element, string>();
  const sectionOrdinalByColumnKey = new Map<string, number>();
  let nextTabIndex = 0;
  const seen = new Set<string>();

  Array.from(doc.getElementsByTagName("control")).forEach((control) => {
    const dataFieldName = control.getAttribute("datafieldname");
    if (!dataFieldName || seen.has(dataFieldName)) return;
    // A hidden field (cell/section/column/tab marked visible="false") shouldn't appear at all,
    // not just have its section header suppressed - checked before marking "seen" so a later,
    // visible occurrence of the same field elsewhere on the form still gets picked up.
    if (isFormElementHidden(control)) return;
    seen.add(dataFieldName);

    const cell = control.closest("cell");
    const labelEl = cell?.getElementsByTagName("label")[0];
    const label = labelEl?.getAttribute("description") || dataFieldName;

    const column = control.closest("column");
    let tabIndex = -1;
    let columnIndex = 0;
    let widthPercent: number | undefined;

    if (column) {
      const tab = control.closest("tab");
      if (tab) {
        let resolvedTabIndex = tabIndexByElement.get(tab);
        if (resolvedTabIndex === undefined) {
          resolvedTabIndex = nextTabIndex++;
          tabIndexByElement.set(tab, resolvedTabIndex);
        }
        tabIndex = resolvedTabIndex;
      }
      const columnSiblings = Array.from(column.parentElement?.children ?? []).filter((c) => c.tagName === "column");
      columnIndex = Math.max(0, columnSiblings.indexOf(column));
      const widthAttr = column.getAttribute("width");
      widthPercent = widthAttr?.endsWith("%") ? parseFloat(widthAttr) : undefined;
    }

    const columnKey = `${tabIndex}-${columnIndex}`;
    const section = control.closest("section");
    let groupKey = columnKey;

    if (section) {
      let sectionKey = sectionKeyByElement.get(section);
      if (sectionKey === undefined) {
        const ordinal = sectionOrdinalByColumnKey.get(columnKey) ?? 0;
        sectionOrdinalByColumnKey.set(columnKey, ordinal + 1);
        sectionKey = `${columnKey}-s${ordinal}`;
        sectionKeyByElement.set(section, sectionKey);
      }
      groupKey = sectionKey;
    }

    let group = groupsByKey.get(groupKey);
    if (!group) {
      // The section itself can't be hidden here - a hidden section's controls were already
      // filtered out above, so this group would never have been created in the first place.
      let sectionLabel: string | undefined;
      if (section) {
        const rawLabel = section.getElementsByTagName("label")[0]?.getAttribute("description");
        if (section.getAttribute("showlabel") === "true" && rawLabel) {
          sectionLabel = rawLabel;
        }
      }
      group = { tabIndex, columnIndex, widthPercent, sectionLabel, fields: [] };
      groupsByKey.set(groupKey, group);
      groups.push(group);
    }
    group.fields.push({ logicalName: dataFieldName, label });
  });

  return groups;
}

function flattenQuickViewFields(layout: IQuickViewSectionGroup[]): IQuickViewField[] {
  return layout.flatMap((group) => group.fields);
}

async function resolveQuickViewFields(
  webAPI: ComponentFramework.WebApi,
  entityLogicalName: string,
  quickViewFormName: string
): Promise<IQuickViewSectionGroup[]> {
  const escapedName = quickViewFormName.replace(/'/g, "''");
  // Deliberately not filtering by systemform's "type" choice here - its numeric value for
  // "Quick View Form" isn't consistent/documented enough to hardcode reliably, and a Main Form's
  // name is also accepted (its FormXML uses the identical <column>/<cell>/<control> schema).
  // Every form matching the name+entity is fetched, and the one whose type's own FormattedValue
  // label reads "Quick View Form" is picked - falling back to the first match otherwise.
  const filter = `name eq '${escapedName}' and objecttypecode eq '${entityLogicalName}'`;
  const response = await webAPI.retrieveMultipleRecords("systemform", `?$select=formxml,type&$filter=${filter}`);
  console.log(
    `[RelationshipView] systemform lookup for name="${quickViewFormName}" objecttypecode="${entityLogicalName}" returned ${response.entities.length} row(s):`,
    response.entities.map((e) => ({ formid: e.formid, type: e.type, typeLabel: e["type@OData.Community.Display.V1.FormattedValue"] }))
  );

  if (response.entities.length === 0) {
    throw new Error(`No form named "${quickViewFormName}" was found on ${entityLogicalName}.`);
  }

  const quickViewForm =
    response.entities.find((e) => e["type@OData.Community.Display.V1.FormattedValue"] === "Quick View Form") ?? response.entities[0];

  const formXml = quickViewForm.formxml as string;
  const doc = new DOMParser().parseFromString(formXml, "application/xml");
  const layout = parseFormLayout(doc);

  console.log(
    `[RelationshipView] parsed ${flattenQuickViewFields(layout).length} field(s) across ${layout.length} column group(s) from the form FormXML:`,
    layout
  );
  return layout;
}

async function fetchQuickViewValues(
  webAPI: ComponentFramework.WebApi,
  entityLogicalName: string,
  id: string,
  fields: IQuickViewField[],
  attributeMeta: Record<string, IAttributeMeta>,
  entitySetName: string,
  choiceColors: Record<string, Record<number, string>>
): Promise<Record<string, IAttributeValue>> {
  const select = fields.flatMap((f) => toWebApiSelectFields(f.logicalName, attributeMeta)).join(",");
  const record = await webAPI.retrieveRecord(entityLogicalName, id, `?$select=${select}`);
  const result: Record<string, IAttributeValue> = {};
  fields.forEach((f) => {
    result[f.logicalName] = formatAttributeValue(
      record,
      f.logicalName,
      attributeMeta[f.logicalName],
      entityLogicalName,
      entitySetName,
      id,
      choiceColors
    ) ?? {
      text: "",
    };
  });
  return result;
}

// Rendering options that need the image's real aspect ratio to look right. Dataverse's default
// image-column $value is a SQUARE center-cropped 144px thumbnail (crops a wide/tall image to a
// square before it ever reaches the browser - see fetchThumbnailUrl), so for these modes we must
// request the full-sized original instead, otherwise "Fit Width"/"Fit Height"/"Contain" all
// operate on an already-square image and can't reproduce the original shape (naturalWidth ===
// naturalHeight === 1 ratio). Cover/Stretch/Tile fill the square frame regardless, so the cheaper
// thumbnail is fine (and avoids fetching a potentially large full-sized image per row).
const ASPECT_SENSITIVE_RENDERING_OPTIONS = new Set(["Contain", "Center", "FitWidth", "FitHeight"]);

async function fetchThumbnailUrl(
  entitySetName: string,
  id: string,
  thumbnailColumnName: string,
  preferFullSize: boolean
): Promise<string | undefined> {
  const base = `/api/data/v9.2/${entitySetName}(${id})/${thumbnailColumnName}/$value`;
  const toBlobUrl = (buffer: ArrayBuffer, contentType: string): string => {
    const blob = new Blob([buffer], { type: contentType.startsWith("image/") ? contentType : "image/png" });
    return URL.createObjectURL(blob);
  };

  // ?size=full returns the uncropped original (aspect ratio preserved). If the column isn't
  // configured to store full-sized images (CanStoreFullImage=false), Dataverse responds 204 No
  // Content with an empty body - detected via an empty buffer here - so we fall back to the
  // square thumbnail rather than producing a broken (zero-byte) blob.
  if (preferFullSize) {
    const fullResponse = await fetch(`${base}?size=full`, { headers: { Accept: "*/*" } });
    if (fullResponse.ok && fullResponse.status !== 204) {
      const buffer = await fullResponse.arrayBuffer();
      if (buffer.byteLength > 0) return toBlobUrl(buffer, fullResponse.headers.get("Content-Type") || "");
    }
  }

  const response = await fetch(base, { headers: { Accept: "*/*" } });
  if (!response.ok) return undefined;
  const buffer = await response.arrayBuffer();
  return toBlobUrl(buffer, response.headers.get("Content-Type") || "");
}

// The Web API's /$value endpoint for an Image-type column returns the SAME bytes already embedded
// as base64 in a normal $select - there is no separate higher-resolution copy behind it. The
// actual full-resolution original is served by the model-driven app's own image handler instead,
// confirmed against the URL a real form's image control links to when clicked
// (/Image/download.aspx?Entity=<logical name>&Attribute=<column>&Id=<id>&Full=true). Timestamp is
// a cache-busting param tied to the column's last-modified value on the real form and isn't
// required for correctness here - each open fetches fresh regardless.
async function fetchFullResolutionImageUrl(entityLogicalName: string, id: string, attributeLogicalName: string): Promise<string | undefined> {
  const url = `/Image/download.aspx?Entity=${entityLogicalName}&Attribute=${attributeLogicalName}&Id=${id}&Full=true`;
  const response = await fetch(url, { headers: { Accept: "*/*" } });
  if (!response.ok) return undefined;
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("Content-Type") || "";
  const blob = new Blob([buffer], { type: contentType.startsWith("image/") ? contentType : "image/png" });
  return URL.createObjectURL(blob);
}

// includeThumbnailIcon simulates the real-mode attribute-metadata check (there's no live
// EntityDefinitions call in test mode to tell String vs Image columns apart) - the harness user
// signals icon mode by typing a Thumbnail Column value containing "icon" (see the isTestModeIconColumn
// check where this is called), so the harness can exercise both thumbnail rendering paths.
// sortByColumnName is looked up directly as a key of ITestModeRecord (name/customAttribute1-3/
// statecode) - test mode has no live metadata to resolve an arbitrary column name against, so an
// unrecognized value is a harmless no-op (every record's sortValue stays undefined, same as no
// sort configured at all).
function testModeToTreeRecord(record: ITestModeRecord, includeThumbnailIcon: boolean, sortByColumnName: string | undefined): ITreeRecord {
  const wrap = (text?: string): IAttributeValue | undefined => (text ? { text } : undefined);
  const sortRaw = sortByColumnName ? record[sortByColumnName as keyof ITestModeRecord] : undefined;
  return {
    id: record.id,
    entityLogicalName: TEST_MODE_ENTITY_LOGICAL_NAME,
    name: record.name,
    parentId: record.parentId,
    isActive: record.statecode === 0,
    stateLabel: record.statecode === 0 ? "Active" : "Inactive",
    attr1: wrap(record.customAttribute1),
    attr2: wrap(record.customAttribute2),
    attr3: wrap(record.customAttribute3),
    thumbnailIconName: includeThumbnailIcon ? TEST_MODE_ICON_NAMES[record.id] : undefined,
    sortValue: sortRaw === undefined || sortRaw === null ? undefined : { raw: sortRaw, text: String(sortRaw) },
  };
}

// Returns an array of top-level roots rather than a single one, because sister records (other
// children of a given node's own parent) sit at the SAME level as that node - as additional
// siblings, not nested under it. This applies at EVERY level of the ancestor chain, not just the
// current record's own level: ancestorSiblings[i] holds ancestors[i]'s own sisters (parallel
// array, same length/order as ancestors), so e.g. an ancestor two levels up can have a sister
// that itself has no relation to the current record at all, sitting beside that ancestor. When
// there is no ancestor to attach the current record's own siblings to (maxParentLevels 0, or no
// parent at all), the current record and its sisters become multiple top-level roots instead,
// since there's no visible parent row to nest them under.
// sortDirection is only present (non-undefined) when sortByColumnName is configured - its mere
// presence is the "sorting is on" signal, so callers don't need to separately check both.
// Sorting is applied uniformly to every group of records that sit at the same tree level: each
// node's own children (recursively, inside toVNode), the current record together with its own
// siblings, and each ancestor together with its own siblings - never across levels, since a
// parent/child relationship isn't a sort-order relationship.
function buildVirtualRoots(
  ancestors: ITreeRecord[],
  ancestorSiblings: IDescendantNode[][],
  current: ITreeRecord,
  descendants: IDescendantNode[],
  currentSiblings: IDescendantNode[],
  sortDirection: string | undefined
): IVNode[] {
  const sortVNodes = (nodes: IVNode[]): IVNode[] => {
    if (!sortDirection) return nodes;
    const dir = sortDirection === "Descending" ? -1 : 1;
    return [...nodes].sort((a, b) => dir * compareSortValues(a.record.sortValue, b.record.sortValue));
  };

  const toVNode = (node: IDescendantNode): IVNode => ({
    record: node.record,
    isCurrent: false,
    children: sortVNodes(node.children.map(toVNode)),
  });

  const currentNode: IVNode = { record: current, isCurrent: true, children: sortVNodes(descendants.map(toVNode)) };
  let levelNodes: IVNode[] = sortVNodes([currentNode, ...currentSiblings.map(toVNode)]);

  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestorNode: IVNode = { record: ancestors[i], isCurrent: false, children: levelNodes };
    const siblingsAtThisLevel = (ancestorSiblings[i] ?? []).map(toVNode);
    levelNodes = sortVNodes([ancestorNode, ...siblingsAtThisLevel]);
  }

  return levelNodes;
}

// Sniffs the base64 payload's leading bytes for the handful of formats Dataverse Image columns
// actually store, since AttributeTypeName only tells us "this is an image", not which format.
function sniffImageMimeFromBase64(base64: string): string {
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("R0lGOD")) return "image/gif";
  if (base64.startsWith("Qk0")) return "image/bmp";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/png";
}

// Clicking the thumbnail-sized image in the Quick View panel opens a Callout anchored to it with
// a larger version, since the inline rendering (64px, height-constrained to match the label row)
// is too small to actually make out most content. Not enabled for the row subtitle's tiny 18px
// image (enableImagePreview left false there) - that context wasn't asked for and the image is
// small enough that a click target there would be more surprising than useful.
function ImageAttributeValue({
  image,
  enablePreview,
}: {
  image: { base64: string; entityLogicalName?: string; recordId?: string; logicalName?: string };
  enablePreview: boolean;
}): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false);
  const [naturalSize, setNaturalSize] = React.useState<{ width: number; height: number } | undefined>(undefined);
  const [hiResUrl, setHiResUrl] = React.useState<string | undefined>(undefined);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const lowResSrc = `data:${sniffImageMimeFromBase64(image.base64)};base64,${image.base64}`;

  if (!enablePreview) {
    return <img className="rv-attr-image" src={lowResSrc} alt="" />;
  }

  // The base64 Dataverse embeds in a $select response is a small, compressed preview - not the
  // original upload. Once the callout is open, fetch the full-resolution version via the model-
  // driven app's own image handler (see fetchFullResolutionImageUrl) and swap it in once loaded;
  // the low-res image keeps showing (scaled up) in the meantime rather than a blank/loading gap.
  React.useEffect(() => {
    if (!expanded || hiResUrl || !image.entityLogicalName || !image.recordId || !image.logicalName) return;
    let cancelled = false;
    fetchFullResolutionImageUrl(image.entityLogicalName, image.recordId, image.logicalName)
      .then((url) => {
        if (!cancelled && url) setHiResUrl(url);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [expanded, hiResUrl, image.entityLogicalName, image.recordId, image.logicalName]);

  React.useEffect(() => {
    return () => {
      if (hiResUrl) URL.revokeObjectURL(hiResUrl);
    };
  }, [hiResUrl]);

  const calloutSrc = hiResUrl ?? lowResSrc;

  const handleCalloutImageLoad = (e: React.SyntheticEvent<HTMLImageElement>): void => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) setNaturalSize({ width: naturalWidth, height: naturalHeight });
  };

  // Rendered at the image's own native resolution (no upscaling - blowing an image up past its
  // real pixel dimensions only adds blur, not detail), capped to 80% of the viewport so a large
  // photo still fits on screen. Computed together in JS rather than via CSS width + height:auto +
  // max-width/max-height: those two max-* constraints clamp each axis independently, and when
  // both end up triggered (e.g. a tall image hits max-height after width was already resolved
  // against max-width) the result is a visibly stretched/squashed image, not a proportionally
  // shrunk one - confirmed live. A single shrink factor applied to both dimensions together, like
  // the Thumbnail Fit Width/Height fix, avoids that entirely.
  const calloutImgStyle: React.CSSProperties | undefined = naturalSize
    ? (() => {
        const maxWidth = window.innerWidth * 0.8;
        const maxHeight = window.innerHeight * 0.8;
        const shrink = Math.min(1, maxWidth / naturalSize.width, maxHeight / naturalSize.height);
        return { width: naturalSize.width * shrink, height: naturalSize.height * shrink };
      })()
    : undefined;

  return (
    <>
      <img
        ref={imgRef}
        className="rv-attr-image rv-attr-image-clickable"
        src={lowResSrc}
        alt=""
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(true);
          }
        }}
      />
      {expanded && imgRef.current && (
        <Callout target={imgRef.current} onDismiss={() => setExpanded(false)} setInitialFocus isBeakVisible={false} gapSpace={4}>
          <div className="rv-image-callout">
            <button type="button" className="rv-image-callout-dismiss" aria-label="Dismiss" onClick={() => setExpanded(false)}>
              <Icon iconName="Cancel" />
            </button>
            <img className="rv-image-callout-img" src={calloutSrc} alt="" onLoad={handleCalloutImageLoad} style={calloutImgStyle} />
          </div>
        </Callout>
      )}
    </>
  );
}

function isPdfFileName(fileName: string): boolean {
  return /\.pdf$/i.test(fileName);
}

// Clicking a PDF File-column value in the Quick View panel opens a Callout with an inline
// browser-native PDF preview - full scroll, in-document search, zoom, print, same as PDFGallery's
// own inline preview - instead of only a bare download link. Bytes are fetched lazily on click
// (downloadUrl is already the exact /$value URL formatAttributeValue built) and re-wrapped in an
// explicit application/pdf Blob before use: the endpoint's Content-Type is always
// application/octet-stream regardless of the underlying file type (same gotcha PDFGallery
// documents), so trusting the browser's inferred blob type would make the iframe download the
// file instead of rendering it. Only enabled where enablePreview is true (Quick View panel) and
// the file name ends in .pdf; every other file keeps the plain download link unchanged.
function FileAttributeValue({
  file,
  enablePreview,
}: {
  file: { fileName: string; downloadUrl: string };
  enablePreview: boolean;
}): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false);
  const [pdfUrl, setPdfUrl] = React.useState<string | undefined>(undefined);
  const [loadError, setLoadError] = React.useState(false);
  const linkRef = React.useRef<HTMLAnchorElement>(null);

  const canPreview = enablePreview && isPdfFileName(file.fileName);

  React.useEffect(() => {
    if (!canPreview || !expanded || pdfUrl || loadError) return;
    let cancelled = false;
    fetch(file.downloadUrl, { headers: { Accept: "*/*" } })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (!cancelled) setPdfUrl(URL.createObjectURL(new Blob([buffer], { type: "application/pdf" })));
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [canPreview, expanded, pdfUrl, loadError, file.downloadUrl]);

  React.useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  if (!canPreview) {
    return (
      <a className="rv-attr-link" href={file.downloadUrl} download={file.fileName}>
        {file.fileName}
      </a>
    );
  }

  return (
    <>
      <a
        ref={linkRef}
        className="rv-attr-link"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setExpanded(true);
        }}
      >
        {file.fileName}
      </a>
      {expanded && linkRef.current && (
        <Callout target={linkRef.current} onDismiss={() => setExpanded(false)} setInitialFocus isBeakVisible={false} gapSpace={4}>
          <div className="rv-pdf-callout">
            <div className="rv-pdf-callout-toolbar">
              <a className="rv-pdf-callout-download" href={file.downloadUrl} download={file.fileName}>
                <Icon iconName="Download" /> Download
              </a>
              <button type="button" className="rv-pdf-callout-dismiss" aria-label="Dismiss" onClick={() => setExpanded(false)}>
                <Icon iconName="Cancel" />
              </button>
            </div>
            {loadError && <div className="rv-pdf-callout-status rv-pdf-callout-error">Failed to load the PDF.</div>}
            {!loadError && !pdfUrl && <div className="rv-pdf-callout-status">Loading...</div>}
            {pdfUrl && <iframe className="rv-pdf-callout-frame" src={`${pdfUrl}#view=FitH`} title={file.fileName} />}
          </div>
        </Callout>
      )}
    </>
  );
}

function AttributeValueText({
  value,
  onOpenRecord,
  choiceColorDisplay,
  enableImagePreview,
}: {
  value: IAttributeValue;
  onOpenRecord: (entityLogicalName: string, id: string) => void;
  choiceColorDisplay?: string;
  enableImagePreview?: boolean;
}): React.ReactElement {
  if (value.image) {
    return <ImageAttributeValue image={value.image} enablePreview={!!enableImagePreview} />;
  }

  if (value.file) {
    return <FileAttributeValue file={value.file} enablePreview={!!enableImagePreview} />;
  }

  if (value.choiceColor && choiceColorDisplay && choiceColorDisplay !== "None") {
    if (choiceColorDisplay === "Circle") {
      return (
        <>
          <span className="rv-choice-dot" style={{ backgroundColor: value.choiceColor }} />
          {value.text}
        </>
      );
    }
    if (choiceColorDisplay === "Pill") {
      return (
        <span className="rv-choice-pill" style={{ backgroundColor: value.choiceColor }}>
          {value.text}
        </span>
      );
    }
    if (choiceColorDisplay === "Font") {
      return <span style={{ color: value.choiceColor }}>{value.text}</span>;
    }
  }

  if (!value.lookup) return <>{value.text}</>;
  const lookup = value.lookup;
  return (
    <a
      className="rv-attr-link"
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onOpenRecord(lookup.entityLogicalName, lookup.id);
      }}
    >
      {value.text}
    </a>
  );
}

interface IThumbnailProps {
  style: string;
  url?: string;
  iconName?: string;
  renderingOption: string;
}

// iconName takes priority over url when both are somehow present - thumbnailColumnName resolves
// to exactly one mode per record (Image column vs text/icon column), so this shouldn't happen in
// practice, but iconName is the simpler/cheaper render path if it ever does.
function Thumbnail({ style, url, iconName, renderingOption }: IThumbnailProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [failed, setFailed] = React.useState(false);
  const [naturalSize, setNaturalSize] = React.useState<{ width: number; height: number } | undefined>(undefined);
  React.useEffect(() => {
    setFailed(false);
    setNaturalSize(undefined);
  }, [url]);

  // A data: URI (test mode's placeholder SVG) or a browser-cached image is already `complete`
  // by the time this mounts, so the `load` event fires before React attaches the img's onLoad
  // handler and handleLoad below never runs - naturalSize stays undefined forever and the Fit
  // Width/Height image stays hidden permanently. useLayoutEffect re-checks img.complete after
  // every render (before paint) as a fallback for that already-loaded case; onLoad still covers
  // the normal not-yet-loaded case.
  React.useLayoutEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalSize((prev) =>
        prev && prev.width === img.naturalWidth && prev.height === img.naturalHeight
          ? prev
          : { width: img.naturalWidth, height: img.naturalHeight }
      );
    }
  });

  const shapeClass = style === "Square" ? "rv-thumb-square" : style === "RoundedSquare" ? "rv-thumb-rounded" : "rv-thumb-circle";

  if (iconName) {
    return (
      <div className={`rv-thumb ${shapeClass}`}>
        <Icon iconName={iconName} className="rv-thumb-icon" />
      </div>
    );
  }

  const showImage = !!url && !failed;
  const isTile = renderingOption === "Tile";
  const isFitMode = renderingOption === "FitWidth" || renderingOption === "FitHeight";

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>): void => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) setNaturalSize({ width: naturalWidth, height: naturalHeight });
  };

  // Fit Width/Height need the "auto" dimension to size off the image's own aspect ratio. CSS
  // width:100%/height:auto (and even an author-specified aspect-ratio) on a replaced element
  // inside this flex container (align-items/justify-content: center, not stretch) doesn't
  // reliably resolve to the intrinsic ratio in practice - confirmed via live DevTools testing
  // with a 400x100 image, which still rendered as a cropped square. Computing explicit pixel
  // width/height in JS from the container's own measured size + the image's natural size
  // sidesteps the flex auto-sizing algorithm entirely instead of fighting it.
  let imgStyle: React.CSSProperties | undefined;
  if (isTile) {
    imgStyle = { visibility: "hidden", position: "absolute" };
  } else if (isFitMode) {
    const box = containerRef.current;
    if (naturalSize && box) {
      const ratio = naturalSize.width / naturalSize.height;
      const boxSize = box.clientWidth || box.clientHeight || 32;
      imgStyle =
        renderingOption === "FitWidth"
          ? { width: boxSize, height: boxSize / ratio, maxWidth: "none", maxHeight: "none" }
          : { width: boxSize * ratio, height: boxSize, maxWidth: "none", maxHeight: "none" };
    } else {
      // Natural size isn't known yet (first render) - hide instead of flashing an
      // incorrectly-sized image using the fallback CSS class rules.
      imgStyle = { visibility: "hidden", position: "absolute" };
    }
  }

  return (
    <div className={`rv-thumb ${shapeClass}`} ref={containerRef}>
      {showImage && (
        <img
          ref={imgRef}
          src={url}
          alt=""
          onError={() => setFailed(true)}
          onLoad={handleLoad}
          className={`rv-thumb-fit-${renderingOption.toLowerCase()}`}
          style={imgStyle}
        />
      )}
      {showImage && isTile && <div className="rv-thumb-tile" style={{ backgroundImage: `url(${url})` }} />}
      {!showImage && <Icon iconName="Photo2" className="rv-thumb-placeholder" />}
    </div>
  );
}

interface IRailProps {
  depth: number;
  continuationFlags: boolean[];
  isLast: boolean;
  colWidth: number;
}

// Per-level indentation width for the three Indentation settings; Medium matches the control's
// original fixed 32px column width.
const INDENTATION_COL_WIDTHS: Record<string, number> = { Low: 20, Medium: 32, High: 48 };

const RAIL_ROW_HEIGHT = 44;
const RAIL_CORNER_RADIUS = 10;
// The chevron button/spacer is 24px wide, so its glyph centre sits 12px into a row's content
// area. Keeping the lines at that same offset inside their column makes each elbow drop
// exactly from under the parent row's chevron, like the reference design. This offset is
// independent of the Indentation setting - only the column width changes.
const RAIL_LINE_OFFSET = 12;

const railLineX = (col: number, colWidth: number): number => col * colWidth + RAIL_LINE_OFFSET;

// Drawn as a single SVG (rather than bordered <div> cells) so the elbow joining the vertical
// guide into the horizontal stub is a real rounded curve, matching the reference tree's look.
// continuationFlags[i] === true means an earlier sibling line passes straight through column i
// of this row (columns 0..depth-2); column depth-1 is always this node's own elbow.
function Rail({ depth, continuationFlags, isLast, colWidth }: IRailProps): React.ReactElement | null {
  if (depth === 0) return null;
  const width = depth * colWidth;
  const midY = RAIL_ROW_HEIGHT / 2;

  const paths: string[] = [];
  continuationFlags.forEach((flag, i) => {
    if (!flag) return;
    const x = railLineX(i, colWidth);
    paths.push(`M ${x} 0 L ${x} ${RAIL_ROW_HEIGHT}`);
  });

  const ownCol = depth - 1;
  const x = railLineX(ownCol, colWidth);
  const rightEdge = ownCol * colWidth + colWidth;
  // Arc (not a quadratic bezier) so the corner is a true quarter circle rather than a
  // flattened bend; the stub then runs on to the rail's right edge to meet the row content.
  let ownPath = `M ${x} 0 L ${x} ${midY - RAIL_CORNER_RADIUS} A ${RAIL_CORNER_RADIUS} ${RAIL_CORNER_RADIUS} 0 0 0 ${
    x + RAIL_CORNER_RADIUS
  } ${midY} L ${rightEdge} ${midY}`;
  if (!isLast) {
    ownPath += ` M ${x} ${midY} L ${x} ${RAIL_ROW_HEIGHT}`;
  }
  paths.push(ownPath);

  return (
    <svg
      className="rv-rail-svg"
      width={width}
      viewBox={`0 0 ${width} ${RAIL_ROW_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

// Vertical pass-through lines only (no elbow) — keeps ancestors' sibling lines unbroken across
// rows that aren't tree rows themselves, e.g. an expanded quick-view panel.
function ContinuationRail({ flags, colWidth }: { flags: boolean[]; colWidth: number }): React.ReactElement | null {
  if (flags.length === 0) return null;
  const width = flags.length * colWidth;
  return (
    <svg
      className="rv-rail-svg"
      width={width}
      viewBox={`0 0 ${width} ${RAIL_ROW_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {flags.map((flag, i) => {
        if (!flag) return null;
        const x = railLineX(i, colWidth);
        return <path key={i} d={`M ${x} 0 L ${x} ${RAIL_ROW_HEIGHT}`} vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
}

interface IRowContext {
  showState: boolean;
  thumbnailStyle: string;
  thumbnailRenderingOption: string;
  thumbnailColumnName?: string;
  thumbnailUrls: Record<string, string>;
  hasQuickView: boolean;
  quickViewLayout: IQuickViewSectionGroup[];
  expandedIds: Set<string>;
  quickViewDataByRecord: Record<string, IQuickViewEntry>;
  choiceColorDisplay: string;
  currentRecordHighlightColor: string;
  colWidth: number;
  onOpenRecord: (entityLogicalName: string, id: string) => void;
  onToggleExpand: (id: string) => void;
}

interface IQuickViewColumn {
  tabIndex: number;
  columnIndex: number;
  widthPercent?: number;
  sections: IQuickViewSectionGroup[];
}

// Section groups sharing the same tab+column belong in the same column, in document order
// (parseFormLayout already emits them that way - a column can hold more than one section).
function groupSectionsIntoColumns(layout: IQuickViewSectionGroup[]): IQuickViewColumn[] {
  const columns: IQuickViewColumn[] = [];
  const byKey = new Map<string, IQuickViewColumn>();
  layout.forEach((section) => {
    const key = `${section.tabIndex}-${section.columnIndex}`;
    let column = byKey.get(key);
    if (!column) {
      column = { tabIndex: section.tabIndex, columnIndex: section.columnIndex, widthPercent: section.widthPercent, sections: [] };
      byKey.set(key, column);
      columns.push(column);
    }
    column.sections.push(section);
  });
  return columns;
}

// Consecutive columns that share the same tabIndex belong side-by-side in the same row of the
// form's layout; a change in tabIndex starts a new stacked row.
function groupColumnsIntoRows(columns: IQuickViewColumn[]): IQuickViewColumn[][] {
  const rows: IQuickViewColumn[][] = [];
  columns.forEach((column) => {
    const lastRow = rows[rows.length - 1];
    if (lastRow && lastRow[0].tabIndex === column.tabIndex) {
      lastRow.push(column);
    } else {
      rows.push([column]);
    }
  });
  return rows;
}

function QuickViewPanelFields({
  layout,
  values,
  choiceColorDisplay,
  onOpenRecord,
}: {
  layout: IQuickViewSectionGroup[];
  values: Record<string, IAttributeValue>;
  choiceColorDisplay: string;
  onOpenRecord: (entityLogicalName: string, id: string) => void;
}): React.ReactElement {
  const rows = groupColumnsIntoRows(groupSectionsIntoColumns(layout));
  return (
    <>
      {rows.map((row, rowIndex) => (
        <div className="rv-quickview-tabrow" key={rowIndex}>
          {row.map((column) => (
            <div
              key={`${column.tabIndex}-${column.columnIndex}`}
              className="rv-quickview-column"
              style={column.widthPercent ? { flex: `0 0 ${column.widthPercent}%` } : { flex: "1 1 0" }}
            >
              {column.sections.map((section, sectionIndex) => (
                <div key={sectionIndex} className="rv-quickview-section">
                  {section.sectionLabel && <div className="rv-quickview-section-header">{section.sectionLabel}</div>}
                  {section.fields.map((f) => (
                    <div key={f.logicalName} className="rv-quickview-field">
                      <span className="rv-quickview-label">{f.label}</span>
                      <span className="rv-quickview-value">
                        <AttributeValueText
                          value={values[f.logicalName] ?? { text: "" }}
                          onOpenRecord={onOpenRecord}
                          choiceColorDisplay={choiceColorDisplay}
                          enableImagePreview
                        />
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

interface ITreeRowProps {
  node: IVNode;
  depth: number;
  continuationFlags: boolean[];
  isLast: boolean;
  ctx: IRowContext;
}

function TreeRow({ node, depth, continuationFlags, isLast, ctx }: ITreeRowProps): React.ReactElement {
  const { record, isCurrent } = node;
  const subtitleParts = [record.attr1, record.attr2, record.attr3].filter(
    (v): v is IAttributeValue => !!v && (v.text !== "" || !!v.image || !!v.file)
  );
  const isExpanded = ctx.expandedIds.has(record.id);
  const quickViewEntry = ctx.quickViewDataByRecord[record.id];

  const handleOpen = (e: React.MouseEvent): void => {
    e.preventDefault();
    ctx.onOpenRecord(record.entityLogicalName, record.id);
  };

  // Same shape the children's rows receive: the lines that must keep running below this row.
  const passThroughFlags = depth === 0 ? [] : [...continuationFlags, !isLast];

  return (
    <div className="rv-node">
      <div className="rv-row">
        <Rail depth={depth} continuationFlags={continuationFlags} isLast={isLast} colWidth={ctx.colWidth} />
        <div
          className={`rv-row-content ${isCurrent ? "rv-row-current" : ""}`}
          style={isCurrent ? { backgroundColor: ctx.currentRecordHighlightColor } : undefined}
        >
          {ctx.hasQuickView ? (
            <button
              type="button"
              className="rv-chevron"
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
              onClick={() => ctx.onToggleExpand(record.id)}
            >
              <Icon iconName={isExpanded ? "ChevronDown" : "ChevronRight"} />
            </button>
          ) : (
            <span className="rv-chevron-spacer" />
          )}
          {ctx.thumbnailColumnName && (
            <Thumbnail
              style={ctx.thumbnailStyle}
              url={ctx.thumbnailUrls[record.id]}
              iconName={record.thumbnailIconName}
              renderingOption={ctx.thumbnailRenderingOption}
            />
          )}
          <div className="rv-row-main">
            <div className="rv-title-line">
              {isCurrent ? (
                <span className="rv-title rv-title-current">{record.name}</span>
              ) : (
                <a className="rv-title" href="#" onClick={handleOpen}>
                  {record.name}
                </a>
              )}
            </div>
            {subtitleParts.length > 0 && (
              <div className="rv-subtitle">
                {subtitleParts.map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && " • "}
                    <AttributeValueText value={part} onOpenRecord={ctx.onOpenRecord} />
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
          <div className="rv-row-end">
            {ctx.showState && (
              <span className={`rv-pill ${record.isActive ? "rv-pill-active" : "rv-pill-inactive"}`}>{record.stateLabel}</span>
            )}
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="rv-quickview-row">
          <ContinuationRail flags={passThroughFlags} colWidth={ctx.colWidth} />
          <div className="rv-quickview-panel">
            {(!quickViewEntry || quickViewEntry.status === "loading") && <span className="rv-quickview-status">Loading...</span>}
            {quickViewEntry?.status === "error" && <span className="rv-quickview-status rv-quickview-error">{quickViewEntry.error}</span>}
            {quickViewEntry?.status === "ready" && (
              <QuickViewPanelFields
                layout={ctx.quickViewLayout}
                values={quickViewEntry.valuesByField ?? {}}
                choiceColorDisplay={ctx.choiceColorDisplay}
                onOpenRecord={ctx.onOpenRecord}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function renderVNode(node: IVNode, depth: number, continuationFlags: boolean[], isLast: boolean, ctx: IRowContext): React.ReactNode[] {
  const row = <TreeRow key={node.record.id} node={node} depth={depth} continuationFlags={continuationFlags} isLast={isLast} ctx={ctx} />;
  // A node's elbow sits in column depth-1; if it has later siblings, that column keeps a
  // vertical line through every row of this node's subtree. The depth-0 root has no rail
  // column at all, so it contributes no flag (appending one shifts every line one column left).
  const childFlags = depth === 0 ? [] : [...continuationFlags, !isLast];
  const childRows = node.children.flatMap((child, i) => renderVNode(child, depth + 1, childFlags, i === node.children.length - 1, ctx));
  return [row, ...childRows];
}

function collectAllIds(
  ancestors: ITreeRecord[],
  current: ITreeRecord | undefined,
  descendants: IDescendantNode[],
  siblings: IDescendantNode[],
  ancestorSiblings: IDescendantNode[][]
): string[] {
  const ids: string[] = ancestors.map((r) => r.id);
  if (current) ids.push(current.id);
  const walk = (nodes: IDescendantNode[]): void => {
    nodes.forEach((n) => {
      ids.push(n.record.id);
      walk(n.children);
    });
  };
  walk(descendants);
  walk(siblings);
  ancestorSiblings.forEach(walk);
  return ids;
}

export const RelationshipViewControl = (props: IRelationshipViewProps): React.ReactElement => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [designTimePreview, setDesignTimePreview] = React.useState(false);
  const [ancestors, setAncestors] = React.useState<ITreeRecord[]>([]);
  const [currentRecord, setCurrentRecord] = React.useState<ITreeRecord | undefined>(undefined);
  const [descendantTree, setDescendantTree] = React.useState<IDescendantNode[]>([]);
  const [siblingTree, setSiblingTree] = React.useState<IDescendantNode[]>([]);
  // Parallel to ancestors - ancestorSiblingTree[i] holds ancestors[i]'s own sister records, so
  // sisters render at every level of the ancestor chain, not only the current record's own level.
  const [ancestorSiblingTree, setAncestorSiblingTree] = React.useState<IDescendantNode[][]>([]);
  const [entityMeta, setEntityMeta] = React.useState<IEntityMeta | undefined>(undefined);
  const [quickViewLayout, setQuickViewLayout] = React.useState<IQuickViewSectionGroup[] | null>(null);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [quickViewDataByRecord, setQuickViewDataByRecord] = React.useState<Record<string, IQuickViewEntry>>({});
  const [choiceColors, setChoiceColors] = React.useState<Record<string, Record<number, string>>>({});
  const [thumbnailUrls, setThumbnailUrls] = React.useState<Record<string, string>>({});
  const [attributeMeta, setAttributeMeta] = React.useState<Record<string, IAttributeMeta>>({});

  // True once a real (non-design-time) tree has been rendered at least once. PCF calls updateView
  // again during form startup once the record context / bound lookup value finishes hydrating,
  // which changes a load-effect dependency (entityId / initialParentId) and legitimately re-runs
  // the load. Without this guard that re-run blanks the already-rendered tree back to the loading
  // spinner and reloads it - the visible "loads, resets, loads again once" flash. When content is
  // already on screen we instead keep it visible and swap in the new data when it arrives.
  const hasContentRef = React.useRef(false);

  const thumbnailUrlsRef = React.useRef<Record<string, string>>({});
  React.useEffect(() => {
    thumbnailUrlsRef.current = thumbnailUrls;
  }, [thumbnailUrls]);
  React.useEffect(() => {
    return () => {
      Object.values(thumbnailUrlsRef.current).forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const resolvedContext = props.isTestMode
    ? { entityTypeName: TEST_MODE_ENTITY_LOGICAL_NAME, entityId: TEST_MODE_CURRENT_RECORD_ID }
    : resolveCurrentRecordContext(props.mode, props.utils);
  const entityTypeName = resolvedContext.entityTypeName;
  const entityId = resolvedContext.entityId;
  const parentAttributeLogicalName = props.isTestMode ? "parentlookup" : props.parentLookupProperty.attributes?.LogicalName;
  const initialParentId = props.isTestMode
    ? TEST_MODE_RECORDS.find((r) => r.id === TEST_MODE_CURRENT_RECORD_ID)?.parentId
    : props.parentLookupProperty.raw?.[0]?.id;

  React.useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      // Only show the full-screen loading spinner on the first load. On re-runs (e.g. the record
      // context hydrating during startup) keep the existing tree visible and swap in fresh data,
      // rather than blanking back to the spinner. See hasContentRef above.
      if (!hasContentRef.current) setLoading(true);
      setError(undefined);
      setDesignTimePreview(false);

      try {
        if (props.isTestMode) {
          const byId = new Map(TEST_MODE_RECORDS.map((r) => [r.id, r]));
          const current = byId.get(TEST_MODE_CURRENT_RECORD_ID);
          if (!current) throw new Error("Test mode data is missing the current record.");

          const thumbnailIsIcon = !!props.thumbnailColumnName && props.thumbnailColumnName.toLowerCase().includes("icon");

          const ancestorsList: ITreeRecord[] = [];
          if (props.maxParentLevels !== 0) {
            let pid = current.parentId;
            let levels = 0;
            while (pid && (props.maxParentLevels === -1 || levels < props.maxParentLevels)) {
              const ancestor = byId.get(pid);
              if (!ancestor) break;
              ancestorsList.unshift(testModeToTreeRecord(ancestor, thumbnailIsIcon, props.sortByColumnName));
              pid = ancestor.parentId;
              levels++;
            }
          }

          // showInactiveRecords=false prunes an inactive record - and its whole subtree along with
          // it, since buildChildren is never called for it - mirroring how the real-data path's
          // walkDescendants prunes at the query level instead of fetching then discarding.
          const buildChildren = (parentId: string, level: number): IDescendantNode[] => {
            if (props.maxChildLevels !== -1 && level >= props.maxChildLevels) return [];
            return TEST_MODE_RECORDS.filter((r) => r.parentId === parentId && (props.showInactiveRecords || r.statecode === 0)).map((r) => ({
              record: testModeToTreeRecord(r, thumbnailIsIcon, props.sortByColumnName),
              children: buildChildren(r.id, level + 1),
            }));
          };
          const descendants = props.maxChildLevels !== 0 ? buildChildren(TEST_MODE_CURRENT_RECORD_ID, 0) : [];

          // Sisters of a given record: other TEST_MODE_RECORDS sharing its parentId. Reused for
          // both the current record's own siblings and, per ancestor, that ancestor's siblings -
          // mirrors the real-data path's per-ancestor fetchSiblings loop below.
          const computeTestSiblings = (parentId: string, excludeId: string): IDescendantNode[] =>
            TEST_MODE_RECORDS.filter((r) => r.parentId === parentId && r.id !== excludeId && (props.showInactiveRecords || r.statecode === 0)).map(
              (r) => ({
                record: testModeToTreeRecord(r, thumbnailIsIcon, props.sortByColumnName),
                children: props.siblingDisplay === "SistersAndChildren" ? buildChildren(r.id, 0) : [],
              })
            );

          const siblings: IDescendantNode[] =
            props.siblingDisplay !== "None" && current.parentId
              ? computeTestSiblings(current.parentId, TEST_MODE_CURRENT_RECORD_ID)
              : [];

          // The ancestor walk above always follows the full chain regardless of state (an inactive
          // ancestor's own parent id is still needed to keep climbing) - filtering for display
          // happens afterward here, same as the real-data path, and the ancestorSiblings map below
          // must iterate this same filtered array to stay index-aligned with what's rendered.
          const ancestorsForDisplay = props.showInactiveRecords ? ancestorsList : ancestorsList.filter((a) => a.isActive);

          const ancestorSiblings: IDescendantNode[][] =
            props.siblingDisplay !== "None"
              ? ancestorsForDisplay.map((ancestor) => (ancestor.parentId ? computeTestSiblings(ancestor.parentId, ancestor.id) : []))
              : [];

          if (!cancelled) {
            setAncestors(ancestorsForDisplay);
            setCurrentRecord(testModeToTreeRecord(current, thumbnailIsIcon, props.sortByColumnName));
            setDescendantTree(descendants);
            setSiblingTree(siblings);
            setAncestorSiblingTree(ancestorSiblings);
            setEntityMeta({ entitySetName: "test_entities", primaryIdAttribute: "id", primaryNameAttribute: "name" });
            setQuickViewLayout(props.quickViewFormName ? TEST_MODE_QUICK_VIEW_COLUMNS : null);
            hasContentRef.current = true;
          }
          return;
        }

        if (!entityTypeName || !entityId) {
          // Expected in the form designer/preview canvas - there is no live record context yet
          // until the form is saved and opened against an actual record, so this isn't an error.
          if (!cancelled) {
            setDesignTimePreview(true);
            setLoading(false);
          }
          return;
        }
        if (!parentAttributeLogicalName) {
          throw new Error("Unable to resolve the parent lookup field's logical name.");
        }

        const meta = await resolveEntityMetadata(entityTypeName);
        if (cancelled) return;
        setEntityMeta(meta);

        const customAttrNames = [
          props.customAttribute1,
          props.customAttribute2,
          props.customAttribute3,
          props.thumbnailColumnName,
          props.sortByColumnName,
        ].filter((v): v is string => !!v);
        const resolvedAttributeMeta = await resolveAttributeMetadata(entityTypeName, customAttrNames);
        if (cancelled) return;
        // Merge, don't replace - this load effect re-runs on more than just first mount (PCF calls
        // updateView, and thus can re-trigger this effect, repeatedly during normal form use - see
        // hasContentRef above). A plain replace here wiped out whichever Quick View field metadata
        // (further below, merged in after Quick View Form resolution) an earlier run had already
        // added - including Lookup fields like hek_counterparty - recreating, on every reload, the
        // exact window where a newly-expanded row's Quick View fetch reads attributeMeta before
        // that field's metadata is back in state and falls back to toWebApiSelectFields' plain-name
        // form. Only Lookup/Customer/Owner fields are affected by a missing entry (every other type
        // selects correctly by plain name regardless), which is why this always singled out the one
        // Lookup field on the form and never the others, independent of whether it had a value.
        setAttributeMeta((prev) => ({ ...prev, ...resolvedAttributeMeta }));

        const selectClause = buildSelectClause(
          meta.primaryNameAttribute,
          parentAttributeLogicalName,
          [props.customAttribute1, props.customAttribute2, props.customAttribute3],
          resolvedAttributeMeta,
          props.thumbnailColumnName,
          props.sortByColumnName
        );

        const budget = { remaining: MAX_TOTAL_NODES };
        const visited = new Set<string>([entityId]);

        const ancestorsList =
          props.maxParentLevels !== 0 && initialParentId
            ? await walkAncestors(
                props.webAPI,
                entityTypeName,
                initialParentId,
                selectClause,
                meta.primaryNameAttribute,
                parentAttributeLogicalName,
                resolvedAttributeMeta,
                meta.entitySetName,
                props.customAttribute1,
                props.customAttribute2,
                props.customAttribute3,
                props.thumbnailColumnName,
                props.sortByColumnName,
                props.maxParentLevels,
                visited,
                budget
              )
            : [];
        if (cancelled) return;
        // walkAncestors must still fetch and walk through an inactive ancestor to keep climbing
        // toward the root (its own parent id is only known once it's fetched) - so filtering by
        // showInactiveRecords happens on the result here, not inside the walk itself, and both the
        // rendered ancestor list and the ancestorSiblings loop below (which must stay index-aligned
        // with whatever ancestor list is actually rendered) use this same filtered array.
        const ancestorsForDisplay = props.showInactiveRecords ? ancestorsList : ancestorsList.filter((a) => a.isActive);
        setAncestors(ancestorsForDisplay);

        const currentRecordData = await props.webAPI.retrieveRecord(entityTypeName, entityId, `?$select=${selectClause}`);
        const currentMapped = mapWebApiRecordToTreeRecord(
          currentRecordData,
          entityTypeName,
          entityId,
          meta.primaryNameAttribute,
          parentAttributeLogicalName,
          resolvedAttributeMeta,
          meta.entitySetName,
          props.customAttribute1,
          props.customAttribute2,
          props.customAttribute3,
          props.thumbnailColumnName,
          props.sortByColumnName
        );
        if (cancelled) return;
        setCurrentRecord(currentMapped);
        hasContentRef.current = true;

        const descendants = props.maxChildLevels !== 0
          ? await walkDescendants(
              props.webAPI,
              entityTypeName,
              entityId,
              meta.primaryIdAttribute,
              selectClause,
              meta.primaryNameAttribute,
              parentAttributeLogicalName,
              resolvedAttributeMeta,
              meta.entitySetName,
              props.customAttribute1,
              props.customAttribute2,
              props.customAttribute3,
              props.thumbnailColumnName,
              props.sortByColumnName,
              props.maxChildLevels,
              0,
              visited,
              budget,
              props.showInactiveRecords
            )
          : [];
        if (cancelled) return;
        setDescendantTree(descendants);

        const siblings =
          props.siblingDisplay !== "None" && initialParentId
            ? await fetchSiblings(
                props.webAPI,
                entityTypeName,
                initialParentId,
                meta.primaryIdAttribute,
                selectClause,
                meta.primaryNameAttribute,
                parentAttributeLogicalName,
                resolvedAttributeMeta,
                meta.entitySetName,
                props.customAttribute1,
                props.customAttribute2,
                props.customAttribute3,
                props.thumbnailColumnName,
                props.sortByColumnName,
                props.siblingDisplay === "SistersAndChildren",
                props.maxChildLevels,
                visited,
                budget,
                props.showInactiveRecords
              )
            : [];
        if (cancelled) return;
        setSiblingTree(siblings);

        // Sisters at every ancestor level, not just the current record's own level - e.g. viewing
        // from a grandchild, the immediate parent's own sisters (an "aunt/uncle" of the current
        // record) still belong in the tree, one level further up than the current record's own
        // siblings. Sequential (not Promise.all) since each call mutates the shared visited/budget
        // guards - concurrent calls would race on those.
        const ancestorSiblings: IDescendantNode[][] = [];
        if (props.siblingDisplay !== "None") {
          for (const ancestor of ancestorsForDisplay) {
            if (!ancestor.parentId) {
              ancestorSiblings.push([]);
              continue;
            }
            const siblingsAtLevel = await fetchSiblings(
              props.webAPI,
              entityTypeName,
              ancestor.parentId,
              meta.primaryIdAttribute,
              selectClause,
              meta.primaryNameAttribute,
              parentAttributeLogicalName,
              resolvedAttributeMeta,
              meta.entitySetName,
              props.customAttribute1,
              props.customAttribute2,
              props.customAttribute3,
              props.thumbnailColumnName,
              props.sortByColumnName,
              props.siblingDisplay === "SistersAndChildren",
              props.maxChildLevels,
              visited,
              budget,
              props.showInactiveRecords
            );
            ancestorSiblings.push(siblingsAtLevel);
          }
        }
        if (cancelled) return;
        setAncestorSiblingTree(ancestorSiblings);

        if (props.quickViewFormName) {
          console.log(`[RelationshipView] resolving Quick View Form "${props.quickViewFormName}" on entity "${entityTypeName}"`);
          try {
            const layout = await resolveQuickViewFields(props.webAPI, entityTypeName, props.quickViewFormName);
            const flatFields = flattenQuickViewFields(layout);
            const quickViewAttributeMeta = await resolveAttributeMetadata(
              entityTypeName,
              flatFields.map((f) => f.logicalName)
            );

            const picklistFieldNames = flatFields
              .map((f) => f.logicalName)
              .filter((name) => quickViewAttributeMeta[name]?.attributeType === "Picklist");
            const colors = picklistFieldNames.length > 0 ? await resolveChoiceColors(entityTypeName, picklistFieldNames) : undefined;

            // attributeMeta/choiceColors must be merged in the same tick as quickViewLayout is
            // published, not after - the per-row Quick View fetch effect keys off quickViewLayout
            // going non-null and reads attributeMeta to pick the $select form (a Lookup needs
            // "_<name>_value", not its plain name, see toWebApiSelectFields). Publishing the layout
            // first let an already-expanded row's fetch race ahead of this merge and $select a
            // Lookup field by its plain name, which Dataverse rejects with "Could not find a
            // property named '<name>' on type '<entity>'" - intermittent, and on whichever field
            // happened to still be unresolved at that moment.
            if (!cancelled) {
              setAttributeMeta((prev) => ({ ...prev, ...quickViewAttributeMeta }));
              if (colors) setChoiceColors((prev) => ({ ...prev, ...colors }));
              setQuickViewLayout(layout);
            }
          } catch (quickViewErr) {
            if (!cancelled) setQuickViewLayout([]);
            console.error(`[RelationshipView] failed to resolve Quick View Form "${props.quickViewFormName}"`, quickViewErr);
          }
        } else if (!cancelled) {
          setQuickViewLayout(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message ?? "Failed to load relationship data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [
    props.isTestMode,
    entityTypeName,
    entityId,
    parentAttributeLogicalName,
    initialParentId,
    props.maxParentLevels,
    props.maxChildLevels,
    props.customAttribute1,
    props.customAttribute2,
    props.customAttribute3,
    props.thumbnailColumnName,
    props.sortByColumnName,
    props.quickViewFormName,
    props.siblingDisplay,
    props.showInactiveRecords,
    props.webAPI,
  ]);

  React.useEffect(() => {
    if (props.isTestMode) {
      expandedIds.forEach((id) => {
        setQuickViewDataByRecord((prev) => {
          if (prev[id]) return prev;
          const record = TEST_MODE_RECORDS.find((r) => r.id === id);
          if (!record) return prev;
          const valuesByField: Record<string, IAttributeValue> = {};
          TEST_MODE_QUICK_VIEW_COLUMNS.flatMap((g) => g.fields).forEach((f) => {
            const text = String(record[f.logicalName] ?? "");
            const choiceColor = TEST_MODE_CHOICE_COLORS[text];
            valuesByField[f.logicalName] = choiceColor ? { text, choiceColor } : { text };
          });
          return { ...prev, [id]: { status: "ready", valuesByField } };
        });
      });
      return;
    }

    if (!quickViewLayout || quickViewLayout.length === 0 || !entityTypeName || !entityMeta) return;
    const flatFields = flattenQuickViewFields(quickViewLayout);
    expandedIds.forEach((id) => {
      setQuickViewDataByRecord((prev) => {
        if (prev[id]) return prev;
        fetchQuickViewValues(props.webAPI, entityTypeName, id, flatFields, attributeMeta, entityMeta.entitySetName, choiceColors)
          .then((valuesByField) => setQuickViewDataByRecord((p) => ({ ...p, [id]: { status: "ready", valuesByField } })))
          .catch((err: Error) => {
            console.error(`[RelationshipView] failed to fetch quick view values for record ${id}`, err);
            setQuickViewDataByRecord((p) => ({ ...p, [id]: { status: "error", error: err.message ?? "Failed to load details." } }));
          });
        return { ...prev, [id]: { status: "loading" } };
      });
    });
  }, [expandedIds, quickViewLayout, entityTypeName, props.isTestMode, attributeMeta, props.webAPI, entityMeta, choiceColors]);

  React.useEffect(() => {
    if (!props.thumbnailColumnName) return;

    // Icon-mode thumbnails come straight from ITreeRecord.thumbnailIconName (already resolved in
    // mapWebApiRecordToTreeRecord/testModeToTreeRecord as part of the main tree fetch) - no blob
    // fetch is needed or possible for a plain text column.
    const thumbnailIsIcon = props.isTestMode
      ? props.thumbnailColumnName.toLowerCase().includes("icon")
      : attributeMeta[props.thumbnailColumnName]?.attributeType === "String";
    if (thumbnailIsIcon) return;

    const allIds = collectAllIds(ancestors, currentRecord, descendantTree, siblingTree, ancestorSiblingTree);

    if (props.isTestMode) {
      setThumbnailUrls((prev) => {
        const next = { ...prev };
        let changed = false;
        allIds.forEach((id) => {
          if (!next[id]) {
            next[id] = TEST_MODE_THUMBNAIL_DATA_URI;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      return;
    }

    if (!entityMeta) return;
    const preferFullSize = ASPECT_SENSITIVE_RENDERING_OPTIONS.has(props.thumbnailRenderingOption);
    allIds.forEach((id) => {
      if (thumbnailUrlsRef.current[id]) return;
      fetchThumbnailUrl(entityMeta.entitySetName, id, props.thumbnailColumnName as string, preferFullSize)
        .then((url) => {
          if (url) setThumbnailUrls((prev) => (prev[id] ? prev : { ...prev, [id]: url }));
          return undefined;
        })
        .catch((err: Error) => {
          console.error("Failed to load thumbnail", err);
        });
    });
  }, [
    props.thumbnailColumnName,
    props.thumbnailRenderingOption,
    props.isTestMode,
    entityMeta,
    attributeMeta,
    ancestors,
    currentRecord,
    descendantTree,
    siblingTree,
    ancestorSiblingTree,
  ]);

  const handleOpenRecord = React.useCallback(
    (entityLogicalName: string, id: string) => {
      props.navigation.openForm({ entityName: entityLogicalName, entityId: id }).catch((err: Error) => {
        console.error("Failed to open record", err);
      });
    },
    [props.navigation]
  );

  const handleToggleExpand = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (loading) {
    return <div className="rv-container rv-status">Loading relationship tree...</div>;
  }

  if (designTimePreview) {
    return <div className="rv-container rv-status">The relationship tree will be visible once this form is saved and opened for a record.</div>;
  }

  if (error) {
    return <div className="rv-container rv-status rv-status-error">{error}</div>;
  }

  if (!currentRecord) {
    return <div className="rv-container rv-status">No record loaded.</div>;
  }

  const ctx: IRowContext = {
    // When inactive records are filtered out of the tree entirely, every remaining record is
    // active by definition - the pill would only ever read "Active" and add no information, so
    // showInactiveRecords=false suppresses it regardless of showState. When true, the pill's
    // visibility is unchanged - still governed solely by showState, same as before this setting
    // existed.
    showState: props.showState && props.showInactiveRecords,
    thumbnailStyle: props.thumbnailStyle,
    thumbnailRenderingOption: props.thumbnailRenderingOption,
    thumbnailColumnName: props.thumbnailColumnName,
    thumbnailUrls,
    hasQuickView: !!props.quickViewFormName,
    quickViewLayout: quickViewLayout ?? [],
    expandedIds,
    quickViewDataByRecord,
    choiceColorDisplay: props.choiceColorDisplay,
    currentRecordHighlightColor: props.currentRecordHighlightColor,
    colWidth: INDENTATION_COL_WIDTHS[props.indentation] ?? INDENTATION_COL_WIDTHS.Medium,
    onOpenRecord: handleOpenRecord,
    onToggleExpand: handleToggleExpand,
  };

  const roots = buildVirtualRoots(
    ancestors,
    ancestorSiblingTree,
    currentRecord,
    descendantTree,
    siblingTree,
    props.sortByColumnName ? props.sortDirection : undefined
  );

  return (
    <div className="rv-container">
      {roots.flatMap((root, i) => renderVNode(root, 0, [], i === roots.length - 1, ctx))}
    </div>
  );
};
