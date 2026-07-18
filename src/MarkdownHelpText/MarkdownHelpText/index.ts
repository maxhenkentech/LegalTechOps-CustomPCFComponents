import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { MarkdownHelpTextControl } from "./MarkdownHelpTextControl";
import { TEST_MODE_MARKDOWN } from "./TestModeData";

initializeIcons();

// Neither of these is part of the published PCF typings; both are populated at runtime on a real
// model-driven form (mirrors the fallback approach RelationshipViewControl.tsx uses for the same
// problem, and AdvancedOptionsControl.tsx's entity/attribute resolution before that).
function resolveCurrentRecordContext(
  mode: ComponentFramework.Mode,
  utils: ComponentFramework.Utility
): { entityTypeName?: string; entityId?: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modeAny = mode as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const utilsAny = utils as any;

  let entityTypeName: string | undefined = modeAny?.contextInfo?.entityTypeName;
  let entityId: string | undefined = modeAny?.contextInfo?.entityId;

  if (!entityTypeName || !entityId) {
    const page = utilsAny?.page;
    entityTypeName = entityTypeName || page?.entityTypeName;
    entityId = entityId || page?.entityId;
  }

  return { entityTypeName, entityId };
}

export class MarkdownHelpText implements ComponentFramework.ReactControl<IInputs, IOutputs> {
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
    // No initialization needed - all state is owned by MarkdownHelpTextControl.
  }

  public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
    const isTestMode = this.isTestMode();
    const boundText = context.parameters.boundText?.raw || undefined;
    const markdownText = context.parameters.markdownText?.raw || undefined;
    const markdown = boundText ?? markdownText ?? (isTestMode ? TEST_MODE_MARKDOWN : "");
    const calloutTextLayout = context.parameters.calloutTextLayout?.raw || "SameLine";
    const lineSpacing = context.parameters.lineSpacing?.raw ?? 1.55;
    const { entityTypeName, entityId } = resolveCurrentRecordContext(context.mode, context.utils);

    return React.createElement(MarkdownHelpTextControl, {
      markdown,
      navigation: context.navigation,
      isTestMode,
      calloutTextLayout,
      lineSpacing,
      webAPI: context.webAPI,
      entityLogicalName: entityTypeName,
      entityId,
    });
  }

  public getOutputs(): IOutputs {
    return {};
  }

  public destroy(): void {
    // No cleanup needed.
  }
}
