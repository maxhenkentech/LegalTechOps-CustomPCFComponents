/** @jsx React.createElement */
import * as React from 'react';
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown";
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { Icon } from "@fluentui/react/lib/Icon";
import { ISelectableOption } from "@fluentui/react/lib/SelectableOption";
import { getIcon } from "@fluentui/react/lib/Styling";
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

// A publisher-prefixed Dataverse web resource name, e.g. "hek_HenkenTechBlack" or the folder
// form "hek_/images/logo.svg". None of the 1,801 registered MDL2 names contain an underscore,
// and neither do the Unicode-escape or CSS-class forms below, so a leading "<prefix>_" is an
// unambiguous marker for "this is an image in the org, not a font glyph". The prefix is matched
// specifically (2-8 alphanumerics, as Dataverse publisher prefixes are) rather than testing for
// a bare underscore anywhere, so a typo carrying a stray "_" doesn't get sent off to request a
// web resource that was never going to exist.
const WEB_RESOURCE_NAME_PATTERN = /^[a-z][a-z0-9]{1,7}_/i;

// Image web resources are served same-origin at /WebResources/<name>, so rendering one needs no
// Web API round trip and no base64 decode -- the browser caches it like any other image.
const getWebResourceUrl = (iconName: string): string => `/WebResources/${encodeURI(iconName.trim())}`;

