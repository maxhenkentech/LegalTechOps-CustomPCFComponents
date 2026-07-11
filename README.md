# LegalTechOps Custom PCF Components

A collection of custom Power Platform Component Framework (PCF) components created by **Maximilian Henkensiefken**. These components were developed to enhance legal operations and business process management applications.

*The "LegalTechOps" name reflects the creator's role as Head of Legal Technologies and Operations at Amadeus IT Group SA.*

## Table of Contents

- [About](#about)
- [Components](#components)
  - [🔽 Advanced Dropdown Component](#-advanced-dropdown-component)
  - [🎯 Risk Matrix Component](#-risk-matrix-component)
  - [📄 PDF Gallery Component](#-pdf-gallery-component)
- [Author](#author)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Support](#support)
- [Release Notes](#release-notes)
- [License](#license)

## About

These components are designed to solve common business challenges through innovative Power Platform solutions. While originally developed for legal operations contexts, they can be adapted for various business applications requiring similar functionality.

## Components

This solution currently contains the following custom components:

### 🔽 Advanced Dropdown Component

An enhanced dropdown control that extends the standard Power Platform choice field with advanced visual customization options, including color coding, custom icons, and flexible sizing.

![Advanced Dropdown Overview](Screenshots/Advanced%20Dropdown/AdvancedDropDown.png)
*Modern, customizable dropdown with color coding and Fluent UI icons.*

#### Features
- **Custom Icon Support**: Choose from the vast majority of icons in the [Microsoft Segoe UI Symbol Font](https://learn.microsoft.com/en-us/windows/apps/design/style/segoe-ui-symbol-font) for option indicators
  - **📖 [Browse All 1,800+ Available Icons](FLUENT_ICONS.md)** - Complete reference with previews
- **Color Customization**: 
  - **Color Icons**: Display colored circular indicators for each option
  - **Color Borders**: Apply option colors as borders around the dropdown
  - **Color Backgrounds**: Use option colors as backgrounds (No/Lighter/Full intensity)
- **Flexible Sizing**: Choose between Tall (standard) and Short (compact) component heights
- **Smart Sorting**: Sort options by Value (numeric) or Text (alphabetical)
- **Hidden Options Control**: Show or hide options marked as hidden in the choice field
- **Typography Options**: Make font bold for better visibility
- **Color Override**: Apply a single custom color to all options using hex values
- **Responsive Design**: Optimized for both desktop and mobile Power Apps
- **Fallback System**: Graceful degradation when icons fail to load in different environments

#### Properties

| Property | Type | Options | Description | Default |
|----------|------|---------|-------------|---------|
| `optionsInput` | OptionSet | - | **Required.** The choice field to display as an advanced dropdown | - |
| `componentHeight` | Choice | Tall/Short | Component height: Tall (standard) or Short (compact 75% height) | Tall |
| `icon` | Text | [Segoe UI Symbol Font](https://learn.microsoft.com/en-us/windows/apps/design/style/segoe-ui-symbol-font) | Icon to display for each option (e.g., "FullCircleMask", "Circle", "StatusCircleOuter") | FullCircleMask |
| `sortBy` | Choice | Value/Text | Sort options by numeric Value or alphabetical Text | Value |
| `hideHiddenOptions` | Yes/No | - | Hide options marked as hidden in the choice field definition | Yes |
| `showColorIcon` | Yes/No | - | Display colored circular icon on the left of each option | No |
| `iconColorOverride` | Text | Hex Color | Override all option colors with custom hex color (e.g., #FF0000 or FF0000) | - |
| `showColorBorder` | Yes/No | - | Display colored border around the dropdown using the selected option's color | No |
| `showColorBackground` | Choice | No/Lighter/Full | Background color intensity: No color, Lighter (80% opacity), or Full color | No |
| `makeFontBold` | Yes/No | - | Display dropdown text in bold font weight for better readability | No |
| `useExternalValueForIcon` | Yes/No | - | Toggle to use the "External Value" field of a choice as the icon name | No |

#### Icon Reference
The component supports the vast majority of icons from the [Microsoft Segoe UI Symbol Font](https://learn.microsoft.com/en-us/windows/apps/design/style/segoe-ui-symbol-font). 

**📖 [Complete Icon Reference with Previews](FLUENT_ICONS.md)** - Browse all 1,800+ available icons

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

#### Color Customization Guide

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

#### Use Cases
- **Enhanced choice fields** with visual indicators
- **Status dropdowns** with color-coded options
- **Priority selectors** with clear visual hierarchy
- **Category selection** with branded colors
- **Multi-language forms** with consistent iconography
- **Accessible forms** with improved visual cues

### 💡 Advanced Icon Features

#### Using External Value for Icons
When **Use external value for icon** is enabled, the component will attempt to load a Fluent UI icon based on the string value stored in the `External Value` field of each individual Choice (OptionSet) metadata. This allows you to have different icons for every single option in your dropdown.

![How to set External Value](Screenshots/Advanced%20Dropdown/externalValue.png)

> [!CAUTION]
> **Architectural Implications of Using the External Value Field:**
> Repurposing the `External Value` field for UI presentation (icon names) is a convenient shortcut, but it carries significant architectural trade-offs:
> - **Metadata Pollution**: The `External Value` field is semantically intended for integration codes (e.g., ERP IDs, API keys). Using it for icons mixes UI logic with data integration logic.
> - **Potential Breaking Changes**: If another system or integration (e.g., Power Automate, Logic Apps, or an external API) relies on this field for its original purpose, setting it to a Fluent UI icon name will break those integrations.
> - **Single Purpose**: You can only use the External Value field for *one* thing. If you need it for an ERP code, you cannot use it for icons.
> - **Maintenance**: Choice metadata is managed globally in Dataverse. Changing an icon requires a metadata update, not just a configuration change in the App.

#### Direct Web API Fetch
*Technical Note: Unlike standard PCF controls that use the filtered client-side metadata, this component performs a direct OData fetch to the Dataverse Web API to retrieve the "External Value" property, which is normally hidden by the Power Apps runtime to optimize performance.*

---

### 🎯 Risk Matrix Component

An interactive risk assessment matrix that allows users to plot and visualize risk items based on Impact and Probability ratings.

<img src="Screenshots/Risk%20Matrix/4x4%20ootb.png" alt="Risk Matrix with Labels" height="180px"> <img src="Screenshots/Risk%20Matrix/2x2%20custom.png" alt="Risk Matrix without Labels" height="180px">

*Risk Matrix component showing standard configuration with labels (left) and clean presentation without category labels (right)*

<img src="Screenshots/Risk%20Matrix/3x3%20custom.png" alt="Custom 3x3 Matrix" height="180px"> <img src="Screenshots/Risk%20Matrix/6x6%20ootb.png" alt="Custom 6x6 Matrix" height="180px">

*Modern pill-style risk indicator with dynamic color-coding (left) and expanded 6x6 grid configuration (right)*

#### Features
- **Flexible Grid Sizes**: Choose from 2x2, 3x3, 4x4, 5x5, or 6x6 grid configurations to match your risk assessment needs
- **Dynamic Risk Labels**: Real-time risk level display at the top of the matrix (LOW, MEDIUM, HIGH, CRITICAL)
- **Custom Axis Labels**: Configurable X and Y axis labels (default: "Impact" and "Probability")
- **Multiple Size Options**: Choose between Small (compact), Large (detailed), and Huge (extra-large) display modes
- **Granular Label Control**: 
  - **Show Category Labels**: Toggle scale labels (Low, Medium, High, Critical) visibility
  - **Show Axis Labels**: Toggle axis title labels (Impact/Probability) visibility
- **Customizable Colors**: Configurable color schemes for different risk levels (Low, Medium, High, Critical)
- **Real-time Updates**: Dynamic risk positioning and labeling based on Impact and Probability values
- **Responsive Design**: Optimized layout with precise positioning for all size and grid configurations
- **Visual Feedback**: Clear indication of risk levels through color coding and smooth hover effects
- **Professional Styling**: Modern Fluent UI design system with smooth transitions

#### Properties
| Property | Type | Range | Description | Default |
|----------|------|-------|-------------|---------|
| `Impact` | Number | 1-2, 1-3, 1-4, 1-5 or 1-6 | Impact level of the risk item (range depends on grid size) | - |
| `Probability` | Number | 1-2, 1-3, 1-4, 1-5 or 1-6 | Probability level of the risk item (range depends on grid size) | - |
| `Size` | Choice | Small/Large/Huge | Matrix size: Small (compact), Large (detailed), or Huge (extra-large) | Small |
| `GridSize` | Choice | 2x2/3x3/4x4/5x5/6x6 | Grid configuration: 2x2, 3x3, 4x4, 5x5, or 6x6 matrix | 4x4 |
| `ShowCategoryLabels` | Yes/No | - | Show or hide scale labels (Low, Medium, High, Critical) | Yes |
| `ShowAxisLabels` | Yes/No | - | Show or hide axis title labels (Impact/Probability) | Yes |
| `ShowRiskLabel` | Yes/No | - | Show or hide current risk level label at top of matrix | Yes |
| `ImpactLabel` | String | - | Custom label for the Y-axis (vertical) | "Impact" |
| `ProbabilityLabel` | String | - | Custom label for the X-axis (horizontal) | "Probability" |
| `LowColor` | String | Hex Color | Color for low-risk areas | #107c10 |
| `MediumColor` | String | Hex Color | Color for medium-risk areas | #faa06b |
| `HighColor` | String | Hex Color | Color for high-risk areas | #ff8c00 |
| `CriticalColor` | String | Hex Color | Color for critical-risk areas | #d13438 |

#### Use Cases
- Legal risk assessments
- Compliance monitoring
- Project risk evaluation
- Strategic planning sessions
- Risk reporting dashboards

---

### 📄 PDF Gallery Component

A dataset control that replaces a standard subgrid with a tabbed (or sidebar) PDF viewer - one tab per related record, rendered using the browser's own native PDF viewer (scroll, search, zoom, print) inside a responsive, A4-proportioned preview pane.

<img src="Screenshots/PDF%20Gallery/Horizontal-Overview.png" alt="PDF Gallery - Horizontal style" height="320px"> <img src="Screenshots/PDF%20Gallery/Vertical-Overview.png" alt="PDF Gallery - Vertical style" height="320px">

*Horizontal style with tabs above the preview (left) and Vertical style with a scrollable document list beside the preview (right).*

![PDF Gallery overflow menu](Screenshots/PDF%20Gallery/Horizontal-OverflowMenu.png)
*When there are more documents than fit in the tab row, they automatically collapse into a "..." overflow menu.*

<img src="Screenshots/PDF%20Gallery/ButtonLabels-On.png" alt="Show Button Labels: On" width="440"> <img src="Screenshots/PDF%20Gallery/ButtonLabels-Off-Tooltip.png" alt="Show Button Labels: Off, icon-only with hover tooltip" width="180">

*`Show Button Labels` toggles between text+icon buttons (left) and compact icon-only buttons with a hover tooltip (right).*

#### Features
- **Native Browser PDF Preview**: renders each related PDF using the browser's own built-in viewer - no bundled PDF renderer, so scroll, in-document search, zoom, and print all work exactly as they do for any PDF opened directly in the browser
- **Two Layout Styles**: `Horizontal` tabs above the preview (with an automatic overflow menu once tabs stop fitting) or `Vertical` - a scrollable document list beside the preview, ideal for narrower form sections
- **Full Related-Record Loading**: automatically pages through the *entire* related-record set rather than just the subgrid's first page, so documents don't silently disappear when a subgrid's page size is small
- **Configurable Action Buttons**: independently toggle **Open Record** (navigate to the underlying Dataverse form), **Open in New Tab**, and **Download** - each shown with a label or as a compact icon with a hover tooltip
- **Truncated Tab Labels**: configurable character limit for horizontal tab labels, always paired with the full document name as a hover tooltip; Vertical style truncates based on the sidebar's actual available width instead of a fixed count
- **A4-Proportioned Preview**: the preview pane keeps a 210:297 aspect ratio and scales responsively to whatever space the maker allocates on the form, rather than a hardcoded pixel size
- **Direct Web API File Retrieval**: Dataverse File columns never expose their bytes or file name through the standard PCF dataset column API, so this component fetches both directly from the Dataverse Web API (see technical note below)
- **Graceful Handling of Non-PDF Files**: if a configured File column happens to hold something other than a PDF, the component detects it (via file signature) and shows a clear "can't be previewed here" message instead of a broken viewer - Download still works normally, and Open in New Tab is safely disabled for that document
- **Test Harness Support**: ships with representative fake documents and an embedded sample PDF, so the control can be developed and previewed with `npm start` without a live Dataverse connection

#### Properties

| Property | Type | Options | Description | Default |
|----------|------|---------|-------------|---------|
| `documents` | Dataset | - | **Required.** The related records to display - bind this by configuring the subgrid's relationship and view, exactly as you would for a normal subgrid (see [Configuring the Relationship](#configuring-the-relationship) below) | - |
| `fileColumnName` | Text | - | **Required.** Logical (schema) name of the File column on the related table that holds the PDF, e.g. `lops_pdffile` | - |
| `tabLabelColumnName` | Text | - | Optional logical name of the column to use as the document label. Defaults to the file's own name when left blank | - |
| `allowDownload` | Yes/No | - | Show or hide the Download button | Yes |
| `showButtonLabels` | Yes/No | - | Show text labels on the action buttons. When off, only icons are shown, with the label available as a hover tooltip | No |
| `tabLabelMaxChars` | Number | - | Maximum characters shown per tab label (Horizontal style only) before truncating with an ellipsis. The full name is always available as a hover tooltip | 15 |
| `allowOpenRecord` | Yes/No | - | Show an **Open Record** button that navigates to the Dataverse form for the record currently displayed in the viewer | No |
| `style` | Choice | Horizontal/Vertical | Layout of the document selector: tabs above the preview, or a scrollable list beside the preview | Horizontal |

#### Configuring the Relationship

Unlike the other two components, PDF Gallery is a **dataset** control - it replaces a subgrid's rendering rather than binding to a single field. Add it to a form exactly like a normal subgrid:

1. Add a **Subgrid** component to the form.
2. Under **Records**, select the 1:N relationship to the child table that stores the PDFs (**not** an unfiltered/generic view of that table - it must be the relationship-filtered "Related Records" option, otherwise every row in the child table will show up regardless of which parent record you're on).
3. Under **Components**, add **PDF Gallery** and set `fileColumnName` to the logical name of the child table's File column.

> [!NOTE]
> **Why file bytes and names need a separate fetch:** A Dataverse **File column** (the dedicated File data type, distinct from Notes/Attachments) cannot be retrieved through a dataset's normal `getValue`/column API - that only ever returns an opaque file ID, never the bytes or the display name. This component works around that by calling the Dataverse Web API directly: `GET /api/data/v9.2/<entitySetName>(<id>)/<fileColumnLogicalName>/$value` for the bytes, and `context.webAPI.retrieveRecord` for the automatically-generated `<fileColumn>_name` companion column. The entity's collection name (`EntitySetName`) is resolved once per session and cached. This is the same "bypass the PCF SDK, call the Web API directly" technique the Advanced Dropdown component uses for its External Value icons.

#### Use Cases
- Contract or legal document review panels
- Evidence/attachment galleries on case or matter records
- Any 1:N relationship where the related table stores a PDF in a Dataverse File column and a plain row-based subgrid isn't the experience you want

---

*Additional components will be added to this collection as they are developed.*

## Author

**Maximilian Henkensiefken**  
*Head of Legal Technologies and Operations*  
*Amadeus IT Group SA*

These components were created to address real-world business challenges encountered in legal operations and technology management. The solutions are designed to be flexible and adaptable for various business contexts beyond their original use cases.

## Installation

### Option 1: Download from Releases (Recommended)

**📥 [Download Latest Release](https://github.com/maxhenkentech/LegalTechOps-CustomPCFComponents/releases/latest)**

Visit the [Releases page](https://github.com/maxhenkentech/LegalTechOps-CustomPCFComponents/releases) to download the latest solution packages.

Choose the appropriate solution package for your needs:

- **`LegalTechOpsCustomComponents.zip`** - **Unmanaged Solution**
  - Use for development environments
  - Allows customization and modification
  - Can be exported and modified further

- **`LegalTechOpsCustomComponents_managed.zip`** - **Managed Solution** 
  - Use for production environments
  - Provides better security and stability
  - Cannot be modified after import

#### Import Steps:
1. Download the appropriate solution package from the [Releases page](https://github.com/maxhenkentech/LegalTechOps-CustomPCFComponents/releases)
2. Import the solution into your Power Platform environment:
   - Go to Power Apps > Solutions
   - Click "Import solution"
   - Select the downloaded ZIP file
   - Follow the import wizard

### Option 2: Build from Source

#### Prerequisites
- [Node.js](https://nodejs.org/) (version 12.x or later)
- [.NET SDK](https://dotnet.microsoft.com/download) (version 5.0 or later)
- [Power Platform CLI](https://docs.microsoft.com/en-us/powerapps/developer/data-platform/powerapps-cli)

#### Build Steps

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd LegalTechOpsCustomComponents
   ```

2. Install dependencies:
   ```bash
   # For Advanced Dropdown component
   cd src/AdvancedDropDown
   npm install
   cd ../..
   
   # For Risk Matrix component
   cd src/RiskMatrix
   npm install
   cd ../..

   # For PDF Gallery component
   cd src/PDFGallery
   npm install
   cd ../..
   ```

3. Build the component:
   ```bash
   cd ../../
   dotnet build --configuration Release
   ```

4. The packaged solution will be available at `bin/Release/LegalTechOpsCustomComponents.zip`

## Usage

### Advanced Dropdown Component
1. After importing the solution, the Advanced Dropdown control will be available in your Power Apps
2. Add the control to a form or canvas app
3. Bind the `optionsInput` property to your choice field
4. Configure visual options:
   - Set `showColorIcon` to Yes to display colored icons
   - Choose an icon from the [Microsoft Segoe UI Symbol Font](https://learn.microsoft.com/en-us/windows/apps/design/style/segoe-ui-symbol-font)
   - Enable color borders or backgrounds as needed
   - Adjust component height (Tall/Short) based on your form layout
5. **(Optional) Per-Option Icons**:
   - Enable `Use external value for icon`.
   - In Dataverse, edit your Choice metadata and enter a Fluent UI icon name (e.g., `FavoriteStar`) into the **External Value** field for each option.

### Risk Matrix Component
1. After importing the solution, the Risk Matrix control will be available in your Power Apps
2. Add the control to a form or canvas app
3. Bind the Impact and Probability properties to your data fields
4. Optionally customize the risk colors and select the desired matrix size (Small, Large, or Huge) using the `Size` property

### PDF Gallery Component
1. After importing the solution, add a **Subgrid** component to a form (this is a dataset control, not a field-bound one)
2. Under **Records**, pick the 1:N relationship to the child table storing the PDFs (must be the relationship-filtered option, not a generic view)
3. Under **Components**, add **PDF Gallery**
4. Set `fileColumnName` to the logical name of the child table's File column
5. Configure the optional properties as needed:
   - `tabLabelColumnName` to label documents by a specific column instead of the file name
   - `style` to choose `Horizontal` (tabs) or `Vertical` (sidebar list)
   - `allowOpenRecord`, `allowDownload`, `showButtonLabels`, and `tabLabelMaxChars` to tune the action buttons and tab labels

## Development

### Project Structure
```
├── src/
│   ├── AdvancedDropDown/      # Advanced Dropdown PCF component
│   │   ├── AdvancedDropDown/
│   │   │   ├── index.ts       # Main component logic
│   │   │   ├── AdvancedOptionsControl.tsx # React component
│   │   │   ├── DropdownStyles.ts # Styling configuration
│   │   │   ├── ControlManifest.Input.xml
│   │   │   └── CSS/           # Component stylesheets
│   │   ├── package.json
│   │   └── pcfconfig.json
│   ├── RiskMatrix/            # Risk Matrix PCF component
│   │   ├── RiskMatrix/
│   │   │   ├── index.ts       # Main component logic
│   │   │   └── ControlManifest.Input.xml
│   │   ├── package.json
│   │   └── pcfconfig.json
│   ├── PDFGallery/             # PDF Gallery PCF component (dataset control)
│   │   ├── PDFGallery/
│   │   │   ├── index.ts       # Main component logic, dataset wiring
│   │   │   ├── PDFGalleryControl.tsx # React component
│   │   │   ├── TestModeData.ts # Test-harness fake documents + sample PDF
│   │   │   ├── ControlManifest.Input.xml
│   │   │   └── CSS/           # Component stylesheets
│   │   ├── package.json
│   │   └── pcfconfig.json
│   └── Other/                 # Solution metadata
├── bin/Release/               # Packaged solution output
└── README.md
```

### Making Changes

1. Make your changes to the source files in component directories under `src/`
2. Test locally using `npm start` in the specific component folder (e.g., `src/AdvancedDropDown` or `src/RiskMatrix`)
3. Build the solution using the standard Power Platform CLI commands
4. Test the packaged component in your Power Platform environment

## Troubleshooting

**Common Issues:**
- Ensure you have the latest Power Platform CLI installed
- Verify that Node.js version 14 or higher is installed
- Check that all dependencies are properly installed (`npm install`)
- Confirm the solution package is imported correctly in your environment

**Error Resolution:**
- Clear browser cache and reload the app
- Check the browser console for any JavaScript errors
- Verify the component properties are configured correctly
- Ensure the Power Platform environment supports custom PCF components

## Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding new features, or improving documentation, your contributions are appreciated.

### How to Contribute
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Test thoroughly
5. Commit your changes (`git commit -m 'Add some feature'`)
6. Push to the branch (`git push origin feature/your-feature-name`)
7. Open a Pull Request

### Issues
If you encounter any issues or have suggestions for improvements, please open an issue on GitHub. We encourage:
- Bug reports with detailed reproduction steps
- Feature requests with clear use cases
- Documentation improvements
- Code optimization suggestions

## Support

**Important Notice:** These components are provided **AS IS** without any support or warranty.

**Full Disclosure:** I don't know what I'm doing - pretty much everything inside this solution and its components was created using AI assistance. While the components work and have been tested, they should be thoroughly evaluated before use in production environments.

- No official support is provided for these components
- Use at your own risk in production environments
- Community support available through GitHub issues
- Contributors may provide assistance on a voluntary basis

## Release Notes

### Version 4.0.0 (Current)
#### 📄 PDF Gallery Component (NEW)
- **NEW**: Dataset control that replaces a subgrid with a tabbed or sidebar PDF viewer - one entry per related record, rendered with the browser's own native PDF viewer inside a responsive, A4-proportioned preview pane
- **NEW**: `Style` property with **Horizontal** (tabs, with automatic overflow menu) and **Vertical** (scrollable sidebar list) layouts
- **NEW**: Configurable **Open Record**, **Open in New Tab**, and **Download** action buttons, each independently togglable and switchable between text+icon and icon-only+tooltip display (`showButtonLabels`)
- **NEW**: Configurable tab label truncation (`tabLabelMaxChars`) with full-name hover tooltips; the Vertical sidebar truncates based on actual available width instead of a fixed count
- **NEW**: Direct Web API file retrieval (bytes via the `$value` endpoint, file name via `retrieveRecord`) to work around Dataverse File columns not exposing either through the standard PCF dataset column API
- **NEW**: Automatically loads the full related-record set (not just a subgrid's first page), so every related document is available regardless of page size
- **NEW**: Graceful handling of non-PDF files in a configured File column - a clear message instead of a broken preview, with Download unaffected

### Version 3.5.0 (Previous)
#### 🔽 Advanced Dropdown Component
- **NEW**: **Direct Web API Fetch Implementation**. The component now bypasses the client-side metadata limitations by querying the Dataverse Web API directly. This ensures that the **External Value** property is always available for icons, even when the standard PCF SDK hides it.
- **NEW**: **Robust Entity Resolution**. Improved logic to correctly identify the current entity and attribute name across various form contexts (Quick Create, Main Forms, Subgrids).
- **ENHANCED**: Completely removed debug logging from production builds.
- **FIX**: Resolved issues where the "External Value" was returned as `undefined` in modern Power Apps environments.

### Version 3.2.1 (Previous)
#### 🔽 Advanced Dropdown Component
- **FIX**: Resolved solution import failure caused by invalid characters (single quotes) in manifest `description-key` (XSD `noAposStringType` violation).

### Version 3.2.0
- **NEW**: Support for **External Value Icons**. Use the choice's "External Value" field to specify a Fluent UI icon name.
- **NEW**: Added `UseExternalValueForIcon` configuration property to toggle the feature.
- **NEW**: Enhanced icon validation and fallback logic.

### Version 3.1.0 (Previous - Risk Matrix Expansion)
#### 🎯 Risk Matrix Component
- **NEW**: Support for **5x5** and **6x6** grid sizes for more granular risk assessments
- **NEW**: Dynamic labels including "Very Low" and "Very High" for expanded grids
- **ENHANCED**: Optimized color distribution across all grid sizes (2x2 up to 6x6)
- **ENHANCED**: Improved layout stability when switching between grid sizes

### Version 7.1.0 (Previous - Advanced Dropdown Release)
- **ENHANCED:** Optimized bundle size from 51.4KB to 43.8KB by removing unnecessary dependencies
- **ENHANCED:** Simplified icon validation system for better performance and reliability
- **ENHANCED:** Full MDL2 icon support with comprehensive 1,800+ icon reference documentation
- **NEW:** [Complete Icon Reference with Previews](FLUENT_ICONS.md) - Browse all available icons
- **ENHANCED:** Updated documentation with accurate Microsoft Segoe UI Symbol Font references
- **FIXED:** Icon availability and validation system improvements

#### 🎯 Risk Matrix Component
- **MAINTAINED:** All existing functionality from version 1.8.0.0

### Version 8.1.0 (Previous - Documentation Version)
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

### Version 1.8.0.0
#### 🎯 Risk Matrix Component
- **NEW:** Flexible grid size configurations (2x2, 3x3, 4x4) for different risk assessment needs
- **NEW:** Dynamic risk level display at the top of the matrix showing current risk (LOW, MEDIUM, HIGH, CRITICAL)
- **NEW:** Custom axis labels - configure your own X and Y axis titles (default: "Impact" and "Probability")
- **NEW:** Granular label control with separate toggles for category labels and axis labels
- **NEW:** **Huge** size option for extra-large matrix display
- **ENHANCED:** Optimized positioning system for all grid sizes and label visibility combinations
- **ENHANCED:** Improved responsive design with grid-specific spacing adjustments
- **ENHANCED:** Professional layout optimization for all display modes (Small, Large, Huge)

### Version 1.5.0.0
#### 🎯 Risk Matrix Component
- **NEW:** Size configuration options (Small/Large) for different display contexts
- **NEW:** ShowLabels toggle to show/hide scale labels for cleaner presentation
- Enhanced marker positioning with pixel-perfect centering
- Improved responsive layout system with 4 distinct configurations
- Optimized label positioning for all size variants

### Previous Versions
#### 🎯 Risk Matrix Component
- Initial release with basic 4x4 risk matrix functionality
- Custom color configuration support
- Responsive design implementation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### MIT License Summary
- ✅ Commercial use allowed
- ✅ Modification allowed
- ✅ Distribution allowed
- ✅ Private use allowed
- ❌ No liability or warranty provided
