// Test-mode fixtures for the PCF test harness only - never used against live Dataverse.

// ---------------------------------------------------------------------------------------------
// Fake web resources
// ---------------------------------------------------------------------------------------------
// The harness serves nothing at /WebResources/<name>, so without this every web resource icon
// would 404 and the "image renders" path could never be seen locally. These names resolve to
// inline, deliberately MULTI-COLOR SVGs (a single-color image would be indistinguishable from an
// MDL2 glyph, and wouldn't show that images ignore Icon color mode). Any other name still requests
// /WebResources/<name> and 404s for real. Keys are lower-cased; lookup is case-insensitive.
// Type them into Yes icon / No icon.

const svg = (body: string): string =>
	`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${body}</svg>`)}`;

export const TEST_MODE_WEB_RESOURCES: Record<string, string> = {
	// Check badge: green disc, white tick, darker rim and a soft highlight.
	"lops_checkbadge.svg": svg(
		'<circle cx="8" cy="8" r="7" fill="#107c10" stroke="#0b5a0b"/><circle cx="6" cy="5.5" r="3.2" fill="#ffffff" opacity=".18"/>' +
		'<path d="M4.8 8.2l2.2 2.2 4.2-4.6" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
	),
	// Cancel badge: red disc, white cross, darker rim and a soft highlight.
	"lops_cancelbadge.svg": svg(
		'<circle cx="8" cy="8" r="7" fill="#d13438" stroke="#a4262c"/><circle cx="6" cy="5.5" r="3.2" fill="#ffffff" opacity=".18"/>' +
		'<path d="M5.5 5.5l5 5M10.5 5.5l-5 5" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>'
	)
};

// ---------------------------------------------------------------------------------------------
// Label fixtures - pick one with ?fixture=<name> (default: plain). Colors are NOT part of the
// fixtures: a Yes/No column has no option colors, they come from the Yes color / No color
// properties (blank them in the panel to see the family-blue fallbacks).
// ---------------------------------------------------------------------------------------------
//   plain    Yes / No.
//   custom   Relabelled column with one label long enough to ellipsize:
//            "Confidential - restricted to the matter team" / "Public".
export const TEST_MODE_FIXTURES: Record<string, { yes: string; no: string }> = {
	plain: { yes: "Yes", no: "No" },
	custom: { yes: "Confidential - restricted to the matter team", no: "Public" }
};

export const TEST_MODE_DEFAULT_FIXTURE = "plain";

// Shown instead of the harness's "val" placeholder (index.ts testModeValue), so icons and colors
// are visible without typing anything; type any other value (or clear it) to override. The icons
// are the MDL2 check/cancel badges (user choice), so they follow the icon color modes; type
// lops_checkbadge.svg / lops_cancelbadge.svg to see the web resource (image) path instead.
export const TEST_MODE_DEFAULT_ICONS = { yes: "CompletedSolid", no: "StatusErrorFull" };
export const TEST_MODE_DEFAULT_COLORS = { yes: "#107C10", no: "#D13438" };

// The first render value (the harness bound true/false select takes over after that - index.ts).
export const TEST_MODE_DEFAULT_VALUE = true;
