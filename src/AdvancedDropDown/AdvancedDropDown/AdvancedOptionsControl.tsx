/** @jsx React.createElement */
import * as React from 'react';
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown";
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { Icon } from "@fluentui/react/lib/Icon";
import { ISelectableOption } from "@fluentui/react/lib/SelectableOption";
import { getIcon } from "@fluentui/react/lib/Styling";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";
import { DirectionalHint } from "@fluentui/react/lib/Callout";
import { dropdownStyles, myTheme } from "./DropdownStyles";
import { themeWithFont } from "./ThemeFont";

const LOG_PREFIX = "[lops.AdvancedDropDown]";

// ---------------------------------------------------------------------------------------------
// Family look - AdvancedMultiChoice / AdvancedLookUp
// ---------------------------------------------------------------------------------------------
// The selected value renders as AdvancedLookUp's selected-record chip (the same one
// AdvancedMultiChoice's Text display uses): a tinted backdrop inset 4px in the grey field, with
// the label darkened from that backdrop. Every blue default is one of AdvancedLookUp's two blues:
// #EDF3FB (its chip backdrop) and #255BA4 (that backdrop through darkenHexColor, its link/clear
// accent). An option without a color always falls back to exactly these (or the configured hex).
export const SERIES_ACCENT = "#255BA4";
const LIST_TEXT_COLOR = "#323130";
const LIST_BACKGROUND = "#FFFFFF";

// AdvancedMultiChoice's fade amounts: a faded background has to stay pale enough for dark text
// (0.82 - Lighter used 0.8 before, visually identical), an icon only needs to soften.
const FADE_BACKGROUND = 0.82;

// "Selection shape" - AdvancedMultiChoice's SELECTION_RADIUS.
const SELECTION_RADIUS: Record<IConfig['selectionShape'], string> = {
  Square: "2px",
  Rounded: "4px",
  Round: "999px"
};

// ---------------------------------------------------------------------------------------------
// Color helpers (AdvancedMultiChoice's)
// ---------------------------------------------------------------------------------------------

const isHexColor = (color: string | undefined): color is string =>
  !!color && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color.trim());

// Expands #abc to #aabbcc and drops an alpha pair, so every helper below sees #rrggbb.
const toHex6 = (color: string): string => {
  const h = color.trim().replace('#', '');
  return h.length === 3 ? `#${h.split('').map(c => c + c).join('')}` : `#${h.substr(0, 6)}`;
};

const isColorDark = (color: string): boolean => {
  if (!isHexColor(color)) return false;
  const hex = toHex6(color).replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
};

