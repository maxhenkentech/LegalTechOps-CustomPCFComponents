/** @jsx React.createElement */
import * as React from 'react';
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { Icon } from "@fluentui/react/lib/Icon";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";

initializeIcons();

export interface ISetupSchemaValue {
  icon?: string;
}
export type ISetupSchema = Record<string, ISetupSchemaValue>;

export interface IConfig {
  jsonConfig: ISetupSchema | undefined;
  defaultIconName: string;
  useExternalValueForIcon: boolean;
  hideHiddenOptions: boolean;
  sortBy: "Value" | "Text";
  tileShape: "Square" | "Rounded";
  tileSize: "Small" | "Normal" | "Large";
  showChoiceValue: boolean;
  makeFontBold: boolean;
  notSelectedColor: string;
  hoverColor: string;
  selectedBackgroundMode: "CustomColor" | "ChoiceColor" | "CustomColorFaded";
  selectedColor: string;
  selectedBorderMode: "Off" | "CustomColor" | "ChoiceColor" | "CustomColorFaded";
  selectedBorderColor: string;
  iconColorMode: "Auto" | "CustomColor" | "ChoiceColor" | "CustomColorFaded";
  iconColor: string;
  iconColorScope: "AllTiles" | "SelectedOnly";
}

interface IModernChoiceButtonsProperties {
  rawOptions: ComponentFramework.PropertyHelper.OptionMetadata[];
  selectedKey: number | null;
  onChange: (value: number | null) => void;
  isDisabled: boolean;
  config: IConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contextUtils: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contextParameters: any;
  contextMode: ComponentFramework.Mode;
}

// Same simple, trust-Fluent-UI icon validation approach as AdvancedDropDown --
// no predefined icon-name list, just enough pattern matching to pick a rendering strategy.
const validateAndGetIcon = (iconName: string): { isValid: boolean; iconType: 'mdl2' | 'unicode' | 'css' | 'unknown' } => {
  if (!iconName || iconName.trim() === '' || iconName === 'undefined') {
    return { isValid: false, iconType: 'unknown' };
  }

  const cleanIconName = iconName.trim();

  const unicodePatterns = [
    /^\\u[0-9A-Fa-f]{4}$/,
    /^&#x[0-9A-Fa-f]+;$/,
    /^0x[0-9A-Fa-f]+$/,
    /^U\+[0-9A-Fa-f]{4}$/
  ];

  if (unicodePatterns.some(pattern => pattern.test(cleanIconName))) {
    return { isValid: true, iconType: 'unicode' };
  }

  if (cleanIconName.includes('ms-Icon') || cleanIconName.includes('fabric-icon') ||
    cleanIconName.includes('icon-') || cleanIconName.startsWith('.')) {
    return { isValid: true, iconType: 'css' };
  }

  return { isValid: true, iconType: 'mdl2' };
};

const convertToUnicodeChar = (iconStr: string): string | null => {
  try {
    const cleaned = iconStr.trim();
    let hexCode: string | null = null;

    if (cleaned.startsWith('\\u')) hexCode = cleaned.substring(2);
    else if (cleaned.startsWith('&#x') && cleaned.endsWith(';')) hexCode = cleaned.substring(3, cleaned.length - 1);
    else if (cleaned.startsWith('0x')) hexCode = cleaned.substring(2);
    else if (cleaned.startsWith('U+')) hexCode = cleaned.substring(2);

    return hexCode ? String.fromCharCode(parseInt(hexCode, 16)) : null;
  } catch (error) {
    console.warn(`Failed to convert Unicode string "${iconStr}":`, error);
    return null;
  }
};

const isColorDark = (color: string): boolean => {
  if (!color || !color.startsWith('#') || color.length < 7) return false;
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.55;
};

