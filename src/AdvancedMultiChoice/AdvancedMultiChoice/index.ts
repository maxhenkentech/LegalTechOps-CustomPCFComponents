import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from 'react';
import { initializeIcons } from '@fluentui/react/lib/Icons';
import { AdvancedMultiChoiceControl, IChoiceOption, IConfig, IMetadataSource, setWebResourceUrlOverrides } from "./AdvancedMultiChoiceControl";
import { TEST_MODE_OPTIONS, TEST_MODE_DEFAULT_SELECTION, TEST_MODE_WEB_RESOURCES } from "./TestModeData";
import { buildFontStack, readThemeFont } from "./ThemeFont";

const CONTROL_VERSION = "1.0.0";

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

export class AdvancedMultiChoice implements ComponentFramework.ReactControl<IInputs, IOutputs> {

	private notifyOutputChanged: () => void;
	private currentValues: number[] = [];
	// Harness-only: the PCF test harness does not round-trip a MultiSelectOptionSet output back
	// into `raw` reliably, so in test mode the selection lives here after the first render.
	private testModeSelection: number[] | null = null;

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

	private parseConfig(p: IInputs): IConfig {
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

		return {
			useExternalValueForIcon: toBool(p.useExternalValueForIcon?.raw, true),
			iconFixedName: p.iconFixedName?.raw?.trim() ?? "",
			selectedDisplayMode: p.selectedDisplayMode?.raw ?? "Pills",
			sortBy: p.sortBy?.raw ?? "Value",
			searchDescriptions: toBool(p.searchDescriptions?.raw, true),
			hideHiddenOptions: toBool(p.hideHiddenOptions?.raw, true),
			placeholderText: p.placeholderText?.raw || "Search options...",
			componentHeight: p.componentHeight?.raw ?? "Short",
			selectionShape: p.selectionShape?.raw ?? "Rounded",
			makeFontBold: toBool(p.makeFontBold?.raw, false),
			selectionBackgroundMode: p.selectionBackgroundMode?.raw ?? "CustomColorFaded",
			selectionColor: normalizeHex(p.selectionColor?.raw, "#EDF3FB"),
			pillBorderMode: p.pillBorderMode?.raw ?? "ChoiceColor",
			pillBorderColor: normalizeHex(p.pillBorderColor?.raw, "#255BA4"),
			iconColorMode: p.iconColorMode?.raw ?? "ChoiceColor",
			iconColor: normalizeHex(p.iconColor?.raw, "#255BA4"),
			hoverColor: normalizeHex(p.hoverColor?.raw, "#F3F2F1"),
			listSelectedColor: normalizeHex(p.listSelectedColor?.raw, "#EDF3FB")
		};
	}

	// The PCF SDK only exposes Label/Value/Color per option - Description, ExternalValue and
	// IsHidden come from a direct Web API metadata fetch inside the control, which needs these.
	private resolveMetadataSource(context: ComponentFramework.Context<IInputs>): IMetadataSource {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const inputAny = context.parameters.optionsInput as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const modeAny = context.mode as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const contextAny = context as any;

		const entityName: string | undefined =
			inputAny?.etn ||
			modeAny?.contextInfo?.entityTypeName ||
			contextAny?.page?.entityTypeName ||
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(context.parameters as any)?.entityTypeName;

		const attributeName: string | undefined =
			inputAny?.attributes?.LogicalName ||
			inputAny?.logicalName ||
			inputAny?._logicalName;

		return { entityName, attributeName };
	}

	// Read-only whenever the form says so (field set to Read Only, record inactive, a business rule
	// or script locking it - all surface as isControlDisabled) OR column-level security denies
	// update on this column, which PCF reports separately via security.editable rather than folding
	// it into isControlDisabled. In the harness, ?readonly in the URL forces it on for testing.
	private isReadOnly(context: ComponentFramework.Context<IInputs>, testMode: boolean): boolean {
		if (context.mode.isControlDisabled) return true;
		if (context.parameters.optionsInput.security?.editable === false) return true;
		if (testMode && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('readonly')) return true;
		return false;
	}

	public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void): void {
		console.log(`🚀 AdvancedMultiChoice: Version ${CONTROL_VERSION} Loaded`);

		try {
			initializeIconsForEnvironment();
		} catch (error) {
			console.warn("Icon initialization failed in init:", error);
		}

		this.notifyOutputChanged = notifyOutputChanged;
	}

	private onChange = (values: number[]) => {
		this.currentValues = values;
		if (this.isTestMode()) this.testModeSelection = values;
		this.notifyOutputChanged();
	};

	public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
		const testMode = this.isTestMode();
		// Only trust real numbers: the test harness hands this property its placeholder string
		// "val", which would otherwise be iterated character by character into three bogus values.
		const rawValue: unknown = context.parameters.optionsInput.raw;
		const raw = Array.isArray(rawValue)
			? rawValue.map(v => Number(v)).filter(v => Number.isInteger(v))
			: [];

		let options: IChoiceOption[];
		if (testMode) {
			if (this.testModeSelection === null) {
				this.testModeSelection = raw.length ? [...raw] : [...TEST_MODE_DEFAULT_SELECTION];
			}
			this.currentValues = this.testModeSelection;
			options = TEST_MODE_OPTIONS;
			setWebResourceUrlOverrides(TEST_MODE_WEB_RESOURCES);
		} else {
			this.currentValues = [...raw];
			options = (context.parameters.optionsInput.attributes?.Options || []).map(opt => {
				const optAny = opt as unknown as Record<string, unknown>;
				return {
					value: opt.Value,
					label: opt.Label,
					color: opt.Color || undefined,
					description: (optAny.Description as string) || "",
					externalValue: (optAny.ExternalValue as string) || "",
					isHidden: optAny.IsHidden === true
				};
			});
		}

		return React.createElement(AdvancedMultiChoiceControl, {
			options,
			selectedValues: this.currentValues,
			onChange: this.onChange,
			isDisabled: this.isReadOnly(context, testMode),
			fontFamily: buildFontStack(readThemeFont(context, testMode)),
			config: this.parseConfig(context.parameters),
			metadataSource: testMode ? undefined : this.resolveMetadataSource(context)
		});
	}

	public getOutputs(): IOutputs {
		return {
			optionsInput: this.currentValues.length ? this.currentValues : undefined
		};
	}

	public destroy(): void {
		// Nothing to clean up - React unmounting is handled by the framework for virtual controls
	}
}
