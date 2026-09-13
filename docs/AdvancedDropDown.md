[← Back to main README](../README.md)

# 🔽 Advanced Dropdown Component

An enhanced dropdown control that extends the standard Power Platform choice field with advanced visual customization options, including color coding, custom icons, and flexible sizing.

<img src="../Screenshots/AdvancedDropDown/AdvancedDropDown.png" alt="Advanced Dropdown Overview" width="60%">

*Modern, customizable dropdown with color coding and Fluent UI icons.*

## Features
- **Custom Icon Support**: choose from 1,801 Fluent UI MDL2 icons for option indicators - see the [complete icon reference](../FLUENT_ICONS.md) for the authoritative list of names
- **Image Web Resources as Icons**: give a prefixed web resource name (e.g. `hek_MyLogo.png`) anywhere an icon name is accepted, and the control renders that image - a logo or custom mark - beside the option instead of a font glyph
- **Color Customization**: independently color each option's icon, the dropdown's border, and its background (No/Lighter/Full intensity), sourced from the choice field's own configured colors
- **Flexible Sizing**: Tall (standard) or Short (compact) component heights
- **Smart Sorting**: sort options by numeric Value or alphabetical Text
- **Hidden Options Control**: show or hide options marked as hidden in the choice field definition
- **Typography Options**: bold font weight for better visibility
- **Color Override**: apply a single custom hex color to every option, overriding the choice field's own colors
- **Responsive Design**: optimized for both desktop and mobile Power Apps
- **Fallback System**: graceful degradation when icons fail to load in different environments

## Properties