const lightenColor = (color: string, amount: number): string => {
  if (!isHexColor(color)) return color;
  const hex = toHex6(color).replace('#', '');
  const channel = (i: number) => {
    const c = parseInt(hex.substr(i, 2), 16);
    return Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
};

// AdvancedLookUp's darkenHexColor: HSL lightness x 0.41 (hue/saturation kept), pixel-calibrated
// there against the OOTB lookup chip (#EDF3FB backdrop -> #2B5D9E link/clear glyph).
const darkenHexColor = (color: string, factor = 0.41): string => {
  if (!isHexColor(color)) return color;
  const h = toHex6(color).replace('#', '');
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

// ---------------------------------------------------------------------------------------------
// Icon resolution - AdvancedMultiChoice's ";" fallback chain, plus this control's legacy
// Unicode-escape and CSS-class forms (kept so existing Icon / External Value values still work).
// ---------------------------------------------------------------------------------------------

// A publisher-prefixed Dataverse web resource name, e.g. "hek_HenkenTechBlack" or the folder
// form "hek_/images/logo.svg". None of the 1,801 registered MDL2 names contain an underscore,
// and neither do the Unicode-escape or CSS-class forms below, so a leading "<prefix>_" is an
// unambiguous marker for "this is an image in the org, not a font glyph". Checked before the
// CSS-class form on purpose: a web resource name may legitimately contain "icon-".
const WEB_RESOURCE_NAME_PATTERN = /^[a-z][a-z0-9]{1,7}_/i;
const UNICODE_PATTERNS = [/^\\u[0-9A-Fa-f]{4}$/, /^&#x[0-9A-Fa-f]+;$/, /^0x[0-9A-Fa-f]+$/, /^U\+[0-9A-Fa-f]{4}$/];
const isCssIconClass = (name: string): boolean =>
  name.includes('ms-Icon') || name.includes('fabric-icon') || name.includes('icon-') || name.startsWith('.');

// Test-harness hook: the harness serves nothing at /WebResources, so index.ts registers a few fake
// names (TestModeData.ts) that resolve to inline images instead. Never set against live Dataverse.
let webResourceUrlOverrides: Record<string, string> = {};
export const setWebResourceUrlOverrides = (overrides: Record<string, string>): void => {
  webResourceUrlOverrides = overrides;
};

// Image web resources are served same-origin at /WebResources/<name>, so rendering one needs no
// Web API round trip and no base64 decode -- the browser caches it like any other image.
const getWebResourceUrl = (name: string): string =>
  webResourceUrlOverrides[name.trim().toLowerCase()] ?? `/WebResources/${encodeURI(name.trim())}`;

// Converts "", "&#xE700;", "0xE700" or "U+E700" to the character itself.
const convertToUnicodeChar = (iconStr: string): string | null => {
  const cleaned = iconStr.trim();
  const hex = cleaned.startsWith('\\u') ? cleaned.substring(2)
    : cleaned.startsWith('&#x') ? cleaned.substring(3, cleaned.length - 1)
      : cleaned.startsWith('0x') || cleaned.startsWith('U+') ? cleaned.substring(2)
        : null;
  if (hex === null) return null;
  const code = parseInt(hex, 16);
  return Number.isNaN(code) ? null : String.fromCharCode(code);
};

// `getIcon` reads the registry `initializeIcons()` fills (case-insensitive). Fluent's <Icon>
// renders an empty span for an unknown name, hence this check. Cached because getIcon itself
// console.warns on every miss, which would otherwise repeat on every re-render.
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
  (value || "").split(";").map(s => s.trim()).filter(s => s.length > 0 && s !== 'undefined');

// "Show option color icon" off means "don't use color here": glyphs take the label color (see
// iconColorFor) and images are desaturated. No opacity fade - monochrome, not de-emphasis.
const DESATURATED_IMAGE_FILTER = 'grayscale(1)';
const ICON_SIZE = 16;

interface IIconChainProps {
  chain: string[];
  color: string;
  desaturate: boolean;
}

// Walks the chain left to right: the first web resource that loads, registered MDL2 name, or
// Unicode/CSS-class form wins; nothing left -> a dot in the icon color (AdvancedMultiChoice's
// fallback, replacing the old 12px color circle). A web resource can only be known to fail after
// the browser tries it, so it renders the rest of the chain as its own onError fallback.
const IconChain = ({ chain, color, desaturate }: IIconChainProps): React.ReactElement => {
  for (let i = 0; i < chain.length; i++) {
    const name = chain[i];
    if (WEB_RESOURCE_NAME_PATTERN.test(name)) {
      const rest = chain.slice(i + 1);
      return (
        <WebResourceIcon
          name={name}
          desaturate={desaturate}
          renderFallback={() => <IconChain chain={rest} color={color} desaturate={desaturate} />}
        />
      );
    }
    if (UNICODE_PATTERNS.some(pattern => pattern.test(name))) {
      const char = convertToUnicodeChar(name);
      if (char) {
        return (
          <span className="lops-add-icon" aria-hidden="true"
            style={{ color, fontFamily: 'Segoe MDL2 Assets, Segoe UI Symbol, Symbols', fontSize: `${ICON_SIZE - 2}px`, width: `${ICON_SIZE}px` }}>
            {char}
          </span>
        );
      }
      continue;
    }
    if (isCssIconClass(name)) {
      const cssClass = name.startsWith('.') ? name.substring(1) : name;
      return (
        <i className={`lops-add-icon ms-Icon ${cssClass.includes('ms-Icon') ? cssClass : `ms-Icon--${cssClass}`}`}
          aria-hidden="true" style={{ color, fontSize: `${ICON_SIZE - 2}px`, width: `${ICON_SIZE}px` }} />
      );
    }
    if (isRegisteredMdl2Icon(name)) {
      return (
        <Icon iconName={name} aria-hidden="true" className="lops-add-icon"
          styles={{ root: { fontSize: `${ICON_SIZE - 2}px`, width: `${ICON_SIZE}px`, color } }} />
      );
    }
    warnOnce(name,
      `Icon "${name}" is not an MDL2 icon name - trying the next fallback. See FLUENT_ICONS.md ` +
      `for the supported names (Segoe Fluent Icons names from the Windows docs mostly do not exist here).`);
  }
  return <span className="lops-add-dot" aria-hidden="true" style={{ backgroundColor: color }} />;
};

interface IWebResourceIconProps {
  name: string;
  desaturate: boolean;
  renderFallback: () => React.ReactElement;
}

// Module-level so a name that already failed skips straight to its fallback on every later
// mount, instead of re-requesting a known 404 each time the list re-renders.
const failedWebResources = new Set<string>();

// One detached <img> per web resource URL, kept for the page's lifetime. The list is unmounted
// whenever it closes, so only the selected option's icon stayed referenced; the others were
// dropped from the browser's in-memory image cache and some reopenings re-requested them, so the
// icons popped in ~0.5s after the list (measured on the test form, Solution 9.0.2.0). While an
// image is still referenced, a new <img> with the same URL is served from memory at once.
const keptImages = new Map<string, HTMLImageElement>();
const keepImageAlive = (url: string): void => {
  if (keptImages.has(url)) return;
  const img = new Image();
  img.src = url;
  keptImages.set(url, img);
};

const WebResourceIcon = ({ name, desaturate, renderFallback }: IWebResourceIconProps): React.ReactElement => {
  const [failed, setFailed] = React.useState(() => failedWebResources.has(name));
  React.useEffect(() => setFailed(failedWebResources.has(name)), [name]);
  // Keeps a fallback icon too (e.g. the second web resource of a ";" chain whose first one is
  // missing), not only the first name of each chain that the options effect warms up.
  React.useEffect(() => { if (!failed) keepImageAlive(getWebResourceUrl(name)); }, [name, failed]);

  if (failed) return renderFallback();

  return (
    <img
      src={getWebResourceUrl(name)}
      alt=""
      aria-hidden="true"
      className="lops-add-icon"
      onError={() => {
        warnOnce(name,
          `Web resource "${name}" could not be loaded from ${getWebResourceUrl(name)} - trying the ` +
          `next fallback. Check that it exists, is an image type, and has been published.`);
        failedWebResources.add(name);
        setFailed(true);
      }}
      style={{ width: `${ICON_SIZE}px`, height: `${ICON_SIZE}px`, objectFit: 'contain', filter: desaturate ? DESATURATED_IMAGE_FILTER : 'none' }}
    />
  );
};

import { IInputs } from "./generated/ManifestTypes";

export interface ISetupSchemaValue {
  icon?: string;
  color?: string;
}
export type ISetupSchema = Record<string, ISetupSchemaValue>;

export interface IConfig {
  jsonConfig: ISetupSchema | undefined;
  defaultIconName: string;
  sortBy: "Text" | "Value";
  hideHiddenOptions: boolean;
  showColorIcon: boolean;
  showColorBorder: boolean;
  showColorBackground: "No" | "Lighter" | "Full";
  makeFontBold: boolean;
  componentHeight: "Tall" | "Short";
  iconColorOverride?: string;
  useExternalValueForIcon: boolean;
  placeholderText: string;
  selectionShape: "Square" | "Rounded" | "Round";
  selectionColor: string;
  hoverColor: string;
  listSelectedColor: string;
}

initializeIcons();

interface IAdvancedOptionsProperties {
  rawOptions: ComponentFramework.PropertyHelper.OptionMetadata[];
  selectedKey: number | null;
  onChange: (value: number | null) => void
  isDisabled: boolean;
  defaultValue: number | undefined;
  config: IConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contextUtils: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contextParameters: any;
  contextMode: ComponentFramework.Mode;
  // Resolved theme font stack (ThemeFont.tsx), for the list, which renders in a Layer.
  fontFamily: string;
}

// Shared tooltip look (AdvancedMultiChoice's): Fluent's own tooltip, wrapped at 280px.
const TOOLTIP_PROPS = { styles: { content: { maxWidth: 280, whiteSpace: 'normal' as const } } };

export const AdvancedOptionsControl = ({ rawOptions, selectedKey, onChange, isDisabled, defaultValue, config, contextUtils, contextParameters, contextMode, fontFamily }: IAdvancedOptionsProperties): React.ReactElement => {

  // State for enriched icons from metadata
  const [externalIconsMap, setExternalIconsMap] = React.useState<Record<number, string>>({});
  const [hasFetchedMetadata, setHasFetchedMetadata] = React.useState(false);

  // Fetch full metadata if External Value Icons are enabled
  React.useEffect(() => {
    // Detect if we're in test mode inside the effect
    const hostname = typeof window !== 'undefined' ? window.location?.hostname || '' : '';
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost');
    const isHarness = typeof window !== 'undefined' && (window.location?.port === '8181' || window.location?.href?.includes('_pkg/') || document.title?.includes('Test harness'));
    const isTest = isLocal || isHarness;

    if (config.useExternalValueForIcon && !hasFetchedMetadata && (contextUtils || contextParameters)) {

      try {
        // Robust entity name resolution
        let entityName = contextParameters?.optionsInput?.etn; // Default PCF property

        if (!entityName) {
          // Fallback 1: Context Info
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          entityName = (contextMode as any)?.contextInfo?.entityTypeName;
        }

        if (!entityName) {
          // Fallback 2: Page Context (if available globally or via utils)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const page = (contextUtils as any)?.page;
          if (page && page.entityTypeName) {
            entityName = page.entityTypeName;
          }
        }

        if (!entityName) {
          // Fallback 3: Parameters root
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          entityName = (contextParameters as any)?.entityTypeName;
        }

        // Try multiple ways to get the attribute name
        let attributeName: string | undefined = undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const optionsInputAny = contextParameters?.optionsInput as any;

        if (optionsInputAny) {
          attributeName = optionsInputAny.logicalName || optionsInputAny._logicalName;

          if (!attributeName && optionsInputAny.attributes && optionsInputAny.attributes.LogicalName) {
            attributeName = optionsInputAny.attributes.LogicalName;
          }
        }

        if (entityName && attributeName) {
          setHasFetchedMetadata(true);

          let settled = false;
          const timeoutId = setTimeout(() => {
            if (!settled) {
              console.warn(`🕒 ASYNC TIMEOUT: Web API fetch for ${entityName}.${attributeName} has not settled after 10 seconds.`);
            }
          }, 10000);

          const queryUrl = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${attributeName}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$expand=OptionSet`;

          fetch(queryUrl, {
            method: "GET",
            headers: {
              "OData-MaxVersion": "4.0",
              "OData-Version": "4.0",
              "Accept": "application/json",
              "Content-Type": "application/json; charset=utf-8",
              "Prefer": "odata.include-annotations=\"*\""
            }
          }).then(response => {
            if (!response.ok) {
              throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }
            return response.json();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }).then((metadata: any) => {
            settled = true;
            clearTimeout(timeoutId);

            const optionSet = metadata.OptionSet;

            if (optionSet && optionSet.Options) {
              const map: Record<number, string> = {};
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              optionSet.Options.forEach((opt: any) => {
                const extVal = opt.ExternalValue;
                const val = opt.Value;

                if (extVal && val !== undefined) {
                  map[val] = extVal;
                }
              });
              setExternalIconsMap(map);
            } else {
              console.warn("⚠️ WARNING: OptionSet or Options not found in Web API response.");
            }
            return settled;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }).catch((err: any) => {
            settled = true;
            clearTimeout(timeoutId);
            console.warn("❌ FAILED to fetch entity metadata via Web API:", err);
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error("❌ CRITICAL error during metadata fetch setup:", err);
      }
    }
  }, [config.useExternalValueForIcon, hasFetchedMetadata, contextUtils, contextParameters, contextMode]);

  const allOptions = [{ Label: "--Select--", Value: -1, Color: "transparent", Description: "" }, ...rawOptions];
  let options = allOptions.map((option: ComponentFramework.PropertyHelper.OptionMetadata) => ({
    key: option.Value,
    text: option.Label,
    data: {
      color: option.Color,
      description: (option as unknown as Record<string, unknown>).Description as string || (option as unknown as Record<string, unknown>).description as string || "",
      externalValue: (option as unknown as Record<string, unknown>).ExternalValue as string || (option as unknown as Record<string, unknown>).externalValue as string || (option as unknown as Record<string, unknown>).externalvalue as string || ""
    }
  }))
  if (config.sortBy === "Text") {
    options = options.sort((a, b) => a.text.localeCompare(b.text));
  }

  const _onSelectedChanged = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
    if (isDisabled) return;
    const val = (option?.key == null || option?.key === -1) ? null : option?.key as number;
    onChange(val);
  }

  // ---- color resolution ---------------------------------------------------------------------
  // The existing properties keep their meaning; they now drive the family chip instead of the
  // whole field:
  //   Color Override            replaces the option color everywhere (as before)
  //   Show option color background   No -> Selection color; Lighter -> faded option color;
  //                                  Full -> option color (an option without a color, and no
  //                                  override, gets Selection color exactly)
  //   Show option color border  1px border on the chip in the option color (#255BA4 without one)
  //   Show option color icon    on -> option color (#255BA4 without one); off -> monochrome

  const optionColor = (option: ISelectableOption | undefined): string | undefined => {
    const jsonColor = (config.jsonConfig && option?.key !== undefined) ? config.jsonConfig[option.key]?.color : undefined;
    // Each candidate must be valid hex on its own - an unparseable override must fall through to
    // the option color, not mask it.
    return [config.iconColorOverride, jsonColor, option?.data?.color].find(isHexColor);
  };

  const chipBackground = (color: string | undefined): string => {
    if (config.showColorBackground === "Full") return color ?? config.selectionColor;
    if (config.showColorBackground === "Lighter") return color ? lightenColor(color, FADE_BACKGROUND) : config.selectionColor;
    return config.selectionColor;
  };

  // `contrast` is the label color on the same surface, so a monochrome icon matches its label.
  const iconColorFor = (color: string | undefined, background: string, contrast: string): string => {
    if (!config.showColorIcon) return contrast;
    const resolved = color ?? SERIES_ACCENT;
    // A glyph the same color as the chip behind it would vanish (e.g. Full background).
    return isHexColor(background) && toHex6(resolved).toLowerCase() === toHex6(background).toLowerCase() ? contrast : resolved;
  };

  const iconChainFor = (option: ISelectableOption | undefined): string[] => {
    const fixed = ((config.jsonConfig && option?.key !== undefined) ? config.jsonConfig[option.key]?.icon : undefined) ?? config.defaultIconName;
    const external = config.useExternalValueForIcon
      ? (externalIconsMap[option?.key as number] || option?.data?.externalValue || "")
      : "";
    return [...parseIconChain(external), ...parseIconChain(fixed)];
  };

  // Load every option's web-resource icon as soon as the options are known and keep it referenced
  // (keepImageAlive), so opening the list never waits on its icons.
  const webResourceIconKey = options
    .map(option => iconChainFor(option).find(name => WEB_RESOURCE_NAME_PATTERN.test(name)) ?? "")
    .filter(Boolean)
    .join("|");
  React.useEffect(() => {
    webResourceIconKey.split("|").filter(Boolean).forEach(name => keepImageAlive(getWebResourceUrl(name)));
  }, [webResourceIconKey]);

  const renderIcon = (option: ISelectableOption | undefined, background: string, contrast: string): React.ReactElement => {
    // "--Select--" keeps an icon-sized gap so its label lines up with the others.
    if (option?.key === -1) return <span className="lops-add-icon" style={{ width: `${ICON_SIZE}px` }} aria-hidden="true" />;
    return <IconChain chain={iconChainFor(option)} color={iconColorFor(optionColor(option), background, contrast)} desaturate={!config.showColorIcon} />;
  };

  // ---- rendering ----------------------------------------------------------------------------

  // Dropdown list row: icon + label, description tooltip (AdvancedMultiChoice's list row). Row
  // backgrounds (List hover / List selected color) come from dropdownStyles.
  const _onRenderOption = (option: ISelectableOption | undefined): React.ReactElement => {
    const description = (option?.data?.description as string | undefined)?.trim() || "";
    const row = (
      <div className="lops-add-item">
        {renderIcon(option, LIST_BACKGROUND, LIST_TEXT_COLOR)}
        <span className="lops-add-label">{option?.text || ""}</span>
      </div>
    );
    if (!description) return row;
    return (
      <TooltipHost content={description} delay={1} directionalHint={DirectionalHint.rightCenter}
        tooltipProps={TOOLTIP_PROPS} styles={{ root: { display: 'block', width: '100%' } }}>
        {row}
      </TooltipHost>
    );
  };

  // Selected value: the family chip. Only called when something is selected - Fluent renders its
  // own placeholder text node for the empty state.
  const _onRenderTitle = (selected: IDropdownOption[] | undefined): React.ReactElement => {
    const option = (selected || [])[0];
    const color = optionColor(option);
    const background = chipBackground(color);
    const accent = isColorDark(background) ? "#FFFFFF" : darkenHexColor(background);
    const border = config.showColorBorder ? `1px solid ${color ?? SERIES_ACCENT}` : "1px solid transparent";
    const chip = (
      <span
        className="lops-add-chip"
        style={{
          backgroundColor: background,
          color: accent,
          border,
          borderRadius: SELECTION_RADIUS[config.selectionShape] ?? SELECTION_RADIUS.Rounded,
          fontWeight: config.makeFontBold ? 600 : 400
        }}
      >
        {renderIcon(option, background, accent)}
        <span className="lops-add-label">{option?.text || ""}</span>
      </span>
    );
    const description = (option?.data?.description as string | undefined)?.trim() || option?.text || "";
    return (
      <TooltipHost content={description} delay={1} directionalHint={DirectionalHint.topCenter}
        tooltipProps={TOOLTIP_PROPS} hostClassName="lops-add-chip-host">
        {chip}
      </TooltipHost>
    );
  };

  // Only a value Fluent can actually render as the chip - a stored number with no matching (e.g.
  // hidden) option shows the placeholder, which needs the placeholder's own inset.
  const hasValue = selectedKey !== null && selectedKey !== -1 && options.some(o => o.key === selectedKey);

  return (
    <div className="lops-add-root" style={{ minHeight: config.componentHeight === "Short" ? '32px' : '40px' }}>
      <Dropdown
        // Read-only and empty shows "---" (AdvancedMultiChoice), not an inviting placeholder.
        placeHolder={isDisabled ? "---" : config.placeholderText}
        options={options}
        defaultSelectedKey={defaultValue || -1}
        selectedKey={selectedKey}
        onRenderTitle={_onRenderTitle}
        onRenderOption={_onRenderOption}
        onChange={_onSelectedChanged}
        disabled={isDisabled}
        className="ComboBox"
        styles={(props) => dropdownStyles(props, {
          hasValue,
          makeFontBold: config.makeFontBold,
          componentHeight: config.componentHeight,
          hoverColor: config.hoverColor,
          listSelectedColor: config.listSelectedColor
        })}
        // Explicit theme prop beats the scoped one, so it carries the theme font itself.
        theme={themeWithFont(fontFamily, myTheme)}
      />
    </div>
  );
};
