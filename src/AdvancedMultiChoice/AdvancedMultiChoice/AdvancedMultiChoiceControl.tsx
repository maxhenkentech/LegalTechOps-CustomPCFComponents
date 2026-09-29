/** @jsx React.createElement */
import * as React from 'react';
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { Icon } from "@fluentui/react/lib/Icon";
import { getIcon } from "@fluentui/react/lib/Styling";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";
import { Callout, DirectionalHint } from "@fluentui/react/lib/Callout";
import { ThemeFontScope } from "./ThemeFont";

initializeIcons();

export interface IChoiceOption {
  value: number;
  label: string;
  color?: string;
  description: string;
  externalValue: string;
  isHidden: boolean;
}

export interface IMetadataSource {
  entityName?: string;
  attributeName?: string;
}

// Same three color modes as ModernChoiceButtons, deliberately keeping its enum value names so a
// maker configuring both controls sees identical options.
export type ColorMode = "CustomColor" | "ChoiceColor" | "CustomColorFaded";

export interface IConfig {
  useExternalValueForIcon: boolean;
  iconFixedName: string;
  selectedDisplayMode: "Pills" | "Text";
  sortBy: "Value" | "Text" | "Autofit";
  searchDescriptions: boolean;
  hideHiddenOptions: boolean;
  placeholderText: string;
  componentHeight: "Tall" | "Short";
  selectionShape: "Square" | "Rounded" | "Round";
  makeFontBold: boolean;
  selectionBackgroundMode: ColorMode;
  selectionColor: string;
  pillBorderMode: "Off" | ColorMode;
  pillBorderColor: string;
  iconColorMode: "Auto" | ColorMode;
  iconColor: string;
  hoverColor: string;
  listSelectedColor: string;
}

interface IAdvancedMultiChoiceProps {
  options: IChoiceOption[];
  selectedValues: number[];
  onChange: (values: number[]) => void;
  isDisabled: boolean;
  config: IConfig;
  metadataSource?: IMetadataSource;
  // Resolved theme font stack (ThemeFont.ts): the app's custom theme font, then Segoe UI.
  fontFamily: string;
}

interface IOptionMetadata {
  description: string;
  externalValue: string;
  isHidden: boolean;
}

const LOG_PREFIX = "[lops.AdvancedMultiChoice]";

// OOTB-matched field colors, same pixel-sampled values as AdvancedDropDown's DropdownStyles.ts.
const FIELD_TEXT_COLOR = "#323130";
const LIST_BACKGROUND = "#FFFFFF";
// AdvancedLookUp's blue series: its selected-record chip backdrop (#EDF3FB) and the accent its
// link text and clear glyph use (#255BA4 = darkenHexColor(#EDF3FB), below). Every blue default in
// this control - selection color, pill border, fixed icon color, list selection, checkbox - is
// drawn from these two so the whole control reads as one family with AdvancedLookUp.
const SERIES_ACCENT = "#255BA4";
const CHECKBOX_COLOR = SERIES_ACCENT;

// How far each "faded" mode blends the choice color toward white. Backgrounds need to stay pale
// enough for dark text; borders and icons only need to soften, not disappear.
// AdvancedLookUp's CLEAR_ICON_STYLE (LookUpStyles.ts), pixel-calibrated there against the OOTB
// lookup's clear glyph stroke weight.
const CLEAR_ICON_STYLE: React.CSSProperties = { fontSize: 11, WebkitTextStroke: "0.4px currentColor" };

const FADE_BACKGROUND = 0.82;
const FADE_BORDER = 0.5;
const FADE_ICON = 0.45;

// ---------------------------------------------------------------------------------------------
// Icon resolution - duplicated from AdvancedDropDown/ModernChoiceButtons per this repo's
// no-shared-code convention, extended with AdvancedLookUp's semicolon fallback-chain syntax.
// ---------------------------------------------------------------------------------------------

// A publisher-prefixed Dataverse web resource name, e.g. "lops_logo.svg". No registered MDL2 name
// contains an underscore, so a leading "<prefix>_" unambiguously marks an image, not a glyph.
const WEB_RESOURCE_NAME_PATTERN = /^[a-z][a-z0-9]{1,7}_/i;

