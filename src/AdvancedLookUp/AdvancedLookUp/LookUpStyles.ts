import type * as React from "react";
import { createTheme } from "@fluentui/react/lib/Theme";
import { IComboBoxOptionStyles, IComboBoxStyles } from "@fluentui/react/lib/ComboBox";
import { IButtonStyles } from "@fluentui/react/lib/Button";

export const myTheme = createTheme({
  palette: {
    themePrimary: "#a9a9a9",
    themeLighterAlt: "#fcfcfc",
    themeLighter: "#f1f1f1",
    themeLight: "#e5e5e5",
    themeTertiary: "#cbcbcb",
    themeSecondary: "#b3b3b3",
    themeDarkAlt: "#979797",
    themeDark: "#808080",
    themeDarker: "#5e5e5e",
    neutralLighterAlt: "#faf9f8",
    neutralLighter: "#f3f2f1",
    neutralLight: "#edebe9",
    neutralQuaternaryAlt: "#e1dfdd",
    neutralQuaternary: "#d0d0d0",
    neutralTertiaryAlt: "#c8c6c4",
    neutralTertiary: "#595959",
    neutralSecondary: "#373737",
    neutralPrimaryAlt: "#2f2f2f",
    neutralPrimary: "#000000",
    neutralDark: "#151515",
    black: "#0b0b0b",
    white: "#ffffff",
  },
});

// Right-hand gutter geometry. Everything on the right edge of the field - Fluent's caret button,
// our clear ("x") button, and the input's own padding - is derived from these two numbers so the
// three can never drift out of agreement with each other.
//
// CARET_BUTTON_WIDTH was read out of the *runtime* bundle, not the npm reference copy: rendering
// the control against pcf-start/lib/fluent_8_29_0.js and dumping the generated rule for
// .ms-ComboBox-CaretDown-button gives `position:absolute; width:32px; height:100%; top:0` - and,
// critically, **no `right` offset at all**. Its horizontal placement therefore falls out of static
// positioning, which is why picking any fixed `right:` for the clear button and hoping it lands
// clear of the caret does not work. caretDownButtonStyles below pins the caret explicitly instead,
// so both positions are ones we define rather than ones we guess.
export const CARET_BUTTON_WIDTH = 32;
export const CLEAR_BUTTON_WIDTH = 20;
// Daylight between the clear glyph and the caret button's left edge. Was 2px, which sat the "x"
// right up against the caret's grey hover/pressed background - bumped to give it visible breathing
// room from that highlight.
export const CLEAR_BUTTON_RIGHT_OFFSET = CARET_BUTTON_WIDTH + 8;

// Fluent's "Cancel" MDL2 glyph on its own renders visibly thinner than the OOTB Dataverse
// lookup's own clear "x" - pixel-measured side by side against a screenshot (matching overall
// glyph size, ~45px vs ~49px bounding box) put the OOTB stroke at roughly 1.3x ours (9px vs 7px
// arm width). MDL2 is a single-weight icon font (no bold variant to switch to), so
// -webkit-text-stroke is used to add outline weight around the existing glyph rather than trying
// to fake a bolder icon via font-size alone - a fatter shape, not just a bigger one. Shared by
// both clear-icon render paths (.lops-alu-pill-clear and .lops-alu-clear) so they can't drift
// out of sync with each other.
export const CLEAR_ICON_STYLE: React.CSSProperties = { fontSize: 11, WebkitTextStroke: "0.4px currentColor" };

// Square box each record icon/picture renders inside - shared by the selected-value icon
// (.lops-alu-icon) and every option row's icon (.lops-alu-option-icon). Bumped from the original
// 16px so a configured Icon Background Color has visible breathing room around the glyph/picture
// instead of the shape's edge running flush against it.
export const ICON_CONTAINER_SIZE = 20;

export type IconShape = "Full" | "RoundedSquare" | "Circle" | "None";

