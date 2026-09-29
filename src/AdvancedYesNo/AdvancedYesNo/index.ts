import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from 'react';
import { initializeIcons } from '@fluentui/react/lib/Icons';
import { AdvancedYesNoControl, IConfig, IYesNoOptions, setWebResourceUrlOverrides } from "./AdvancedYesNoControl";
import { TEST_MODE_FIXTURES, TEST_MODE_DEFAULT_COLORS, TEST_MODE_DEFAULT_FIXTURE, TEST_MODE_DEFAULT_ICONS, TEST_MODE_DEFAULT_VALUE, TEST_MODE_WEB_RESOURCES } from "./TestModeData";
import { buildFontStack, readThemeFont } from "./ThemeFont";

const CONTROL_VERSION = "1.0.1";

// Initialize icons for both test harness and production
const initializeIconsForEnvironment = () => {
	try {
		initializeIcons();

		if (typeof window !== 'undefined') {
			setTimeout(() => {
				try {
					initializeIcons();
				} catch (e) {
					console.warn("Secondary icon initialization failed:", e);
				}
			}, 100);
		}

		return true;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (err: any) {
		console.error("❌ CRITICAL error during icon initialization:", err);
		return false;
	}
};

initializeIconsForEnvironment();

// Harness-only: the harness pre-fills text properties with "val" (not an icon or a color), which
// made every style look icon-less and colorless on a fresh harness page. Show samples instead.
const testModeValue = (value: string, testMode: boolean, fallback: string): string =>
	testMode && value === "val" ? fallback : value;

// A Yes/No column's options have no colors a maker can set, so Yes color / No color replace them.
// Blank or invalid -> undefined, i.e. "no option color" (every mode then uses its fallback hex).
const optionColor = (value: string): string | undefined => {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
	return /^#[0-9a-f]{6}$/i.test(hex) ? hex : undefined;
};

export class AdvancedYesNo implements ComponentFramework.ReactControl<IInputs, IOutputs> {

	private notifyOutputChanged: () => void;
	// null = no value (a new record whose Yes/No column has no default).
	private currentValue: boolean | null = null;
	// Harness-only: the value shown, seeded from TEST_MODE_DEFAULT_VALUE or ?value=empty, then
	// following the harness's own bound true/false select (see updateView).
	private testModeValue: boolean | null | undefined = undefined;
	private testModeTouched = false;

	constructor() {
		// Constructor intentionally empty
	}

	private isTestMode(): boolean {
		const hostname = typeof window !== 'undefined' ? window.location?.hostname : '';
		const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost');

		const isTestHarness = typeof window !== 'undefined' &&
			(window.location?.port === '8181' ||
				window.location?.href?.includes('_pkg/') ||
				document.title?.includes('Test harness'));

		return isLocalhost || isTestHarness;
	}

	private testModeParam(name: string): string | null {
		if (typeof window === 'undefined') return null;
		return new URLSearchParams(window.location.search).get(name);
	}

	private parseConfig(p: IInputs, testMode: boolean): IConfig {
		const normalizeHex = (value: string | null | undefined, fallback: string): string => {
			if (!value || value.trim() === "") return fallback;
			const trimmed = value.trim();
			return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
		};

		// Same defensive coercion as ModernChoiceButtons: the Form Editor preview canvas has been
		// observed handing TwoOptions properties back as the string "false", which `??` misses.
		const toBool = (value: boolean | string | null | undefined, fallback: boolean): boolean => {
			if (value === undefined || value === null) return fallback;
			if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
			return value;
		};

		// Fallbacks must match the manifest default-values (they cover a property cleared to blank).
		return {
			displayStyle: p.displayStyle?.raw ?? "Toggle",
			showLabels: toBool(p.showLabels?.raw, true),
			labelPosition: p.labelPosition?.raw ?? "Right",
			optionOrder: p.optionOrder?.raw ?? "YesFirst",
			widthMode: p.widthMode?.raw ?? "Fill",
			fixedWidth: p.fixedWidth?.raw && p.fixedWidth.raw > 0 ? p.fixedWidth.raw : 100,
			componentHeight: p.componentHeight?.raw ?? "Short",
			selectionShape: p.selectionShape?.raw ?? "Rounded",
			makeFontBold: toBool(p.makeFontBold?.raw, false),
			yesIcon: testModeValue(p.yesIcon?.raw?.trim() ?? "", testMode, TEST_MODE_DEFAULT_ICONS.yes),
			noIcon: testModeValue(p.noIcon?.raw?.trim() ?? "", testMode, TEST_MODE_DEFAULT_ICONS.no),
			iconPosition: p.iconPosition?.raw ?? "Left",
			iconColorMode: p.iconColorMode?.raw ?? "ChoiceColor",
			iconColor: normalizeHex(p.iconColor?.raw, "#255BA4"),
			checkedColorMode: p.checkedColorMode?.raw ?? "CustomColor",
			checkedColor: normalizeHex(p.checkedColor?.raw, "#255BA4"),
			selectionBackgroundMode: p.selectionBackgroundMode?.raw ?? "CustomColorFaded",
			selectionColor: normalizeHex(p.selectionColor?.raw, "#EDF3FB"),
			selectionBorderMode: p.selectionBorderMode?.raw ?? "ChoiceColor",
			selectionBorderColor: normalizeHex(p.selectionBorderColor?.raw, "#255BA4")
		};
	}

	// Labels come straight from the SDK's TwoOptionMetadata (matched by Value 1/0, not position).
	// Colors do NOT: a Yes/No column's options can't be colored by a maker (user), so they come
	// from the Yes color / No color properties instead. No Web API metadata call is needed.
	private readLabels(context: ComponentFramework.Context<IInputs>): { yes: string; no: string } {
		const options = context.parameters.value.attributes?.Options ?? [];
		const find = (value: number) => options.find(o => o?.Value === value);
		return { yes: find(1)?.Label || "Yes", no: find(0)?.Label || "No" };
	}

	// Read-only whenever the form says so (field set to Read Only, record inactive, a business rule
	// or script locking it - all surface as isControlDisabled) OR column-level security denies
	// update on this column, which PCF reports separately via security.editable rather than folding
	// it into isControlDisabled. In the harness, ?readonly in the URL forces it on for testing.
	private isReadOnly(context: ComponentFramework.Context<IInputs>, testMode: boolean): boolean {
		if (context.mode.isControlDisabled) return true;
		if (context.parameters.value.security?.editable === false) return true;
		if (testMode && this.testModeParam('readonly') !== null) return true;
		return false;
	}

	public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void): void {
		console.log(`🚀 AdvancedYesNo: Version ${CONTROL_VERSION} Loaded`);

		try {
			initializeIconsForEnvironment();
		} catch (error) {
			console.warn("Icon initialization failed in init:", error);
		}

		this.notifyOutputChanged = notifyOutputChanged;
	}

	private onChange = (value: boolean) => {
		this.currentValue = value;
		if (this.isTestMode()) {
			this.testModeValue = value;
			this.testModeTouched = true;
		}
		this.notifyOutputChanged();
	};

	public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
		const testMode = this.isTestMode();

		const p = context.parameters;
		const yesColor = optionColor(testModeValue(p.yesColor?.raw ?? "", testMode, TEST_MODE_DEFAULT_COLORS.yes));
		const noColor = optionColor(testModeValue(p.noColor?.raw ?? "", testMode, TEST_MODE_DEFAULT_COLORS.no));
		let labels: { yes: string; no: string };
		const raw: unknown = context.parameters.value.raw;
		if (testMode) {
			// The harness gives the bound TwoOptions a real true/false select and round-trips the
			// output into it, so a boolean raw is the truth (a private copy reset on every property
			// change). ?value=empty shows the null state until the first click.
			if (this.testModeValue === undefined) {
				this.testModeValue = this.testModeParam('value') === 'empty' ? null : TEST_MODE_DEFAULT_VALUE;
			} else if (typeof raw === 'boolean' && (this.testModeValue !== null || this.testModeTouched)) {
				this.testModeValue = raw;
			}
			this.currentValue = this.testModeValue;
			labels = TEST_MODE_FIXTURES[this.testModeParam('fixture') ?? ""] ?? TEST_MODE_FIXTURES[TEST_MODE_DEFAULT_FIXTURE];
			setWebResourceUrlOverrides(TEST_MODE_WEB_RESOURCES);
		} else {
			// Only a real boolean is a value; anything else (null on a new record) is "no value".
			this.currentValue = typeof raw === 'boolean' ? raw : null;
			labels = this.readLabels(context);
		}
		const options: IYesNoOptions = {
			yes: { label: labels.yes, color: yesColor },
			no: { label: labels.no, color: noColor }
		};

		return React.createElement(AdvancedYesNoControl, {
			value: this.currentValue,
			options,
			onChange: this.onChange,
			isDisabled: this.isReadOnly(context, testMode),
			fontFamily: buildFontStack(readThemeFont(context, testMode)),
			config: this.parseConfig(context.parameters, testMode)
		});
	}

	public getOutputs(): IOutputs {
		return {
			value: this.currentValue ?? undefined
		};
	}

	public destroy(): void {
		// Nothing to clean up - React unmounting is handled by the framework for virtual controls
	}
}
