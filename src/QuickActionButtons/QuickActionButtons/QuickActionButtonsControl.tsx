/** @jsx React.createElement */
import * as React from 'react';
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { Icon } from "@fluentui/react/lib/Icon";
import { getIcon } from "@fluentui/react/lib/Styling";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";
import { EvalContext, ExprValue, FieldReader, LookupRef, resolveActionValue, validateActionsJson } from "./ExpressionEngine";

initializeIcons();

export interface IButtonConfig {
  key: number;
  label: string;
  icon: string;
  color?: string;
  tooltip?: string;
  actionsRaw?: string;
}

export interface IConfig {
  saveOnClick: boolean;
  tileShape: "Square" | "Rounded";
  tileSize: "Small" | "Normal" | "Large";
  showLabel: boolean;
  iconPosition: "Above" | "Below" | "Left" | "Right";
  reflowBehaviour: "Wrap" | "Flexible";
  makeFontBold: boolean;
  backgroundMode: "Fixed" | "PerButtonColor";
  buttonColor: string;
  hoverColor: string;
  activeColor: string;
  borderMode: "Off" | "Fixed" | "PerButtonColor";
  borderColor: string;
  iconColorMode: "Auto" | "Fixed" | "PerButtonColor";
  iconColor: string;
}

export type WriteFieldFn = (fieldName: string, value: ExprValue) => { ok: boolean; error?: string };

interface IActionResult {
  field: string;
  ok: boolean;
  value?: ExprValue;
  error?: string;
}

export type SaveRecordFn = () => Promise<{ ok: boolean; error?: string }>;

interface IQuickActionButtonsProperties {
  buttons: IButtonConfig[];
  isDisabled: boolean;
  config: IConfig;
  formAvailable: boolean;
  readField: FieldReader;
  writeField: WriteFieldFn;
  fieldExists: (fieldName: string) => boolean;
  getCurrentUser: () => LookupRef | null;
  saveRecord: SaveRecordFn;
  testMode: boolean;
}

// ---- Icon resolution -- duplicated from ModernChoiceButtonsControl.tsx / AdvancedOptionsControl.tsx
// (identical detection rules), per this repo's no-shared-code-between-controls convention. The
// "de-emphasized/greyscale" variant those controls have doesn't apply here -- there's no
// selected/unselected duality for action buttons, so that piece is intentionally left out. ----

const WEB_RESOURCE_NAME_PATTERN = /^[a-z][a-z0-9]{1,7}_/i;
const getWebResourceUrl = (iconName: string): string => `/WebResources/${encodeURI(iconName.trim())}`;

