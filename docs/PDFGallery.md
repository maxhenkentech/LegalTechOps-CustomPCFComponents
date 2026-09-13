[← Back to main README](../README.md)

# 📄 PDF Gallery Component

A dataset control that replaces a standard subgrid with a tabbed (or sidebar) PDF viewer - one tab per related record, rendered using the browser's own native PDF viewer (scroll, search, zoom, print) inside a responsive, A4-proportioned preview pane.

<img src="../Screenshots/PDFGallery/Horizontal-Overview.png" alt="PDF Gallery - Horizontal style" height="320px"> <img src="../Screenshots/PDFGallery/Vertical-Overview.png" alt="PDF Gallery - Vertical style" height="320px">

*Horizontal style with tabs above the preview (left) and Vertical style with a scrollable document list beside the preview (right).*

![PDF Gallery overflow menu](../Screenshots/PDFGallery/Horizontal-OverflowMenu.png)
*When there are more documents than fit in the tab row, they automatically collapse into a "..." overflow menu.*

<img src="../Screenshots/PDFGallery/ButtonLabels-On.png" alt="Show Button Labels: On" width="440"> <img src="../Screenshots/PDFGallery/ButtonLabels-Off-Tooltip.png" alt="Show Button Labels: Off, icon-only with hover tooltip" width="180">

*`Show Button Labels` toggles between text+icon buttons (left) and compact icon-only buttons with a hover tooltip (right).*

