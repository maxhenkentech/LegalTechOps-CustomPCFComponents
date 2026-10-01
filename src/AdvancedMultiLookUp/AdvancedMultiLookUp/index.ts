import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { AdvancedMultiLookUpControl, IConfig, IParentRecord } from "./AdvancedMultiLookUpControl";
import { setWebResourceUrlOverrides } from "./Dataverse";
import { TEST_MODE_WEB_RESOURCES } from "./TestModeData";
import { ThemeFontScope, buildFontStack, readThemeFont } from "./ThemeFont";

const CONTROL_VERSION = "1.0.3";

initializeIcons();

export class AdvancedMultiLookUp implements ComponentFramework.ReactControl<IInputs, IOutputs> {
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

  private hasUrlFlag(flag: string): boolean {
    return this.isTestMode() && typeof window !== "undefined" && new URLSearchParams(window.location.search).has(flag);
  }

  // A dataset has no column-level security of its own (unlike a bound field's security.editable);
  // isControlDisabled covers a read-only subgrid, an inactive record and a business rule/script.
  // Missing Append/Append To privileges only surface when the write fails - see the control's notice.
  private isReadOnly(context: ComponentFramework.Context<IInputs>): boolean {
    return context.mode.isControlDisabled || this.hasUrlFlag("readonly");
  }

  // The form's own record. contextInfo is not in the PCF typings but is what every model-driven
  // subgrid host provides; page.entityId is the fallback some hosts use instead. A new, unsaved
  // record has no id yet, and nothing can be associated with it until it is saved.
  private resolveParent(context: ComponentFramework.Context<IInputs>): IParentRecord {
    if (this.isTestMode()) return { entityName: "lops_testparent", id: this.hasUrlFlag("unsaved") ? undefined : "22222222-2222-2222-2222-222222222201" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info = (context.mode as any)?.contextInfo ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = (context as any)?.page ?? {};
    const rawId: string | undefined = info.entityId || page.entityId;
    const id = rawId ? rawId.replace(/[{}]/g, "").toLowerCase() : undefined;
    return { entityName: info.entityTypeName || page.entityTypeName, id: id || undefined };
  }

  private parseConfig(p: IInputs): IConfig {
    const text = (value: string | null | undefined): string => (value ?? "").trim();
    // A maker can type a hex with or without '#'. Blank falls back to the manifest default.
    const hex = (value: string | null | undefined, fallback: string): string => {
      const v = text(value);
      if (!v) return fallback;
      return v.startsWith("#") ? v : `#${v}`;
    };
    // Same string-coercion guard as AdvancedMultiChoice: the form editor preview has been seen
    // handing TwoOptions back as the string "false".
    const toBool = (value: boolean | string | null | undefined, fallback: boolean): boolean => {
      if (value === undefined || value === null) return fallback;
      if (typeof value === "string") return value.trim().toLowerCase() === "true";
      return value;
    };

    // Fallbacks must match the manifest default-values (a maker clearing a property to blank).
    return {
      relationshipName: text(p.relationshipName?.raw),
      searchColumns: text(p.searchColumns?.raw),
      sortColumnName: text(p.sortColumnName?.raw),
      showInactiveRecords: toBool(p.showInactiveRecords?.raw, false),
      resultLimit: p.resultLimit?.raw ?? 10,
      placeholderText: p.placeholderText?.raw || "Search records...",
      labelColumnName: text(p.labelColumnName?.raw),
      additionalDisplayColumns: text(p.additionalDisplayColumns?.raw),
      tooltipColumnName: text(p.tooltipColumnName?.raw),
      sortBy: p.sortBy?.raw ?? "View",
      selectedDisplayMode: p.selectedDisplayMode?.raw ?? "Pills",
      componentHeight: p.componentHeight?.raw ?? "Short",
      selectionShape: p.selectionShape?.raw ?? "Rounded",
      makeFontBold: toBool(p.makeFontBold?.raw, false),
      iconColumnName: text(p.iconColumnName?.raw),
      iconFixedName: text(p.iconFixedName?.raw),
      iconShape: p.iconShape?.raw ?? "Full",
      iconBackgroundColor: text(p.iconBackgroundColor?.raw) ? hex(p.iconBackgroundColor?.raw, "") : "",
      iconColor: text(p.iconColor?.raw) ? hex(p.iconColor?.raw, "") : "",
      selectionColor: hex(p.selectionColor?.raw, "#EDF3FB"),
      pillBorderMode: p.pillBorderMode?.raw ?? "CustomColor",
      pillBorderColor: hex(p.pillBorderColor?.raw, "#255BA4"),
      hoverColor: hex(p.hoverColor?.raw, "#F3F2F1"),
      listSelectedColor: hex(p.listSelectedColor?.raw, "#EDF3FB"),
    };
  }

  public init(context: ComponentFramework.Context<IInputs>): void {
    console.log(`🚀 AdvancedMultiLookUp: Version ${CONTROL_VERSION} Loaded`);
    if (this.isTestMode()) setWebResourceUrlOverrides(TEST_MODE_WEB_RESOURCES);
  }

  public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
    const testMode = this.isTestMode();
    const dataset = context.parameters.records;

    // The subgrid only hands over the pages it has loaded. Keep loading until every related record
    // is in, or records past the first page would silently never show (PDFGallery's lesson).
    if (!testMode && !dataset.loading && dataset.paging?.hasNextPage) dataset.paging.loadNextPage();

    const relatedIds = testMode ? [] : dataset.sortedRecordIds ?? [];
    const relatedNames: Record<string, string> = {};
    if (!testMode) {
      relatedIds.forEach((id) => {
        const record = dataset.records[id];
        relatedNames[id] = record?.getNamedReference?.()?.name || record?.getFormattedValue?.(dataset.columns.find((c) => c.isPrimary)?.name ?? "") || "";
      });
    }

    let targetEntity = "";
    let linkedEntityNames: string[] = [];
    if (!testMode) {
      try {
        targetEntity = dataset.getTargetEntityType?.() || "";
      } catch {
        targetEntity = "";
      }
      try {
        linkedEntityNames = (dataset.linking?.getLinkedEntities?.() ?? []).map((l) => l.name).filter((n): n is string => !!n);
      } catch {
        linkedEntityNames = [];
      }
    }

    const fontFamily = buildFontStack(readThemeFont(context, testMode));
    // display:contents - the font inherits through the wrapper without it adding a box.
    return React.createElement(ThemeFontScope, { fontFamily },
      React.createElement("div", { className: "lops-theme-font", style: { fontFamily, display: "contents" } },
        React.createElement(AdvancedMultiLookUpControl, {
          config: this.parseConfig(context.parameters),
          relatedIds,
          relatedNames,
          datasetLoading: !testMode && dataset.loading,
          targetEntity,
          linkedEntityNames,
          formRecord: this.resolveParent(context),
          refreshRelated: () => {
            if (!testMode) dataset.refresh();
          },
          isDisabled: this.isReadOnly(context),
          isTestMode: testMode,
          simulateWriteFailure: this.hasUrlFlag("fail"),
          webAPI: context.webAPI,
          navigation: context.navigation,
          fontFamily,
        })));
  }

  public getOutputs(): IOutputs {
    // Nothing is bound: changes are written straight to the N:N relationship (associate /
    // disassociate), exactly like the out-of-the-box subgrid's Add Existing and Remove.
    return {};
  }

  public destroy(): void {
    // React unmounting is handled by the framework for virtual controls.
  }
}
