import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class RiskMatrix implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container!: HTMLDivElement;
    private _matrixContainer!: HTMLDivElement;
    private _grid!: HTMLDivElement;
    private _marker!: HTMLDivElement;

    private _currentSize = 0;
    private _showCategoryLabels = true;
    private _showAxisLabels = true;
    private _showRiskLabel = true;
    private _gridSize = 4;
    private _impactLabel = "Impact";
    private _probabilityLabel = "Probability";

    constructor() {}

    // --- Sizing config only (no manual XY positions) ---
    private getSizeConfig() {
        const isLarge = this._currentSize === 1;
        return {
            cell: isLarge ? 50 : 35,
            font: isLarge ? 10 : 9,
            labelFont: isLarge ? 16 : 12,
            marker: isLarge ? 24 : 16,
        };
    }

    // Utility: hex lighten/darken
    private adjustColorBrightness(color: string, percent: number): string {
        const num = parseInt(color.replace("#",""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num & 0x0000FF) + amt;
        const B = (num >> 8 & 0x00FF) + amt;
        // NOTE: channels swapped in original; fix order to RGB correctly
        const r = Math.max(0, Math.min(255, R));
        const g = Math.max(0, Math.min(255, B));
        const b = Math.max(0, Math.min(255, G));
        return "#" + (0x1000000 + (r * 0x10000) + (g * 0x100) + b).toString(16).slice(1);
    }

    private hexToRgba(hex: string, alpha: number): string {
        const c = hex.replace('#', '');
        const r = parseInt(c.substr(0, 2), 16);
        const g = parseInt(c.substr(2, 2), 16);
        const b = parseInt(c.substr(4, 2), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    private getFluentIconSvg(iconType: 'success' | 'info' | 'warning' | 'critical', color: string): string {
        const size = 12;
        switch (iconType) {
            case 'success':
                return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm3.36 6.65a.5.5 0 0 0-.71-.7L9 11.6 7.35 9.95a.5.5 0 1 0-.7.7l2 2c.2.2.5.2.7 0l4-4Z" fill="${color}"/></svg>`;
            case 'info':
                return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16ZM9.5 8.5a.5.5 0 0 0 1 0V7a.5.5 0 0 0-1 0v1.5Zm0 4a.5.5 0 0 0 1 0v-2a.5.5 0 0 0-1 0v2Z" fill="${color}"/></svg>`;
            case 'warning':
                return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.68 2.79a1.5 1.5 0 0 1 2.64 0l6.5 11.5A1.5 1.5 0 0 1 16.5 17h-13a1.5 1.5 0 0 1-1.32-2.21l6.5-11.5ZM10 6a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 10 6Zm0 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="${color}"/></svg>`;
            case 'critical':
                return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.43 2.28c.4-.54 1.27-.3 1.34.38l.56 5.34h3.17c.77 0 1.18.9.67 1.47l-5.5 6.25c-.4.46-1.08.3-1.24-.28L5.5 11h-2c-.65 0-1.06-.68-.74-1.23l4.67-7.49Z" fill="${color}"/></svg>`;
        }
    }

    private getGridLabels(): string[] {
        switch (this._gridSize) {
            case 2: return ["High", "Low"];
            case 3: return ["High", "Medium", "Low"];
            default: return ["Critical", "High", "Medium", "Low"];
        }
    }

    public init(
        context: ComponentFramework.Context<IInputs>,
        _notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this._container = container;
        this.createRiskMatrix();
    }

    // --- NEW: Grid-based layout, auto-sized container, consistent 10px padding ---
    private createRiskMatrix(): void {
        const cfg = this.getSizeConfig();

        // Clear
        this._container.innerHTML = "";

        // Add a one-time style tag (scoped by class names)
        const styleId = "risk-matrix-styles";
        if (!document.getElementById(styleId)) {
            const s = document.createElement("style");
            s.id = styleId;
            s.textContent = `
            .rmx-container {
                padding: 10px; /* exact 10px all sides */
                background: #fafafa;
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.1);
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif;
                display: inline-block; /* shrink-wrap to content */
            }
            .rmx-grid {
                display: grid;
                gap: 0; /* cell borders handle separation */
            }
            .rmx-impact-label {
                writing-mode: vertical-rl;
                transform: rotate(180deg);
                justify-self: center;
                align-self: center;
                color: #323130;
                font-weight: 600;
                letter-spacing: .5px;
            }
            .rmx-ycat {
                display: flex; align-items: center; justify-content: flex-end;
                color: #605e5c; font-weight: 500; padding-right: 8px;
            }
            .rmx-xcat {
                display: flex; align-items: center; justify-content: center;
                color: #605e5c; font-weight: 500;
            }
            .rmx-prob-label {
                justify-self: center; align-self: start;
                color: #323130; font-weight: 600; letter-spacing: .5px;
            }
            .rmx-cell {
                border: 1px solid #d2d0ce;
                border-radius: 4px;
                position: relative; /* for marker centering */
                transition: transform .2s ease, box-shadow .2s ease;
            }
            .rmx-cell:hover {
                box-shadow: inset 0 0 0 2px rgba(0,120,212,.3);
                transform: scale(1.02);
            }
            .rmx-marker {
                position: absolute;
                left: 50%; top: 50%;
                transform: translate(-50%, -50%);
                display: flex; align-items: center; justify-content: center;
                border-radius: 50%;
                color: #fff; background: #323130; border: 2px solid #fff;
                box-shadow: 0 2px 4px rgba(0,0,0,.2);
                font-weight: 600;
            }
            .rmx-chip {
                display: inline-flex; align-items: center; gap: 4px;
                padding: 2px 8px; border-radius: 16px; border: 1px solid transparent;
                box-shadow: 0 1px 2px rgba(0,0,0,.08);
                user-select: none; white-space: nowrap; cursor: default;
                justify-self: center;
                transition: transform .2s ease, box-shadow .2s ease;
            }
            .rmx-chip:hover {
                transform: scale(1.05);
                box-shadow: 0 2px 4px rgba(0,0,0,.12);
            }
            `;
            document.head.appendChild(s);
        }

        // Main container (auto grows to content; padding fixed at 10px)
        this._matrixContainer = document.createElement("div");
        this._matrixContainer.className = "rmx-container";
        // CSS variables for sizes
        this._matrixContainer.style.setProperty("--cell", `${cfg.cell}px`);
        this._matrixContainer.style.setProperty("--marker", `${cfg.marker}px`);
        this._matrixContainer.style.setProperty("--font", `${cfg.font}px`);
        this._matrixContainer.style.setProperty("--labelfont", `${cfg.labelFont}px`);

        // Build grid template dynamically based on which labels are shown
        const showYCat = this._showCategoryLabels;
        const showXCat = this._showCategoryLabels;
        const showImpactAxis = this._showAxisLabels;
        const showProbAxis = this._showAxisLabels;

        // Columns: [ImpactAxis?] [Y cats?] [Grid n cols]
        const cols: string[] = [];
        if (showImpactAxis) cols.push("auto");
        if (showYCat) cols.push("auto");
        cols.push(`repeat(${this._gridSize}, var(--cell))`);

        // Rows: [Chip?] [Grid n rows] [X cats?] [ProbabilityAxis?]
        const rows: string[] = [];
        if (this._showRiskLabel) rows.push("auto");
        rows.push(`repeat(${this._gridSize}, var(--cell))`);
        if (showXCat) rows.push("auto");
        if (showProbAxis) rows.push("auto");

        this._grid = document.createElement("div");
        this._grid.className = "rmx-grid";
        this._grid.style.gridTemplateColumns = cols.join(" ");
        this._grid.style.gridTemplateRows = rows.join(" ");

        // 1) Risk chip (row 1, spanning the grid columns) if enabled
        if (this._showRiskLabel) {
            const chip = document.createElement("div");
            chip.id = "riskLabel";
            chip.className = "rmx-chip";
            chip.style.fontSize = "0.75rem";
            // Column start index depends on left-side label columns
            const startCol = (showImpactAxis ? 1 : 0) + (showYCat ? 1 : 0) + 1; // 1-based grid line
            chip.style.gridColumn = `${startCol} / span ${this._gridSize}`;
            chip.style.gridRow = "1";
            chip.textContent = "UNKNOWN";
            this._grid.appendChild(chip);
        }

        // 2) Impact axis label (vertical), spans all grid rows
        if (showImpactAxis) {
            const impactEl = document.createElement("div");
            impactEl.className = "rmx-impact-label";
            impactEl.style.fontSize = "var(--labelfont)";
            impactEl.textContent = this._impactLabel || "Impact";
            // Row start depends on whether chip row exists
            const gridRowsStart = this._showRiskLabel ? 2 : 1;
            impactEl.style.gridRow = `${gridRowsStart} / span ${this._gridSize}`;
            impactEl.style.gridColumn = "1";
            this._grid.appendChild(impactEl);
        }

        // 3) Y category labels (left of grid), one per grid row
        if (showYCat) {
            const colIndex = showImpactAxis ? 2 : 1;
            const rowStart = this._showRiskLabel ? 2 : 1;
            const labels = this.getGridLabels();
            labels.forEach((label, i) => {
                const y = document.createElement("div");
                y.className = "rmx-ycat";
                y.style.fontSize = "var(--font)";
                y.textContent = label;
                y.style.gridColumn = `${colIndex}`;
                y.style.gridRow = `${rowStart + i}`;
                this._grid.appendChild(y);
            });
        }

        // 4) Grid cells
        const gridColStart = (showImpactAxis ? 1 : 0) + (showYCat ? 1 : 0) + 1;
        const gridRowStart = this._showRiskLabel ? 2 : 1;
        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                const cell = document.createElement("div");
                cell.className = "rmx-cell";
                cell.style.gridColumn = `${gridColStart + c}`;
                cell.style.gridRow = `${gridRowStart + r}`;
                cell.setAttribute("data-row", String(r));
                cell.setAttribute("data-col", String(c));
                this._grid.appendChild(cell);
            }
        }

        // 5) X category labels (below grid), Low->High left->right
        if (showXCat) {
            const rowIndex = gridRowStart + this._gridSize;
            const labels = this.getGridLabels().slice().reverse();
            for (let c = 0; c < this._gridSize; c++) {
                const x = document.createElement("div");
                x.className = "rmx-xcat";
                x.style.fontSize = "var(--font)";
                x.textContent = labels[c];
                x.style.gridRow = `${rowIndex}`;
                x.style.gridColumn = `${gridColStart + c}`;
                this._grid.appendChild(x);
            }
        }

        // 6) Probability axis label (bottom, centered under grid)
        if (showProbAxis) {
            const prob = document.createElement("div");
            prob.className = "rmx-prob-label";
            prob.style.fontSize = "var(--labelfont)";
            prob.textContent = this._probabilityLabel || "Probability";
            const row = gridRowStart + this._gridSize + (showXCat ? 1 : 0);
            prob.style.gridRow = `${row}`;
            prob.style.gridColumn = `${gridColStart} / span ${this._gridSize}`;
            this._grid.appendChild(prob);
        }

        // Marker element (centered via absolute within a cell)
        this._marker = document.createElement("div");
        this._marker.className = "rmx-marker";
        this._marker.style.width = `var(--marker)`;
        this._marker.style.height = `var(--marker)`;
        this._marker.style.fontSize = `${Math.floor(this.getSizeConfig().marker * 0.6)}px`;
        this._marker.textContent = "!";

        // Append grid to container and container to host
        this._matrixContainer.appendChild(this._grid);
        this._container.appendChild(this._matrixContainer);
    }

    private colorMatrix(low: string, med: string, high: string, crit: string) {
        let riskMatrix: string[][];
        if (this._gridSize === 2) {
            riskMatrix = [
                [med, high],
                [low, med]
            ];
        } else if (this._gridSize === 3) {
            riskMatrix = [
                [med, high, crit],
                [low, med, high],
                [low, low, med]
            ];
        } else {
            riskMatrix = [
                [med, high, crit, crit],
                [med, high, high, crit],
                [low, med, high, high],
                [low, low, med, med]
            ];
        }

        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                const cell = this._grid.querySelector(`.rmx-cell[data-row="${r}"][data-col="${c}"]`) as HTMLDivElement;
                if (cell) {
                    const base = riskMatrix[r][c];
                    cell.style.backgroundColor = base;
                    cell.style.backgroundImage = `linear-gradient(135deg, ${base} 0%, ${this.adjustColorBrightness(base, -10)} 100%)`;
                }
            }
        }
    }

    private getCurrentRiskLevel(
        impact: number, probability: number,
        low: string, med: string, high: string, crit: string
    ) {
        const size = this._gridSize;
        const impactIndex = Math.max(0, Math.min(size - 1, size - Math.round(impact)));
        const probIndex = Math.max(0, Math.min(size - 1, Math.round(probability) - 1));
        let riskMatrix: string[][];
        if (size === 2) {
            riskMatrix = [[med, high],[low, med]];
        } else if (size === 3) {
            riskMatrix = [[med, high, crit],[low, med, high],[low, low, med]];
        } else {
            riskMatrix = [[med, high, crit, crit],[med, high, high, crit],[low, med, high, high],[low, low, med, med]];
        }
        const color = riskMatrix[impactIndex][probIndex];
        const level = color === low ? "LOW" : color === med ? "MEDIUM" : color === high ? "HIGH" : "CRITICAL";
        return { level, color };
    }

    private updateMarkerPosition(impact: number, probability: number) {
        // Map to matrix indices
        const size = this._gridSize;
        const impactIndex = Math.max(0, Math.min(size - 1, size - Math.round(impact)));
        const probIndex = Math.max(0, Math.min(size - 1, Math.round(probability) - 1));

        // Remove marker from any old parent
        if (this._marker.parentElement) {
            this._marker.parentElement.removeChild(this._marker);
        }
        // Append into the target cell (centers via CSS)
        const cell = this._grid.querySelector(`.rmx-cell[data-row="${impactIndex}"][data-col="${probIndex}"]`);
        if (cell) cell.appendChild(this._marker);
    }

    private updateRiskChip(impact: number, probability: number, low: string, med: string, high: string, crit: string) {
        if (!this._showRiskLabel) return;
        const chip = this._grid.querySelector("#riskLabel") as HTMLDivElement;
        if (!chip) return;

        const { level, color } = this.getCurrentRiskLevel(impact, probability, low, med, high, crit);
        const bg = this.hexToRgba(color, 0.15);
        chip.style.backgroundColor = bg;
        chip.style.borderColor = color;
        chip.style.color = color;

        let icon: string = "";
        if (level === "LOW") icon = this.getFluentIconSvg("success", color);
        else if (level === "MEDIUM") icon = this.getFluentIconSvg("info", color);
        else if (level === "HIGH") icon = this.getFluentIconSvg("warning", color);
        else icon = this.getFluentIconSvg("critical", color);

        chip.innerHTML = `${icon}<span>${level}</span>`;
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        // Inputs
        const sizeValue = parseInt(context.parameters.Size?.raw || "0", 10) || 0;
        const showCategoryLabelsValue = context.parameters.ShowCategoryLabels?.raw !== false;
        const showAxisLabelsValue = context.parameters.ShowAxisLabels?.raw !== false;
        const gridSizeValue = parseInt(context.parameters.GridSize?.raw || "4", 10) || 4;
        const impactLabelValue = context.parameters.ImpactLabel?.raw || "Impact";
        const probabilityLabelValue = context.parameters.ProbabilityLabel?.raw || "Probability";
        const showRiskLabelValue = context.parameters.ShowRiskLabel?.raw !== false;

        // Rebuild if layout-affecting inputs changed
        if (
            this._currentSize !== sizeValue ||
            this._showCategoryLabels !== showCategoryLabelsValue ||
            this._showAxisLabels !== showAxisLabelsValue ||
            this._gridSize !== gridSizeValue ||
            this._impactLabel !== impactLabelValue ||
            this._probabilityLabel !== probabilityLabelValue ||
            this._showRiskLabel !== showRiskLabelValue
        ) {
            this._currentSize = sizeValue;
            this._showCategoryLabels = showCategoryLabelsValue;
            this._showAxisLabels = showAxisLabelsValue;
            this._gridSize = gridSizeValue;
            this._impactLabel = impactLabelValue;
            this._probabilityLabel = probabilityLabelValue;
            this._showRiskLabel = showRiskLabelValue;

            this.createRiskMatrix();
        }

        // Colors
        const lowColor = context.parameters.LowColor?.raw || "#107c10";
        const mediumColor = context.parameters.MediumColor?.raw || "#faa06b";
        const highColor = context.parameters.HighColor?.raw || "#ff8c00";
        const criticalColor = context.parameters.CriticalColor?.raw || "#d13438";

        // Values
        const impact = context.parameters.Impact?.raw || 1;
        const probability = context.parameters.Probability?.raw || 1;

        // Apply updates
        this.colorMatrix(lowColor, mediumColor, highColor, criticalColor);
        this.updateMarkerPosition(impact, probability);
        this.updateRiskChip(impact, probability, lowColor, mediumColor, highColor, criticalColor);

        // Update sizes (CSS vars) if size changed
        const cfg = this.getSizeConfig();
        if (this._matrixContainer) {
            this._matrixContainer.style.setProperty("--cell", `${cfg.cell}px`);
            this._matrixContainer.style.setProperty("--marker", `${cfg.marker}px`);
            this._matrixContainer.style.setProperty("--font", `${cfg.font}px`);
            this._matrixContainer.style.setProperty("--labelfont", `${cfg.labelFont}px`);
        }
    }

    public getOutputs(): IOutputs { return {}; }
    public destroy(): void {}
}