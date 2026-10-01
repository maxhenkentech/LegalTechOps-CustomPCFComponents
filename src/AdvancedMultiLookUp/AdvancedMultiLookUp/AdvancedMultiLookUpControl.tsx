/** @jsx React.createElement */
import * as React from "react";
import { Icon } from "@fluentui/react/lib/Icon";
import { getIcon } from "@fluentui/react/lib/Styling";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";
import { Callout, DirectionalHint } from "@fluentui/react/lib/Callout";
import {
  IAttributeInfo,
  IEntityMeta,
  IIconCandidate,
  IIconResult,
  IRelationship,
  associate,
  buildContextText,
  buildSelectColumns,
  disassociate,
  firstColumnText,
  isLookupLikeAttributeType,
  isTextSearchableAttributeType,
  listRelatedIds,
  needsAsyncIconResolution,
  parseColumnList,
  parseIconColumnRef,
  resolveAttributeInfo,
  resolveEntityMetadata,
  resolveIconAsync,
  resolveIconSync,
  resolveLookupNavigationProperty,
  resolveLookupTarget,
  resolveRelationship,
} from "./Dataverse";
import {
  TEST_MODE_ATTRIBUTE_TYPES,
  TEST_MODE_DEFAULT_SELECTION,
  TEST_MODE_IMAGE_COLUMNS,
  TEST_MODE_LOOKUP_TARGETS,
  TEST_MODE_PRIMARY_ID,
  TEST_MODE_PRIMARY_NAME,
  TEST_MODE_TARGET_ENTITY,
  findTestRecord,
  resolveTestIcon,
  searchTestRecords,
} from "./TestModeData";

export interface IConfig {
  relationshipName: string;
  searchColumns: string;
  sortColumnName: string;
  showInactiveRecords: boolean;
  resultLimit: number;
  placeholderText: string;
  labelColumnName: string;
  additionalDisplayColumns: string;
  tooltipColumnName: string;
  sortBy: "View" | "Text" | "Autofit";
  selectedDisplayMode: "Pills" | "Text";
  componentHeight: "Tall" | "Short";
  selectionShape: "Square" | "Rounded" | "Round";
  makeFontBold: boolean;
  iconColumnName: string;
  iconFixedName: string;
  iconShape: "Full" | "RoundedSquare" | "Circle" | "None";
  iconBackgroundColor: string;
  iconColor: string;
  selectionColor: string;
  pillBorderMode: "Off" | "CustomColor";
  pillBorderColor: string;
  hoverColor: string;
  listSelectedColor: string;
}

export interface IParentRecord {
  entityName?: string;
  // Undefined on a new, unsaved record.
  id?: string;
}

interface IProps {
  config: IConfig;
  // The subgrid's related records (dataset.sortedRecordIds, subgrid view order) and their names.
  relatedIds: string[];
  relatedNames: Record<string, string>;
  datasetLoading: boolean;
  targetEntity: string;
  linkedEntityNames: string[];
  formRecord: IParentRecord;
  refreshRelated: () => void;
  isDisabled: boolean;
  isTestMode: boolean;
  simulateWriteFailure: boolean;
  webAPI: ComponentFramework.WebApi;
  navigation: ComponentFramework.Navigation;
  fontFamily: string;
}

interface IRecordData {
  displayName: string;
  tooltip?: string;
  contextText?: string;
  icon: IIconResult;
}

// What the selected values need to render: the related table, its columns, the Icon Column chain.
interface IMetadata {
  target: IEntityMeta;
  attributeTypes: Map<string, string>;
  iconCandidates: IIconCandidate[];
  // Lowercased lookup field -> target table and its columns (Icon Column dot-notation validation).
  lookupTargets: Record<string, { entity: string; columns?: Map<string, string> }>;
}

// What adding, removing and searching need. Resolved in parallel with IMetadata and never awaited
// by the selected values (measured 2026-10-01: waiting for it put ~1.8 s between the names and the
// icons on the real form - see CLAUDE.md).
interface IAccessMetadata {
  parent?: IEntityMeta;
  relationship?: IRelationship;
  relationshipError?: string;
  // Lowercased search column -> nav property + related primary name (lookup search columns).
  lookupSearch: Record<string, { navigationProperty: string; relatedPrimaryName: string }>;
}

const LOG_PREFIX = "[lops.AdvancedMultiLookUp]";
const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// Family colors (main CLAUDE.md "Component family conventions"): AdvancedLookUp's blue series and
// AdvancedMultiChoice's list/field values.
const SERIES_ACCENT = "#255BA4";
const CHECKBOX_COLOR = SERIES_ACCENT;
const FIELD_TEXT_COLOR = "#323130";
const LIST_BACKGROUND = "#FFFFFF";
const CLEAR_ICON_STYLE: React.CSSProperties = { fontSize: 11, WebkitTextStroke: "0.4px currentColor" };
const ICON_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const SELECTED_FETCH_CHUNK = 50;

const SELECTION_RADIUS: Record<IConfig["selectionShape"], string> = { Square: "2px", Rounded: "4px", Round: "999px" };

// ---------------------------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------------------------

const expandHex = (hex: string): string | undefined => {
  if (!HEX_COLOR_PATTERN.test(hex)) return undefined;
  const h = hex.slice(1);
  return `#${h.length === 3 ? h.split("").map((c) => c + c).join("") : h}`.toLowerCase();
};

const isColorDark = (color: string): boolean => {
  const hex = expandHex(color);
  if (!hex) return false;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
};

