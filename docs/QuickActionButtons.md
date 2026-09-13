[← Back to main README](../README.md)

# ⚡ Quick Action Buttons Component

A field control that is **not bound to any single field's value**. It renders up to 5 configurable icon+label buttons; clicking one writes a maker-configured set of field values onto the **current form** — no Dataverse save, just the same in-memory field update a user typing into the form would produce.

![Quick Action Buttons - Text, Relative Date, LookUp, and Multi-Choice examples](../Screenshots/QuickActionButtons/Overview.png)
*Four independent buttons, each writing a different kind of target field - a literal text value, a relative-date expression, an "assign to me" lookup, and a multi-select choice.*

## Features
- **Up to 5 independently configured buttons** — each has its own Label, Icon, optional Accent color, optional Tooltip, and an Actions JSON map. A button with no Label configured is simply not rendered, so 1–5 buttons all work without a separate "how many buttons" setting.
- **Full MDL2 icon support**, same icon-name/Unicode/CSS-class/image-web-resource resolution as [Modern Choice Buttons](ModernChoiceButtons.md) and [Advanced Dropdown](AdvancedDropDown.md) — an MDL2 name (browse and copy names at [flicon.io](https://www.flicon.io/) or [FLUENT_ICONS.md](../FLUENT_ICONS.md)), or a prefixed image web resource name (e.g. `hek_MyLogo.png`).
- **Actions JSON** — a plain map of *target field logical name → value* set on click. Values can be a literal (string/number/boolean/`null`), or an `@{...}`-wrapped expression using the function catalog below:
  ```json
  {
    "hek_status": "Approved",
    "hek_approvedon": "@{utcNow()}",
    "hek_summary": "@{concat(toUpper(hek_firstname), ' ', hek_lastname)}",
    "hek_daysoverdue": "@{sub(hek_duedays, 5)}",
    "hek_note": null
  }
  ```
- **Sets the field value only by default — does not save the form**, unless **Save record on click** is turned on. Off (the default), a click behaves exactly like a user editing that field directly: works on unsaved/new records, respects whatever else is unsaved elsewhere on the form, and leaves saving to the user (or the form's own automation) as normal. On, the record is saved immediately after that click's field values have all been set — the save always happens after, never before, the writes.
- **Per-button accent color**, usable as the background/border/icon color via the color-mode properties below (`Per-button color` mode) instead of one fixed color for every button.
- **Button shape/size**, show/hide label, bold label, icon position (Above/Below/Left/Right of the label), same visual language as Modern Choice Buttons.
- **Reflow behaviour**: `Wrap` (default) keeps every button at a fixed width, wrapping onto a new row once they no longer fit; `Flexible` shrinks or grows each button to exactly fit its icon and label instead.
- **Compact height for Small buttons with a Left/Right icon**: at Button size `Small` with Icon position `Left` or `Right`, the button's height is fixed to match a standard out-of-the-box Dataverse field row, so it lines up cleanly next to an adjacent field (e.g. an "Assign to me" button beside a lookup field).
- **Brief click confirmation** — the clicked button flashes its `Active (clicked) color` for a moment after a successful click, then fades back, as visual confirmation the action fired.
- **Live syntax and field checking** — if any button's Actions JSON is malformed (invalid JSON, not a JSON object, an unrecognized function name, or a broken `@{...}` expression), the control replaces the entire button row with a red error panel naming exactly which button and what's wrong, instead of silently rendering broken buttons. This runs on every render, including in the form designer's own live property preview, so a typo is visible immediately while configuring the control rather than only after clicking a button on a real form. Whenever the current form is reachable, this also checks that every target field (each JSON key) and every field referenced inside an `@{...}` expression actually exists on the record — a misspelled field name is flagged the same way as a syntax error.

## Properties

| Property | Type | Options | Description | Default |
|---|---|---|---|---|
| Bound field (unused) | Any | — | Bind to any existing column so the control can be added to the form. Its value is never read or displayed. | — |
| Save record on click | Two Options | — | If on, saves the record immediately after a click's field values have been set. | No |
| Button 1–5: Label | Text | — | Text shown on the button. Blank = button hidden. | — |
| Button 1–5: Icon | Text | — | MDL2 icon name or image web resource name. | — |
| Button 1–5: Accent color | Text | Hex | Optional accent color used by `Per-button color` modes. | — |
| Button 1–5: Tooltip | Text | — | Optional hover tooltip text. | — |
| Button 1–5: Actions (JSON) | Text (Multiple) | — | Field → value/expression map applied on click. | — |
| Button shape | Enum | Square / Rounded | Corner shape. | Rounded |
| Button size | Enum | Small / Normal / Large | Overall button size; icon stays a fixed size. | Normal |
| Show label | Two Options | — | Show/hide the label text under the icon. | Yes |
| Icon position | Enum | Above / Below / Left / Right | Position of the icon relative to the label. No effect when Show label is off. At Button size Small with Left/Right, the button's height also matches a standard OOB field row. | Above |
| Reflow behaviour | Enum | Wrap / Flexible | Wrap keeps each button at a fixed width and wraps onto a new row when out of space; Flexible sizes each button to fit its icon + label. | Wrap |
| Make font bold | Two Options | — | Bold label text. | No |
| Background color mode | Enum | Fixed / Per-button color | Resting background source. | Fixed |
| Button color | Text | Hex | Resting background when mode is Fixed. | `#FFFFFF` |
| Hover color | Text | Hex | Background while hovered. | `#DEECF9` |
| Active (clicked) color | Text | Hex | Brief flash background right after a click. | `#C7E0F4` |
| Border mode | Enum | Off / Fixed / Per-button color | Border source. | Fixed |
| Border color | Text | Hex | Border color when mode is Fixed. | `#D2D0CE` |
| Icon color mode | Enum | Automatic / Fixed / Per-button color | Icon color source. | Automatic |
| Icon color | Text | Hex | Icon color when mode is Fixed. | `#201F1E` |

## Expression Reference

Each Actions JSON value is resolved as follows:
- A JSON string **wrapped in `@{...}`** → the inner text is parsed and evaluated as an expression.
- A JSON **object with an `id` property**, e.g. `{"id":"<guid>","entityType":"systemuser"}` → a literal lookup value (see **Lookup fields** below).
- Any other JSON string, number, boolean, or `null` → used **literally** (no `@{}` needed for a fixed value).

Inside an expression, a bare word (e.g. `hek_duedate`) that isn't a function call is a reference to **another field on the current record** — its current in-memory value (including unsaved edits), read the same way it's written: via the form's own field objects, not a fresh Dataverse fetch.

String literals use single quotes, with `''` as an escaped single quote (e.g. `'it''s approved'`) — the same convention Power Automate/Logic Apps expressions use.

Supported functions (Power Automate names, same semantics unless noted):

| Category | Functions |
|---|---|
| String | `concat(...)`, `toUpper(text)`, `toLower(text)`, `trim(text)`, `substring(text, start, length?)`, `replace(text, old, new)` *(replaces every occurrence)*, `length(text)` |
| Math | `add(a,b)`, `sub(a,b)`, `mul(a,b)`, `div(a,b)`, `mod(a,b)`, `min(...)`, `max(...)`, `abs(a)`, `round(a, digits?)` |
| Date | `utcNow()`, `addSeconds(ts, n)`, `addMinutes(ts, n)`, `addHours(ts, n)`, `addDays(ts, n)`, `addToTime(ts, interval, unit)` *(unit: Second/Minute/Hour/Day/Week/Month/Year)*, `formatDateTime(ts, format?)`, `ticks(ts)` |
| Logic | `coalesce(...)` — first argument that isn't `null`/empty string |
| User | `me()` — the current user, as a lookup value (`{id, entityType: "systemuser", name}`) |
| Random | `guid()` — a freshly generated GUID string; `rand(min, max)` — a random integer, inclusive at `min`, exclusive at `max` |

Examples:
```
@{toUpper(hek_status)}
@{concat(hek_firstname, ' ', hek_lastname)}
@{addDays(utcNow(), 5)}
@{formatDateTime(utcNow(), 'yyyy-MM-dd')}
@{coalesce(hek_preferredname, hek_firstname, 'Unknown')}
@{me()}
@{guid()}
@{rand(1, 100)}
```

`formatDateTime`'s format string supports a small token subset: `yyyy`, `MM`, `dd`, `HH`, `mm`, `ss` — not the full .NET custom date format spec. `ticks()` returns .NET-style ticks (100ns units since `0001-01-01`), matching Power Automate's `ticks()`, not Unix time.

**Date Only target fields**: when a date/time expression result (e.g. `utcNow()`, `addDays(...)`) is written to a **Date Only** field (no time component), the calendar day is preserved correctly regardless of the browser's local timezone — the control detects Date Only vs. Date and Time fields and converts accordingly, so you never need to strip the time yourself in the expression.

### Lookup fields

A lookup target field (including polymorphic ones like `ownerid`, which accepts a user or a team) can be set from:
- **Another lookup field**, e.g. `{"ownerid": "@{hek_alternateowner}"}`.
- **The current user**, via `me()` — e.g. `{"ownerid": "@{me()}"}`, the "assign to me" pattern.
- **A literal record**, as a JSON object: `{"ownerid": {"id":"<guid>","entityType":"systemuser"}}`. `entityType` can be omitted when the target field's lookup only ever accepts one table (e.g. a lookup to Contact); it's required for a lookup that accepts more than one table (like `ownerid`), since there's no way to infer which one is meant.

### Choice (Option Set) fields

- **A hard value**: the underlying numeric option value, e.g. `{"hek_status": 100000001}` — not the label text, there is no label lookup.
- **Another choice field**: e.g. `{"hek_status": "@{hek_otherstatus}"}`.

### Multi-select choice fields

Represented as a **comma-separated string of numeric option values**, the same shape returned by the Dataverse Web API — not a JSON array:
- **A hard value**: `{"hek_multichoice": "100000001,100000002"}`.
- **Another multi-select field**: `{"hek_multichoice": "@{hek_othermultichoice}"}`.

## Known Limitations

- **`Xrm.Page` dependency**: field reads/writes go through the classic `Xrm.Page` API, which Microsoft has deprecated (though it remains present). If it's ever unavailable, all buttons disable themselves with an explanatory tooltip rather than failing silently.
- **Choice/Option Set target fields** must resolve to the underlying **numeric option value**, not the option's label text — there is no label lookup.
- **A polymorphic lookup target field** (one that accepts more than one table, e.g. `ownerid`) requires `entityType` to be specified explicitly in a literal value, or requires the source field/`me()` to already carry it — it cannot be inferred.
- **Field names are Dataverse logical names** (e.g. `hek_status`), not display names, and are case-sensitive.
- **The local PCF test harness cannot exercise the real form connection** — there is no live `Xrm.Page` at `localhost:8181`, so the harness always runs against an in-memory test fixture record instead. Confirming the real behavior, including **Save record on click**, needs a real Dataverse form.
