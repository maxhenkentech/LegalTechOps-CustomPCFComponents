
// ---------------------------------------------------------------------------------------------
// Theme font - respects a model-driven app's modern Custom theme definition (the `font`
// attribute of its <CustomTheme> XML, see
// https://learn.microsoft.com/power-apps/maker/model-driven-apps/modern-theme-overrides).
// Duplicated per control (this repo shares no code between controls); RiskMatrix renders plain
// DOM, so it only needs the font-stack half - no Fluent theme scope.
// ---------------------------------------------------------------------------------------------

// The font every control used before theming support, kept as the fallback: it's what renders
// when no custom theme is set, and what the browser falls back to when the theme font can't be
// displayed (not installed, web font blocked, typo).
export const DEFAULT_FONT_STACK =
	"'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif";

// Generic families always resolve to *some* font, so a theme value like "'GreatVibes', cursive"
// would never fall back to DEFAULT_FONT_STACK - they are dropped from the theme part and the
// stack's own trailing sans-serif ends it instead.
const GENERIC_FAMILY = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|math|emoji|fangsong|inherit|initial|unset|revert)$/i;

const splitFamilies = (stack: string): string[] => stack.split(",").map(f => f.trim()).filter(f => f.length > 0);
const familyKey = (family: string): string => family.replace(/^['"]|['"]$/g, "").trim().toLowerCase();

// Theme font first, then DEFAULT_FONT_STACK, de-duplicated (the out-of-the-box Fluent 2 theme's own
// fontFamilyBase is a Segoe UI stack, which then just collapses into the default).
export function buildFontStack(themeFont?: string): string {
	const themeFamilies = splitFamilies(themeFont || "").filter(f => !GENERIC_FAMILY.test(familyKey(f)) && !f.includes("var("));
	const seen = new Set<string>();
	const result: string[] = [];
	for (const family of [...themeFamilies, ...splitFamilies(DEFAULT_FONT_STACK)]) {
		const key = familyKey(family);
		if (key && !seen.has(key)) {
			seen.add(key);
			result.push(family);
		}
	}
	return result.join(", ");
}

// Where the theme font comes from, in order:
//  1. context.fluentDesignLanguage.tokenTheme.fontFamilyBase - the Fluent v9 theme the platform
//     hands every control; in a model-driven app with the new look it carries the custom theme.
//  2. the --fontFamilyBase CSS variable the app's FluentProvider defines, for hosts that theme the
//     page but don't populate fluentDesignLanguage.
//  3. harness only: ?font=<css font-family> in the URL, since the harness has no theme.
// Anything that throws or comes back empty -> undefined -> DEFAULT_FONT_STACK.
export function readThemeFont(context: { fluentDesignLanguage?: { tokenTheme?: { fontFamilyBase?: string } } }, testMode: boolean): string | undefined {
	if (testMode && typeof window !== "undefined") {
		const fromUrl = new URLSearchParams(window.location.search).get("font");
		if (fromUrl) return fromUrl;
	}
	try {
		const token = context.fluentDesignLanguage?.tokenTheme?.fontFamilyBase;
		if (token && token.trim()) return token;
	} catch {
		// fall through
	}
	try {
		if (typeof document !== "undefined") {
			const host = document.querySelector(".fui-FluentProvider") ?? document.body;
			const fromVar = getComputedStyle(host).getPropertyValue("--fontFamilyBase").trim();
			if (fromVar) return fromVar;
		}
	} catch {
		// fall through
	}
	return undefined;
}