// Corner radius for the icon shape. "Full" and "None" are both square (0) - they only diverge on
// whether a background color is actually painted (see iconContainerBackground below), which is the
// entire point of keeping them as separate maker-facing choices rather than collapsing them into
// one "square" option.
export function iconShapeBorderRadius(shape: IconShape): string {
  switch (shape) {
    case "Circle":
      return "50%";
    case "RoundedSquare":
      return "4px";
    case "Full":
    case "None":
    default:
      return "0px";
  }
}

// "None" means literally no shape treatment - the configured Icon Background Color is deliberately
// ignored in that mode, not just left unset by omission, so a maker can turn the whole background
// affordance off without having to also blank out the color property.
export function iconContainerBackground(shape: IconShape, backgroundColor?: string): string | undefined {
  if (shape === "None") return undefined;
  return backgroundColor || undefined;
}

// Shared style for the icon-wrapping <div> (both selected-value and option-row instances).
// overflow: hidden is what actually clips a picture (or, in Circle/RoundedSquare, the icon glyph's
// own box) to the chosen shape - the <img>/<Icon> underneath doesn't need its own matching
// border-radius, the wrapper's clip takes care of it regardless of the child's own styling.
//
// "None" is NOT just "Full" with the background color dropped - it also drops the fixed square
// box and its overflow:hidden clip entirely. A picture column's image is otherwise always cropped
// to a square (see iconImageStyle's "cover" branch), which "no shape at all" should mean the image
// is free of, not just uncolored. Practically: a non-square logo/picture renders at its own aspect
// ratio under None, and center-cropped to a square under every other shape.
export function iconContainerStyle(shape: IconShape, backgroundColor: string | undefined): React.CSSProperties {
  if (shape === "None") {
    return {
      maxWidth: ICON_CONTAINER_SIZE,
      maxHeight: ICON_CONTAINER_SIZE,
    };
  }
  return {
    width: ICON_CONTAINER_SIZE,
    height: ICON_CONTAINER_SIZE,
    borderRadius: iconShapeBorderRadius(shape),
    backgroundColor: iconContainerBackground(shape, backgroundColor),
    overflow: "hidden",
  };
}

// Companion to iconContainerStyle for the <img> itself. Every shape but None fills its (fixed,
// square) container edge to edge and crops via object-fit: cover. None has no fixed container
// size to fill, so the image is instead capped to the same box at its own natural aspect ratio
// (object-fit: contain) - see iconContainerStyle's comment for why that distinction matters.
export function iconImageStyle(shape: IconShape): React.CSSProperties {
  if (shape === "None") {
    return { maxWidth: ICON_CONTAINER_SIZE, maxHeight: ICON_CONTAINER_SIZE, width: "auto", height: "auto", objectFit: "contain", display: "block" };
  }
  return { width: "100%", height: "100%", objectFit: "cover", display: "block" };
}

// `caretDownButtonStyles` is read by ComboBox._getCaretButtonStyles in 8.29.0 (verified in the
// runtime bundle) and merged over Fluent's defaults, so this is a supported hook. Pinning right:0
// anchors the caret to the field's right edge and makes the gutter deterministic.
export const caretDownButtonStyles: Partial<IButtonStyles> = {
  root: {
    right: 0,
    width: CARET_BUTTON_WIDTH,
  },
};

// Field box colors, pixel-matched against a maker-supplied screenshot of the native Dataverse
// lookup field (not guessed from Fluent's own neutralLighter token, which is close but NOT
// identical - #f3f2f1 vs the OOTB field's actual #f5f5f5). Shared by both render paths: the
// editable ComboBox (comboBoxStyles below) and the read-only "selected record" pill
// (AdvancedLookUpControl.tsx's pill block) - the two must look like one continuous field, not two
// differently-styled surfaces that happen to swap at the same position.
export const FIELD_BG = "#f5f5f5";
export const FIELD_BG_HOVER = "#ececec";
export const FIELD_BG_FOCUS = "#ffffff";
export const FIELD_BORDER_FOCUS = "#a9a9a9";
export const FIELD_BORDER_RADIUS = "4px";

