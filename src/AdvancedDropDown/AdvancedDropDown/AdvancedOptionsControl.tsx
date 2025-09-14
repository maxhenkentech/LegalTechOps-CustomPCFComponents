/** @jsx React.createElement */
import * as React from 'react';
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown";
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { Icon } from "@fluentui/react/lib/Icon";
import { ISelectableOption } from "@fluentui/react/lib/SelectableOption";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";
import { dropdownStyles, myTheme, darkenColor } from "./DropdownStyles";

// Helper function to determine if a color is dark
const isColorDark = (color: string): boolean => {
  if (!color || !color.startsWith('#')) return false;
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
};

// Simple icon validation without predefined lists - trust Fluent UI's built-in MDL2 support
const validateAndGetIcon = (iconName: string): { 
  isValid: boolean; 
  iconType: 'mdl2' | 'unicode' | 'css' | 'unknown';
} => {
  if (!iconName || iconName.trim() === '' || iconName === 'undefined') {
    return { isValid: false, iconType: 'unknown' };
  }

  const cleanIconName = iconName.trim();

  // Check for Unicode patterns (e.g., "\uE700", "&#xE700;", "0xE700")
  const unicodePatterns = [
    /^\\u[0-9A-Fa-f]{4}$/,  // \uE700
    /^&#x[0-9A-Fa-f]+;$/,   // &#xE700;
    /^0x[0-9A-Fa-f]+$/,     // 0xE700
    /^U\+[0-9A-Fa-f]{4}$/   // U+E700
  ];

  if (unicodePatterns.some(pattern => pattern.test(cleanIconName))) {
    return { isValid: true, iconType: 'unicode' };
  }

  // Check for CSS class patterns
  if (cleanIconName.includes('ms-Icon') || cleanIconName.includes('fabric-icon') || 
      cleanIconName.includes('icon-') || cleanIconName.startsWith('.')) {
    return { isValid: true, iconType: 'css' };
  }

  // For all other cases, assume it's an MDL2 icon name and let Fluent UI handle it
  // Fluent UI's Icon component has comprehensive built-in MDL2 support
  return { isValid: true, iconType: 'mdl2' };
};

// Convert various Unicode formats to actual Unicode character
const convertToUnicodeChar = (iconStr: string): string | null => {
  try {
    const cleaned = iconStr.trim();
    
    // Handle \uXXXX format
    if (cleaned.startsWith('\\u')) {
      const hexCode = cleaned.substring(2);
      const charCode = parseInt(hexCode, 16);
      return String.fromCharCode(charCode);
    }
    
    // Handle &#xXXXX; format
    if (cleaned.startsWith('&#x') && cleaned.endsWith(';')) {
      const hexCode = cleaned.substring(3, cleaned.length - 1);
      const charCode = parseInt(hexCode, 16);
      return String.fromCharCode(charCode);
    }
    
    // Handle 0xXXXX format
    if (cleaned.startsWith('0x')) {
      const hexCode = cleaned.substring(2);
      const charCode = parseInt(hexCode, 16);
      return String.fromCharCode(charCode);
    }
    
    // Handle U+XXXX format
    if (cleaned.startsWith('U+')) {
      const hexCode = cleaned.substring(2);
      const charCode = parseInt(hexCode, 16);
      return String.fromCharCode(charCode);
    }
    
    return null;
  } catch (error) {
    console.warn(`Failed to convert Unicode string "${iconStr}":`, error);
    return null;
  }
};

export interface ISetupSchemaValue{
  icon ?: string;
  color ?: string;
} 
export type ISetupSchema = Record<string, ISetupSchemaValue>;

export interface IConfig{
  jsonConfig: ISetupSchema | undefined;
  defaultIconName : string;
  sortBy: "Text" | "Value";
  hideHiddenOptions: boolean;
  showColorIcon: boolean;
  showColorBorder: boolean;
  showColorBackground: "No" | "Lighter" | "Full";
  makeFontBold: boolean;
  componentHeight: "Tall" | "Short";
  iconColorOverride?: string;
}

/*
  //IComboBoxOption[]
  export interface IColorIndexer {
      [index : number] : string;      
  }*/

initializeIcons();

// Enhanced icon initialization for Power Platform compatibility
const ensureIconsLoaded = () => {
  try {
    initializeIcons();
    if (typeof document !== 'undefined') {
      const iconTest = document.createElement('i');
      iconTest.className = 'ms-Icon ms-Icon--CircleShapeSolid';
      iconTest.style.visibility = 'hidden';
      iconTest.style.position = 'absolute';
      document.body.appendChild(iconTest);
      setTimeout(() => document.body.removeChild(iconTest), 100);
    }
    console.log("🎨 Enhanced icon initialization completed");
  } catch (error) {
    console.warn("Enhanced icon initialization failed:", error);
  }
};
ensureIconsLoaded();
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureIconsLoaded);
  } else {
    setTimeout(ensureIconsLoaded, 50);
  }
}

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
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};


