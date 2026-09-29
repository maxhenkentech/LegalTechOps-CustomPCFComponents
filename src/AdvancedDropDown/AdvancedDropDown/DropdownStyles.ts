
import { createTheme} from "@fluentui/react/lib/Theme";
import { IDropdownStyles, IDropdownStyleProps} from "@fluentui/react/lib/Dropdown";

export const myTheme = createTheme({
    palette: {
      themePrimary: '#a9a9a9',
      themeLighterAlt: '#fcfcfc',
      themeLighter: '#f1f1f1',
      themeLight: '#e5e5e5',
      themeTertiary: '#cbcbcb',
      themeSecondary: '#b3b3b3',
      themeDarkAlt: '#979797',
      themeDark: '#808080',
      themeDarker: '#5e5e5e',
      neutralLighterAlt: '#faf9f8',
      neutralLighter: '#f3f2f1',
      neutralLight: '#edebe9',
      neutralQuaternaryAlt: '#e1dfdd',
      neutralQuaternary: '#d0d0d0',
      neutralTertiaryAlt: '#c8c6c4',
      neutralTertiary: '#595959',
      neutralSecondary: '#373737',
      neutralPrimaryAlt: '#2f2f2f',
      neutralPrimary: '#000000',
      neutralDark: '#151515',
      black: '#0b0b0b',
      white: '#ffffff',
    }});

// Field box colors, pixel/geometry-matched against a maker-supplied screenshot of the native
// Dataverse choice field, the same reference AdvancedLookUp's own OOTB-matching pass used (see
// LookUpStyles.ts in that control - #f5f5f5 is the OOTB fill there too, not a coincidence, both
// pixel-sampled from the same kind of native field). Used only for the DEFAULT/no-color-override
// look - config-driven backgrounds (showColorBackground + selectedColor/iconColorOverride) are a
// deliberate, separate feature and are untouched by these.
const FIELD_BG = "#f5f5f5";
const FIELD_BG_HOVER = "#ececec";
const FIELD_BG_FOCUS = "#ffffff";
const FIELD_BORDER_FOCUS = "#a9a9a9";
// Same placeholder grey AdvancedLookUp's comboBoxStyles already uses for its own placeholder text
// - pixel-sampled against the reference screenshot's OOTB "---" (darkest sampled pixel ~rgb(112,
// 112,112), a light/muted grey) versus this control's own placeholder, which was rendering at
// full body-text strength (`textColor`, #323130 - near-black) with no separate lighter treatment
// for the empty/unselected state at all. See the title style's own `&.ms-Dropdown-titleIsPlaceHolder`
// selector below for where this is actually applied.
const FIELD_PLACEHOLDER_COLOR = "#a19f9d";

