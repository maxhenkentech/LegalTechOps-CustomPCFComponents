import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class RiskMatrix implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement | null = null;
    private _matrixContainer: HTMLDivElement | null = null;
    private _grid: HTMLDivElement | null = null;
    private _marker: HTMLDivElement | null = null;
    private _tooltip: HTMLDivElement | null = null;

    private _currentSize = 0;
    private _showCategoryLabels = true;
    private _showAxisLabels = true;
    private _showRiskLabel = true;
    private _gridSize = 4;
    private _impactLabel = "Impact";
    private _probabilityLabel = "Probability";

    private getSizeConfig() {
        // 0 = small, 1 = large, 2 = huge
        const isLarge = this._currentSize === 1;
        const isHuge = this._currentSize === 2;

        const cell = isHuge ? 70 : isLarge ? 50 : 35;
        const font = isHuge ? 12 : isLarge ? 10 : 9;
        const labelFont = isHuge ? 22 : isLarge ? 16 : 12;
        const marker = isHuge ? 32 : isLarge ? 24 : 16;
        const chipFont = isHuge ? 16 : isLarge ? 14 : 12;
        const chipPadV = isHuge ? 2 : isLarge ? 1 : 0;
        const chipPadH = isHuge ? 12 : isLarge ? 10 : 8;

        // Keep behavior the same as large for huge regarding layout gaps
        const gapAxisToGrid = (isLarge || isHuge) ? 5 : 0; // Impact/Probability ↔ grid
        const gapYcatsToGrid = (isLarge || isHuge) ? 3 : 0; // Y categories ↔ grid
        const gapAxisToCats = 5; // base gap both sizes; Impact can override on large/huge

        return { cell, font, labelFont, marker, chipFont, chipPadV, chipPadH, gapAxisToGrid, gapYcatsToGrid, gapAxisToCats };
    }

    private adjustColorBrightness(color: string, percent: number): string {
        const num = parseInt(color.replace("#",""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num & 0x0000FF) + amt;
        const B = (num >> 8 & 0x00FF) + amt;
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

    private getFluentIconSvg(icon: 'success' | 'info' | 'warning' | 'critical', color: string): string {
        const sz = 20;
        const strokeW = 1.8;
        switch (icon) {
            case 'success': // Low
                return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="${color}" stroke-width="${strokeW}"/>
                    <path d="M8 12l3 3 5-6" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`;
            case 'info': // Medium
                return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="${color}" stroke-width="${strokeW}"/>
                    <line x1="12" y1="10" x2="12" y2="16" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round"/>
                    <circle cx="12" cy="7.5" r="1.2" fill="${color}"/>
                </svg>`;
            case 'warning': // High → triangle badge with rounded corners
                return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4c.4 0 .76.21.96.56l8.2 14.2c.37.64-.09 1.44-.96 1.44H3.8c-.87 0-1.33-.8-.96-1.44l8.2-14.2c.2-.35.56-.56.96-.56z" 
                        fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linejoin="round"/>
                    <line x1="12" y1="9" x2="12" y2="14" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round"/>
                    <circle cx="12" cy="17" r="1.2" fill="${color}"/>
                </svg>`;
            case 'critical': // Critical → circle + lightning
                return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="${color}" stroke-width="${strokeW}"/>
                    <path d="M13 6l-5 7h3l-1 5 5-7h-3z" fill="${color}" />
                </svg>`;
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

    // Grid-based layout; real spacer tracks so container height is correct
    private createRiskMatrix(): void {
        const cfg = this.getSizeConfig();
        if (!this._container) return;
        this._container.innerHTML = "";

        const styleId = "risk-matrix-styles";
        if (!document.getElementById(styleId)) {
            const s = document.createElement("style");
            s.id = styleId;
            s.textContent = `
            .rmx-container{
                padding:12px 12px 18px 12px;
                background:#fafafa;border:1px solid #e1e5e9;border-radius:8px;
                box-shadow:0 2px 8px rgba(0,0,0,.1),0 1px 3px rgba(0,0,0,.1);
                font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,'Roboto','Helvetica Neue',sans-serif;
                display:inline-block
            }
            .rmx-grid{display:grid;gap:0}
            .rmx-impact-label{writing-mode:vertical-rl;transform:rotate(180deg);justify-self:center;align-self:center;color:#323130;font-weight:600;letter-spacing:.5px}
            .rmx-ycat{display:flex;align-items:center;justify-content:flex-end;color:#605e5c;font-weight:500;padding-right:8px}
            .rmx-xcat{display:flex;align-items:center;justify-content:center;color:#605e5c;font-weight:500}
            .rmx-prob-label{justify-self:center;align-self:start;color:#323130;font-weight:600;letter-spacing:.5px}
            .rmx-cell{border:1px solid #d2d0ce;border-radius:4px;position:relative;transition:transform .2s ease,box-shadow .2s ease}
            .rmx-cell:hover{box-shadow:inset 0 0 0 2px rgba(0,120,212,.3);transform:scale(1.02)}
            .rmx-marker{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
                display:flex;align-items:center;justify-content:center;border-radius:50%;
                color:#fff;background:#323130;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.2);font-weight:600;
                animation: rmx-bob 2.6s ease-in-out infinite; }
            @keyframes rmx-bob {
                0%,100% { transform: translate(-50%,-50%); }
                50%     { transform: translate(-50%, calc(-50% - 3px)); }
            }
            .rmx-tooltip{
                position:absolute; left:50%; top:0;
                transform:translate(-50%, -110%);
                padding:6px 8px; border-radius:8px; border:1px solid transparent;
                background:#fff; box-shadow:0 4px 10px rgba(0,0,0,.12);
                font-size:12px; font-weight:600; color:#323130; white-space:nowrap;
                pointer-events:none; opacity:0; transition:opacity .15s ease, transform .15s ease;
            }
            .rmx-cell:hover .rmx-tooltip{ opacity:1; transform:translate(-50%,-120%); }
            .rmx-chip{display:inline-flex;align-items:center;gap:6px;border-radius:16px;border:1px solid transparent;
                box-shadow:0 1px 2px rgba(0,0,0,.08);user-select:none;white-space:nowrap;cursor:default;justify-self:center;
                transition:transform .2s ease,box-shadow .2s ease;
                padding-top:0px;padding-bottom:0px; /* Ensure vertical padding is minimal */
            }
            .rmx-chip:hover{transform:scale(1.05);box-shadow:0 2px 4px rgba(0,0,0,.12)}
            `;
            document.head.appendChild(s);
        }

        this._matrixContainer = document.createElement("div");
        this._matrixContainer.className = "rmx-container";
        this._matrixContainer.style.setProperty("--cell", `${cfg.cell}px`);
        this._matrixContainer.style.setProperty("--marker", `${cfg.marker}px`);
        this._matrixContainer.style.setProperty("--font", `${cfg.font}px`);
        this._matrixContainer.style.setProperty("--labelfont", `${cfg.labelFont}px`);

        const showYCat = this._showCategoryLabels;
        const showXCat = this._showCategoryLabels;
        const showImpactAxis = this._showAxisLabels;
        const showProbAxis = this._showAxisLabels;

        // SPECIAL: Impact axis ↔ Y categories gap:
        // - default = cfg.gapAxisToCats (5px)
        // - if LARGE/HUGE && ShowCategoryLabels → increase to 8px (Impact only)
        const isLargeOrHuge = this._currentSize !== 0;
        const impactAxisCatsGap = (isLargeOrHuge && showYCat) ? 8 : cfg.gapAxisToCats;

        // --- Grid template with ALL spacers tracked explicitly ---
        const cols: string[] = [];
        if (showImpactAxis) { cols.push("auto", `${impactAxisCatsGap}px`); }   // Impact axis + spacer to Y cats
        if (showYCat)       { cols.push("auto"); if (cfg.gapYcatsToGrid) cols.push(`${cfg.gapYcatsToGrid}px`); }
        cols.push(`repeat(${this._gridSize}, var(--cell))`);

        const rows: string[] = [];
        if (this._showRiskLabel) { rows.push("auto", "10px"); }               // chip + 10px spacer
        rows.push(`repeat(${this._gridSize}, var(--cell))`);                   // grid
        if (showXCat)      { if (cfg.gapYcatsToGrid) rows.push(`${cfg.gapYcatsToGrid}px`); rows.push("auto"); } // spacer to grid + X cats
        if (showProbAxis)  { rows.push(`${cfg.gapAxisToCats}px`, "auto"); }    // 5px spacer + Probability axis
        rows.push("6px");                                                      // bottom safety spacer

        this._grid = document.createElement("div");
        this._grid.className = "rmx-grid";
        this._grid.style.gridTemplateColumns = cols.join(" ");
        this._grid.style.gridTemplateRows = rows.join(" ");

        // Compute grid start indices (track count, not pixel sizes)
        const leftCols =
            (showImpactAxis ? 2 : 0) +                    // axis + spacer to cats
            (showYCat ? 1 + (cfg.gapYcatsToGrid ? 1 : 0) : 0);
        const gridColStart = leftCols + 1;
        const gridRowStart = this._showRiskLabel ? 3 : 1; // chip + spacer

        // Chip
        if (this._showRiskLabel) {
            const chip = document.createElement("div");
            chip.id = "riskLabel";
            chip.className = "rmx-chip";
            chip.style.fontSize = `${cfg.chipFont}px`;
            chip.style.padding = `${cfg.chipPadV}px ${cfg.chipPadH}px`;
            chip.style.gridColumn = `${gridColStart} / span ${this._gridSize}`;
            chip.style.gridRow = "1";
            chip.textContent = "UNKNOWN";
            this._grid.appendChild(chip);
        }

        // Impact axis
        if (showImpactAxis) {
            const impactEl = document.createElement("div");
            impactEl.className = "rmx-impact-label";
            impactEl.style.fontSize = "var(--labelfont)";
            impactEl.textContent = this._impactLabel || "Impact";
            impactEl.style.gridRow = `${gridRowStart} / span ${this._gridSize}`;
            impactEl.style.gridColumn = "1";
            this._grid.appendChild(impactEl);
        }

        // Y categories
        if (showYCat) {
            const yCatCol = showImpactAxis ? 3 : 1; // axis(1) + spacer(2) → Y cats at col 3
            const labels = this.getGridLabels();
            for (let i = 0; i < this._gridSize; i++) {
                const y = document.createElement("div");
                y.className = "rmx-ycat";
                y.style.fontSize = "var(--font)";
                y.textContent = labels[i] ?? "";
                y.style.gridColumn = `${yCatCol}`;
                y.style.gridRow = `${gridRowStart + i}`;
                this._grid!.appendChild(y);
            }
        }

        // Grid cells
        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                const cell = document.createElement("div");
                cell.className = "rmx-cell";
                cell.style.gridColumn = `${gridColStart + c}`;
                cell.style.gridRow = `${gridRowStart + r}`;
                cell.setAttribute("data-row", String(r));
                cell.setAttribute("data-col", String(c));
                this._grid!.appendChild(cell);
            }
        }

        // X categories
        if (showXCat) {
            const xCatsRow = gridRowStart + this._gridSize + (cfg.gapYcatsToGrid ? 1 : 0);
            const labels = this.getGridLabels().slice().reverse();
            for (let c = 0; c < this._gridSize; c++) {
                const x = document.createElement("div");
                x.className = "rmx-xcat";
                x.style.fontSize = "var(--font)";
                x.textContent = labels[c];
                x.style.gridRow = `${xCatsRow}`;
                x.style.gridColumn = `${gridColStart + c}`;
                this._grid!.appendChild(x);
            }
        }

        // Probability axis
        if (showProbAxis) {
            const prob = document.createElement("div");
            prob.className = "rmx-prob-label";
            prob.style.fontSize = "var(--labelfont)";
            prob.textContent = this._probabilityLabel || "Probability";
            const probRow =
                gridRowStart +
                this._gridSize +
                (showXCat ? (cfg.gapYcatsToGrid ? 1 : 0) + 1 : 0) + // spacer + X cats (if present)
                1; // 5px spacer before axis
            prob.style.gridRow = `${probRow}`;
            prob.style.gridColumn = `${gridColStart} / span ${this._gridSize}`;
            this._grid!.appendChild(prob);
        }

        // Marker + tooltip
        this._marker = document.createElement("div");
        this._marker.className = "rmx-marker";
        this._marker.style.width = `var(--marker)`;
        this._marker.style.height = `var(--marker)`;
        this._marker.style.fontSize = `${Math.floor(this.getSizeConfig().marker * 0.6)}px`;
        this._marker.textContent = "!";

        this._tooltip = document.createElement("div");
        this._tooltip.className = "rmx-tooltip";
        this._tooltip.textContent = "—";

        this._matrixContainer!.appendChild(this._grid!);
        this._container!.appendChild(this._matrixContainer!);
    }

    private colorMatrix(low: string, med: string, high: string, crit: string) {
        if (!this._grid) return;
        let riskMatrix: string[][];
        if (this._gridSize === 2) {
            riskMatrix = [[med, high],[low, med]];
        } else if (this._gridSize === 3) {
            riskMatrix = [[med, high, crit],[low, med, high],[low, low, med]];
        } else {
            riskMatrix = [[med, high, crit, crit],[med, high, high, crit],[low, med, high, high],[low, low, med, med]];
        }

        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                const cell = this._grid.querySelector(`.rmx-cell[data-row="${r}"][data-col="${c}"]`) as HTMLDivElement | null;
                if (cell) {
                    const base = riskMatrix[r][c];
                    cell.style.backgroundColor = base;
                    cell.style.backgroundImage = `linear-gradient(135deg, ${base} 0%, ${this.adjustColorBrightness(base, -10)} 100%)`;
                }
            }
        }
    }

    private getCurrentRiskLevel(impact: number, probability: number, low: string, med: string, high: string, crit: string) {
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
        return { level, color, impactIndex, probIndex };
    }

    private updateMarkerPosition(impact: number, probability: number) {
        if (!this._grid || !this._marker || !this._tooltip) return;
        const size = this._gridSize;
        const impactIndex = Math.max(0, Math.min(size - 1, size - Math.round(impact)));
        const probIndex = Math.max(0, Math.min(size - 1, Math.round(probability) - 1));

        if (this._marker.parentElement) this._marker.parentElement.removeChild(this._marker);
        if (this._tooltip.parentElement) this._tooltip.parentElement.removeChild(this._tooltip);

        const cell = this._grid.querySelector(`.rmx-cell[data-row="${impactIndex}"][data-col="${probIndex}"]`) as HTMLDivElement | null;
        if (cell) {
            cell.appendChild(this._marker);
            cell.appendChild(this._tooltip);
        }
    }

    private updateRiskChipAndTooltip(impact: number, probability: number, low: string, med: string, high: string, crit: string) {
        const { level, color } = this.getCurrentRiskLevel(impact, probability, low, med, high, crit);

        if (this._showRiskLabel && this._grid) {
            const chip = this._grid.querySelector("#riskLabel") as HTMLDivElement | null;
            if (chip) {
                const bg = this.hexToRgba(color, 0.15);
                chip.style.backgroundColor = bg;
                chip.style.borderColor = color;
                chip.style.color = color;

                let icon = "";
                if (level === "LOW") icon = this.getFluentIconSvg("success", color);
                else if (level === "MEDIUM") icon = this.getFluentIconSvg("info", color);
                else if (level === "HIGH") icon = this.getFluentIconSvg("warning", color);
                else icon = this.getFluentIconSvg("critical", color);

                chip.innerHTML = `${icon}<span>${level}</span>`;
            }
        }

        if (this._tooltip) {
            this._tooltip.textContent = level;
            this._tooltip.style.borderColor = color;
            this._tooltip.style.color = color;
            this._tooltip.style.backgroundColor = "#fff";
        }
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        const sizeValue = parseInt(context.parameters.Size?.raw || "0", 10) || 0; // accepts 0,1,2 (small, large, huge)
        const showCategoryLabelsValue = context.parameters.ShowCategoryLabels?.raw !== false;
        const showAxisLabelsValue = context.parameters.ShowAxisLabels?.raw !== false;
        const gridSizeValue = parseInt(context.parameters.GridSize?.raw || "4", 10) || 4;
        const impactLabelValue = context.parameters.ImpactLabel?.raw || "Impact";
        const probabilityLabelValue = context.parameters.ProbabilityLabel?.raw || "Probability";
        const showRiskLabelValue = context.parameters.ShowRiskLabel?.raw !== false;

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

        const lowColor = context.parameters.LowColor?.raw || "#107c10";
        const mediumColor = context.parameters.MediumColor?.raw || "#faa06b";
        const highColor = context.parameters.HighColor?.raw || "#ff8c00";
        const criticalColor = context.parameters.CriticalColor?.raw || "#d13438";

        const impact = context.parameters.Impact?.raw || 1;
        const probability = context.parameters.Probability?.raw || 1;

        this.colorMatrix(lowColor, mediumColor, highColor, criticalColor);
        this.updateMarkerPosition(impact, probability);
        this.updateRiskChipAndTooltip(impact, probability, lowColor, mediumColor, highColor, criticalColor);

        const cfg = this.getSizeConfig();
        if (this._matrixContainer) {
            this._matrixContainer.style.setProperty("--cell", `${cfg.cell}px`);
            this._matrixContainer.style.setProperty("--marker", `${cfg.marker}px`);
            this._matrixContainer.style.setProperty("--font", `${cfg.font}px`);
            this._matrixContainer.style.setProperty("--labelfont", `${cfg.labelFont}px`);
        }
        const chip = this._grid?.querySelector("#riskLabel") as HTMLDivElement | null;
        if (chip) {
            chip.style.fontSize = `${cfg.chipFont}px`;
            chip.style.padding = `${cfg.chipPadV}px ${cfg.chipPadH}px`;
        }
    }

    public getOutputs(): IOutputs { return {}; }

    public destroy(): void {
        if (this._marker?.parentElement) this._marker.parentElement.removeChild(this._marker);
        if (this._tooltip?.parentElement) this._tooltip.parentElement.removeChild(this._tooltip);
        if (this._matrixContainer?.parentElement) this._matrixContainer.parentElement.removeChild(this._matrixContainer);
        this._grid = null;
        this._marker = null;
        this._tooltip = null;
        this._matrixContainer = null;
        this._container = null;
    }
}