// Mixes a hex color toward white by `amount` (0-1) to produce a "faded" tint,
// used by the CustomColorFaded background/border/icon modes.
const lightenColor = (color: string, amount = 0.94): string => {
  if (!color || !color.startsWith('#') || color.length < 7) return color;
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const toHex = (channel: number) => Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Tile dimensions per Tile size setting. The icon's own font-size is intentionally
// NOT part of this table -- it stays fixed regardless of tile size, per design.
const ICON_FONT_SIZE = '22px';
// Used instead of ICON_FONT_SIZE when Show choice value is off, so the icon fills the
// tile more prominently in place of the hidden label -- still keyed by tile size.
const ICON_FONT_SIZE_NO_LABEL: Record<IConfig['tileSize'], string> = {
  Small: '28px',
  Normal: '36px',
  Large: '44px',
};
const TILE_SIZE_STYLES: Record<IConfig['tileSize'], { padding: string; minWidth: string; maxWidth: string; gap: string; labelFontSize: string; labelLineHeight: string }> = {
  Small: { padding: '6px 6px', minWidth: '64px', maxWidth: '96px', gap: '4px', labelFontSize: '10px', labelLineHeight: '13px' },
  Normal: { padding: '10px 8px', minWidth: '84px', maxWidth: '128px', gap: '6px', labelFontSize: '12px', labelLineHeight: '15px' },
  Large: { padding: '14px 10px', minWidth: '104px', maxWidth: '160px', gap: '8px', labelFontSize: '14px', labelLineHeight: '18px' },
};

export const ModernChoiceButtonsControl = ({ rawOptions, selectedKey, onChange, isDisabled, config, contextUtils, contextParameters, contextMode }: IModernChoiceButtonsProperties): React.ReactElement => {

  const [externalIconsMap, setExternalIconsMap] = React.useState<Record<number, string>>({});
  const [hasFetchedMetadata, setHasFetchedMetadata] = React.useState(false);
  const [hoveredKey, setHoveredKey] = React.useState<number | null>(null);

  // Fetch OptionSet metadata directly via the Web API to read each option's ExternalValue,
  // the same technique AdvancedOptionsControl.tsx uses -- the PCF SDK does not expose it.
  React.useEffect(() => {
    if (config.useExternalValueForIcon && !hasFetchedMetadata && (contextUtils || contextParameters)) {
      try {
        let entityName: string | undefined = contextParameters?.optionsInput?.etn;

        if (!entityName) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          entityName = (contextMode as any)?.contextInfo?.entityTypeName;
        }

        if (!entityName) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const page = (contextUtils as any)?.page;
          if (page && page.entityTypeName) {
            entityName = page.entityTypeName;
          }
        }

        if (!entityName) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          entityName = (contextParameters as any)?.entityTypeName;
        }

        let attributeName: string | undefined;
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
            const optionSet = metadata.OptionSet;
            if (optionSet && optionSet.Options) {
              const map: Record<number, string> = {};
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              optionSet.Options.forEach((opt: any) => {
                if (opt.ExternalValue && opt.Value !== undefined) {
                  map[opt.Value] = opt.ExternalValue;
                }
              });
              setExternalIconsMap(map);
            } else {
              console.warn("⚠️ WARNING: OptionSet or Options not found in Web API response.");
            }
            return undefined;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }).catch((err: any) => {
            console.warn("❌ FAILED to fetch entity metadata via Web API:", err);
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error("❌ CRITICAL error during metadata fetch setup:", err);
      }
    }
  }, [config.useExternalValueForIcon, hasFetchedMetadata, contextUtils, contextParameters, contextMode]);

  let options = (rawOptions || []).filter(opt => {
    if (!config.hideHiddenOptions) return true;
    const optAny = opt as unknown as Record<string, unknown>;
    return optAny.IsHidden !== true;
  });

  if (config.sortBy === "Text") {
    options = [...options].sort((a, b) => a.Label.localeCompare(b.Label));
  } else {
    options = [...options].sort((a, b) => a.Value - b.Value);
  }

  const cornerRadius = config.tileShape === "Square" ? "2px" : "8px";
  const sizeStyles = TILE_SIZE_STYLES[config.tileSize] || TILE_SIZE_STYLES.Normal;

  const _onClick = (value: number) => {
    if (isDisabled) return;
    if (value === selectedKey) return;
    onChange(value);
  };

  const _onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, value: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      _onClick(value);
    }
  };

  return (
    <div
      className="lops-mcb-container"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {options.map((option) => {
        const optionAny = option as unknown as Record<string, unknown>;
        const value = option.Value;
        const isSelected = value === selectedKey;
        const isHovered = hoveredKey === value && !isDisabled;
        const choiceColor = option.Color;
        const description = (optionAny.Description as string) || "";

        // Icon resolution: JSON per-option override > External Value (fetched or inline) > default icon
        let icon = (config.jsonConfig && config.jsonConfig[String(value)]?.icon) || config.defaultIconName;
        const enrichedIcon = externalIconsMap[value];
        const inlineExternalValue = (optionAny.ExternalValue as string) || (optionAny.externalValue as string) || (optionAny.externalvalue as string);
        if (config.useExternalValueForIcon) {
          icon = enrichedIcon || inlineExternalValue || icon;
        }

        // Background resolution
        let background: string;
        if (isSelected) {
          if (config.selectedBackgroundMode === "ChoiceColor" && choiceColor) {
            background = choiceColor;
          } else if (config.selectedBackgroundMode === "CustomColorFaded") {
            background = lightenColor(choiceColor || config.selectedColor);
          } else {
            background = config.selectedColor;
          }
        } else if (isHovered) {
          background = config.hoverColor;
        } else {
          background = config.notSelectedColor;
        }

        // Border resolution
        let border: string;
        if (isSelected && config.selectedBorderMode !== "Off") {
          let borderColor: string;
          if (config.selectedBorderMode === "ChoiceColor" && choiceColor) {
            borderColor = choiceColor;
          } else if (config.selectedBorderMode === "CustomColorFaded") {
            borderColor = lightenColor(choiceColor || config.selectedBorderColor);
          } else {
            borderColor = config.selectedBorderColor;
          }
          border = `2px solid ${borderColor}`;
        } else if (isSelected) {
          border = '2px solid transparent';
        } else {
          border = '1px solid #D2D0CE';
        }

        const contentColor = isColorDark(background) ? '#FFFFFF' : '#201F1E';

        // Icon color resolution: independent of the label's automatic-contrast color.
        // When scope is "SelectedOnly", the configured mode is only applied to the selected
        // tile's icon -- every other tile falls back to automatic contrast, same as "Auto".
        const applyIconColorMode = config.iconColorScope === "AllTiles" || isSelected;
        let iconColor: string;
        if (!applyIconColorMode) {
          iconColor = contentColor;
        } else if (config.iconColorMode === "ChoiceColor" && choiceColor) {
          iconColor = choiceColor;
        } else if (config.iconColorMode === "CustomColorFaded") {
          iconColor = lightenColor(choiceColor || config.iconColor);
        } else if (config.iconColorMode === "CustomColor") {
          iconColor = config.iconColor;
        } else {
          iconColor = contentColor;
        }

        const iconValidation = validateAndGetIcon(icon);
        const shouldShowIcon = iconValidation.isValid;
        const iconFontSize = config.showChoiceValue ? ICON_FONT_SIZE : ICON_FONT_SIZE_NO_LABEL[config.tileSize];

        const tile = (
          <button
            key={value}
            type="button"
            disabled={isDisabled}
            aria-pressed={isSelected}
            title={description || option.Label}
            onClick={() => _onClick(value)}
            onKeyDown={(e) => _onKeyDown(e, value)}
            onMouseEnter={() => setHoveredKey(value)}
            onMouseLeave={() => setHoveredKey(null)}
            className="lops-mcb-tile"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: sizeStyles.gap,
              minWidth: sizeStyles.minWidth,
              maxWidth: sizeStyles.maxWidth,
              padding: sizeStyles.padding,
              boxSizing: 'border-box',
              borderRadius: cornerRadius,
              border: border,
              backgroundColor: background,
              color: contentColor,
              cursor: isDisabled ? 'default' : 'pointer',
              opacity: isDisabled ? 0.6 : 1,
              transition: 'background-color 0.12s ease-in-out, border-color 0.12s ease-in-out',
              fontFamily: "'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif"
            }}
          >
            {shouldShowIcon && (() => {
              if (iconValidation.iconType === 'mdl2') {
                return <Icon iconName={icon} aria-hidden="true" styles={{ root: { fontSize: iconFontSize, color: iconColor } }} />;
              }
              if (iconValidation.iconType === 'unicode') {
                const unicodeChar = convertToUnicodeChar(icon);
                if (unicodeChar) {
                  return (
                    <span aria-hidden="true" style={{ fontFamily: 'Segoe MDL2 Assets, Segoe UI Symbol, Symbols', fontSize: iconFontSize, lineHeight: iconFontSize, color: iconColor }}>
                      {unicodeChar}
                    </span>
                  );
                }
              }
              if (iconValidation.iconType === 'css') {
                const cssClass = icon.startsWith('.') ? icon.substring(1) : icon;
                return <i aria-hidden="true" className={`ms-Icon ${cssClass.includes('ms-Icon') ? cssClass : `ms-Icon--${cssClass}`}`} style={{ fontSize: iconFontSize, color: iconColor }} />;
              }
              return null;
            })()}
            {config.showChoiceValue && (
              <span
                className="lops-mcb-label"
                style={{
                  fontSize: sizeStyles.labelFontSize,
                  lineHeight: sizeStyles.labelLineHeight,
                  fontWeight: config.makeFontBold ? 600 : 400,
                  color: contentColor,
                  textAlign: 'center',
                  width: '100%',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as const,
                  wordBreak: 'break-word'
                }}
              >
                {option.Label}
              </span>
            )}
          </button>
        );

        if (description && description.trim() !== "") {
          return (
            <TooltipHost key={value} content={description} delay={1} directionalHint={3}>
              {tile}
            </TooltipHost>
          );
        }

        return tile;
      })}
    </div>
  );
};
