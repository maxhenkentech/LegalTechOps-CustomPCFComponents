import * as React from "react";
import { ComboBox, IComboBox, IComboBoxOption } from "@fluentui/react/lib/ComboBox";
import { Icon } from "@fluentui/react/lib/Icon";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";
import { DirectionalHint } from "@fluentui/react/lib/Callout";
import {
  myTheme,
  comboBoxStyles,
  topMatchOptionStyles,
  caretDownButtonStyles,
  iconContainerStyle,
  iconImageStyle,
  darkenHexColor,
  TOP_MATCH_MARKER,
  CLEAR_BUTTON_RIGHT_OFFSET,
  CLEAR_ICON_STYLE,
  IconShape,
  FIELD_BG,
  FIELD_BORDER_RADIUS,
} from "./LookUpStyles";
import {
  TEST_MODE_TARGET_ENTITY_LOGICAL_NAME,
  TEST_MODE_TARGET_RECORDS,
  TEST_MODE_KNOWN_COLUMNS,
  TestModeIconCandidate,
  filterTestModeRecords,
  resolveTestModeIconCandidates,
  resolveTestModeIconForRecord,
  resolveTestModeLabel,
  resolveTestModeTooltip,
  resolveTestModeContextText,
} from "./TestModeData";

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Gives the results callout its own dedicated LayerHost element, appended directly as a child of
// `document.body`, instead of trusting Fluent's un-configured default target. Two separate, real
// ways a callout can end up clipped by "the boundaries of the container around it" on a live
// Dataverse form, neither reproducible with a plain overflow:hidden ancestor alone (confirmed in
// local harness testing - that case already escapes correctly via Fluent's own default
// `.ms-Layer--fixed` behavior):
//   1. A CSS `transform`/`filter`/`perspective`/`will-change` on some ancestor between the field
//      and <body> (a common real-world pattern for GPU-compositing a scroll/animation container in
//      a large SPA shell) makes that ancestor the CSS containing block for any `position: fixed`
//      descendant - including a Layer host - so a fixed popup nested anywhere under it is
//      constrained to that ancestor's own box, not the real viewport, no matter how high its
//      z-index is set.
//   2. This control shares the EXACT SAME Fluent 8.29.0 module instance as the model-driven app
//      shell itself (externalized via <platform-library name="Fluent">, not bundled), and Fluent's
//      Layer/Callout hostId resolution reads a module-level singleton (`Customizations`) - if the
//      host app has scoped its own default Layer host anywhere (e.g. to a specific app-shell
//      region, for its own dialogs/panels), every Layer-based popup sharing that module instance
//      can be silently redirected into it, including this one.
// The host is created with plain, imperative `document.createElement`/`appendChild` (see the
// `useEffect` below), NOT Fluent's own exported `<LayerHost>` React component rendered via
// `ReactDOM.createPortal` - that would require bundling the whole `react-dom` package ourselves
// (it is NOT one of this control's externalized <platform-library> resources, unlike React and
// Fluent, so importing it directly adds ~700KB of unminified react-dom to this control's own
// bundle for a single API). Fluent's `Layer.hostId` resolution is a plain `document.getElementById`
// lookup, not a React-tree relationship - once Fluent finds our real element by id, IT renders the
// actual Callout content into it using its own already-loaded, shared react-dom, so nothing here
// needs to touch react-dom at all. Appending straight to `document.body` (never nested under
// wherever this control's own React tree happens to sit in the form's DOM) is what defeats (1);
// explicitly setting `calloutProps.layerProps.hostId` to point at this element unconditionally,
// rather than leaving it undefined and letting Fluent consult its own ambient default, is what
// defeats (2). `position: fixed` + `inset 0` gives the callout's own internal position math (which
// is always computed against the real viewport, not the host element's own box) the full browser
// viewport to work with, same as Fluent's own unconfigured default. `pointerEvents: "none"` is
// required: it's an empty full-viewport box sitting on top of the page whenever mounted, and would
// otherwise swallow clicks meant for whatever is underneath it even while no callout is open (the
// callout's own rendered content re-enables pointer events normally once Fluent renders into it).
let layerHostIdCounter = 0;
const nextLayerHostId = (): string => `lops-alu-layerhost-${++layerHostIdCounter}`;

interface IEntityMeta {
  entitySetName: string;
  primaryIdAttribute: string;
  primaryNameAttribute: string;
}

interface IAttributeMeta {
  logicalName: string;
  attributeType: string;
  attributeTypeName?: string;
}

// One entry per semicolon-separated name in Icon Column (see parseColumnList), classified from
// its real column type: an Image column, a non-image ("text") column holding a per-record MDL2
// icon name, or a Choice ("choice") column whose selected option's label (not its underlying
// numeric value) is resolved the same way a "text" value is. "fixed" is NOT derived from an
// unmatched column name anymore - it used to be (a name not found on the target table was treated
// as a literal icon name), but that made an honest typo in Icon Column silently invisible to the
// config validator, which the user flagged directly: every other column property's typos get
// caught, Icon Column's didn't. Icon Column's every entry must now be a real column (validated in
// configErrors same as Label/Tooltip/Additional Search Columns) - a "fixed" candidate is instead
// built, at most once, from the new dedicated `iconFixedName` property and always appended as the
// lowest-priority entry in the resolved chain (see the resolveMetadata effect).
type IconCandidateKind = "image" | "text" | "choice" | "fixed";
interface IconCandidate {
  kind: IconCandidateKind;
  // For a plain entry, a column on THIS record's own entity. For a "<lookupField>.<column>"
  // dot-notation entry (see IIconColumnRef/parseIconColumnRef below), the column to read on
  // lookupTargetEntityLogicalName instead - never both at once.
  column?: string; // "image" | "text" | "choice"
  fixedValue?: string; // "fixed"
  // Set only when this candidate came from a "<lookupField>.<column>" entry - the logical name of
  // the Lookup/Owner/Customer field on THIS entity that points at the related record `column`
  // actually lives on. Its presence (not `kind`) is what forces this candidate through the async
  // resolution path (see resolveIconForRecord/needsAsyncIconResolution) - none of image/text/choice
  // can be read straight out of this record's own $select response when it's set, since the value
  // being rendered isn't on this entity at all.
  lookupFieldLogicalName?: string;
  // The entity `lookupFieldLogicalName` resolves to (single-target Lookups only - same deliberate
  // constraint as resolveTargetEntityType's own polymorphic-field limitation elsewhere in this
  // file). Only ever set alongside lookupFieldLogicalName.
  lookupTargetEntityLogicalName?: string;
  // lookupTargetEntityLogicalName's own EntitySetName - needed to address the related record via
  // a raw Web API URL (fetchImageUrl's /$value fetch, or the plain $select fetch a dot-notation
  // text/choice candidate needs - see resolveDotNotationIconValue). Resolved once per distinct
  // target entity, not per candidate or per record.
  lookupTargetEntitySetName?: string;
}

// Icon Column's fallback-chain entries (see parseColumnList) normally name a column on this
// record's own entity. Each entry ALSO accepts "<lookupField>.<column>" dot notation -
// e.g. "lops_tableb.lops_thumbnail" - to instead pull that candidate's icon from the record a
// Lookup/Owner/Customer field on this entity points to, rather than anything stored on this record
// itself. Mirrors RelationshipView's identical thumbnailColumnName dot-notation convention
// (parseThumbnailColumnName/IThumbnailColumnRef in RelationshipViewControl.tsx) - same syntax, same
// single-target-Lookup-only constraint, ported here to work per-entry across a fallback chain and
// across all three of Icon Column's candidate kinds (image/text/choice), not just one column.
interface IIconColumnRef {
  lookupFieldLogicalName?: string;
  columnLogicalName: string;
}

function parseIconColumnRef(entry: string): IIconColumnRef {
  const dotIndex = entry.indexOf(".");
  if (dotIndex <= 0 || dotIndex === entry.length - 1) return { columnLogicalName: entry };
  return { lookupFieldLogicalName: entry.slice(0, dotIndex), columnLogicalName: entry.slice(dotIndex + 1) };
}

// A Choice column's selected-option label (see IconCandidateKind's "choice") is maker-authored
// free text, not a controlled vocabulary - it can name either an MDL2 icon (e.g. "Balance") or a
// web resource image file (e.g. "lops_status_icon.png"). There's no metadata to disambiguate the
// two ahead of time, so the label's own file extension is the only signal: anything ending in a
// common image extension is treated as a web resource, everything else as an MDL2 icon name.
const WEB_RESOURCE_ICON_PATTERN = /\.(png|jpe?g|gif|svg|ico|bmp)$/i;

// Published web resources are served at this path relative to the org's own root - deliberately a
// relative URL, not built from context.page.getClientUrl(), since the control already runs same-
// origin with the model-driven app that hosts it and a relative path sidesteps ever needing to
// plumb the client URL through as its own prop.
function webResourceIconUrl(label: string): string {
  return `/webresources/${encodeURIComponent(label.trim())}`;
}

// Shared by resolveIconValueSync and resolveIconForRecord: given a Choice column's resolved
// option label, decide whether it names an MDL2 icon or a web resource image - see
// WEB_RESOURCE_ICON_PATTERN's comment.
function resolveChoiceIconLabel(label: string): { iconValue?: string; thumbnailUrl?: string } {
  const trimmed = label.trim();
  if (!trimmed) return {};
  if (WEB_RESOURCE_ICON_PATTERN.test(trimmed)) return { thumbnailUrl: webResourceIconUrl(trimmed) };
  return { iconValue: trimmed };
}

// Choice Column's resolved value is its FormattedValue annotation (the option's label), never its
// raw numeric value - same annotation-preferred pattern readTooltipValue already uses, but here
// the annotation IS the only usable value (the raw value is a meaningless integer for this
// purpose), so there's no raw fallback.
function readChoiceLabel(record: ComponentFramework.WebApi.Entity, column: string): string | undefined {
  return record[`${column}@OData.Community.Display.V1.FormattedValue`] as string | undefined;
}

interface ITargetRecordData {
  id: string;
  // The target table's true primary name attribute value - always sent as the committed
  // LookupValue's `name`, regardless of labelColumnName, since that's the field Dataverse itself
  // treats as the record's real name (and recalculates on its own on save/reload anyway).
  name: string;
  // What's actually shown in the dropdown/selected field - labelColumnName's value when
  // configured, otherwise the same as `name`. See labelColumnName below.
  displayName: string;
  // Winning result of the Icon Column fallback chain for this record - a per-record MDL2 icon
  // name (a "text"-kind candidate) or a literal configured icon name (a "fixed"-kind candidate).
  // Unset when the winning candidate was "image" instead (see thumbnailUrls, keyed separately).
  iconValue?: string;
  tooltipValue?: string;
  // Additional Display Columns' resolved text for this record, already joined - see
  // buildContextText. Only ever computed for search results (dropdown rows), never for the
  // selected record - the context line is deliberately dropdown-only, not shown on the resting
  // selected-value pill (an explicit user decision: the pill stays a single compact line, matching
  // its existing pixel-matched parity with the native Dataverse lookup field's own selected view).
  contextText?: string;
}

export interface IAdvancedLookUpProps {
  lookupValueProperty: ComponentFramework.PropertyTypes.LookupProperty;
  // Semicolon-separated fallback chain - "lops_col1;lops_col2" tries lops_col1 first, falls
  // through to lops_col2 if that record's value there is blank, and so on. See parseColumnList
  // and IconCandidate. A single name (no semicolon) behaves exactly as before.
  iconColumnName?: string;
  // Literal MDL2 icon name, tried last after every entry in iconColumnName's own chain has been
  // tried and come up empty (or shown for every record when iconColumnName is blank entirely).
  // Deliberately a separate property from iconColumnName - see IconCandidateKind's comment for why.
  iconFixedName?: string;
  iconShape: IconShape;
  iconBackgroundColor?: string;
  // Hex color applied to MDL2 icon glyphs only - never to picture/web-resource images, which
  // carry their own colors and aren't recolorable via CSS the same way.
  iconColor?: string;
  // Hex color behind the selected record's icon+name chip in the pill display (see isEditing).
  // Always arrives with a value - index.ts falls back to "#EDF3FB" (the out-of-the-box Dataverse
  // lookup's own chip color, pixel-matched against a screenshot) when the maker hasn't overridden
  // the manifest's own matching default-value.
  recordBackdropColor: string;
  // Semicolon-separated fallback chain, same syntax as iconColumnName above.
  tooltipColumnName?: string;
  // Semicolon-separated fallback chain, same syntax as iconColumnName above. Purely a display
  // override either way - the committed LookupValue's `name` is still always the true primary
  // name (see ITargetRecordData.name).
  labelColumnName?: string;
  // Comma-separated, NOT semicolon - a deliberately different delimiter/semantic from the three
  // properties above. This isn't a fallback chain: every listed column is searched at once
  // (OR'd together), not tried in priority order, so "first non-empty wins" doesn't apply here.
  searchColumns?: string;
  // Optional, single column (not a fallback chain - a sort only has one key). Always ascending -
  // there's no separate direction property, per an explicit "should always be ascending" request.
  // Falls back to the target table's own primary name column when blank - see runSearch's
  // effectiveSortColumn. Both text and number columns are supported: OData's $orderby sorts by
  // whatever the underlying attribute's own type is, with no type-specific handling needed on this
  // side (unlike Icon Column, which genuinely needs to know the column's type to render correctly).
  sortColumnName?: string;
  // Semicolon-separated, but NOT a fallback chain like Icon/Tooltip/Label Column above - every
  // listed column's value is shown together (joined, first-non-empty-per-column, not
  // first-non-empty-across-the-whole-list). Semicolon was still the more natural delimiter choice
  // here (an explicit user request) even though it means something different from the fallback-
  // chain semicolon elsewhere in this file - worth remembering if touching this again, since it's
  // the one property where semicolon does NOT mean "priority order, first wins" like everywhere
  // else it appears on this control. Dropdown rows only - see ITargetRecordData.contextText.
  additionalDisplayColumns?: string;
  showInactiveRecords: boolean;
  resultLimit: number;
  componentHeight: "Tall" | "Short";
  placeholderText: string;
  isDisabled: boolean;
  webAPI: ComponentFramework.WebApi;
  navigation: ComponentFramework.Navigation;
  isTestMode: boolean;
  onSelect: (value: ComponentFramework.LookupValue | undefined) => void;
}

