import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from 'react';
import { QuickActionButtonsControl, IButtonConfig, IConfig } from "./QuickActionButtonsControl";
import { createLiveFieldAccessor } from "./XrmFieldAccess";
import { createTestFieldAccessor } from "./TestModeData";
import { initializeIcons } from '@fluentui/react/lib/Icons';

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
		console.error("CRITICAL error during icon initialization:", err);
		return false;
	}
};

initializeIconsForEnvironment();

export class QuickActionButtons implements ComponentFramework.ReactControl<IInputs, IOutputs> {

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

	private buildButtons(context: ComponentFramework.Context<IInputs>): IButtonConfig[] {
		const buttons: IButtonConfig[] = [];

		for (let i = 1; i <= 5; i++) {
			// Property names are numbered 1-5 in the manifest (button1Label...button5Actions) rather
			// than a dynamic list, so this indexed lookup needs a loose cast -- IInputs has no index
			// signature over a fixed set of named properties.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const params = context.parameters as any;
			const label: string | undefined = params[`button${i}Label`]?.raw ?? undefined;
			if (!label || label.trim() === '') continue;

			buttons.push({
				key: i,
				label,
				icon: params[`button${i}Icon`]?.raw ?? '',
				color: params[`button${i}Color`]?.raw || undefined,
				tooltip: params[`button${i}Tooltip`]?.raw || undefined,
				actionsRaw: params[`button${i}Actions`]?.raw ?? undefined,
			});
		}

		return buttons;
	}

	private parseConfig(context: ComponentFramework.Context<IInputs>): IConfig {
		const normalizeHex = (value: string | undefined, fallback: string): string => {
			if (!value || value.trim() === "") return fallback;
			return value.startsWith('#') ? value : `#${value}`;
		};

		const p = context.parameters;

		return {
			saveOnClick: p.saveOnClick?.raw ?? false,
			tileShape: p.tileShape?.raw ?? "Rounded",
			tileSize: p.tileSize?.raw ?? "Normal",
			showLabel: p.showLabel?.raw ?? true,
			iconPosition: p.iconPosition?.raw ?? "Above",
			reflowBehaviour: p.reflowBehaviour?.raw ?? "Wrap",
			makeFontBold: p.makeFontBold?.raw ?? false,
			backgroundMode: p.backgroundMode?.raw ?? "Fixed",
			buttonColor: normalizeHex(p.buttonColor?.raw || undefined, "#FFFFFF"),
			hoverColor: normalizeHex(p.hoverColor?.raw || undefined, "#DEECF9"),
			activeColor: normalizeHex(p.activeColor?.raw || undefined, "#C7E0F4"),
			borderMode: p.borderMode?.raw ?? "Fixed",
			borderColor: normalizeHex(p.borderColor?.raw || undefined, "#D2D0CE"),
			iconColorMode: p.iconColorMode?.raw ?? "Auto",
			iconColor: normalizeHex(p.iconColor?.raw || undefined, "#201F1E"),
		};
	}

	public init(context: ComponentFramework.Context<IInputs>): void {
		console.log("🚀 QuickActionButtons: Version 1.3.3 Loaded");

		try {
			initializeIconsForEnvironment();
		} catch (error) {
			console.warn("Icon initialization failed in init:", error);
		}
	}

	public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
		const testMode = this.isTestMode();
		const accessor = testMode ? createTestFieldAccessor() : createLiveFieldAccessor();

		const params = {
			buttons: this.buildButtons(context),
			isDisabled: context.mode.isControlDisabled,
			config: this.parseConfig(context),
			formAvailable: accessor.formAvailable,
			readField: accessor.readField,
			writeField: accessor.writeField,
			fieldExists: accessor.fieldExists,
			getCurrentUser: accessor.getCurrentUser,
			saveRecord: accessor.saveRecord,
			testMode,
		};

		return React.createElement(QuickActionButtonsControl, params);
	}

	public getOutputs(): IOutputs {
		// boundField exists only so the control can be attached to a form; its value is never
		// read or changed by this control.
		return {};
	}

	public destroy(): void {
		// Cleanup code would go here if needed
	}
}