// AdvancedLookUp's darkenHexColor: HSL lightness x 0.41, pixel-calibrated against the OOTB lookup
// chip (#EDF3FB -> #255BA4 link and clear glyph).
const darkenHexColor = (color: string, factor = 0.41): string => {
  const hex = expandHex(color);
  if (!hex) return color;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0;
  let sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue /= 6;
  }
  const nl = Math.min(1, Math.max(0, l * factor));
  const hue2rgb = (p: number, q: number, t: number): number => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = nl < 0.5 ? nl * (1 + sat) : nl + sat - nl * sat;
  const p = 2 * nl - q;
  const channels = sat === 0 ? [nl, nl, nl] : [hue2rgb(p, q, hue + 1 / 3), hue2rgb(p, q, hue), hue2rgb(p, q, hue - 1 / 3)];
  return `#${channels.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;
};

// ---------------------------------------------------------------------------------------------
// Icons (AdvancedLookUp's Icon Shape treatment + the family's registered-MDL2 check)
// ---------------------------------------------------------------------------------------------

const registeredIconCache = new Map<string, boolean>();
const isRegisteredMdl2Icon = (name: string): boolean => {
  const key = name.toLowerCase();
  const cached = registeredIconCache.get(key);
  if (cached !== undefined) return cached;
  let registered: boolean;
  try {
    registered = getIcon(name) !== undefined;
  } catch {
    registered = false;
  }
  registeredIconCache.set(key, registered);
  return registered;
};

const iconContainerStyle = (shape: IConfig["iconShape"], background: string): React.CSSProperties => {
  if (shape === "None") return { maxWidth: ICON_SIZE, maxHeight: ICON_SIZE };
  return {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: shape === "Circle" ? "50%" : shape === "RoundedSquare" ? "4px" : "0px",
    backgroundColor: background || undefined,
    overflow: "hidden",
  };
};

// None keeps a picture's own aspect ratio; every boxed shape crops it to the square.
const iconImageStyle = (shape: IConfig["iconShape"]): React.CSSProperties =>
  shape === "None"
    ? { maxWidth: ICON_SIZE, maxHeight: ICON_SIZE, width: "auto", height: "auto", objectFit: "contain", display: "block" }
    : { width: "100%", height: "100%", objectFit: "cover", display: "block" };

// A failed picture/web resource hides itself instead of showing a broken-image box.
const RecordImage = ({ src, style }: { src: string; style: React.CSSProperties }): React.ReactElement | null => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  if (failed) return null;
  return <img src={src} alt="" aria-hidden="true" style={style} onError={() => setFailed(true)} />;
};

// ---------------------------------------------------------------------------------------------
// Autofit (AdvancedMultiChoice's packRows, keyed by record id)
// ---------------------------------------------------------------------------------------------

const SEARCH_BOX_SLOT = "\u0000search";

const firstFitDecreasing = (items: { id: string; width: number }[], rowWidth: number, gap: number): { ids: string[]; used: number }[] => {
  const rows: { ids: string[]; used: number }[] = [];
  for (const item of [...items].sort((a, b) => b.width - a.width)) {
    const width = Math.min(item.width, rowWidth);
    const row = rows.find((r) => r.used + gap + width <= rowWidth);
    if (row) {
      row.ids.push(item.id);
      row.used += gap + width;
    } else {
      rows.push({ ids: [item.id], used: width });
    }
  }
  return rows;
};

// See AdvancedMultiChoice's packRows: candidate A packs the values alone (roomiest row last, the
// search box shares it or takes a line), candidate B packs the box too. Fewer lines wins.
const packRows = (items: { id: string; width: number }[], rowWidth: number, gap: number, searchMinWidth: number): string[] => {
  const flatten = (rows: { ids: string[] }[]) => rows.reduce<string[]>((order, r) => order.concat(r.ids.filter((v) => v !== SEARCH_BOX_SLOT)), []);
  const a = firstFitDecreasing(items, rowWidth, gap);
  if (a.length > 1) {
    let roomiest = 0;
    a.forEach((r, i) => {
      if (r.used < a[roomiest].used) roomiest = i;
    });
    a.push(a.splice(roomiest, 1)[0]);
  }
  const last = a[a.length - 1];
  const linesA = a.length + (searchMinWidth > 0 && (!last || last.used + gap + searchMinWidth > rowWidth) ? 1 : 0);
  if (searchMinWidth <= 0) return flatten(a);
  const b = firstFitDecreasing([...items, { id: SEARCH_BOX_SLOT, width: searchMinWidth }], rowWidth, gap);
  const boxRow = b.findIndex((r) => r.ids.includes(SEARCH_BOX_SLOT));
  b.push(b.splice(boxRow, 1)[0]);
  return b.length < linesA ? flatten(b) : flatten(a);
};

const highlightMatch = (text: string, term: string): React.ReactNode => {
  if (!term) return text;
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  const parts: React.ReactNode[] = [];
  let last = 0;
  let index = lower.indexOf(needle);
  while (index !== -1) {
    parts.push(text.substring(last, index));
    parts.push(<strong key={index}>{text.substring(index, index + needle.length)}</strong>);
    last = index + needle.length;
    index = lower.indexOf(needle, last);
  }
  parts.push(text.substring(last));
  return parts;
};

// A body-level Layer host for the Callout - AdvancedLookUp v1.6.2: a transformed ancestor or the
// host app's own ambient Fluent Layer settings can otherwise clip or redirect the popup.
let layerHostCounter = 0;

// ---------------------------------------------------------------------------------------------
// Control
// ---------------------------------------------------------------------------------------------

export const AdvancedMultiLookUpControl = (props: IProps): React.ReactElement => {
  const { config, relatedNames, datasetLoading, targetEntity, linkedEntityNames, formRecord, refreshRelated, isDisabled, isTestMode, simulateWriteFailure, webAPI, navigation, fontFamily } = props;

  // ---- parsed configuration ----------------------------------------------------------------
  const iconColumnNames = React.useMemo(() => parseColumnList(config.iconColumnName), [config.iconColumnName]);
  const labelColumns = React.useMemo(() => parseColumnList(config.labelColumnName), [config.labelColumnName]);
  const tooltipColumns = React.useMemo(() => parseColumnList(config.tooltipColumnName), [config.tooltipColumnName]);
  const displayColumns = React.useMemo(() => parseColumnList(config.additionalDisplayColumns), [config.additionalDisplayColumns]);
  // Comma-separated (search all at once), unlike the semicolon fallback chains - AdvancedLookUp.
  const searchColumns = React.useMemo(
    () => config.searchColumns.split(",").map((c) => c.trim()).filter((c) => c.length > 0),
    [config.searchColumns]
  );
  const linkedKey = linkedEntityNames.join(",");

  const layerHostId = React.useMemo(() => `lops-aml-layerhost-${++layerHostCounter}`, []);
  React.useEffect(() => {
    const host = document.createElement("div");
    host.id = layerHostId;
    Object.assign(host.style, { position: "fixed", top: "0", left: "0", right: "0", bottom: "0", zIndex: "1000001", pointerEvents: "none" });
    document.body.appendChild(host);
    return () => {
      document.body.removeChild(host);
    };
  }, [layerHostId]);

  // ---- metadata ----------------------------------------------------------------------------
  // Read inside the metadata effect without making every id change re-resolve the metadata.
  const relatedIdsRef = React.useRef(props.relatedIds);
  relatedIdsRef.current = props.relatedIds;
  const [metadata, setMetadata] = React.useState<IMetadata | undefined>();
  const [access, setAccess] = React.useState<IAccessMetadata | undefined>();
  const [metadataError, setMetadataError] = React.useState<string | undefined>();

  // Display metadata: the related table, its columns (one call, which also says which are Image
  // columns) and the Icon Column chain. Dot-notation entries add their related table's columns.
  React.useEffect(() => {
    let cancelled = false;

    if (isTestMode) {
      const candidates: IIconCandidate[] = [];
      iconColumnNames.map(parseIconColumnRef).forEach((ref) => {
        const lookup = ref.lookupFieldLogicalName?.toLowerCase();
        if (lookup && !TEST_MODE_LOOKUP_TARGETS[lookup]) return;
        const col = ref.columnLogicalName.toLowerCase();
        const type = TEST_MODE_ATTRIBUTE_TYPES.get(col);
        if (type === undefined) return;
        const kind = TEST_MODE_IMAGE_COLUMNS.has(col) ? "image" : type === "Picklist" ? "choice" : "text";
        candidates.push({ kind, column: ref.columnLogicalName, lookupFieldLogicalName: ref.lookupFieldLogicalName, lookupTargetEntityLogicalName: lookup ? TEST_MODE_LOOKUP_TARGETS[lookup] : undefined });
      });
      if (config.iconFixedName) candidates.push({ kind: "fixed", fixedValue: config.iconFixedName });
      const lookupTargets: IMetadata["lookupTargets"] = {};
      Object.keys(TEST_MODE_LOOKUP_TARGETS).forEach((f) => {
        lookupTargets[f] = { entity: TEST_MODE_LOOKUP_TARGETS[f], columns: TEST_MODE_ATTRIBUTE_TYPES };
      });
      setMetadata({
        target: { logicalName: TEST_MODE_TARGET_ENTITY, entitySetName: `${TEST_MODE_TARGET_ENTITY}s`, primaryIdAttribute: TEST_MODE_PRIMARY_ID, primaryNameAttribute: TEST_MODE_PRIMARY_NAME },
        attributeTypes: TEST_MODE_ATTRIBUTE_TYPES,
        iconCandidates: candidates,
        lookupTargets,
      });
      setMetadataError(undefined);
      return undefined;
    }

    if (!targetEntity) {
      setMetadataError("Could not determine the table of this subgrid. Add this control to a subgrid of an N:N relationship.");
      return undefined;
    }

    (async () => {
      try {
        setMetadataError(undefined);
        const refs = iconColumnNames.map(parseIconColumnRef);
        const lookupFields = Array.from(new Set(refs.filter((r) => r.lookupFieldLogicalName).map((r) => r.lookupFieldLogicalName!.toLowerCase())));
        const lookupTargets: IMetadata["lookupTargets"] = {};
        const relatedImageColumns: Record<string, Set<string>> = {};
        const setNames: Record<string, string> = {};
        // Everything below runs in parallel: the target table, its columns, and (dot notation only)
        // each lookup's table with its columns and entity set.
        const [target, info] = await Promise.all([
          resolveEntityMetadata(targetEntity),
          resolveAttributeInfo(targetEntity),
          ...lookupFields.map(async (field) => {
            try {
              const entity = await resolveLookupTarget(targetEntity, field);
              if (!entity) return;
              const [related, meta] = await Promise.all([resolveAttributeInfo(entity), resolveEntityMetadata(entity)]);
              lookupTargets[field] = { entity, columns: related.types };
              relatedImageColumns[entity] = related.imageColumns;
              setNames[entity] = meta.entitySetName;
            } catch (err) {
              console.error(`${LOG_PREFIX} failed to resolve Icon Column lookup "${field}"`, err);
            }
          }),
        ]) as [IEntityMeta, IAttributeInfo, ...unknown[]];
        if (cancelled) return;

        // Icon Column: classify every entry (image / choice / text) from the column lists already
        // in hand - no request per entry.
        const iconCandidates: IIconCandidate[] = [];
        refs.forEach((ref) => {
          const column = ref.columnLogicalName.toLowerCase();
          const lookupEntity = ref.lookupFieldLogicalName ? lookupTargets[ref.lookupFieldLogicalName.toLowerCase()]?.entity : undefined;
          if (ref.lookupFieldLogicalName && !lookupEntity) return;
          const types = lookupEntity ? lookupTargets[ref.lookupFieldLogicalName!.toLowerCase()].columns : info.types;
          const images = lookupEntity ? relatedImageColumns[lookupEntity] : info.imageColumns;
          const type = types?.get(column);
          if (type === undefined) return;
          iconCandidates.push({
            kind: images?.has(column) ? "image" : type === "Picklist" ? "choice" : "text",
            column: ref.columnLogicalName,
            lookupFieldLogicalName: ref.lookupFieldLogicalName,
            lookupTargetEntityLogicalName: lookupEntity,
            lookupTargetEntitySetName: lookupEntity ? setNames[lookupEntity] : undefined,
          });
        });
        if (config.iconFixedName) iconCandidates.push({ kind: "fixed", fixedValue: config.iconFixedName });
        setMetadata({ target, attributeTypes: info.types, iconCandidates, lookupTargets });
      } catch (err) {
        if (cancelled) return;
        console.error(`${LOG_PREFIX} failed to resolve metadata`, err);
        setMetadataError(err instanceof Error ? err.message : String(err));
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isTestMode, targetEntity, iconColumnNames, config.iconFixedName]);

  // Access metadata: the form table, the N:N relationship and the lookup search columns - needed
  // only to add, remove and search, so it never holds up the selected values.
  React.useEffect(() => {
    let cancelled = false;

    if (isTestMode) {
      const lookupSearch: IAccessMetadata["lookupSearch"] = {};
      searchColumns.forEach((c) => {
        if (isLookupLikeAttributeType(TEST_MODE_ATTRIBUTE_TYPES.get(c.toLowerCase()))) lookupSearch[c.toLowerCase()] = { navigationProperty: c, relatedPrimaryName: TEST_MODE_PRIMARY_NAME };
      });
      setAccess({ relationship: { schemaName: "lops_testparent_testrecord", navigationProperty: "lops_testparent_testrecord" }, lookupSearch });
      return undefined;
    }
    if (!targetEntity) return undefined;

    const formEntity = formRecord.entityName;
    const formId = formRecord.id;
    const relationshipPromise: Promise<Omit<IAccessMetadata, "lookupSearch">> = formEntity
      ? (async () => {
          const [parentMeta, targetMeta] = await Promise.all([resolveEntityMetadata(formEntity), resolveEntityMetadata(targetEntity)]);
          // Tie-breaker when several N:N relationships connect the two tables: which one's
          // related records are this subgrid's records (needs a saved form record).
          const probe = formId ? (nav: string) => listRelatedIds(parentMeta, formId, nav, targetMeta) : undefined;
          const relationship = await resolveRelationship(formEntity, targetEntity, config.relationshipName, linkedKey ? linkedKey.split(",") : [], relatedIdsRef.current, probe);
          return { parent: parentMeta, relationship };
        })().catch((err: unknown) => ({ relationshipError: err instanceof Error ? err.message : String(err) }))
      : Promise.resolve({ relationshipError: "Could not determine the table of the form this subgrid is on." });

    // Lookup search columns search the related record's primary name via its nav property.
    const lookupSearchPromise = resolveAttributeInfo(targetEntity)
      .then(async (info) => {
        const lookupSearch: IAccessMetadata["lookupSearch"] = {};
        await Promise.all(
          searchColumns
            .filter((c) => isLookupLikeAttributeType(info.types.get(c.toLowerCase())))
            .map(async (c) => {
              try {
                const [navigationProperty, entity] = await Promise.all([resolveLookupNavigationProperty(targetEntity, c), resolveLookupTarget(targetEntity, c)]);
                if (!navigationProperty || !entity) return;
                const related = await resolveEntityMetadata(entity);
                lookupSearch[c.toLowerCase()] = { navigationProperty, relatedPrimaryName: related.primaryNameAttribute };
              } catch (err) {
                console.error(`${LOG_PREFIX} failed to resolve search column "${c}"`, err);
              }
            })
        );
        return lookupSearch;
      })
      .catch(() => ({}));

    Promise.all([relationshipPromise, lookupSearchPromise])
      .then(([rel, lookupSearch]) => {
        if (!cancelled) setAccess({ ...rel, lookupSearch });
        return undefined;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
    // datasetLoading: re-resolve once the subgrid's first page is in, since the relationship
    // tie-breaker compares against those records.
  }, [isTestMode, targetEntity, formRecord.entityName, formRecord.id, config.relationshipName, linkedKey, searchColumns, datasetLoading]);

  // ---- configuration validation (AdvancedLookUp's configErrors) ------------------------------
  const configErrors = React.useMemo(() => {
    const errors: string[] = [];
    const hexProps: [string, string][] = [
      ["Icon Background Color", config.iconBackgroundColor],
      ["Icon Color", config.iconColor],
      ["Selection color", config.selectionColor],
      ["Pill border color", config.pillBorderColor],
      ["List hover color", config.hoverColor],
      ["List selected color", config.listSelectedColor],
    ];
    hexProps.forEach(([label, value]) => {
      if (value && !HEX_COLOR_PATTERN.test(value)) errors.push(`${label} "${value}" is not a valid hex color - use a format like #255BA4 or #FFF.`);
    });
    if (!Number.isFinite(config.resultLimit) || config.resultLimit <= 0) errors.push(`Result Limit must be a positive whole number (got "${config.resultLimit}").`);
    if (!metadata) return errors;

    if (access?.relationshipError) errors.push(access.relationshipError);
    const table = metadata.target.logicalName;
    const types = metadata.attributeTypes;
    const check = (label: string, column: string) => {
      if (!types.has(column.toLowerCase())) errors.push(`${label} "${column}" was not found on table "${table}".`);
    };
    iconColumnNames.forEach((entry) => {
      const ref = parseIconColumnRef(entry);
      if (!ref.lookupFieldLogicalName) return check("Icon Column", entry);
      const field = ref.lookupFieldLogicalName.toLowerCase();
      if (!types.has(field)) return errors.push(`Icon Column "${entry}" refers to lookup field "${ref.lookupFieldLogicalName}", which was not found on table "${table}".`);
      if (!isLookupLikeAttributeType(types.get(field))) return errors.push(`Icon Column "${entry}" uses "." notation on "${ref.lookupFieldLogicalName}", but that column is not a lookup field.`);
      const target = metadata.lookupTargets[field];
      if (target?.columns && !target.columns.has(ref.columnLogicalName.toLowerCase())) {
        errors.push(`Icon Column "${entry}" - column "${ref.columnLogicalName}" was not found on table "${target.entity}" (the table "${ref.lookupFieldLogicalName}" points to).`);
      }
      return undefined;
    });
    labelColumns.forEach((c) => check("Label Column", c));
    tooltipColumns.forEach((c) => check("Tooltip Column", c));
    displayColumns.forEach((c) => check("Additional Display Column", c));
    searchColumns.forEach((c) => {
      check("Additional Search Column", c);
      const type = types.get(c.toLowerCase());
      if (type !== undefined && !isTextSearchableAttributeType(type) && !isLookupLikeAttributeType(type)) {
        errors.push(`Additional Search Column "${c}" is a ${type} column - only text (String/Memo) or lookup columns can be searched.`);
      }
    });
    if (config.sortColumnName) check("Sort Column", config.sortColumnName);
    return errors;
  }, [config, metadata, access, iconColumnNames, labelColumns, tooltipColumns, displayColumns, searchColumns]);

  // ---- related records (server state + optimistic writes) ----------------------------------
  // Test mode has no dataset, so the "server" list lives here.
  const [testRelatedIds, setTestRelatedIds] = React.useState<string[]>(TEST_MODE_DEFAULT_SELECTION);
  const serverIds = isTestMode ? testRelatedIds : props.relatedIds;
  const serverKey = serverIds.join(",");

  // Optimistic state: an add shows at once and a remove hides at once, until the refreshed subgrid
  // data reflects the change. A failed write rolls back and explains itself in `notice`.
  const [pendingAdds, setPendingAdds] = React.useState<string[]>([]);
  const [pendingRemoves, setPendingRemoves] = React.useState<string[]>([]);
  const [busyIds, setBusyIds] = React.useState<string[]>([]);
  const [notice, setNotice] = React.useState<string | undefined>();
  // Ids with a write in flight - read inside the prune effect below, so a ref, not state.
  const busyIdsRef = React.useRef(new Set<string>());

  // Prune optimistic entries once the refreshed subgrid data shows them.
  React.useEffect(() => {
    const server = new Set(serverIds);
    setPendingAdds((prev) => (prev.some((id) => server.has(id)) ? prev.filter((id) => !server.has(id) || busyIdsRef.current.has(id)) : prev));
    setPendingRemoves((prev) => (prev.some((id) => !server.has(id)) ? prev.filter((id) => server.has(id) || busyIdsRef.current.has(id)) : prev));
  }, [serverKey]);

  const selectedIds = React.useMemo(() => {
    const removes = new Set(pendingRemoves);
    const ids = serverIds.filter((id) => !removes.has(id));
    pendingAdds.forEach((id) => {
      if (!ids.includes(id)) ids.push(id);
    });
    return ids;
  }, [serverKey, pendingAdds, pendingRemoves]);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  // ---- record data (labels, icons, tooltips) -----------------------------------------------
  const [recordData, setRecordData] = React.useState<Record<string, IRecordData>>({});
  const iconCacheRef = React.useRef(new Map<string, Promise<IIconResult>>());
  const requestedRef = React.useRef(new Set<string>());

  // Everything cached was resolved under the previous configuration.
  const dataSignature = metadata ? [config.iconColumnName, config.iconFixedName, config.labelColumnName, config.tooltipColumnName, config.additionalDisplayColumns, metadata.iconCandidates.length].join("|") : "";
  React.useEffect(() => {
    setRecordData({});
    requestedRef.current = new Set();
    iconCacheRef.current = new Map();
  }, [dataSignature, metadata]);

  const toRecordData = React.useCallback(
    (record: ComponentFramework.WebApi.Entity, meta: IMetadata, withContext: boolean): { id: string; data: IRecordData } => {
      const id = String(record[meta.target.primaryIdAttribute]);
      const name = (record[meta.target.primaryNameAttribute] as string) || relatedNames[id] || "(no name)";
      const icon = isTestMode
        ? resolveTestIcon(meta.iconCandidates, record)
        : needsAsyncIconResolution(meta.iconCandidates)
          ? {}
          : resolveIconSync(meta.iconCandidates, record);
      return {
        id,
        data: {
          displayName: firstColumnText(record, labelColumns, meta.attributeTypes) || name,
          tooltip: firstColumnText(record, tooltipColumns, meta.attributeTypes),
          contextText: withContext ? buildContextText(record, displayColumns, meta.attributeTypes) : undefined,
          icon,
        },
      };
    },
    [isTestMode, labelColumns, tooltipColumns, displayColumns, relatedNames]
  );

  // Image and dot-notation icons need their own fetch per record, after the row data is shown.
  const resolveIconsLater = React.useCallback(
    (records: ComponentFramework.WebApi.Entity[], meta: IMetadata) => {
      if (isTestMode || !needsAsyncIconResolution(meta.iconCandidates)) return;
      records.forEach((record) => {
        const id = String(record[meta.target.primaryIdAttribute]);
        resolveIconAsync(meta.iconCandidates, record, meta.target.entitySetName, id, iconCacheRef.current)
          .then((icon) => {
            setRecordData((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], icon } } : prev));
            return undefined;
          })
          .catch(() => undefined);
      });
    },
    [isTestMode]
  );

  // Selected records not yet known (first load, or added elsewhere) get one batched fetch.
  React.useEffect(() => {
    if (!metadata) return;
    const missing = selectedIds.filter((id) => !recordData[id] && !requestedRef.current.has(id));
    if (!missing.length) return;
    missing.forEach((id) => requestedRef.current.add(id));

    if (isTestMode) {
      const next: Record<string, IRecordData> = {};
      missing.forEach((id) => {
        const record = findTestRecord(id);
        if (record) next[id] = toRecordData(record, metadata, false).data;
      });
      setRecordData((prev) => ({ ...prev, ...next }));
      return;
    }

    const select = buildSelectColumns(metadata.target, metadata.iconCandidates, tooltipColumns, labelColumns, [], metadata.attributeTypes).join(",");
    for (let i = 0; i < missing.length; i += SELECTED_FETCH_CHUNK) {
      const chunk = missing.slice(i, i + SELECTED_FETCH_CHUNK);
      const filter = chunk.map((id) => `${metadata.target.primaryIdAttribute} eq ${id}`).join(" or ");
      webAPI
        .retrieveMultipleRecords(metadata.target.logicalName, `?$select=${select}&$filter=${filter}`)
        .then((response) => {
          const next: Record<string, IRecordData> = {};
          response.entities.forEach((record) => {
            const { id, data } = toRecordData(record, metadata, false);
            next[id] = data;
          });
          setRecordData((prev) => ({ ...prev, ...next }));
          resolveIconsLater(response.entities, metadata);
          return undefined;
        })
        .catch((err: unknown) => {
          // The dataset's own name still renders; allow a retry on the next change.
          chunk.forEach((id) => requestedRef.current.delete(id));
          console.error(`${LOG_PREFIX} failed to load the selected records`, err);
        });
    }
  }, [metadata, selectedIds, recordData, isTestMode, webAPI, labelColumns, tooltipColumns, toRecordData, resolveIconsLater]);

  // ---- search ------------------------------------------------------------------------------
  const [isOpen, setIsOpen] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [searchText, setSearchText] = React.useState("");
  const [results, setResults] = React.useState<string[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | undefined>();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [fieldWidth, setFieldWidth] = React.useState<number | undefined>();
  const searchRequestRef = React.useRef(0);
  const debounceRef = React.useRef<number | undefined>();

  const runSearch = React.useCallback(
    (text: string) => {
      if (!metadata) return;
      const requestId = ++searchRequestRef.current;
      const term = text.trim();

      if (isTestMode) {
        const textSearch = [...labelColumns, ...searchColumns];
        const records = searchTestRecords(term, textSearch, config.showInactiveRecords, config.sortColumnName, config.resultLimit);
        const next: Record<string, IRecordData> = {};
        records.forEach((r) => {
          const { id, data } = toRecordData(r, metadata, true);
          next[id] = data;
        });
        setRecordData((prev) => ({ ...prev, ...next }));
        setResults(records.map((r) => String(r[TEST_MODE_PRIMARY_ID])));
        setIsSearching(false);
        setSearchError(undefined);
        return;
      }

      const types = metadata.attributeTypes;
      const filters: string[] = [];
      if (term) {
        const escaped = term.replace(/'/g, "''");
        // What is shown is what is searched: the primary name, the text Label Columns (AdvancedLookUp
        // v1.9.1 - otherwise typing a visible label finds nothing) and text Additional Search
        // Columns; a lookup search column matches the related record's primary name.
        const textCols = Array.from(new Set([
          metadata.target.primaryNameAttribute,
          ...labelColumns.filter((c) => isTextSearchableAttributeType(types.get(c.toLowerCase()))),
          ...searchColumns.filter((c) => isTextSearchableAttributeType(types.get(c.toLowerCase()))),
        ]));
        const lookupClauses = searchColumns
          .map((c) => access?.lookupSearch[c.toLowerCase()])
          .filter((info): info is { navigationProperty: string; relatedPrimaryName: string } => !!info)
          .map((info) => `contains(${info.navigationProperty}/${info.relatedPrimaryName},'${escaped}')`);
        filters.push(`(${[...textCols.map((c) => `contains(${c},'${escaped}')`), ...lookupClauses].join(" or ")})`);
      }
      if (!config.showInactiveRecords && types.has("statecode")) filters.push("statecode eq 0");
      const select = buildSelectColumns(metadata.target, metadata.iconCandidates, tooltipColumns, labelColumns, displayColumns, types).join(",");
      const orderBy = config.sortColumnName || metadata.target.primaryNameAttribute;
      const query = `?$select=${select}${filters.length ? `&$filter=${filters.join(" and ")}` : ""}&$orderby=${orderBy} asc&$top=${config.resultLimit}`;

      setIsSearching(true);
      webAPI
        .retrieveMultipleRecords(metadata.target.logicalName, query)
        .then((response) => {
          if (searchRequestRef.current !== requestId) return undefined;
          const next: Record<string, IRecordData> = {};
          const ids: string[] = [];
          response.entities.forEach((record) => {
            const { id, data } = toRecordData(record, metadata, true);
            // Keep an icon that already resolved asynchronously for this record.
            next[id] = data;
            ids.push(id);
          });
          setRecordData((prev) => {
            const merged = { ...prev };
            Object.keys(next).forEach((id) => {
              const keepIcon = needsAsyncIconResolution(metadata.iconCandidates) && prev[id]?.icon;
              merged[id] = keepIcon ? { ...next[id], icon: prev[id].icon } : next[id];
            });
            return merged;
          });
          setResults(ids);
          setIsSearching(false);
          setSearchError(undefined);
          resolveIconsLater(response.entities, metadata);
          return undefined;
        })
        .catch((err: unknown) => {
          if (searchRequestRef.current !== requestId) return;
          console.error(`${LOG_PREFIX} search failed`, err);
          setResults([]);
          setIsSearching(false);
          setSearchError(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
        });
    },
    [metadata, access, isTestMode, config.showInactiveRecords, config.sortColumnName, config.resultLimit, labelColumns, searchColumns, tooltipColumns, displayColumns, webAPI, toRecordData, resolveIconsLater]
  );

  React.useEffect(() => () => window.clearTimeout(debounceRef.current), []);

  // ---- writes ------------------------------------------------------------------------------
  const isUnsaved = !formRecord.id;
  // Writing needs a saved parent record and a resolved relationship; displaying needs neither.
  const canWrite = !isDisabled && !isUnsaved && !!metadata && !!access?.relationship && (isTestMode || !!access?.parent);

  const setBusy = (id: string, busy: boolean) => {
    if (busy) busyIdsRef.current.add(id);
    else busyIdsRef.current.delete(id);
    setBusyIds(Array.from(busyIdsRef.current));
  };

  const write = (id: string, add: boolean) => {
    if (!canWrite || !metadata || busyIdsRef.current.has(id)) return;
    const label = recordData[id]?.displayName || relatedNames[id] || "the record";
    setNotice(undefined);
    setBusy(id, true);
    if (add) {
      setPendingRemoves((prev) => prev.filter((x) => x !== id));
      setPendingAdds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } else {
      setPendingAdds((prev) => prev.filter((x) => x !== id));
      setPendingRemoves((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }

    const request: Promise<void> = isTestMode
      ? new Promise((resolve, reject) =>
          window.setTimeout(() => (simulateWriteFailure ? reject(new Error("Simulated failure (?fail): the user lacks the Append To privilege.")) : resolve()), 250))
      : add
        ? associate(access!.parent!, formRecord.id!, access!.relationship!, metadata.target, id)
        : disassociate(access!.parent!, formRecord.id!, access!.relationship!, id);

    request
      .then(() => {
        setBusy(id, false);
        if (isTestMode) {
          setTestRelatedIds((prev) => (add ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
        } else {
          refreshRelated();
        }
        return undefined;
      })
      .catch((err: unknown) => {
        setBusy(id, false);
        if (add) setPendingAdds((prev) => prev.filter((x) => x !== id));
        else setPendingRemoves((prev) => prev.filter((x) => x !== id));
        const message = err instanceof Error ? err.message : String(err);
        console.error(`${LOG_PREFIX} ${add ? "associate" : "disassociate"} failed`, err);
        setNotice(`Could not ${add ? "add" : "remove"} "${label}": ${message}`);
      });
  };

  // ---- open / close / keyboard (AdvancedMultiChoice) ----------------------------------------
  const fieldRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const valuesRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const open = () => {
    if (!canWrite) return;
    if (fieldRef.current) setFieldWidth(fieldRef.current.getBoundingClientRect().width);
    setIsOpen(true);
    runSearch(searchText);
  };

  // AdvancedLookUp v1.9.1-v1.10.2 lesson (a stale filter surviving a click-away on real forms): a
  // close must leave nothing behind. Cancel the pending debounce, invalidate any search still in
  // flight (its late response would otherwise repopulate the list), and drop the results, so the
  // next open always starts from a fresh default search.
  const close = () => {
    setIsOpen(false);
    window.clearTimeout(debounceRef.current);
    searchRequestRef.current++;
    setResults([]);
    setIsSearching(false);
    setSearchText("");
  };
  const closeRef = React.useRef(close);
  closeRef.current = close;

  // Second, independent close trigger next to the Callout's own onDismiss. On a real form React's
  // synthetic blur never reached AdvancedLookUp (v1.10.2, confirmed from a console trace), so this
  // is a native capture-phase listener outside React's event system. "Inside" is the field AND the
  // body-level layer host the list renders into - clicking a result is not a click-away.
  React.useEffect(() => {
    if (!isOpen) return undefined;
    const onDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (fieldRef.current?.contains(target)) return;
      if (document.getElementById(layerHostId)?.contains(target)) return;
      closeRef.current();
    };
    document.addEventListener("mousedown", onDocumentMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown, true);
  }, [isOpen, layerHostId]);

  // Read-only can arrive mid-edit (business rule, record deactivated) - every action is guarded,
  // but close the list too so it doesn't look editable.
  React.useEffect(() => {
    if (!canWrite && isOpen) {
      setIsOpen(false);
      setSearchText("");
    }
  }, [canWrite, isOpen]);

  const onSearchChange = (value: string) => {
    if (!canWrite) return;
    setSearchText(value);
    if (!isOpen) {
      if (fieldRef.current) setFieldWidth(fieldRef.current.getBoundingClientRect().width);
      setIsOpen(true);
    }
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(value), isTestMode ? 0 : SEARCH_DEBOUNCE_MS);
  };

  const toggle = (id: string) => {
    if (!canWrite) return;
    write(id, !selectedSet.has(id));
    // AdvancedMultiChoice: clear the search after a pick so the default list comes back, keeping
    // the picked row active.
    if (searchText) {
      window.clearTimeout(debounceRef.current);
      setSearchText("");
      runSearch("");
    }
    setActiveId(id);
    inputRef.current?.focus();
  };

  React.useEffect(() => {
    if (!isOpen) return;
    if (activeId === null || !results.includes(activeId)) setActiveId(results.length ? results[0] : null);
  }, [isOpen, results, activeId]);

  React.useEffect(() => {
    if (isOpen && activeId) itemRefs.current[activeId]?.scrollIntoView?.({ block: "nearest" });
  }, [isOpen, activeId]);

  const moveActive = (delta: number) => {
    if (!results.length) return;
    const index = results.indexOf(activeId ?? "");
    setActiveId(results[index < 0 ? 0 : Math.min(results.length - 1, Math.max(0, index + delta))]);
  };

  // No Backspace-removes-the-last-value here (AdvancedMultiChoice has it): a removal is an
  // immediate server write, too easy to trigger by accident in an empty search box.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) open();
        else moveActive(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (isOpen) moveActive(-1);
        break;
      case "Enter":
        e.preventDefault();
        if (isOpen && activeId) toggle(activeId);
        else if (!isOpen) open();
        break;
      case "Escape":
        if (isOpen) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case "Tab":
        close();
        break;
    }
  };

  const onFieldMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canWrite) return;
    if (e.target !== inputRef.current) e.preventDefault();
    inputRef.current?.focus();
    if (isOpen && e.target !== inputRef.current) close();
    else if (!isOpen) open();
  };

  const openRecord = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isTestMode) {
      console.log(`${LOG_PREFIX} (test mode) would open ${TEST_MODE_TARGET_ENTITY} ${id}`);
      return;
    }
    const entityName = metadata?.target.logicalName || targetEntity;
    if (!entityName) return;
    // Ctrl/Cmd+click opens a new window, like a browser link.
    navigation.openForm({ entityName, entityId: id, openInNewWindow: e.ctrlKey || e.metaKey }).catch((err: unknown) => {
      console.error(`${LOG_PREFIX} failed to open record`, err);
    });
  };

  // ---- display order (View / Text / Autofit) -----------------------------------------------
  const labelOf = React.useCallback((id: string) => recordData[id]?.displayName || relatedNames[id] || "", [recordData, relatedNames]);
  const orderedIds = React.useMemo(
    () => (config.sortBy === "Text" ? [...selectedIds].sort((a, b) => labelOf(a).localeCompare(labelOf(b))) : selectedIds),
    [config.sortBy, selectedIds, labelOf]
  );

  const isAutofit = config.sortBy === "Autofit";
  const [autofitOrder, setAutofitOrder] = React.useState<string[] | null>(null);
  const [, setLayoutTick] = React.useState(0);
  const displayedIds = React.useMemo(() => {
    if (!isAutofit || !autofitOrder) return orderedIds;
    const position = new Map(autofitOrder.map((v, i) => [v, i]));
    return [...orderedIds].sort((a, b) => (position.get(a) ?? Number.MAX_SAFE_INTEGER) - (position.get(b) ?? Number.MAX_SAFE_INTEGER));
  }, [isAutofit, autofitOrder, orderedIds]);

  // Measure and repack before paint; converges in one extra render (AdvancedMultiChoice).
  React.useLayoutEffect(() => {
    if (!isAutofit) {
      if (autofitOrder) setAutofitOrder(null);
      return;
    }
    const container = valuesRef.current;
    if (!container) return;
    const hosts = Array.from(container.children).filter((el) => el.classList.contains("lops-aml-pill-host"));
    if (hosts.length !== displayedIds.length || hosts.length === 0) return;
    const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
    const baseIndex = new Map(orderedIds.map((id, i) => [id, i]));
    const items = displayedIds
      .map((id, i) => ({ id, width: Math.ceil(hosts[i].getBoundingClientRect().width) }))
      .sort((a, b) => (baseIndex.get(a.id) ?? 0) - (baseIndex.get(b.id) ?? 0));
    const input = inputRef.current;
    const searchMinWidth = input ? parseFloat(getComputedStyle(input).minWidth) || 0 : 0;
    const next = packRows(items, container.clientWidth, gap, searchMinWidth);
    if (!autofitOrder || next.join(",") !== autofitOrder.join(",")) setAutofitOrder(next);
  });

  React.useEffect(() => {
    const container = valuesRef.current;
    if (!isAutofit || !container || typeof ResizeObserver === "undefined") return undefined;
    let lastWidth = -1;
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0].contentRect.width);
      if (width !== lastWidth) {
        lastWidth = width;
        setLayoutTick((t) => t + 1);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [isAutofit]);

  // ---- rendering ---------------------------------------------------------------------------
  // All hooks are above this point: configErrors can flip on a mounted instance (AdvancedLookUp
  // v1.4.0's "Rendered more hooks" crash).
  if (configErrors.length > 0) {
    return (
      <div className="lops-aml-root" style={{ fontFamily }}>
        <div className="lops-aml-config-error">
          <div className="lops-aml-config-error-title">Advanced Multi LookUp: configuration error</div>
          <ul className="lops-aml-config-error-list">
            {configErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const background = config.selectionColor;
  const accent = isColorDark(background) ? "#FFFFFF" : darkenHexColor(background);
  const radius = SELECTION_RADIUS[config.selectionShape] ?? SELECTION_RADIUS.Rounded;

  const renderIcon = (id: string, glyphColor: string) => {
    const icon = recordData[id]?.icon;
    if (icon?.thumbnailUrl) {
      return (
        <span className="lops-aml-icon" style={iconContainerStyle(config.iconShape, config.iconBackgroundColor)}>
          <RecordImage src={icon.thumbnailUrl} style={iconImageStyle(config.iconShape)} />
        </span>
      );
    }
    if (icon?.iconValue && isRegisteredMdl2Icon(icon.iconValue)) {
      return (
        <span className="lops-aml-icon" style={iconContainerStyle(config.iconShape, config.iconBackgroundColor)}>
          <Icon iconName={icon.iconValue} aria-hidden="true" style={{ color: config.iconColor || glyphColor, fontSize: 14 }} />
        </span>
      );
    }
    return null;
  };

  const renderSelected = (id: string) => {
    const label = labelOf(id) || "(loading...)";
    const isPill = config.selectedDisplayMode !== "Text";
    const border = !isPill ? undefined : config.pillBorderMode === "Off" ? "1px solid transparent" : `1px solid ${config.pillBorderColor}`;
    const item = (
      <span
        className={isPill ? "lops-aml-pill" : "lops-aml-text-item"}
        style={{
          backgroundColor: background,
          color: accent,
          border,
          borderRadius: radius,
          fontWeight: config.makeFontBold ? 600 : 400,
          opacity: busyIds.includes(id) ? 0.55 : 1,
        }}
      >
        {renderIcon(id, accent)}
        {/* The label is a link that opens the record (AdvancedLookUp's chip). Its mousedown is
            stopped so it neither toggles the list nor steals focus. */}
        <a
          href="#"
          className="lops-aml-link"
          style={{ color: accent }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => openRecord(id, e)}
        >
          {label}
        </a>
        {canWrite && (
          <span
            className="lops-aml-clear"
            role="button"
            aria-label={`Remove ${label}`}
            title={`Remove ${label}`}
            style={{ color: accent }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              write(id, false);
            }}
          >
            <Icon iconName="Cancel" aria-hidden="true" style={CLEAR_ICON_STYLE} />
          </span>
        )}
      </span>
    );
    return (
      <TooltipHost
        key={id}
        content={recordData[id]?.tooltip || label}
        delay={1}
        directionalHint={DirectionalHint.topCenter}
        hostClassName="lops-aml-pill-host"
        tooltipProps={{ styles: { content: { maxWidth: 280, whiteSpace: "normal" } } }}
      >
        {item}
      </TooltipHost>
    );
  };

  const term = searchText.trim();
  const renderListItem = (id: string) => {
    const data = recordData[id];
    const isSelected = selectedSet.has(id);
    const isActive = id === activeId;
    const rowBackground = isActive ? config.hoverColor : isSelected ? config.listSelectedColor : LIST_BACKGROUND;
    const textColor = isColorDark(rowBackground) ? "#FFFFFF" : FIELD_TEXT_COLOR;
    const row = (
      <div
        ref={(el) => {
          itemRefs.current[id] = el;
        }}
        role="option"
        aria-selected={isSelected}
        className="lops-aml-item"
        style={{ backgroundColor: rowBackground, color: textColor, fontWeight: isSelected ? 600 : 400, opacity: busyIds.includes(id) ? 0.55 : 1 }}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => setActiveId(id)}
        onClick={() => toggle(id)}
      >
        <span className="lops-aml-checkbox" aria-hidden="true" style={isSelected ? { backgroundColor: CHECKBOX_COLOR, borderColor: CHECKBOX_COLOR } : undefined}>
          {isSelected && <Icon iconName="CheckMark" />}
        </span>
        {renderIcon(id, isColorDark(rowBackground) ? "#FFFFFF" : SERIES_ACCENT)}
        <span className="lops-aml-item-text">
          <span className="lops-aml-label">{highlightMatch(data?.displayName ?? "", term)}</span>
          {data?.contextText && <span className="lops-aml-item-context">{data.contextText}</span>}
        </span>
      </div>
    );
    if (!data?.tooltip) return <React.Fragment key={id}>{row}</React.Fragment>;
    return (
      <TooltipHost
        key={id}
        content={data.tooltip}
        delay={1}
        directionalHint={DirectionalHint.rightCenter}
        tooltipProps={{ styles: { content: { maxWidth: 280, whiteSpace: "normal" } } }}
        styles={{ root: { display: "block" } }}
      >
        {row}
      </TooltipHost>
    );
  };

  const fieldClassName = [
    "lops-aml-field",
    config.componentHeight === "Tall" ? "is-tall" : "is-short",
    isFocused ? "is-focused" : "",
    canWrite ? "" : "is-disabled",
  ].join(" ");

  // Unsaved record: nothing can be related yet, the same rule as the out-of-the-box subgrid.
  const emptyText = isUnsaved && !isDisabled ? "Save the record to add related records" : "---";
  // Blank rather than "---" for the moment metadata takes to load.
  const metadataPending = !metadata && !metadataError && !isDisabled;
  const notes = [metadataError, searchError, notice].filter((n): n is string => !!n);

  return (
    <div className="lops-aml-root" style={{ fontFamily }}>
      <div ref={fieldRef} className={fieldClassName} onMouseDown={onFieldMouseDown} aria-readonly={!canWrite || undefined} aria-busy={datasetLoading || undefined}>
        <div className="lops-aml-values" ref={valuesRef}>
          {displayedIds.map(renderSelected)}
          {canWrite && (
            <input
              ref={inputRef}
              className="lops-aml-input"
              type="text"
              role="combobox"
              aria-expanded={isOpen}
              aria-autocomplete="list"
              autoComplete="off"
              value={searchText}
              placeholder={config.placeholderText}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
          )}
          {!canWrite && displayedIds.length === 0 && <span className="lops-aml-empty-value">{datasetLoading || metadataPending ? "" : emptyText}</span>}
        </div>
        {canWrite && <Icon iconName="Search" className="lops-aml-search-icon" aria-hidden="true" />}
      </div>

      {isOpen && canWrite && fieldRef.current && (
        <Callout
          target={fieldRef.current}
          isBeakVisible={false}
          gapSpace={2}
          directionalHint={DirectionalHint.bottomLeftEdge}
          directionalHintFixed={false}
          calloutWidth={fieldWidth}
          calloutMaxHeight={360}
          setInitialFocus={false}
          onDismiss={close}
          layerProps={{ hostId: layerHostId }}
          // Clicks on the field are handled by onFieldMouseDown. Scroll/resize target window,
          // which is not a Node, so check before contains().
          preventDismissOnEvent={(ev) => ev.target instanceof Node && !!fieldRef.current?.contains(ev.target)}
          styles={{ calloutMain: { borderRadius: 6 }, root: { borderRadius: 6, border: "1px solid #d2d0ce" } }}
        >
          {/* Inline font: the list renders in a Layer under <body>, outside .lops-aml-root. */}
          <div role="listbox" aria-multiselectable="true" className="lops-aml-list" style={{ fontFamily }}>
            {results.length === 0 ? (
              <div className="lops-aml-no-results">{isSearching || !metadata ? "Searching..." : term ? "No matching records" : "No records found"}</div>
            ) : (
              results.map(renderListItem)
            )}
          </div>
        </Callout>
      )}

      {notes.map((n, i) => (
        <div key={i} className="lops-aml-notice">
          {n}
        </div>
      ))}
    </div>
  );
};
