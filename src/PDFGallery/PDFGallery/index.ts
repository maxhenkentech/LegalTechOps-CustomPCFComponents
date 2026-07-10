import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { initializeIcons } from "@fluentui/react/lib/Icons";
import { PDFGalleryControl } from "./PDFGalleryControl";

initializeIcons();

export class PDFGallery implements ComponentFramework.ReactControl<IInputs, IOutputs> {
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

  /**
   * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
   * Data-set values are not initialized here, use updateView.
   * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
   * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
   * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
   * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
   */
  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement,
  ): void {
    // No initialization needed - all state is owned by PDFGalleryControl.
  }

  /**
   * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
   * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
   */
  public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
    const dataset = context.parameters.documents;
    const fileColumnName = context.parameters.fileColumnName.raw ?? "";
    const tabLabelColumnName = context.parameters.tabLabelColumnName?.raw || undefined;
    const allowDownload = context.parameters.allowDownload?.raw ?? true;

    return React.createElement(PDFGalleryControl, {
      dataset,
      fileColumnName,
      tabLabelColumnName,
      allowDownload,
      webAPI: context.webAPI,
      isTestMode: this.isTestMode(),
    });
  }

  /**
   * It is called by the framework prior to a control receiving new data.
   * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as "bound" or "output"
   */
  public getOutputs(): IOutputs {
    return {};
  }

  /**
   * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
   * i.e. cancelling any pending remote calls, removing listeners, etc.
   */
  public destroy(): void {
    // Cleanup handled by PDFGalleryControl's own effect teardown (React unmounts it for us).
  }
}
