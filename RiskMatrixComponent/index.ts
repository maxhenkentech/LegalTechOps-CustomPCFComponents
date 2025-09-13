import {IInputs, IOutputs} from "./generated/ManifestTypes";
// Prove the bundle actually loads
console.log("[PCF] index.ts module loaded");

export class RiskMatrixComponent implements ComponentFramework.StandardControl<IInputs, IOutputs> {

    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;
    private _blinkTimer?: number;
    private _debugOverlay?: HTMLDivElement;

    constructor() {
    }

    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
        this._context = context;
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;

        try {
            console.log("[PCF] init called");
            console.log("[PCF] Manifest validation passed - component loading");

            // Force visibility
            this._container.style.cssText = `
                width: 100%;
                min-height: 220px;
                background-color: #fffbe6;
                border: 3px dashed #ff9800;
                position: relative;
                box-sizing: border-box;
                padding: 12px;
            `;

            // Floating debug overlay (top-left of iframe)
            this._debugOverlay = document.createElement("div");
            this._debugOverlay.style.cssText = `
                position: fixed;
                top: 8px;
                left: 8px;
                z-index: 99999;
                background: rgba(0,0,0,0.8);
                color: #0f0;
                font: 12px/1.4 monospace;
                padding: 6px 8px;
                border-radius: 4px;
            `;
            this._debugOverlay.textContent = `PCF loaded @ ${new Date().toLocaleTimeString()}`;
            document.body.appendChild(this._debugOverlay);

            // Clear and render interactive content
            this._container.innerHTML = "";

            const title = document.createElement("div");
            title.textContent = "PCF Test Surface";
            title.style.cssText = "font: 600 16px Segoe UI, Arial; margin-bottom: 8px; color:#333;";
            this._container.appendChild(title);

            const info = document.createElement("div");
            info.textContent = `Location: ${location.href}`;
            info.style.cssText = "font: 12px monospace; color:#555; margin-bottom: 8px;";
            this._container.appendChild(info);

            // Show the bound property value
            const propInfo = document.createElement("div");
            propInfo.textContent = `Parameters: ${Object.keys(context.parameters).join(', ') || 'None'}`;
            propInfo.style.cssText = "font: 12px monospace; color:#666; margin-bottom: 8px;";
            this._container.appendChild(propInfo);

            // Interactive button
            const btn = document.createElement("button");
            btn.textContent = "Click to confirm PCF is running";
            btn.style.cssText = `
                padding: 10px 14px;
                background: #0078d4;
                color: #fff;
                border: 0;
                border-radius: 4px;
                cursor: pointer;
            `;
            btn.onclick = () => alert("PCF Component is running and responding to clicks.");
            this._container.appendChild(btn);

            // Heartbeat blink (prove ongoing updates)
            let toggled = false;
            this._blinkTimer = window.setInterval(() => {
                toggled = !toggled;
                this._container.style.backgroundColor = toggled ? "#e3f2fd" : "#fffbe6";
            }, 700);

            console.log("[PCF] init finished");
        } catch (e) {
            console.error("[PCF] init error", e);
            this._container.innerHTML = `<pre style="color:red;white-space:pre-wrap;">Init error: ${String(e)}\n\nCheck ControlManifest.Input.xml for syntax errors.</pre>`;
        }
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        // Update the component when data changes
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        // Clean up resources
        if (this._blinkTimer) {
            clearInterval(this._blinkTimer);
            this._blinkTimer = undefined;
        }
        if (this._debugOverlay && this._debugOverlay.parentElement) {
            this._debugOverlay.parentElement.removeChild(this._debugOverlay);
            this._debugOverlay = undefined;
        }
        if (this._container) {
            this._container.innerHTML = "";
            this._container.removeAttribute("style");
        }
    }
}