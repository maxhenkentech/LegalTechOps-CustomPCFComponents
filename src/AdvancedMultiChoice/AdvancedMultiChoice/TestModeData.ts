import { IChoiceOption } from "./AdvancedMultiChoiceControl";

// Test-mode fixtures for the PCF test harness only - never used against live Dataverse.

// ---------------------------------------------------------------------------------------------
// Fake web resources
// ---------------------------------------------------------------------------------------------
// The harness serves nothing at /WebResources/<name>, so without this every web resource icon
// would 404 and the "image renders" path could never be seen locally. These names resolve to
// inline, deliberately MULTI-COLOR SVGs instead (a single-color image would be indistinguishable
// from an MDL2 glyph, and wouldn't show that images ignore Icon color mode). Any name NOT listed
// here still requests /WebResources/<name> and 404s for real - that's what exercises the
// fallback chain. Keys are lower-cased; lookup is case-insensitive like Dataverse's.

const svg = (body: string): string =>
	`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${body}</svg>`)}`;

export const TEST_MODE_WEB_RESOURCES: Record<string, string> = {
	// Signed contract: white page, blue frame, grey text lines, red signature, green seal.
	"lops_contract.svg": svg(
		'<rect x="2.5" y="1.5" width="10" height="13" rx="1.5" fill="#ffffff" stroke="#0078d4"/>' +
		'<path d="M4.5 4.5h6M4.5 6.5h6M4.5 8.5h4" stroke="#8a8886" stroke-linecap="round"/>' +
		'<path d="M4.5 11.8c.8-1.4 1.6.9 2.4-.3s1.2.4 1.8-.1" fill="none" stroke="#d13438" stroke-linecap="round"/>' +
		'<circle cx="12" cy="12.5" r="2.6" fill="#107c10"/><path d="M10.9 12.5l.8.8 1.5-1.6" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round"/>'
	),
	// Two people: orange and blue.
	"lops_employment.svg": svg(
		'<circle cx="5.5" cy="5" r="2.5" fill="#ca5010"/><path d="M1.5 14c0-2.8 1.8-4.8 4-4.8s4 2 4 4.8z" fill="#f7630c"/>' +
		'<circle cx="11" cy="5.5" r="2.2" fill="#0078d4"/><path d="M7.8 14c.2-2.5 1.5-4.2 3.2-4.2s3 1.7 3.2 4.2z" fill="#2b88d8"/>'
	),
	// Gold coin with a green euro sign.
	"lops_tax.svg": svg(
		'<circle cx="8" cy="8" r="6.5" fill="#ffb900" stroke="#986f0b"/><circle cx="8" cy="8" r="4.8" fill="none" stroke="#fce100"/>' +
		'<path d="M10.2 5.6a3 3 0 1 0 0 4.8M4.8 7.2h4M4.8 8.8h4" fill="none" stroke="#107c10" stroke-width="1.3" stroke-linecap="round"/>'
	),
	// Not used by any option: type it into the Fixed Icon Name property to see the Fixed Icon Name
	// fallback render a web resource for every option whose External Value chain came up empty.
	"lops_default.svg": svg(
		'<path d="M8 1.2l2 4.2 4.6.6-3.4 3.2.9 4.6L8 11.6l-4.1 2.2.9-4.6L1.4 6l4.6-.6z" fill="#ffb900" stroke="#ca5010" stroke-linejoin="round"/>' +
		'<circle cx="8" cy="7.8" r="1.6" fill="#0078d4"/>'
	)
};

// ---------------------------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------------------------
// Every icon path is covered (the harness pre-fills Fixed Icon Name with its placeholder "val",
// which is not an MDL2 name, so a chain that exhausts its External Value ends in the color dot
// unless Fixed Icon Name is changed - e.g. to lops_default.svg):
//   Contract Law        web resource that loads (multi-color image)
//   Employment          web resource that loads
//   Tax                 missing web resource -> second web resource that loads
//   Data Protection     missing web resource -> MDL2 glyph
//   Real Estate         missing web resource -> unregistered MDL2 name -> Fixed Icon Name -> dot
//   Litigation          unregistered MDL2 name -> MDL2 glyph
//   Regulatory Compl.   no External Value at all -> Fixed Icon Name -> dot
//   General Advisory    no color (exercises the "use the configured hex" fallbacks)
// plus plain MDL2 names, a hidden option, and a label long enough to wrap/ellipsize.
export const TEST_MODE_OPTIONS: IChoiceOption[] = [
	{ value: 125980000, label: "Contract Law", color: "#0078d4", externalValue: "lops_contract.svg;PageEdit", isHidden: false, description: "Drafting, negotiation and interpretation of commercial agreements" },
	{ value: 125980001, label: "Data Protection", color: "#8764b8", externalValue: "lops_dataprotection.svg;Shield", isHidden: false, description: "GDPR, privacy notices, DPAs and data subject requests" },
	{ value: 125980002, label: "Employment", color: "#ca5010", externalValue: "lops_employment.svg;People", isHidden: false, description: "Hiring, termination, works council and employee disputes" },
	{ value: 125980003, label: "Intellectual Property", color: "#038387", externalValue: "Lightbulb", isHidden: false, description: "Trademarks, patents, copyright and licensing" },
	{ value: 125980004, label: "Litigation", color: "#d13438", externalValue: "Gavel;Warning", isHidden: false, description: "Court proceedings, arbitration and pre-trial correspondence" },
	{ value: 125980005, label: "Mergers & Acquisitions", color: "#498205", externalValue: "Org", isHidden: false, description: "Due diligence, SPA negotiation and post-merger integration" },
	{ value: 125980006, label: "Regulatory Compliance and Financial Services Supervision", color: "#986f0b", externalValue: "", isHidden: false, description: "BaFin, MiFID II, AML/KYC obligations and supervisory audits" },
	{ value: 125980007, label: "Real Estate", color: "#5c2e91", externalValue: "lops_realestate.svg;Skyscraper", isHidden: false, description: "Leases, property transactions and land register matters" },
	{ value: 125980008, label: "Tax", color: "#69797e", externalValue: "lops_taxes_old.svg;lops_tax.svg;Money", isHidden: false, description: "Corporate tax structuring, VAT and transfer pricing" },
	{ value: 125980010, label: "General Advisory", color: undefined, externalValue: "Chat", isHidden: false, description: "Ad-hoc legal questions without a dedicated practice area" },
	{ value: 125980009, label: "Archived Practice Area (Hidden)", color: "#a19f9d", externalValue: "Archive", isHidden: true, description: "This option is hidden in the choice and should not be offered" }
];

// Pre-selected so the field shows one of each icon path on first load instead of an empty box.
export const TEST_MODE_DEFAULT_SELECTION = [125980000, 125980001, 125980002, 125980004, 125980006, 125980007, 125980008, 125980010];
