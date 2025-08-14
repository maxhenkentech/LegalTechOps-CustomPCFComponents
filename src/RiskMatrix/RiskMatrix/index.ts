import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class RiskMatrix implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _matrixContainer: HTMLDivElement;
    private _marker: HTMLDivElement;

    /**
     * Empty constructor.
     */
    constructor() {
        // Empty
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
        container: HTMLDivElement
    ): void {
        this._container = container;
        this.createRiskMatrix();
    }

    private createRiskMatrix(): void {
        // Main container
        this._matrixContainer = document.createElement("div");
        this._matrixContainer.style.position = "relative";
        this._matrixContainer.style.width = "420px";
        this._matrixContainer.style.height = "380px";
        this._matrixContainer.style.margin = "0";
        this._matrixContainer.style.fontFamily = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif";
        this._matrixContainer.style.backgroundColor = "#fafafa";
        this._matrixContainer.style.borderRadius = "8px";
        this._matrixContainer.style.padding = "8px";
        this._matrixContainer.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.1)";
        this._matrixContainer.style.border = "1px solid #e1e5e9";

        // Create labels
        this.createLabels();
        
        // Create grid
        this.createGrid();

        // Create marker
        this._marker = document.createElement("div");
        this._marker.innerHTML = "!";
        this._marker.style.position = "absolute";
        this._marker.style.width = "32px";
        this._marker.style.height = "32px";
        this._marker.style.borderRadius = "50%";
        this._marker.style.backgroundColor = "#323130";
        this._marker.style.color = "white";
        this._marker.style.display = "flex";
        this._marker.style.alignItems = "center";
        this._marker.style.justifyContent = "center";
        this._marker.style.fontSize = "18px";
        this._marker.style.fontWeight = "600";
        this._marker.style.zIndex = "10";
        this._marker.style.border = "2px solid white";
        this._marker.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
        this._marker.style.transition = "all 0.3s ease";
        this._matrixContainer.appendChild(this._marker);

        this._container.appendChild(this._matrixContainer);
    }

    private createLabels(): void {
        // Impact label (vertical)
        const impactLabel = document.createElement("div");
        impactLabel.textContent = "Impact";
        impactLabel.style.position = "absolute";
        impactLabel.style.left = "-15px";
        impactLabel.style.top = "160px";
        impactLabel.style.transform = "rotate(-90deg)";
        impactLabel.style.fontSize = "18px";
        impactLabel.style.fontWeight = "600";
        impactLabel.style.color = "#323130";
        impactLabel.style.transformOrigin = "center";
        impactLabel.style.letterSpacing = "0.5px";
        this._matrixContainer.appendChild(impactLabel);

        // Probability label (horizontal)
        const probabilityLabel = document.createElement("div");
        probabilityLabel.textContent = "Probability";
        probabilityLabel.style.position = "absolute";
        probabilityLabel.style.left = "260px";
        probabilityLabel.style.top = "360px";
        probabilityLabel.style.fontSize = "18px";
        probabilityLabel.style.fontWeight = "600";
        probabilityLabel.style.color = "#323130";
        probabilityLabel.style.letterSpacing = "0.5px";
        probabilityLabel.style.transform = "translateX(-50%)";
        this._matrixContainer.appendChild(probabilityLabel);

        // Impact scale labels (Y-axis, top to bottom: Critical, High, Medium, Low)
        const impactLabels = ["Critical", "High", "Medium", "Low"];
        impactLabels.forEach((label, index) => {
            const labelDiv = document.createElement("div");
            labelDiv.textContent = label;
            labelDiv.style.position = "absolute";
            labelDiv.style.left = "40px";
            labelDiv.style.top = `${20 + (index * 80)}px`;
            labelDiv.style.fontSize = "12px";
            labelDiv.style.fontWeight = "500";
            labelDiv.style.color = "#605e5c";
            labelDiv.style.width = "50px";
            labelDiv.style.textAlign = "right";
            labelDiv.style.lineHeight = "80px";
            this._matrixContainer.appendChild(labelDiv);
        });

        // Probability scale labels (X-axis, left to right: Low, Medium, High, Critical)
        const probabilityLabels = ["Low", "Medium", "High", "Critical"];
        probabilityLabels.forEach((label, index) => {
            const labelDiv = document.createElement("div");
            labelDiv.textContent = label;
            labelDiv.style.position = "absolute";
            labelDiv.style.left = `${100 + (index * 80)}px`;
            labelDiv.style.top = "340px";
            labelDiv.style.fontSize = "12px";
            labelDiv.style.fontWeight = "500";
            labelDiv.style.color = "#605e5c";
            labelDiv.style.width = "80px";
            labelDiv.style.textAlign = "center";
            this._matrixContainer.appendChild(labelDiv);
        });
    }

    private createGrid(): void {
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const cell = document.createElement("div");
                cell.style.position = "absolute";
                cell.style.left = `${100 + (col * 80)}px`;
                cell.style.top = `${20 + (row * 80)}px`;
                cell.style.width = "80px";
                cell.style.height = "80px";
                cell.style.border = "1px solid #d2d0ce";
                cell.style.boxSizing = "border-box";
                cell.style.borderRadius = "4px";
                cell.style.transition = "all 0.2s ease";
                cell.style.cursor = "default";
                cell.setAttribute("data-row", row.toString());
                cell.setAttribute("data-col", col.toString());
                
                // Add hover effect
                cell.addEventListener('mouseenter', () => {
                    cell.style.boxShadow = "inset 0 0 0 2px rgba(0, 120, 212, 0.3)";
                    cell.style.transform = "scale(1.02)";
                });
                
                cell.addEventListener('mouseleave', () => {
                    cell.style.boxShadow = "none";
                    cell.style.transform = "scale(1)";
                });
                
                this._matrixContainer.appendChild(cell);
            }
        }
    }

    private updateMatrixColors(lowColor: string, mediumColor: string, highColor: string, criticalColor: string): void {
        // Risk level mapping: each cell gets a color based on combined impact (row) and probability (col)
        const riskMatrix = [
            [mediumColor, highColor, criticalColor, criticalColor], // Critical impact row
            [lowColor, mediumColor, highColor, criticalColor],      // High impact row  
            [lowColor, lowColor, mediumColor, highColor],           // Medium impact row
            [lowColor, lowColor, lowColor, mediumColor]             // Low impact row
        ];

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const cell = this._matrixContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`) as HTMLDivElement;
                if (cell) {
                    cell.style.backgroundColor = riskMatrix[row][col];
                    cell.style.backgroundImage = `linear-gradient(135deg, ${riskMatrix[row][col]} 0%, ${this.adjustColorBrightness(riskMatrix[row][col], -10)} 100%)`;
                }
            }
        }
    }

    private adjustColorBrightness(color: string, percent: number): string {
        const num = parseInt(color.replace("#",""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const B = (num >> 8 & 0x00FF) + amt;
        const G = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
    }

    private updateMarkerPosition(impact: number, probability: number): void {
        // Convert 1-4 scale to 0-3 for array indexing
        const impactIndex = Math.max(0, Math.min(3, 4 - Math.round(impact))); // Invert because Critical is at top (index 0)
        const probabilityIndex = Math.max(0, Math.min(3, Math.round(probability) - 1));

        // Position marker in center of the appropriate cell
        const x = 100 + (probabilityIndex * 80) + 24; // 24 is half of marker width to center it
        const y = 20 + (impactIndex * 80) + 24;       // 24 is half of marker height to center it

        this._marker.style.left = `${x}px`;
        this._marker.style.top = `${y}px`;
    }

    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        // Get color values with defaults (Fluent UI colors)
        const lowColor = context.parameters.LowColor?.raw || "#107c10";        // Fluent Green
        const mediumColor = context.parameters.MediumColor?.raw || "#faa06b";   // Fluent Orange  
        const highColor = context.parameters.HighColor?.raw || "#ff8c00";      // Fluent Dark Orange
        const criticalColor = context.parameters.CriticalColor?.raw || "#d13438"; // Fluent Red

        // Get impact and probability values
        const impact = context.parameters.Impact?.raw || 1;
        const probability = context.parameters.Probability?.raw || 1;

        // Update matrix colors
        this.updateMatrixColors(lowColor, mediumColor, highColor, criticalColor);

        // Update marker position
        this.updateMarkerPosition(impact, probability);
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
        // Add code to cleanup control if necessary
    }
}