const validateAndGetIcon = (iconName: string): { isValid: boolean; iconType: 'webresource' | 'mdl2' | 'unicode' | 'css' | 'unknown' } => {
  if (!iconName || iconName.trim() === '' || iconName === 'undefined') {
    return { isValid: false, iconType: 'unknown' };
  }

  const cleanIconName = iconName.trim();

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

const isRegisteredMdl2Icon = (iconName: string): boolean => {
  try {
    return getIcon(iconName) !== undefined;
  } catch {
    return false;
  }
};

const warnedIconNames = new Set<string>();
const FALLBACK_MDL2_ICON = 'RadioBtnOff';

const resolveMdl2IconName = (requested: string): string | null => {
  if (isRegisteredMdl2Icon(requested)) return requested;

  if (!warnedIconNames.has(requested)) {
    warnedIconNames.add(requested);
    console.warn(
      `[lops.QuickActionButtons] Icon "${requested}" is not an MDL2 icon name and cannot be rendered. ` +
      `See FLUENT_ICONS.md for the full list of supported names.`
    );
  }

  return isRegisteredMdl2Icon(FALLBACK_MDL2_ICON) ? FALLBACK_MDL2_ICON : null;
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

interface IWebResourceIconProps {
  iconName: string;
  size: string;
  renderFallback: () => React.ReactElement | null;
}

const WebResourceIcon = ({ iconName, size, renderFallback }: IWebResourceIconProps): React.ReactElement | null => {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => setFailed(false), [iconName]);

  if (failed) return renderFallback();

  return (
    <img
      src={getWebResourceUrl(iconName)}
      alt=""
      aria-hidden="true"
      onError={() => {
        console.warn(
          `[lops.QuickActionButtons] Web resource "${iconName}" could not be loaded from ` +
          `${getWebResourceUrl(iconName)} -- falling back to the default icon.`
        );
        setFailed(true);
      }}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
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

// ---- Size table (mirrors ModernChoiceButtons') ----

const ICON_FONT_SIZE = '22px';
// Used only for the compact-height case (Small + Left/Right + label shown, see applyCompactHeight
// below) -- the fixed 32px row height doesn't leave enough room for real visible padding around
// the full 22px icon without either the icon overflowing the box or padding shrinking back to
// where it reads as no padding at all. Shrinking the icon itself is what actually buys the
// breathing room the padding alone couldn't.
const COMPACT_ICON_FONT_SIZE = '18px';
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

// Icon position is only meaningful relative to the label -- with showLabel off there's a single
// centered child regardless of direction, so no separate "centered" case is needed here.
const ICON_POSITION_FLEX_DIRECTION: Record<IConfig['iconPosition'], 'column' | 'column-reverse' | 'row' | 'row-reverse'> = {
  Above: 'column',
  Below: 'column-reverse',
  Left: 'row',
  Right: 'row-reverse',
};

// Matches the OOB Dataverse form control row height, so a Left/Right button sitting next to a
// standard field (e.g. next to a lookup's own input) lines up with it instead of standing taller.
// Only applied at Small tile size -- Normal/Large are already meant to be bigger than a field row.
const STANDARD_FIELD_HEIGHT = '32px';

const FLASH_DURATION_MS = 450;

// Applies one button's Actions JSON, best-effort per key -- a bad field name or a malformed
// expression for one key doesn't block the others, since there's no transaction concept on a
// client form anyway.
function applyButtonActions(button: IButtonConfig, ctx: EvalContext, writeField: WriteFieldFn): IActionResult[] {
  if (!button.actionsRaw || button.actionsRaw.trim() === '') return [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(button.actionsRaw);
  } catch (e) {
    const message = `Invalid Actions JSON: ${(e as Error).message}`;
    console.warn(`[lops.QuickActionButtons] Button "${button.label}" -- ${message}`);
    return [{ field: '(JSON)', ok: false, error: message }];
  }

  const results: IActionResult[] = [];
  for (const [field, rawValue] of Object.entries(parsed)) {
    try {
      const value = resolveActionValue(rawValue, ctx);
      const result = writeField(field, value);
      if (!result.ok && result.error) {
        console.warn(`[lops.QuickActionButtons] Button "${button.label}" -- ${result.error}`);
      }
      results.push({ field, ok: result.ok, value, error: result.error });
    } catch (e) {
      const message = (e as Error).message;
      console.warn(`[lops.QuickActionButtons] Button "${button.label}", field "${field}" -- ${message}`);
      results.push({ field, ok: false, error: message });
    }
  }
  return results;
}

export const QuickActionButtonsControl = ({ buttons, isDisabled, config, formAvailable, readField, writeField, fieldExists, getCurrentUser, saveRecord, testMode }: IQuickActionButtonsProperties): React.ReactElement => {
  const [hoveredKey, setHoveredKey] = React.useState<number | null>(null);
  const [flashKey, setFlashKey] = React.useState<number | null>(null);
  const [lastApplied, setLastApplied] = React.useState<{ label: string; results: IActionResult[]; saveError?: string | null } | null>(null);

  const controlsDisabled = isDisabled || !formAvailable;
  const cornerRadius = config.tileShape === "Square" ? "2px" : "8px";
  const sizeStyles = TILE_SIZE_STYLES[config.tileSize] || TILE_SIZE_STYLES.Normal;
  const iconFontSize = config.showLabel ? ICON_FONT_SIZE : ICON_FONT_SIZE_NO_LABEL[config.tileSize];

  const onClick = (button: IButtonConfig) => {
    if (controlsDisabled) return;
    const results = applyButtonActions(button, { readField, getCurrentUser }, writeField);
    setLastApplied({ label: button.label, results, saveError: undefined });
    setFlashKey(button.key);
    window.setTimeout(() => setFlashKey((current) => (current === button.key ? null : current)), FLASH_DURATION_MS);

    // Fires strictly after every field value above has already been set -- "Save record on
    // click" is opt-in (default off) and, per its whole point, must never run before the
    // field writes it's meant to persist.
    if (config.saveOnClick) {
      saveRecord()
        .then((result) => {
          if (result.ok) return undefined;
          setLastApplied((current) => (current && current.label === button.label ? { ...current, saveError: result.error || "Save failed" } : current));
          return undefined;
        })
        .catch((e: Error) => {
          setLastApplied((current) => (current && current.label === button.label ? { ...current, saveError: e.message } : current));
        });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, button: IButtonConfig) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(button);
    }
  };

  // Validation runs on every render -- including in the form designer's own live preview, since
  // a virtual control's code executes there the same as on a real form -- so a JSON/expression
  // mistake, or a target/referenced field that doesn't exist, is visible immediately instead of
  // only after a click. Field-existence checking is skipped (fieldExists left undefined) when
  // there's no live record to check against, so "form not loaded yet" doesn't masquerade as
  // "every field is missing".
  const buttonErrors = buttons
    .map((button) => ({ button, errors: validateActionsJson(button.actionsRaw, formAvailable ? fieldExists : undefined) }))
    .filter((entry) => entry.errors.length > 0);

  if (buttonErrors.length > 0) {
    return (
      <div className="lops-qab-root">
        <div
          className="lops-qab-config-error"
          style={{
            border: '1px solid #D13438',
            borderRadius: '4px',
            padding: '10px 12px',
            backgroundColor: '#FDE7E9',
            color: '#A4262C',
            fontSize: '13px',
            fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif"
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>Quick Action Buttons: configuration error</div>
          {buttonErrors.map(({ button, errors }) => (
            <div key={button.key} style={{ marginBottom: '4px' }}>
              <strong>{button.label || `Button ${button.key}`}</strong>
              <ul style={{ margin: '2px 0 0 18px', padding: 0 }}>
                {errors.map((error, idx) => (
                  <li key={idx} style={{ fontFamily: 'monospace' }}>{error}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lops-qab-root">
      <div
        className="lops-qab-container"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', width: '100%', boxSizing: 'border-box' }}
      >
        {buttons.map((button) => {
          const isHovered = hoveredKey === button.key && !controlsDisabled;
          const isFlashing = flashKey === button.key;

          let background: string;
          if (isFlashing) {
            background = config.activeColor;
          } else if (isHovered) {
            background = config.hoverColor;
          } else if (config.backgroundMode === "PerButtonColor" && button.color) {
            background = button.color;
          } else {
            background = config.buttonColor;
          }

          let border: string;
          if (config.borderMode === "Off") {
            border = '1px solid transparent';
          } else if (config.borderMode === "PerButtonColor" && button.color) {
            border = `1px solid ${button.color}`;
          } else {
            border = `1px solid ${config.borderColor}`;
          }

          const contentColor = isColorDark(background) ? '#FFFFFF' : '#201F1E';

          let iconColor: string;
          if (config.iconColorMode === "PerButtonColor" && button.color) {
            iconColor = button.color;
          } else if (config.iconColorMode === "Fixed") {
            iconColor = config.iconColor;
          } else {
            iconColor = contentColor;
          }

          const iconValidation = validateAndGetIcon(button.icon);
          const isRowLayout = config.iconPosition === 'Left' || config.iconPosition === 'Right';
          const isFlexible = config.reflowBehaviour === 'Flexible';
          // Compact height only kicks in for Small + a row layout with the label actually shown --
          // with the label off, layout always falls back to centered/column regardless of iconPosition.
          const applyCompactHeight = config.tileSize === 'Small' && isRowLayout && config.showLabel;
          // v1.3.1's first nudge (3px vertical / +2px horizontal) wasn't visibly different enough
          // against the fixed 32px height. v1.3.2 goes further on both padding *and* shrinks the
          // icon itself (COMPACT_ICON_FONT_SIZE) -- padding alone can't grow much more at a fixed
          // 32px height without the full-size 22px icon starting to overflow the box.
          const effectiveIconFontSize = applyCompactHeight ? COMPACT_ICON_FONT_SIZE : iconFontSize;
          const compactHorizontalPadding = `${parseInt(sizeStyles.padding.split(' ')[1] || sizeStyles.padding, 10) + 4}px`;

          const tile = (
            <button
              key={button.key}
              type="button"
              disabled={controlsDisabled}
              title={!formAvailable ? "Cannot access the current form" : (button.tooltip || button.label)}
              onClick={() => onClick(button)}
              onKeyDown={(e) => onKeyDown(e, button)}
              onMouseEnter={() => setHoveredKey(button.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className="lops-qab-tile"
              style={{
                display: 'flex',
                flexDirection: config.showLabel ? ICON_POSITION_FLEX_DIRECTION[config.iconPosition] : 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: sizeStyles.gap,
                minWidth: isFlexible ? undefined : sizeStyles.minWidth,
                maxWidth: isFlexible ? undefined : sizeStyles.maxWidth,
                padding: applyCompactHeight ? `5px ${compactHorizontalPadding}` : sizeStyles.padding,
                height: applyCompactHeight ? STANDARD_FIELD_HEIGHT : undefined,
                boxSizing: 'border-box',
                borderRadius: cornerRadius,
                border,
                backgroundColor: background,
                color: contentColor,
                cursor: controlsDisabled ? 'default' : 'pointer',
                opacity: controlsDisabled ? 0.6 : 1,
                transition: 'background-color 0.15s ease-in-out, border-color 0.15s ease-in-out',
                fontFamily: "'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif"
              }}
            >
              {iconValidation.isValid && (() => {
                const renderFallback = (): React.ReactElement | null => {
                  const resolved = resolveMdl2IconName(FALLBACK_MDL2_ICON);
                  if (!resolved) return null;
                  return <Icon iconName={resolved} aria-hidden="true" styles={{ root: { fontSize: effectiveIconFontSize, color: iconColor } }} />;
                };

                if (iconValidation.iconType === 'webresource') {
                  return <WebResourceIcon iconName={button.icon.trim()} size={effectiveIconFontSize} renderFallback={renderFallback} />;
                }
                if (iconValidation.iconType === 'mdl2') {
                  const resolvedIconName = resolveMdl2IconName(button.icon.trim());
                  if (!resolvedIconName) return null;
                  return <Icon iconName={resolvedIconName} aria-hidden="true" styles={{ root: { fontSize: effectiveIconFontSize, color: iconColor } }} />;
                }
                if (iconValidation.iconType === 'unicode') {
                  const unicodeChar = convertToUnicodeChar(button.icon);
                  if (unicodeChar) {
                    return (
                      <span aria-hidden="true" style={{ fontFamily: 'Segoe MDL2 Assets, Segoe UI Symbol, Symbols', fontSize: effectiveIconFontSize, lineHeight: effectiveIconFontSize, color: iconColor }}>
                        {unicodeChar}
                      </span>
                    );
                  }
                }
                if (iconValidation.iconType === 'css') {
                  const cssClass = button.icon.startsWith('.') ? button.icon.substring(1) : button.icon;
                  return <i aria-hidden="true" className={`ms-Icon ${cssClass.includes('ms-Icon') ? cssClass : `ms-Icon--${cssClass}`}`} style={{ fontSize: effectiveIconFontSize, color: iconColor }} />;
                }
                return null;
              })()}
              {config.showLabel && (
                <span
                  className={`lops-qab-label${config.makeFontBold ? ' lops-qab-label--bold' : ''}`}
                  style={{
                    fontSize: sizeStyles.labelFontSize,
                    lineHeight: sizeStyles.labelLineHeight,
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
                  {button.label}
                </span>
              )}
            </button>
          );

          if (button.tooltip && button.tooltip.trim() !== "") {
            return (
              <TooltipHost key={button.key} content={button.tooltip} delay={1} directionalHint={3}>
                {tile}
              </TooltipHost>
            );
          }
          return tile;
        })}
      </div>
      {testMode && lastApplied && (
        <div className="lops-qab-debug-panel" style={{ marginTop: '12px', padding: '8px 10px', border: '1px dashed #a19f9d', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Test mode -- last actions applied (&quot;{lastApplied.label}&quot;)</div>
          {lastApplied.results.length === 0 && <div>(no actions configured)</div>}
          {lastApplied.results.map((r, idx) => (
            <div key={idx} style={{ color: r.ok ? '#107C10' : '#D13438' }}>
              {r.field} = {r.ok ? JSON.stringify(r.value) : `ERROR: ${r.error}`}
            </div>
          ))}
          {config.saveOnClick && (
            <div style={{ color: lastApplied.saveError ? '#D13438' : '#107C10', marginTop: '4px' }}>
              {lastApplied.saveError ? `Save: ERROR: ${lastApplied.saveError}` : '(test mode) Save: simulated'}
            </div>
          )}
        </div>
      )}
      {!testMode && lastApplied && lastApplied.results.some((r) => !r.ok) && (
        <div
          className="lops-qab-runtime-error"
          style={{
            marginTop: '8px',
            padding: '8px 10px',
            border: '1px solid #D13438',
            borderRadius: '4px',
            backgroundColor: '#FDE7E9',
            color: '#A4262C',
            fontSize: '12px'
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '2px' }}>&quot;{lastApplied.label}&quot; did not fully apply:</div>
          {lastApplied.results.filter((r) => !r.ok).map((r, idx) => (
            <div key={idx} style={{ fontFamily: 'monospace' }}>{r.field}: {r.error}</div>
          ))}
        </div>
      )}
      {!testMode && lastApplied && lastApplied.saveError && (
        <div
          className="lops-qab-runtime-error"
          style={{
            marginTop: '8px',
            padding: '8px 10px',
            border: '1px solid #D13438',
            borderRadius: '4px',
            backgroundColor: '#FDE7E9',
            color: '#A4262C',
            fontSize: '12px'
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '2px' }}>&quot;{lastApplied.label}&quot; set the field values, but the save afterward failed:</div>
          <div style={{ fontFamily: 'monospace' }}>{lastApplied.saveError}</div>
        </div>
      )}
      {!formAvailable && !testMode && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#D13438' }}>
          Cannot access the current form (Xrm.Page unavailable) -- buttons are disabled.
        </div>
      )}
    </div>
  );
};
