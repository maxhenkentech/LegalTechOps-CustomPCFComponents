import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class RiskMatrix implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _matrixContainer: HTMLDivElement;
    private _marker: HTMLDivElement;
    private _currentSize = 0; // Default to Small
    private _showLabels = true; // Default to show labels

    // Size configurations - redesigned with proper layout spacing
    private _sizeConfigs: Record<string, {
        width: number;
        height: number;
        cellSize: number;
        fontSize: number;
        labelFontSize: number;
        markerSize: number;
        padding: number;
        // Layout zones
        impactLabelWidth: number;
        yAxisLabelWidth: number;
        gridStartX: number;
        gridStartY: number;
        xAxisLabelHeight: number;
        probabilityLabelHeight: number;
    }> = {
        "0_true": { // Small with labels
            width: 225, // Reduced by 10px from 235
            height: 180,
            cellSize: 35,
            fontSize: 9,
            labelFontSize: 12,
            markerSize: 16,
            padding: 10,
            // Layout zones
            impactLabelWidth: 35, // Reduced by 10px from 45 to move Y-axis labels left
            yAxisLabelWidth: 45,
            gridStartX: 85, // Moved further left by 10px from 95
            gridStartY: 20,
            xAxisLabelHeight: 15,
            probabilityLabelHeight: 20
        },
        "0_false": { // Small without labels
            width: 180,
            height: 170, // Reduced by 10px from 180
            cellSize: 35,
            fontSize: 9,
            labelFontSize: 12,
            markerSize: 16,
            padding: 10,
            // Layout zones
            impactLabelWidth: 45, // Reverted back for proper Impact label positioning
            yAxisLabelWidth: 0, // No space for scale labels
            gridStartX: 50, // Reverted back to original position
            gridStartY: 20,
            xAxisLabelHeight: 0, // No space for scale labels
            probabilityLabelHeight: 20
        },
        "1_true": { // Large with labels
            width: 310, // Reduced by 10px from 320
            height: 240,
            cellSize: 50,
            fontSize: 10,
            labelFontSize: 16,
            markerSize: 24, // Reduced to 80% of 30px (30 * 0.8 = 24)
            padding: 12,
            // Layout zones
            impactLabelWidth: 40, // Reverted back to original 40
            yAxisLabelWidth: 55,
            gridStartX: 110,
            gridStartY: 15,
            xAxisLabelHeight: 20,
            probabilityLabelHeight: 25
        },
        "1_false": { // Large without labels
            width: 245,
            height: 230, // Reduced by 10px from 240
            cellSize: 50,
            fontSize: 10,
            labelFontSize: 16,
            markerSize: 24, // Reduced to 80% of 30px (30 * 0.8 = 24)
            padding: 12,
            // Layout zones
            impactLabelWidth: 40, // Reverted back for proper Impact label positioning
            yAxisLabelWidth: 0, // No space for scale labels
            gridStartX: 55, // Reverted back to original position
            gridStartY: 15,
            xAxisLabelHeight: 0, // No space for scale labels
            probabilityLabelHeight: 25
        }
    };

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
        const configKey = `${this._currentSize}_${this._showLabels}`;
        const config = this._sizeConfigs[configKey];
        
        // Clear existing content
        this._container.innerHTML = '';
        
        // Main container
        this._matrixContainer = document.createElement("div");
        this._matrixContainer.style.position = "relative";
        this._matrixContainer.style.width = `${config.width}px`;
        this._matrixContainer.style.height = `${config.height}px`;
        this._matrixContainer.style.margin = "0";
        this._matrixContainer.style.fontFamily = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif";
        this._matrixContainer.style.backgroundColor = "#fafafa";
        this._matrixContainer.style.borderRadius = "8px";
        this._matrixContainer.style.padding = `${config.padding}px`;
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
        this._marker.style.width = `${config.markerSize}px`;
        this._marker.style.height = `${config.markerSize}px`;
        this._marker.style.borderRadius = "50%";
        this._marker.style.backgroundColor = "#323130";
        this._marker.style.color = "white";
        this._marker.style.display = "flex";
        this._marker.style.alignItems = "center";
        this._marker.style.justifyContent = "center";
        this._marker.style.fontSize = `${Math.floor(config.markerSize * 0.6)}px`;
        this._marker.style.fontWeight = "600";
        this._marker.style.zIndex = "10";
        this._marker.style.border = "2px solid white";
        this._marker.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
        this._marker.style.transition = "all 0.3s ease";
        this._matrixContainer.appendChild(this._marker);

        this._container.appendChild(this._matrixContainer);
    }

    private createLabels(): void {
        const configKey = `${this._currentSize}_${this._showLabels}`;
        const config = this._sizeConfigs[configKey];
        
        // Zone 1: Impact label (vertical) - positioned in dedicated left zone, further from scale labels
        const impactLabel = document.createElement("div");
        impactLabel.textContent = "Impact";
        
        // Calculate base position and adjust for different configurations
        let impactLabelLeft = config.impactLabelWidth / 4;
        if (this._showLabels) {
            impactLabelLeft -= 10; // Move 10px further left for show labels configurations
        } else {
            impactLabelLeft -= 5; // Move 5px further left for without labels configurations
        }
        
        impactLabel.style.position = "absolute";
        impactLabel.style.left = `${impactLabelLeft}px`;
        impactLabel.style.top = `${config.gridStartY + (2 * config.cellSize)}px`;
        impactLabel.style.transform = "rotate(-90deg)";
        impactLabel.style.transformOrigin = "center";
        impactLabel.style.fontSize = `${config.labelFontSize}px`;
        impactLabel.style.fontWeight = "600";
        impactLabel.style.color = "#323130";
        impactLabel.style.letterSpacing = "0.5px";
        impactLabel.style.textAlign = "center";
        impactLabel.style.whiteSpace = "nowrap"; // Prevent text wrapping
        this._matrixContainer.appendChild(impactLabel);

        // Zone 2: Y-axis scale labels (positioned between impact label and grid) - only if showLabels is true
        if (this._showLabels) {
            const impactLabels = ["Critical", "High", "Medium", "Low"];
            impactLabels.forEach((label, index) => {
                const labelDiv = document.createElement("div");
                labelDiv.textContent = label;
                labelDiv.style.position = "absolute";
                labelDiv.style.left = `${config.impactLabelWidth}px`;
                labelDiv.style.top = `${config.gridStartY + (index * config.cellSize)}px`;
                labelDiv.style.width = `${config.yAxisLabelWidth}px`;
                labelDiv.style.height = `${config.cellSize}px`;
                labelDiv.style.fontSize = `${config.fontSize}px`;
                labelDiv.style.fontWeight = "500";
                labelDiv.style.color = "#605e5c";
                labelDiv.style.textAlign = "right";
                labelDiv.style.display = "flex";
                labelDiv.style.alignItems = "center";
                labelDiv.style.justifyContent = "flex-end";
                labelDiv.style.paddingRight = "8px";
                this._matrixContainer.appendChild(labelDiv);
            });
        }

        // Zone 3: X-axis scale labels (positioned below grid) - only if showLabels is true
        if (this._showLabels) {
            const probabilityLabels = ["Low", "Medium", "High", "Critical"];
            probabilityLabels.forEach((label, index) => {
                const labelDiv = document.createElement("div");
                labelDiv.textContent = label;
                labelDiv.style.position = "absolute";
                labelDiv.style.left = `${config.gridStartX + (index * config.cellSize)}px`;
                labelDiv.style.top = `${config.gridStartY + (4 * config.cellSize)}px`;
                labelDiv.style.width = `${config.cellSize}px`;
                labelDiv.style.height = `${config.xAxisLabelHeight}px`;
                labelDiv.style.fontSize = `${config.fontSize}px`;
                labelDiv.style.fontWeight = "500";
                labelDiv.style.color = "#605e5c";
                labelDiv.style.textAlign = "center";
                labelDiv.style.display = "flex";
                labelDiv.style.alignItems = "center";
                labelDiv.style.justifyContent = "center";
                this._matrixContainer.appendChild(labelDiv);
            });
        }

        // Zone 4: Probability label (horizontal) - positioned at bottom
        const probabilityLabel = document.createElement("div");
        probabilityLabel.textContent = "Probability";
        
        // Calculate base position and adjust for specific configurations
        let probabilityLabelTop = config.gridStartY + (4 * config.cellSize) + config.xAxisLabelHeight;
        if ((this._currentSize === 0 && !this._showLabels) || (this._currentSize === 1 && !this._showLabels)) {
            probabilityLabelTop += 5; // Move down 5px for small without labels and large without labels
        }
        
        probabilityLabel.style.position = "absolute";
        probabilityLabel.style.left = `${config.gridStartX + (2 * config.cellSize)}px`;
        probabilityLabel.style.top = `${probabilityLabelTop}px`;
        probabilityLabel.style.fontSize = `${config.labelFontSize}px`;
        probabilityLabel.style.fontWeight = "600";
        probabilityLabel.style.color = "#323130";
        probabilityLabel.style.letterSpacing = "0.5px";
        probabilityLabel.style.transform = "translateX(-50%)";
        probabilityLabel.style.textAlign = "center";
        this._matrixContainer.appendChild(probabilityLabel);
    }

    private createGrid(): void {
        const configKey = `${this._currentSize}_${this._showLabels}`;
        const config = this._sizeConfigs[configKey];
        
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const cell = document.createElement("div");
                cell.style.position = "absolute";
                cell.style.left = `${config.gridStartX + (col * config.cellSize)}px`;
                cell.style.top = `${config.gridStartY + (row * config.cellSize)}px`;
                cell.style.width = `${config.cellSize}px`;
                cell.style.height = `${config.cellSize}px`;
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
        const configKey = `${this._currentSize}_${this._showLabels}`;
        const config = this._sizeConfigs[configKey];
        
        // Convert 1-4 scale to 0-3 for array indexing
        const impactIndex = Math.max(0, Math.min(3, 4 - Math.round(impact))); // Invert because Critical is at top (index 0)
        const probabilityIndex = Math.max(0, Math.min(3, Math.round(probability) - 1));

        // Position marker in perfect center of the appropriate cell with adjusted positioning
        const cellCenterX = config.gridStartX + (probabilityIndex * config.cellSize) + (config.cellSize / 2);
        const cellCenterY = config.gridStartY + (impactIndex * config.cellSize) + (config.cellSize / 2);
        
        // Adjust marker position to account for border and ensure perfect centering
        const markerX = cellCenterX - (config.markerSize / 2) - 1; // Subtract 1px to account for cell border
        const markerY = cellCenterY - (config.markerSize / 2) - 1; // Subtract 1px to account for cell border

        this._marker.style.left = `${markerX}px`;
        this._marker.style.top = `${markerY}px`;
    }

    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        // Get size value with default - convert string enum to number
        const sizeRaw = context.parameters.Size?.raw || "0"; // Default to Small (0)
        const sizeValue = parseInt(sizeRaw, 10) || 0;
        
        // Get showLabels value with default
        const showLabelsValue = context.parameters.ShowLabels?.raw !== false; // Default to true (show labels)
        
        // Check if size or showLabels has changed
        if (this._currentSize !== sizeValue || this._showLabels !== showLabelsValue) {
            this._currentSize = sizeValue;
            this._showLabels = showLabelsValue;
            // Recreate the matrix with new size and label configuration
            this.createRiskMatrix();
        }
        
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
