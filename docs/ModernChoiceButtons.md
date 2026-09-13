[← Back to main README](../README.md)

# 🔘 Modern Choice Buttons Component

A field control that replaces a standard choice field with a horizontal row of clickable tiles - one per option, each showing an MDL2 icon above the option's own label - instead of a dropdown list.

<img src="../Screenshots/ModernChoiceButtons/PCF%20Gallery%20Screenshot.png" alt="Modern Choice Buttons Overview" width="60%">

*Icon + label tiles across circled-number, symbol, and full-color selected styles - the official PCF Gallery listing screenshot.*

## Features
- **Icon + Label Tiles**: every option renders as a tile with an icon above its literal choice-set label, wrapping to a new row automatically when there isn't enough horizontal space
- **Full MDL2 Icon Support**: a default icon for every tile, or a per-option JSON map (`{"<value>":{"icon":"IconName"}}`), the same icon-name/Unicode/CSS-class resolution AdvancedDropDown uses
- **External Value as Icon Source**: enable `Use external value for icon` to have each option's own `External Value` field (fetched directly from the Dataverse Web API, bypassing the PCF SDK) supply its icon name - the same technique and trade-offs as Advanced Dropdown's equivalent feature
- **Image Web Resources as Icons**: give a prefixed web resource name (e.g. `hek_MyLogo.png`) anywhere an icon name is accepted, and the control renders that image - a logo or custom mark - on the tile instead of a font glyph; greyscaled on unselected tiles when Icon color scope is Selected tile only
- **Independent Background & Border Color Modes**: the selected tile's background and border are each independently configurable - a custom hex color, or the choice option's own configured color - with the border able to be turned off entirely
- **Configurable Not-Selected / Hover / Selected Colors**: hex color properties for a tile's resting, hovered, and (custom-mode) selected background
- **Icon Position**: place the icon Above (default), Below, Left, or Right of the label. Has no effect when `showChoiceValue` is off, since the icon is always centered in that case. At Tile size Small with Left/Right, the tile's height is also fixed to match a standard out-of-the-box Dataverse field row, so it lines up cleanly next to an adjacent field
- **Reflow Behaviour**: `Wrap` (default) keeps every tile at a fixed width, wrapping onto a new row once they no longer fit; `Flexible` shrinks or grows each tile to exactly fit its icon and label instead
- **Tile Shape**: Square or Rounded corners
- **Tile Size**: Small, Normal, or Large - adjusts tile padding and label text size while keeping the icon itself a fixed size
- **Icon Color Scope**: apply Icon color mode to every tile's icon, or only the selected tile's icon (other tiles then use automatic contrast)
- **Automatic Contrast**: icon and label color switch between light and dark automatically based on the tile's current background
- **Hidden Options & Sorting**: hide options marked hidden in the choice field, and sort tiles by Value or Text, same as Advanced Dropdown
- **Show Selection Option Only**: collapse the row down to a single, non-interactive tile showing just the current value - useful for a read-only summary or a compact display where a full row of clickable tiles isn't wanted. The canvas shrinks to fit that one tile instead of stretching full width, and hovering/clicking is disabled. If no value is currently selected, a small "No value" placeholder is shown instead of an empty space

### Tile Size

<img src="../Screenshots/ModernChoiceButtons/Small.png" alt="Tile Size: Small" width="68%">

*Small*

<img src="../Screenshots/ModernChoiceButtons/Normal.png" alt="Tile Size: Normal" width="90%">

*Normal (default) - tiles render about 33% larger than Small (max-width 128px vs 96px).*

<img src="../Screenshots/ModernChoiceButtons/Large.png" alt="Tile Size: Large" width="114%">

*Large - tiles render about 67% larger than Small (max-width 160px vs 96px).*

<img src="../Screenshots/ModernChoiceButtons/SmallNoValues.png" alt="Small tiles with showChoiceValue off" width="68%">

*Small tiles with `showChoiceValue` set to No - the label is hidden and the icon renders larger, centered in the tile.*

### Tile Shape

<img src="../Screenshots/ModernChoiceButtons/Square.png" alt="Tile Shape: Square" width="150px"> <img src="../Screenshots/ModernChoiceButtons/Round.png" alt="Tile Shape: Rounded" width="150px">

*`tileShape` set to Square (left) vs Rounded (right).*

### Selected Tile Color Modes

