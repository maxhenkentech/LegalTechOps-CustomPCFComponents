// Test-mode fixtures for the PCF test harness only - never used against live Dataverse.

type TestOption = ComponentFramework.PropertyHelper.OptionMetadata & {
	Description?: string;
	ExternalValue?: string;
	IsHidden?: boolean;
};

// ---------------------------------------------------------------------------------------------
// Fake web resources (same technique as AdvancedMultiChoice's TestModeData.ts)
// ---------------------------------------------------------------------------------------------
// The harness serves nothing at /WebResources/<name>, so these names resolve to inline,
// deliberately multi-color SVGs instead - a single-color image would be indistinguishable from an
// MDL2 glyph. Any name NOT listed still requests /WebResources/<name> and 404s for real, which is
// what exercises the ";" fallback chain. Keys are lower-cased; lookup is case-insensitive.

const svg = (body: string): string =>
	`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${body}</svg>`)}`;

export const TEST_MODE_WEB_RESOURCES: Record<string, string> = {
	// Red warning triangle with a yellow core.
	"lops_critical.svg": svg(
		'<path d="M8 1.5l6.8 12H1.2z" fill="#d13438" stroke="#a4262c" stroke-linejoin="round"/>' +
		'<path d="M8 5.5l3.4 6H4.6z" fill="#ffb900"/><rect x="7.3" y="7.2" width="1.4" height="2.6" rx=".6" fill="#323130"/>'
	),
	// Green/blue check badge.
	"lops_ok.svg": svg(
		'<circle cx="8" cy="8" r="6.5" fill="#107c10"/><circle cx="8" cy="8" r="4.2" fill="#0078d4"/>' +
		'<path d="M5.8 8.1l1.5 1.5 3-3.2" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
	)
};

// ---------------------------------------------------------------------------------------------
// Options - each one exercises a different icon/color path (the harness pre-fills the Icon
// property with its placeholder "val", an unregistered MDL2 name, so an exhausted chain ends in
// the color dot unless Icon is changed):
//   0 - No Impact          web resource that loads (External Value, multi-color image)
//   1 - Low                no color at all (exercises the #EDF3FB / #255BA4 family fallbacks)
//   2 - Low to Medium      no External Value -> Icon property -> dot
//   3 - High               plain MDL2 name
//   4 - Very High          missing web resource -> second web resource that loads
//   5 - Unknown            unregistered MDL2 name -> MDL2 glyph
//   (hidden)               hidden option, must not be offered
// ---------------------------------------------------------------------------------------------
export const TEST_MODE_OPTIONS: TestOption[] = [
	{ Value: 125980999, Label: "0 - No Impact", Color: "#9bff82", Description: "This option represents no business impact", ExternalValue: "lops_ok.svg;CheckMark" },
	{ Value: 125980004, Label: "1 - Low", Color: undefined as unknown as string, Description: "Minor impact, no color configured on this option", ExternalValue: "Info" },
	{ Value: 125980001, Label: "2 - Low to Medium", Color: "#ffe100", Description: "Low to medium business impact with some operational effects" },
	{ Value: 125980002, Label: "3 - High", Color: "#ff9100", Description: "High business impact affecting multiple departments", ExternalValue: "Warning" },
	{ Value: 125980003, Label: "4 - Very High", Color: "#ff1414", Description: "Critical business impact requiring immediate attention", ExternalValue: "lops_missing.svg;lops_critical.svg;WarningSolid" },
	{ Value: 125980005, Label: "5 - Unknown, with a label long enough to test truncation in the chip", Color: "#8764b8", Description: "Impact not yet assessed", ExternalValue: "NotAnIcon;Help" },
	{ Value: 125980000, Label: "1 - Undetermined yet (Hidden)", Color: "#dbdbdb", Description: "This option should be hidden in normal mode", IsHidden: true }
];