## Features
- **Native Browser PDF Preview**: renders each related PDF using the browser's own built-in viewer - no bundled PDF renderer, so scroll, in-document search, zoom, and print all work exactly as they do for any PDF opened directly in the browser
- **File Column Fallback Chain**: `File Column(s)` accepts multiple column names separated by a semicolon (e.g. `lops_signedpdf;lops_draftpdf`) - for each document, the first listed column that actually has a value wins, falling through to the next when it doesn't. Useful when a document record might carry a signed copy in one File column and a draft in another, or a File column for some records and a web link for others
- **Web Location Preview**: a fallback candidate doesn't have to be a File column - it can also be a plain text column holding a URL. A link that points at a PDF is fetched and rendered inline exactly like a File column; a link to any other page is shown as a best-effort embedded preview, with an **Open Page** fallback card if the page can't be embedded (see [Previewing Web Location Links](#previewing-web-location-links) below for why that can happen and what to expect)
- **Two Layout Styles**: `Horizontal` tabs above the preview (with an automatic overflow menu once tabs stop fitting) or `Vertical` - a scrollable document list beside the preview, ideal for narrower form sections
- **Full Related-Record Loading**: automatically pages through the *entire* related-record set rather than just the subgrid's first page, so documents don't silently disappear when a subgrid's page size is small
- **Configurable Action Buttons**: independently toggle **Open Record** (navigate to the underlying Dataverse form), **Open in New Tab**, and **Download** - each shown with a label or as a compact icon with a hover tooltip
- **Truncated Tab Labels**: configurable character limit for horizontal tab labels, always paired with the full document name as a hover tooltip; Vertical style truncates based on the sidebar's actual available width instead of a fixed count
- **A4-Proportioned Preview**: the preview pane keeps a 210:297 aspect ratio and scales responsively to whatever space the maker allocates on the form, rather than a hardcoded pixel size
- **Direct Web API File Retrieval**: Dataverse File columns never expose their bytes or file name through the standard PCF dataset column API, so this component fetches both directly from the Dataverse Web API (see technical note below)
- **Graceful Handling of Non-PDF Files**: if a configured File column happens to hold something other than a PDF, the component detects it (via file signature) and shows a clear "can't be previewed here" message instead of a broken viewer - Download still works normally, and Open in New Tab is safely disabled for that document
- **Test Harness Support**: ships with representative fake documents and an embedded sample PDF, so the control can be developed and previewed with `npm start` without a live Dataverse connection

## Properties

| Property | Type | Options | Description | Default |
|----------|------|---------|-------------|---------|
| `documents` | Dataset | - | **Required.** The related records to display - bind this by configuring the subgrid's relationship and view, exactly as you would for a normal subgrid (see [Configuring the Relationship](#configuring-the-relationship) below) | - |
| `fileColumnName` | Text | - | **Required.** Logical (schema) name of the source column that holds the document, e.g. `lops_pdffile`. Accepts a semicolon-separated fallback chain of multiple column names (e.g. `lops_signedpdf;lops_draftpdf;lops_externalurl`) - each entry can independently be a Dataverse File column or a text column holding a web link; see [File Column Fallback Chain](#features) above | - |
| `tabLabelColumnName` | Text | - | Optional logical name of the column to use as the document label. Defaults to the file's own name when left blank | - |
| `allowDownload` | Yes/No | - | Show or hide the Download button | Yes |
| `showButtonLabels` | Yes/No | - | Show text labels on the action buttons. When off, only icons are shown, with the label available as a hover tooltip | No |
| `tabLabelMaxChars` | Number | - | Maximum characters shown per tab label (Horizontal style only) before truncating with an ellipsis. The full name is always available as a hover tooltip | 15 |
| `allowOpenRecord` | Yes/No | - | Show an **Open Record** button that navigates to the Dataverse form for the record currently displayed in the viewer | No |
| `style` | Choice | Horizontal/Vertical | Layout of the document selector: tabs above the preview, or a scrollable list beside the preview | Horizontal |

## Configuring the Relationship

Unlike the other components, PDF Gallery is a **dataset** control - it replaces a subgrid's rendering rather than binding to a single field. Add it to a form exactly like a normal subgrid:

1. Add a **Subgrid** component to the form.
2. Under **Records**, select the 1:N relationship to the child table that stores the PDFs (**not** an unfiltered/generic view of that table - it must be the relationship-filtered "Related Records" option, otherwise every row in the child table will show up regardless of which parent record you're on).
3. Under **Components**, add **PDF Gallery** and set `fileColumnName` to the logical name of the child table's File column (or a semicolon-separated fallback chain - see [File Column Fallback Chain](#features) above).

> [!NOTE]
> **Why file bytes and names need a separate fetch:** A Dataverse **File column** (the dedicated File data type, distinct from Notes/Attachments) cannot be retrieved through a dataset's normal `getValue`/column API - that only ever returns an opaque file ID, never the bytes or the display name. This component works around that by calling the Dataverse Web API directly: `GET /api/data/v9.2/<entitySetName>(<id>)/<fileColumnLogicalName>/$value` for the bytes, and `context.webAPI.retrieveRecord` for the automatically-generated `<fileColumn>_name` companion column. The entity's collection name (`EntitySetName`) is resolved once per session and cached. This is the same "bypass the PCF SDK, call the Web API directly" technique the Advanced Dropdown component uses for its External Value icons.

## Configuring the Control

1. After importing the solution, add a **Subgrid** component to a form (this is a dataset control, not a field-bound one)
2. Under **Records**, pick the 1:N relationship to the child table storing the PDFs (must be the relationship-filtered option, not a generic view)
3. Under **Components**, add **PDF Gallery**
4. Set `fileColumnName` to the logical name of the child table's File column. To fall back across multiple columns, list them separated by a semicolon in priority order, e.g. `lops_signedpdf;lops_draftpdf;lops_externalurl` - each entry can be a File column or a text column holding a web link
5. Configure the optional properties as needed:
   - `tabLabelColumnName` to label documents by a specific column instead of the file name
   - `style` to choose `Horizontal` (tabs) or `Vertical` (sidebar list)
   - `allowOpenRecord`, `allowDownload`, `showButtonLabels`, and `tabLabelMaxChars` to tune the action buttons and tab labels

## Previewing Web Location Links

A candidate in `fileColumnName` doesn't have to be a File column - it can be any plain text column that holds a URL (an absolute link, or a bare domain/path which is assumed to be `https://`). What happens next depends on what that link points at:

- **A link to a PDF** (detected from the URL's extension, its response's Content-Type, and the file's own byte signature) is fetched and rendered inline using the same native browser viewer as a File column, with Open in New Tab and Download both working normally.
- **A link to any other page** is embedded directly in the preview pane as a best-effort inline preview. If the page hasn't finished loading within a few seconds, the preview automatically falls back to an **Open Page** card instead, since many sites explicitly block being shown inside another page (via `X-Frame-Options`/`Content-Security-Policy`) and there is no way for a browser-hosted control to embed such a page - that protection exists on the target site itself, not something this component can bypass. Download isn't offered for a non-PDF link; use Open Page/Open in New Tab instead.
- If the linked resource can't be reached at all (network error, broken link, or a host that blocks cross-origin requests entirely) the resolution falls back to the URL's own file extension as a best guess, so a `.pdf`-looking link still gets pointed at directly rather than silently failing.

## Use Cases
- Contract or legal document review panels
- Evidence/attachment galleries on case or matter records
- Any 1:N relationship where the related table stores a PDF in a Dataverse File column and a plain row-based subgrid isn't the experience you want
- Documents that may live in more than one place per record (e.g. a signed copy File column with a draft File column as backup, or a File column with a web-hosted link as a fallback), using the File Column fallback chain

---

[← Back to main README](../README.md)
