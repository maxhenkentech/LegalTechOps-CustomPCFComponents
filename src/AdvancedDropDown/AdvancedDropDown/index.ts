import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { ThemeFontScope, buildFontStack, readThemeFont } from "./ThemeFont";
import * as React from 'react';
import { AdvancedOptionsControl, IConfig, ISetupSchema, setWebResourceUrlOverrides } from "./AdvancedOptionsControl";
import { TEST_MODE_OPTIONS, TEST_MODE_WEB_RESOURCES } from "./TestModeData";

import { initializeIcons } from '@fluentui/react/lib/Icons';

const CONTROL_VERSION = "3.8.2";

// Initialize icons for both test harness and production
const initializeIconsForEnvironment = () => {
	try {
		// Initialize standard icons multiple times to ensure they load in Power Platform
		initializeIcons();

		// Force icon initialization again after a short delay for Power Platform compatibility
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
		console.error("❌ CRITICAL error during metadata fetch setup:", err);
		return false;
	}
};

// Initialize icons immediately
initializeIconsForEnvironment();



export class AdvancedDropDown implements ComponentFramework.ReactControl<IInputs, IOutputs> {

	private defaultValue: number | undefined;
	private currentValue: number | null;
	private notifyOutputChanged: () => void;

	constructor() {
		// Constructor intentionally empty
	}

	private isTestMode(): boolean {
		const hostname = typeof window !== 'undefined' ? window.location?.hostname : '';
		const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost');
		const isTestHarness = typeof window !== 'undefined' &&
			(window.location?.port === '8181' || // Default PCF test harness port
				window.location?.href?.includes('_pkg/') || // Test harness URL pattern
				document.title?.includes('Test harness')); // Test harness title
		return isLocalhost || isTestHarness;
	}

	// Read-only whenever the form says so (field set Read Only, inactive record, business rule or
	// script - all surface as isControlDisabled) OR column-level security denies update on this
	// column, which PCF reports separately via security.editable. In the harness, ?readonly in the
	// URL forces it on, since the harness has no disabled toggle.
	private isReadOnly(context: ComponentFramework.Context<IInputs>, testMode: boolean): boolean {
		if (context.mode.isControlDisabled) return true;
		if (context.parameters.optionsInput.security?.editable === false) return true;
		if (testMode && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('readonly')) return true;
		return false;
	}

	// Every fallback here matches the manifest default-value. Every property name and meaning is
	// unchanged from earlier versions (backward compatible); v3.8.0 only added selectionShape,
	// selectionColor, hoverColor and listSelectedColor.
	private parseConfig(p: IInputs): IConfig {
		const normalizeHex = (value: string | null | undefined): string | undefined => {
			if (!value || value.trim() === "") return undefined;
			const trimmed = value.trim();
			return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
		};
		// The Form Editor preview has been observed handing TwoOptions back as the string "false"
		// (ModernChoiceButtons v1.8.x), which `??` would treat as truthy.
		const toBool = (value: boolean | string | null | undefined, fallback: boolean): boolean => {
			if (value === undefined || value === null) return fallback;
			if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
			return value;
		};

		const iconConfig = p.icon?.raw ?? undefined;
		const isJSON = !!iconConfig && iconConfig.includes("{");
		const defaultIcon = "FullCircleMask";

		return {
			jsonConfig: isJSON ? JSON.parse(iconConfig as string) as ISetupSchema : undefined,
			defaultIconName: (!isJSON ? iconConfig : defaultIcon) ?? defaultIcon,
			sortBy: p.sortBy?.raw ?? "Value",
			hideHiddenOptions: toBool(p.hideHiddenOptions?.raw, true),
			showColorIcon: toBool(p.showColorIcon?.raw, true),
			showColorBorder: toBool(p.showColorBorder?.raw, false),
			showColorBackground: p.showColorBackground?.raw ?? "No",
			makeFontBold: toBool(p.makeFontBold?.raw, false),
			componentHeight: p.componentHeight?.raw ?? "Short",
			iconColorOverride: normalizeHex(p.iconColorOverride?.raw),
			useExternalValueForIcon: toBool(p.useExternalValueForIcon?.raw, false),
			placeholderText: p.placeholderText?.raw || "---",
			selectionShape: p.selectionShape?.raw ?? "Rounded",
			selectionColor: normalizeHex(p.selectionColor?.raw) ?? "#EDF3FB",
			hoverColor: normalizeHex(p.hoverColor?.raw) ?? "#F3F2F1",
			listSelectedColor: normalizeHex(p.listSelectedColor?.raw) ?? "#EDF3FB"
		};
	}

	public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void): void {
		console.log(`🚀 AdvancedDropDown: Version ${CONTROL_VERSION} Loaded`);

		try {
			initializeIconsForEnvironment();
		} catch (error) {
			console.warn("Icon initialization failed in init:", error);
		}

		this.defaultValue = context.parameters.optionsInput.attributes?.DefaultValue;
		this.notifyOutputChanged = notifyOutputChanged;
	}

	private onChange = (newValue: number | null) => {
		this.currentValue = newValue;
		this.notifyOutputChanged();
	};

	// The app's custom theme font (model-driven modern theme `font`), falling back to the previous
	// Segoe UI stack - see ThemeFont.tsx. display:contents: the font inherits through the wrapper
	// without it creating a box, so layout is unchanged.
	private withThemeFont(context: ComponentFramework.Context<IInputs>, element: React.ReactElement): React.ReactElement {
		const fontFamily = buildFontStack(readThemeFont(context, this.isTestMode()));
		return React.createElement(ThemeFontScope, { fontFamily },
			React.createElement("div", { className: "lops-theme-font", style: { fontFamily, display: "contents" } }, element));
	}

	public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
		const testMode = this.isTestMode();
		const raw: unknown = context.parameters.optionsInput.raw;
		// The harness can hand the bound property a non-number placeholder; only trust integers.
		this.currentValue = typeof raw === 'number' && Number.isInteger(raw) ? raw : null;

		const config = this.parseConfig(context.parameters);

		let sourceOptions: ComponentFramework.PropertyHelper.OptionMetadata[];
		if (testMode) {
			sourceOptions = TEST_MODE_OPTIONS;
			setWebResourceUrlOverrides(TEST_MODE_WEB_RESOURCES);
		} else {
			sourceOptions = context.parameters.optionsInput.attributes?.Options || [];
		}

		const filteredOptions = config.hideHiddenOptions
			? sourceOptions.filter(opt => (opt as unknown as Record<string, unknown>).IsHidden !== true)
			: sourceOptions;

		return this.withThemeFont(context, React.createElement(AdvancedOptionsControl, {
			rawOptions: filteredOptions,
			selectedKey: this.currentValue,
			onChange: this.onChange,
			isDisabled: this.isReadOnly(context, testMode),
			defaultValue: this.defaultValue,
			config,
			contextUtils: context.utils,
			contextParameters: context.parameters,
			contextMode: context.mode,
			fontFamily: buildFontStack(readThemeFont(context, testMode))
		}));
	}

	public getOutputs(): IOutputs {
		return {
			optionsInput: this.currentValue == null ? undefined : this.currentValue
		};
	}

	public destroy(): void {
		// Nothing to clean up - React unmounting is handled by the framework for virtual controls
	}
}
