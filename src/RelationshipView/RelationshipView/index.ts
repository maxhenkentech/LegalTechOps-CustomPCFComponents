import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { RelationshipViewControl } from "./RelationshipViewControl";

initializeIcons();

export class RelationshipView implements ComponentFramework.ReactControl<IInputs, IOutputs> {
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

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ): void {
    // No initialization needed - all state is owned by RelationshipViewControl.
  }

  public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
    const parentLookupProperty = context.parameters.parentLookup;
    const showState = context.parameters.showState?.raw ?? true;
    const showInactiveRecords = context.parameters.showInactiveRecords?.raw ?? true;
    const maxParentLevels = context.parameters.maxParentLevels?.raw ?? -1;
    const maxChildLevels = context.parameters.maxChildLevels?.raw ?? -1;
    const siblingDisplay = context.parameters.siblingDisplay?.raw ?? "None";
    const sortByColumnName = context.parameters.sortByColumnName?.raw || undefined;
    const sortDirection = context.parameters.sortDirection?.raw ?? "Ascending";
    const customAttribute1 = context.parameters.customAttribute1?.raw || undefined;
    const customAttribute2 = context.parameters.customAttribute2?.raw || undefined;
    const customAttribute3 = context.parameters.customAttribute3?.raw || undefined;
    const thumbnailColumnName = context.parameters.thumbnailColumnName?.raw || undefined;
    const thumbnailStyle = context.parameters.thumbnailStyle?.raw ?? "Circle";
    const thumbnailRenderingOption = context.parameters.thumbnailRenderingOption?.raw ?? "Cover";
    const quickViewFormName = context.parameters.quickViewFormName?.raw || undefined;
    const choiceColorDisplay = context.parameters.choiceColorDisplay?.raw ?? "None";
    const currentRecordHighlightColor = context.parameters.currentRecordHighlightColor?.raw || "#F3F2F1";
    const indentation = context.parameters.indentation?.raw ?? "Medium";

    return React.createElement(RelationshipViewControl, {
      parentLookupProperty,
      showState,
      showInactiveRecords,
      maxParentLevels: maxParentLevels ?? -1,
      maxChildLevels: maxChildLevels ?? -1,
      siblingDisplay,
      sortByColumnName,
      sortDirection,
      customAttribute1,
      customAttribute2,
      customAttribute3,
      thumbnailColumnName,
      thumbnailStyle,
      thumbnailRenderingOption,
      quickViewFormName,
      choiceColorDisplay,
      currentRecordHighlightColor,
      indentation,
      webAPI: context.webAPI,
      navigation: context.navigation,
      mode: context.mode,
      utils: context.utils,
      isTestMode: this.isTestMode(),
    });
  }

  public getOutputs(): IOutputs {
    return {};
  }

  public destroy(): void {
    // No cleanup needed.
  }
}
