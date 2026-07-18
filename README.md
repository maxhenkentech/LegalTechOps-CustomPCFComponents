# LegalTechOps Custom PCF Components

A collection of custom Power Platform Component Framework (PCF) components created by **Maximilian Henkensiefken**. These components were developed to enhance legal operations and business process management applications.

*The "LegalTechOps" name reflects the creator's role as Head of Legal Technologies and Operations at Amadeus IT Group SA.*

## Table of Contents

- [About](#about)
- [Components](#components)
  - [🔽 Advanced Dropdown Component](#-advanced-dropdown-component)
  - [🎯 Risk Matrix Component](#-risk-matrix-component)
  - [📄 PDF Gallery Component](#-pdf-gallery-component)
  - [🌳 Relationship View Component](#-relationship-view-component)
  - [📝 Markdown Help Text Component](#-markdown-help-text-component)
  - [🔘 Modern Choice Buttons Component](#-modern-choice-buttons-component)
- [Author](#author)
- [Installation](#installation)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Support](#support)
- [Release Notes](#release-notes)
- [License](#license)

## About

These components are designed to solve common business challenges through innovative Power Platform solutions. While originally developed for legal operations contexts, they can be adapted for various business applications requiring similar functionality.

## Components

This solution currently contains the following custom components. Each has its own full documentation page under [`docs/`](docs/) covering features, properties, configuration steps, and use cases - the summaries below keep just a short description and the main screenshot for each.

### 🔽 Advanced Dropdown Component

An enhanced dropdown control that extends the standard Power Platform choice field with advanced visual customization options, including color coding, custom icons, and flexible sizing.

<img src="Screenshots/AdvancedDropDown/AdvancedDropDown.png" alt="Advanced Dropdown Overview" width="50%">

*Modern, customizable dropdown with color coding and Fluent UI icons.*

📖 **[Full documentation](docs/AdvancedDropDown.md)** - features, properties, the External Value icon system, and the [complete 1,800+ icon reference](FLUENT_ICONS.md).

---

### 🎯 Risk Matrix Component

An interactive risk assessment matrix that allows users to plot and visualize risk items based on Impact and Probability ratings.

<img src="Screenshots/RiskMatrix/4x4-Default.png" alt="Risk Matrix with Labels" height="234px"> <img src="Screenshots/RiskMatrix/2x2-NoLabels.png" alt="Risk Matrix without Labels" height="234px">

*Risk Matrix component showing standard configuration with labels (left) and clean presentation without category labels (right)*

📖 **[Full documentation](docs/RiskMatrix.md)** - grid sizes, labels, colors, and properties.

---

### 📄 PDF Gallery Component

A dataset control that replaces a standard subgrid with a tabbed (or sidebar) PDF viewer - one tab per related record, rendered using the browser's own native PDF viewer (scroll, search, zoom, print) inside a responsive, A4-proportioned preview pane.

<img src="Screenshots/PDFGallery/Horizontal-Overview.png" alt="PDF Gallery - Horizontal style" height="416px"> <img src="Screenshots/PDFGallery/Vertical-Overview.png" alt="PDF Gallery - Vertical style" height="416px">

*Horizontal style with tabs above the preview (left) and Vertical style with a scrollable document list beside the preview (right).*

📖 **[Full documentation](docs/PDFGallery.md)** - layout styles, action buttons, and how to configure the underlying subgrid relationship.

---

### 🌳 Relationship View Component

A field control, bound directly to a self-referential lookup (e.g. "Parent Contract"), that replaces the field with the record's full ancestor/descendant hierarchy - one continuous tree, rendered inline on the form, with each row expandable into a live Quick View panel.

![Relationship View - Full Tree with Quick View](Screenshots/RelationshipView/Tree-FullDetail.png)
*The complete ancestor chain and descendant tree in a single view, including sister records (other Order Forms sitting alongside the same Statement of Work) and an expanded Quick View panel for the selected row.*

📖 **[Full documentation](docs/RelationshipView.md)** - tree depth, sister records, Quick View panel, thumbnails, and properties.

---

### 📝 Markdown Help Text Component

A field control that renders Markdown as formatted, visually polished help text on a form - point it at a Single Line or Multiple Lines of Text column, or type static Markdown directly into a design-time property when no backing column is wanted.

<img src="Screenshots/MarkdownHelpText/ExampleRendering.png" alt="Example rendering" width="75%">

*Alert callouts, Dynamic Field Tags, Font Coloring, tables, and images, all rendered together.*

📖 **[Full documentation](docs/MarkdownHelpText.md)** - full Markdown syntax gallery, Dynamic Field Tags, Font Coloring, and properties.

---

### 🔘 Modern Choice Buttons Component

A field control that replaces a standard choice field with a horizontal row of clickable tiles - one per option, each showing an MDL2 icon above the option's own label - instead of a dropdown list.

<img src="Screenshots/ModernChoiceButtons/PCF%20Gallery%20Screenshot.png" alt="Modern Choice Buttons Overview" width="75%">

*Icon + label tiles across circled-number, symbol, and full-color selected styles - the official PCF Gallery listing screenshot.*

📖 **[Full documentation](docs/ModernChoiceButtons.md)** - tile size/shape, color modes, icon format reference, and properties.

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
1. Download the appropriate solution package (managed or unmanaged) from the [Releases page](https://github.com/maxhenkentech/LegalTechOps-CustomPCFComponents/releases)
2. In Power Apps, go to **Solutions** > **Import solution** and select the downloaded ZIP file
3. Open the table's form (or view, for PDF Gallery) in the form editor
4. Select the field (or add a subgrid for PDF Gallery) > **Components** > **+ Component** > **More components**, then add the desired component from this solution
5. Configure the component's properties and publish

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

   # For Relationship View component
   cd src/RelationshipView
   npm install
   cd ../..

   # For Markdown Help Text component
   cd src/MarkdownHelpText
   npm install
   cd ../..

   # For Modern Choice Buttons component
   cd src/ModernChoiceButtons
   npm install
   cd ../..
   ```

3. Build the component:
   ```bash
   cd ../../
   dotnet build --configuration Release
   ```

4. The packaged solution will be available at `bin/Release/LegalTechOpsCustomComponents.zip`

Step-by-step configuration for each component (binding, properties, and any component-specific setup like PDF Gallery's subgrid relationship) lives in that component's own doc under [`docs/`](docs/) - see the [Components](#components) section above for links.

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
│   ├── RelationshipView/       # Relationship View PCF component
│   │   ├── RelationshipView/
│   │   │   ├── index.ts       # Main component logic
│   │   │   ├── RelationshipViewControl.tsx # React component
│   │   │   ├── TestModeData.ts # Test-harness fake hierarchy
│   │   │   ├── ControlManifest.Input.xml
│   │   │   └── CSS/           # Component stylesheets
│   │   ├── package.json
│   │   └── pcfconfig.json
│   ├── MarkdownHelpText/       # Markdown Help Text PCF component
│   │   ├── MarkdownHelpText/
│   │   │   ├── index.ts       # Main component logic
│   │   │   ├── MarkdownHelpTextControl.tsx # React component (react-markdown pipeline)
│   │   │   ├── AlertCallout.tsx # GitHub-style [!NOTE]/[!TIP]/etc. callout renderer
│   │   │   ├── remarkAlertCallouts.ts # Custom remark plugin for alert callout syntax
│   │   │   ├── TestModeData.ts # Test-harness sample Markdown
│   │   │   ├── ControlManifest.Input.xml
│   │   │   └── CSS/           # Component stylesheets
│   │   ├── package.json
│   │   └── pcfconfig.json
│   ├── ModernChoiceButtons/    # Modern Choice Buttons PCF component
│   │   ├── ModernChoiceButtons/
│   │   │   ├── index.ts       # Main component logic
│   │   │   ├── ModernChoiceButtonsControl.tsx # React component
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

Full version history lives in [CHANGELOG.md](CHANGELOG.md).

### Version 6.0.0 (Current)
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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### MIT License Summary
- ✅ Commercial use allowed
- ✅ Modification allowed
- ✅ Distribution allowed
- ✅ Private use allowed
- ❌ No liability or warranty provided