// Test-harness hook: the harness serves nothing at /WebResources, so index.ts registers a few fake
// names (TestModeData.ts) that resolve to inline images instead. Never set against live Dataverse;
// names not in the map always go to the real /WebResources path.
let webResourceUrlOverrides: Record<string, string> = {};
export const setWebResourceUrlOverrides = (overrides: Record<string, string>): void => {
  webResourceUrlOverrides = overrides;
};

const getWebResourceUrl = (name: string): string =>
  webResourceUrlOverrides[name.trim().toLowerCase()] ?? `/WebResources/${encodeURI(name.trim())}`;

// `getIcon` reads the registry `initializeIcons()` fills; it lower-cases names, so lookups are
// case-insensitive. Fluent's <Icon> renders an empty span for an unknown name, hence this check.
// Cached because getIcon itself console.warns on every miss - uncached, one bad name in a chain
// would log again on every re-render (each keystroke in the search box).
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

// Module-level so each bad name only warns once, not on every re-render.
const warnedIconNames = new Set<string>();
const warnOnce = (name: string, message: string): void => {
  if (warnedIconNames.has(name)) return;
  warnedIconNames.add(name);
  console.warn(`${LOG_PREFIX} ${message}`);
};

const parseIconChain = (value: string | undefined): string[] =>
  (value || "").split(";").map(s => s.trim()).filter(s => s.length > 0);

interface IIconChainProps {
  chain: string[];
  color: string;
  size: number;
  // Last resort when nothing in the chain renders: a dot, like AdvancedDropDown's color-indicator
  // fallback. It's painted with `color` - the same Icon color mode result a glyph would get - so a
  // Fixed/Auto icon color applies to it too instead of it always showing the raw choice color.
  showDot: boolean;
}

// Walks the chain left to right: the first registered MDL2 name or loadable web resource wins.
// A web resource can only be known to fail after the browser tries it, so it renders the rest of
// the chain as its own onError fallback - recursion instead of a pre-check.
const IconChain = ({ chain, color, size, showDot }: IIconChainProps): React.ReactElement | null => {
  for (let i = 0; i < chain.length; i++) {
    const name = chain[i];
    if (WEB_RESOURCE_NAME_PATTERN.test(name)) {
      const rest = chain.slice(i + 1);
      return (
        <WebResourceIcon
          name={name}
          size={size}
          renderFallback={() => <IconChain chain={rest} color={color} size={size} showDot={showDot} />}
        />
      );
    }
    if (isRegisteredMdl2Icon(name)) {
      return (
        <Icon
          iconName={name}
          aria-hidden="true"
          className="lops-amc-icon"
          styles={{ root: { fontSize: `${size - 2}px`, width: `${size}px`, color } }}
        />
      );
    }
    warnOnce(name,
      `Icon "${name}" is not an MDL2 icon name - trying the next fallback. See FLUENT_ICONS.md ` +
      `for the supported names (Segoe Fluent Icons names from the Windows docs mostly do not exist here).`);
  }
  if (!showDot) return null;
  return <span className="lops-amc-dot" aria-hidden="true" style={{ backgroundColor: color }} />;
};

interface IWebResourceIconProps {
  name: string;
  size: number;
  renderFallback: () => React.ReactElement | null;
}

// A missing/unpublished web resource only surfaces as the <img>'s own load error, so this has to
// be a stateful component rather than an inline render branch.
// Module-level so a name that already failed skips straight to its fallback on every later
// mount, instead of re-requesting a known 404 each time the list or a pill re-renders.
const failedWebResources = new Set<string>();

const WebResourceIcon = ({ name, size, renderFallback }: IWebResourceIconProps): React.ReactElement | null => {
  const [failed, setFailed] = React.useState(() => failedWebResources.has(name));
  React.useEffect(() => setFailed(failedWebResources.has(name)), [name]);

  if (failed) return renderFallback();

  return (
    <img
      src={getWebResourceUrl(name)}
      alt=""
      aria-hidden="true"
      className="lops-amc-icon"
      onError={() => {
        warnOnce(name,
          `Web resource "${name}" could not be loaded from ${getWebResourceUrl(name)} - trying the ` +
          `next fallback. Check that it exists, is an image type, and has been published.`);
        failedWebResources.add(name);
        setFailed(true);
      }}
      style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }}
    />
  );
};

