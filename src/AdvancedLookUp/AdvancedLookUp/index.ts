import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { ThemeFontScope, buildFontStack, readThemeFont } from "./ThemeFont";
import * as React from "react";
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { AdvancedLookUpControl } from "./AdvancedLookUpControl";

initializeIcons();

export class AdvancedLookUp implements ComponentFramework.ReactControl<IInputs, IOutputs> {
  private currentValue: ComponentFramework.LookupValue[] = [];
  private notifyOutputChanged: () => void;

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

  // Read-only when the form says so (field set Read Only, inactive record, business rule/script -
  // all surface as isControlDisabled) OR column-level security denies update on this column, which
  // PCF reports separately via security.editable. ?readonly in the harness URL forces it on.
  private isReadOnly(context: ComponentFramework.Context<IInputs>): boolean {
    if (context.mode.isControlDisabled) return true;
    if (context.parameters.lookupValue.security?.editable === false) return true;
    return this.isTestMode() && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("readonly");
  }

  private onSelect = (value: ComponentFramework.LookupValue | undefined): void => {
    this.currentValue = value ? [value] : [];
    this.notifyOutputChanged();
  };

  public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary): void {
    this.notifyOutputChanged = notifyOutputChanged;
    this.currentValue = context.parameters.lookupValue.raw ?? [];
  }

  // The app's custom theme font (model-driven modern theme `font`), falling back to the previous
  // Segoe UI stack - see ThemeFont.tsx. display:contents: the font inherits through the wrapper
  // without it creating a box, so layout is unchanged.
  private withThemeFont(context: ComponentFramework.Context<IInputs>, element: React.ReactElement): React.ReactElement {
    const fontFamily = buildFontStack(readThemeFont(context, this.isTestMode()));
    return React.createElement(ThemeFontScope, { fontFamily },
      React.createElement("div", { className: "lops-theme-font", style: { fontFamily, display: "contents" } }, element));
  }

  public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
    this.currentValue = context.parameters.lookupValue.raw ?? [];

    return this.withThemeFont(context, React.createElement(AdvancedLookUpControl, {
      lookupValueProperty: context.parameters.lookupValue,
      iconColumnName: context.parameters.iconColumnName?.raw || undefined,
      iconFixedName: context.parameters.iconFixedName?.raw || undefined,
      iconShape: context.parameters.iconShape?.raw ?? "Full",
      iconBackgroundColor: context.parameters.iconBackgroundColor?.raw || undefined,
      iconColor: context.parameters.iconColor?.raw || undefined,
      recordBackdropColor: context.parameters.recordBackdropColor?.raw || "#EDF3FB",
      tooltipColumnName: context.parameters.tooltipColumnName?.raw || undefined,
      labelColumnName: context.parameters.labelColumnName?.raw || undefined,
      searchColumns: context.parameters.searchColumns?.raw || undefined,
      sortColumnName: context.parameters.sortColumnName?.raw || undefined,
      additionalDisplayColumns: context.parameters.additionalDisplayColumns?.raw || undefined,
      showInactiveRecords: context.parameters.showInactiveRecords?.raw ?? false,
      resultLimit: context.parameters.resultLimit?.raw ?? 10,
      componentHeight: context.parameters.componentHeight?.raw ?? "Short",
      placeholderText: context.parameters.placeholderText?.raw || "Search records...",
      selectionShape: context.parameters.selectionShape?.raw ?? "Rounded",
      hoverColor: context.parameters.hoverColor?.raw || "#F3F2F1",
      listSelectedColor: context.parameters.listSelectedColor?.raw || "#EDF3FB",
      fontFamily: buildFontStack(readThemeFont(context, this.isTestMode())),
      isDisabled: this.isReadOnly(context),
      webAPI: context.webAPI,
      navigation: context.navigation,
      isTestMode: this.isTestMode(),
      onSelect: this.onSelect,
    }));
  }

  public getOutputs(): IOutputs {
    return {
      lookupValue: this.currentValue,
    };
  }

  public destroy(): void {
    // No cleanup needed.
  }
}
