import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { ThemeFontScope, buildFontStack, readThemeFont } from "./ThemeFont";
import * as React from "react";
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { ActivityGraphControl } from "./ActivityGraphControl";
import { Aggregation } from "./Calendar";
import { ActivityDate, Source, setUserTimeZoneOffset } from "./ActivityData";

initializeIcons();

const CONTROL_VERSION = "1.0.7";

export class ActivityGraph implements ComponentFramework.ReactControl<IInputs, IOutputs> {
	constructor() {
		// Constructor intentionally empty
	}

	private isTestMode(): boolean {
		const hostname = typeof window !== "undefined" ? window.location?.hostname || "" : "";
		const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname.includes("localhost");
		const isTestHarness =
			typeof window !== "undefined" &&
			(window.location?.port === "8181" || window.location?.href?.includes("_pkg/") || document.title?.includes("Test harness"));
		return isLocalhost || isTestHarness;
	}

	public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
		console.log(`🚀 ActivityGraph: Version ${CONTROL_VERSION} Loaded`);
	}

	// The app's custom theme font (model-driven modern theme `font`), falling back to the Segoe UI
	// stack - see ThemeFont.tsx. display:contents: the font inherits without adding a box.
	private withThemeFont(context: ComponentFramework.Context<IInputs>, fontFamily: string, element: React.ReactElement): React.ReactElement {
		return React.createElement(ThemeFontScope, { fontFamily }, React.createElement("div", { className: "lops-theme-font", style: { fontFamily, display: "contents" } }, element));
	}

	// The record the form shows. Neither path is in the published PCF typings; both are populated
	// at runtime on a model-driven form (same fallback as RelationshipView). No id = create form.
	private recordContext(context: ComponentFramework.Context<IInputs>): { entityTypeName?: string; entityId?: string } {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const modeAny = context.mode as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const page = (context as any).page ?? (context.utils as any)?.page;
		const entityTypeName: string | undefined = modeAny?.contextInfo?.entityTypeName || page?.entityTypeName;
		const entityId: string | undefined = modeAny?.contextInfo?.entityId || page?.entityId;
		return { entityTypeName, entityId: entityId || undefined };
	}

	// First day of the week, 0 = Sunday (PCF's DayOfWeek numbering). Monday by default (user
	// request 2026-10-03); Automatic reads the user's personal settings.
	private static readonly WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	private firstDayOfWeek(context: ComponentFramework.Context<IInputs>): number {
		const configured = context.parameters.firstDayOfWeek?.raw ?? "Monday";
		const index = ActivityGraph.WEEKDAYS.indexOf(configured);
		if (index >= 0) return index;
		try {
			const fromSettings = context.userSettings?.dateFormattingInfo?.firstDayOfWeek;
			if (typeof fromSettings === "number" && fromSettings >= 0 && fromSettings <= 6) return fromSettings;
		} catch {
			// fall through
		}
		return 1;
	}

	// One function for the control's lifetime (a stable prop, so the graph's memoised bucketing
	// doesn't rerun on every updateView), reading the latest context.
	private latestContext?: ComponentFramework.Context<IInputs>;
	private readonly timeZoneOffset = (d: Date): number => {
		try {
			const minutes = this.latestContext?.userSettings.getTimeZoneOffsetMinutes(d);
			if (typeof minutes === "number" && !isNaN(minutes)) return minutes;
		} catch {
			// harness / older hosts
		}
		return -d.getTimezoneOffset();
	};

	public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
		this.latestContext = context;
		setUserTimeZoneOffset(this.timeZoneOffset);
		const p = context.parameters;
		const yearsRaw = p.yearsToShow?.raw;
		const { entityTypeName, entityId } = this.recordContext(context);
		const fontFamily = buildFontStack(readThemeFont(context, this.isTestMode()));
		return this.withThemeFont(
			context,
			fontFamily,
			React.createElement(ActivityGraphControl, {
				source: (p.source?.raw ?? "Audit") as Source,
				activityDate: (p.activityDate?.raw ?? "CreatedOn") as ActivityDate,
				aggregation: (p.aggregation?.raw ?? "Day") as Aggregation,
				yearsToShow: typeof yearsRaw === "number" && yearsRaw > 0 ? Math.floor(yearsRaw) : 0,
				firstDayOfWeek: this.firstDayOfWeek(context),
				showDetails: p.showDetails?.raw ?? true,
				showSummary: p.showSummary?.raw ?? true,
				showLegend: p.showLegend?.raw ?? true,
				cellShape: p.cellShape?.raw ?? "Rounded",
				colorScheme: p.colorScheme?.raw ?? "Green",
				customColor: p.customColor?.raw || undefined,
				entityTypeName,
				entityId,
				webAPI: context.webAPI,
				navigation: context.navigation,
				timeZoneOffset: this.timeZoneOffset,
				isTestMode: this.isTestMode(),
				fontFamily,
			})
		);
	}

	public getOutputs(): IOutputs {
		return {};
	}

	public destroy(): void {
		// No cleanup needed.
	}
}
