/** @jsx React.createElement */
import * as React from 'react';
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { Icon } from "@fluentui/react/lib/Icon";
import { getIcon } from "@fluentui/react/lib/Styling";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";
import { DirectionalHint } from "@fluentui/react/lib/Callout";
import { ThemeFontScope } from "./ThemeFont";

initializeIcons();

export interface IYesNoOption {
  label: string;
  color?: string;
}

export interface IYesNoOptions {
  yes: IYesNoOption;
  no: IYesNoOption;
}

// Same color mode names as AdvancedMultiChoice/ModernChoiceButtons, so a maker configuring
// several family controls sees identical options.
export type ColorMode = "CustomColor" | "ChoiceColor" | "CustomColorFaded";
export type DisplayStyle = "Checkbox" | "Toggle" | "LabeledSwitch" | "Radio" | "Buttons" | "Segmented" | "ToggleButton" | "Chip" | "Icon";

export interface IConfig {
  displayStyle: DisplayStyle;
  showLabels: boolean;
  labelPosition: "Right" | "Left";
  optionOrder: "YesFirst" | "NoFirst";
  widthMode: "Fill" | "Fixed";
  fixedWidth: number;
  componentHeight: "Tall" | "Short";
  selectionShape: "Square" | "Rounded" | "Round";
  makeFontBold: boolean;
  yesIcon: string;
  noIcon: string;
  iconPosition: "Left" | "Right" | "Above" | "Below";
  iconColorMode: "Auto" | ColorMode;
  iconColor: string;
  checkedColorMode: ColorMode;
  checkedColor: string;
  selectionBackgroundMode: ColorMode;
  selectionColor: string;
  selectionBorderMode: "Off" | ColorMode;
  selectionBorderColor: string;
}

interface IAdvancedYesNoProps {
  // null = no value yet (a new record whose Yes/No column has no default).
  value: boolean | null;
  options: IYesNoOptions;
  onChange: (value: boolean) => void;
  isDisabled: boolean;
  config: IConfig;
  // Resolved theme font stack (ThemeFont.tsx): the app's custom theme font, then Segoe UI.
  fontFamily: string;
}

const LOG_PREFIX = "[lops.AdvancedYesNo]";

// Family constants - the same values as AdvancedMultiChoice / AdvancedLookUp (see the main
// CLAUDE.md "Component family conventions"): field greys, text colors, and the blue series.
const TEXT_COLOR = "#323130";
const MUTED_TEXT_COLOR = "#605e5c";
const PLACEHOLDER_COLOR = "#a19f9d";
const PAGE_BACKGROUND = "#FFFFFF";

// The Icon display style's glyphs when Yes icon / No icon are blank or don't render: a check badge
// and a cancel badge (user choice; verified registered in FLUENT_ICONS.md).
const DEFAULT_ICON_STYLE_YES = "CompletedSolid";
const DEFAULT_ICON_STYLE_NO = "StatusErrorFull";

// How far each "faded" mode blends the option color toward white - AdvancedMultiChoice's values.
const FADE_BACKGROUND = 0.82;
const FADE_BORDER = 0.5;
const FADE_ICON = 0.45;

// Unselected Buttons/Segmented icons are shown neutral so the colored one is clearly the
// selected option (ModernChoiceButtons' DEEMPHASIZED_IMAGE_FILTER, applied to glyphs too).
const DEEMPHASIZED_FILTER = "grayscale(1) opacity(0.55)";

const SHAPE_RADIUS: Record<IConfig['selectionShape'], string> = {
  Square: "2px",
  Rounded: "4px",
  Round: "999px"
};

// ---------------------------------------------------------------------------------------------
// Icons - one configured value per option (no `;` fallback chain: the maker sets the icon for Yes
// and for No directly, since a Yes/No column has no External Values). MDL2 name or web resource.
// ---------------------------------------------------------------------------------------------

// A publisher-prefixed Dataverse web resource name, e.g. "lops_logo.svg". No registered MDL2 name
// contains an underscore, so a leading "<prefix>_" unambiguously marks an image, not a glyph.
const WEB_RESOURCE_NAME_PATTERN = /^[a-z][a-z0-9]{1,7}_/i;