// Simple icon validation without predefined lists - trust Fluent UI's built-in MDL2 support
const validateAndGetIcon = (iconName: string): {
  isValid: boolean;
  iconType: 'webresource' | 'mdl2' | 'unicode' | 'css' | 'unknown';
} => {
  if (!iconName || iconName.trim() === '' || iconName === 'undefined') {
    return { isValid: false, iconType: 'unknown' };
  }

  const cleanIconName = iconName.trim();

  // Checked before the CSS-class branch below on purpose: a web resource name is free to
  // contain "icon-" (e.g. "hek_icon-approved.png"), and the prefix is the stronger signal.
  if (WEB_RESOURCE_NAME_PATTERN.test(cleanIconName)) {
    return { isValid: true, iconType: 'webresource' };
  }

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

// `validateAndGetIcon` only picks a *rendering strategy* -- it cannot tell a real MDL2 name from
// a typo or from a Segoe Fluent Icons name with no MDL2 equivalent (only ~490 of the ~1,530 names
// on Microsoft's Segoe Fluent Icons page exist in @fluentui/font-icons-mdl2). Fluent's <Icon>
// renders an empty span for an unregistered name, so without this check a wrong name silently
// renders nothing instead of dropping through to the color-circle fallback below. `getIcon` reads
// the registry `initializeIcons()` populates; it lower-cases names, so lookups are case-insensitive.
const isRegisteredMdl2Icon = (iconName: string): boolean => {
  try {
    return getIcon(iconName) !== undefined;
  } catch {
    return false;
  }
};

// Module-level so an unknown name only warns once, not on every re-render.
const warnedIconNames = new Set<string>();

const warnUnknownIconOnce = (iconName: string): void => {
  if (warnedIconNames.has(iconName)) return;
  warnedIconNames.add(iconName);
  console.warn(
    `[lops.AdvancedDropDown] Icon "${iconName}" is not an MDL2 icon name and cannot be rendered ` +
    `-- falling back to the color indicator. See FLUENT_ICONS.md for the full list of supported ` +
    `names; Microsoft's Segoe Fluent Icons page documents a different (Windows desktop) font and ` +
    `most of its names do not exist here.`
  );
};

// The de-emphasized state for an image icon. A bitmap or SVG web resource can't be recolored
// the way a font glyph can, so when "Show color icon" is off -- the setting that forces every
// glyph to flat black, i.e. "don't use color here" -- images are desaturated instead. No
// opacity fade in this control: that setting means monochrome, not de-emphasis (unlike
// ModernChoiceButtons' Icon color scope, where fading unselected tiles back *is* the point).
const DESATURATED_IMAGE_FILTER = 'grayscale(1)';

interface IWebResourceIconProps {
  iconName: string;
  desaturate: boolean;
  renderFallback: () => React.ReactElement | null;
}

// Renders an image web resource as an option icon. A name that doesn't resolve (unpublished,
// misspelled, or wrong prefix) produces an image load error rather than an HTTP failure we
// could catch up front, so the fallback is driven off the <img>'s own onError.
const WebResourceIcon = ({ iconName, desaturate, renderFallback }: IWebResourceIconProps): React.ReactElement | null => {
  const [failed, setFailed] = React.useState(false);

  // A re-render with a different name deserves a fresh attempt -- otherwise one bad name would
  // poison the slot for every option that later reuses this component instance.
  React.useEffect(() => setFailed(false), [iconName]);

  if (failed) return renderFallback();

  return (
    <img
      src={getWebResourceUrl(iconName)}
      alt=""
      aria-hidden="true"
      onError={() => {
        if (!warnedIconNames.has(iconName)) {
          warnedIconNames.add(iconName);
          console.warn(
            `[lops.AdvancedDropDown] Web resource "${iconName}" could not be loaded from ` +
            `${getWebResourceUrl(iconName)} -- falling back to the color indicator. Check that the ` +
            `web resource exists, is an image type, and has been published.`
          );
        }
        setFailed(true);
      }}
      style={{
        // Square box matching the MDL2 glyph metrics, with the same 8px gutter. objectFit
        // "contain" means a square source fills it exactly and a non-square one is letterboxed
        // down to fit, rather than stretched or cropped.
        width: '16px',
        height: '16px',
        objectFit: 'contain',
        marginRight: '8px',
        flexShrink: 0,
        filter: desaturate ? DESATURATED_IMAGE_FILTER : 'none'
      }}
    />
  );
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
  onChange: (value: number | null) => void
  isDisabled: boolean;
  defaultValue: number | undefined;
  config: IConfig;
  selectedColor?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contextUtils: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contextParameters: any;
  contextMode: ComponentFramework.Mode;
}







//export default class AdvancedOptionsControl extends React.Component<IAdvancedOptionsProperties, {}> {            
//export const AdvancedOptionsControl = ({rawOptions, selectedKey, onChange, isDisabled, defaultValue, config}:IAdvancedOptionsProperties): JSX.Element =>{    
export const AdvancedOptionsControl = ({ rawOptions, selectedKey, onChange, isDisabled, defaultValue, config, selectedColor, contextUtils, contextParameters, contextMode }: IAdvancedOptionsProperties): React.ReactElement => {

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

  const allOptions = [{ Label: "--Select--", Value: -1, Color: "transparent", Description: "Select an option" }, ...rawOptions];
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
    const val = (option?.key == null || option?.key === -1) ? null : option?.key as number;
    onChange(val);
  }

  const _renderOption = (option: ISelectableOption | undefined, className?: string, isSelectedField?: boolean): React.ReactElement => {
    let icon = ((config.jsonConfig && option?.key) ? config.jsonConfig[option?.key]?.icon : config.defaultIconName) ?? config.defaultIconName;

    // logic for External Value Icons
    const enrichedIcon = option?.key ? externalIconsMap[option.key as number] : null;
    if (config.useExternalValueForIcon && enrichedIcon) {
      icon = enrichedIcon;
    } else if (config.useExternalValueForIcon && option?.data?.externalValue) {
      icon = option.data.externalValue;
    }

    const defaultColor = option?.data?.color || "#ffffff";
    const color = ((config.jsonConfig && option?.key) ? config.jsonConfig[option?.key]?.color : defaultColor) ?? defaultColor;
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
            // The final color-circle fallback, hoisted so the web resource strategy below can
            // fall back to the same indicator every other failed strategy lands on.
            const renderColorIndicator = (): React.ReactElement => (
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

            // Strategy 0: an image web resource from the org. It ignores every icon *color*
            // setting -- it renders as authored -- except "Show color icon", which means
            // "don't use color here" and desaturates the image accordingly.
            if (iconValidation.iconType === 'webresource') {
              return (
                <WebResourceIcon
                  iconName={icon.trim()}
                  desaturate={!config.showColorIcon}
                  renderFallback={renderColorIndicator}
                />
              );
            }

            // Strategy 1: Try MDL2 Icon (most common case). An unregistered name falls
            // through to the color-circle fallback rather than rendering an empty span.
            if (iconValidation.iconType === 'mdl2') {
              const cleanIconName = icon.trim();
              if (isRegisteredMdl2Icon(cleanIconName)) {
                return (
                  <Icon
                    styles={{ root: { color: iconColor, marginRight: "8px", flexShrink: 0 } }}
                    iconName={cleanIconName}
                    aria-hidden="true"
                  />
                );
              }
              warnUnknownIconOnce(cleanIconName);
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
            return renderColorIndicator();
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
        placeHolder={config.placeholderText}
        options={options}
        defaultSelectedKey={defaultValue || -1}
        selectedKey={selectedKey}
        onRenderTitle={_onRenderTitle}
        onRenderOption={_onRenderOption}
        onChange={_onSelectedChanged}
        disabled={isDisabled}
        className="ComboBox"
        styles={(props) => dropdownStyles(props, selectedColor, config.showColorBackground, config.showColorBorder, config.makeFontBold, config.componentHeight, config.iconColorOverride)}
        theme={myTheme}
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