// Calibrated against the OOTB lookup's own chip: its clear "x" glyph is not a fixed grey, it's
// the SAME hue as the chip background, just much darker - pixel-sampled at chip #EDF3FB (HSL
// lightness ~95.7%) vs. glyph #2B5D9E (~39.4%), a ratio of ~0.41 with hue held constant (214.3°
// vs. 213.9° - effectively identical) and saturation left alone. Applying that same 0.41
// lightness multiplier to #EDF3FB reproduces #255ba4, close enough to the sampled #2B5D9E to
// treat as the real relationship rather than a coincidence. Used to derive the pill's clear-icon
// color from whatever `recordBackdropColor` the maker configures, instead of a fixed grey that
// doesn't relate to it at all.
const RECORD_CLEAR_LIGHTNESS_FACTOR = 0.41;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// Expands #abc to #aabbcc so both 3- and 6-digit hex (whatever HEX_COLOR_PATTERN in
// AdvancedLookUpControl.tsx already validated) parse the same way below.
function normalizeHex(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return h;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
  }
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [Math.round(hue2rgb(p, q, h + 1 / 3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1 / 3) * 255)];
}

// Darkens a hex color by scaling its HSL lightness down (hue/saturation held constant) - see
// RECORD_CLEAR_LIGHTNESS_FACTOR's comment for where that factor comes from. Falls back to the
// input unchanged if it isn't valid hex, so a not-yet-validated in-flight property value can't
// throw mid-render (the real validation/error-panel gate is HEX_COLOR_PATTERN in
// AdvancedLookUpControl.tsx - this is just defensive, not a second source of truth for validity).
export function darkenHexColor(hex: string, factor: number = RECORD_CLEAR_LIGHTNESS_FACTOR): string {
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim())) return hex;
  const [r, g, b] = hexToRgb(hex.trim());
  const [h, s, l] = rgbToHsl(r, g, b);
  const [dr, dg, db] = hslToRgb(h, s, clamp01(l * factor));
  return `#${[dr, dg, db].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// iconReserved leaves room for the prefix icon (Thumbnail/Icon) rendered to the left of the
// ComboBox's own input, and clearReserved leaves room for the clear ("x") button on the right,
// so typed/selected text never runs underneath either.
export const comboBoxStyles = (
  componentHeight?: "Tall" | "Short",
  hasIcon?: boolean,
  hasClearButton?: boolean,
  isDisabled?: boolean
): Partial<IComboBoxStyles> => {
  const isShort = componentHeight === "Short";
  const heightValues = isShort
    ? { minHeight: "24px", maxHeight: "32px", height: "32px", lineHeight: "1.3" }
    : { minHeight: "32px", maxHeight: "40px", height: "40px", lineHeight: "1.4" };

  const iconReserved = hasIcon ? ICON_CONTAINER_SIZE + 8 : 0;
  const clearReserved = hasClearButton ? CLEAR_BUTTON_WIDTH : 0;

  return {
    container: {
      width: "100%",
    },
    root: [
      {
        // Matches the out-of-the-box Dataverse field look (flat light-grey fill, no resting
        // border) instead of the boxed white-with-border look this control started with - see
        // the reference screenshot in CLAUDE.md. Border is kept as a transparent 1px rule (not
        // omitted) purely so the field's box size doesn't shift by 1px when :focus-within adds a
        // real border color.
        //
        // This "transparent" border was confirmed NOT enough on its own on a real Dataverse form
        // (still visible - see CLAUDE.md's "v1.1.1 border leak" note): Fluent's own default input
        // border, derived from myTheme's auto-generated semanticColors, showed through at
        // #373737 (myTheme's neutralSecondary) despite this override. AdvancedLookUp.css's
        // `!important` rules targeting `.ms-ComboBox` directly are the real fix - this object's
        // border/backgroundColor values are kept in sync with those rules as the documented
        // source of truth, but are not sufficient by themselves.
        borderRadius: FIELD_BORDER_RADIUS,
        border: "1px solid transparent",
        backgroundColor: FIELD_BG,
        minHeight: heightValues.minHeight,
        maxHeight: heightValues.maxHeight,
        height: heightValues.height,
        paddingLeft: 12 + iconReserved,
        paddingRight: CARET_BUTTON_WIDTH + clearReserved,
        selectors: {
          ":hover": {
            backgroundColor: isDisabled ? FIELD_BG : FIELD_BG_HOVER,
          },
          ":focus-within": {
            backgroundColor: FIELD_BG_FOCUS,
            borderColor: FIELD_BORDER_FOCUS,
          },
        },
      },
    ],
    input: [
      {
        fontSize: "14px",
        lineHeight: heightValues.lineHeight,
        fontFamily: "'Segoe UI', 'Segoe UI Web (West European)', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif",
        backgroundColor: "transparent",
        // The freeform input is a real <input>, so its placeholder is styled through the
        // standard pseudo-element rather than any Fluent prop. neutralTertiary is the same
        // subtle grey Fluent's own inputs use for placeholder text.
        selectors: {
          "::placeholder": {
            color: "#a19f9d",
          },
        },
      },
    ],
    optionsContainerWrapper: {
      maxHeight: "260px",
    },
    callout: {
      border: "1px solid #d2d0ce",
      borderRadius: "6px",
    },
  };
};

// Sentinel parked in IComboBoxOption.data on the top match. It is NOT decorative: it is what makes
// the highlight actually appear. See the topMatchActive comment in AdvancedLookUpControl - Fluent
// 8.29.0 wraps every option row in a React.memo whose comparator ignores the render closure (where
// the resolved option styles live) and only diffs {index, disabled, isSelected, isChecked, text,
// data}. `data` is therefore the one compared prop we can move to force the row to re-render when
// nothing but its styling has changed. Identity must stay stable across renders for the comparator
// to settle, hence a module-level constant rather than an inline object literal.
export const TOP_MATCH_MARKER = "lops-alu-top-match";

// Marks the top result while the "just press Enter to take it" affordance is live (see
// handleKeyDownCapture in AdvancedLookUpControl). A per-option `styles` object is the supported
// way to do this: ComboBox._getCurrentOptionStyles reads option.styles in the runtime 8.29.0
// bundle, so no DOM poking and no global CSS that would leak onto other ComboBoxes on the form.
// The accent is an inset box-shadow rather than a real border so it can't shift the row's text.
//
// Each option row renders through Fluent's Checkbox component (className "ms-ComboBox-option",
// confirmed in the runtime bundle - not a plain CommandButton), which carries its own default
// `borderRadius: theme.effects.roundedCorner2` (2px). Left alone that rounds our background too,
// and since our onRenderOption content below fills a plain rectangle, the row's own square
// corners poked past that rounded edge - the "pill with black corners" look. borderRadius: 0
// here overrides Fluent's default on the one style object it actually reads for this row.
// Colors are Fluent's own standard hover/pressed neutrals (theme.palette.neutralLighter /
// neutralLight) rather than a custom-picked grey, per request for "the MS modern Fluent UI grey".
export const topMatchOptionStyles: Partial<IComboBoxOptionStyles> = {
  root: {
    backgroundColor: "#f3f2f1",
    boxShadow: "inset 3px 0 0 0 #c8c6c4",
    borderRadius: 0,
  },
  rootHovered: {
    backgroundColor: "#edebe9",
    borderRadius: 0,
  },
};

export const comboBoxOptionRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  width: "100%",
  gap: "8px",
};
