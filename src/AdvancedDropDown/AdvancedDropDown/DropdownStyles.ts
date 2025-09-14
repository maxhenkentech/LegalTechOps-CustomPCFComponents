
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

const colorFocus = "#a9a9a9";
   
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

export const dropdownStyles = (props: IDropdownStyleProps, selectedColor?: string, showColorBackground?: "No" | "Lighter" | "Full", showColorBorder?: boolean, makeFontBold?: boolean, componentHeight?: "Tall" | "Short", iconColorOverride?: string):Partial<IDropdownStyles> => {
  const isShort = componentHeight === "Short";
  console.log("🎨 DropdownStyles - componentHeight:", componentHeight, "isShort:", isShort);
  
  // Use completely different values for tall vs short to force re-render
  const heightValues = isShort 
    ? { 
        padding: "2px 8px", // Increased padding to prevent text cutoff
        paddingRight: "28px",
        minHeight: "18px", // Slightly taller
        maxHeight: "26px", // Slightly taller
        height: "26px", // Slightly taller
        lineHeight: "1.3" // Better line height for readability
      }
    : {
        padding: "4px 8px", 
        paddingRight: "28px",
        minHeight: "28px",
        maxHeight: "36px", 
        height: "auto",
        lineHeight: "1.4"
      };

  console.log("🎨 Applied height values:", heightValues);

  return ({    
      title: [{
        color: "#323130",
        display: "flex",
        alignItems: "center",
        fontWeight: makeFontBold ? "600" : "400",
        fontSize: "14px", // Keep font size constant
        lineHeight: heightValues.lineHeight,
        fontFamily: "'Segoe UI', 'Segoe UI Web (West European)', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: iconColorOverride && (showColorBorder || showColorBackground !== "No") ? iconColorOverride :
                    (showColorBorder && selectedColor) ? selectedColor : 
                    (props.isOpen ? "#0078d4" : "#d2d0ce"),
        borderRadius: "6px",
        backgroundColor: iconColorOverride && showColorBackground === "Full" ? iconColorOverride :
                        iconColorOverride && showColorBackground === "Lighter" ? lightenColor(iconColorOverride, 0.8) :
                        showColorBackground === "Full" && selectedColor ? selectedColor :
                        showColorBackground === "Lighter" && selectedColor ? lightenColor(selectedColor, 0.8) :
                        "#f3f2f1",
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
          ':hover': {
            borderColor: iconColorOverride && (showColorBorder || showColorBackground !== "No") ? iconColorOverride :
                        (showColorBorder && selectedColor) ? selectedColor :
                        (props.disabled ? "#d2d0ce" : "#106ebe"),
            backgroundColor: iconColorOverride && showColorBackground === "Full" ? iconColorOverride :
                           iconColorOverride && showColorBackground === "Lighter" ? lightenColor(iconColorOverride, 0.8) :
                           showColorBackground === "Full" && selectedColor ? selectedColor :
                           showColorBackground === "Lighter" && selectedColor ? lightenColor(selectedColor, 0.8) :
                           (props.disabled ? "#f3f2f1" : "#ffffff"),
            cursor: props.disabled ? "default" : "pointer"
          },
          ':focus': {
            borderColor: showColorBorder && selectedColor ? selectedColor : "#0078d4",
            borderWidth: "2px",
            outline: "1px solid " + (showColorBorder && selectedColor ? selectedColor : "#0078d4"),
            outlineOffset: "2px"
          },
          ':disabled': {
            backgroundColor: "#f3f2f1",
            borderColor: "#d2d0ce",
            color: "#a19f9d",
            cursor: "default"
          }
        }
      }],        
      root: {
        width: "100%",
        fontFamily: "'Segoe UI', 'Segoe UI Web (West European)', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif"
      },
      dropdown: [{
        borderRadius: "6px",
        border: "1px solid #d2d0ce",
        backgroundColor: "#ffffff",
        maxHeight: "200px",
        overflowY: "auto",
        selectors: {
          ":focus": {
            outline: "none"
          }
        }
      }],
      dropdownItem: [{
        display: "flex",
        alignItems: "center",
        padding: "6px 12px",
        minHeight: "30px",
        fontSize: "14px",
        color: "#323130",
        backgroundColor: "transparent",
        cursor: "pointer",
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
        padding: "6px 12px",
        minHeight: "30px",
        fontSize: "14px",
        backgroundColor: "#deecf9",
        color: "#323130",
        fontWeight: "600",
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
      caretDownWrapper: [{
        right: "8px",
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