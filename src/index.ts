import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class RiskMatrix implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private _context!: ComponentFramework.Context<IInputs>;
  private _container!: HTMLDivElement;

  private svg!: SVGSVGElement;
  private gridGroup!: SVGGElement;
  private labelsGroup!: SVGGElement;
  private pinGroup!: SVGGElement;

  private readonly cols = 4;
  private readonly rows = 4;

  public init(context: ComponentFramework.Context<IInputs>, _notifyOutputChanged: () => void, _state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
    this._context = context;

    this._container = document.createElement("div");
    this._container.className = "risk-matrix-root";
    container.appendChild(this._container);

    // Create SVG canvas
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement;
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", "Risk Matrix");
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this._container.appendChild(this.svg);

    // Groups
    this.gridGroup = document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement;
    this.labelsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement;
    this.pinGroup = document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement;

    this.svg.appendChild(this.gridGroup);
    this.svg.appendChild(this.labelsGroup);
    this.svg.appendChild(this.pinGroup);

    // Shadow filter for pin
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", "dropShadow");
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");
    const feDropShadow = document.createElementNS("http://www.w3.org/2000/svg", "feDropShadow");
    feDropShadow.setAttribute("dx", "0");
    feDropShadow.setAttribute("dy", "2");
    feDropShadow.setAttribute("stdDeviation", "2");
    feDropShadow.setAttribute("flood-color", "#000");
    feDropShadow.setAttribute("flood-opacity", "0.35");
    filter.appendChild(feDropShadow);
    defs.appendChild(filter);
    this.svg.appendChild(defs);

    // Initial render
    this.render();
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void {
    this._context = context;
    this.render();
  }

  public getOutputs(): IOutputs {
    return {};
  }

  public destroy(): void {
    // No-op
  }

  // Rendering helpers

  private render(): void {
    const width = Math.max(this._container.clientWidth || 480, 320);
    const height = Math.max(this._container.clientHeight || 360, 240);

    // Margins for axis labels
    const margin = { top: 24, right: 24, bottom: 56, left: 72 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Configure SVG viewport
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", "100%");

    // Clear groups (avoid replaceChildren for broader DOM lib support)
    this.clear(this.gridGroup);
    this.clear(this.labelsGroup);
    this.clear(this.pinGroup);

    // Background
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", `${width}`);
    bg.setAttribute("height", `${height}`);
    bg.setAttribute("fill", "white");
    this.gridGroup.appendChild(bg);

    // Draw grid heatmap
    const cellW = innerWidth / this.cols;
    const cellH = innerHeight / this.rows;

    const palette = this.getPalette();
    const colorMatrix: string[][] = [
      [palette.high, palette.high, palette.critical, palette.critical], // Impact: Critical (top)
      [palette.medium, palette.high, palette.high, palette.critical],   // Impact: High
      [palette.low, palette.medium, palette.high, palette.high],        // Impact: Medium
      [palette.low, palette.low, palette.medium, palette.high]          // Impact: Low (bottom)
    ];

    // Border container for grid
    const gridRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    gridRect.setAttribute("x", `${margin.left}`);
    gridRect.setAttribute("y", `${margin.top}`);
    gridRect.setAttribute("width", `${innerWidth}`);
    gridRect.setAttribute("height", `${innerHeight}`);
    gridRect.setAttribute("fill", "none");
    gridRect.setAttribute("stroke", "#bdbdbd");
    gridRect.setAttribute("stroke-width", "1");
    this.gridGroup.appendChild(gridRect);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", `${margin.left + c * cellW}`);
        rect.setAttribute("y", `${margin.top + r * cellH}`);
        rect.setAttribute("width", `${cellW}`);
        rect.setAttribute("height", `${cellH}`);
        rect.setAttribute("fill", colorMatrix[r][c]);
        rect.setAttribute("stroke", "#d0d0d0");
        rect.setAttribute("stroke-width", "1");
        this.gridGroup.appendChild(rect);
      }
    }

    // Axis labels
    const tierLabels = ["Low", "Medium", "High", "Critical"];
    const axisFontFamily = "Segoe UI, Arial, sans-serif";
    const axisFontSize = "12px";
    const axisTitleSize = "20px";
    const axisColor = "#323130";

    // Y tiers (Impact) — rows from bottom to top
    for (let i = 0; i < this.rows; i++) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.textContent = tierLabels[i];
      label.setAttribute("x", `${margin.left - 12}`);
      const yFromBottom = i + 0.5;
      const y = margin.top + (this.rows - yFromBottom) * cellH;
      label.setAttribute("y", `${y + 4}`);
      label.setAttribute("text-anchor", "end");
      label.setAttribute("fill", axisColor);
      label.setAttribute("font-family", axisFontFamily);
      label.setAttribute("font-size", axisFontSize);
      this.labelsGroup.appendChild(label);
    }

    // X tiers (Probability) — columns left to right
    for (let i = 0; i < this.cols; i++) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.textContent = tierLabels[i];
      const x = margin.left + (i + 0.5) * cellW;
      const y = margin.top + innerHeight + 24;
      label.setAttribute("x", `${x}`);
      label.setAttribute("y", `${y}`);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", axisColor);
      label.setAttribute("font-family", axisFontFamily);
      label.setAttribute("font-size", axisFontSize);
      this.labelsGroup.appendChild(label);
    }

    // Axis titles
    const xTitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
    xTitle.textContent = "Probability";
    xTitle.setAttribute("x", `${margin.left + innerWidth / 2}`);
    xTitle.setAttribute("y", `${margin.top + innerHeight + 48}`);
    xTitle.setAttribute("text-anchor", "middle");
    xTitle.setAttribute("fill", axisColor);
    xTitle.setAttribute("font-family", axisFontFamily);
    xTitle.setAttribute("font-size", axisTitleSize);
    xTitle.setAttribute("font-weight", "600");
    this.labelsGroup.appendChild(xTitle);

    const yTitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
    yTitle.textContent = "Impact";
    yTitle.setAttribute("transform", `translate(${24}, ${margin.top + innerHeight / 2}) rotate(-90)`);
    yTitle.setAttribute("text-anchor", "middle");
    yTitle.setAttribute("fill", axisColor);
    yTitle.setAttribute("font-family", axisFontFamily);
    yTitle.setAttribute("font-size", axisTitleSize);
    yTitle.setAttribute("font-weight", "600");
    this.labelsGroup.appendChild(yTitle);

    // Pin
    const { colIndex, rowIndex } = this.getCellIndices();
    if (colIndex !== undefined && rowIndex !== undefined) {
      const cx = margin.left + (colIndex + 0.5) * cellW;
      const cy = margin.top + (rowIndex + 0.5) * cellH;

      const pin = this.buildPin(18);
      pin.setAttribute("transform", `translate(${cx}, ${cy - 8})`); // Slightly above cell center
      pin.setAttribute("filter", "url(#dropShadow)");
      this.pinGroup.appendChild(pin);
    }
  }

  private clear(el: Element): void {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  private getPalette(): { low: string; medium: string; high: string; critical: string } {
    // Defaults (use your screenshot colors; these are placeholders if none provided)
    const defaults = {
      low: "#1ee894",
      medium: "#ffea00", 
      high: "#ffa000",
      critical: "#ef5350"
    };

    const normalize = (value?: string | null): string | undefined => {
      if (!value) return undefined;
      const v = value.trim();
      const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
      if (!m) return undefined;
      let hex = m[1];
      if (hex.length === 3) {
        hex = hex.split("").map((ch: string) => ch + ch).join("");
      }
      return `#${hex.toLowerCase()}`;
    };

    const lowParam = this._context.parameters.lowColor;
    const mediumParam = this._context.parameters.mediumColor;
    const highParam = this._context.parameters.highColor;
    const criticalParam = this._context.parameters.criticalColor;

    const low = normalize(lowParam ? lowParam.raw : null) || defaults.low;
    const medium = normalize(mediumParam ? mediumParam.raw : null) || defaults.medium;
    const high = normalize(highParam ? highParam.raw : null) || defaults.high;
    const critical = normalize(criticalParam ? criticalParam.raw : null) || defaults.critical;

    return { low, medium, high, critical };
  }

  // Translate bound values to zero-based indices.
  // Expect 1..4; clamp; invert Y because SVG y grows downward while impact increases upward.
  private getCellIndices(): { colIndex?: number; rowIndex?: number } {
    const impactParam = this._context.parameters.impact;
    const probabilityParam = this._context.parameters.probability;
    
    const impact = impactParam ? impactParam.raw : null;
    const probability = probabilityParam ? probabilityParam.raw : null;

    if (impact == null || probability == null) return {};

    const clamp = (v: number) => Math.min(4, Math.max(1, Math.round(v)));

    const p = clamp(probability) - 1; // 0..3 left->right
    const i = clamp(impact) - 1;      // 0..3 low..critical

    const rowFromTop = 3 - i; // invert so 3->low -> row=3 (bottom)
    const colIndex = p;
    const rowIndex = rowFromTop;

    return { colIndex, rowIndex };
  }

  // Build a simple "location pin" using vector shapes; size is the pin height.
  private buildPin(size: number): SVGGElement {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement;
    g.setAttribute("aria-label", "Selected risk location");
    g.setAttribute("role", "img");

    const scale = size / 24;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z"
    );
    path.setAttribute("fill", "#1565c0");
    path.setAttribute("stroke", "white");
    path.setAttribute("stroke-width", `${1.5}`);
    path.setAttribute("transform", `translate(${-12}, ${-20}) scale(${scale})`); // anchor tip near (0,0)
    g.appendChild(path);

    // Inner circle
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "0");
    circle.setAttribute("cy", "-14");
    circle.setAttribute("r", `${4 * scale * 1.5}`);
    circle.setAttribute("fill", "white");
    circle.setAttribute("stroke", "#0d47a1");
    circle.setAttribute("stroke-width", `${1.2}`);
    g.appendChild(circle);

    return g;
  }
} // end class

