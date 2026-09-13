/** @jsx React.createElement */
import * as React from 'react';
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { Icon } from "@fluentui/react/lib/Icon";
import { getIcon } from "@fluentui/react/lib/Styling";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";

initializeIcons();

export interface ISetupSchemaValue {
  icon?: string;
}
export type ISetupSchema = Record<string, ISetupSchemaValue>;

export interface IConfig {
  jsonConfig: ISetupSchema | undefined;
  defaultIconName: string;
  showSelectedOnly: boolean;
  useExternalValueForIcon: boolean;
  hideHiddenOptions: boolean;
  sortBy: "Value" | "Text";
  tileShape: "Square" | "Rounded";
  tileSize: "Small" | "Normal" | "Large";
  showChoiceValue: boolean;
  iconPosition: "Above" | "Below" | "Left" | "Right";
  reflowBehaviour: "Wrap" | "Flexible";
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

// A publisher-prefixed Dataverse web resource name, e.g. "hek_HenkenTechBlack" or the
// folder form "hek_/images/logo.svg". None of the 1,801 registered MDL2 names contain an
// underscore, and neither do the Unicode-escape (&#xE700;, 0xE700, U+E700) or the
// CSS-class (ms-Icon--Foo, icon-foo) forms, so a leading "<prefix>_" is an unambiguous
// marker for "this is an image in the org, not a font glyph". The prefix is matched
// specifically (2-8 alphanumerics, as Dataverse publisher prefixes are) rather than testing
// for a bare underscore anywhere, so a typo carrying a stray "_" doesn't get sent off to
// request a web resource that was never going to exist.
const WEB_RESOURCE_NAME_PATTERN = /^[a-z][a-z0-9]{1,7}_/i;

// Image web resources are served same-origin at /WebResources/<name>, so rendering one needs
// no Web API round trip and no base64 decode -- the browser caches it like any other image.
const getWebResourceUrl = (iconName: string): string => `/WebResources/${encodeURI(iconName.trim())}`;

// Same simple, trust-Fluent-UI icon validation approach as AdvancedDropDown --
// no predefined icon-name list, just enough pattern matching to pick a rendering strategy.
const validateAndGetIcon = (iconName: string): { isValid: boolean; iconType: 'webresource' | 'mdl2' | 'unicode' | 'css' | 'unknown' } => {
  if (!iconName || iconName.trim() === '' || iconName === 'undefined') {
    return { isValid: false, iconType: 'unknown' };
  }

  const cleanIconName = iconName.trim();

  // Checked before the CSS-class branch below on purpose: a web resource name is free to
  // contain "icon-" (e.g. "hek_icon-approved.png"), and the prefix is the stronger signal.
  if (WEB_RESOURCE_NAME_PATTERN.test(cleanIconName)) {
    return { isValid: true, iconType: 'webresource' };
  }

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

// `validateAndGetIcon` only picks a *rendering strategy* -- it can't tell a real MDL2 name
// from a typo or from a Segoe Fluent Icons name that has no MDL2 equivalent (only ~490 of the
// ~1,530 names on Microsoft's Segoe Fluent Icons page exist in @fluentui/font-icons-mdl2).
// Fluent's <Icon> renders an empty span for an unregistered name, so without this check a
// wrong name produces a silently blank tile. `getIcon` is the registry `initializeIcons()`
// populates; it normalizes to lower case, so lookups are case-insensitive.
const isRegisteredMdl2Icon = (iconName: string): boolean => {
  try {
    return getIcon(iconName) !== undefined;
  } catch {
    return false;
  }
};

// Module-level so a name only warns once, not on every re-render.
const warnedIconNames = new Set<string>();

// Returns the MDL2 name to actually render: the requested one if registered, else the
// configured default as a last resort, else null (render no icon at all).
const resolveMdl2IconName = (requested: string, fallback: string): string | null => {
  if (isRegisteredMdl2Icon(requested)) return requested;

  if (!warnedIconNames.has(requested)) {
    warnedIconNames.add(requested);
    console.warn(
      `[lops.ModernChoiceButtons] Icon "${requested}" is not an MDL2 icon name and cannot be rendered. ` +
      `See FLUENT_ICONS.md for the full list of supported names -- note that Microsoft's Segoe Fluent Icons ` +
      `page documents a different (Windows desktop) font, and most of its names do not exist here.`
    );
  }

  const trimmedFallback = (fallback || '').trim();
  if (trimmedFallback && trimmedFallback !== requested && isRegisteredMdl2Icon(trimmedFallback)) {
    return trimmedFallback;
  }
  return null;
};

// The de-emphasized state for an image icon. A bitmap or SVG web resource can't be recolored
// the way a font glyph can, so the image analogue of "this tile's icon isn't the active one"
// is to desaturate it and fade it back. Opacity (rather than brightness) is what matches
// `lightenColor`'s blend-toward-the-backdrop effect on light tiles, and it degrades sensibly
// on dark tiles instead of making the image *more* prominent there.
const DEEMPHASIZED_IMAGE_FILTER = 'grayscale(1) opacity(0.55)';

// Last-resort glyph when a web resource fails to load and the configured default icon is
// itself unusable as a stand-in. Kept in sync with the `defaultIcon` argument index.ts passes.
const FALLBACK_MDL2_ICON = 'RadioBtnOff';

interface IWebResourceIconProps {
  iconName: string;
  size: string;
  deemphasized: boolean;
  renderFallback: () => React.ReactElement | null;
}

// Renders an image web resource as a tile icon. A name that doesn't resolve (unpublished,
// misspelled, or wrong prefix) produces an image load error rather than an HTTP failure we
// could catch up front, so the fallback is driven off the <img>'s own onError.
const WebResourceIcon = ({ iconName, size, deemphasized, renderFallback }: IWebResourceIconProps): React.ReactElement | null => {
  const [failed, setFailed] = React.useState(false);

  // A re-render with a different name deserves a fresh attempt -- otherwise one bad name
  // would poison the slot for every option that later reuses this component instance.
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
            `[lops.ModernChoiceButtons] Web resource "${iconName}" could not be loaded from ` +
            `${getWebResourceUrl(iconName)} -- falling back to the default icon. Check that the web ` +
            `resource exists, is an image type, and has been published.`
          );
        }
        setFailed(true);
      }}
      style={{
        // Square box with objectFit "contain": a square source fills it exactly, and a
        // non-square one is letterboxed down to fit rather than stretched or cropped.
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        filter: deemphasized ? DEEMPHASIZED_IMAGE_FILTER : 'none',
        transition: 'filter 0.12s ease-in-out'
      }}
    />
  );
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
// Used only for the compact-height case (Small + Left/Right + label shown, see applyCompactHeight
// below) -- the fixed 32px row height doesn't leave enough room for real visible padding around
// the full 22px icon without either the icon overflowing the box or padding shrinking back to
// where it reads as no padding at all. Shrinking the icon itself is what actually buys the
// breathing room the padding alone couldn't.
const COMPACT_ICON_FONT_SIZE = '18px';
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