// Confirmed via a real console error report ("u.getTargetEntityType is not a function"), not a
// hypothetical: the Power Apps table/form designer's own live property-panel preview hands
// controls a LookupProperty object that does NOT implement getTargetEntityType() at all, despite
// @types/powerapps-component-framework declaring it as always present. Every downstream metadata
// call (icon column type detection, and - the thing that actually surfaced this - the config
// validator's column-existence checks) depends on resolving the target entity first, so this one
// missing method was silently disabling all of it there, not a timing/race issue as first
// suspected. `attributes` is the fallback: LookupProperty's own declared type doesn't narrow it
// past the base Property.attributes: Metadata|undefined, but the real object still carries
// `{ Targets: string[] }` for a Lookup-typed property (see LookupMetadata in the same type
// definitions) - metadata attached directly to the property object, not a method requiring a
// live-bound record, so it plausibly survives in a reduced preview context where the method
// doesn't. Single-target lookups only, same deliberate constraint as getTargetEntityType() itself
// already has (a polymorphic Targets array has no single safe answer either way). Last resort:
// an already-selected value's own entityType, if there is one.
function resolveTargetEntityType(lookupProperty: ComponentFramework.PropertyTypes.LookupProperty): string | undefined {
  if (typeof lookupProperty.getTargetEntityType === "function") {
    try {
      const fromMethod = lookupProperty.getTargetEntityType();
      if (fromMethod) return fromMethod;
    } catch (err) {
      console.error("AdvancedLookUp: getTargetEntityType() threw, falling back to attribute metadata", err);
    }
  }
  const targets = (lookupProperty as unknown as { attributes?: { Targets?: string[] } }).attributes?.Targets;
  if (targets && targets.length === 1) return targets[0];
  return lookupProperty.raw?.[0]?.entityType;
}

async function resolveEntityMetadata(entityLogicalName: string): Promise<IEntityMeta> {
  const url = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')?$select=EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to resolve entity metadata (${response.status} ${response.statusText})`);
  }
  const data = (await response.json()) as { EntitySetName: string; PrimaryIdAttribute: string; PrimaryNameAttribute: string };
  return { entitySetName: data.EntitySetName, primaryIdAttribute: data.PrimaryIdAttribute, primaryNameAttribute: data.PrimaryNameAttribute };
}

// AttributeTypeName distinguishes an Image column from a plain text column - both otherwise
// report AttributeType "Virtual"/"String" ambiguously, same distinction RelationshipView's
// thumbnailColumnName resolution already relies on.
async function resolveIconColumnMeta(entityLogicalName: string, logicalName: string): Promise<IAttributeMeta | undefined> {
  const escaped = logicalName.replace(/'/g, "''");
  const url = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes?$select=LogicalName,AttributeType,AttributeTypeName&$filter=LogicalName eq '${escaped}'`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to resolve icon column metadata (${response.status} ${response.statusText})`);
  }
  const data = (await response.json()) as { value: { LogicalName: string; AttributeType: string; AttributeTypeName?: { Value: string } }[] };
  const found = data.value[0];
  if (!found) return undefined;
  return { logicalName: found.LogicalName, attributeType: found.AttributeType, attributeTypeName: found.AttributeTypeName?.Value };
}

// Backs validateConfig()'s column-existence checks (Label Column / Tooltip Column / Additional
// Search Columns / Additional Display Columns) AND Additional Display Columns' need to know which
// configured columns are Lookup-like (see isLookupLikeAttributeType below) - one call for the whole
// attribute list rather than one filtered call per configured column (the pattern
// resolveIconColumnMeta uses), same reasoning as before: a single pass over every attribute answers
// both "does this name exist" and "what type is it" at once. Returns a Map (logical name -> Dataverse
// AttributeType) rather than a Set now that a second property needs more than yes/no - callers that
// only need existence still just call `.has(name)`, identical to when this returned a Set.
async function resolveAttributeLogicalNames(entityLogicalName: string): Promise<Map<string, string>> {
  const url = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes?$select=LogicalName,AttributeType`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to resolve attribute list (${response.status} ${response.statusText})`);
  }
  const data = (await response.json()) as { value: { LogicalName: string; AttributeType?: string }[] };
  return new Map(data.value.map((a) => [a.LogicalName.toLowerCase(), a.AttributeType || ""]));
}

// Backs Icon Column's "<lookupField>.<column>" dot notation (see IIconColumnRef/parseIconColumnRef)
// - resolves which table a Lookup/Owner/Customer field on entityLogicalName actually points to, so
// the dot's right-hand column can then be classified/fetched against THAT table instead of this
// one. Directly mirrors RelationshipView's identical resolveLookupThumbnailMeta helper (same
// endpoint, same single-target-only constraint - a polymorphic field's Targets array has more than
// one entry and there's no per-record way to know which one a given value actually resolved to
// without an extra call per record, so this deliberately just uses Targets[0]).
async function resolveLookupTargetEntityLogicalName(entityLogicalName: string, lookupFieldLogicalName: string): Promise<string | undefined> {
  const escaped = lookupFieldLogicalName.replace(/'/g, "''");
  const url = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${escaped}')/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=Targets`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to resolve lookup field "${lookupFieldLogicalName}" (${response.status} ${response.statusText})`);
  }
  const data = (await response.json()) as { Targets?: string[] };
  return data.Targets?.[0];
}

// Backs Additional Search Column's Lookup/Owner/Customer support (see runSearch/configErrors) -
// resolves the REAL single-valued navigation-property name for a lookup field, needed to filter
// into the related record's own primary name via OData nav-property syntax
// (`contains(<navProperty>/<relatedAttribute>,'text')`). Unlike resolveLookupTargetEntityLogicalName
// above, this cannot be sidestepped or approximated - OData navigation-property filtering has no
// GUID-based alternative, and the navigation property name is NOT reliably the same as the
// attribute's own logical name (it can be renamed independently, under "Referencing Entity
// Navigation Property Name", in Advanced Find's relationship customization) - so it's resolved
// properly here via the ManyToOneRelationships metadata endpoint, filtered to the one relationship
// this specific attribute backs, rather than guessed.
async function resolveLookupNavigationPropertyName(entityLogicalName: string, lookupFieldLogicalName: string): Promise<string | undefined> {
  const escaped = lookupFieldLogicalName.replace(/'/g, "''");
  const url = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/ManyToOneRelationships?$filter=ReferencingAttribute eq '${escaped}'&$select=ReferencingEntityNavigationPropertyName`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to resolve navigation property for lookup field "${lookupFieldLogicalName}" (${response.status} ${response.statusText})`);
  }
  const data = (await response.json()) as { value: { ReferencingEntityNavigationPropertyName?: string }[] };
  return data.value[0]?.ReferencingEntityNavigationPropertyName;
}

// A Lookup, Owner (ownerid - polymorphic user/team), and Customer (polymorphic account/contact)
// attribute are all bound in the Web API under `_<name>_value`, never the bare logical name -
// unlike every other attribute type, where the logical name is exactly what you $select and read
// back. This is the one thing Additional Display Columns needs type metadata for at all; once the
// right key is known, reading the value is identical for every type (see readContextColumnValue).
function isLookupLikeAttributeType(attributeType: string | undefined): boolean {
  return attributeType === "Lookup" || attributeType === "Owner" || attributeType === "Customer";
}

// Dataverse's Web API `contains()` OData filter function only works on a String/Memo (text)
// column - calling it on any other AttributeType (Picklist, Lookup, Boolean, DateTime, Money,
// whole/decimal number, ...) throws a 400 for the WHOLE query, not just that one clause. Backs two
// things in runSearch: (1) Additional Search Column's own config-error check, since that property
// is explicitly search-only, so a non-text entry there is an outright maker mistake worth flagging
// the same way every other column property's typos already are; (2) silently filtering which
// labelColumnNames entries are safe to fold into the search filter (see runSearch's own comment -
// Label Column is a display-first property, not search-only, so a non-text entry there is only
// skipped, never reported as a config error).
function isTextSearchableAttributeType(attributeType: string | undefined): boolean {
  return attributeType === "String" || attributeType === "Memo";
}

// The actual $select/response key for a configured Additional Display Columns entry - `_col_value`
// for a Lookup-like column, the bare logical name for everything else (Choice, Status, State,
// Money, DateTime, whole/decimal number, plain text - the FormattedValue annotation covers all of
// these identically once the underlying key is right, so no further per-type branching is needed
// anywhere else). Falls back to the bare name when the type hasn't resolved yet (a narrow startup
// window before knownColumnNames populates) - worst case a genuinely Lookup-type column silently
// shows nothing for that one render until metadata resolves, rather than erroring the query.
function contextSelectKey(column: string, attributeTypesByName: Map<string, string> | undefined): string {
  const type = attributeTypesByName?.get(column.toLowerCase());
  return isLookupLikeAttributeType(type) ? `_${column}_value` : column;
}