interface IAdvancedOptionsProperties {
    rawOptions: ComponentFramework.PropertyHelper.OptionMetadata[];
    selectedKey: number | null;          
    onChange: (value: number|null) => void
    isDisabled : boolean;
    defaultValue : number | undefined;
    config: IConfig;
    selectedColor?: string;
}  







//export default class AdvancedOptionsControl extends React.Component<IAdvancedOptionsProperties, {}> {            
//export const AdvancedOptionsControl = ({rawOptions, selectedKey, onChange, isDisabled, defaultValue, config}:IAdvancedOptionsProperties): JSX.Element =>{    
export const AdvancedOptionsControl = ({rawOptions, selectedKey, onChange, isDisabled, defaultValue, config, selectedColor}:IAdvancedOptionsProperties): React.ReactElement =>{    
  console.log("%cEntered control", "color:red");
  console.log("🎛️ Component Height Config:", config.componentHeight);
  console.log("🔄 Config object:", config);
  
  // Detect if we're in test mode
  const isTestMode = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location?.hostname || '';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost');
    const isTestHarness = window.location?.port === '8181' || 
                         window.location?.href?.includes('_pkg/') || 
                         document.title?.includes('Test harness');
    return isLocalhost || isTestHarness;
  }, []);
  
  const allOptions = [{Label: "--Select--", Value: -1, Color: "transparent", Description: "Select an option"}, ...rawOptions];	
  let options = allOptions.map((option : ComponentFramework.PropertyHelper.OptionMetadata ) =>  ({
    key: option.Value, 
    text: option.Label, 
    data: {
      color: option.Color,
      description: (option as ComponentFramework.PropertyHelper.OptionMetadata & {Description?: string}).Description || ""
    }
  }))
  if(config.sortBy==="Text"){  
    options = options.sort((a, b) =>a.text.localeCompare(b.text));
  }			

  const _onSelectedChanged = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {       
    const val = (option?.key == null || option?.key===-1) ? null : option?.key as number;   
    onChange(val);           
  }

  const _renderOption =(option: ISelectableOption | undefined, className ?:string, isSelectedField?: boolean) : React.ReactElement => {
    const icon = ((config.jsonConfig && option?.key) ? config.jsonConfig[option?.key]?.icon : config.defaultIconName)  ?? config.defaultIconName;
    const defaultColor = option?.data?.color || "#ffffff";
    const color = ((config.jsonConfig && option?.key) ? config.jsonConfig[option?.key]?.color : defaultColor)  ?? defaultColor;
    const description = option?.data?.description || "";
    
    // Enhanced color logic based on requirements
    let iconColor: string;
    
    if (!config.showColorIcon) {
      // When showColorIcon is false, always use black
      iconColor = "#000000";
    } else if (config.iconColorOverride && config.showColorBackground === "Full") {
      if (isSelectedField) {
        // For selected field: adjust icon based on background darkness
        const backgroundIsDark = isColorDark(color);
        if (backgroundIsDark) {
          // Dark background: use lighter version of override color
          iconColor = lightenColor(config.iconColorOverride, 0.8);
        } else {
          // Light background: use darker version of override color
          iconColor = darkenColor(config.iconColorOverride, 0.4);
        }
      } else {
        // For dropdown options: use the original override color
        iconColor = config.iconColorOverride;
      }
    } else if (config.iconColorOverride) {
      // If iconColorOverride is set, use it directly (for No background or Lighter background)
      iconColor = config.iconColorOverride;
    } else if (config.showColorBackground === "Full") {
      if (isSelectedField) {
        // For selected field: adjust icon based on background darkness
        const backgroundIsDark = isColorDark(color);
        if (backgroundIsDark) {
          // Dark background: use lighter version of option color
          iconColor = lightenColor(color, 0.8);
        } else {
          // Light background: use darker version of option color
          iconColor = darkenColor(color, 0.4);
        }
      } else {
        // For dropdown options: use the original color
        iconColor = color;
      }
    } else {
      // For all other cases (No background, Lighter background), use the option color
      iconColor = color;
    }
    
    // Determine if we should show an icon (simplified validation)
    const iconValidation = validateAndGetIcon(icon);
    const shouldShowIcon = iconValidation.isValid;
    
    // Log icon validation results for debugging
    if (!iconValidation.isValid && icon) {
      console.warn(`🚫 Unsupported icon "${icon}" - showing color indicator fallback`);
    }
    
    const content = (
      <div className={`${className} option-content`} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',  // Ensure left alignment
        width: '100%',
        overflow: 'hidden'
      }}>
          {shouldShowIcon && (
            // Simplified icon rendering - let Fluent UI handle MDL2 icons
            (() => {
              // Strategy 1: Try MDL2 Icon (most common case)
              if (iconValidation.iconType === 'mdl2') {
                return (
                  <Icon 
                    styles={{root: {color: iconColor, marginRight: "8px", flexShrink: 0}}} 
                    iconName={icon} 
                    aria-hidden="true" 
                  />
                );
              }
              
              // Strategy 2: Try Unicode character rendering
              if (iconValidation.iconType === 'unicode') {
                try {
                  const unicodeChar = convertToUnicodeChar(icon);
                  if (unicodeChar) {
                    return (
                      <span 
                        style={{
                          color: iconColor,
                          marginRight: '8px',
                          flexShrink: 0,
                          fontFamily: 'Segoe MDL2 Assets, Segoe UI Symbol, Symbols',
                          fontSize: '14px',
                          lineHeight: '16px',
                          textAlign: 'center',
                          width: '16px',
                          height: '16px',
                          display: 'inline-block'
                        }}
                        aria-hidden="true"
                      >
                        {unicodeChar}
                      </span>
                    );
                  }
                } catch (error) {
                  console.warn(`Unicode icon "${icon}" failed:`, error);
                }
              }
              
              // Strategy 3: Try CSS class-based rendering
              if (iconValidation.iconType === 'css') {
                try {
                  const cssClass = icon.startsWith('.') ? icon.substring(1) : icon;
                  return (
                    <i 
                      className={`ms-Icon ${cssClass.includes('ms-Icon') ? cssClass : `ms-Icon--${cssClass}`}`}
                      style={{
                        color: iconColor,
                        marginRight: '8px',
                        flexShrink: 0,
                        fontSize: '14px',
                        lineHeight: '16px'
                      }}
                      aria-hidden="true"
                    />
                  );
                } catch (error) {
                  console.warn(`CSS icon "${icon}" failed:`, error);
                }
              }
              
              // Final fallback: Color circle indicator
              console.log(`🎨 Using color circle fallback for icon "${icon}"`);
              return (
                <span 
                  className="color-indicator"
                  data-icon={icon}
                  data-color={iconColor}
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    marginRight: '8px',
                    flexShrink: 0,
                    backgroundColor: iconColor,
                    border: '1px solid rgba(0,0,0,0.1)',
                    display: 'inline-block'
                  }}
                  title={`Icon: ${icon} (fallback)`}
                />
              );
            })()
          )}
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          textAlign: 'left'  // Explicitly set text alignment to left
        }}>{option?.text || ""}</span>
      </div>
    );

    // Wrap with tooltip - use description if available, otherwise use option text as tooltip
    const tooltipContent = (description && description.trim() !== "") ? description : option?.text || "";
    
    if (tooltipContent && tooltipContent.trim() !== "") {
      return (
        <TooltipHost 
          content={tooltipContent}
          delay={1} // TooltipDelay.medium
          directionalHint={3} // topCenter
          styles={{
            root: { 
              width: '100%',
              display: 'block' // Changed to block to prevent flex interference
            }
          }}
          tooltipProps={{
            styles: {
              root: {
                maxWidth: '250px',
                padding: '8px 12px',
                backgroundColor: '#323130',
                color: '#ffffff',
                fontSize: '12px',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                border: 'none',
                wordWrap: 'break-word'
              }
            }
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: '100%'
          }}>
            {content}
          </div>
        </TooltipHost>
      );
    }
    
    return content;
  }

  const _onRenderOption = (option: ISelectableOption | undefined): React.ReactElement => {
  return _renderOption(option, "lops_AdvancedOptions_item", false) // false = dropdown option
  };