// Test-harness hook: the harness serves nothing at /WebResources, so index.ts registers a few fake
// names (TestModeData.ts) that resolve to inline images instead. Never set against live Dataverse.
let webResourceUrlOverrides: Record<string, string> = {};
export const setWebResourceUrlOverrides = (overrides: Record<string, string>): void => {
  webResourceUrlOverrides = overrides;
};

const getWebResourceUrl = (name: string): string =>
  webResourceUrlOverrides[name.trim().toLowerCase()] ?? `/WebResources/${encodeURI(name.trim())}`;

// `getIcon` reads the registry initializeIcons() fills (case-insensitive). Fluent's <Icon> renders
// an empty box for an unknown name, hence the check; cached because getIcon warns on every miss.
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

const warnedIconNames = new Set<string>();
const warnOnce = (name: string, message: string): void => {
  if (warnedIconNames.has(name)) return;
  warnedIconNames.add(name);
  console.warn(`${LOG_PREFIX} ${message}`);
};

interface IIconViewProps {
  name: string;
  color: string;
  size: number;
  deemphasized?: boolean;
  // What to render when `name` is blank, unregistered, or a web resource that fails to load.
  // Only the Icon display style passes one (its default glyph); elsewhere no icon is shown.
  fallbackName?: string;
}

const IconView = ({ name, color, size, deemphasized, fallbackName }: IIconViewProps): React.ReactElement | null => {
  const filter = deemphasized ? DEEMPHASIZED_FILTER : undefined;
  const renderFallback = (): React.ReactElement | null =>
    fallbackName && fallbackName !== name
      ? <IconView name={fallbackName} color={color} size={size} deemphasized={deemphasized} />
      : null;

  if (!name) return renderFallback();
  if (WEB_RESOURCE_NAME_PATTERN.test(name)) {
    return <WebResourceIcon name={name} size={size} filter={filter} renderFallback={renderFallback} />;
  }
  if (isRegisteredMdl2Icon(name)) {
    return (
      <Icon
        iconName={name}
        aria-hidden="true"
        className="lops-ayn-icon"
        styles={{ root: { fontSize: `${size - 2}px`, width: `${size}px`, height: `${size}px`, color, filter } }}
      />
    );
  }
  warnOnce(name,
    `Icon "${name}" is not an MDL2 icon name. See FLUENT_ICONS.md for the supported names ` +
    `(Segoe Fluent Icons names from the Windows docs mostly do not exist here).`);
  return renderFallback();
};

interface IWebResourceIconProps {
  name: string;
  size: number;
  filter?: string;
  renderFallback: () => React.ReactElement | null;
}

// A missing/unpublished web resource only surfaces as the <img>'s own load error, so this has to
// be a stateful component. Module-level cache: a known 404 isn't re-requested on every render.
const failedWebResources = new Set<string>();

const WebResourceIcon = ({ name, size, filter, renderFallback }: IWebResourceIconProps): React.ReactElement | null => {
  const [failed, setFailed] = React.useState(() => failedWebResources.has(name));
  React.useEffect(() => setFailed(failedWebResources.has(name)), [name]);

  if (failed) return renderFallback();

  return (
    <img
      src={getWebResourceUrl(name)}
      alt=""
      aria-hidden="true"
      className="lops-ayn-icon"
      onError={() => {
        warnOnce(name,
          `Web resource "${name}" could not be loaded from ${getWebResourceUrl(name)}. ` +
          `Check that it exists, is an image type, and has been published.`);
        failedWebResources.add(name);
        setFailed(true);
      }}
      style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain', filter }}
    />
  );
};

// ---------------------------------------------------------------------------------------------
// Color helpers (copied from AdvancedMultiChoice)
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

// AdvancedLookUp's darkenHexColor (HSL lightness x 0.41): #EDF3FB -> #255BA4, the chip label accent.
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

// Family rule: an option without a color gets the configured hex EXACTLY; the fade only ever
// applies to a real option color.
const resolveModeColor = (mode: ColorMode, optionColor: string | undefined, customColor: string, fade: number): string => {
  const usable = isHexColor(optionColor) ? optionColor : undefined;
  if (mode === "ChoiceColor") return usable ?? customColor;
  if (mode === "CustomColorFaded") return usable ? lightenColor(usable, fade) : customColor;
  return customColor;
};

