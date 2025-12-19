import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { IDropdownOption } from "@fluentui/react/lib/Dropdown";
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { AdvancedOptionsControl, IConfig, ISetupSchema } from "./AdvancedOptionsControl";
import { initializeIcons } from '@fluentui/react/lib/Icons';

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
					console.log("🎨 Icons re-initialized for Power Platform compatibility");
				} catch (e) {
					console.warn("Secondary icon initialization failed:", e);
				}
			}, 100);
		}

		console.log("🎨 Icons initialized successfully");
		return true;
	} catch (error) {
		console.warn("Could not initialize icons:", error);
		return false;
	}
};

// Initialize icons immediately
initializeIconsForEnvironment();



const DEFAULT_OPTIONS: ComponentFramework.PropertyHelper.OptionMetadata[] = [{
	Value: 1,
	Label: "Accounting",
	Color: "#ff0000"
},
{
	Value: 2,
	Label: "Development, this is a pretty long line",
	Color: "#00ff00"
},
{
	Value: 3,
	Label: "Management, and this is an even longer line",
	Color: "#e4ff18ff"
},
{
	Value: 4,
	Label: "Option 4",
	Color: "#00ffee"
},
{
	Value: 5,
	Label: "Option 5",
	Color: "#2a005bff"
}
];

// Enhanced test options with colors and descriptions for testing
const TEST_MODE_OPTIONS = [{
	Value: 125980999,
	Label: "0 - No Impact",
	Color: "#9bff82",
	Description: "This option represents no business impact"
} as ComponentFramework.PropertyHelper.OptionMetadata & { Description: string },
{
	Value: 125980001,
	Label: "2 - Low to Medium",
	Color: "#ffe100",
	Description: "Low to medium business impact with some operational effects"
} as ComponentFramework.PropertyHelper.OptionMetadata & { Description: string },
{
	Value: 125980002,
	Label: "3 - High",
	Color: "#ff9100",
	Description: "High business impact affecting multiple departments",
	ExternalValue: "Warning"
} as ComponentFramework.PropertyHelper.OptionMetadata & { Description: string, ExternalValue: string },
{
	Value: 125980003,
	Label: "4 - Very High",
	Color: "#ff1414",
	Description: "Critical business impact requiring immediate attention",
	ExternalValue: "WarningSolid"
} as ComponentFramework.PropertyHelper.OptionMetadata & { Description: string, ExternalValue: string },
{
	Value: 125980000,
	Label: "1 - Undetermined yet (Hidden)",
	Color: "#dbdbdb",
	Description: "This option should be hidden in normal mode",
	IsHidden: true
} as ComponentFramework.PropertyHelper.OptionMetadata & { Description: string, IsHidden: boolean }
];



export class AdvancedDropDown implements ComponentFramework.ReactControl<IInputs, IOutputs> {

	private allOptions: ComponentFramework.PropertyHelper.OptionMetadata[];
	private dropdownOptions: IDropdownOption[];
	private defaultValue: number | undefined;
	private isDisabled: boolean;

	private container: HTMLDivElement;
	private currentValue: number | null;
	private notifyOutputChanged: () => void;

	private config: IConfig | undefined;


	constructor() {
		// Constructor intentionally empty
	}

	private isTestMode(): boolean {
		// Detect if running in test/development mode
		// This can be detected by checking if we're in a test harness environment
		// or if the options are the default test data from the test harness
		const hostname = typeof window !== 'undefined' ? window.location?.hostname : '';
		const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost');

		// Also check for typical test harness indicators
		const isTestHarness = typeof window !== 'undefined' &&
			(window.location?.port === '8181' || // Default PCF test harness port
				window.location?.href?.includes('_pkg/') || // Test harness URL pattern
				document.title?.includes('Test harness')); // Test harness title

		return isLocalhost || isTestHarness;
	}


	private parseIconConfig(defaultIcon: string, iconConfig?: string, sortBy?: "Text" | "Value", hideHiddenOptions?: boolean, showColorIcon?: boolean, showColorBorder?: boolean, showColorBackground?: "No" | "Lighter" | "Full", makeFontBold?: boolean, componentHeight?: "Tall" | "Short", iconColorOverride?: string, useExternalValueForIcon?: boolean): IConfig {
		const isJSON = iconConfig && iconConfig.includes("{");

		// Normalize hex color (ensure it starts with #)
		let normalizedIconColor: string | undefined;
		if (iconColorOverride) {
			normalizedIconColor = iconColorOverride.startsWith('#') ? iconColorOverride : `#${iconColorOverride}`;
		}

		this.config = {
			jsonConfig: isJSON === true ? JSON.parse(iconConfig as string) as ISetupSchema : undefined,
			defaultIconName: (!isJSON ? iconConfig : defaultIcon) ?? defaultIcon,
			sortBy: sortBy ?? "Value",
			hideHiddenOptions: hideHiddenOptions ?? true,
			showColorIcon: showColorIcon ?? false,
			showColorBorder: showColorBorder ?? false,
			showColorBackground: showColorBackground ?? "No",
			makeFontBold: makeFontBold ?? false,
			componentHeight: componentHeight ?? "Tall",
			iconColorOverride: normalizedIconColor,
			useExternalValueForIcon: useExternalValueForIcon ?? false
		}
		return this.config;
	}