| Property | Type | Options | Description | Default |
|----------|------|---------|-------------|---------|
| `optionsInput` | OptionSet | - | **Required.** The choice field to display as an advanced dropdown | - |
| `componentHeight` | Choice | Tall/Short | Component height: Tall (standard) or Short (compact 75% height) | Tall |
| `icon` | Text | [Fluent UI MDL2 icon name](../FLUENT_ICONS.md) or [web resource name](#using-an-image-web-resource-as-an-icon) | Icon to display for each option (e.g., "FullCircleMask", "Circle", "StatusCircleOuter") | FullCircleMask |
| `sortBy` | Choice | Value/Text | Sort options by numeric Value or alphabetical Text | Value |
| `hideHiddenOptions` | Yes/No | - | Hide options marked as hidden in the choice field definition | Yes |
| `showColorIcon` | Yes/No | - | Display colored circular icon on the left of each option. When off, MDL2 icons render black and [image web resources](#using-an-image-web-resource-as-an-icon) render in greyscale | No |
| `iconColorOverride` | Text | Hex Color | Override all option colors with custom hex color (e.g., #FF0000 or FF0000) | - |
| `showColorBorder` | Yes/No | - | Display colored border around the dropdown using the selected option's color | No |
| `showColorBackground` | Choice | No/Lighter/Full | Background color intensity: No color, Lighter (80% opacity), or Full color | No |
| `makeFontBold` | Yes/No | - | Display dropdown text in bold font weight for better readability | No |
| `useExternalValueForIcon` | Yes/No | - | Toggle to use the "External Value" field of a choice as the icon name (or [web resource name](#using-an-image-web-resource-as-an-icon)) | No |
| `placeholderText` | Text | - | Placeholder text shown when no option is selected | "---" |

## Icon Reference
The component renders icons from the **Fluent UI MDL2 web icon font** (`@fluentui/font-icons-mdl2`), which provides 1,801 named icons.

**📖 [Complete Icon Reference](../FLUENT_ICONS.md)** - the authoritative list of every supported name

**🔍 [flicon.io](https://www.flicon.io/)** - a searchable visual browser for this exact icon set; click an icon to copy its name

> ⚠️ Do **not** pick names from Microsoft's [Segoe Fluent Icons](https://learn.microsoft.com/en-us/windows/apps/design/style/segoe-fluent-icons-font) or [Segoe UI Symbol](https://learn.microsoft.com/en-us/windows/apps/design/style/segoe-ui-symbol-font) pages. Those document Windows *desktop system fonts*, not the MDL2 *web* font this control loads - only about a third of the names on the Segoe Fluent Icons page exist here, and the rest render as nothing. An unrecognised name falls back to the color indicator and logs a console warning.

Popular icon options for dropdowns include:

**Recommended Icons:**
- `FullCircleMask` - Solid filled circle (default)
- `Circle` - Outlined circle
- `StatusCircleOuter` - Status indicator circle
- `RadioBtnOn` - Radio button style
- `CircleShapeSolid` - Alternative solid circle
- `Checkbox` - Square checkbox style
- `CheckboxComposite` - Composite checkbox
- `StatusCircleCheckmark` - Circle with checkmark

**Usage Tips:**
- Use simple, recognizable shapes for best results
- Circular icons work particularly well with color customization
- Test icons in both development and production environments
- Fallback to color indicators if icons don't load

## Using an Image Web Resource as an Icon

Anywhere an icon name is accepted - the `icon` property or an option's **External Value** - you can instead give the name of an **image web resource** from this environment, and the control renders that image beside the option in place of a font glyph. This is how you put a company logo, a brand mark, or any custom artwork into the dropdown.

The control tells the two apart by the **publisher prefix**: a value beginning with a prefix and an underscore (e.g. `hek_`) is treated as a web resource name, everything else as an icon name. This is unambiguous because no MDL2 icon name contains an underscore.

```
hek_MyLogo.png              a web resource in the root
hek_/images/brand.svg       a web resource in a folder
FullCircleMask              still an MDL2 icon name
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
| **SVG** | Yes | Best choice for vector artwork - stays sharp at any size. |
| **GIF** | Yes | Animated GIFs will animate, with no way to pause them. |
| **JPG** | **No** | See the warning below. |
| **ICO** | Yes | Renders, but usually low-resolution - it's meant for favicons. |

WEBP and AVIF are not Dataverse web resource types, so they can't be uploaded as web resources at all.

> ⚠️ **Prefer a transparent background (PNG or SVG).** The option's background color varies with your `showColorBackground` setting and the selected option's own color. A JPG carries an opaque rectangle, so it will show as a visible box that clashes with whatever sits behind it. PNG and SVG let the background show through.

Note that scripts and external references inside an SVG are inert when loaded this way - irrelevant for icon artwork, but worth knowing if your file was exported with embedded interactivity.

### Sizing: use square images

> ⚠️ **Supply square images.** The icon slot is a 16x16 square box, matching the size of the MDL2 glyphs it sits alongside. A square source image fills it exactly.
>
> A non-square image is **fitted** to that box - scaled down until its longest side fits, keeping its aspect ratio, and letterboxed in the remaining space. Nothing is stretched or cropped, but a wide banner-shaped image ends up noticeably smaller than the other options' icons, so it will look inconsistent next to them. Crop your artwork to a square canvas (with transparent padding if needed) before uploading.

### Colors do not apply to web resource images

An image web resource is rendered **exactly as authored**. Unlike a font glyph, it cannot be recolored, so `iconColorOverride` and the option's own configured color have no effect on it. Choose artwork that reads against the background colors you have configured via `showColorBackground`.

The one setting that *does* affect it is **Show option color icon** (`showColorIcon`): when that is off - the setting that forces every glyph to flat black, i.e. "don't use color here" - image web resources are rendered in **greyscale** instead. Note that this removes color only; it does not lighten or invert the artwork, so a dark logo on a dark background stays hard to read.

### If the image cannot be loaded

If a web resource name doesn't resolve - misspelled, wrong prefix, not published, or not an image type - the option falls back to the standard **color indicator** circle and logs a console warning naming the URL it tried. The option is never left without an indicator.

## Color Customization Guide

**Color Sources:**
1. **Choice Field Colors**: Colors defined in the Power Platform choice field
2. **Color Override**: Single hex color applied to all options (overrides choice field colors)

**Color Applications:**
- **Icons**: Color the icon itself
- **Borders**: Apply color to the dropdown border
- **Backgrounds**: Use color as background with three intensity levels:
  - **No**: No background color (default)
  - **Lighter**: 80% opacity background for subtle effect
  - **Full**: Full color background for maximum impact

**Best Practices:**
- Use **Lighter** backgrounds for better text readability
- Combine **Color Icons** with **Color Borders** for professional appearance
- **Color Override** useful for maintaining brand consistency
- Test color combinations for accessibility compliance

## Advanced Icon Features

### Using External Value for Icons
When **Use external value for icon** is enabled, the component will attempt to load a Fluent UI icon based on the string value stored in the `External Value` field of each individual Choice (OptionSet) metadata. This allows you to have different icons for every single option in your dropdown.

<img src="../Screenshots/AdvancedDropDown/ExternalValue.png" alt="How to set External Value" width="60%">

> [!CAUTION]
> **Architectural Implications of Using the External Value Field:**
> Repurposing the `External Value` field for UI presentation (icon names) is a convenient shortcut, but it carries significant architectural trade-offs:
> - **Metadata Pollution**: The `External Value` field is semantically intended for integration codes (e.g., ERP IDs, API keys). Using it for icons mixes UI logic with data integration logic.
> - **Potential Breaking Changes**: If another system or integration (e.g., Power Automate, Logic Apps, or an external API) relies on this field for its original purpose, setting it to a Fluent UI icon name will break those integrations.
> - **Single Purpose**: You can only use the External Value field for *one* thing. If you need it for an ERP code, you cannot use it for icons.
> - **Maintenance**: Choice metadata is managed globally in Dataverse. Changing an icon requires a metadata update, not just a configuration change in the App.

### Direct Web API Fetch
*Technical Note: Unlike standard PCF controls that use the filtered client-side metadata, this component performs a direct OData fetch to the Dataverse Web API to retrieve the "External Value" property, which is normally hidden by the Power Apps runtime to optimize performance.*

## Configuring the Control

1. After importing the solution, the Advanced Dropdown control will be available in your Power Apps
2. Add the control to a form or canvas app
3. Bind the `optionsInput` property to your choice field
4. Configure visual options:
   - Set `showColorIcon` to Yes to display colored icons
   - Choose an icon name from the [Fluent UI MDL2 icon reference](../FLUENT_ICONS.md) (or browse visually at [flicon.io](https://www.flicon.io/)), or give the name of an [image web resource](#using-an-image-web-resource-as-an-icon) to use your own artwork instead
   - Enable color borders or backgrounds as needed
   - Adjust component height (Tall/Short) based on your form layout
5. **(Optional) Per-Option Icons**:
   - Enable `Use external value for icon`.
   - In Dataverse, edit your Choice metadata and enter a Fluent UI icon name (e.g., `FavoriteStar`) - or an [image web resource name](#using-an-image-web-resource-as-an-icon) (e.g., `hek_MyLogo.png`) - into the **External Value** field for each option.

## Use Cases
- Enhanced choice fields with visual indicators
- Status dropdowns with color-coded options
- Priority selectors with clear visual hierarchy
- Category selection with branded colors
- Multi-language forms with consistent iconography
- Accessible forms with improved visual cues

---

[← Back to main README](../README.md)