// Prefers the FormattedValue annotation Dataverse attaches to virtually every "display" column
// type - Choice/Status/State's option label, Lookup/Owner/Customer's referenced record name,
// Currency's symbol-plus-amount string, a localized date/number rendering - falling back to the
// raw value only when no annotation is present (plain text columns, mostly). This is what makes
// Additional Display Columns type-agnostic on the read side: the only type-specific step anywhere
// in this feature is contextSelectKey's key choice above: once that key is right, every column
// type reads back through this exact same path.
function readContextColumnValue(record: ComponentFramework.WebApi.Entity, column: string, attributeTypesByName: Map<string, string> | undefined): string | undefined {
  const key = contextSelectKey(column, attributeTypesByName);
  const formatted = record[`${key}@OData.Community.Display.V1.FormattedValue`] as string | undefined;
  if (formatted) return formatted;
  const raw = record[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  return String(raw);
}

// Additional Display Columns' own resolution: every configured column's value is shown (not a
// fallback chain - see the property's own comment on IAdvancedLookUpProps for why semicolon means
// something different here than everywhere else it appears on this control), joined into one line
// with a middle dot separator. A column with no value on this particular record is simply omitted
// from the joined string, rather than showing an empty gap between separators.
function buildContextText(record: ComponentFramework.WebApi.Entity, columnNames: string[], attributeTypesByName: Map<string, string> | undefined): string | undefined {
  const parts = columnNames.map((c) => readContextColumnValue(record, c, attributeTypesByName)).filter((v): v is string => !!v);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

// Same raw-fetch-plus-Blob technique RelationshipView's fetchThumbnailUrl uses for an Image
// column's /$value bytes - the Web API's own content type header for this endpoint isn't
// reliably an image/* type, so it's forced explicitly when re-wrapping into a Blob.
async function fetchImageUrl(entitySetName: string, id: string, columnLogicalName: string): Promise<string | undefined> {
  const url = `/api/data/v9.2/${entitySetName}(${id})/${columnLogicalName}/$value`;
  const response = await fetch(url, { headers: { Accept: "*/*" } });
  if (!response.ok) return undefined;
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) return undefined;
  const contentType = response.headers.get("Content-Type") || "";
  const blob = new Blob([buffer], { type: contentType.startsWith("image/") ? contentType : "image/png" });
  return URL.createObjectURL(blob);
}

// Resolves ONE dot-notation Icon Column candidate's value for ONE already-known related record id -
// the async counterpart to resolveIconValueSync's plain text/choice branches and fetchImageUrl's
// image branch, just addressed at lookupTargetEntitySetName/targetId instead of this record's own
// entity set. A raw same-origin fetch, not context.webAPI.retrieveRecord, matching every other
// metadata/value call in this file (resolveEntityMetadata, resolveIconColumnMeta,
// resolveAttributeLogicalNames, fetchImageUrl) - this function is module-level, outside the React
// component, with no access to the webAPI prop anyway. Callers (resolveIconForRecord) are expected
// to memoize this per {targetEntity, targetId, column, kind} so N rows sharing the same related
// record only trigger one fetch, not N - see dotNotationIconCacheRef in the component.
async function resolveDotNotationIconValue(candidate: IconCandidate, targetId: string): Promise<{ iconValue?: string; thumbnailUrl?: string }> {
  const targetEntitySetName = candidate.lookupTargetEntitySetName;
  const column = candidate.column;
  if (!targetEntitySetName || !column) return {};
  if (candidate.kind === "image") {
    const url = await fetchImageUrl(targetEntitySetName, targetId, column);
    return url ? { thumbnailUrl: url } : {};
  }
  const url = `/api/data/v9.2/${targetEntitySetName}(${targetId})?$select=${column}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return {};
  const record = (await response.json()) as ComponentFramework.WebApi.Entity;
  if (candidate.kind === "choice") {
    const label = readChoiceLabel(record, column);
    return label ? resolveChoiceIconLabel(label) : {};
  }
  const v = record[column] as string | undefined;
  return v ? { iconValue: v } : {};
}

// Shared fallback-chain syntax for Icon Column/Tooltip Column/Label Column: semicolon-separated
// column names, tried in order, first one with a non-empty value on a given record wins. Comma is
// deliberately NOT reused here - searchColumns already means something different with commas
// (search every listed column at once, unioned via OR), and overloading the same delimiter for a
// completely different "try these in priority order" semantic would be actively confusing on a
// property right next to it in the properties panel.
function parseColumnList(value: string | undefined): string[] {
  return (value || "")
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function buildSelectColumns(
  entityMeta: IEntityMeta,
  iconCandidates: IconCandidate[],
  tooltipColumnNames: string[],
  labelColumnNames: string[],
  // Optional - only runSearch's own call site passes these (the context line is dropdown-rows
  // only, never resolved for the single already-selected record loadSelected fetches - see
  // ITargetRecordData.contextText), so loadSelected's call site can omit both and get the exact
  // same $select list it always has.
  additionalDisplayColumnNames: string[] = [],
  attributeTypesByName?: Map<string, string>
): string[] {
  const cols = new Set<string>([entityMeta.primaryIdAttribute, entityMeta.primaryNameAttribute]);
  // Image candidates are deliberately NOT $select'd - their bytes never come back inline via
  // $select regardless (see fetchImageUrl's separate /$value fetch), so there's nothing to ask
  // for here.
  iconCandidates.forEach((c) => {
    // A dot-notation candidate's own column lives on a DIFFERENT entity and cannot be $select'd
    // through a nav property here - only the lookup field itself, as `_<field>_value`, so the
    // related record's id is known per row. See resolveDotNotationIconValue for how that id is
    // then used to fetch the actual value (a second round trip, deliberately not $expand - see
    // the resolveMetadata effect's comment on why).
    if (c.lookupFieldLogicalName) {
      cols.add(`_${c.lookupFieldLogicalName}_value`);
      return;
    }
    if ((c.kind === "text" || c.kind === "choice") && c.column) cols.add(c.column);
  });
  tooltipColumnNames.forEach((c) => cols.add(c));
  labelColumnNames.forEach((c) => cols.add(c));
  // contextSelectKey, not the bare name - a Lookup/Owner/Customer column must be $select'd as
  // `_col_value`, never its bare logical name (see contextSelectKey's own comment for why).
  additionalDisplayColumnNames.forEach((c) => cols.add(contextSelectKey(c, attributeTypesByName)));
  return Array.from(cols);
}

// Label Column's fallback chain: first configured column with a non-empty value on this record
// wins; an empty chain, or every entry blank on this particular record, falls back to the true
// primary name - never shows an empty label just because every configured override happens to be
// unpopulated on that particular row.
function resolveDisplayName(record: ComponentFramework.WebApi.Entity, primaryName: string, labelColumnNames: string[]): string {
  for (const col of labelColumnNames) {
    const v = record[col] as string | undefined;
    if (v) return v;
  }
  return primaryName;
}

// Tooltip Column's fallback chain - same "first non-empty wins" priority order as
// resolveDisplayName, checked per-column (formatted value preferred, then raw) before moving to
// the next candidate, not just once across the whole configured value.
function readTooltipValue(record: ComponentFramework.WebApi.Entity, tooltipColumnNames: string[]): string | undefined {
  for (const col of tooltipColumnNames) {
    const formatted = record[`${col}@OData.Community.Display.V1.FormattedValue`] as string | undefined;
    const v = formatted ?? (record[col] as string | undefined);
    if (v) return v;
  }
  return undefined;
}

// Icon Column's fallback chain, synchronous-only branch: used when NO candidate in the whole list
// is an "image" kind or a dot-notation ("<lookupField>.<column>") entry, so every candidate can be
// resolved straight from the record payload already in hand - no fetch needed, so no reason to make
// this async and pay an extra render/microtask for the common (still the most common)
// all-text-or-fixed-or-choice case. A "choice" candidate is still resolvable synchronously even
// though it can produce a thumbnailUrl (a web resource reference is just a relative URL string, not
// a fetch) - only real Image columns and dot-notation entries need a round trip. See
// resolveIconForRecord for the general (possibly-async) version used whenever either is present
// anywhere in the chain - callers must only reach for this one when they've confirmed neither is
// (see needsAsyncIconResolution at the call sites). The `lookupFieldLogicalName` guards below are
// defensive, not load-bearing - see resolveIconForRecord's own comment for why they should never
// actually be reached.
function resolveIconValueSync(candidates: IconCandidate[], record: ComponentFramework.WebApi.Entity): { iconValue?: string; thumbnailUrl?: string } {
  for (const c of candidates) {
    if (c.kind === "fixed") return { iconValue: c.fixedValue };
    if (c.lookupFieldLogicalName) continue; // dot notation always needs resolveIconForRecord instead
    if (c.kind === "text" && c.column) {
      const v = record[c.column] as string | undefined;
      if (v) return { iconValue: v };
      continue;
    }
    if (c.kind === "choice" && c.column) {
      const label = readChoiceLabel(record, c.column);
      if (label) return resolveChoiceIconLabel(label);
      continue;
    }
  }
  return {};
}

// General Icon Column fallback-chain resolution, for whenever at least one candidate is an
// "image" kind and/or a dot-notation ("<lookupField>.<column>") entry (mixed with plain text/fixed/
// choice candidates, or purely async ones) - walks candidates in configured order, checking each
// synchronously (plain text/fixed/choice) or via a real fetch (image, or ANY dot-notation entry
// regardless of its own kind - see IconCandidate.lookupFieldLogicalName), and stops at the first one
// that actually produces a value. This is the only way to respect a mixed chain's priority order
// correctly: whether an image or dot-notation candidate is "empty" can only be known by actually
// fetching it (Dataverse doesn't return Image-column presence inline via $select, and a
// dot-notation candidate's value isn't on this record's own $select response at all - only the
// related record's id is, via `_<lookupField>_value`), so a candidate earlier in the list can't be
// skipped without first resolving it.
//
// dotNotationCache is an optional {targetEntity}::{targetId}::{column}::{kind} -> Promise map
// (created once per mounted control instance - see dotNotationIconCacheRef in the component) so
// that when several rows in one search batch resolve to the SAME related record (a common case -
// e.g. many child records all pointing at the same "Type" parent), that related record's value is
// only ever fetched once, not once per row. Memoizing the in-flight Promise itself (not just the
// resolved value) is what also de-dupes concurrent callers racing on the same key, not only
// sequential ones.
async function resolveIconForRecord(
  candidates: IconCandidate[],
  record: ComponentFramework.WebApi.Entity,
  entitySetName: string,
  recordId: string,
  dotNotationCache?: Map<string, Promise<{ iconValue?: string; thumbnailUrl?: string }>>
): Promise<{ iconValue?: string; thumbnailUrl?: string }> {
  for (const c of candidates) {
    if (c.kind === "fixed") return { iconValue: c.fixedValue };
    if (c.lookupFieldLogicalName) {
      // The related record's id lives on THIS record, under the lookup's own `_<field>_value` key
      // (see buildSelectColumns) - not the target column's value, which is never on this entity at
      // all. A blank lookup on this particular record is simply "this candidate is empty here",
      // same as a blank text/choice column would be - fall through to the next candidate.
      const targetId = record[`_${c.lookupFieldLogicalName}_value`] as string | undefined;
      if (!targetId) continue;
      const cacheKey = `${c.lookupTargetEntityLogicalName}::${targetId}::${c.column}::${c.kind}`;
      let pending = dotNotationCache?.get(cacheKey);
      if (!pending) {
        pending = resolveDotNotationIconValue(c, targetId);
        dotNotationCache?.set(cacheKey, pending);
      }
      const result = await pending;
      if (result.iconValue !== undefined || result.thumbnailUrl !== undefined) return result;
      continue;
    }
    if (c.kind === "text" && c.column) {
      const v = record[c.column] as string | undefined;
      if (v) return { iconValue: v };
      continue;
    }
    if (c.kind === "choice" && c.column) {
      const label = readChoiceLabel(record, c.column);
      if (label) return resolveChoiceIconLabel(label);
      continue;
    }
    if (c.kind === "image" && c.column) {
      const url = await fetchImageUrl(entitySetName, recordId, c.column);
      if (url) return { thumbnailUrl: url };
      continue;
    }
  }
  return {};
}

export const AdvancedLookUpControl: React.FC<IAdvancedLookUpProps> = (props) => {
  const {
    lookupValueProperty,
    iconColumnName,
    iconFixedName,
    iconShape,
    iconBackgroundColor,
    iconColor,
    recordBackdropColor,
    tooltipColumnName,
    labelColumnName,
    searchColumns,
    sortColumnName,
    additionalDisplayColumns,
    showInactiveRecords,
    resultLimit,
    componentHeight,
    placeholderText,
    isDisabled,
    webAPI,
    navigation,
    isTestMode,
    onSelect,
  } = props;

  const debounceRef = React.useRef<number | undefined>(undefined);
  const searchRequestIdRef = React.useRef(0);
  const hasSearchedOnceRef = React.useRef(false);
  // Fluent's ComboBox does not open its results panel on a plain click into the input by default -
  // by design, only its caret button does that. focus(true) is the documented way to force it
  // open; it's called explicitly from the wrapper's onClick (see handleFieldClick).
  const comboBoxRef = React.useRef<IComboBox>(null);
  // Backs the native document-level "click outside" listener below (see that effect's own
  // comment) - a real DOM node reference to fieldContent's own wrapper, independent of React's
  // synthetic event system.
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  // Menu open/closed, tracked as a ref rather than state: it's only ever read from an event
  // handler, and making it state would re-render the whole control on every open/close.
  const menuOpenRef = React.useRef(false);
  // Stable for the life of this component instance - see nextLayerHostId's comment above for why
  // the results callout is pinned to a dedicated body-level host this control creates itself.
  const layerHostIdRef = React.useRef<string>();
  if (!layerHostIdRef.current) {
    layerHostIdRef.current = nextLayerHostId();
  }
  // Imperative, not JSX - see nextLayerHostId's comment above for why this deliberately isn't
  // Fluent's own <LayerHost> component rendered via ReactDOM.createPortal. Created once per mounted
  // instance and torn down on unmount; nothing else ever needs to read or write this element after
  // creation; ComboBox's calloutProps.layerProps.hostId below is what points Fluent at it.
  React.useEffect(() => {
    const host = document.createElement("div");
    host.id = layerHostIdRef.current!;
    host.style.position = "fixed";
    host.style.top = "0";
    host.style.left = "0";
    host.style.right = "0";
    host.style.bottom = "0";
    host.style.zIndex = "1000001";
    host.style.pointerEvents = "none";
    document.body.appendChild(host);
    return () => {
      document.body.removeChild(host);
    };
  }, []);
  // False = show the read-only "selected record" pill (icon + clickable link + inline clear),
  // matching the native Dataverse lookup's own resting display - see showPill below. True = show
  // the editable ComboBox for typing a new search. Starts false so a record already bound on load
  // renders straight into the pill, the same way the native control does.
  const [isEditing, setIsEditing] = React.useState(false);

  const [targetEntityLogicalName, setTargetEntityLogicalName] = React.useState<string | undefined>();
  const [entityMeta, setEntityMeta] = React.useState<IEntityMeta | undefined>();
  // Resolved Icon Column fallback chain, in configured priority order - see IconCandidate.
  const [iconCandidates, setIconCandidates] = React.useState<IconCandidate[]>([]);
  // "<lookupField>.<column>" dot-notation validation surfaces - see IIconColumnRef/parseIconColumnRef
  // and configErrors' Icon Column check below. lookupFieldTargetEntity maps a lowercased lookup
  // field logical name (referenced by at least one dot-notation Icon Column entry) to the entity it
  // resolves to; lookupTargetAttributeNames maps that resolved entity's own logical name to its
  // attribute list (mirrors knownColumnNames, just for a related table instead of this one). Both
  // populated by the same resolveMetadata effect that builds iconCandidates, resolved once per
  // DISTINCT lookup field / target entity even when several dot-notation entries share one.
  const [lookupFieldTargetEntity, setLookupFieldTargetEntity] = React.useState<Record<string, string>>({});
  const [lookupTargetAttributeNames, setLookupTargetAttributeNames] = React.useState<Record<string, Map<string, string>>>({});
  // Additional Search Column's Lookup/Owner/Customer support - see runSearch's own comment and
  // resolveLookupNavigationPropertyName. Keyed by lowercased search-column logical name; populated
  // by the same resolveMetadata effect, only for entries that actually resolve to a Lookup-like
  // AttributeType on this entity.
  const [lookupSearchColumnInfo, setLookupSearchColumnInfo] = React.useState<
    Record<string, { navigationProperty: string; relatedPrimaryNameAttribute: string }>
  >({});
  // Per-mount memoization cache for dot-notation Icon Column candidates - see resolveIconForRecord's
  // own comment for why. Reset whenever iconCandidates changes so a reconfigured Icon Column can't
  // ever serve a value cached under the previous configuration.
  const dotNotationIconCacheRef = React.useRef<Map<string, Promise<{ iconValue?: string; thumbnailUrl?: string }>>>(new Map());
  // The target table's full set of attribute logical names, lowercased - undefined until resolved
  // (real mode: after one EntityDefinitions Attributes call; test mode: set synchronously to
  // TEST_MODE_KNOWN_COLUMNS). validateConfig() deliberately skips its column-existence checks
  // entirely while this is undefined, mirroring QuickActionButtons' "don't report every field as
  // missing before the form has loaded" rule - see validateConfig below.
  // Map, not a Set, now that Additional Display Columns needs each entry's AttributeType too
  // (see resolveAttributeLogicalNames/isLookupLikeAttributeType) - existence checks below still
  // read via `.has(name)`, identical to when this was a plain Set.
  const [knownColumnNames, setKnownColumnNames] = React.useState<Map<string, string> | undefined>();

  // The query the user is currently typing. Deliberately NOT fed back into the ComboBox's `text`
  // prop - while allowFreeform is on, the ComboBox already renders its own internal "pending
  // value" in the input, and changing `text` on every keystroke makes its componentDidUpdate call
  // _onFocus() (which does inputElement.select()) on each one. This state is only the search
  // query: what to filter on, and what the test-mode result caption reports.
  const [searchText, setSearchText] = React.useState("");
  const [options, setOptions] = React.useState<IComboBoxOption[]>([]);
  // Set once the user takes over the highlight with the arrow keys, which hands the top-match
  // affordance back to Fluent's own keyboard navigation until the next query. Reset on every
  // new search.
  const [userNavigated, setUserNavigated] = React.useState(false);
  const [recordDataById, setRecordDataById] = React.useState<Record<string, ITargetRecordData>>({});
  const [thumbnailUrls, setThumbnailUrls] = React.useState<Record<string, string>>({});
  // Reset both whenever iconCandidates changes (Icon Column reconfigured - discovered live while
  // testing dot notation, but not specific to it: switching Icon Column from an Image-kind column
  // to a text/choice one for the SAME already-rendered record id previously left that record's OLD
  // thumbnailUrls entry behind forever, since runSearch/loadSelected only ever ADD to thumbnailUrls
  // (`setThumbnailUrls(prev => ({...prev, ...newThumbnailUrls}))`), never remove a now-stale entry -
  // so a record with no thumbnail under the NEW config kept rendering its OLD image anyway, since
  // onRenderOption/selectedIconElement both check `thumb` before `iconValue`. Only matters when
  // iconCandidates itself changes for an already-populated instance (in practice: the maker
  // live-editing Icon Column in the form/table designer's own preview, not a normal deployed form,
  // where it's fixed at design time) - dotNotationIconCacheRef needs the identical reset for the
  // same reason, just for the async dot-notation fetch cache instead of the rendered thumbnail map.
  React.useEffect(() => {
    dotNotationIconCacheRef.current = new Map();
    setThumbnailUrls({});
  }, [iconCandidates]);

  const [selectedId, setSelectedId] = React.useState<string | undefined>();
  // The last actually-committed selection's display name - distinct from searchText, which is
  // only the query. This is what's passed as the ComboBox's `text` prop, so it's also what the
  // field snaps back to when a freeform-typed search is abandoned without picking a list option.
  const [selectedName, setSelectedName] = React.useState("");
  const [selectedIconValue, setSelectedIconValue] = React.useState<string | undefined>();
  const [selectedTooltip, setSelectedTooltip] = React.useState<string | undefined>();
  const [selectedThumbnailUrl, setSelectedThumbnailUrl] = React.useState<string | undefined>();

  const iconColumnNames = React.useMemo(() => parseColumnList(iconColumnName), [iconColumnName]);
  const tooltipColumnNames = React.useMemo(() => parseColumnList(tooltipColumnName), [tooltipColumnName]);
  const labelColumnNames = React.useMemo(() => parseColumnList(labelColumnName), [labelColumnName]);
  // A single column, not a fallback chain - sorting only has one key, unlike Icon/Tooltip/Label
  // Column above. Trimmed once here so both configErrors and runSearch agree on the same value.
  const sortColumnLogicalName = (sortColumnName || "").trim();
  // parseColumnList (semicolon split) is reused here purely for its trim/filter-empty mechanics -
  // see additionalDisplayColumns' own comment on IAdvancedLookUpProps for why the semicolon
  // delimiter does NOT mean "fallback chain, first wins" for this particular property, unlike every
  // other caller of parseColumnList.
  const additionalDisplayColumnNames = React.useMemo(() => parseColumnList(additionalDisplayColumns), [additionalDisplayColumns]);
  // Comma-separated, NOT parseColumnList's semicolon split - see searchColumns' own comment on
  // IAdvancedLookUpProps. Memoized once here (was previously re-split inline at each of
  // configErrors/runSearch's own call sites) so resolveMetadata's Lookup-column-search resolution
  // below, configErrors, and runSearch all agree on the exact same parsed list.
  const additionalSearchColumnNames = React.useMemo(
    () =>
      (searchColumns || "")
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0),
    [searchColumns]
  );

  // Surfaces WHY column-name validation (knownColumnNames) never resolved, instead of the
  // previous behavior of silently skipping those checks forever with no visible signal at all.
  // Column-existence errors were reported as still not appearing in the form/table designer even
  // after fixing the confirmed getTargetEntityType() gap - this exists to turn the next occurrence
  // of that into a concrete, user-visible message instead of a second blind guess at the cause
  // (see resolveTargetEntityType's own comment for the lesson that motivated this: get the actual
  // failure, don't theorize past it). Deliberately non-blocking (rendered as a small note, not
  // routed into configErrors) - a transient metadata-fetch failure on an otherwise-working live
  // form should not turn the whole field into a hard red error screen, only knownColumnNames-gated
  // validation should be affected, exactly mirroring how "metadata hasn't loaded yet" already
  // doesn't block anything either.
  const [metadataDiagnostic, setMetadataDiagnostic] = React.useState<string | undefined>();

  // Same non-blocking-note treatment as metadataDiagnostic above, for the OTHER thing that can
  // silently make the results callout vanish with no visible cause: runSearch's own query
  // failing. Fluent's ComboBox does not render a callout at all when its options list is empty
  // (confirmed live), and BEFORE this diagnostic existed, a failed search's catch block just did
  // `setOptions([])` with only a console.error behind it - so a genuinely misconfigured search
  // (e.g. an Additional Search Column that predates the new text-type config-error check above, or
  // any other query-time failure this hasn't anticipated) looked EXACTLY like "typed a query, got
  // zero real matches" from the maker's side: the whole panel just disappears the instant you
  // start typing, with nothing on screen to explain why. Cleared on every new search attempt (both
  // the empty-string default search and a real query) so a fixed config's next search immediately
  // clears a stale diagnostic instead of leaving it lingering after the underlying problem is gone.
  const [searchDiagnostic, setSearchDiagnostic] = React.useState<string | undefined>();

  // Resolve target entity + icon column type(s) once (and whenever the maker changes the Icon
  // Column property). tooltipColumnName/labelColumnName need no type resolution - their values
  // are read as plain text regardless of the underlying column type, so parsing them into
  // tooltipColumnNames/labelColumnNames above is all they need.
  React.useEffect(() => {
    let cancelled = false;

    async function resolveMetadata() {
      if (isTestMode) {
        setTargetEntityLogicalName(TEST_MODE_TARGET_ENTITY_LOGICAL_NAME);
        setEntityMeta({ entitySetName: `${TEST_MODE_TARGET_ENTITY_LOGICAL_NAME}s`, primaryIdAttribute: "id", primaryNameAttribute: "name" });
        setKnownColumnNames(TEST_MODE_KNOWN_COLUMNS);
        setMetadataDiagnostic(undefined);
        return;
      }

      setMetadataDiagnostic(undefined);

      const targetEntity = resolveTargetEntityType(lookupValueProperty);
      if (!targetEntity) {
        // The one case resolveTargetEntityType itself can't distinguish from "nothing configured
        // yet": getTargetEntityType() is missing/throws AND attributes.Targets AND raw[0] are all
        // empty too. Column-name validation has no way to run without a target table, so surface
        // that plainly instead of just doing nothing with no visible cause - see
        // metadataDiagnostic's own comment above.
        setMetadataDiagnostic(
          "Could not determine the target table for this lookup in this preview context, so column-name validation (Label/Tooltip/Additional Search Columns) is unavailable here."
        );
        return;
      }
      setTargetEntityLogicalName(targetEntity);

      // Fired immediately, in parallel with resolveEntityMetadata below - it only needs
      // targetEntity, not entityMeta, so there was never a real dependency forcing it to wait.
      // (This was first suspected to be a timing race against the designer's property panel
      // remounting the control on every edit, and made concurrent for that reason - turned out to
      // be a red herring. The real cause, confirmed by a console error the user reported directly
      // - "getTargetEntityType is not a function" - was that the designer hands controls a
      // LookupProperty missing that method entirely, so `targetEntity` was never resolving to
      // begin with; see resolveTargetEntityType's own comment above. Left concurrent anyway since
      // it's a strict improvement with no downside now that targetEntity actually resolves.)
      // ownAttrNames is captured (not just pushed into state) so it can also drive the
      // Lookup-search-column resolution further down, without a second, redundant fetch of the
      // exact same attribute list.
      let ownAttrNames: Map<string, string> | undefined;
      const ownAttrNamesPromise = resolveAttributeLogicalNames(targetEntity)
        .then((names) => {
          if (!cancelled) setKnownColumnNames(names);
          ownAttrNames = names;
          return names;
        })
        .catch((err) => {
          console.error("AdvancedLookUp: failed to resolve attribute list for validation", err);
          if (!cancelled) {
            const message = err instanceof Error ? err.message : String(err);
            setMetadataDiagnostic(`Could not verify column names against table "${targetEntity}": ${message}`);
          }
          return undefined;
        });

      try {
        const meta = await resolveEntityMetadata(targetEntity);
        if (cancelled) return;
        setEntityMeta(meta);

        // One resolveIconColumnMeta call per candidate, in parallel - each entry in the fallback
        // chain is independently classified image/text/choice exactly as a single value always
        // was. AttributeType "Picklist" covers both local and global single-select Choice columns
        // identically - there's no further distinction needed here, both expose the same
        // FormattedValue annotation readChoiceLabel reads. Multi-select Choice columns
        // (AttributeType "Virtual"/AttributeTypeName "MultiSelectPicklistType") are deliberately NOT
        // matched here and fall through to "text" - a multi-value formatted string ("Option A;
        // Option B") isn't a single icon reference, and guessing which value to use would be silent,
        // wrong behavior rather than an honest unsupported case. A name with no matching metadata
        // (`!m`) produces no candidate at all here - it's now a genuine config error instead (see
        // configErrors' Icon Column check below), not an implicit fixed-icon-name fallback; see
        // IconCandidateKind's comment for why that changed.
        //
        // Each entry is first parsed for "<lookupField>.<column>" dot notation (parseIconColumnRef -
        // see IIconColumnRef). A plain entry classifies against THIS entity exactly as before; a
        // dot-notation entry classifies `column` against the RELATED entity `lookupField` resolves
        // to instead - resolved in two passes so a lookup field or target entity referenced by
        // several dot-notation entries is only ever resolved once, not once per entry:
        //   1. Every DISTINCT lookupFieldLogicalName -> its target entity (resolveLookupTargetEntityLogicalName).
        //   2. Every DISTINCT target entity found in step 1 -> its own attribute list
        //      (resolveAttributeLogicalNames, purely for configErrors' target-column-existence
        //      check below - resolveIconColumnMeta still does the actual image/text/choice
        //      classification per column, same as the plain case, since the attribute list alone
        //      can't distinguish an Image column from a plain text one - see resolveIconColumnMeta's
        //      own AttributeTypeName comment).
        // $expand was deliberately NOT used to pull the related value inline in the same query -
        // Dataverse's single-valued-navigation-property name for a Lookup field is not reliably the
        // same as its logical name (it can be customized independently in advanced find), so there
        // is no safe way to build that $expand clause from just the logical name without an extra
        // metadata call anyway - at which point a plain second fetch (resolveDotNotationIconValue,
        // deduped per related record via dotNotationIconCacheRef) is no more expensive and far less
        // fragile. Mirrors RelationshipView's identical thumbnailColumnName dot-notation feature,
        // which made the same call for the same reason.
        const iconRefs = iconColumnNames.map(parseIconColumnRef);
        const distinctLookupFields = Array.from(new Set(iconRefs.filter((r) => r.lookupFieldLogicalName).map((r) => r.lookupFieldLogicalName!)));
        const newLookupFieldTargetEntity: Record<string, string> = {};
        await Promise.all(
          distinctLookupFields.map(async (field) => {
            try {
              const target = await resolveLookupTargetEntityLogicalName(targetEntity, field);
              if (target) newLookupFieldTargetEntity[field.toLowerCase()] = target;
            } catch (err) {
              console.error(`AdvancedLookUp: failed to resolve lookup field "${field}" for Icon Column dot notation`, err);
            }
          })
        );
        if (cancelled) return;
        setLookupFieldTargetEntity(newLookupFieldTargetEntity);

        const distinctTargetEntities = Array.from(new Set(Object.values(newLookupFieldTargetEntity)));
        const newLookupTargetAttributeNames: Record<string, Map<string, string>> = {};
        const entitySetNameByEntity: Record<string, string> = {};
        await Promise.all(
          distinctTargetEntities.map(async (entity) => {
            try {
              const [attrNames, meta] = await Promise.all([resolveAttributeLogicalNames(entity), resolveEntityMetadata(entity)]);
              newLookupTargetAttributeNames[entity] = attrNames;
              entitySetNameByEntity[entity] = meta.entitySetName;
            } catch (err) {
              console.error(`AdvancedLookUp: failed to resolve metadata for Icon Column's related table "${entity}"`, err);
            }
          })
        );
        if (cancelled) return;
        setLookupTargetAttributeNames(newLookupTargetAttributeNames);

        let candidates: IconCandidate[] = [];
        if (iconRefs.length > 0) {
          const metas = await Promise.all(
            iconRefs.map((ref) => {
              const sourceEntity = ref.lookupFieldLogicalName ? newLookupFieldTargetEntity[ref.lookupFieldLogicalName.toLowerCase()] : targetEntity;
              return sourceEntity ? resolveIconColumnMeta(sourceEntity, ref.columnLogicalName) : Promise.resolve(undefined);
            })
          );
          if (cancelled) return;
          candidates = iconRefs.reduce<IconCandidate[]>((acc, ref, i) => {
            const m = metas[i];
            if (!m) return acc; // lookup field didn't resolve, or the column doesn't exist there
            const lookupField = ref.lookupFieldLogicalName;
            const lookupTargetEntityLogicalName = lookupField ? newLookupFieldTargetEntity[lookupField.toLowerCase()] : undefined;
            const lookupTargetEntitySetName = lookupTargetEntityLogicalName ? entitySetNameByEntity[lookupTargetEntityLogicalName] : undefined;
            const base = { column: ref.columnLogicalName, lookupFieldLogicalName: lookupField, lookupTargetEntityLogicalName, lookupTargetEntitySetName };
            if (m.attributeTypeName === "ImageType") acc.push({ ...base, kind: "image" });
            else if (m.attributeType === "Picklist") acc.push({ ...base, kind: "choice" });
            else acc.push({ ...base, kind: "text" });
            return acc;
          }, []);
        }
        // Fixed Icon Name is always the lowest-priority entry, appended after every real column
        // candidate above - shown once every configured column has been tried and come up empty
        // for that record, or for every record when Icon Column is left blank entirely.
        if (iconFixedName && iconFixedName.trim()) {
          candidates.push({ kind: "fixed", fixedValue: iconFixedName.trim() });
        }
        setIconCandidates(candidates);

        // Additional Search Column's Lookup/Owner/Customer support - see
        // resolveLookupNavigationPropertyName's own comment for why this can't be approximated the
        // way Icon Column's dot notation sidesteps the same uncertainty. `ownAttrNames` (this
        // entity's own attribute list, resolved above for knownColumnNames) is what identifies
        // WHICH configured search columns are actually Lookup-like in the first place - awaited
        // here rather than re-fetched, since it was already kicked off concurrently above.
        await ownAttrNamesPromise;
        if (cancelled) return;
        const lookupSearchFields = ownAttrNames
          ? additionalSearchColumnNames.filter((c) => isLookupLikeAttributeType(ownAttrNames!.get(c.toLowerCase())))
          : [];
        const newLookupSearchColumnInfo: Record<string, { navigationProperty: string; relatedPrimaryNameAttribute: string }> = {};
        await Promise.all(
          lookupSearchFields.map(async (field) => {
            try {
              const [navigationProperty, fieldTargetEntity] = await Promise.all([
                resolveLookupNavigationPropertyName(targetEntity, field),
                resolveLookupTargetEntityLogicalName(targetEntity, field),
              ]);
              if (!navigationProperty || !fieldTargetEntity) return;
              const relatedMeta = await resolveEntityMetadata(fieldTargetEntity);
              newLookupSearchColumnInfo[field.toLowerCase()] = { navigationProperty, relatedPrimaryNameAttribute: relatedMeta.primaryNameAttribute };
            } catch (err) {
              console.error(`AdvancedLookUp: failed to resolve navigation property for Additional Search Column "${field}"`, err);
            }
          })
        );
        if (cancelled) return;
        setLookupSearchColumnInfo(newLookupSearchColumnInfo);
      } catch (err) {
        if (cancelled) return;
        console.error("AdvancedLookUp: failed to resolve entity metadata", err);
        const message = err instanceof Error ? err.message : String(err);
        setMetadataDiagnostic(`Could not resolve metadata for table "${targetEntity}": ${message}`);
      }
    }

    resolveMetadata().catch((err) => console.error("AdvancedLookUp: failed to resolve metadata", err));
    return () => {
      cancelled = true;
    };
  }, [isTestMode, iconColumnNames, iconFixedName, additionalSearchColumnNames]);

  // Configuration validator, mirroring QuickActionButtons' validateActionsJson/buttonErrors
  // pattern - a red panel replaces the whole control rather than rendering a silently-broken
  // field. Column-existence checks (Icon/Label/Tooltip/Additional Search Columns) are gated on
  // knownColumnNames being resolved, so "metadata hasn't loaded yet" never gets reported as
  // "every column is missing" - see the knownColumnNames comment above. iconColumnName USED TO be
  // exempt from this check (a non-matching entry doubled as a "fixed icon name" shortcut), but that
  // meant a genuine typo there was invisible to the validator while the identical mistake in every
  // other column property was caught - reported directly by the user after the other properties'
  // checks started working. Fixed icon names now have their own dedicated property
  // (iconFixedName, never schema-checked, since it's explicitly not a column reference) so
  // iconColumnName can be validated the same as everything else with no loss of functionality.
  const configErrors = React.useMemo(() => {
    const errors: string[] = [];

    if (iconBackgroundColor && !HEX_COLOR_PATTERN.test(iconBackgroundColor.trim())) {
      errors.push(`Icon Background Color "${iconBackgroundColor}" is not a valid hex color - use a format like #0078D4 or #FFF.`);
    }

    if (iconColor && !HEX_COLOR_PATTERN.test(iconColor.trim())) {
      errors.push(`Icon Color "${iconColor}" is not a valid hex color - use a format like #0078D4 or #FFF.`);
    }

    if (recordBackdropColor && !HEX_COLOR_PATTERN.test(recordBackdropColor.trim())) {
      errors.push(`Record Backdrop Color "${recordBackdropColor}" is not a valid hex color - use a format like #EDF3FB or #FFF.`);
    }

    if (!Number.isFinite(resultLimit) || resultLimit <= 0) {
      errors.push(`Result Limit must be a positive whole number (got "${resultLimit}").`);
    }

    if (knownColumnNames) {
      const checkColumn = (label: string, value: string) => {
        if (!knownColumnNames.has(value.toLowerCase())) {
          errors.push(`${label} "${value}" was not found on table "${targetEntityLogicalName}".`);
        }
      };
      // Every entry in a fallback chain must be a real column - a typo'd second choice would
      // otherwise silently never trigger (it's only reached when the first choice is blank on a
      // given record), which is exactly the kind of quiet failure this validator exists to catch.
      // A "<lookupField>.<column>" dot-notation entry (see IIconColumnRef/parseIconColumnRef) needs
      // a different check than a plain one - checkColumn against knownColumnNames (THIS table's own
      // attributes) would always report a false "not found", since the full dotted string is never
      // itself a real column name here. Instead: the lookup field portion must be a real Lookup/
      // Owner/Customer column on THIS table (reusing the same isLookupLikeAttributeType check
      // Additional Display Columns already relies on), and the column portion is checked against
      // the RELATED table's own attribute list once resolveMetadata has resolved which table that
      // lookup points to - deferred exactly like every other knownColumnNames check while metadata
      // is still in flight (lookupFieldTargetEntity/lookupTargetAttributeNames simply won't have an
      // entry yet, so that inner check is silently skipped rather than misreported as an error).
      iconColumnNames.forEach((c) => {
        const ref = parseIconColumnRef(c);
        if (!ref.lookupFieldLogicalName) {
          checkColumn("Icon Column", c);
          return;
        }
        const fieldLower = ref.lookupFieldLogicalName.toLowerCase();
        if (!knownColumnNames.has(fieldLower)) {
          errors.push(`Icon Column "${c}" refers to lookup field "${ref.lookupFieldLogicalName}", which was not found on table "${targetEntityLogicalName}".`);
          return;
        }
        if (!isLookupLikeAttributeType(knownColumnNames.get(fieldLower))) {
          errors.push(`Icon Column "${c}" uses "." notation on "${ref.lookupFieldLogicalName}", but that column is not a lookup field.`);
          return;
        }
        const targetEntity = lookupFieldTargetEntity[fieldLower];
        const targetColumns = targetEntity ? lookupTargetAttributeNames[targetEntity] : undefined;
        if (targetColumns && !targetColumns.has(ref.columnLogicalName.toLowerCase())) {
          errors.push(`Icon Column "${c}" - column "${ref.columnLogicalName}" was not found on table "${targetEntity}" (the table "${ref.lookupFieldLogicalName}" points to).`);
        }
      });
      labelColumnNames.forEach((c) => checkColumn("Label Column", c));
      tooltipColumnNames.forEach((c) => checkColumn("Tooltip Column", c));
      // Additional Search Column is explicitly search-only (unlike Label Column, which is
      // display-first and only opportunistically folded into search when it happens to be
      // text-shaped - see runSearch's own comment), so a non-text, non-lookup entry here is an
      // outright maker mistake worth flagging the same way every other column property's typos
      // already are - Dataverse's contains() 400s the WHOLE query for the whole configured search
      // text if even one configured column isn't searchable, which otherwise silently manifested as
      // "the results callout just vanishes the moment you start typing" with no visible cause. A
      // Lookup/Owner/Customer-typed entry is NOT an error - see runSearch's own comment: it's
      // resolved (by the same resolveMetadata effect that resolves everything else here) into a
      // navigation-property search against the related record's own primary name instead of a plain
      // contains() on the (non-text) GUID value, so only a genuinely unsupported type - Choice,
      // Boolean, DateTime, Money, whole/decimal number - is flagged here.
      additionalSearchColumnNames.forEach((c) => {
        checkColumn("Additional Search Column", c);
        const attrType = knownColumnNames.get(c.toLowerCase());
        if (attrType !== undefined && !isTextSearchableAttributeType(attrType) && !isLookupLikeAttributeType(attrType)) {
          errors.push(`Additional Search Column "${c}" is a ${attrType} column - only text (String/Memo) or lookup columns can be searched.`);
        }
      });
      // Blank is valid (falls back to the primary name column - see runSearch's
      // effectiveSortColumn), so only a non-empty value gets checked here.
      if (sortColumnLogicalName) checkColumn("Sort Column", sortColumnLogicalName);
      // Every entry shown, not a fallback chain (see additionalDisplayColumns' own comment on
      // IAdvancedLookUpProps) - but still checked per-entry same as every other column property,
      // for the same reason a fallback chain's later entries are checked individually: a typo in
      // any one of them shouldn't be invisible just because it's not the first.
      additionalDisplayColumnNames.forEach((c) => checkColumn("Additional Display Column", c));
    }

    return errors;
  }, [
    iconBackgroundColor,
    iconColor,
    recordBackdropColor,
    resultLimit,
    knownColumnNames,
    iconColumnNames,
    labelColumnNames,
    tooltipColumnNames,
    additionalSearchColumnNames,
    sortColumnLogicalName,
    additionalDisplayColumnNames,
    targetEntityLogicalName,
    lookupFieldTargetEntity,
    lookupTargetAttributeNames,
  ]);

  const runSearch = React.useCallback(
    (text: string) => {
      const requestId = ++searchRequestIdRef.current;
      hasSearchedOnceRef.current = true;

      if (isTestMode) {
        const results = filterTestModeRecords(text, showInactiveRecords, resultLimit, sortColumnLogicalName);
        const iconTestCandidates = resolveTestModeIconCandidates(iconColumnName, iconFixedName);
        const newOptions: IComboBoxOption[] = results.map((r) => ({ key: `${text}::${r.id}`, text: resolveTestModeLabel(r, labelColumnNames) }));
        const newRecordData: Record<string, ITargetRecordData> = {};
        const urls: Record<string, string> = {};
        results.forEach((r) => {
          const { iconValue, pictureUrl } = resolveTestModeIconForRecord(iconTestCandidates, r);
          newRecordData[r.id] = {
            id: r.id,
            name: r.name,
            displayName: resolveTestModeLabel(r, labelColumnNames),
            iconValue,
            tooltipValue: resolveTestModeTooltip(r, tooltipColumnNames),
            contextText: resolveTestModeContextText(r, additionalDisplayColumnNames),
          };
          if (pictureUrl) urls[r.id] = pictureUrl;
        });
        setOptions(newOptions);
        setRecordDataById((prev) => ({ ...prev, ...newRecordData }));
        if (Object.keys(urls).length > 0) setThumbnailUrls((prev) => ({ ...prev, ...urls }));
        return;
      }

      if (!targetEntityLogicalName || !entityMeta) return;

      (async () => {
        try {
          const filterParts: string[] = [];
          const trimmed = text.trim();
          if (trimmed) {
            const escaped = trimmed.replace(/'/g, "''");
            // labelColumnNames is included here too, not just Additional Search Columns/
            // primaryNameAttribute - a real, reported bug: when Label Column overrides what's
            // actually DISPLAYED to the user (e.g. showing "Afghanistan" while the target table's
            // true primary name attribute holds something else entirely), typing text that matches
            // what's on screen but not the true primary name matched ZERO records - options became
            // [], and Fluent's ComboBox simply does not render a callout at all when its options
            // list is empty, so the whole results panel silently vanished the instant a search
            // narrowed to nothing, with no visible cause. Searching whatever is actually shown as
            // the option's label is the correct default - a maker configuring Label Column
            // shouldn't ALSO have to separately duplicate that same column into Additional Search
            // Columns for "type what you see" to work. Filtered to knownColumnNames' text-compatible
            // types (isTextSearchableAttributeType) before inclusion - Dataverse's contains() only
            // works on String/Memo, and folding in a Choice/Lookup/number-typed Label Column here
            // would 400 the WHOLE query the same way an unfiltered non-text Additional Search Column
            // already could - deferred (skipped, not misreported) until knownColumnNames resolves,
            // same as every other knownColumnNames-gated behavior in this file.
            const searchableLabelCols = labelColumnNames.filter((c) => isTextSearchableAttributeType(knownColumnNames?.get(c.toLowerCase())));
            // Additional Search Columns splits into two shapes, not one - see
            // resolveLookupNavigationPropertyName's own comment for why a Lookup/Owner/Customer
            // entry can't just be folded into the plain `cols` list the way every text column is: a
            // Lookup attribute's own bound value is a GUID (`_col_value`), not text, so contains()
            // on the bare logical name either 400s or matches nothing - what a maker configuring it
            // almost always actually wants is "does the RELATED record's own name contain this
            // text", which needs the navigation-property form instead
            // (contains(<navProp>/<relatedPrimaryNameAttribute>,'text')). Both branches are
            // deferred (silently contribute nothing to this particular search, not misreported)
            // until knownColumnNames/lookupSearchColumnInfo actually resolve - a genuinely
            // unsupported type is a configErrors entry already, not something to guess around here.
            const textSearchCols = additionalSearchColumnNames.filter((c) => isTextSearchableAttributeType(knownColumnNames?.get(c.toLowerCase())));
            const lookupSearchClauses = additionalSearchColumnNames
              .filter((c) => isLookupLikeAttributeType(knownColumnNames?.get(c.toLowerCase())))
              .map((c) => lookupSearchColumnInfo[c.toLowerCase()])
              .filter((info): info is { navigationProperty: string; relatedPrimaryNameAttribute: string } => !!info)
              .map((info) => `contains(${info.navigationProperty}/${info.relatedPrimaryNameAttribute},'${escaped}')`);
            const cols = Array.from(new Set([entityMeta.primaryNameAttribute, ...searchableLabelCols, ...textSearchCols]));
            const searchOr = [...cols.map((c) => `contains(${c},'${escaped}')`), ...lookupSearchClauses].join(" or ");
            filterParts.push(`(${searchOr})`);
          }
          if (!showInactiveRecords) filterParts.push("statecode eq 0");
          const filterClause = filterParts.length > 0 ? `&$filter=${filterParts.join(" and ")}` : "";
          const selectCols = buildSelectColumns(entityMeta, iconCandidates, tooltipColumnNames, labelColumnNames, additionalDisplayColumnNames, knownColumnNames);
          // Blank Sort Column falls back to the target table's own primary name column. Always
          // ascending - no direction property, per an explicit "should always be ascending" request.
          // No type-specific handling needed here for text vs. number columns: OData's $orderby
          // sorts by whichever type the underlying attribute actually is.
          const effectiveSortColumn = sortColumnLogicalName || entityMeta.primaryNameAttribute;
          const query = `?$select=${selectCols.join(",")}${filterClause}&$orderby=${effectiveSortColumn} asc&$top=${resultLimit}`;
          const response = await webAPI.retrieveMultipleRecords(targetEntityLogicalName, query);
          if (searchRequestIdRef.current !== requestId) return; // a newer search has since started
          setSearchDiagnostic(undefined);

          // Fast path when no candidate in the chain needs a fetch: resolve icon values
          // synchronously, in the same setState batch as everything else - see
          // resolveIconValueSync's comment. An image candidate OR any dot-notation
          // ("<lookupField>.<column>") entry, anywhere in the chain, forces the slower async wave
          // below instead - neither can be read straight out of this row's own $select response.
          const needsAsyncIconResolution = iconCandidates.some((c) => c.kind === "image" || c.lookupFieldLogicalName);

          const newOptions: IComboBoxOption[] = [];
          const newRecordData: Record<string, ITargetRecordData> = {};
          // Choice candidates can resolve to a web-resource thumbnailUrl synchronously (it's just
          // a relative URL string, not a fetch - see resolveIconValueSync's comment), so this sync
          // pass can populate thumbnails too, not just iconValue - collected separately and merged
          // in one setThumbnailUrls call after the loop, same pattern test mode's `urls` uses.
          const newThumbnailUrls: Record<string, string> = {};
          response.entities.forEach((record) => {
            const id = record[entityMeta.primaryIdAttribute] as string;
            const name = (record[entityMeta.primaryNameAttribute] as string) || "(no name)";
            const displayName = resolveDisplayName(record, name, labelColumnNames);
            newOptions.push({ key: `${text}::${id}`, text: displayName });
            const iconResult = needsAsyncIconResolution ? {} : resolveIconValueSync(iconCandidates, record);
            if (iconResult.thumbnailUrl) newThumbnailUrls[id] = iconResult.thumbnailUrl;
            newRecordData[id] = {
              id,
              name,
              displayName,
              iconValue: iconResult.iconValue,
              tooltipValue: readTooltipValue(record, tooltipColumnNames),
              contextText: buildContextText(record, additionalDisplayColumnNames, knownColumnNames),
            };
          });
          setOptions(newOptions);
          setRecordDataById((prev) => ({ ...prev, ...newRecordData }));
          if (Object.keys(newThumbnailUrls).length > 0) setThumbnailUrls((prev) => ({ ...prev, ...newThumbnailUrls }));

          if (needsAsyncIconResolution) {
            response.entities.forEach((record) => {
              const id = record[entityMeta.primaryIdAttribute] as string;
              resolveIconForRecord(iconCandidates, record, entityMeta.entitySetName, id, dotNotationIconCacheRef.current)
                .then(({ iconValue, thumbnailUrl }) => {
                  if (iconValue !== undefined) {
                    setRecordDataById((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], iconValue } } : prev));
                  }
                  if (thumbnailUrl !== undefined) {
                    setThumbnailUrls((prev) => ({ ...prev, [id]: thumbnailUrl }));
                  }
                  return undefined;
                })
                .catch(() => undefined);
            });
          }
        } catch (err) {
          console.error("AdvancedLookUp: search failed", err);
          if (searchRequestIdRef.current === requestId) {
            setOptions([]);
            // See searchDiagnostic's own comment - without this, a genuinely failed query (e.g. a
            // misconfigured column somewhere the config validator doesn't yet catch) looked
            // identical to "the query legitimately found zero matches": the results callout just
            // silently disappears, since Fluent renders nothing at all for an empty options list.
            const message = err instanceof Error ? err.message : String(err);
            setSearchDiagnostic(`Search failed: ${message}`);
          }
        }
      })();
    },
    [
      isTestMode,
      targetEntityLogicalName,
      entityMeta,
      iconCandidates,
      iconColumnName,
      iconFixedName,
      tooltipColumnNames,
      labelColumnNames,
      additionalSearchColumnNames,
      lookupSearchColumnInfo,
      sortColumnLogicalName,
      additionalDisplayColumnNames,
      knownColumnNames,
      showInactiveRecords,
      resultLimit,
      webAPI,
    ]
  );

  // Loads the currently bound record's display/icon/tooltip data whenever the underlying lookup
  // value changes (including on initial mount), so the field shows more than just the raw name
  // Dataverse already gives us for free via lookupValueProperty.raw.
  const currentLookupId = lookupValueProperty.raw?.[0]?.id;
  const currentLookupName = lookupValueProperty.raw?.[0]?.name;

  React.useEffect(() => {
    let cancelled = false;

    async function loadSelected() {
      if (!currentLookupId) {
        setSelectedId(undefined);
        setSelectedName("");
        setSelectedIconValue(undefined);
        setSelectedTooltip(undefined);
        setSelectedThumbnailUrl(undefined);
        setSearchText("");
        return;
      }

      // Show what's already known immediately, refine once the detail fetch completes.
      // selectedName alone drives the ComboBox's displayed text - searchText is the query only.
      setSelectedId(currentLookupId);
      setSelectedName(currentLookupName || "");

      if (isTestMode) {
        const rec = TEST_MODE_TARGET_RECORDS.find((r) => r.id === currentLookupId);
        if (!rec) return;
        const iconTestCandidates = resolveTestModeIconCandidates(iconColumnName, iconFixedName);
        const { iconValue, pictureUrl } = resolveTestModeIconForRecord(iconTestCandidates, rec);
        setSelectedName(resolveTestModeLabel(rec, labelColumnNames));
        setSelectedTooltip(resolveTestModeTooltip(rec, tooltipColumnNames));
        setSelectedIconValue(iconValue);
        setSelectedThumbnailUrl(pictureUrl);
        return;
      }

      if (!targetEntityLogicalName || !entityMeta) return; // wait for metadata to resolve first

      try {
        const selectCols = buildSelectColumns(entityMeta, iconCandidates, tooltipColumnNames, labelColumnNames);
        const record = await webAPI.retrieveRecord(targetEntityLogicalName, currentLookupId, `?$select=${selectCols.join(",")}`);
        if (cancelled) return;

        const name = (record[entityMeta.primaryNameAttribute] as string) || currentLookupName || "";
        setSelectedName(resolveDisplayName(record, name, labelColumnNames));
        setSelectedTooltip(readTooltipValue(record, tooltipColumnNames));

        const needsAsyncIconResolution = iconCandidates.some((c) => c.kind === "image" || c.lookupFieldLogicalName);
        if (!needsAsyncIconResolution) {
          const { iconValue, thumbnailUrl } = resolveIconValueSync(iconCandidates, record);
          setSelectedIconValue(iconValue);
          setSelectedThumbnailUrl(thumbnailUrl);
        } else {
          const { iconValue, thumbnailUrl } = await resolveIconForRecord(
            iconCandidates,
            record,
            entityMeta.entitySetName,
            currentLookupId,
            dotNotationIconCacheRef.current
          );
          if (cancelled) return;
          setSelectedIconValue(iconValue);
          setSelectedThumbnailUrl(thumbnailUrl);
        }
      } catch (err) {
        console.error("AdvancedLookUp: failed to load selected record", err);
      }
    }

    loadSelected().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentLookupId, isTestMode, targetEntityLogicalName, entityMeta, iconCandidates, iconColumnName, iconFixedName, tooltipColumnNames, labelColumnNames, webAPI, currentLookupName]);

  React.useEffect(
    () => () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    },
    []
  );

  // Keystroke hook. This MUST be onPendingValueChanged, not onInputValueChange: the runtime
  // ComboBox is whatever the host supplies for `<platform-library name="Fluent" version="8.29.0"/>`
  // (locally: node_modules/pcf-start/lib/fluent_8_29_0.js), and 8.29.0's ComboBox._onInputChange
  // goes straight to _processInputChangeWithFreeform without ever calling props.onInputValueChange
  // - that prop only exists on much later 8.x builds. It typechecks here purely because
  // node_modules resolves "^8.29.0" to 8.125.x, where it does exist. onPendingValueChanged is
  // present in 8.29.0 and every later 8.x, fired from componentDidUpdate via
  // _notifyPendingValueChanged.
  //
  // That callback is overloaded, so read its arguments carefully:
  //   - `value` set   -> the freeform text in the input changed. This is the search trigger.
  //   - `value` unset -> a pending *option* changed instead (arrow-key navigation, mouse hover
  //                      over a row, or pending info being cleared). Must NOT re-search, or
  //                      hovering a row would collapse the list to that one row.
  // Note this relies on autoComplete="off": with autoComplete="on" the ComboBox resolves a
  // prefix match to a pending index on every keystroke, and an index always takes precedence
  // over `value` in _notifyPendingValueChanged - so `value` would never arrive.
  const handlePendingValueChanged = React.useCallback(
    (_option?: IComboBoxOption, _index?: number, value?: string) => {
      if (isDisabled) return;
      if (value === undefined) return;
      setSearchText(value);
      // A fresh query means a fresh result list, so the top match is pre-highlighted again even
      // if the user had arrow-keyed away from it against the previous one.
      setUserNavigated(false);

      // Test-mode filtering is a synchronous, in-memory array filter with no network cost, so it
      // runs immediately on every keystroke instead of waiting out the debounce below - which
      // exists only to avoid hammering the real Dataverse search with a request per keystroke.
      if (isTestMode) {
        runSearch(value);
        return;
      }

      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => runSearch(value), 300);
    },
    [isDisabled, runSearch, isTestMode]
  );

  const handleMenuOpen = React.useCallback(() => {
    menuOpenRef.current = true;
    setUserNavigated(false);
    if (!hasSearchedOnceRef.current) runSearch("");
  }, [runSearch]);

  const handleMenuDismissed = React.useCallback(() => {
    menuOpenRef.current = false;
  }, []);

  // A plain click into the field doesn't open the panel on its own either (only the caret button
  // does, by design) - forcing it open here gives the same "click in, see a default list, keep
  // typing to narrow it" feel as the native lookup control.
  //
  // isDisabled MUST be checked here, same as handlePillClick already does - this is an imperative
  // ComboBox.focus(true) call, not a real DOM focus event, so it bypasses Fluent's own `disabled`
  // prop entirely (that prop only stops the *user* from focusing/typing into the input; it has no
  // effect on a component ref's own focus() method being called from our own code). Without this
  // guard, a read-only field still opened its results callout and accepted a selection - the field
  // rendered visually disabled but was fully interactive. See commitOption/handleClear/
  // handlePendingValueChanged below for the matching defense-in-depth guards on the other paths
  // that could still commit a change if the menu were ever open some other way (e.g. mid-session
  // isDisabled flip while already editing).
  const handleFieldClick = React.useCallback(() => {
    if (isDisabled) return;
    comboBoxRef.current?.focus(true);
  }, [isDisabled]);

  const commitOption = React.useCallback(
    (option: IComboBoxOption) => {
      if (isDisabled) return;
      const keyStr = String(option.key);
      const separatorIndex = keyStr.lastIndexOf('::');
      const id = separatorIndex !== -1 ? keyStr.slice(separatorIndex + 2) : keyStr;
      const data = recordDataById[id];
      // Displayed text follows labelColumnName (data.displayName), but the value actually sent
      // back to Dataverse via onSelect keeps the true primary name (data.name) - see
      // ITargetRecordData's comments.
      setSelectedId(id);
      setSelectedName(data?.displayName ?? option.text);
      setSelectedIconValue(data?.iconValue);
      setSelectedTooltip(data?.tooltipValue);
      setSelectedThumbnailUrl(thumbnailUrls[id]);
      onSelect({
        id,
        name: data?.name ?? option.text,
        entityType: (isTestMode ? TEST_MODE_TARGET_ENTITY_LOGICAL_NAME : targetEntityLogicalName) || "",
      });
      // Picking a result collapses the field back to the read-only pill, same as clicking a
      // result in the native lookup's own search callout does.
      setIsEditing(false);
    },
    [isDisabled, recordDataById, thumbnailUrls, onSelect, isTestMode, targetEntityLogicalName]
  );

  const handleChange = React.useCallback(
    (_event: React.FormEvent<IComboBox>, option?: IComboBoxOption, _index?: number, value?: string) => {
      if (isDisabled) return;
      if (option) {
        commitOption(option);
        return;
      }

      // allowFreeform lets the user type past whatever's committed (needed for search to even
      // show what they're typing), but only an actual list pick above is a valid lookup value -
      // a manually-typed value that never resolved to a click lands here on blur/Enter instead.
      // An empty value clears the lookup; anything else needs no action, because the ComboBox
      // clears its own pending value straight after this and then falls back to rendering the
      // `text` prop, i.e. selectedName - so the field snaps back to the last real selection.
      if (!value) {
        setSelectedId(undefined);
        setSelectedName("");
        setSearchText("");
        setSelectedIconValue(undefined);
        setSelectedTooltip(undefined);
        setSelectedThumbnailUrl(undefined);
        onSelect(undefined);
        // Resetting searchText alone doesn't touch `options` - without a fresh search, the
        // dropdown would keep showing whatever the last typed filter matched, stale, the next
        // time it's opened. Re-running with an empty query puts it back to the same default/
        // "recent records" list a fresh menu-open shows (see handleMenuOpen).
        runSearch("");
      }
    },
    [isDisabled, commitOption, onSelect, runSearch]
  );

  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      // Defense-in-depth, matching commitOption/handleChange above - the clear "x" is already not
      // rendered when disabled (see hasClear), but guard the handler itself too rather than relying
      // solely on the render gate.
      if (isDisabled) return;
      e.stopPropagation();
      e.preventDefault();
      setSelectedId(undefined);
      setSelectedName("");
      setSearchText("");
      setSelectedIconValue(undefined);
      setSelectedTooltip(undefined);
      setSelectedThumbnailUrl(undefined);
      onSelect(undefined);
      // Same reasoning as handleChange's clear branch above - without this, reopening the field
      // after clicking the "x" still shows results filtered by whatever was last typed.
      runSearch("");
    },
    [isDisabled, onSelect, runSearch]
  );

  // Opens the selected record's own form, same as clicking the native lookup's link-styled value.
  // context.navigation.openForm is the supported, non-deprecated PCF navigation API (unlike
  // QuickActionButtons' Xrm.Page reach-in, which exists only because no PCF-native equivalent
  // covers arbitrary field writes) - no reason to touch window.Xrm for this.
  const handleOpenRecord = React.useCallback(() => {
    if (!selectedId) return;
    if (isTestMode) {
      console.log(`AdvancedLookUp (test mode): would open record ${selectedId}`);
      return;
    }
    if (!targetEntityLogicalName) return;
    navigation.openForm({ entityName: targetEntityLogicalName, entityId: selectedId }).catch((err) => {
      console.error("AdvancedLookUp: failed to open record", err);
    });
  }, [selectedId, isTestMode, targetEntityLogicalName, navigation]);

  const handleLinkClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleOpenRecord();
    },
    [handleOpenRecord]
  );

  // Clicking the pill's own background (anywhere but the link text or the clear glyph) swaps to
  // the editable ComboBox, same as clicking into the native lookup's resting value does.
  const handlePillClick = React.useCallback(() => {
    if (isDisabled) return;
    setIsEditing(true);
  }, [isDisabled]);

  // Once the ComboBox has (re-)mounted for editing, open its results panel immediately - matches
  // handleFieldClick's existing "click in, see a default list" behavior, just triggered by the
  // pill->edit transition instead of a click already inside the ComboBox itself.
  React.useEffect(() => {
    if (isEditing) comboBoxRef.current?.focus(true);
  }, [isEditing]);

  // An abandoned edit (typed a search, then clicked/tabbed away without picking a result) leaves
  // selectedId untouched - handleChange's empty-value branch above only fires on an explicit
  // clear. Falling back to the pill view here on blur is what makes that abandonment visible
  // again as the previous selection, instead of leaving the ComboBox's own text-reverts-to-`text`
  // behavior as the only visible cue.
  const handleComboBoxBlur = React.useCallback(() => {
    // Cancels any pending debounced search (handlePendingValueChanged) before resetting below -
    // otherwise a debounce timer still live from the last keystroke could fire AFTER this reset
    // dispatches its own runSearch(""), and since a request's requestId is assigned at DISPATCH
    // time (not resolution time), the debounce firing later would carry a HIGHER requestId - making
    // its stale, abandoned-query response the one that wins once both resolve, silently
    // overwriting the correct empty-query reset.
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
    if (selectedId !== undefined) setIsEditing(false);
    // Abandoned edit (typed a search, then clicked/tabbed away without picking a result) -
    // regardless of whether a selection already existed before the edit. Both cases need this
    // reset: handleChange's own empty-value clear branch only fires when Fluent calls onChange
    // with an empty pending value, which does NOT happen here (the pending value is the abandoned
    // NON-empty query text). Left alone, reopening the field later doesn't self-correct either -
    // handleMenuOpen only ever runs a fresh empty search the FIRST time ever (hasSearchedOnceRef),
    // so it would just re-show the same stale narrowed options from the abandoned query. Mirrors
    // the explicit runSearch("") reset handleChange's/handleClear's own clear branches already do
    // for the analogous "actually cleared" cases.
    if (searchText) {
      setSearchText("");
      runSearch("");
    }
  }, [selectedId, searchText, runSearch]);

  // Confirmed via live testing on a real Dataverse form (not assumed): React's own synthetic
  // `onBlur` on fieldContent's wrapper div (above) does not reliably fire there when the user
  // clicks away - Fluent's own internal blur handling on the <input> still visibly runs (the text
  // reverts, as always), but handleComboBoxBlur itself was not being invoked, so its reset never
  // ran. This control shares its React instance/tree with the whole model-driven app shell (see
  // the file-level Layer/Customizations notes above), and something in that much larger host tree
  // most likely intercepts or stops the synthetic focusout bubble before it reaches this
  // component's own handler - the exact ancestor/mechanism wasn't tracked down further, since the
  // fix below sidesteps it entirely rather than depending on it.
  //
  // Fix: a native, capture-phase `document` `mousedown` listener, entirely outside React's own
  // synthetic event system - immune to whatever is interfering with synthetic bubbling, since it
  // listens directly on the real DOM via addEventListener, not through React's delegated dispatch.
  // Capture phase (the `true` third argument) specifically so this sees every mousedown before any
  // other handler anywhere in the tree gets a chance to call stopPropagation on it.
  //
  // "Outside" has to account for BOTH real DOM subtrees this control owns: rootRef.current (the
  // wrapper itself) AND the dedicated Layer host (`#lops-alu-layerhost-N`, appended straight to
  // document.body - see nextLayerHostId's own comment) that the results callout actually renders
  // into. Only checking rootRef would incorrectly treat clicking a SEARCH RESULT as "clicking
  // away", since the callout's DOM lives outside rootRef's own subtree entirely (that's the whole
  // point of the dedicated host - escaping ordinary DOM/overflow ancestry) even though it's
  // logically part of this control. Reuses handleComboBoxBlur's own reset logic verbatim (calling
  // it directly) rather than duplicating it - this is an ADDITIONAL trigger for the exact same
  // reset, not a different behavior; the original onBlur prop is deliberately left in place too
  // (cheap, harmless insurance if it turns out to fire in some OTHER hosting context this control
  // also runs in, e.g. a Quick Create dialog or a different form type not yet tested).
  React.useEffect(() => {
    function handleDocumentMouseDown(e: MouseEvent) {
      // Nothing to do while the pill (not the editable ComboBox) is showing - rootRef is only
      // attached to fieldContent's own wrapper, so a null ref here means fieldContent isn't even
      // mounted right now.
      if (!rootRef.current) return;
      const target = e.target as Node | null;
      if (!target) return;
      const insideRoot = rootRef.current.contains(target);
      const layerHost = layerHostIdRef.current ? document.getElementById(layerHostIdRef.current) : null;
      const insideCallout = layerHost?.contains(target) ?? false;
      if (insideRoot || insideCallout) return;
      handleComboBoxBlur();
    }
    document.addEventListener("mousedown", handleDocumentMouseDown, true);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown, true);
  }, [handleComboBoxBlur]);

  // "Top match is pre-highlighted, Enter takes it" affordance.
  //
  // Fluent 8.29.0 highlights nothing at all while you type: _isOptionSelected defers to
  // _getPendingSelectedIndex, which returns currentPendingValueValidIndex - and with
  // autoComplete="off" that index only ever leaves -1 on an *exact* option-text match. So no row
  // is marked, and _submitPendingValue's freeform branch finds no index to commit either: Enter
  // just calls onChange with the raw typed text and closes the menu, which is the "Enter does
  // nothing" the user is seeing.
  //
  // Arrow keys are the only thing in 8.29.0 that sets a pending index, and that is exactly why a
  // synthetic ArrowDown cannot be used to pre-highlight the top match: _setPendingInfoFromIndex
  // sets currentPendingValue to the highlighted option's own text, which _getVisibleValue then
  // renders - i.e. it would overwrite what the user has typed in the input on every keystroke.
  //
  // Both halves are therefore driven from here instead. The highlight is a per-option `styles`
  // override (read by _getCurrentOptionStyles in the runtime bundle, so a supported hook rather
  // than a DOM hack), and Enter is intercepted in the *capture* phase on the wrapper - ahead of
  // Fluent's own _onInputKeyDown on the inner input. Propagation is deliberately NOT stopped:
  // letting Fluent's Enter handler still run is what clears its pending value (so the input falls
  // back to rendering `text`, i.e. the new selection) and closes the menu. Its _submitPendingValue
  // then calls onChange with the raw typed text, which handleChange ignores because that text is
  // non-empty - which is also why topMatchActive requires a non-empty query: on an empty one that
  // same call would arrive as a clear and undo the selection we just made.
  const topMatchActive = !userNavigated && options.length > 0 && searchText.trim().length > 0;

  // `data` is load-bearing, not metadata. 8.29.0 wraps each option row in
  //   React.memo(({render}) => render(), (a, b) => shallowCompare(omit(a,'render'), omit(b,'render')))
  // and _renderOption feeds that wrapper only {key, index, disabled, isSelected, isChecked, text,
  // render, data} - where the resolved option styles AND onRenderOption's own output are both
  // captured *inside* the ignored `render` closure. So a re-render that changes nothing else in
  // that compared set - option.styles (the top-match highlight) OR the icon/thumbnail data
  // onRenderOption reads via recordDataById/thumbnailUrls - reports "equal" to the memo and the
  // row doesn't re-render, even though its rendered output should have changed. `data` is the one
  // compared prop that is ours to move (IComboBoxOption.data is documented as free-form data for
  // custom renderers, and nothing in ComboBox itself reads it).
  //
  // Two independent things need this, not just the top-match highlight originally documented
  // here: icon/thumbnail readiness. `runSearch` (real, non-test mode) calls setOptions(...) and
  // setRecordDataById(...) as two separate setState calls inside an async .then()/await callback
  // - outside React's synthetic event system, so React 16 does NOT auto-batch them into one
  // render. The row's FIRST render (from the setOptions update) therefore often happens before
  // recordDataById actually has that row's icon data yet, and the SECOND render (from
  // setRecordDataById, moments later) is exactly the kind of "nothing memo-compared changed"
  // update this same mechanism silently drops - which is why icons only appeared after something
  // else (hovering a row) forced a re-render via isSelected/isChecked. Encoding an
  // icon-readiness signature into `data` alongside the top-match flag makes that second render
  // actually stick.
  const displayOptions = React.useMemo(
    () =>
      options.map((o, i) => {
        const keyStr = String(o.key);
        const sep = keyStr.lastIndexOf("::");
        const id = sep !== -1 ? keyStr.slice(sep + 2) : keyStr;
        // Either could be the one that just arrived (a fallback chain can resolve to EITHER an
        // image or a text/fixed value per record, not one global mode for the whole list - see
        // IconCandidate) - both go into the signature so a change to either busts the memo.
        const iconSignature = `${thumbnailUrls[id] || ""}#${recordDataById[id]?.iconValue || ""}`;
        const isTop = topMatchActive && i === 0;
        return {
          ...o,
          ...(isTop ? { styles: topMatchOptionStyles } : {}),
          data: `${isTop ? TOP_MATCH_MARKER : ""}|${iconSignature}`,
        };
      }),
    [options, topMatchActive, recordDataById, thumbnailUrls]
  );

  const handleKeyDownCapture = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End" || e.key === "Escape") {
        setUserNavigated(true);
        return;
      }
      if (e.key !== "Enter" || !topMatchActive || !menuOpenRef.current) return;
      commitOption(options[0]);
    },
    [topMatchActive, options, commitOption]
  );

  // Helper function to highlight matching text in bold (all occurrences)
  const highlightMatchingText = (text: string, search: string): JSX.Element => {
    if (!search || !text) return <span>{text}</span>;

    const searchLower = search.toLowerCase();
    const textLower = text.toLowerCase();
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let index = textLower.indexOf(searchLower, lastIndex);

    while (index !== -1) {
      parts.push(text.substring(lastIndex, index));
      parts.push(<strong key={index}>{text.substring(index, index + search.length)}</strong>);
      lastIndex = index + search.length;
      index = textLower.indexOf(searchLower, lastIndex);
    }

    parts.push(text.substring(lastIndex));

    return <span>{parts}</span>;
  };

  const onRenderOption = React.useCallback(
    (option?: IComboBoxOption): JSX.Element | null => {
      if (!option) return null;
      const keyStr = String(option.key);
      const separatorIndex = keyStr.lastIndexOf('::');
      const id = separatorIndex !== -1 ? keyStr.slice(separatorIndex + 2) : keyStr;
      const data = recordDataById[id];
      const thumb = thumbnailUrls[id];
      // option.data is `${TOP_MATCH_MARKER or ""}|${icon-readiness signature}` (see displayOptions)
      // - only the prefix matters here. Reusing it to flag the row means the "is this the top
      // match" decision lives in exactly one place. The class below is a belt-and-suspenders
      // reinforcement of the same background directly on our own custom-rendered content, since
      // Fluent's own option.styles is applied to its CommandButton wrapper, one layer further out
      // than anything onRenderOption controls - if that wrapper's own background were ever clipped
      // or covered by an opaque descendant, the row would silently lose the highlight, so this
      // makes the visible result not solely dependent on that outer layer.
      const isTopMatch = typeof option.data === "string" && option.data.startsWith(TOP_MATCH_MARKER);
      
      // Highlight matching text in bold
      const highlightedText = searchText.length > 0 ? highlightMatchingText(option.text, searchText) : option.text;
      
      // Purely data-driven, not gated on a global "icon mode" - a fallback chain can resolve to
      // an image for one record and a text/fixed glyph for another (see IconCandidate), so which
      // one to render is decided per row from whichever of thumb/data.iconValue actually landed.
      return (
        <div className={isTopMatch ? "lops-alu-option-row lops-alu-option-row-top-match" : "lops-alu-option-row"}>
          {thumb ? (
            <div className="lops-alu-option-icon" style={iconContainerStyle(iconShape, iconBackgroundColor)}>
              <img src={thumb} alt="" style={iconImageStyle(iconShape)} />
            </div>
          ) : data?.iconValue ? (
            <div className="lops-alu-option-icon" style={iconContainerStyle(iconShape, iconBackgroundColor)}>
              <Icon iconName={data.iconValue} style={iconColor ? { color: iconColor } : undefined} />
            </div>
          ) : null}
          <div className="lops-alu-option-text-col">
            <span className="lops-alu-option-text">{highlightedText}</span>
            {/* Additional Display Columns - dropdown rows only, never the selected pill (an
                explicit user decision, see ITargetRecordData.contextText's own comment). */}
            {data?.contextText && <span className="lops-alu-option-context">{data.contextText}</span>}
          </div>
        </div>
      );
    },
    [recordDataById, thumbnailUrls, searchText, iconShape, iconBackgroundColor, iconColor]
  );

  // Same "purely data-driven" reasoning as onRenderOption above.
  const selectedIconElement = React.useMemo(() => {
    if (selectedThumbnailUrl) {
      return <img src={selectedThumbnailUrl} alt="" style={iconImageStyle(iconShape)} />;
    }
    if (selectedIconValue) {
      return <Icon iconName={selectedIconValue} style={iconColor ? { color: iconColor } : undefined} />;
    }
    return null;
  }, [selectedIconValue, selectedThumbnailUrl, iconShape, iconColor]);

  const hasIcon = selectedId !== undefined && selectedIconElement !== null;
  const hasClear = selectedId !== undefined && !isDisabled;
  // Both the link text AND the clear "x" are a darkened shade of recordBackdropColor - not a
  // fixed blue/grey pair unrelated to it. Pixel-sampling the OOTB chip found its link text and
  // its clear glyph are the SAME color (not two different accents), which is also where
  // darkenHexColor's ~0.41 lightness factor was calibrated from - so one shared computed color
  // drives both here, rather than the link staying a fixed LINK_COLOR while only the clear icon
  // responded to recordBackdropColor (an earlier, inconsistent version of this).
  //
  // MUST be called before the configErrors early return below, not after it - every hook in this
  // component has to run on every render regardless of which branch ends up returned, or React
  // throws "Rendered more hooks than during the previous render" the moment configErrors flips
  // between empty and non-empty (e.g. a maker fixes a bad column name) for the same mounted
  // component instance. This was caught by an automated test that happened to toggle
  // configErrors mid-session, not by inspection - a reminder to actually exercise that
  // transition, not just each state in isolation, when adding a hook near an early return.
  const pillAccentColor = React.useMemo(() => darkenHexColor(recordBackdropColor), [recordBackdropColor]);

  // Config errors replace the whole control with a red panel, same treatment as
  // QuickActionButtons' buttonErrors - see the configErrors comment above for what's checked.
  if (configErrors.length > 0) {
    return (
      <div className="lops-alu-root">
        <div className="lops-alu-config-error">
          <div className="lops-alu-config-error-title">Advanced LookUp: configuration error</div>
          <ul className="lops-alu-config-error-list">
            {configErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Read-only "selected record" pill vs. the editable ComboBox - see isEditing's comment. No
  // pill when there's nothing selected (there's nothing to display but the search box itself).
  const showPill = !isEditing && selectedId !== undefined;
  const rootMinHeight = componentHeight === "Short" ? "32px" : "40px";

  const pillContent = (
    <div
      className="lops-alu-root lops-alu-pill"
      style={{ minHeight: rootMinHeight, backgroundColor: FIELD_BG, borderRadius: FIELD_BORDER_RADIUS }}
      onClick={handlePillClick}
    >
      {/* The chip - icon+name+clear on their own tinted, tightly-fitting rounded background,
          not spanning the full field width. Pixel-matched against a screenshot of the native
          Dataverse lookup's own selected-value chip: it sits inset within the field (small
          margin on every side, not flush against the field's edges) and hugs its content rather
          than stretching to fill the row - see recordBackdropColor's comment above and
          .lops-alu-pill-chip in the CSS. */}
      <div className="lops-alu-pill-chip" style={{ backgroundColor: recordBackdropColor }}>
        {hasIcon && (
          // Deliberately .lops-alu-option-icon here, not .lops-alu-icon - the pill lays its icon
          // out as a plain flex item (see .lops-alu-pill-chip), and .lops-alu-icon's
          // position:absolute/left/transform (needed to float it over the ComboBox's own input)
          // would double up with flexbox's own centering and misplace it.
          <div className="lops-alu-option-icon" style={iconContainerStyle(iconShape, iconBackgroundColor)}>
            {selectedIconElement}
          </div>
        )}
        <a href="#" className="lops-alu-pill-link" style={{ color: pillAccentColor }} onClick={handleLinkClick} title={selectedName}>
          {selectedName}
        </a>
        {hasClear && (
          <span className="lops-alu-pill-clear" style={{ color: pillAccentColor }} onClick={handleClear} title="Clear">
            <Icon iconName="Cancel" style={CLEAR_ICON_STYLE} />
          </span>
        )}
      </div>
      {/* Same decorative search glyph as the editable field below - keeps the two render paths
          visually continuous, and clicking it (pointer-events: none, falls through) enters edit
          mode the same as clicking anywhere else in the pill's background. */}
      <div className="lops-alu-search-icon" style={{ color: isDisabled ? "#c8c6c4" : "#605e5c" }}>
        <Icon iconName="Search" style={{ fontSize: 14 }} />
      </div>
    </div>
  );

  const fieldContent = (
    <div
      ref={rootRef}
      className="lops-alu-root"
      style={{ minHeight: rootMinHeight }}
      onClick={handleFieldClick}
      onKeyDownCapture={handleKeyDownCapture}
      onBlur={handleComboBoxBlur}
    >
      {hasIcon && (
        <div className="lops-alu-icon" style={iconContainerStyle(iconShape, iconBackgroundColor)}>
          {selectedIconElement}
        </div>
      )}
      <ComboBox
        componentRef={comboBoxRef}
        // The committed selection only - never the in-progress query (see searchText's comment).
        text={selectedName}
        selectedKey={selectedId ?? null}
        // Not `options` directly - the top match carries an extra per-option style. See topMatchActive.
        options={displayOptions}
        allowFreeform={true}
        // Required, not cosmetic - see handlePendingValueChanged.
        autoComplete="off"
        openOnKeyboardFocus={true}
        // Without this the results callout auto-sizes to its widest option's text and can grow
        // wider than the field itself. Confirmed present and working in the actual runtime 8.29.0
        // bundle (pcf-start/lib/fluent_8_29_0.js), not just the mismatched npm types - see the
        // Fluent-version-skew note above handlePendingValueChanged.
        useComboBoxAsMenuWidth={true}
        placeholder={placeholderText}
        disabled={isDisabled}
        onPendingValueChanged={handlePendingValueChanged}
        onChange={handleChange}
        onMenuOpen={handleMenuOpen}
        onMenuDismissed={handleMenuDismissed}
        onRenderOption={onRenderOption}
        styles={comboBoxStyles(componentHeight, hasIcon, hasClear, isDisabled)}
        // Pins Fluent's caret button to the field's right edge - by default 8.29.0 gives it a width
        // but no `right`, leaving its position to fall out of static positioning. See LookUpStyles.
        caretDownButtonStyles={caretDownButtonStyles}
        // Forces the results callout into our own dedicated, body-level host (see nextLayerHostId's
        // comment above) rather than whatever Fluent's un-configured default - or the host
        // model-driven app's own ambient Layer settings, since this control shares the exact same
        // Fluent module instance - would otherwise resolve to. This is what keeps the callout from
        // ever being clipped by the boundaries of a Section/Tab container the field happens to sit
        // inside, regardless of where in the form the field is placed.
        calloutProps={{ layerProps: { hostId: layerHostIdRef.current } }}
        theme={myTheme}
      />
      {hasClear && (
        <div className="lops-alu-clear" style={{ right: CLEAR_BUTTON_RIGHT_OFFSET }} onClick={handleClear} title="Clear">
          <Icon iconName="Cancel" style={CLEAR_ICON_STYLE} />
        </div>
      )}
      {/* Decorative stand-in for Fluent's own caret button (hidden via CSS) - matches the
          out-of-the-box Dataverse lookup field's search-glyph affordance instead of a chevron. */}
      <div className="lops-alu-search-icon" style={{ color: isDisabled ? "#c8c6c4" : "#605e5c" }}>
        <Icon iconName="Search" style={{ fontSize: 14 }} />
      </div>
    </div>
  );

  const activeContent = showPill ? pillContent : fieldContent;

  // selectedTooltip can only be set if a Tooltip Column fallback chain actually resolved a value
  // for this record, so its own truthiness is sufficient here without separately checking
  // tooltipColumnNames.
  const field =
    selectedTooltip ? (
      <TooltipHost
        content={selectedTooltip}
        directionalHint={DirectionalHint.bottomLeftEdge}
        styles={{ root: { display: "block", width: "100%" } }}
      >
        {activeContent}
      </TooltipHost>
    ) : (
      activeContent
    );

  // Non-blocking - see metadataDiagnostic's/searchDiagnostic's own comments above for why both
  // stay separate from the hard-block configErrors panel. Only ever visible when something
  // genuinely failed (not just "hasn't resolved yet" / "found zero matches"), so a maker (or,
  // when this is being screenshotted back to me, whoever's debugging it) sees the real reason
  // directly instead of a results panel that just quietly, unexplainably disappears.
  if (metadataDiagnostic || searchDiagnostic) {
    return (
      <div>
        {field}
        {metadataDiagnostic && <div className="lops-alu-metadata-diagnostic">Advanced LookUp: {metadataDiagnostic}</div>}
        {searchDiagnostic && <div className="lops-alu-metadata-diagnostic">Advanced LookUp: {searchDiagnostic}</div>}
      </div>
    );
  }

  return field;
};
