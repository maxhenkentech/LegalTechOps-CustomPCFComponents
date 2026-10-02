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
  - [🔍 Advanced LookUp Component](#-advanced-lookup-component)
  - [⚡ Quick Action Buttons Component](#-quick-action-buttons-component)
  - [🔖 Advanced Multi Choice Component](#-advanced-multi-choice-component)
  - [✅ Advanced Yes/No Component](#-advanced-yesno-component)
  - [🔗 Advanced Multi LookUp Component](#-advanced-multi-lookup-component)
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

This solution currently contains the following custom components. All of them follow your model-driven app's modern [custom theme](https://learn.microsoft.com/power-apps/maker/model-driven-apps/modern-theme-overrides) font and respect read-only fields. Each has its own full documentation page under [`docs/`](docs/) covering features, properties, configuration steps, and use cases - the summaries below keep just a short description and the main screenshot for each.

### 🔽 Advanced Dropdown Component

An enhanced dropdown control that extends the standard Power Platform choice field with advanced visual customization options, including color coding, custom icons, and flexible sizing. The selected option is shown as the same tinted chip Advanced LookUp, Advanced Multi Choice and Advanced Yes/No use, so they look like one family on a form.

<img src="Screenshots/AdvancedDropDown/Hero.gif" alt="Advanced Dropdown Overview" width="50%">

*The selected option as a tinted chip, with the options list open and an icon from each option's External Value.*

📖 **[Full documentation](docs/AdvancedDropDown.md)** - features, properties, the External Value icon system, using your own image web resources as icons, and the [complete 1,800+ icon reference](FLUENT_ICONS.md).

---

### 🎯 Risk Matrix Component

An interactive risk assessment matrix that allows users to plot and visualize risk items based on Impact and Probability ratings.

<img src="Screenshots/RiskMatrix/Hero.png" alt="Risk Matrix Overview" width="50%">

*A 5x5 grid in the Huge size with custom axis labels (Severity, Likelihood) and the risk level shown above the grid.*

📖 **[Full documentation](docs/RiskMatrix.md)** - grid sizes, labels, colors, and properties.

---

### 📄 PDF Gallery Component

A dataset control that replaces a standard subgrid with a tabbed (or sidebar) PDF viewer - one tab per related record, rendered using the browser's own native PDF viewer (scroll, search, zoom, print) inside a responsive, A4-proportioned preview pane.

<img src="Screenshots/PDFGallery/Hero.png" alt="PDF Gallery Overview" width="50%">

*Horizontal style: one tab per related document above the browser's own PDF viewer, with open and download buttons.*

📖 **[Full documentation](docs/PDFGallery.md)** - layout styles, action buttons, the File Column fallback chain, previewing web-location links, and how to configure the underlying subgrid relationship.

---

### 🌳 Relationship View Component

A field control, bound directly to a self-referential lookup (e.g. "Parent Contract"), that replaces the field with the record's full ancestor/descendant hierarchy - one continuous tree, rendered inline on the form, with each row expandable into a live Quick View panel.

<img src="Screenshots/RelationshipView/Hero.png" alt="Relationship View Overview" width="50%">

*A contract hierarchy from the Master Services Agreement down to a Change Order, with picture thumbnails, reference and status lines and state pills.*

📖 **[Full documentation](docs/RelationshipView.md)** - tree depth, sister records, Quick View panel, thumbnails, and properties.

---

### 📝 Markdown Help Text Component

A field control that renders Markdown as formatted, visually polished help text on a form - point it at a Single Line or Multiple Lines of Text column, or type static Markdown directly into a design-time property when no backing column is wanted.

<img src="Screenshots/MarkdownHelpText/Hero.png" alt="Example rendering" width="50%">

*Headings, alert callouts, a table, a numbered list and colored text rendered from a Multiple Lines of Text column.*

📖 **[Full documentation](docs/MarkdownHelpText.md)** - full Markdown syntax gallery, Dynamic Field Tags, Font Coloring, and properties.

---

### 🔘 Modern Choice Buttons Component

A field control that replaces a standard choice field with a horizontal row of clickable tiles - one per option, each showing an MDL2 icon above the option's own label - instead of a dropdown list.

<img src="Screenshots/ModernChoiceButtons/Hero.gif" alt="Modern Choice Buttons Overview" width="50%">

*Four layouts of the same choice column: faded choice colors, large tiles in full choice color, small tiles with the icon on the left, and icons only.*

📖 **[Full documentation](docs/ModernChoiceButtons.md)** - tile size/shape, color modes, icon format reference, using your own image web resources as icons, and properties.

---

### 🔍 Advanced LookUp Component

A field control that replaces a standard lookup field with a searchable, type-to-filter dropdown - type to search live Dataverse records, with a per-record icon (from a picture column, an MDL2 icon-name column, or a fixed icon) and a hover tooltip on the selected value.

<img src="Screenshots/AdvancedLookUp/Hero.gif" alt="Advanced LookUp Overview" width="50%">

*Live, server-side search with per-record icons from an image column and a smaller context line (`Additional Display Columns`) under each name.*

📖 **[Full documentation](docs/AdvancedLookUp.md)** - icon column modes, search/sort/display columns, and properties.

---

### ⚡ Quick Action Buttons Component

A field control that is not bound to any single field's value - it renders up to 5 configurable icon+label buttons, and clicking one writes a maker-configured set of field values onto the current form (field values only by default; an opt-in setting can save the record afterward), with support for Power Automate-style expressions (string/math/date functions, `coalesce`, `me()`) alongside plain literal values, including lookup and multi-select choice targets.

<img src="Screenshots/QuickActionButtons/Hero.png" alt="Quick Action Buttons Overview" width="50%">

*Four layouts of the same five buttons: white, per-button background color, small with the icon on the left, and icons only.*

📖 **[Full documentation](docs/QuickActionButtons.md)** - Actions JSON format, the expression function reference, color modes, and properties.

---

### 🔖 Advanced Multi Choice Component

A field control that replaces a standard multi-select choice field with a searchable checkbox list, showing the selected options as colored, removable pills or chips - each with an icon from the option's External Value (an MDL2 icon or an image web resource, with semicolon-separated fallbacks) and its description as a tooltip. Search matches option descriptions as well as labels, and an Autofit sort arranges the selected options into as few lines as possible.

<img src="Screenshots/AdvancedMultiChoice/Hero.gif" alt="Advanced Multi Choice Overview" width="50%">

*Selected options as pills in their faded choice colors, with the checkbox list open - each option with its multi-color web resource or MDL2 icon.*

📖 **[Full documentation](docs/AdvancedMultiChoice.md)** - icon fallback chains, pills vs text display, color modes, Autofit sorting, and properties.

---

### ✅ Advanced Yes/No Component

A field control that replaces a standard Yes/No field with one of nine modern styles - a checkbox, a toggle, a labeled switch, radio buttons, two buttons, a segmented field, a toggle button, a status chip or an icon button. The icons for Yes and No are set on the control (Yes/No columns have no External Values), with optional Yes and No colors, fill or fixed widths, and the same field look as the other Advanced controls.

<img src="Screenshots/AdvancedYesNo/Hero.gif" alt="Advanced Yes/No Overview" width="50%">

*The nine display styles, with check and cancel badges, custom icons (a star, a flag, a lock, colorful web resources) and per-control Yes and No colors.*

📖 **[Full documentation](docs/AdvancedYesNo.md)** - display styles, icons, colors, fixed width, and properties.

---

### 🔗 Advanced Multi LookUp Component

A control for many-to-many (N:N) relationships: placed on an N:N subgrid, it shows the related records as removable pills or chips in a searchable field - the Advanced Multi Choice look with Advanced LookUp's live search, additional search and display columns, and per-record icons (pictures, MDL2 icons, choice icons, or icons from a related record). Each record's name opens the record, and ticking or removing a record adds or removes the relationship straight away.

<img src="Screenshots/AdvancedMultiLookUp/Hero.gif" alt="Advanced Multi LookUp Overview" width="50%">

*Related matters as pills with their pictures, and the search list open - each record with a client and status line from `Additional Display Columns`.*

📖 **[Full documentation](docs/AdvancedMultiLookUp.md)** - subgrid setup, search/display/label/tooltip/icon columns, relationship detection, and properties.

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

   # For Advanced LookUp component
   cd src/AdvancedLookUp
   npm install
   cd ../..

   # For Quick Action Buttons component
   cd src/QuickActionButtons
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
│   ├── AdvancedLookUp/         # Advanced LookUp PCF component
│   │   ├── AdvancedLookUp/
│   │   │   ├── index.ts       # Main component logic
│   │   │   ├── AdvancedLookUpControl.tsx # React component
│   │   │   ├── ControlManifest.Input.xml
│   │   │   └── CSS/           # Component stylesheets
│   │   ├── package.json
│   │   └── pcfconfig.json
│   ├── QuickActionButtons/     # Quick Action Buttons PCF component
│   │   ├── QuickActionButtons/
│   │   │   ├── index.ts       # Main component logic
│   │   │   ├── QuickActionButtonsControl.tsx # React component
│   │   │   ├── ExpressionEngine.ts # Power Automate-style expression parser/evaluator
│   │   │   ├── XrmFieldAccess.ts # Xrm.Page read/write + type coercion
│   │   │   ├── TestModeData.ts # Test-harness fake current-record fixture
│   │   │   ├── ControlManifest.Input.xml
│   │   │   └── CSS/           # Component stylesheets
│   │   ├── package.json
│   │   └── pcfconfig.json
│   ├── AdvancedMultiChoice/    # Advanced Multi Choice PCF component
│   │   ├── AdvancedMultiChoice/
│   │   │   ├── index.ts       # Main component logic
│   │   │   ├── AdvancedMultiChoiceControl.tsx # React component
│   │   │   ├── TestModeData.ts # Test-harness fake options + multi-color web resource icons
│   │   │   ├── ControlManifest.Input.xml
│   │   │   └── CSS/           # Component stylesheets
│   │   ├── package.json
│   │   └── pcfconfig.json
│   ├── AdvancedYesNo/          # Advanced Yes/No PCF component
│   │   ├── AdvancedYesNo/
│   │   │   ├── index.ts       # Main component logic
│   │   │   ├── AdvancedYesNoControl.tsx # React component (all display styles)
│   │   │   ├── TestModeData.ts # Test-harness labels, sample icons and colors
│   │   │   ├── ControlManifest.Input.xml
│   │   │   └── CSS/           # Component stylesheets
│   │   ├── package.json
│   │   └── pcfconfig.json
│   ├── AdvancedMultiLookUp/    # Advanced Multi LookUp PCF component (dataset control, N:N subgrid)
│   │   ├── AdvancedMultiLookUp/
│   │   │   ├── index.ts       # Main component logic, dataset and form-record wiring
│   │   │   ├── AdvancedMultiLookUpControl.tsx # React component
│   │   │   ├── Dataverse.ts   # Web API helpers: metadata, N:N associate/disassociate, icon columns
│   │   │   ├── TestModeData.ts # Test-harness fake related records
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

### Version 9.0.0.0 (Current)
A new component, Advanced Multi LookUp, for many-to-many relationships, plus faster icons and pictures and a related-choice icon fix.

#### 🔗 Advanced Multi LookUp Component (NEW)
- **NEW**: Control for N:N subgrids - the related records as removable pills or text chips in a searchable field, with Advanced LookUp's live search, additional search and display columns, label, tooltip and icon columns.
- **NEW**: Each record's name opens the record; ticking or removing a record adds or removes the relationship immediately; the relationship is detected from the subgrid; read-only, new-record and theme-font aware.

#### 🔍 Advanced LookUp Component
- **FIX**: Icons from a Choice column on a related record (`lookupfield.choicecolumn`) now appear.
- **IMPROVED**: Pictures use Dataverse's cached image links and appear with the results; faster start with a session metadata cache.

#### 🌳 Relationship View, 📄 PDF Gallery, 📝 Markdown Help Text
- **IMPROVED**: Cached image links for Relationship View thumbnails; table information reused within the session (refreshed every 5 minutes).

See [CHANGELOG.md](CHANGELOG.md) for full details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### MIT License Summary
- ✅ Commercial use allowed
- ✅ Modification allowed
- ✅ Distribution allowed
- ✅ Private use allowed
- ❌ No liability or warranty provided
