import { IInputs, IOutputs } from "./generated/ManifestTypes";

interface LookupRef {
  id: string;
  entityLogicalName?: string;
  name?: string;
}

export class SubEntityGridImage implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private _container!: HTMLDivElement;
  private _table!: HTMLTableElement;
  private _context!: ComponentFramework.Context<IInputs>;
  private _imageCache = new Map<string, string>(); // targetId -> url/dataUrl

  public init(
    context: ComponentFramework.Context<IInputs>,
    _notifyOutputChanged: () => void,
    _state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ): void {
    this._context = context;
    this._container = container;

    // Root table
    this._table = document.createElement("table");
    this._table.style.width = "100%";
    this._table.style.borderCollapse = "collapse";
    this._table.style.font = "12px/1.4 system-ui, Segoe UI, Arial, sans-serif";
    this._table.className = "ltoimggrid";

    // Lightweight styling
    const style = document.createElement("style");
    style.textContent = `
      .ltoimggrid th, .ltoimggrid td { padding: 6px 8px; border-bottom: 1px solid rgba(0,0,0,.06); vertical-align: middle; }
      .ltoimggrid thead th { font-weight: 600; text-align: left; background: rgba(0,0,0,.02); position: sticky; top: 0; z-index: 1; }
      .ltoimggrid .imgcell { width: 36px; }
      .ltoimggrid .avatar { width: 24px; height: 24px; border-radius: 4px; object-fit: cover; display: inline-block; background: rgba(0,0,0,.06); }
      .ltoimggrid .muted { opacity: .75 }
    `;
    this._container.appendChild(style);
    this._container.appendChild(this._table);
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void {
    this._context = context;

    // Clear current render
    while (this._table.firstChild) this._table.removeChild(this._table.firstChild);

    const ds = this.getDataSet();
    if (!ds) {
      this._table.appendChild(this.makeOneRowMessage("Dataset not found"));
      return;
    }
    if (ds.loading) {
      this._table.appendChild(this.makeOneRowMessage("Loading…"));
      return;
    }

    const lookupAlias = this.getSelectedLookupColumnAlias(); // "lookupImageColumn" (property-set alias)

    // Header
    this._table.appendChild(this.renderHeader(ds));

    // Rows
    const ids = ds.sortedRecordIds ?? [];
    if (ids.length === 0) {
      this._table.appendChild(this.makeOneRowMessage("No rows"));
      return;
    }

    const tbody = document.createElement("tbody");

    for (const id of ids) {
      const row = ds.records[id];
      const tr = document.createElement("tr");

      // Leading image cell (lookup target's image)
      const tdImg = document.createElement("td");
      tdImg.className = "imgcell";
      const imgEl = document.createElement("img");
      imgEl.className = "avatar";
      imgEl.alt = "image";
      tdImg.appendChild(imgEl);
      tr.appendChild(tdImg);

      // Resolve image asynchronously
      void this.resolveAndRenderLookupImage(row, lookupAlias, imgEl);

      // Render dataset columns as text (respect formatted values)
      for (const col of ds.columns) {
        const td = document.createElement("td");
        const formatted = row.getFormattedValue(col.name);
        const raw: unknown = row.getValue(col.name);
        td.textContent =
          formatted ??
          (typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "");
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    this._table.appendChild(tbody);
  }

  public getOutputs(): IOutputs {
    return {};
  }

  public destroy(): void {
    this._imageCache.clear();
  }

  // ===== helpers =====

  private getDataSet(): ComponentFramework.PropertyTypes.DataSet | undefined {
    // Read the dataset by its manifest name
    return (this._context.parameters as any).subgridDataSet as ComponentFramework.PropertyTypes.DataSet;
  }

  private getSelectedLookupColumnAlias(): string {
    // Alias equals the property-set name from the manifest
    return "lookupImageColumn";
  }

  private renderHeader(ds: ComponentFramework.PropertyTypes.DataSet): HTMLTableSectionElement {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");

    const thImg = document.createElement("th");
    thImg.className = "imgcell";
    thImg.textContent = ""; // no header text for the image column
    tr.appendChild(thImg);

    for (const col of ds.columns) {
      const th = document.createElement("th");
      th.textContent = col.displayName || col.name;
      tr.appendChild(th);
    }

    thead.appendChild(tr);
    return thead;
  }

  private makeOneRowMessage(message: string): HTMLTableSectionElement {
    const tbody = document.createElement("tbody");
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "muted";
    td.textContent = message;

    const ds = this.getDataSet();
    const colCount = (ds?.columns?.length ?? 0) + 1; // image col + dataset cols
    td.colSpan = Math.max(1, colCount);

    tr.appendChild(td);
    tbody.appendChild(tr);
    return tbody;
  }

  // --- Lookup image logic ---

  private async resolveAndRenderLookupImage(
    row: ComponentFramework.PropertyTypes.DataSet["records"][string],
    lookupAlias: string,
    imgEl: HTMLImageElement
  ): Promise<void> {
    if (!lookupAlias) return;

    const ref = this.getLookupRef(row, lookupAlias);
    if (!ref || !ref.id) return;

    const targetId = ref.id.toLowerCase();
    const logicalName = ref.entityLogicalName?.toLowerCase();
    if (!logicalName) return; // need target entity logical name

    const cached = this._imageCache.get(targetId);
    if (cached) {
      imgEl.src = cached;
      return;
    }

    try {
      // Try both URL and raw image (entityimage is base64)
      const rec = await this._context.webAPI.retrieveRecord(
        logicalName,
        targetId,
        "?$select=entityimage_url,entityimage"
      ) as Record<string, unknown>;

      const url = typeof rec["entityimage_url"] === "string" ? (rec["entityimage_url"] as string) : "";
      const b64 = typeof rec["entityimage"] === "string" ? (rec["entityimage"] as string) : "";

      if (url) {
        this._imageCache.set(targetId, url);
        imgEl.src = url;
        return;
      }
      if (b64) {
        const dataUrl = `data:image/png;base64,${b64}`;
        this._imageCache.set(targetId, dataUrl);
        imgEl.src = dataUrl;
      }
    } catch {
      // No image or no permission; leave placeholder background
    }
  }

  private getLookupRef(
    row: ComponentFramework.PropertyTypes.DataSet["records"][string],
    lookupAlias: string
  ): LookupRef | null {
    const raw: any = row.getValue(lookupAlias);

    // Typical dataset lookup shape: { id, entityType/entityTypeName, name }
    if (raw && typeof raw === "object") {
      const id = typeof raw.id === "string" ? raw.id : undefined;
      const entityType =
        typeof raw.entityTypeName === "string"
          ? (raw.entityTypeName as string)
          : typeof raw.entityType === "string"
          ? (raw.entityType as string)
          : undefined;
      const name = typeof raw.name === "string" ? (raw.name as string) : undefined;

      if (id) return { id, entityLogicalName: entityType, name };
    }

    // Fallback (rare): try "<alias>id" as GUID string
    const alt = row.getValue(lookupAlias + "id");
    if (typeof alt === "string" && this.isGuid(alt)) {
      return { id: alt };
    }

    return null;
    }

  private isGuid(s: string): boolean {
    return /^[{(]?[0-9a-fA-F]{8}[-]?[0-9a-fA-F]{4}[-]?[0-9a-fA-F]{4}[-]?[0-9a-fA-F]{4}[-]?[0-9a-fA-F]{12}[)}]?$/.test(s);
  }
}