// ---------------------------------------------------------------------------------------------
// Color helpers (copied from ModernChoiceButtons)
// ---------------------------------------------------------------------------------------------

const isHexColor = (color: string | undefined): color is string =>
  !!color && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color);

const isColorDark = (color: string): boolean => {
  if (!isHexColor(color)) return false;
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
};

const lightenColor = (color: string, amount: number): string => {
  if (!isHexColor(color)) return color;
  const hex = color.replace('#', '');
  const channel = (i: number) => {
    const c = parseInt(hex.substr(i, 2), 16);
    return Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
};

// Darkens by scaling HSL lightness (hue/saturation kept) - copied from AdvancedLookUp's
// darkenHexColor, including its 0.41 factor, which was pixel-calibrated there against the OOTB
// lookup chip (#EDF3FB backdrop -> #2B5D9E link/clear glyph). Used for Text mode's chip accent.
const CHIP_ACCENT_LIGHTNESS_FACTOR = 0.41;
const darkenHexColor = (hex: string, factor: number = CHIP_ACCENT_LIGHTNESS_FACTOR): string => {
  if (!isHexColor(hex)) return hex;
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255);
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
  return `#${channels.map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
};

// Both choice-color modes fall back to the configured hex EXACTLY when the option has no color -
// the fade only ever applies to a real choice color. (ModernChoiceButtons fades the custom color
// too; here that turned e.g. a #255BA4 icon/border override into a washed-out blue, which the user
// reported as "not using the override hex".)
const resolveModeColor = (mode: ColorMode, choiceColor: string | undefined, customColor: string, fade: number): string => {
  const usableChoiceColor = isHexColor(choiceColor) ? choiceColor : undefined;
  if (mode === "ChoiceColor") return usableChoiceColor ?? customColor;
  if (mode === "CustomColorFaded") return usableChoiceColor ? lightenColor(usableChoiceColor, fade) : customColor;
  return customColor;
};

// `contrast` is what Automatic resolves to - the caller's own text color for that surface (the
// darkened accent on a pill/chip, plain text color in the list), so an Auto icon always matches
// the label next to it.
const resolveIconColor = (config: IConfig, choiceColor: string | undefined, background: string, contrast: string): string => {
  if (config.iconColorMode === "Auto") return contrast;
  const color = resolveModeColor(config.iconColorMode, choiceColor, config.iconColor, FADE_ICON);
  // A glyph the same color as the pill behind it is invisible (e.g. ChoiceColor on both) -
  // drop back to contrast rather than render a blank gap.
  return color.toLowerCase() === background.toLowerCase() ? contrast : color;
};

const SELECTION_RADIUS: Record<IConfig['selectionShape'], string> = {
  Square: "2px",
  Rounded: "4px",
  Round: "999px"
};

// Autofit sort: orders the selected values so they - AND the search box that always follows the
// last value - wrap into as few lines as possible.
//
// First Fit Decreasing bin packing: widest item first, each into the first row that still has
// room, else a new row. Near-optimal (never more than 11/9 of the optimal row count + 1) and cheap
// enough to rerun on every resize. Ties keep the incoming (value) order, so results are stable.
const firstFitDecreasing = (items: { value: number; width: number }[], rowWidth: number, gap: number): { values: number[]; used: number }[] => {
  const rows: { values: number[]; used: number }[] = [];
  for (const item of [...items].sort((a, b) => b.width - a.width)) {
    // A value wider than the row is capped by its own max-width: 100%, so it fills one row alone.
    const width = Math.min(item.width, rowWidth);
    const row = rows.find(r => r.used + gap + width <= rowWidth);
    if (row) {
      row.values.push(item.value);
      row.used += gap + width;
    } else {
      rows.push({ values: [item.value], used: width });
    }
  }
  return rows;
};

const SEARCH_BOX_SLOT = Number.MIN_SAFE_INTEGER;

// The search box (min width `searchMinWidth`, or 0 when read-only and there is none) is always
// rendered after the last value, so the last row is the one it can share. Two candidate packings,
// keeping whichever needs fewer total lines:
//   A. pack the values alone, move the roomiest row last, and the box either fits beside it or
//      takes a line of its own;
//   B. pack the box as a pseudo-item too, and move the row it landed in last.
// A alone misses layouts where giving up a little value density frees exactly enough room for the
// box (observed live: 9 values packed into 4 dense rows, box alone on a 5th line).
export const packRows = (items: { value: number; width: number }[], rowWidth: number, gap: number, searchMinWidth: number): number[] => {
  const flatten = (rows: { values: number[] }[]) =>
    rows.reduce<number[]>((order, r) => order.concat(r.values.filter(v => v !== SEARCH_BOX_SLOT)), []);

  const a = firstFitDecreasing(items, rowWidth, gap);
  if (a.length > 1) {
    let roomiest = 0;
    a.forEach((r, i) => { if (r.used < a[roomiest].used) roomiest = i; });
    a.push(a.splice(roomiest, 1)[0]);
  }
  const last = a[a.length - 1];
  const linesA = a.length + (searchMinWidth > 0 && (!last || last.used + gap + searchMinWidth > rowWidth) ? 1 : 0);
  if (searchMinWidth <= 0) return flatten(a);

  const b = firstFitDecreasing([...items, { value: SEARCH_BOX_SLOT, width: searchMinWidth }], rowWidth, gap);
  const boxRow = b.findIndex(r => r.values.includes(SEARCH_BOX_SLOT));
  b.push(b.splice(boxRow, 1)[0]);
  return b.length < linesA ? flatten(b) : flatten(a);
};

const matches = (option: IChoiceOption, term: string, searchDescriptions: boolean): { label: boolean; description: boolean } => {
  const label = option.label.toLowerCase().includes(term);
  const description = searchDescriptions && option.description.toLowerCase().includes(term);
  return { label, description };
};

// ---------------------------------------------------------------------------------------------
// Control
// ---------------------------------------------------------------------------------------------

export const AdvancedMultiChoiceControl = ({ options: rawOptions, selectedValues, onChange, isDisabled, config, metadataSource, fontFamily }: IAdvancedMultiChoiceProps): React.ReactElement => {
  const [metadata, setMetadata] = React.useState<Record<number, IOptionMetadata>>({});
  const [isOpen, setIsOpen] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [searchText, setSearchText] = React.useState("");
  const [activeValue, setActiveValue] = React.useState<number | null>(null);
  const [fieldWidth, setFieldWidth] = React.useState<number | undefined>(undefined);

  const fieldRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const itemRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  const valuesRef = React.useRef<HTMLDivElement>(null);
  const [autofitOrder, setAutofitOrder] = React.useState<number[] | null>(null);
  const [, setLayoutTick] = React.useState(0);
  const isAutofit = config.sortBy === "Autofit";

  const entityName = metadataSource?.entityName;
  const attributeName = metadataSource?.attributeName;

  // The PCF SDK's option metadata carries no Description/ExternalValue/IsHidden, so read the
  // choice's full metadata straight from the Web API - same technique as AdvancedDropDown, but
  // against MultiSelectPicklistAttributeMetadata, and always (descriptions drive tooltips and
  // search, not just icons).
  React.useEffect(() => {
    if (!metadataSource) return undefined;
    if (!entityName || !attributeName) {
      console.warn(`${LOG_PREFIX} Could not resolve entityName ("${entityName}") / attributeName ("${attributeName}") ` +
        `from this host's context - option descriptions and External Value icons are unavailable.`);
      return undefined;
    }

    let cancelled = false;
    const url = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${attributeName}')` +
      `/Microsoft.Dynamics.CRM.MultiSelectPicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet`;

    fetch(url, {
      method: "GET",
      headers: {
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "Accept": "application/json"
      }
    }).then(response => {
      if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      return response.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).then((result: any) => {
      const map: Record<number, IOptionMetadata> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result?.OptionSet?.Options ?? []).forEach((opt: any) => {
        if (opt?.Value === undefined) return;
        map[opt.Value] = {
          description: opt.Description?.UserLocalizedLabel?.Label ?? "",
          externalValue: opt.ExternalValue ?? "",
          isHidden: opt.IsHidden === true
        };
      });
      if (!cancelled) setMetadata(map);
      return undefined;
    }).catch((err: unknown) => {
      console.warn(`${LOG_PREFIX} Failed to fetch choice metadata via Web API:`, err);
    });

    return () => { cancelled = true; };
  }, [entityName, attributeName]);

  // ---- derived option lists ----------------------------------------------------------------

  const allOptions = React.useMemo(() => {
    const merged = rawOptions.map(opt => {
      const md = metadata[opt.value];
      return md ? {
        ...opt,
        description: opt.description || md.description,
        externalValue: opt.externalValue || md.externalValue,
        isHidden: opt.isHidden || md.isHidden
      } : opt;
    });
    // Autofit only reorders the values shown in the field (see packRows); its base order, and the
    // list's order, is value order.
    return config.sortBy === "Text"
      ? merged.sort((a, b) => a.label.localeCompare(b.label))
      : merged.sort((a, b) => a.value - b.value);
  }, [rawOptions, metadata, config.sortBy]);

  const selectedSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);

  // Sourced from allOptions (not the hidden-filtered list) so a selected option that has since
  // been hidden still shows. A stored value with no matching option at all still gets a pill so
  // it can be seen and removed rather than silently kept.
  const selectedOptions = React.useMemo(() => {
    const known = allOptions.filter(o => selectedSet.has(o.value));
    const knownValues = new Set(known.map(o => o.value));
    const unknown = selectedValues
      .filter(v => !knownValues.has(v))
      .map(v => ({ value: v, label: `(${v})`, description: "", externalValue: "", isHidden: false } as IChoiceOption));
    return [...known, ...unknown];
  }, [allOptions, selectedSet, selectedValues]);

  // The values as displayed in the field: selectedOptions, reordered by the last Autofit packing.
  // A newly added value isn't in autofitOrder yet, so it's appended - the layout effect below then
  // measures it and repacks before the browser paints.
  const displayedOptions = React.useMemo(() => {
    if (!isAutofit || !autofitOrder) return selectedOptions;
    const position = new Map(autofitOrder.map((v, i) => [v, i]));
    return [...selectedOptions].sort((a, b) =>
      (position.get(a.value) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.value) ?? Number.MAX_SAFE_INTEGER));
  }, [isAutofit, autofitOrder, selectedOptions]);

  // Autofit measurement. Runs after every render but only sets state when the packed order actually
  // changes: a value's width doesn't depend on its position, so one repack converges. Layout effect
  // (not a plain effect) so a reorder is applied before paint - no visible jump.
  React.useLayoutEffect(() => {
    if (!isAutofit) {
      if (autofitOrder) setAutofitOrder(null);
      return;
    }
    const container = valuesRef.current;
    if (!container) return;
    // Each value is a TooltipHost root (.lops-amc-pill-host), a direct child, in displayed order.
    const hosts = Array.from(container.children).filter(el => el.classList.contains("lops-amc-pill-host"));
    if (hosts.length !== displayedOptions.length || hosts.length === 0) return;
    const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
    const baseIndex = new Map(selectedOptions.map((o, i) => [o.value, i]));
    const items = displayedOptions
      .map((o, i) => ({ value: o.value, width: Math.ceil(hosts[i].getBoundingClientRect().width) }))
      .sort((a, b) => (baseIndex.get(a.value) ?? 0) - (baseIndex.get(b.value) ?? 0));
    const input = inputRef.current;
    const searchMinWidth = input ? parseFloat(getComputedStyle(input).minWidth) || 0 : 0;
    const next = packRows(items, container.clientWidth, gap, searchMinWidth);
    if (!autofitOrder || next.join(",") !== autofitOrder.join(",")) setAutofitOrder(next);
  });

  // Repack when the field's width changes (form resize, tab switch, side pane). Only the width
  // matters, and only a re-render is needed - the layout effect above does the measuring.
  React.useEffect(() => {
    const container = valuesRef.current;
    if (!isAutofit || !container || typeof ResizeObserver === "undefined") return undefined;
    let lastWidth = -1;
    const observer = new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      if (width !== lastWidth) {
        lastWidth = width;
        setLayoutTick(t => t + 1);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [isAutofit]);

  const term = searchText.trim().toLowerCase();
  const listOptions = React.useMemo(() => {
    return allOptions
      .filter(o => !config.hideHiddenOptions || !o.isHidden || selectedSet.has(o.value))
      .filter(o => {
        if (!term) return true;
        const m = matches(o, term, config.searchDescriptions);
        return m.label || m.description;
      });
  }, [allOptions, config.hideHiddenOptions, config.searchDescriptions, selectedSet, term]);

  // The field can become read-only while the list is open (a business rule or script locking it
  // mid-edit). Every action is already guarded, but close the list too so it doesn't look editable.
  React.useEffect(() => {
    if (isDisabled && isOpen) {
      setIsOpen(false);
      setSearchText("");
    }
  }, [isDisabled, isOpen]);

  // Keep the keyboard highlight on a row that is actually in the (filtered) list.
  React.useEffect(() => {
    if (!isOpen) return;
    if (activeValue === null || !listOptions.some(o => o.value === activeValue)) {
      setActiveValue(listOptions.length ? listOptions[0].value : null);
    }
  }, [isOpen, listOptions, activeValue]);

  React.useEffect(() => {
    if (isOpen && activeValue !== null) {
      itemRefs.current[activeValue]?.scrollIntoView?.({ block: "nearest" });
    }
  }, [isOpen, activeValue]);

  // ---- actions -----------------------------------------------------------------------------

  const open = () => {
    if (isDisabled) return;
    if (fieldRef.current) setFieldWidth(fieldRef.current.getBoundingClientRect().width);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setSearchText("");
  };

  const toggle = (value: number) => {
    if (isDisabled) return;
    onChange(selectedSet.has(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value]);
    // Clear the search after a pick so the full list comes back, keeping the picked row active.
    setSearchText("");
    setActiveValue(value);
    inputRef.current?.focus();
  };

  const remove = (value: number) => {
    if (isDisabled) return;
    onChange(selectedValues.filter(v => v !== value));
  };

  const moveActive = (delta: number) => {
    if (!listOptions.length) return;
    const index = listOptions.findIndex(o => o.value === activeValue);
    const next = index < 0 ? 0 : Math.min(listOptions.length - 1, Math.max(0, index + delta));
    setActiveValue(listOptions[next].value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) open(); else moveActive(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (isOpen) moveActive(-1);
        break;
      case "Enter":
        if (isOpen && activeValue !== null) {
          e.preventDefault();
          toggle(activeValue);
        } else if (!isOpen) {
          e.preventDefault();
          open();
        }
        break;
      case "Escape":
        if (isOpen) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case "Backspace":
        // Removes the last pill shown (display order, not selection order) when the search is empty.
        if (searchText === "" && displayedOptions.length) {
          remove(displayedOptions[displayedOptions.length - 1].value);
        }
        break;
      case "Tab":
        close();
        break;
    }
  };

  // Clicking anywhere on the field (other than a remove button) focuses the search box and
  // toggles the list, like clicking a Dropdown. preventDefault keeps focus from flickering off
  // the input when the click lands on a pill or the padding.
  const onFieldMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    if (e.target !== inputRef.current) e.preventDefault();
    inputRef.current?.focus();
    if (isOpen && e.target !== inputRef.current) close(); else open();
  };

  // ---- rendering ---------------------------------------------------------------------------

  const isTall = config.componentHeight === "Tall";
  const iconSize = 16;

  const iconChainFor = (option: IChoiceOption): string[] => [
    ...(config.useExternalValueForIcon ? parseIconChain(option.externalValue) : []),
    ...parseIconChain(config.iconFixedName)
  ];

  const renderIcon = (option: IChoiceOption, background: string, contrast: string) => (
    <IconChain
      chain={iconChainFor(option)}
      color={resolveIconColor(config, option.color, background, contrast)}
      size={iconSize}
      // An option with no color and no icon gets no dot, unless a Fixed icon color gives it one.
      showDot={isHexColor(option.color) || config.iconColorMode === "CustomColor"}
    />
  );

  // The clear glyph for both display modes, copied from AdvancedLookUp's .lops-alu-pill-clear:
  // an 11px Cancel glyph thickened with a text stroke (its CLEAR_ICON_STYLE) - no box, no hover
  // background, no opacity fade. Its color is resolved exactly like the option's own icon (Icon
  // color mode), so a Fixed icon color, or the Icon color hex for an option without a color,
  // applies to it too; Automatic resolves to the label's accent.
  const removeButton = (option: IChoiceOption, background: string, contrast: string) => {
    const color = resolveIconColor(config, option.color, background, contrast);
    return (
    <span
      className="lops-amc-clear"
      role="button"
      aria-label={`Remove ${option.label}`}
      title={`Remove ${option.label}`}
      style={{ color }}
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
      onClick={e => { e.stopPropagation(); remove(option.value); }}
    >
      <Icon iconName="Cancel" aria-hidden="true" style={CLEAR_ICON_STYLE} />
    </span>
    );
  };

  const withTooltip = (key: number, content: string, child: React.ReactElement, className: string) => (
    <TooltipHost
      key={key}
      content={content}
      delay={1}
      directionalHint={DirectionalHint.topCenter}
      hostClassName={className}
      tooltipProps={{ styles: { content: { maxWidth: 280, whiteSpace: 'normal' } } }}
    >
      {child}
    </TooltipHost>
  );

  const renderPill = (option: IChoiceOption) => {
    const background = resolveModeColor(config.selectionBackgroundMode, option.color, config.selectionColor, FADE_BACKGROUND);
    // Same darkened-backdrop accent as the text-mode chip (and AdvancedLookUp's chip), so the
    // default #EDF3FB pill gets #255BA4 text instead of near-black.
    const textColor = isColorDark(background) ? "#FFFFFF" : darkenHexColor(background);
    const border = config.pillBorderMode === "Off"
      ? "1px solid transparent"
      : `1px solid ${resolveModeColor(config.pillBorderMode, option.color, config.pillBorderColor, FADE_BORDER)}`;

    const pill = (
      <span
        className="lops-amc-pill"
        style={{
          backgroundColor: background,
          color: textColor,
          border,
          borderRadius: SELECTION_RADIUS[config.selectionShape] ?? SELECTION_RADIUS.Rounded,
          fontWeight: config.makeFontBold ? 600 : 400
        }}
      >
        {renderIcon(option, background, textColor)}
        <span className="lops-amc-label">{option.label}</span>
        {!isDisabled && removeButton(option, background, textColor)}
      </span>
    );
    return withTooltip(option.value, option.description || option.label, pill, "lops-amc-pill-host");
  };

  // Text mode = AdvancedLookUp's selected-record chip: a borderless tinted backdrop (Selection
  // background mode/Selection color, so #EDF3FB by default when the option has no color), with the
  // label and clear glyph sharing one accent color darkened from that backdrop.
  const renderTextItem = (option: IChoiceOption) => {
    const background = resolveModeColor(config.selectionBackgroundMode, option.color, config.selectionColor, FADE_BACKGROUND);
    const accent = isColorDark(background) ? "#FFFFFF" : darkenHexColor(background);
    const item = (
      <span
        className="lops-amc-text-item"
        style={{
          backgroundColor: background,
          color: accent,
          borderRadius: SELECTION_RADIUS[config.selectionShape] ?? SELECTION_RADIUS.Rounded,
          fontWeight: config.makeFontBold ? 600 : 400
        }}
      >
        {renderIcon(option, background, accent)}
        <span className="lops-amc-label">{option.label}</span>
        {!isDisabled && removeButton(option, background, accent)}
      </span>
    );
    return withTooltip(option.value, option.description || option.label, item, "lops-amc-pill-host");
  };

  const renderListItem = (option: IChoiceOption) => {
    const isSelected = selectedSet.has(option.value);
    const isActive = option.value === activeValue;
    const background = isActive ? config.hoverColor : isSelected ? config.listSelectedColor : LIST_BACKGROUND;
    const textColor = isColorDark(background) ? "#FFFFFF" : FIELD_TEXT_COLOR;
    // When a search hit only the description, show it under the label so the match is explainable.
    const showDescriptionHit = !!term && config.searchDescriptions &&
      !option.label.toLowerCase().includes(term) && option.description.toLowerCase().includes(term);

    const row = (
      <div
        ref={el => { itemRefs.current[option.value] = el; }}
        role="option"
        aria-selected={isSelected}
        className="lops-amc-item"
        style={{ backgroundColor: background, color: textColor, fontWeight: isSelected ? 600 : 400 }}
        onMouseDown={e => e.preventDefault()}
        onMouseEnter={() => setActiveValue(option.value)}
        onClick={() => toggle(option.value)}
      >
        <span
          className="lops-amc-checkbox"
          aria-hidden="true"
          style={isSelected ? { backgroundColor: CHECKBOX_COLOR, borderColor: CHECKBOX_COLOR } : undefined}
        >
          {isSelected && <Icon iconName="CheckMark" />}
        </span>
        {renderIcon(option, background, textColor)}
        <span className="lops-amc-item-text">
          <span className="lops-amc-label">{option.label}</span>
          {showDescriptionHit && <span className="lops-amc-item-description">{option.description}</span>}
        </span>
      </div>
    );

    if (!option.description) return <React.Fragment key={option.value}>{row}</React.Fragment>;
    return (
      <TooltipHost
        key={option.value}
        content={option.description}
        delay={1}
        directionalHint={DirectionalHint.rightCenter}
        tooltipProps={{ styles: { content: { maxWidth: 280, whiteSpace: 'normal' } } }}
        styles={{ root: { display: 'block' } }}
      >
        {row}
      </TooltipHost>
    );
  };

  const fieldClassName = [
    "lops-amc-field",
    isTall ? "is-tall" : "is-short",
    isFocused ? "is-focused" : "",
    isDisabled ? "is-disabled" : ""
  ].join(" ");

  return (
    <ThemeFontScope fontFamily={fontFamily}>
    <div className="lops-amc-root" style={{ fontFamily }}>
      <div ref={fieldRef} className={fieldClassName} onMouseDown={onFieldMouseDown} aria-readonly={isDisabled || undefined}>
        <div className="lops-amc-values" ref={valuesRef}>
          {displayedOptions.map(opt => config.selectedDisplayMode === "Text"
            ? renderTextItem(opt)
            : renderPill(opt))}
          {!isDisabled && (
            <input
              ref={inputRef}
              className="lops-amc-input"
              type="text"
              role="combobox"
              aria-expanded={isOpen}
              aria-autocomplete="list"
              autoComplete="off"
              value={searchText}
              placeholder={config.placeholderText}
              onChange={e => { setSearchText(e.target.value); if (!isOpen) open(); }}
              onKeyDown={onKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
          )}
          {isDisabled && selectedOptions.length === 0 && <span className="lops-amc-empty-value">---</span>}
        </div>
        {!isDisabled && <Icon iconName="ChevronDown" className="lops-amc-chevron" aria-hidden="true" />}
      </div>

      {isOpen && !isDisabled && fieldRef.current && (
        <Callout
          target={fieldRef.current}
          isBeakVisible={false}
          gapSpace={2}
          directionalHint={DirectionalHint.bottomLeftEdge}
          directionalHintFixed={false}
          calloutWidth={fieldWidth}
          calloutMaxHeight={320}
          setInitialFocus={false}
          onDismiss={close}
          // Clicks on the field itself are handled by onFieldMouseDown - without this the Callout
          // would dismiss on mousedown and the field would immediately reopen it.
          // Scroll/resize events target window, which is not a Node, so check before contains().
          preventDismissOnEvent={ev => ev.target instanceof Node && !!fieldRef.current?.contains(ev.target)}
          styles={{ calloutMain: { borderRadius: 6 }, root: { borderRadius: 6, border: "1px solid #d2d0ce" } }}
        >
          {/* Inline font: the list renders in a Layer under <body>, outside .lops-amc-root. */}
          <div role="listbox" aria-multiselectable="true" className="lops-amc-list" style={{ fontFamily }}>
            {listOptions.length === 0
              ? <div className="lops-amc-no-results">No matching options</div>
              : listOptions.map(renderListItem)}
          </div>
        </Callout>
      )}
    </div>
    </ThemeFontScope>
  );
};
