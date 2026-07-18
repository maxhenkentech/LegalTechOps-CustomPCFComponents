import markdownTestFile from "../markdown-test.md";

// Test-mode Markdown, loaded directly from markdown-test.md at the project root rather than
// duplicated as a string literal here - editing that file and saving is enough to see the
// change in the running test harness (npm run start:watch rebuilds on the .md file too, since
// it's now a real webpack module dependency via the asset/source rule in webpack.config.js).
export const TEST_MODE_MARKDOWN = markdownTestFile;

// Fake field values for the {!fieldLogicalName} Dynamic Field Tag feature - there's no live
// Web API/metadata to call in the test harness, so dynamicFieldTags.resolveFieldTagsTestMode
// looks values up here by field name instead. Field names are deliberately unrelated to any real
// table so they can't be confused with a maker's own logical names; markdown-test.md's "Dynamic
// Field Tags" section demonstrates every case: a normal value, an explicitly blank field (renders
// "empty"), and a field name that isn't in this dictionary at all (renders "[Unknown field: ...]").
export const TEST_MODE_FIELD_VALUES: Record<string, string | undefined> = {
  lops_status: "Approved",
  lops_contractvalue: "$ 125,000.00",
  lops_effectivedate: "Jul 17, 2026",
  lops_ownername: "Jordan Blake",
  lops_emptyfield: "",
};

// Fake lookup-traversal targets for {!lookupField:targetField} - keyed by the *lookup field's*
// logical name on the current record (matching the live path's per-lookup-field bucketing), each
// value a dictionary of target-record field name to value.
export const TEST_MODE_LOOKUP_TARGETS: Record<string, Record<string, string | undefined>> = {
  lops_parentcontract: {
    lops_title: "Master Services Agreement",
    lops_status: "Signed",
  },
};