// `contrast` is what Automatic resolves to - the text color of the surface the icon sits on.
const resolveIconColor = (config: IConfig, optionColor: string | undefined, background: string, contrast: string): string => {
  if (config.iconColorMode === "Auto") return contrast;
  const color = resolveModeColor(config.iconColorMode, optionColor, config.iconColor, FADE_ICON);
  // A glyph the same color as its background would vanish - drop back to contrast.
  return color.toLowerCase() === background.toLowerCase() ? contrast : color;
};

// WCAG 2 relative luminance and contrast ratio (https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio).
const relativeLuminance = (color: string): number => {
  const hex = color.replace('#', '');
  const channel = (i: number): number => {
    const c = parseInt(hex.substr(i, 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
};

const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// Black or white text on a solid fill (user: "make it so the font is either black or white based
// on best contrast" - a gold Labeled switch track was unreadable with the old brightness cut-off,
// which picked a darkened gold). White wins whenever it is readable (WCAG AA, 4.5:1); only below
// that does the higher ratio decide. Pure "highest ratio" picked black on mid-tones where both are
// ~4.6:1 (teal #038387, blue #0078D4, orange #CA5010), which looked wrong; gold #C19C00 (white
// 2.6:1) still gets black.
const blackOrWhiteOn = (background: string): string => {
  if (!isHexColor(background)) return "#000000";
  const bg = background.substr(0, 7);
  const white = contrastRatio("#FFFFFF", bg);
  return white >= 4.5 || white >= contrastRatio("#000000", bg) ? "#FFFFFF" : "#000000";
};

// Text on a selected option: the family's darkened tint of the background (#255BA4 on #EDF3FB),
// darkened further in steps until it is readable (WCAG AA, 4.5:1) - e.g. faded green's standard
// tint is only 4.2:1, faded yellow's 2.5:1. Backgrounds no tint can reach (solid mid and dark
// colors) get black or white instead.
const TINT_FACTORS = [CHIP_ACCENT_LIGHTNESS_FACTOR, 0.35, 0.3, 0.25, 0.2];
const readableTextOn = (background: string): string => {
  if (!isHexColor(background)) return "#000000";
  const bg = background.substr(0, 7);
  for (const factor of TINT_FACTORS) {
    const tint = darkenHexColor(bg, factor);
    if (contrastRatio(tint, bg) >= 4.5) return tint;
  }
  return blackOrWhiteOn(bg);
};

// Selected-option look for Buttons / Segmented / Status chip: the family's selected-value chip
// (AdvancedLookUp's #EDF3FB backdrop with its darkened #255BA4 label by default).
const resolveSelectionStyle = (config: IConfig, option: IYesNoOption): { background: string; text: string; border: string } => {
  const background = resolveModeColor(config.selectionBackgroundMode, option.color, config.selectionColor, FADE_BACKGROUND);
  const text = readableTextOn(background);
  const border = config.selectionBorderMode === "Off"
    ? "transparent"
    : resolveModeColor(config.selectionBorderMode, option.color, config.selectionBorderColor, FADE_BORDER);
  return { background, text, border };
};

// ---------------------------------------------------------------------------------------------
// Control
// ---------------------------------------------------------------------------------------------

export const AdvancedYesNoControl = ({ value, options, onChange, isDisabled, config, fontFamily }: IAdvancedYesNoProps): React.ReactElement => {
  const style = config.displayStyle;
  const isTall = config.componentHeight === "Tall";
  const radius = SHAPE_RADIUS[config.selectionShape] ?? SHAPE_RADIUS.Rounded;
  const fontWeight = config.makeFontBold ? 600 : 400;
  const buttonRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  // Width: Fill (the field width, shared equally) or Fixed (fixedWidth px per button, segment,
  // radio option or chip; not the Labeled switch). A fixed width may still SHRINK (flex-shrink 1, min-width 0)
  // when the field is narrower - two 300px buttons in a 469px field used to overflow to 608px.
  const isFixed = config.widthMode === "Fixed";
  const fixedPx = `${config.fixedWidth}px`;
  const fixedItem: React.CSSProperties = isFixed ? { width: fixedPx, flex: "0 1 auto", minWidth: 0 } : {};

  const optionFor = (v: boolean): IYesNoOption => (v ? options.yes : options.no);
  const iconNameFor = (v: boolean): string => (v ? config.yesIcon : config.noIcon);

  // Every write path checks isDisabled itself (AdvancedLookUp v1.8.1 lesson), not just the markup.
  const set = (next: boolean) => {
    if (isDisabled || next === value) return;
    onChange(next);
  };
  // null flips to Yes: a first click on an empty checkbox/toggle means "turn it on".
  const flip = () => set(value !== true);

  const onSwitchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      flip();
    }
  };

  // Icon + label pair; the icon sits on the side iconPosition asks for (Above/Below only exist
  // for Buttons and Toggle button - anywhere else they read as Left/Right).
  const renderIconLabel = (v: boolean, opts: { textColor: string; background: string; iconSize: number; bold?: boolean; deemphasized?: boolean; column?: boolean; showLabel?: boolean; fallbackIcon?: string }) => {
    const option = optionFor(v);
    const iconFirst = config.iconPosition === "Left" || config.iconPosition === "Above";
    const icon = (
      <IconView
        name={iconNameFor(v)}
        color={resolveIconColor(config, option.color, opts.background, opts.textColor)}
        size={opts.iconSize}
        deemphasized={opts.deemphasized}
        fallbackName={opts.fallbackIcon}
      />
    );
    const showLabel = opts.showLabel ?? config.showLabels;
    return (
      <span
        className={`lops-ayn-iconlabel${opts.column ? " is-column" : ""}`}
        style={{
          flexDirection: opts.column ? (iconFirst ? "column" : "column-reverse") : (iconFirst ? "row" : "row-reverse"),
          color: opts.textColor,
          fontWeight: opts.bold ? 600 : fontWeight
        }}
      >
        {icon}
        {showLabel && <span className="lops-ayn-label">{option.label}</span>}
      </span>
    );
  };

  // ---- Checkbox / Toggle / Labeled switch / Icon: one switch element plus the current label ----

  const renderSwitchRow = (control: React.ReactElement, role: "checkbox" | "switch", tooltip?: string) => {
    const current = value === null ? null : optionFor(value);
    let text: React.ReactNode = null;
    if (value === null) {
      if (config.showLabels) text = <span className="lops-ayn-label lops-ayn-empty">---</span>;
    } else if (style === "Icon" || style === "Toggle") {
      // Icon: the icon IS the control, so only the label goes beside it. Toggle: no icons at all
      // (user: icons "do not make sense" on a plain switch).
      if (config.showLabels) text = <span className="lops-ayn-label" style={{ color: TEXT_COLOR, fontWeight }}>{current?.label}</span>;
    } else if (style === "LabeledSwitch") {
      // The label and icon are drawn inside the switch itself.
      text = null;
    } else if (config.showLabels || iconNameFor(value)) {
      text = renderIconLabel(value, { textColor: TEXT_COLOR, background: PAGE_BACKGROUND, iconSize: 16 });
    }
    const row = (
      <div
        className={`lops-ayn-switchrow${config.labelPosition === "Left" ? " is-label-left" : ""}${isDisabled ? " is-disabled" : ""}`}
        role={role}
        aria-checked={value === true}
        aria-disabled={isDisabled || undefined}
        aria-label={current?.label ?? "---"}
        tabIndex={0}
        onClick={flip}
        onKeyDown={onSwitchKeyDown}
      >
        {control}
        {text}
      </div>
    );
    if (!tooltip) return row;
    return (
      <TooltipHost
        content={tooltip}
        delay={1}
        directionalHint={DirectionalHint.topCenter}
        tooltipProps={{ styles: { content: { maxWidth: 280, whiteSpace: 'normal' } } }}
        styles={{ root: { display: 'inline-flex', maxWidth: '100%', minWidth: 0 } }}
      >
        {row}
      </TooltipHost>
    );
  };

  const checkedFill = resolveModeColor(config.checkedColorMode, options.yes.color, config.checkedColor, FADE_BACKGROUND);

  const renderCheckbox = () => renderSwitchRow(
    <span
      className={`lops-ayn-checkbox${value === true ? " is-checked" : ""}`}
      aria-hidden="true"
      style={{
        borderRadius: config.selectionShape === "Round" ? "50%" : radius,
        ...(value === true ? { backgroundColor: checkedFill, borderColor: checkedFill, color: blackOrWhiteOn(checkedFill) } : {})
      }}
    >
      {value === true && <Icon iconName="CheckMark" />}
    </span>,
    "checkbox"
  );

  const renderToggle = () => renderSwitchRow(
    <span
      className={`lops-ayn-toggle${value === true ? " is-on" : ""}`}
      aria-hidden="true"
      style={value === true ? { backgroundColor: checkedFill, borderColor: checkedFill } : undefined}
    >
      <span
        className="lops-ayn-thumb"
        style={value === true && !isColorDark(checkedFill) ? { backgroundColor: darkenHexColor(checkedFill) } : undefined}
      />
    </span>,
    "switch"
  );

  const renderIconStyle = () => {
    const v = value === true;
    const option = optionFor(v);
    // No value shows the No glyph (unfilled) - there's nothing else a single icon could show.
    const button = (
      <span className="lops-ayn-iconbutton" aria-hidden="true" style={{ borderRadius: radius }}>
        <IconView
          name={iconNameFor(v)}
          color={value === true
            ? resolveIconColor(config, option.color, PAGE_BACKGROUND, config.iconColor)
            : resolveIconColor(config, option.color, PAGE_BACKGROUND, MUTED_TEXT_COLOR)}
          size={isTall ? 24 : 20}
          fallbackName={v ? DEFAULT_ICON_STYLE_YES : DEFAULT_ICON_STYLE_NO}
        />
      </span>
    );
    return renderSwitchRow(button, "switch", value === null ? "---" : option.label);
  };

  // ---- Buttons / Segmented: a radio group of the two options ----

  const order: boolean[] = config.optionOrder === "NoFirst" ? [false, true] : [true, false];

  const onRadioKeyDown = (e: React.KeyboardEvent, index: number) => {
    const move = (delta: number) => {
      e.preventDefault();
      const next = (index + delta + order.length) % order.length;
      set(order[next]);
      buttonRefs.current[next]?.focus();
    };
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        move(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        move(-1);
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        set(order[index]);
        break;
    }
  };

  // Roving tabindex: the selected option (or the first, with no value) is the one Tab stops on.
  const tabIndexFor = (v: boolean, index: number): number =>
    (value === null ? index === 0 : value === v) ? 0 : -1;

  const radioProps = (v: boolean, index: number) => ({
    ref: (el: HTMLDivElement | null) => { buttonRefs.current[index] = el; },
    role: "radio",
    "aria-checked": value === v,
    "aria-label": optionFor(v).label,
    tabIndex: tabIndexFor(v, index),
    onClick: () => set(v),
    onKeyDown: (e: React.KeyboardEvent) => onRadioKeyDown(e, index)
  });

  const renderButtons = () => {
    const column = config.iconPosition === "Above" || config.iconPosition === "Below";
    return (
      <div
        className={`lops-ayn-buttons${isTall ? " is-tall" : ""}${isDisabled ? " is-disabled" : ""}${config.showLabels ? "" : " is-icon-only"}${isFixed ? " is-fixed" : ""}`}
        role="radiogroup"
        aria-disabled={isDisabled || undefined}
      >
        {order.map((v, index) => {
          const selected = value === v;
          const sel = resolveSelectionStyle(config, optionFor(v));
          return (
            <div
              key={String(v)}
              {...radioProps(v, index)}
              className={`lops-ayn-button${selected ? " is-selected" : ""}${column ? " is-column" : ""}`}
              title={config.showLabels ? undefined : optionFor(v).label}
              style={{
                borderRadius: radius,
                ...fixedItem,
                ...(selected ? { backgroundColor: sel.background, borderColor: sel.border } : {})
              }}
            >
              {renderIconLabel(v, {
                textColor: selected ? sel.text : TEXT_COLOR,
                background: selected ? sel.background : "#f5f5f5",
                iconSize: column ? 20 : 16,
                bold: selected,
                deemphasized: !selected && value !== null,
                column,
                // Icon-only buttons with no icon configured would be blank - keep the label then.
                showLabel: config.showLabels || !iconNameFor(v)
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSegmented = () => {
    const selectedIndex = value === null ? -1 : order.indexOf(value);
    const thumbStyle = selectedIndex >= 0 ? resolveSelectionStyle(config, optionFor(order[selectedIndex])) : null;
    return (
      <div
        className={`lops-ayn-segmented${isTall ? " is-tall" : ""}${isDisabled ? " is-disabled" : ""}${config.showLabels ? "" : " is-icon-only"}${isFixed ? " is-fixed" : ""}`}
        role="radiogroup"
        aria-disabled={isDisabled || undefined}
        style={{ borderRadius: radius }}
      >
        {/* One thumb that slides between the two halves, colored for the option it sits under. */}
        {thumbStyle && (
          <span
            className="lops-ayn-segment-thumb"
            aria-hidden="true"
            style={{
              borderRadius: radius,
              backgroundColor: thumbStyle.background,
              borderColor: thumbStyle.border,
              transform: selectedIndex === 1 ? "translateX(100%)" : "translateX(0)"
            }}
          />
        )}
        {order.map((v, index) => {
          const selected = value === v;
          return (
            <div
              key={String(v)}
              {...radioProps(v, index)}
              className={`lops-ayn-segment${selected ? " is-selected" : ""}`}
              title={config.showLabels ? undefined : optionFor(v).label}
              // width (not just flex-basis): the auto-width field sizes itself from its segments'
              // width, and a basis alone left it hugging the labels (60px segments at any setting).
              style={{ borderRadius: radius, ...fixedItem }}
            >
              {renderIconLabel(v, {
                textColor: selected && thumbStyle ? thumbStyle.text : TEXT_COLOR,
                background: selected && thumbStyle ? thumbStyle.background : "#f5f5f5",
                iconSize: 16,
                bold: selected,
                deemphasized: !selected && value !== null,
                showLabel: config.showLabels || !iconNameFor(v)
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // ---- Radio buttons: the classic pair, filled with the Checked color ----

  const renderRadio = () => (
    <div className={`lops-ayn-radios${isDisabled ? " is-disabled" : ""}`} role="radiogroup" aria-disabled={isDisabled || undefined}>
      {order.map((v, index) => {
        const selected = value === v;
        // Checked color per option: under Choice value color each option shows its own color.
        const fill = resolveModeColor(config.checkedColorMode, optionFor(v).color, config.checkedColor, FADE_BACKGROUND);
        return (
          <div key={String(v)} {...radioProps(v, index)} className={`lops-ayn-radio${selected ? " is-selected" : ""}`} style={fixedItem}>
            <span className="lops-ayn-radio-circle" aria-hidden="true" style={selected ? { borderColor: fill } : undefined}>
              {selected && <span className="lops-ayn-radio-dot" style={{ backgroundColor: fill }} />}
            </span>
            {renderIconLabel(v, {
              textColor: TEXT_COLOR,
              background: PAGE_BACKGROUND,
              iconSize: 16,
              deemphasized: !selected && value !== null,
              showLabel: config.showLabels || !iconNameFor(v)
            })}
          </div>
        );
      })}
    </div>
  );

  // ---- Toggle button: one button, pressed (selection colors) for Yes ----

  const renderToggleButton = () => {
    const on = value === true;
    // No value reads as "not pressed", so it shows the No option (a "---" button would be odd).
    const shown = value === true;
    const sel = resolveSelectionStyle(config, options.yes);
    const column = config.iconPosition === "Above" || config.iconPosition === "Below";
    return (
      <div
        className={`lops-ayn-togglebutton${on ? " is-selected" : ""}${column ? " is-column" : ""}${isTall ? " is-tall" : ""}${isDisabled ? " is-disabled" : ""}${isFixed ? "" : " is-fill"}`}
        role="switch"
        aria-checked={on}
        aria-disabled={isDisabled || undefined}
        aria-label={optionFor(shown).label}
        title={config.showLabels ? undefined : optionFor(shown).label}
        tabIndex={0}
        onClick={flip}
        onKeyDown={onSwitchKeyDown}
        style={{
          borderRadius: radius,
          ...(isFixed ? { width: fixedPx, minWidth: 0 } : {}),
          ...(on ? { backgroundColor: sel.background, borderColor: sel.border } : {})
        }}
      >
        {renderIconLabel(shown, {
          textColor: on ? sel.text : TEXT_COLOR,
          background: on ? sel.background : "#f5f5f5",
          iconSize: column ? 20 : 16,
          bold: on,
          column,
          showLabel: config.showLabels || !iconNameFor(shown)
        })}
      </div>
    );
  };

  // ---- Labeled switch: the current label inside a wider track, the icon inside the thumb ----

  const renderLabeledSwitch = () => {
    const on = value === true;
    const current = value === null ? null : optionFor(value);
    const trackText = on ? blackOrWhiteOn(checkedFill) : MUTED_TEXT_COLOR;
    const track = (
      <span
        className={`lops-ayn-lswitch${on ? " is-on" : ""}${isTall ? " is-tall" : ""}${config.showLabels ? "" : " is-no-label"}`}
        aria-hidden="true"
        // Never Fixed width: a switch sized like a button read as "too wide" (user).
        style={on ? { backgroundColor: checkedFill, borderColor: checkedFill } : undefined}
      >
        {/* Both labels share one grid cell, so the track is as wide as the longer one and doesn't
            jump when the value changes; only the current one is visible. */}
        {config.showLabels && (
          <span className="lops-ayn-lswitch-text" style={{ color: trackText, fontWeight }}>
            <span className="lops-ayn-label" style={{ visibility: on ? "visible" : "hidden" }}>{options.yes.label}</span>
            <span className="lops-ayn-label" style={{ visibility: value === false ? "visible" : "hidden" }}>{options.no.label}</span>
          </span>
        )}
        <span className="lops-ayn-lswitch-thumb">
          {current && value !== null && (
            <IconView
              name={iconNameFor(value)}
              color={resolveIconColor(config, current.color, "#FFFFFF", on ? darkenHexColor(checkedFill) : MUTED_TEXT_COLOR)}
              size={isTall ? 16 : 14}
            />
          )}
        </span>
      </span>
    );
    return renderSwitchRow(track, "switch");
  };

  // ---- Status chip: AdvancedLookUp's selected-record chip in the family field; click to switch ----

  const renderChip = () => {
    const option = value === null ? null : optionFor(value);
    const sel = option ? resolveSelectionStyle(config, option) : null;
    const other = value === null ? options.yes.label : optionFor(!value).label;
    return (
      <div
        className={`lops-ayn-chipfield${isTall ? " is-tall" : ""}${isDisabled ? " is-disabled" : ""}`}
        style={isFixed ? { width: fixedPx, flex: "0 1 auto" } : undefined}
        role="switch"
        aria-checked={value === true}
        aria-disabled={isDisabled || undefined}
        aria-label={option?.label ?? "---"}
        title={isDisabled ? undefined : `Change to ${other}`}
        tabIndex={0}
        onClick={flip}
        onKeyDown={onSwitchKeyDown}
      >
        {option && sel && value !== null ? (
          <span
            className="lops-ayn-chip"
            style={{ backgroundColor: sel.background, borderColor: sel.border, borderRadius: radius }}
          >
            {renderIconLabel(value, {
              textColor: sel.text,
              background: sel.background,
              iconSize: 16,
              showLabel: config.showLabels || !iconNameFor(value)
            })}
          </span>
        ) : (
          <span className="lops-ayn-label lops-ayn-empty">---</span>
        )}
        {!isDisabled && <Icon iconName="Switch" className="lops-ayn-chip-glyph" aria-hidden="true" />}
      </div>
    );
  };

  const renderers: Record<DisplayStyle, () => React.ReactElement> = {
    Checkbox: renderCheckbox,
    Toggle: renderToggle,
    LabeledSwitch: renderLabeledSwitch,
    Radio: renderRadio,
    Buttons: renderButtons,
    Segmented: renderSegmented,
    ToggleButton: renderToggleButton,
    Chip: renderChip,
    Icon: renderIconStyle
  };

  return (
    <ThemeFontScope fontFamily={fontFamily}>
      <div
        className={`lops-ayn-root is-${style.toLowerCase()}${isTall ? " is-tall" : ""}`}
        style={{ fontFamily }}
        aria-readonly={isDisabled || undefined}
      >
        {(renderers[style] ?? renderToggle)()}
      </div>
    </ThemeFontScope>
  );
};