	/**
	 * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
	 * Data-set values are not initialized here, use updateView.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
	 * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
	 * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
	 * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
	 */
	public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement) {
		console.log("using virtual control in AdvancedOptions");

		// Ensure icons are initialized in Power Platform environment
		try {
			initializeIconsForEnvironment();
		} catch (error) {
			console.warn("Icon initialization failed in init:", error);
		}

		this.defaultValue = context.parameters.optionsInput.attributes?.DefaultValue;

		this.container = container;
		this.notifyOutputChanged = notifyOutputChanged;

	}

	private onChange = (newValue: number | null) => {
		this.currentValue = newValue;
		this.notifyOutputChanged();
	};

	private renderControl(context: ComponentFramework.Context<IInputs>): React.ReactElement {
		console.log("entered renderControl in index.ts", context.updatedProperties);
		console.log("🔧 Raw componentHeight parameter:", context.parameters.componentHeight?.raw);

		this.isDisabled = context.mode.isControlDisabled;
		this.currentValue = context.parameters.optionsInput.raw;

		// Get configuration options
		const hideHiddenOptions = context.parameters.hideHiddenOptions?.raw ?? true;
		const showColorIcon = context.parameters.showColorIcon?.raw ?? false;
		const componentHeight = context.parameters.componentHeight?.raw ?? "Tall";
		const iconColorOverride = context.parameters.iconColorOverride?.raw || undefined;
		const showColorBorder = context.parameters.showColorBorder?.raw ?? false;
		const showColorBackground = context.parameters.showColorBackground?.raw ?? "No";
		const makeFontBold = context.parameters.makeFontBold?.raw ?? false;
		const useExternalValueForIcon = context.parameters.useExternalValueForIcon?.raw ?? false;

		console.log("🎯 Final componentHeight value:", componentHeight);
		console.log("🎨 Icon Color Override:", iconColorOverride);

		// Determine which options to use - test mode or actual data
		let sourceOptions: ComponentFramework.PropertyHelper.OptionMetadata[];
		const testMode = this.isTestMode();

		if (testMode) {
			console.log("🧪 Test mode detected - using enhanced test options with colors and descriptions");
			sourceOptions = TEST_MODE_OPTIONS as ComponentFramework.PropertyHelper.OptionMetadata[];
		} else {
			sourceOptions = context.parameters.optionsInput.attributes?.Options || [];
		}

		// Filter options based on hideHiddenOptions setting
		let filteredOptions = sourceOptions;
		if (hideHiddenOptions) {
			filteredOptions = filteredOptions.filter(opt => {
				const optAny = opt as unknown as Record<string, unknown>;
				return optAny.IsHidden !== true;
			});
		}

		// Get the color of the currently selected option for border styling
		const selectedOption = filteredOptions.find(opt => opt.Value === this.currentValue);
		const selectedColor = selectedOption?.Color;

		const params = {
			rawOptions: filteredOptions,
			selectedKey: this.currentValue,
			onChange: this.onChange,
			isDisabled: this.isDisabled,
			defaultValue: this.defaultValue,
			config: this.parseIconConfig( // Always regenerate config for real-time updates
				"FullCircleMask",
				context.parameters.icon?.raw ?? undefined,
				context.parameters.sortBy.raw,
				hideHiddenOptions,
				showColorIcon,
				showColorBorder,
				showColorBackground,
				makeFontBold,
				componentHeight,
				iconColorOverride,
				useExternalValueForIcon
			),
			selectedColor: selectedColor
		};
		return React.createElement(AdvancedOptionsControl, params);

	}


	/**
	 * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
	 */
	public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
		return this.renderControl(context);
	}

	/** 
	 * It is called by the framework prior to a control receiving new data. 
	 * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as "bound" or "output"
	 */
	public getOutputs(): IOutputs {
		return {
			optionsInput: this.currentValue == null ? undefined : this.currentValue
		};
	}

	/** 
	 * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
	 * i.e. cancelling any pending remote calls, removing listeners, etc.
	 */
	public destroy(): void {
		// Cleanup code would go here if needed
	}
}