const isColorDark = (color: string): boolean => {
  if (!/^#[0-9a-f]{6}/i.test(color)) return false;
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
};

const FIELD_TEXT_COLOR = "#323130";
// Inherited from the control's wrapper (index.ts withThemeFont): the app's custom theme font,
// then Segoe UI - see ThemeFont.tsx.
const FONT_FAMILY = "inherit";

export interface IDropdownStyleOptions {
  hasValue: boolean;
  makeFontBold: boolean;
  componentHeight: "Tall" | "Short";
  hoverColor: string;
  listSelectedColor: string;
}

// The field itself is always the neutral OOTB grey box (FIELD_BG / FIELD_BG_HOVER / white +
// FIELD_BORDER_FOCUS when focused) - the same three tones AdvancedLookUp and AdvancedMultiChoice
// use. All option-color treatment lives on the selected-value chip (AdvancedOptionsControl's
// _onRenderTitle), no longer on the field: that is the family look.
export const dropdownStyles = (props: IDropdownStyleProps, o: IDropdownStyleOptions): Partial<IDropdownStyles> => {
  // Title height excludes the 1px transparent focus border on each side (`dropdown` below), so the
  // field is 34px / 40px overall - the same as AdvancedLookUp's chip state and AdvancedMultiChoice.
  const height = o.componentHeight === "Short" ? 32 : 38;
  const listItemText = (bg: string) => (isColorDark(bg) ? "#ffffff" : FIELD_TEXT_COLOR);

  return ({
    title: [{
      color: FIELD_TEXT_COLOR,
      display: "flex",
      alignItems: "center",
      fontWeight: o.makeFontBold ? "600" : "400",
      fontSize: "14px",
      lineHeight: "20px",
      fontFamily: FONT_FAMILY,
      border: "none",
      borderRadius: "4px",
      backgroundColor: FIELD_BG,
      // With a value the chip sits 4px in from the field edge, exactly like AdvancedLookUp's
      // chip and AdvancedMultiChoice's values. The empty placeholder keeps the OOTB-calibrated
      // 11px text inset (v3.7.7).
      // 3px + the 1px border = AdvancedLookUp's measured 4px chip inset.
      padding: o.hasValue ? "0 30px 0 3px" : "0 30px 0 11px",
      height: `${height}px`,
      minHeight: `${height}px`,
      width: "100%",
      boxSizing: "border-box",
      transition: "background-color 0.15s ease-in-out",
      outline: "none",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      cursor: props.disabled ? "default" : "pointer",
      selectors: {
        // Fluent renders its own placeholder text node for the empty state (onRenderTitle is only
        // called with a selection) - this narrows it to the muted placeholder grey.
        '&.ms-Dropdown-titleIsPlaceHolder': {
          color: FIELD_PLACEHOLDER_COLOR
        },
        ':hover': {
          backgroundColor: props.disabled ? FIELD_BG : FIELD_BG_HOVER,
          color: FIELD_TEXT_COLOR
        }
      }
    }],
    root: {
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      fontFamily: FONT_FAMILY
    },
    // The closed-state box (className "ms-Dropdown" - the element that actually receives focus).
    // Transparent 1px border so focus can color it without shifting the box.
    dropdown: [{
      borderRadius: "4px",
      border: "1px solid transparent",
      backgroundColor: "transparent",
      selectors: {
        ":focus": {
          outline: "none",
          borderColor: FIELD_BORDER_FOCUS
        },
        ":focus .ms-Dropdown-title": {
          backgroundColor: FIELD_BG_FOCUS
        },
        ":focus::after": {
          border: "none"
        },
        "::after": {
          border: "none"
        }
      }
    }],
    // List rows: AdvancedMultiChoice's List hover / List selected colors (hover wins over selected,
    // like its keyboard-active row), selected rows bold.
    dropdownItem: [{
      display: "flex",
      alignItems: "center",
      padding: "6px 12px",
      minHeight: "32px",
      fontSize: "14px",
      color: FIELD_TEXT_COLOR,
      backgroundColor: "transparent",
      cursor: "pointer",
      textAlign: "left",
      selectors: {
        ":hover": { backgroundColor: o.hoverColor, color: listItemText(o.hoverColor) },
        ":focus": { backgroundColor: o.hoverColor, color: listItemText(o.hoverColor), outline: "none" },
        ":active": { backgroundColor: o.hoverColor, color: listItemText(o.hoverColor) }
      }
    }],
    dropdownItemSelected: [{
      display: "flex",
      alignItems: "center",
      padding: "6px 12px",
      minHeight: "32px",
      fontSize: "14px",
      backgroundColor: o.listSelectedColor,
      color: listItemText(o.listSelectedColor),
      fontWeight: "600",
      textAlign: "left",
      selectors: {
        // No :focus override here: Fluent focuses the selected row when the list opens, and it
        // should read as "selected" (List selected color) until the pointer actually moves.
        ":hover": { backgroundColor: o.hoverColor, color: listItemText(o.hoverColor) },
        ":focus": { backgroundColor: o.listSelectedColor, color: listItemText(o.listSelectedColor), outline: "none" },
        ":active": { backgroundColor: o.hoverColor, color: listItemText(o.hoverColor) }
      }
    }],
    caretDown: [{
      color: "#605e5c",
      fontSize: "12px"
    }],
    // Right-edge chevron position, calibrated against the OOTB field (v3.7.1). Hidden when
    // read-only, like AdvancedMultiChoice - nothing to open.
    caretDownWrapper: [{
      right: "14px",
      top: "50%",
      transform: "translateY(-50%)",
      // Line box = field height so the glyph centres vertically in both Short and Tall.
      height: `${height}px`,
      lineHeight: `${height}px`,
      display: props.disabled ? "none" : undefined
    }],
    callout: {
      border: "1px solid #d2d0ce",
      borderRadius: "6px"
    }
  });
};