// Single global export for preview
(globalThis as any).Amadeus = (globalThis as any).Amadeus || {};
(globalThis as any).Amadeus.LegalOps = (globalThis as any).Amadeus.LegalOps || {};
(globalThis as any).Amadeus.LegalOps.RiskMatrix = RiskMatrix;
    }
  }
}

// Make available globally for preview
(globalThis as any).Amadeus = (globalThis as any).Amadeus || {};
(globalThis as any).Amadeus.LegalOps = (globalThis as any).Amadeus.LegalOps || {};
(globalThis as any).Amadeus.LegalOps.RiskMatrix = RiskMatrix;
(globalThis as any).Amadeus.LegalOps = (globalThis as any).Amadeus.LegalOps || {};
(globalThis as any).Amadeus.LegalOps.RiskMatrix = RiskMatrix;
    path.setAttribute("transform", `translate(${-12}, ${-20}) scale(${scale})`); // anchor tip near (0,0)
    g.appendChild(path);

    // Inner circle
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "0");
    circle.setAttribute("cy", "-14");
    circle.setAttribute("r", `${4 * scale * 1.5}`);
    circle.setAttribute("fill", "white");
    circle.setAttribute("stroke", "#0d47a1");
    circle.setAttribute("stroke-width", `${1.2}`);
    g.appendChild(circle);

    return g;
  }
}

// Export for global access in preview
declare global {
  namespace Amadeus {
    namespace LegalOps {
      const RiskMatrix: typeof RiskMatrix;
    }
  }
}

// Make available globally for preview
(globalThis as any).Amadeus = (globalThis as any).Amadeus || {};
(globalThis as any).Amadeus.LegalOps = (globalThis as any).Amadeus.LegalOps || {};
(globalThis as any).Amadeus.LegalOps.RiskMatrix = RiskMatrix;
