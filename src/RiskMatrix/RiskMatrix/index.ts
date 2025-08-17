import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class RiskMatrix implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _matrixContainer: HTMLDivElement;
    private _marker: HTMLDivElement;
    private _currentSize = 0; // Default to Small
    private _showCategoryLabels = true; // Default to show category labels
    private _showAxisLabels = true; // Default to show axis labels
    private _gridSize = 4; // Default to 4x4 grid
    private _impactLabel = "Impact"; // Default impact label
    private _probabilityLabel = "Probability"; // Default probability label
    private _showRiskLabel = true; // Default to show risk label

    // Helper function to get Fluent UI icon SVG
    private getFluentIconSvg(iconType: 'success' | 'info' | 'warning' | 'critical', color: string): string {
        const size = 12;
        
        switch (iconType) {
            case 'success':
                // CheckmarkCircle20Regular equivalent
                return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm3.36 6.65a.5.5 0 0 0-.71-.7L9 11.6 7.35 9.95a.5.5 0 1 0-.7.7l2 2c.2.2.5.2.7 0l4-4Z" fill="${color}"/>
                </svg>`;
            
            case 'info':
                // Info20Regular equivalent
                return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16ZM9.5 8.5a.5.5 0 0 0 1 0V7a.5.5 0 0 0-1 0v1.5Zm0 4a.5.5 0 0 0 1 0v-2a.5.5 0 0 0-1 0v2Z" fill="${color}"/>
                </svg>`;
            
            case 'warning':
                // Warning20Regular equivalent
                return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.68 2.79a1.5 1.5 0 0 1 2.64 0l6.5 11.5A1.5 1.5 0 0 1 16.5 17h-13a1.5 1.5 0 0 1-1.32-2.21l6.5-11.5ZM10 6a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 10 6Zm0 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="${color}"/>
                </svg>`;
            
            case 'critical':
                // Flash20Regular equivalent
                return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.43 2.28c.4-.54 1.27-.3 1.34.38l.56 5.34h3.17c.77 0 1.18.9.67 1.47l-5.5 6.25c-.4.46-1.08.3-1.24-.28L5.5 11h-2c-.65 0-1.06-.68-.74-1.23l4.67-7.49Z" fill="${color}"/>
                </svg>`;
            
            default:
                return '';
        }
    }

    // Get dynamic size configuration based on grid size
    private getSizeConfig(): {
        width: number;
        height: number;
        cellSize: number;
        fontSize: number;
        labelFontSize: number;
        markerSize: number;
        padding: number;
        impactLabelWidth: number;
        yAxisLabelWidth: number;
        gridStartX: number;
        gridStartY: number;
        xAxisLabelHeight: number;
        probabilityLabelHeight: number;
    } {
        const baseConfigs = {
            small: {
                cellSize: 35,
                fontSize: 9,
                labelFontSize: 12,
                markerSize: 16,
                padding: 10,
                impactLabelWidth: this._showAxisLabels ? (this._showCategoryLabels ? 35 : 45) : 0,
                yAxisLabelWidth: this._showCategoryLabels ? 45 : 0,
                xAxisLabelHeight: this._showCategoryLabels ? 15 : 0,
                probabilityLabelHeight: this._showAxisLabels ? 20 : 0
            },
            large: {
                cellSize: 50,
                fontSize: 10,
                labelFontSize: 16,
                markerSize: 24,
                padding: 12,
                impactLabelWidth: this._showAxisLabels ? 40 : 0,
                yAxisLabelWidth: this._showCategoryLabels ? 55 : 0,
                xAxisLabelHeight: this._showCategoryLabels ? 20 : 0,
                probabilityLabelHeight: this._showAxisLabels ? 25 : 0
            }
        };

        const config = this._currentSize === 0 ? baseConfigs.small : baseConfigs.large;
        
        // Calculate dynamic dimensions based on grid size
        const gridWidth = this._gridSize * config.cellSize;
        const gridHeight = this._gridSize * config.cellSize;
        
        let gridStartX = config.impactLabelWidth + config.yAxisLabelWidth - 15; // Base positioning with left adjustment

        // Positioning adjustments based on label visibility and size
        if (!this._showCategoryLabels && !this._showAxisLabels) {
            // No labels at all - position grid at left edge with minimal padding
            gridStartX = 10;
        } else if (!this._showCategoryLabels) {
            // Only axis labels, no category labels - adjust spacing from Y-axis label
            if (this._currentSize === 1) {
                // Large version without category labels
                gridStartX += 7;
            } else {
                // Small version without category labels
                gridStartX += 2;
                // Move everything except y-axis label 5px to the left for small size, ShowAxisLabels true, ShowCategoryLabels false
                if (this._showAxisLabels && !this._showCategoryLabels) {
                    gridStartX -= 5;
                }
            }
        } else if (!this._showAxisLabels) {
            // Only category labels, no axis labels - position based on category label width
            gridStartX = config.yAxisLabelWidth + 10;
            if (this._gridSize === 2) {
                gridStartX -= 10; // Tighter spacing for 2x2 grid
            } else {
                gridStartX -= 5; // Tighter spacing for 3x3 and 4x4 grids
            }
        } else {
            // Both axis and category labels shown
            if (this._currentSize === 1 && this._gridSize === 2) {
                // 2x2 large version with labels
                gridStartX -= 15;
            } else if (this._currentSize === 1) {
                // Other large versions with both labels
                gridStartX += 5;
            } else if (this._currentSize === 0 && this._gridSize === 2) {
                // 2x2 small version with labels
                gridStartX += 5;
            } else {
                // All other configurations with both label types
                gridStartX += 10;
            }
        }
        
        const gridStartY = this._currentSize === 0 ? 20 : 15;
        // Add space for risk label if shown - with extra spacing for large version
        const riskLabelSpace = this._showRiskLabel ? (this._currentSize === 0 ? 20 : 35) : 0; // Large version gets 10px more space
        const adjustedGridStartY = gridStartY + riskLabelSpace;
        
        const totalWidth = gridStartX + gridWidth + 15; // Add some right padding
        const totalHeight = adjustedGridStartY + gridHeight + config.xAxisLabelHeight + config.probabilityLabelHeight;
        
        return {
            width: totalWidth,
            height: totalHeight,
            cellSize: config.cellSize,
            fontSize: config.fontSize,
            labelFontSize: config.labelFontSize,
            markerSize: config.markerSize,
            padding: config.padding,
            impactLabelWidth: config.impactLabelWidth,
            yAxisLabelWidth: config.yAxisLabelWidth,
            gridStartX: gridStartX,
            gridStartY: adjustedGridStartY,
            xAxisLabelHeight: config.xAxisLabelHeight,
            probabilityLabelHeight: config.probabilityLabelHeight
        };
    }

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
        const config = this.getSizeConfig();
        
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
        
        // Create risk label (will be updated in updateView)
        if (this._showRiskLabel) {
            this.createRiskLabel();
        }
        
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

    // Get labels based on grid size
    private getGridLabels(): string[] {
        switch (this._gridSize) {
            case 2:
                return ["High", "Low"];
            case 3:
                return ["High", "Medium", "Low"];
            case 4:
            default:
                return ["Critical", "High", "Medium", "Low"];
        }
    }

    // Get current risk level and color based on impact and probability
    private getCurrentRiskLevel(impact: number, probability: number, lowColor: string, mediumColor: string, highColor: string, criticalColor: string): { level: string, color: string } {
        // Convert scale to 0-(gridSize-1) for array indexing
        const maxValue = this._gridSize;
        const impactIndex = Math.max(0, Math.min(this._gridSize - 1, maxValue - Math.round(impact))); // Invert because highest impact is at top (index 0)
        const probabilityIndex = Math.max(0, Math.min(this._gridSize - 1, Math.round(probability) - 1));

        // Create the same risk matrix as in updateMatrixColors
        let riskMatrix: string[][];
        
        if (this._gridSize === 2) {
            riskMatrix = [
                [mediumColor, highColor],
                [lowColor, mediumColor]
            ];
        } else if (this._gridSize === 3) {
            riskMatrix = [
                [mediumColor, highColor, criticalColor],
                [lowColor, mediumColor, highColor],
                [lowColor, lowColor, mediumColor]
            ];
        } else {
            riskMatrix = [
                [mediumColor, highColor, criticalColor, criticalColor],
                [mediumColor, highColor, highColor, criticalColor],
                [lowColor, mediumColor, highColor, highColor],
                [lowColor, lowColor, mediumColor, mediumColor]
            ];
        }

        const currentColor = riskMatrix[impactIndex][probabilityIndex];
        
        // Determine risk level based on color
        let riskLevel: string;
        if (currentColor === lowColor) {
            riskLevel = "LOW";
        } else if (currentColor === mediumColor) {
            riskLevel = "MEDIUM";
        } else if (currentColor === highColor) {
            riskLevel = "HIGH";
        } else {
            riskLevel = "CRITICAL";
        }

        return { level: riskLevel, color: currentColor };
    }

    private createLabels(): void {
        const config = this.getSizeConfig();
        
        // Get custom labels with defaults
        const impactLabelText = this._impactLabel || "Impact";
        const probabilityLabelText = this._probabilityLabel || "Probability";
        
        // Zone 1: Impact label (vertical) - positioned in dedicated left zone - only if showAxisLabels is true
        if (this._showAxisLabels) {
            const impactLabelDiv = document.createElement("div");
            impactLabelDiv.textContent = impactLabelText;
            
            // Position consistently based on configuration
            let impactLabelLeft: number;
            if (this._showCategoryLabels) {
                impactLabelLeft = 8; // Position for configurations with category labels
            } else {
                impactLabelLeft = 8; // Maintain consistent position when no category labels
            }
            
            // Calculate the center of the grid vertically
            const gridCenterY = config.gridStartY + (this._gridSize * config.cellSize / 2);
            
            impactLabelDiv.style.position = "absolute";
            impactLabelDiv.style.left = `${impactLabelLeft}px`;
            impactLabelDiv.style.top = `${gridCenterY}px`;
            impactLabelDiv.style.transform = "rotate(-90deg) translateX(-50%)"; // Rotate and center the text
            impactLabelDiv.style.transformOrigin = "0 0"; // Rotate from top-left corner
            impactLabelDiv.style.fontSize = `${config.labelFontSize}px`;
            impactLabelDiv.style.fontWeight = "600";
            impactLabelDiv.style.color = "#323130";
            impactLabelDiv.style.letterSpacing = "0.5px";
            impactLabelDiv.style.textAlign = "center"; // Center the text for proper centering
            impactLabelDiv.style.whiteSpace = "nowrap"; // Prevent text wrapping
            impactLabelDiv.style.width = "auto"; // Let text determine its own width
            this._matrixContainer.appendChild(impactLabelDiv);
        }

        // Zone 2: Y-axis scale labels (positioned between impact label and grid) - only if showCategoryLabels is true
        if (this._showCategoryLabels) {
            const impactLabels = this.getGridLabels();
            impactLabels.forEach((label, index) => {
                const labelDiv = document.createElement("div");
                labelDiv.textContent = label;
                labelDiv.style.position = "absolute";
                
                // Positioning adjustments for different size and grid configurations
                let labelLeft = config.impactLabelWidth - 15; // Default positioning
                
                if (!this._showAxisLabels) {
                    // When axis labels are hidden, position category labels based on grid size
                    if (this._gridSize === 2) {
                        labelLeft = -5; // Positioning for 2x2 grid
                    } else if (this._gridSize === 3) {
                        labelLeft = 0; // Positioning for 3x3 grid
                    } else {
                        labelLeft = 0; // Positioning for 4x4 grid
                    }
                } else if (this._currentSize === 1 && this._showCategoryLabels) {
                    if (this._gridSize === 2) {
                        // 2x2 large version with labels
                        labelLeft = config.impactLabelWidth - 35;
                    } else {
                        // Other large versions with labels
                        labelLeft = config.impactLabelWidth - 15;
                    }
                } else if (this._currentSize === 0 && this._showCategoryLabels) {
                    // Small versions with labels
                    if (this._gridSize === 2) {
                        // 2x2 small version with labels
                        labelLeft = config.impactLabelWidth - 17;
                    } else {
                        // Other small versions with labels
                        labelLeft = config.impactLabelWidth - 12;
                    }
                }
                
                labelDiv.style.left = `${labelLeft}px`;
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

        // Zone 3: X-axis scale labels (positioned below grid) - only if showCategoryLabels is true
        if (this._showCategoryLabels) {
            const probabilityLabels = this.getGridLabels().slice().reverse(); // Reverse for X-axis (Low to High/Critical)
            probabilityLabels.forEach((label, index) => {
                const labelDiv = document.createElement("div");
                labelDiv.textContent = label;
                labelDiv.style.position = "absolute";
                labelDiv.style.left = `${config.gridStartX + (index * config.cellSize)}px`;
                labelDiv.style.top = `${config.gridStartY + (this._gridSize * config.cellSize)}px`;
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

        // Zone 4: Probability label (horizontal) - positioned at bottom - only if showAxisLabels is true
        if (this._showAxisLabels) {
            const probabilityLabelDiv = document.createElement("div");
            probabilityLabelDiv.textContent = probabilityLabelText;
            
            // Calculate base position and adjust for specific configurations
            let probabilityLabelTop = config.gridStartY + (this._gridSize * config.cellSize) + config.xAxisLabelHeight;
            if (!this._showCategoryLabels) {
                // When no category labels, position probability label closer to grid
                if (this._currentSize === 1) {
                    // Large version spacing
                    probabilityLabelTop = config.gridStartY + (this._gridSize * config.cellSize) + 5;
                } else {
                    // Small version spacing
                    probabilityLabelTop = config.gridStartY + (this._gridSize * config.cellSize) + 2;
                }
            } else if (this._currentSize === 1) {
                // Large version with category labels
                probabilityLabelTop = config.gridStartY + (this._gridSize * config.cellSize) + config.xAxisLabelHeight + 3;
            }
            
            probabilityLabelDiv.style.position = "absolute";
            probabilityLabelDiv.style.left = `${config.gridStartX + (this._gridSize * config.cellSize / 2)}px`;
            probabilityLabelDiv.style.top = `${probabilityLabelTop}px`;
            probabilityLabelDiv.style.fontSize = `${config.labelFontSize}px`;
            probabilityLabelDiv.style.fontWeight = "600";
            probabilityLabelDiv.style.color = "#323130";
            probabilityLabelDiv.style.letterSpacing = "0.5px";
            probabilityLabelDiv.style.transform = "translateX(-50%)";
            probabilityLabelDiv.style.textAlign = "center";
            this._matrixContainer.appendChild(probabilityLabelDiv);
        }
    }

    private createRiskLabel(): void {
        const config = this.getSizeConfig();
        
        // Create risk label container as a chip-style label
        const riskLabelDiv = document.createElement("div");
        riskLabelDiv.id = "riskLabel";
        riskLabelDiv.style.position = "absolute";
        riskLabelDiv.style.left = `${config.gridStartX + (this._gridSize * config.cellSize / 2)}px`;
        riskLabelDiv.style.top = `${this._currentSize === 0 ? 12 : 16}px`; // Move large view down by 7px (9 + 7 = 16)
        riskLabelDiv.style.transform = "translateX(-50%)";
        riskLabelDiv.style.fontSize = "0.75rem"; // Smaller chip font size
        riskLabelDiv.style.fontWeight = "500";
        riskLabelDiv.style.textAlign = "center";
        riskLabelDiv.style.letterSpacing = "0.2px";
        riskLabelDiv.style.padding = "2px 8px"; // Compact chip padding
        riskLabelDiv.style.borderRadius = "16px"; // Chip border radius
        riskLabelDiv.style.border = "1px solid #ff8c00"; // Default orange border
        riskLabelDiv.style.backgroundColor = "rgba(255, 140, 0, 0.15)"; // Default orange background
        riskLabelDiv.style.color = "#ff8c00"; // Default orange text
        riskLabelDiv.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)"; // Minimal shadow for chip
        riskLabelDiv.style.transition = "all 0.2s ease";
        riskLabelDiv.style.cursor = "default";
        riskLabelDiv.style.userSelect = "none";
        riskLabelDiv.style.whiteSpace = "nowrap";
        riskLabelDiv.style.display = "flex";
        riskLabelDiv.style.alignItems = "center";
        riskLabelDiv.style.gap = "4px";
        riskLabelDiv.innerHTML = "UNKNOWN"; // Will be updated in updateView with icon and text
        
        // Add subtle hover effect
        riskLabelDiv.addEventListener('mouseenter', () => {
            riskLabelDiv.style.transform = "translateX(-50%) scale(1.05)";
            riskLabelDiv.style.boxShadow = "0 2px 4px rgba(0,0,0,0.12)";
        });
        
        riskLabelDiv.addEventListener('mouseleave', () => {
            riskLabelDiv.style.transform = "translateX(-50%) scale(1)";
            riskLabelDiv.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)";
        });
        
        this._matrixContainer.appendChild(riskLabelDiv);
    }

    private createGrid(): void {
        const config = this.getSizeConfig();
        
        for (let row = 0; row < this._gridSize; row++) {
            for (let col = 0; col < this._gridSize; col++) {
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
        // Create risk level mapping based on grid size
        let riskMatrix: string[][];
        
        if (this._gridSize === 2) {
            // 2x2 grid: Low, Medium, High risk levels
            // Rows are impact (High to Low), Columns are probability (Low to High)
            riskMatrix = [
                [mediumColor, highColor],    // High impact row
                [lowColor, mediumColor]      // Low impact row
            ];
        } else if (this._gridSize === 3) {
            // 3x3 grid: Low, Medium, High risk levels
            // Rows are impact (High to Low), Columns are probability (Low to High)
            riskMatrix = [
                [mediumColor, highColor, criticalColor],     // High impact row
                [lowColor, mediumColor, highColor],          // Medium impact row
                [lowColor, lowColor, mediumColor]            // Low impact row
            ];
        } else {
            // 4x4 grid: Low, Medium, High, Critical risk levels
            // Rows are impact (Critical to Low), Columns are probability (Low to Critical)
            riskMatrix = [
                [mediumColor, highColor, criticalColor, criticalColor],   // Critical impact row
                [mediumColor, highColor, highColor, criticalColor],        // High impact row
                [lowColor, mediumColor, highColor, highColor],             // Medium impact row
                [lowColor, lowColor, mediumColor, mediumColor]            // Low impact row
            ];
        }

        for (let row = 0; row < this._gridSize; row++) {
            for (let col = 0; col < this._gridSize; col++) {
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

    // Calculate the optimal text color (black or white) based on background color brightness
    private getOptimalTextColor(backgroundColor: string): string {
        // Remove # if present
        const hex = backgroundColor.replace('#', '');
        
        // Convert to RGB
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Calculate relative luminance using the formula from WCAG guidelines
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Return black for light backgrounds, white for dark backgrounds
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    // Convert hex color to rgba with specified opacity
    private hexToRgba(hex: string, alpha: number): string {
        // Remove # if present
        const color = hex.replace('#', '');
        
        // Convert to RGB
        const r = parseInt(color.substr(0, 2), 16);
        const g = parseInt(color.substr(2, 2), 16);
        const b = parseInt(color.substr(4, 2), 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    private updateMarkerPosition(impact: number, probability: number): void {
        const config = this.getSizeConfig();
        
        // Convert scale to 0-(gridSize-1) for array indexing
        const maxValue = this._gridSize;
        const impactIndex = Math.max(0, Math.min(this._gridSize - 1, maxValue - Math.round(impact))); // Invert because highest impact is at top (index 0)
        const probabilityIndex = Math.max(0, Math.min(this._gridSize - 1, Math.round(probability) - 1));

        // Position marker in center of the appropriate cell
        const cellCenterX = config.gridStartX + (probabilityIndex * config.cellSize) + (config.cellSize / 2);
        const cellCenterY = config.gridStartY + (impactIndex * config.cellSize) + (config.cellSize / 2);
        
        // Adjust marker position to account for border and ensure perfect centering
        const markerX = cellCenterX - (config.markerSize / 2) - 1; // Subtract 1px to account for cell border
        const markerY = cellCenterY - (config.markerSize / 2) - 1; // Subtract 1px to account for cell border

        this._marker.style.left = `${markerX}px`;
        this._marker.style.top = `${markerY}px`;
    }

    private updateRiskLabel(impact: number, probability: number, lowColor: string, mediumColor: string, highColor: string, criticalColor: string): void {
        if (!this._showRiskLabel) return;
        
        const riskLabelDiv = this._matrixContainer.querySelector("#riskLabel") as HTMLDivElement;
        if (riskLabelDiv) {
            const riskInfo = this.getCurrentRiskLevel(impact, probability, lowColor, mediumColor, highColor, criticalColor);
            
            // Use the actual custom colors from the matrix
            let chipColor: string;
            let backgroundColor: string;
            let borderColor: string;
            let iconSvg: string;
            
            if (riskInfo.level === "LOW") {
                chipColor = lowColor; // Use custom low color
                backgroundColor = this.hexToRgba(lowColor, 0.15);
                borderColor = lowColor;
                // Fluent UI CheckmarkCircle icon
                iconSvg = this.getFluentIconSvg('success', chipColor);
            } else if (riskInfo.level === "MEDIUM") {
                chipColor = mediumColor; // Use custom medium color
                backgroundColor = this.hexToRgba(mediumColor, 0.15);
                borderColor = mediumColor;
                // Fluent UI Info icon
                iconSvg = this.getFluentIconSvg('info', chipColor);
            } else if (riskInfo.level === "HIGH") {
                chipColor = highColor; // Use custom high color
                backgroundColor = this.hexToRgba(highColor, 0.15);
                borderColor = highColor;
                // Fluent UI Warning icon
                iconSvg = this.getFluentIconSvg('warning', chipColor);
            } else {
                chipColor = criticalColor; // Use custom critical color
                backgroundColor = this.hexToRgba(criticalColor, 0.15);
                borderColor = criticalColor;
                // Fluent UI Flash icon
                iconSvg = this.getFluentIconSvg('critical', chipColor);
            }
            
            // Update chip content with Fluent UI icon and text
            riskLabelDiv.innerHTML = `${iconSvg}<span>${riskInfo.level}</span>`;
            
            // Apply chip styling
            riskLabelDiv.style.backgroundColor = backgroundColor;
            riskLabelDiv.style.color = chipColor;
            riskLabelDiv.style.borderColor = borderColor;
        }
    }

    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        // Get size value with default - convert string enum to number
        const sizeRaw = context.parameters.Size?.raw || "0"; // Default to Small (0)
        const sizeValue = parseInt(sizeRaw, 10) || 0;
        
        // Get showCategoryLabels value with default
        const showCategoryLabelsValue = context.parameters.ShowCategoryLabels?.raw !== false; // Default to true (show category labels)
        
        // Get showAxisLabels value with default
        const showAxisLabelsValue = context.parameters.ShowAxisLabels?.raw !== false; // Default to true (show axis labels)
        
        // Get grid size value with default
        const gridSizeRaw = context.parameters.GridSize?.raw || "4"; // Default to 4x4 grid
        const gridSizeValue = parseInt(gridSizeRaw, 10) || 4;
        
        // Get custom labels with defaults
        const impactLabelValue = context.parameters.ImpactLabel?.raw || "Impact";
        const probabilityLabelValue = context.parameters.ProbabilityLabel?.raw || "Probability";
        
        // Get showRiskLabel value with default
        const showRiskLabelValue = context.parameters.ShowRiskLabel?.raw !== false; // Default to true (show risk label)
        
        // Check if size, showCategoryLabels, showAxisLabels, gridSize, showRiskLabel, or custom labels have changed
        if (this._currentSize !== sizeValue || 
            this._showCategoryLabels !== showCategoryLabelsValue ||
            this._showAxisLabels !== showAxisLabelsValue ||
            this._gridSize !== gridSizeValue ||
            this._impactLabel !== impactLabelValue ||
            this._probabilityLabel !== probabilityLabelValue ||
            this._showRiskLabel !== showRiskLabelValue) {
            
            this._currentSize = sizeValue;
            this._showCategoryLabels = showCategoryLabelsValue;
            this._showAxisLabels = showAxisLabelsValue;
            this._gridSize = gridSizeValue;
            this._impactLabel = impactLabelValue;
            this._probabilityLabel = probabilityLabelValue;
            this._showRiskLabel = showRiskLabelValue;
            
            // Recreate the matrix with new configuration
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

        // Update risk label
        this.updateRiskLabel(impact, probability, lowColor, mediumColor, highColor, criticalColor);
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