// Icon position is only meaningful relative to the label -- with showChoiceValue off there's a
// single centered child regardless of direction, so no separate "centered" case is needed here.
const ICON_POSITION_FLEX_DIRECTION: Record<IConfig['iconPosition'], 'column' | 'column-reverse' | 'row' | 'row-reverse'> = {
  Above: 'column',
  Below: 'column-reverse',
  Left: 'row',
  Right: 'row-reverse',
};

// Matches the OOB Dataverse form control row height, so a Left/Right tile sitting next to a
// standard field lines up with it instead of standing taller. Only applied at Small tile size --
// Normal/Large are already meant to be bigger than a field row. Mirrors QuickActionButtons'
// identical STANDARD_FIELD_HEIGHT.
const STANDARD_FIELD_HEIGHT = '32px';

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

        if (!entityName || !attributeName) {
          // Diagnostic-only, deliberately not gated behind hasFetchedMetadata/warnedIconNames --
          // this branch previously did nothing at all, so a host that never supplies enough
          // context to resolve entityName/attributeName (e.g. a designer preview canvas handing
          // back a reduced contextMode/contextParameters shape, the same category of gap
          // AdvancedLookUp hit with a missing getTargetEntityType()) silently skipped the whole
          // External Value fetch with zero signal in the console. Needed to tell "the fetch ran
          // and failed" apart from "the fetch never even started" before guessing at a fix again.
          console.warn(
            `[lops.ModernChoiceButtons] useExternalValueForIcon is on but could not resolve ` +
            `entityName ("${entityName}") / attributeName ("${attributeName}") from this host's context -- ` +
            `the External Value fetch was not attempted, so all tiles will fall back to the default icon.`
          );
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
    // The currently selected value must always render, even if it's marked hidden --
    // otherwise picking a value and then hiding its option (or the field simply loading
    // with a hidden value already selected) makes the field appear to have no selection.
    if (opt.Value === selectedKey) return true;
    const optAny = opt as unknown as Record<string, unknown>;
    return optAny.IsHidden !== true;
  });

  if (config.sortBy === "Text") {
    options = [...options].sort((a, b) => a.Label.localeCompare(b.Label));
  } else {
    options = [...options].sort((a, b) => a.Value - b.Value);
  }

  // Show selection option only: reduce to just the selected tile. Sourced from `rawOptions`
  // rather than the filtered/sorted `options` above so the true current value is always shown
  // even if it happens to be a hidden option under Hide hidden choice options.
  if (config.showSelectedOnly) {
    options = (rawOptions || []).filter(opt => opt.Value === selectedKey);
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
        // Show selection option only: the canvas shrinks to fit exactly the one tile shown,
        // instead of stretching to the full width of the field like the normal tile row.
        width: config.showSelectedOnly ? 'fit-content' : '100%',
        boxSizing: 'border-box'
      }}
    >
      {options.length === 0 && (
        // Empty state: with zero tiles to render, this container would otherwise collapse to
        // 0x0 and vanish entirely -- indistinguishable from a broken/uninitialized control to
        // anyone looking at the form (e.g. the Form Editor's own live-preview canvas, which
        // doesn't always have a current value/option metadata available). A visibly-present
        // placeholder tile makes clear the control IS there, just has nothing to show yet.
        <div
          className="lops-mcb-placeholder"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: sizeStyles.minWidth,
            maxWidth: sizeStyles.maxWidth,
            padding: sizeStyles.padding,
            boxSizing: 'border-box',
            borderRadius: cornerRadius,
            border: '1px dashed #D2D0CE',
            color: '#A19F9D',
            fontSize: sizeStyles.labelFontSize,
            fontStyle: 'italic'
          }}
        >
          {config.showSelectedOnly ? 'No value' : 'No options'}
        </div>
      )}
      {options.map((option) => {
        const optionAny = option as unknown as Record<string, unknown>;
        const value = option.Value;
        const isSelected = value === selectedKey;
        // Show selection option only: the single tile shown is a static display of the
        // current value, not an interactive control -- no hover, click, or keyboard activation.
        const interactive = !isDisabled && !config.showSelectedOnly;
        const isHovered = hoveredKey === value && interactive;
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
        const isRowLayout = config.iconPosition === 'Left' || config.iconPosition === 'Right';
        const isFlexible = config.reflowBehaviour === 'Flexible';
        // Compact height only kicks in for Small + a row layout with the label actually shown --
        // with the label off, layout always falls back to centered/column regardless of iconPosition.
        const applyCompactHeight = config.tileSize === 'Small' && isRowLayout && config.showChoiceValue;
        // v1.8.1's first nudge (3px vertical / +2px horizontal) wasn't visibly different enough
        // against the fixed 32px height. v1.8.2 goes further on both padding *and* shrinks the
        // icon itself (COMPACT_ICON_FONT_SIZE) -- padding alone can't grow much more at a fixed
        // 32px height without the full-size 22px icon starting to overflow the box.
        const effectiveIconFontSize = applyCompactHeight ? COMPACT_ICON_FONT_SIZE : iconFontSize;
        const compactHorizontalPadding = `${parseInt(sizeStyles.padding.split(' ')[1] || sizeStyles.padding, 10) + 4}px`;

        const tile = (
          <button
            key={value}
            type="button"
            disabled={isDisabled}
            tabIndex={interactive ? undefined : -1}
            aria-pressed={isSelected}
            title={!config.showSelectedOnly ? (description || option.Label) : undefined}
            onClick={interactive ? () => _onClick(value) : undefined}
            onKeyDown={interactive ? (e) => _onKeyDown(e, value) : undefined}
            onMouseEnter={interactive ? () => setHoveredKey(value) : undefined}
            onMouseLeave={interactive ? () => setHoveredKey(null) : undefined}
            className="lops-mcb-tile"
            style={{
              display: 'flex',
              flexDirection: config.showChoiceValue ? ICON_POSITION_FLEX_DIRECTION[config.iconPosition] : 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: sizeStyles.gap,
              minWidth: isFlexible ? undefined : sizeStyles.minWidth,
              maxWidth: isFlexible ? undefined : sizeStyles.maxWidth,
              padding: applyCompactHeight ? `5px ${compactHorizontalPadding}` : sizeStyles.padding,
              height: applyCompactHeight ? STANDARD_FIELD_HEIGHT : undefined,
              boxSizing: 'border-box',
              borderRadius: cornerRadius,
              border: border,
              backgroundColor: background,
              color: contentColor,
              cursor: interactive ? 'pointer' : 'default',
              opacity: isDisabled ? 0.6 : 1,
              transition: 'background-color 0.12s ease-in-out, border-color 0.12s ease-in-out',
              fontFamily: "'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif"
            }}
          >
            {shouldShowIcon && (() => {
              const renderDefaultIcon = (): React.ReactElement | null => {
                // Second argument is the hardcoded default rather than `defaultIconName` again,
                // because a maker who set the Icon property to a single web resource name has
                // made *that* the default -- which can't stand in for a failed image load.
                const resolved = resolveMdl2IconName(config.defaultIconName.trim(), FALLBACK_MDL2_ICON);
                if (!resolved) return null;
                return <Icon iconName={resolved} aria-hidden="true" styles={{ root: { fontSize: effectiveIconFontSize, color: iconColor } }} />;
              };

              // An image web resource ignores every icon *color* setting -- it renders as
              // authored. What it does honor is Icon color scope: under "Selected tile only"
              // the unselected tiles' images are desaturated and faded, which is the image
              // equivalent of the glyphs there dropping back to automatic contrast.
              if (iconValidation.iconType === 'webresource') {
                return (
                  <WebResourceIcon
                    iconName={icon.trim()}
                    size={effectiveIconFontSize}
                    deemphasized={!applyIconColorMode}
                    renderFallback={renderDefaultIcon}
                  />
                );
              }
              if (iconValidation.iconType === 'mdl2') {
                const resolvedIconName = resolveMdl2IconName(icon.trim(), config.defaultIconName);
                if (!resolvedIconName) return null;
                return <Icon iconName={resolvedIconName} aria-hidden="true" styles={{ root: { fontSize: effectiveIconFontSize, color: iconColor } }} />;
              }
              if (iconValidation.iconType === 'unicode') {
                const unicodeChar = convertToUnicodeChar(icon);
                if (unicodeChar) {
                  return (
                    <span aria-hidden="true" style={{ fontFamily: 'Segoe MDL2 Assets, Segoe UI Symbol, Symbols', fontSize: effectiveIconFontSize, lineHeight: effectiveIconFontSize, color: iconColor }}>
                      {unicodeChar}
                    </span>
                  );
                }
              }
              if (iconValidation.iconType === 'css') {
                const cssClass = icon.startsWith('.') ? icon.substring(1) : icon;
                return <i aria-hidden="true" className={`ms-Icon ${cssClass.includes('ms-Icon') ? cssClass : `ms-Icon--${cssClass}`}`} style={{ fontSize: effectiveIconFontSize, color: iconColor }} />;
              }
              return null;
            })()}
            {config.showChoiceValue && (
              <span
                className="lops-mcb-label"
                style={{
                  fontSize: sizeStyles.labelFontSize,
                  lineHeight: sizeStyles.labelLineHeight,
                  // The selected tile's label is always bold regardless of Make font bold --
                  // that setting only controls whether the *unselected* tiles are also bold,
                  // since the selected tile needs to read as emphasized either way.
                  fontWeight: (config.makeFontBold || isSelected) ? 600 : 400,
                  color: contentColor,
                  textAlign: isRowLayout ? 'left' : 'center',
                  width: isRowLayout ? 'auto' : '100%',
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

        if (!config.showSelectedOnly && description && description.trim() !== "") {
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
