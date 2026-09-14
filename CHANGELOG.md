[← Back to main README](README.md)

# Changelog

## Version 7.2.2.0 (Current)
#### 🔍 Advanced LookUp Component
- **NEW**: `Icon Column` now accepts `<lookup field>.<column>` dot notation to pull the icon from a related record a lookup field on the target table points to, instead of only a column on the target table itself - works for all three icon source types (Image, MDL2 icon-name text, Choice)
- **NEW**: `Additional Search Columns` now supports lookup columns - a lookup entry is matched against the primary name of the record it points to (e.g. searching by a related Account's name), instead of being rejected
- **FIX**: The field no longer accepted searches or selections while set to Read Only on the form
- **FIX**: The results dropdown could silently fail to appear once a search narrowed results, on any field where `Label Column` shows something other than the target table's true primary name - typing text that matched what was on screen found no results, because the search itself was never checking that column
- **FIX**: A search typed into the field and then abandoned (clicked away without picking a result) could leave a stale filter in place - reopening the field showed the same narrowed results again instead of the full list, even though the field itself looked empty

## Version 7.0.0.0 (Previous)
#### 🔍 Advanced LookUp Component (NEW)
- **NEW**: Field control bound to a lookup field that replaces the standard lookup dialog with a searchable, type-to-filter dropdown backed by live, debounced Dataverse search
- **NEW**: `Icon Column` supports three sources for a per-record icon - a picture (Image) column, a text column holding an MDL2 icon name per record, or a fixed literal MDL2 icon name shown for every record - plus support for an image web resource as the icon
- **NEW**: `Tooltip Column` shows a column's value as a hover tooltip on the currently selected value
- **NEW**: `Additional Search Columns` searches extra columns beyond the target table's primary name column; `Additional Display Columns` shows a semicolon-separated list of columns as smaller context text under each result, with every column type supported (Choice, Lookup, Currency, dates, numbers, and more)
- **NEW**: `Show Inactive Records` toggle, configurable `Result Limit` per search (10 by default), `Component Height` (Tall/Short), configurable placeholder text, and a clear ("x") affordance to reset the value

#### ⚡ Quick Action Buttons Component (NEW)
- **NEW**: Field control that is **not bound to any single field's value** - it renders up to 5 independently configured icon+label buttons instead, each with its own Label, Icon, Accent color, Tooltip, and an `Actions` JSON map (`{"<target field>": "<value or @{expression}>", ...}`)
- **NEW**: Clicking a button writes the resolved values onto the **current form** via `Xrm.Page`, exactly as if a user edited those fields directly; an opt-in `Save record on click` property saves the record afterward (off by default)
- **NEW**: A Power Automate-style expression language for computed values (`@{...}`) - string (`concat`/`toUpper`/`toLower`/`trim`/`substring`/`replace`/`length`), math (`add`/`sub`/`mul`/`div`/`mod`/`min`/`max`/`abs`/`round`), date (`utcNow`/`addDays`/`addToTime`/`formatDateTime`/`ticks`/etc.), `coalesce`, `guid()`, `rand(min, max)`, and `me()` for the current user
- **NEW**: Lookup target fields (`@{field}`, `me()`, or a literal `{"id":...,"entityType":...}`) and multi-select choice target fields are both supported, alongside plain text/number/date/choice targets
- **NEW**: `Icon position` (Above/Below/Left/Right) and `Reflow behaviour` (Wrap/Flexible) properties, per-button Accent color with independent background/border/icon color modes, Button shape (Square/Rounded), Button size (Small/Normal/Large), and a brief "just clicked" color flash as click confirmation
- **NEW**: An on-screen error panel names exactly which field or expression failed on a real-form click, instead of only logging to the browser console

#### 🎨 Advanced Dropdown Component
- **NEW**: An icon value can now be the name of an **image web resource** in the environment instead of an MDL2 icon name, accepted by the `Icon` property and an option's `External Value` alike

#### 🎛️ Modern Choice Buttons Component
- **NEW**: `Icon position` property - place each tile's icon Above (default), Below, Left, or Right of its label
- **NEW**: `Show selection option only` property - shows just the currently selected tile, sized to fit, with all others hidden
- **NEW**: `Reflow behaviour` property - `Wrap` (default) keeps every tile at a fixed width, wrapping as needed; `Flexible` shrinks or grows each tile to fit its icon and label
- **NEW**: Same image web resource icon support as Advanced Dropdown

#### 📄 PDF Gallery Component
- **NEW**: `File Column(s)` now accepts a semicolon-separated fallback chain (e.g. `lops_signedpdf;lops_draftpdf;lops_externalurl`) - the first column with a value on a given record is used
- **NEW**: A fallback candidate can now be a text column holding a web location instead of a Dataverse File column - a link to a PDF renders inline in the native viewer, any other page gets a best-effort embedded preview with an "Open Page" fallback

#### 🌳 Relationship View Component
- **NEW**: `Thumbnail Column` now also accepts a Choice/Picklist column (showing the selected option's icon), a literal MDL2 icon name, or `<lookup field>.<column>` dot notation to pull a picture/icon from a related record
- **NEW**: `Thumbnail Icon Color Mode` property colors any icon-based thumbnail using the selected option's own color (as the icon or as a background fill) or a fixed dark/light grey

#### 📝 Markdown Help Text Component
- **FIX**: Alert callouts (`[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) now render with their own distinct icon/color instead of all falling back to the generic `Note` style

## Version 6.0.0 (Previous)
#### 📝 Markdown Help Text Component (NEW)
- **NEW**: Field control that renders Markdown as formatted, visually polished help text on a form, via `react-markdown` + `remark-gfm` + `rehype-highlight` - headings, emphasis, lists, links, images, blockquotes, tables, task lists, strikethrough, and syntax-highlighted fenced code blocks
- **NEW**: GitHub-style alert callouts (`[!NOTE]`/`[!TIP]`/`[!IMPORTANT]`/`[!WARNING]`/`[!CAUTION]`)
- **NEW**: Dynamic Field Tags (`{!fieldLogicalName}` and `{!lookupField:targetField}`) that pull live, type-aware formatted values from the current record or a related record directly into the rendered text
- **NEW**: Font Coloring via sanitized `<span style="color/background-color">` spans - every other HTML tag, attribute, and script vector is stripped before rendering
- **NEW**: Two content sources - bind `Text Column` for dynamic, per-record content, or set static `Markdown Text` at design time when no backing column is wanted
- **NEW**: Configurable `Callout Text Layout` (same line/new line) and `Line Spacing`; text scales automatically with the form's own text size using relative (em) units

#### 🔘 Modern Choice Buttons Component (NEW)
- **NEW**: Field control that replaces a standard choice field with a horizontal row of icon+label tiles instead of a dropdown list, one tile per option, wrapping automatically as needed
- **NEW**: Full MDL2 icon support - a default icon for every tile, or a per-option JSON icon map, using the same icon-name/Unicode/CSS-class resolution as Advanced Dropdown
- **NEW**: `Use external value for icon` - per-option icons sourced from each option's own Dataverse `External Value` field, fetched directly from the Web API
- **NEW**: Independent Background & Border color modes (custom hex color or the choice option's own configured color), plus configurable Not-Selected/Hover/Selected colors
- **NEW**: `Tile Shape` (Square/Rounded) and `Tile Size` (Small/Normal/Large)
- **NEW**: `Icon Color Scope` (AllTiles/SelectedOnly), with automatic light/dark contrast for tiles not using Icon color mode
- **NEW**: Hidden Options Control and Value/Text sorting, same as Advanced Dropdown

## Version 5.0.0 (Previous)
#### 🌳 Relationship View Component (NEW)
- **NEW**: Field control bound to a self-referential lookup that renders the record's full ancestor/descendant tree inline on the form, with SVG connector lines and an expandable Quick View panel per row
- **NEW**: Configurable ancestor/descendant walk depth (`Max Parent Levels`/`Max Child Levels`), each independently unlimited, disabled, or capped to a specific number of levels
- **NEW**: `Sister Record Display` property - show records sharing the same parent, optionally including their own descendant trees, applied at every level of the ancestor chain
- **NEW**: Same-level sorting by any column (`Sort By Column`/`Sort Direction`), ascending or descending
- **NEW**: Live Quick View panel that mirrors a real Quick View Form's (or Main Form's) tab/column/section layout, including type-aware formatting for Money, DateTime, Choice, and clickable Lookup fields
- **NEW**: Inline Image and PDF preview callouts inside the Quick View panel, with full original-resolution image loading
- **NEW**: `Choice Color Display` property for Choice fields in the Quick View panel (None/Circle/Pill/Font)
- **NEW**: Active/Inactive state pills (`Show State`), with an option to exclude inactive branches from the tree entirely (`Show Inactive Records`)
- **NEW**: Up to three custom attribute columns per row, plus a flexible thumbnail (Image column or MDL2 icon-name column) with 3 frame shapes and 7 fill modes
- **NEW**: Configurable indentation and current-record highlight color

## Version 4.0.0 (Previous)
#### 📄 PDF Gallery Component (NEW)
- **NEW**: Dataset control that replaces a subgrid with a tabbed or sidebar PDF viewer - one entry per related record, rendered with the browser's own native PDF viewer inside a responsive, A4-proportioned preview pane
- **NEW**: `Style` property with **Horizontal** (tabs, with automatic overflow menu) and **Vertical** (scrollable sidebar list) layouts
- **NEW**: Configurable **Open Record**, **Open in New Tab**, and **Download** action buttons, each independently togglable and switchable between text+icon and icon-only+tooltip display (`showButtonLabels`)
- **NEW**: Configurable tab label truncation (`tabLabelMaxChars`) with full-name hover tooltips; the Vertical sidebar truncates based on actual available width instead of a fixed count
- **NEW**: Direct Web API file retrieval (bytes via the `$value` endpoint, file name via `retrieveRecord`) to work around Dataverse File columns not exposing either through the standard PCF dataset column API
- **NEW**: Automatically loads the full related-record set (not just a subgrid's first page), so every related document is available regardless of page size
- **NEW**: Graceful handling of non-PDF files in a configured File column - a clear message instead of a broken preview, with Download unaffected

## Version 3.5.0 (Previous)
#### 🔽 Advanced Dropdown Component
- **NEW**: **Direct Web API Fetch Implementation**. The component now bypasses the client-side metadata limitations by querying the Dataverse Web API directly. This ensures that the **External Value** property is always available for icons, even when the standard PCF SDK hides it.
- **NEW**: **Robust Entity Resolution**. Improved logic to correctly identify the current entity and attribute name across various form contexts (Quick Create, Main Forms, Subgrids).
- **ENHANCED**: Completely removed debug logging from production builds.
- **FIX**: Resolved issues where the "External Value" was returned as `undefined` in modern Power Apps environments.

## Version 3.2.1 (Previous)
#### 🔽 Advanced Dropdown Component
- **FIX**: Resolved solution import failure caused by invalid characters (single quotes) in manifest `description-key` (XSD `noAposStringType` violation).

## Version 3.2.0
- **NEW**: Support for **External Value Icons**. Use the choice's "External Value" field to specify a Fluent UI icon name.
- **NEW**: Added `UseExternalValueForIcon` configuration property to toggle the feature.
- **NEW**: Enhanced icon validation and fallback logic.

## Version 3.1.0 (Previous - Risk Matrix Expansion)
#### 🎯 Risk Matrix Component
- **NEW**: Support for **5x5** and **6x6** grid sizes for more granular risk assessments
- **NEW**: Dynamic labels including "Very Low" and "Very High" for expanded grids
- **ENHANCED**: Optimized color distribution across all grid sizes (2x2 up to 6x6)
- **ENHANCED**: Improved layout stability when switching between grid sizes

> [!NOTE]
> Version numbers below this point (7.1.0, 8.1.0) predate this project's move to a single monotonic version number - they're listed in true chronological order, just not numeric order. Doesn't affect anything, just flagging it so it doesn't look like a typo.

## Version 7.1.0 (Previous - Advanced Dropdown Release)
- **ENHANCED:** Optimized bundle size from 51.4KB to 43.8KB by removing unnecessary dependencies
- **ENHANCED:** Simplified icon validation system for better performance and reliability
- **ENHANCED:** Full MDL2 icon support with comprehensive 1,800+ icon reference documentation
- **NEW:** [Complete Icon Reference with Previews](FLUENT_ICONS.md) - Browse all available icons
- **ENHANCED:** Updated documentation with accurate Microsoft Segoe UI Symbol Font references
- **FIXED:** Icon availability and validation system improvements

#### 🎯 Risk Matrix Component
- **MAINTAINED:** All existing functionality from version 1.8.0.0

## Version 8.1.0 (Previous - Documentation Version)
#### 🔽 Advanced Dropdown Component (NEW)
- **NEW:** Enhanced dropdown control with advanced visual customization options
- **NEW:** Support for the vast majority of icons from the [Microsoft Segoe UI Symbol Font](https://learn.microsoft.com/en-us/windows/apps/design/style/segoe-ui-symbol-font)
- **NEW:** Color customization system with three modes:
  - Color Icons: Circular colored indicators for each option
  - Color Borders: Colored borders around the dropdown
  - Color Backgrounds: Three intensity levels (No/Lighter/Full)
- **NEW:** Flexible component sizing (Tall/Short) for different form layouts
- **NEW:** Smart sorting options (Value/Text) with multilingual support
- **NEW:** Hidden options control for dynamic choice field management
- **NEW:** Color override system for brand consistency
- **NEW:** Typography enhancement with bold font option
- **NEW:** Cross-environment compatibility with graceful icon fallbacks
- **NEW:** Responsive design optimized for desktop and mobile Power Apps

#### 🎯 Risk Matrix Component
- **EXISTING:** Maintained all previous functionality from version 1.8.0.0

## Version 1.8.0.0
#### 🎯 Risk Matrix Component
- **NEW:** Flexible grid size configurations (2x2, 3x3, 4x4) for different risk assessment needs
- **NEW:** Dynamic risk level display at the top of the matrix showing current risk (LOW, MEDIUM, HIGH, CRITICAL)
- **NEW:** Custom axis labels - configure your own X and Y axis titles (default: "Impact" and "Probability")
- **NEW:** Granular label control with separate toggles for category labels and axis labels
- **NEW:** **Huge** size option for extra-large matrix display
- **ENHANCED:** Optimized positioning system for all grid sizes and label visibility combinations
- **ENHANCED:** Improved responsive design with grid-specific spacing adjustments
- **ENHANCED:** Professional layout optimization for all display modes (Small, Large, Huge)

## Version 1.5.0.0
#### 🎯 Risk Matrix Component
- **NEW:** Size configuration options (Small/Large) for different display contexts
- **NEW:** ShowLabels toggle to show/hide scale labels for cleaner presentation
- Enhanced marker positioning with pixel-perfect centering
- Improved responsive layout system with 4 distinct configurations
- Optimized label positioning for all size variants

## Previous Versions
#### 🎯 Risk Matrix Component
- Initial release with basic 4x4 risk matrix functionality
- Custom color configuration support
- Responsive design implementation

---

[← Back to main README](README.md)
