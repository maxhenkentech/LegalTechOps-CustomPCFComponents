[← Back to main README](../README.md)

# 📝 Markdown Help Text Component

A field control that renders Markdown as formatted, visually polished help text on a form - point it at a Single Line or Multiple Lines of Text column, or type static Markdown directly into a design-time property when no backing column is wanted. Text size scales automatically with whatever font size the form's own text-size setting applies to the control's container, using relative (em) units throughout rather than a fixed pixel size.

<img src="../Screenshots/MarkdownHelpText/ExampleRendering.png" alt="Example rendering" width="90%">

*Alert callouts, Dynamic Field Tags, Font Coloring, tables, and images, all rendered together - see the [full example](#example) below for the Markdown source.*

📖 **New to Markdown syntax?** See the [CommonMark quick reference](https://commonmark.org/help/) or the full [GitHub Flavored Markdown spec](https://github.github.com/gfm/) for complete syntax details - everything documented there, plus the GitHub-style alert callouts shown below, is supported.

## Features
- **Full CommonMark + GitHub Flavored Markdown**: headings, emphasis, lists, links, images, blockquotes, tables, task lists, and strikethrough, via [`react-markdown`](https://github.com/remarkjs/react-markdown) + [`remark-gfm`](https://github.com/remarkjs/remark-gfm) (both MIT-licensed, free for commercial use)
- **Syntax-Highlighted Code Blocks**: fenced code blocks with a language tag are highlighted via [`rehype-highlight`](https://github.com/rehypejs/rehype-highlight) (MIT)
- **GitHub-Style Alert Callouts**: a blockquote starting with `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, or `[!CAUTION]` renders as a colored, icon-labeled callout box instead of a plain blockquote
- **Dynamic Field Tags**: `{!fieldLogicalName}` and `{!lookupField:targetField}` tags anywhere in the text are replaced with the current record's own field values, type-aware formatted the same way the platform itself would show them - see [Dynamic Field Tags](#dynamic-field-tags) below
- **Font Coloring**: standard `<span style="color:...">`/`<span style="background-color:...">` HTML - the same syntax GitHub, Obsidian, and most other Markdown editors already support - colors inline text; every other HTML tag, attribute, and style property is stripped rather than rendered, see [Font Coloring](#font-coloring) below
- **Font Size & Background**: `font-size` and `background` on a `<span>` (part of a line), a `<p>` (one paragraph) or a `<div>` (a whole block of Markdown) - make a note larger or smaller, or put it in a shaded box; sizes are limited to a sensible range, see [Font Size & Background](#font-size--background) below
- **Configurable Callout Text Layout**: choose whether an alert callout's body text starts on the same line as its icon + label (default) or drops to its own line below
- **Configurable Line Spacing**: tune the line-height multiplier applied to all rendered text (default 1.55) to match a tighter or looser form layout
- **Three Ways to Provide Content**: place the control on a text column (`Text Column`), bind `Markdown Column` to any other text column on the table - including a **formula (Fx) column** that builds the Markdown from the record - or type static Markdown into `Markdown Text` at design time. They are used in that order: the first one with a value wins, and the control can be added to a form with none of them bound to a specific column
- **Scales With Form Text Size**: every element is sized in `em` relative to the control's own inherited font size, so it automatically matches whatever text size the form (or an individual field's text-size setting) applies - no manual scale property to tune
- **Safe by Default**: raw HTML embedded in the Markdown source is sanitized against an allowlist before rendering - only the `color`, `background-color`/`background` and `font-size` styles on `<span>`, `<p>` and `<div>` (for [Font Coloring](#font-coloring) and [Font Size & Background](#font-size--background)) survive; every other tag, attribute, and event handler (`<script>`, `onerror`, `onclick`, `url()`/`expression()` smuggled through `style`, etc.) is stripped, so there is no way to inject markup or scripts through help text sourced from an editable column
- **Read-Only**: a pure display control, like a styled label - edit the Markdown through the normal Dataverse column editor or the static design-time property, not through the control itself
- **Follows your app theme font**: uses the font of the app's modern [custom theme](https://learn.microsoft.com/power-apps/maker/model-driven-apps/modern-theme-overrides) (the `font` of its Custom theme definition), falling back to Segoe UI when no custom theme is set or the font can't be displayed

## Example

The Markdown source below produces the rendering shown at the top of this page - a short, realistic example combining several features at once: alert callouts, Dynamic Field Tags, Font Coloring, a table, and an image.

```markdown
## Markdown Help Text

### Callouts

> [!TIP]
> This is an example of a typed call out. This component support:
> - *<span style="color:#0078d4">Note</span>*
> - *<span style="color:#107c10">Tip</span>*
> - *<span style="color:#8764b8">Important</span>*
> - *<span style="color:#b45400">Warning</span>*
> - *<span style="color:#d13438">Caution</span>*

This is an example of a regular callout:
> This is how we dynamically pull values from this record: **{!hek_name}** - **{!createdon}** and from related records: **{!createdby:fullname}**.

### Tables
You can even render tables:

| Item | Color | Flavor |
| -------- | :------: | -------: |
| **Apples**    | <span style="color:red">red</span> | sweet    |
| **Lemons**    | <span style="color:#d4b106">yellow</span> | sour    |
| **Carrots**   | <span style="color:orange">orange</span> | crunchy    |

### Images
And images as base64 or using a link. Use plain Markdown image syntax for full width, or an HTML `<img>` tag with a `width` attribute to render at a specific size:
<img src="https://share.henken.tech/raw/BS1o3U.png" alt="Alt text" width="50">
```

## Markdown Syntax Gallery

Each entry below shows the exact Markdown source next to what it renders as - type this directly into `Text Column` or `Markdown Text`. Ordered roughly by how often you'll reach for each one:

- [Headings](#headings)
- [Emphasis](#emphasis)
- [Lists](#lists)
- [Links](#links)
- [Inline Code & Fenced Code Blocks](#inline-code--fenced-code-blocks)
- [Blockquotes](#blockquotes)
- [Tables](#tables)
- [Images](#images)
- [Task Lists](#task-lists)
- [Alert Callouts](#alert-callouts)
- [Font Coloring](#font-coloring)
- [Font Size & Background](#font-size--background)

### Headings

<img src="../Screenshots/MarkdownHelpText/Headings.png" alt="Headings" width="60%">

*All six heading levels (H1-H6) - a line starting with 1-6 `#` characters followed by a space.*
```markdown
# Heading Level 1
## Heading Level 2
### Heading Level 3
#### Heading Level 4
##### Heading Level 5
###### Heading Level 6
```

### Emphasis

<img src="../Screenshots/MarkdownHelpText/Emphasis.png" alt="Emphasis" width="100%">

*Bold, italic, strikethrough, and combined bold+italic emphasis.*
```markdown
*italic* or _italic_
**bold** or __bold__
~~strikethrough~~
***bold and italic together***
```

### Lists

<img src="../Screenshots/MarkdownHelpText/List.png" alt="Lists" width="30%">

*Unordered and ordered lists, including nested sub-items - indent a sub-item two spaces under its parent.*
```markdown
- Unordered item
- Another item
  - Nested item (indent two spaces)

1. Ordered item
2. Another item
   1. Nested item (indent three spaces)
```

### Links

<img src="../Screenshots/MarkdownHelpText/Links.png" alt="Links" width="100%">

*Inline links and bare autolinks - opened via the platform's own navigation API rather than a raw page navigation.*
```markdown
[Link text](https://example.com/policy)
<https://example.com/autolink>
```

### Inline Code & Fenced Code Blocks

<img src="../Screenshots/MarkdownHelpText/InlineCode.png" alt="Inline Code & Fenced Code Blocks" width="90%">

*Inline code spans (single backticks) and syntax-highlighted fenced code blocks (triple backticks with a language tag on the opening fence).*
```markdown
Reference the `variableName` inline.

\`\`\`typescript
function example(value: string): string {
  return value;
}
\`\`\`
```

### Blockquotes

<img src="../Screenshots/MarkdownHelpText/BlockQuote.png" alt="Blockquotes" width="100%">

*Standard blockquotes for quoting text - a line (or lines) prefixed with `>` - see Alert Callouts below for the GitHub-style variant.*
```markdown
> Quoted text goes here, and can
> span multiple lines with each one prefixed.
```

### Tables

<img src="../Screenshots/MarkdownHelpText/Tables.png" alt="Tables" width="100%">

*GitHub Flavored Markdown tables, wrapped in a horizontally scrollable container so they never overflow a narrow form. The second row's dashes/colons set column alignment (`:---`, `:---:`, `---:` for left/center/right).*
```markdown
| Column A | Column B | Column C |
| -------- | :------: | -------: |
| Row 1    | centered | right    |
| Row 2    | centered | right    |
```

### Images

<img src="../Screenshots/MarkdownHelpText/Images.png" alt="Images" width="30%">

*Inline images, sized to fit the available width - same syntax as a link with a leading `!`. For a smaller image, use an HTML `<img>` tag with a `width` attribute instead - it renders the same way but respects the explicit size.*
```markdown
![Alt text](https://example.com/image.png)

<img src="https://example.com/image.png" alt="Alt text" width="200">
```

### Task Lists

<img src="../Screenshots/MarkdownHelpText/TaskList.png" alt="Task Lists" width="30%">

*GFM task lists - checked and unchecked items rendered as (read-only) checkboxes, using `- [x]`/`- [ ]`.*
```markdown
- [x] Completed item
- [ ] Not yet completed item
```

### Alert Callouts

<img src="../Screenshots/MarkdownHelpText/AlertCallouts.png" alt="Alert Callouts" width="90%">

*GitHub-style alert callouts - a blockquote whose first line is one of `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, or `[!CAUTION]` renders as a colored, icon-labeled box instead of a plain blockquote.*
```markdown
> [!NOTE]
> Body text for the note goes here.

> [!TIP]
> Body text for the tip goes here.

> [!IMPORTANT]
> Body text for the important callout goes here.

> [!WARNING]
> Body text for the warning goes here.

> [!CAUTION]
> Body text for the caution goes here.
```

## Dynamic Field Tags

Beyond static Markdown, the text itself can reference the current record's own field values - a tag anywhere in `Text Column` or `Markdown Text` is replaced with live data from whichever record the control is currently placed on, formatted the same way the platform itself would show it.

| Tag | Resolves to |
|-----|-------------|
| `{!fieldLogicalName}` | The named field's own value on the current record, e.g. `{!lops_status}` |
| `{!lookupField:targetField}` | `targetField`'s value on the record that lookup field `lookupField` (on the current record) currently points to, e.g. `{!lops_parentcontract:lops_status}` |

**Type-aware formatting** (the same rules the Relationship View component's Quick View panel uses):
- **Choice/Status/Boolean/text/number**: the platform's own formatted label
- **Money**: rebuilt as `<symbol> <value>` (e.g. `$ 12,500.00`)
- **Date/DateTime**: reformatted using the *browser's* own locale, not the server/org's date settings
- **Lookup/Customer/Owner**: the target record's own name

**Edge cases:**
- A field with no value set on the record renders as the word `empty`, clearly distinguishable from a typo or formatting mistake
- An unknown or malformed tag renders a short, visible `[Unknown field: fieldname]` marker instead of silently disappearing, so it's easy to spot while authoring
- A tag written inside inline code or a fenced code block is left completely untouched - useful for documenting the syntax itself without triggering it

> [!NOTE]
> Field tags cost a Web API round trip (metadata + record fetch, plus one more per distinct related record referenced through a `{!lookupField:targetField}` tag) - keep the number of distinct fields referenced reasonable on a form that loads frequently.

## Font Coloring

<img src="../Screenshots/MarkdownHelpText/Colors.png" alt="Font Coloring">

*Inline HTML color spans - the same `<span style="color:...">` syntax GitHub, Obsidian, and most other Markdown editors already support for coloring text, since it's part of standard CommonMark's raw-HTML passthrough rather than a custom tag invented for this control.*

```markdown
This line has <span style="color:red">red text</span>, <span style="color:#2b8a3e">a hex green</span>,
and <span style="background-color:yellow">a yellow highlight</span> mixed into <span style="color:blue">**bold blue**</span> and regular text.
```

The `color` and `background-color` CSS properties are honored on a `<span>`, `<p>` or `<div>` (see [Font Size & Background](#font-size--background) for the other two styles) - a hex code (`#2b8a3e`), an `rgb()`/`rgba()`/`hsl()`/`hsla()` function, or a plain CSS color name (`red`, `blue`, etc.) are all accepted values. Every other HTML tag, attribute, and style property written in the source - `<script>`, `<div style="position:fixed">`, `onclick`/`onerror`, `url(...)`/`expression(...)` smuggled inside a `style` value - is stripped down to plain text rather than rendered, so this remains safe to use with a user-editable text column.

> [!NOTE]
> Markdown emphasis (`**bold**`, `*italic*`, etc.) still works nested inside a color span, since the span is just inline HTML wrapping ordinary Markdown content - see `**bold blue**` in the example above.

## Font Size & Background

*Make part of the text larger or smaller, or shade it - on a few words (`<span>`), one paragraph (`<p>`) or a whole block of Markdown (`<div>`), with the same `style` syntax as [Font Coloring](#font-coloring).*

```markdown
Inline: <span style="font-size:0.85em">small print</span>, <span style="font-size:1.25em">**larger text**</span>
and <span style="font-size:1.2em;background:#fff4ce;color:#8a5a00">a big amber highlight</span>.

<div style="background-color:#EDF3FB">

**Before you submit:** check the contract value and attach the signed copy.

- Values over 100,000 need a second approval
- Use the *Notes* tab for exceptions

</div>

<p style="background:#F3F2F1;font-size:0.9em">A single shaded paragraph in a smaller size.</p>
```

- **`font-size`**: a size relative to the form's text (`0.8em`, `1.25em`, `1.5rem`, `120%`), a fixed size (`18px`, `12pt`), or a keyword (`small`, `large`, `x-large`, `smaller`, `larger` ...). Relative sizes follow the form's own text size, like everything else in this control. Sizes are kept between **0.5em and 3em** (50%-300%, 8px-48px, 6pt-36pt); a value outside that range uses the nearest limit.
- **`background`**: a single color, written as `background` or `background-color`, with the same values as Font Coloring. Images, gradients and positions are not accepted.
- **Shaded blocks**: a `<div>` or `<p>` with a background gets a little padding, rounded corners and space above and below, so the text doesn't touch the edge of the shading. Inline highlights (`<span>`) are not padded.
- **Markdown inside a `<div>`** works when the `<div>` and `</div>` lines are separated from the content by an empty line, as in the example - that is how CommonMark switches back from HTML to Markdown.
- Several styles can be combined in one `style` attribute, separated by `;`. Unsupported styles are dropped and the rest are kept.

## Properties

| Property | Type | Options | Description | Default |
|----------|------|---------|-------------|---------|
| `boundText` (Text Column) | Single Line/Multiple Lines of Text | - | Optional: a text column containing Markdown. Takes priority over Markdown Text when both are set. Leave unbound to use this as a static help-text component with no backing column | - |
| `markdownColumn` (Markdown Column) | Single Line/Multiple Lines of Text | - | Optional: another text column on the table that contains Markdown, including a formula (Fx) column. Turn on **Bind to table column** in the component settings and pick the column. Used when Text Column has no value | - |
| `markdownText` (Markdown Text) | Multiple Lines of Text | - | Static Markdown, set at design time, used when Text Column and Markdown Column have no value | - |
| `calloutTextLayout` (Callout Text Layout) | Choice | SameLine/NewLine | Where an alert callout's body text starts relative to its icon + label: on the same line as the label, or on the line below it | SameLine |
| `lineSpacing` (Line Spacing) | Decimal | - | Line height multiplier applied to all rendered text | 1.55 |

## Configuring the Control

Markdown Help Text can get its Markdown three ways, and all three can be configured on the same instance (the first one with a value wins):

1. **Bound to a column** - place the control directly on a Single Line or Multiple Lines of Text field, the same way Risk Matrix is placed on a field. Whatever Markdown is stored in that column renders live.
2. **From another column, including a formula (Fx) column** - in the component settings, turn on **Bind to table column** under `Markdown Column` and pick any Single Line or Multiple Lines of Text column on the table. A formula column is a good fit for help text built from the record itself, e.g. `"> [!TIP]" & Char(10) & "> Matter **" & 'Name' & "** is " & Text('Status')`. The control can sit on any field (or none), and the formula's Markdown renders as usual.
3. **Static, no column needed** - insert the control as a standalone component (not bound to any field) and set `Markdown Text` to the desired Markdown directly in the form designer. Useful for banner-style guidance that does not need to vary per record.
4. Author Markdown using standard [CommonMark](https://commonmark.org/help/)/[GFM](https://github.github.com/gfm/) syntax - tables, task lists, code fences, and `> [!NOTE]`/`[!TIP]`/`[!IMPORTANT]`/`[!WARNING]`/`[!CAUTION]` alert callouts are all supported out of the box
5. Reference the current record's own field values inline with `{!fieldLogicalName}`, or a related record's field via `{!lookupField:targetField}` - see [Dynamic Field Tags](#dynamic-field-tags)
6. Tune presentation with `calloutTextLayout` (Same Line/New Line for alert callout body text) and `lineSpacing` (line-height multiplier) if the defaults don't match your form's density

> [!TIP]
> To combine them: bind `Text Column` (or `Markdown Column`) for the common case, and leave `Markdown Text` set as a fallback shown only for records where that column is empty.

> [!NOTE]
> `Markdown Text` itself can only be bound to a Multiple Lines of Text column in the form designer - use `Markdown Column` for a Single Line of Text or formula (Fx) column.

> [!NOTE]
> `calloutTextLayout` and `lineSpacing` apply to the whole control instance, not per alert type or per paragraph - set them once to match the density/style of the form section the control sits in.

## Use Cases
- Contextual guidance/instructions placed above a section of a form
- Policy or process reminders that need bold text, links, or a checklist, not just plain text
- Per-record dynamic help text (e.g. a different reminder depending on record type or status) via a calculated or manually-set text column
- Rich release notes, warnings, or "what changed" banners that need more than a single line of plain text
- Record summaries that weave the record's own field values directly into a sentence (e.g. "This contract expires on `{!lops_expirationdate}` and is owned by `{!lops_parentcontract:lops_accountmanager}`") instead of leaving makers to lay out separate read-only fields

---

[← Back to main README](../README.md)