<img src="../Screenshots/ModernChoiceButtons/LargeBackgroundChoiceColor.png" alt="selectedBackgroundMode: ChoiceColor" width="348px">

*`selectedBackgroundMode` set to `ChoiceColor` - the selected tile's background uses the option's own configured choice color, at Large tile size.*

<img src="../Screenshots/ModernChoiceButtons/MediumAllIconColorBackGroundFade.png" alt="iconColorScope: AllTiles with faded background" width="68%">

*`iconColorScope` set to `AllTiles` - every tile's icon (not just the selected one) is colored, paired with a faded choice-color background.*

<img src="../Screenshots/ModernChoiceButtons/MediumSquareBorderSelectedIconChoiceColor.png" alt="Square tiles with selected border and icon using ChoiceColor" width="48.6%">

*Square tiles with `selectedBorderMode` set to `ChoiceColor` and `iconColorScope` set to `SelectedOnly` - only the selected tile's icon and border pick up the option's own color.*

## Properties

| Property | Type | Options | Description | Default |
|----------|------|---------|-------------|---------|
| `optionsInput` | OptionSet | - | **Required.** The choice field to display as a row of tiles | - |
| `showSelectedOnly` | Yes/No | - | Show only the tile for the currently selected choice, sized to fit that one tile, with hovering and clicking disabled. All other tiles are hidden | No |
| `icon` | Text | [Fluent UI MDL2 icon name](../FLUENT_ICONS.md), [web resource name](#using-an-image-web-resource-as-an-icon), or JSON | Default icon for every tile, or a JSON map of choice value to icon (e.g. `{"1":{"icon":"Accept"}}`) | RadioBtnOff |
| `useExternalValueForIcon` | Yes/No | - | Use each option's `External Value` field as its icon name (or [web resource name](#using-an-image-web-resource-as-an-icon)) instead | No |
| `hideHiddenOptions` | Yes/No | - | Hide options marked as hidden in the choice field definition | Yes |
| `sortBy` | Choice | Value/Text | Sort tiles by numeric Value or alphabetical Text | Value |
| `tileShape` | Choice | Square/Rounded | Corner shape of each tile | Rounded |
| `tileSize` | Choice | Small/Normal/Large | Overall tile size (padding, min/max width, and label text size). The icon itself stays a fixed size regardless of this setting | Normal |
| `showChoiceValue` | Yes/No | - | Show the choice option's text label under the icon. When off, the label is hidden and the icon renders larger, centered in the tile | Yes |
| `iconPosition` | Choice | Above/Below/Left/Right | Position of the icon relative to the label. No effect when `showChoiceValue` is off. At Tile size Small with Left/Right, the tile's height also matches a standard OOB field row | Above |
| `reflowBehaviour` | Choice | Wrap/Flexible | Wrap keeps each tile at a fixed width and wraps onto a new row when out of space; Flexible sizes each tile to fit its icon + label | Wrap |
| `makeFontBold` | Yes/No | - | Display every tile's label in bold font weight. The selected tile's label is always bold regardless of this setting - it only controls the unselected tiles | No |
| `notSelectedColor` | Text | Hex Color | Background color of a tile that is not selected | #FFFFFF |
| `hoverColor` | Text | Hex Color | Background color of a tile while hovered | #DEECF9 |
| `selectedBackgroundMode` | Choice | CustomColor/ChoiceColor | Whether the selected tile's background uses `selectedColor` or the option's own configured color | CustomColor |
| `selectedColor` | Text | Hex Color | Background color of the selected tile when `selectedBackgroundMode` is Custom color | #F3F2F1 |
| `selectedBorderMode` | Choice | Off/CustomColor/ChoiceColor | Whether the selected tile has a border, and whether it's a custom color or the option's own color | CustomColor |
| `selectedBorderColor` | Text | Hex Color | Border color of the selected tile when `selectedBorderMode` is Custom color | #0078D4 |
| `iconColorScope` | Choice | AllTiles/SelectedOnly | Whether Icon color mode is applied to every tile's icon, or only the selected tile's icon (other tiles then use automatic contrast, and their [image web resources](#using-an-image-web-resource-as-an-icon) are greyscaled and faded) | AllTiles |

## Icon Format Reference

The `icon` property (and each per-option JSON `icon` value) accepts four kinds of values:

1. **An MDL2 icon name** (e.g. `CheckMark`) - see **[FLUENT_ICONS.md](../FLUENT_ICONS.md)** for the complete, authoritative list of the 1,801 supported names, or browse them visually at **[flicon.io](https://www.flicon.io/)** (which bundles this exact icon set and lets you copy the name). A name that isn't in that set renders no icon and logs a console warning; the tile falls back to the `icon` property's default value.

   > ⚠️ Do **not** pick names from Microsoft's [Segoe Fluent Icons](https://learn.microsoft.com/en-us/windows/apps/design/style/segoe-fluent-icons-font) page. That documents the Windows 11 desktop system font, not the Fluent UI MDL2 web font this control loads - only about a third of the names on that page exist here.

2. **An image web resource name** (e.g. `hek_MyLogo.png`) - see [Using an image web resource as an icon](#using-an-image-web-resource-as-an-icon) below.
3. **A CSS icon class** (`ms-Icon`/`fabric-icon`/`icon-` prefixed, or a value starting with `.`).
4. **Any Unicode character**, entered as an escape - not limited to a fixed list, this works for any character the MDL2 icon set doesn't cover. Accepted formats: `\uXXXX`, `U+XXXX`, `&#xXXXX;`, or `0xXXXX` (4 hex digits). The character renders through the browser's own Symbol/Dingbat font fallback (`Segoe MDL2 Assets, Segoe UI Symbol, Symbols`) rather than the MDL2 icon glyph font, so it's worth a visual check on each platform/browser you support.

A few examples spanning different Unicode blocks:

| Character | Meaning | `icon` value to enter |
|---|---|---|
| ✓ | Check mark | `\u2713` |
| ✗ | Cross / X mark | `\u2717` |
| ★ | Star | `\u2605` |
| → | Right arrow | `\u2192` |
| ⚠ | Warning triangle | `\u26A0` |
| ① | Circled digit 1 | `\u2460` |

**Circled numbers 1-9** are one case worth calling out, since MDL2 has no circled-digit icons of its own. The plain style above (`\u2460` for 1, sequentially through `\u2468` for 9) is one option; the Dingbats block also has three bolder/rounder variants - `\u2776`-`\u277E` (filled, serif), `\u2780`-`\u2788` (outlined, sans-serif), and `\u278A`-`\u2792` (filled, sans-serif). The last of these gives the most modern, rounded "badge" look: ➊ ➋ ➌ ➍ ➎ ➏ ➐ ➑ ➒.

## Using an Image Web Resource as an Icon

Anywhere an icon name is accepted - the `icon` property, a per-option JSON `icon` value, or an option's **External Value** - you can instead give the name of an **image web resource** from this environment, and the control renders that image on the tile in place of a font glyph. This is how you put a company logo, a brand mark, or any custom artwork on a choice tile.

The control tells the two apart by the **publisher prefix**: a value beginning with a prefix and an underscore (e.g. `hek_`) is treated as a web resource name, everything else as an icon name. This is unambiguous because no MDL2 icon name contains an underscore.

```
hek_MyLogo.png              a web resource in the root
hek_/images/brand.svg       a web resource in a folder
CheckMark                   still an MDL2 icon name
```

**Setup:**

1. Upload your image as a web resource (**Solutions -> your solution -> New -> More -> Web resource**), with one of the image types listed below.
2. **Publish** it. An unpublished web resource cannot be loaded by the control.
3. Enter its full name, including the publisher prefix, as the icon value.

The extension isn't what makes it work - detection is based on the publisher prefix alone - so a web resource named without one loads just as well.

### Supported image formats

| Format | Transparency | Notes |
|---|---|---|
| **PNG** | Yes | The safe default for icons. |
| **SVG** | Yes | Best choice for vector artwork - stays sharp at every tile size. |
| **GIF** | Yes | Animated GIFs will animate, with no way to pause them. |
| **JPG** | **No** | See the warning below. |
| **ICO** | Yes | Renders, but usually low-resolution - it's meant for favicons. |

WEBP and AVIF are not Dataverse web resource types, so they can't be uploaded as web resources at all.

> ⚠️ **Prefer a transparent background (PNG or SVG).** A tile's background color changes between its not-selected, hover, and selected states. A JPG carries an opaque rectangle, so it will show as a visible box that clashes with the tile on at least one of those three states. PNG and SVG let the tile color show through.

**SVG is the best pick if you have vector artwork**, since it stays sharp when **Show choice value** is off and the icon renders at 28-44px. Note that scripts and external references inside an SVG are inert when loaded this way - irrelevant for icon artwork, but worth knowing if your file was exported with embedded interactivity.

### Sizing: use square images

> ⚠️ **Supply square images.** The icon slot on a tile is a square box, sized by the **Show choice value** and **Tile size** settings. A square source image fills it exactly.
>
> A non-square image is **fitted** to that box - scaled down until its longest side fits, keeping its aspect ratio, and letterboxed in the remaining space. Nothing is stretched or cropped, but a wide banner-shaped image ends up noticeably smaller than the tile's other icons, so it will look inconsistent next to them. Crop your artwork to a square canvas (with transparent padding if needed) before uploading.

### Colors do not apply to web resource images

An image web resource is rendered **exactly as authored**. Unlike a font glyph, it cannot be recolored, so **Icon color mode** and **Icon color** have no effect on it. Choose artwork that reads against the tile background colors you have configured.

The one setting that *does* affect it is **Icon color scope**:

| Icon color scope | Effect on an image web resource |
|---|---|
| **All tiles** | Every image renders in full color on every tile. |
| **Selected tile only** | The selected tile's image renders in full color; every **other** tile's image is shown **greyscaled and faded back**, so the selected choice stands out. |

That greyscale-and-fade is the image equivalent of what glyphs already do under **Selected tile only** (where unselected tiles drop back to automatic contrast). Note that it removes color and reduces prominence - it does not lighten or invert the artwork, so a dark logo on a dark tile stays hard to read.

### If the image cannot be loaded

If a web resource name doesn't resolve - misspelled, wrong prefix, not published, or not an image type - the tile falls back to the **default icon** from the `icon` property and logs a console warning naming the URL it tried. The tile is never left blank.

## Configuring the Control

Modern Choice Buttons is a **field** control, bound the same way as Advanced Dropdown - place it directly on the choice field:

1. On the table's form, select the choice (OptionSet) field.
2. Add **Modern Choice Buttons** as a component on that field.
3. Configure `icon` (or `useExternalValueForIcon`) so every option has a recognizable icon - an [MDL2 icon name](../FLUENT_ICONS.md) or an [image web resource name](#using-an-image-web-resource-as-an-icon) for your own artwork - and adjust the color/shape properties to match your form's design.
   - Set `selectedBackgroundMode`/`selectedBorderMode` to `ChoiceColor` to use each option's own configured color, or leave as `CustomColor` and tune `notSelectedColor`/`hoverColor`/`selectedColor`/`selectedBorderColor`
   - Choose `tileShape` (Square/Rounded) and `tileSize` (Small/Normal/Large) to match your form's design language
   - Set `iconColorScope` to `SelectedOnly` if you only want the selected tile's icon to pick up Icon color mode, leaving other tiles' icons at automatic contrast

**(Optional) Per-Option Icons via External Value:**

<img src="../Screenshots/ModernChoiceButtons/HowToSetExternalValueForm.png" alt="How to set External Value" width="60%">

1. Enable `Use external value for icon`.
2. In Dataverse, edit your Choice metadata and enter a Fluent UI icon name (e.g., `CheckMark`) - or an [image web resource name](#using-an-image-web-resource-as-an-icon) (e.g., `hek_MyLogo.png`) - into the **External Value** field for each option.

> [!CAUTION]
> **Architectural Implications of Using the External Value Field:**
> Repurposing the `External Value` field for UI presentation (icon names) is a convenient shortcut, but it carries significant architectural trade-offs:
> - **Metadata Pollution**: The `External Value` field is semantically intended for integration codes (e.g., ERP IDs, API keys). Using it for icons mixes UI logic with data integration logic.
> - **Potential Breaking Changes**: If another system or integration (e.g., Power Automate, Logic Apps, or an external API) relies on this field for its original purpose, setting it to a Fluent UI icon name will break those integrations.
> - **Single Purpose**: You can only use the External Value field for *one* thing. If you need it for an ERP code, you cannot use it for icons.
> - **Maintenance**: Choice metadata is managed globally in Dataverse. Changing an icon requires a metadata update, not just a configuration change in the App.

## Use Cases
- Status or stage selectors where a single click beats opening a dropdown
- Priority/severity pickers where the icon carries meaning at a glance
- Category selection on touch-friendly or tablet-oriented forms
- Any choice field where the option list is short and visual recognition matters more than a compact dropdown

---

[← Back to main README](../README.md)
