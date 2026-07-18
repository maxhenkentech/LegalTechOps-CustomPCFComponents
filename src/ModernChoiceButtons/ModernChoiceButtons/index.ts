import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from 'react';
import { ModernChoiceButtonsControl, IConfig, ISetupSchema } from "./ModernChoiceButtonsControl";
import { initializeIcons } from '@fluentui/react/lib/Icons';

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

// Test-mode option data (used only in the PCF test harness, never against live Dataverse)
const TEST_MODE_OPTIONS = [{
	Value: 125980000,
	Label: "Draft",
	Color: "#dbdbdb",
	Description: "The record is still being drafted"
} as ComponentFramework.PropertyHelper.OptionMetadata & { Description: string },
{
	Value: 125980001,
	Label: "In Review",
	Color: "#ffe100",
	Description: "The record is under review",
	ExternalValue: "Search"
} as ComponentFramework.PropertyHelper.OptionMetadata & { Description: string, ExternalValue: string },
{
	Value: 125980002,
	Label: "Approved",
	Color: "#57a300",
	Description: "The record has been approved",
	ExternalValue: "CheckMark"
} as ComponentFramework.PropertyHelper.OptionMetadata & { Description: string, ExternalValue: string },
{
	Value: 125980003,
	Label: "Rejected",
	Color: "#d13438",
	Description: "The record was rejected",
	ExternalValue: "Cancel"
} as ComponentFramework.PropertyHelper.OptionMetadata & { Description: string, ExternalValue: string },
{
	Value: 125980004,
	Label: "On Hold (Hidden)",
	Color: "#a19f9d",
	Description: "This option should be hidden in normal mode",
	IsHidden: true
} as ComponentFramework.PropertyHelper.OptionMetadata & { Description: string, IsHidden: boolean }
];

export class ModernChoiceButtons implements ComponentFramework.ReactControl<IInputs, IOutputs> {

	private isDisabled: boolean;
	private currentValue: number | null;
	private notifyOutputChanged: () => void;
	private config: IConfig | undefined;

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

	private parseConfig(
		defaultIcon: string,
		iconConfig: string | undefined,
		useExternalValueForIcon: boolean | undefined,
		hideHiddenOptions: boolean | undefined,
		sortBy: "Value" | "Text" | undefined,
		tileShape: "Square" | "Rounded" | undefined,
		tileSize: "Small" | "Normal" | "Large" | undefined,
		showChoiceValue: boolean | undefined,
		makeFontBold: boolean | undefined,
		notSelectedColor: string | undefined,
		hoverColor: string | undefined,
		selectedBackgroundMode: "CustomColor" | "ChoiceColor" | "CustomColorFaded" | undefined,
		selectedColor: string | undefined,
		selectedBorderMode: "Off" | "CustomColor" | "ChoiceColor" | "CustomColorFaded" | undefined,
		selectedBorderColor: string | undefined,
		iconColorMode: "Auto" | "CustomColor" | "ChoiceColor" | "CustomColorFaded" | undefined,
		iconColor: string | undefined,
		iconColorScope: "AllTiles" | "SelectedOnly" | undefined
	): IConfig {
		const isJSON = iconConfig && iconConfig.trim().startsWith("{");

		const normalizeHex = (value: string | undefined, fallback: string): string => {
			if (!value || value.trim() === "") return fallback;
			return value.startsWith('#') ? value : `#${value}`;
		};

		this.config = {
			jsonConfig: isJSON ? JSON.parse(iconConfig as string) as ISetupSchema : undefined,
			defaultIconName: (!isJSON ? iconConfig : undefined) ?? defaultIcon,
			useExternalValueForIcon: useExternalValueForIcon ?? false,
			hideHiddenOptions: hideHiddenOptions ?? true,
			sortBy: sortBy ?? "Value",
			tileShape: tileShape ?? "Rounded",
			tileSize: tileSize ?? "Normal",
			showChoiceValue: showChoiceValue ?? true,
			makeFontBold: makeFontBold ?? false,
			notSelectedColor: normalizeHex(notSelectedColor, "#FFFFFF"),
			hoverColor: normalizeHex(hoverColor, "#DEECF9"),
			selectedBackgroundMode: selectedBackgroundMode ?? "CustomColor",
			selectedColor: normalizeHex(selectedColor, "#F3F2F1"),
			selectedBorderMode: selectedBorderMode ?? "CustomColor",
			selectedBorderColor: normalizeHex(selectedBorderColor, "#0078D4"),
			iconColorMode: iconColorMode ?? "Auto",
			iconColor: normalizeHex(iconColor, "#201F1E"),
			iconColorScope: iconColorScope ?? "AllTiles"
		};
		return this.config;
	}

	public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement) {
		console.log("🚀 ModernChoiceButtons: Version 1.4.0 Loaded");

		try {
			initializeIconsForEnvironment();
		} catch (error) {
			console.warn("Icon initialization failed in init:", error);
		}

		this.notifyOutputChanged = notifyOutputChanged;
	}

	private onChange = (newValue: number | null) => {
		this.currentValue = newValue;
		this.notifyOutputChanged();
	};

	private renderControl(context: ComponentFramework.Context<IInputs>): React.ReactElement {
		this.isDisabled = context.mode.isControlDisabled;
		this.currentValue = context.parameters.optionsInput.raw;

		const testMode = this.isTestMode();

		let sourceOptions: ComponentFramework.PropertyHelper.OptionMetadata[];
		if (testMode) {
			sourceOptions = TEST_MODE_OPTIONS as ComponentFramework.PropertyHelper.OptionMetadata[];
		} else {
			sourceOptions = context.parameters.optionsInput.attributes?.Options || [];
		}

		const config = this.parseConfig(
			"RadioBtnOff",
			context.parameters.icon?.raw ?? undefined,
			context.parameters.useExternalValueForIcon?.raw,
			context.parameters.hideHiddenOptions?.raw,
			context.parameters.sortBy?.raw,
			context.parameters.tileShape?.raw,
			context.parameters.tileSize?.raw,
			context.parameters.showChoiceValue?.raw,
			context.parameters.makeFontBold?.raw,
			context.parameters.notSelectedColor?.raw || undefined,
			context.parameters.hoverColor?.raw || undefined,
			context.parameters.selectedBackgroundMode?.raw,
			context.parameters.selectedColor?.raw || undefined,
			context.parameters.selectedBorderMode?.raw,
			context.parameters.selectedBorderColor?.raw || undefined,
			context.parameters.iconColorMode?.raw,
			context.parameters.iconColor?.raw || undefined,
			context.parameters.iconColorScope?.raw
		);

		const params = {
			rawOptions: sourceOptions,
			selectedKey: this.currentValue,
			onChange: this.onChange,
			isDisabled: this.isDisabled,
			config: config,
			contextUtils: context.utils,
			contextParameters: context.parameters,
			contextMode: context.mode
		};

		return React.createElement(ModernChoiceButtonsControl, params);
	}

	public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
		return this.renderControl(context);
	}

	public getOutputs(): IOutputs {
		return {
			optionsInput: this.currentValue == null ? undefined : this.currentValue
		};
	}

	public destroy(): void {
		// Cleanup code would go here if needed
	}
}