const _onRenderTitle = (options: IDropdownOption[] | undefined): React.ReactElement => {
    const option = (options || [])[0];
    return _renderOption(option, "option", true); // true = selected field
        
  };
     
    return (
        <div style={{ 
          width: '100%', 
          maxWidth: '100%', 
          boxSizing: 'border-box',
          overflow: 'visible',
          minHeight: config.componentHeight === "Short" ? '36px' : '44px', // Increased minimum height
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start'  // Ensure left alignment for main container
        }}>
          <Dropdown        
              placeHolder="---"
              options={options}
              defaultSelectedKey={defaultValue || -1}
              selectedKey={selectedKey}  
              onRenderTitle = {_onRenderTitle}            
              onRenderOption = {_onRenderOption}            
              onChange={_onSelectedChanged}                         
              disabled={isDisabled} 
              className="ComboBox"                        
               styles = {(props) => dropdownStyles(props, selectedColor, config.showColorBackground, config.showColorBorder, config.makeFontBold, config.componentHeight, config.iconColorOverride)}
              theme = {myTheme}           
          />
        </div>
    );

};
/*, (prev, next)=> {  
  return prev.rawOptions === next.rawOptions
        && prev.selectedKey === next.selectedKey 
        && prev.isDisabled===next.isDisabled 
        && prev.defaultValue===next.defaultValue 
        && prev.config===next.config;  
})   */
   




