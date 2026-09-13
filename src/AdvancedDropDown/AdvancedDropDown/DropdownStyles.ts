
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

// Helper function to lighten a hex color
const lightenColor = (color: string, amount = 0.7): string => {
  if (!color || !color.startsWith('#')) return color;
  
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Lighten by blending with white
  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);
  
  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

// Helper function to darken a hex color
const darkenColor = (color: string, amount = 0.3): string => {
  if (!color || !color.startsWith('#')) return color;
  
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Darken by reducing the RGB values
  const newR = Math.round(r * (1 - amount));
  const newG = Math.round(g * (1 - amount));
  const newB = Math.round(b * (1 - amount));
  
  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

// Helper function to determine if a color is dark
const isColorDark = (color: string): boolean => {
  if (!color || !color.startsWith('#')) return false;
  
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5; // Dark if luminance is less than 50%
};

export const dropdownStyles = (props: IDropdownStyleProps, selectedColor?: string, showColorBackground?: "No" | "Lighter" | "Full", showColorBorder?: boolean, makeFontBold?: boolean, componentHeight?: "Tall" | "Short", iconColorOverride?: string):Partial<IDropdownStyles> => {
  const isShort = componentHeight === "Short";
  console.log("🎨 DropdownStyles - componentHeight:", componentHeight, "isShort:", isShort);
  
  // Use completely different values for tall vs short to force re-render
  const heightValues = isShort
    ? {
        // Left inset pixel-matched against the native Dataverse choice field (28px, measured
        // consistently across two separate reference screenshots at ~400px field width) - see
        // caretDownWrapper's own comment for the equivalent right-side calibration.
        padding: "4px 11px",
        paddingRight: "30px", // More space for caret - see caretDownWrapper's own comment below
        minHeight: "24px", // Slightly taller
        maxHeight: "32px", // Slightly taller
        height: "32px", // Slightly taller
        lineHeight: "1.3" // Better line height for readability
      }
    : {
        padding: "8px 11px", // Left inset - see the Short branch's own comment above
        paddingRight: "30px", // More space for caret - see caretDownWrapper's own comment below
        minHeight: "32px", // Increased from 28px
        maxHeight: "40px", // Increased from 36px
        height: "40px", // Set explicit height
        lineHeight: "1.4"
      };

  console.log("🎨 Applied height values:", heightValues);

  // Determine the actual background color being used
  const actualBackgroundColor = iconColorOverride && showColorBackground === "Full" ? iconColorOverride :
                                iconColorOverride && showColorBackground === "Lighter" ? lightenColor(iconColorOverride, 0.8) :
                                showColorBackground === "Full" && selectedColor ? selectedColor :
                                showColorBackground === "Lighter" && selectedColor ? lightenColor(selectedColor, 0.8) :
                                FIELD_BG;

  // Determine text color based on background darkness
  const textColor = (showColorBackground === "Full" && actualBackgroundColor && isColorDark(actualBackgroundColor)) ? 
                    "#ffffff" : "#323130"; // White text on dark backgrounds, dark text otherwise

  return ({    
      title: [{
        color: textColor, // Dynamic text color based on background
        display: "flex",
        alignItems: "center",
        fontWeight: makeFontBold ? "600" : "400",
        fontSize: "14px", // Keep font size constant
        lineHeight: heightValues.lineHeight,
        fontFamily: "'Segoe UI', 'Segoe UI Web (West European)', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif",
        borderWidth: "0px", // No actual border - using box-shadow instead
        borderStyle: "none",
        borderColor: "transparent",
        borderRadius: "6px", // Match Power Platform's field border radius more closely
        boxShadow: showColorBorder ? 
          `inset 0 0 0 2px ${(showColorBorder && selectedColor) ? selectedColor : 
                             (showColorBorder && iconColorOverride) ? iconColorOverride : 
                             'transparent'}` : 
          "none", // Use inset box-shadow to create border effect
        backgroundColor: iconColorOverride && showColorBackground === "Full" ? iconColorOverride :
                        iconColorOverride && showColorBackground === "Lighter" ? lightenColor(iconColorOverride, 0.8) :
                        showColorBackground === "Full" && selectedColor ? selectedColor :
                        showColorBackground === "Lighter" && selectedColor ? lightenColor(selectedColor, 0.8) :
                        FIELD_BG,
        padding: heightValues.padding,
        paddingRight: heightValues.paddingRight,
        minHeight: heightValues.minHeight,
        maxHeight: heightValues.maxHeight,
        height: heightValues.height,
        width: "100%",
        boxSizing: "border-box",
        transition: "all 0.15s ease-in-out",
        outline: "none",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        selectors: {
          // Fluent renders its OWN default placeholder text node (confirmed live: innerHTML is
          // the literal placeholder string, not our custom onRenderTitle/option-content markup -
          // Dropdown only invokes onRenderTitle once something is actually selected) - but it's
          // still a plain-text child of THIS span, so `color` above already cascades to it via
          // normal CSS inheritance without needing a selector at all. What needs a selector is
          // narrowing that inherited color specifically for the placeholder state: with nothing
          // else, the placeholder inherits the exact same full-strength `textColor` as a real
          // selected value, confirmed live (computed color was #323130 for "---") - the native
          // Dataverse field's own placeholder is a visibly lighter, muted grey. `&` targets this
          // same title span again, refined by Fluent's own placeholder modifier class.
          '&.ms-Dropdown-titleIsPlaceHolder': {
            color: FIELD_PLACEHOLDER_COLOR
          },
          ':hover': {
            boxShadow: showColorBorder ?
              `inset 0 0 0 2px ${(showColorBorder && selectedColor) ? selectedColor :
                                 (showColorBorder && iconColorOverride) ? iconColorOverride :
                                 'transparent'}` :
              "none", // Maintain box-shadow border on hover
            backgroundColor: iconColorOverride && showColorBackground === "Full" ? iconColorOverride :
                           iconColorOverride && showColorBackground === "Lighter" ? lightenColor(iconColorOverride, 0.8) :
                           showColorBackground === "Full" && selectedColor ? selectedColor :
                           showColorBackground === "Lighter" && selectedColor ? lightenColor(selectedColor, 0.8) :
                           (props.disabled ? FIELD_BG : FIELD_BG_HOVER),
            cursor: props.disabled ? "default" : "pointer"
          },
          ':focus': {
            // backgroundColor deliberately NOT set here (unlike :hover above) - confirmed live
            // that keyboard/programmatic focus actually lands on the OUTER `.ms-Dropdown` div
            // (className "ms-Dropdown", the `dropdown` style key below), never on this `title`
            // span itself, so a `:focus` rule here can never match and would be dead code. The
            // focus-visible affordance (border color) is applied on `dropdown` below instead,
            // where `:focus` genuinely fires - see FIELD_BORDER_FOCUS there.
            boxShadow: showColorBorder ?
              `inset 0 0 0 2px ${(showColorBorder && selectedColor) ? selectedColor :
                                 (showColorBorder && iconColorOverride) ? iconColorOverride :
                                 'transparent'}` :
              "none", // Maintain box-shadow border on focus
            outline: "none", // Let Power Platform handle focus
            outlineOffset: "0px"
          },
          ':disabled': {
            backgroundColor: FIELD_BG,
            borderColor: "#d2d0ce",
            color: "#a19f9d",
            cursor: "default"
          }
        }
      }],
      root: {
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflow: "visible", // Changed from hidden to visible
        fontFamily: "'Segoe UI', 'Segoe UI Web (West European)', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif",
        minHeight: isShort ? "36px" : "44px", // Increased minimum height to match container
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start"  // Ensure left alignment
      },
      // Root closed-state box (className "ms-Dropdown", confirmed via live DOM inspection of the
      // actual rendered control - NOT the open options list/panel, which is styled separately
      // below via `callout`). This is where the field's real background/border live, one layer
      // outside `title` above (a fill-only span nested inside it): `title`'s own backgroundColor
      // was already correctly OOTB-matched, but this box had its OWN, separate, still-default
      // Fluent white fill plus a hardcoded 1px grey border - both painted underneath/around
      // `title`'s fill, which is exactly why a border was visible at all despite `title` itself
      // having none. Pixel-measured against a maker-supplied screenshot of the native Dataverse
      // choice field: no visible border at rest (border set to a transparent 1px rule, not
      // omitted, so focus doesn't shift the box by 1px - same technique AdvancedLookUp's
      // LookUpStyles.ts uses for its ComboBox border), and backgroundColor here matters far less
      // than `title`'s now that both agree, but is kept transparent (not FIELD_BG) since `title`
      // already has width:100% and fully covers this box's content area on its own.
      dropdown: [{
        borderRadius: "6px",
        border: "1px solid transparent",
        backgroundColor: "transparent",
        maxHeight: "200px",
        overflowY: "auto",
        selectors: {
          ":focus": {
            outline: "none",
            borderColor: FIELD_BORDER_FOCUS
          }
        }
      }],
      dropdownItem: [{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",  // Ensure left alignment
        padding: "6px 12px",
        minHeight: "30px",
        fontSize: "14px",
        color: "#323130",
        backgroundColor: "transparent",
        cursor: "pointer",
        textAlign: "left",  // Explicit text alignment
        selectors: {
          ":hover": {
            backgroundColor: "#f3f2f1",
            color: "#323130"
          },
          ":focus": {
            backgroundColor: "#deecf9",
            color: "#323130",
            outline: "none"
          }
        }
      }],
      dropdownItemSelected: [{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",  // Ensure left alignment
        padding: "6px 12px",
        minHeight: "30px",
        fontSize: "14px",
        backgroundColor: "#deecf9",
        color: "#323130",
        fontWeight: "600",
        textAlign: "left",  // Explicit text alignment
        selectors: {
          ":hover": {
            backgroundColor: "#c7e0f4",
            color: "#323130"
          }
        }
      }],
      caretDown: [{
        color: showColorBackground !== "No" && selectedColor ? "#605e5c" : "#605e5c",
        fontSize: "12px"
      }],
      // Pixel-measured against the same reference screenshot as FIELD_BG above: the native
      // Dataverse choice field's chevron sits noticeably further inset from the field's right
      // edge than Fluent's own default caretDownWrapper offset. `paddingRight` above (on `title`)
      // is bumped in lockstep with this, keeping the same reserved-space relationship, so long
      // option text still stops before running under the chevron rather than colliding with it.
      caretDownWrapper: [{
        right: "14px",
        top: "50%",
        transform: "translateY(-50%)"
      }],
      callout: {
        border: "1px solid #d2d0ce",
        borderRadius: "6px"
      }
    });
  };

// Export the darkenColor function for use in other components
export { darkenColor };