import { IInputs, IOutputs } from "./generated/ManifestTypes";

interface EntityMetadata {
  logicalName: string;
  displayName: string;
  fields: FieldMetadata[];
  relationships: RelationshipMetadata[];
}

interface FieldMetadata {
  logicalName: string;
  displayName: string;
  attributeType: string;
}

interface RelationshipMetadata {
  schemaName: string;
  referencedEntity: string;
  displayName: string;
}

interface SchemaNode {
  id: string;
  type: 'field' | 'object' | 'array';
  key?: string;
  fieldName?: string;
  entityName?: string;
  children?: SchemaNode[];
  parent?: string;
}

interface APISchema {
  entityName: string;
  nodes: SchemaNode[];
}

interface DraggedItem {
  type: string;
  field: string;
  entity: string;
  displayName: string;
}

export class APISchemaBuilder implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private _container: HTMLDivElement;
  private _context: ComponentFramework.Context<IInputs>;
  private _notifyOutputChanged: () => void;
  private _currentValue: string;
  
  // UI Elements
  private _entitySelect: HTMLSelectElement;
  private _fieldsPanel: HTMLDivElement;
  private _canvasPanel: HTMLDivElement;
  private _previewPanel: HTMLDivElement;
  
  // Data
  private _entities: EntityMetadata[] = [];
  private _selectedEntity: EntityMetadata | null = null;
  private _schema: APISchema = { entityName: '', nodes: [] };
  private _draggedItem: DraggedItem | null = null;
  private _nodeCounter = 0;

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ): void {
    this._context = context;
    this._notifyOutputChanged = notifyOutputChanged;
    this._container = container;
    this._currentValue = context.parameters.schemaField.raw || '';

    this.initializeUI();
    this.loadEntities();
    this.loadExistingSchema();
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void {
    this._context = context;
    const newValue = context.parameters.schemaField.raw || '';
    if (newValue !== this._currentValue) {
      this._currentValue = newValue;
      this.loadExistingSchema();
    }
  }

  public getOutputs(): IOutputs {
    return {
      schemaField: JSON.stringify(this._schema)
    };
  }

  public destroy(): void {
    // Cleanup
  }

  private initializeUI(): void {
    this._container.innerHTML = `
      <div class="api-schema-builder">
        <div class="asb-header">
          <h3>API Schema Builder</h3>
          <div>
            <label>Select Entity: </label>
            <select class="asb-input asb-entity-select" style="width: 200px; margin-left: 8px;">
              <option value="">Loading entities...</option>
            </select>
          </div>
        </div>
        <div class="asb-content">
          <div class="asb-panel asb-fields-panel">
            <div class="asb-section-header">Entity Fields & Relationships</div>
            <div class="asb-scrollable">
              <p>Select an entity to see available fields.</p>
            </div>
          </div>
          <div class="asb-panel asb-canvas-panel">
            <div class="asb-toolbar">
              <h4>Response Designer</h4>
              <button class="asb-btn asb-btn-primary asb-add-object">+ Object</button>
              <button class="asb-btn asb-btn-primary asb-add-array">+ Array</button>
            </div>
            <div class="asb-drop-zone" id="mainDropZone">
              <p>Drag fields here or add objects/arrays to build your API response structure</p>
            </div>
          </div>
          <div class="asb-panel asb-preview-panel">
            <div class="asb-section-header">Schema Preview</div>
            <div class="asb-preview-content"></div>
          </div>
        </div>
      </div>
    `;

    // Get UI references
    this._entitySelect = this._container.querySelector('.asb-entity-select') as HTMLSelectElement;
    this._fieldsPanel = this._container.querySelector('.asb-fields-panel .asb-scrollable') as HTMLDivElement;
    this._canvasPanel = this._container.querySelector('.asb-canvas-panel') as HTMLDivElement;
    this._previewPanel = this._container.querySelector('.asb-preview-content') as HTMLDivElement;

    // Add event listeners
    this._entitySelect.addEventListener('change', () => this.onEntitySelected());
    
    const addObjectBtn = this._container.querySelector('.asb-add-object') as HTMLButtonElement;
    const addArrayBtn = this._container.querySelector('.asb-add-array') as HTMLButtonElement;
    
    addObjectBtn.addEventListener('click', () => this.addNode('object'));
    addArrayBtn.addEventListener('click', () => this.addNode('array'));

    this.setupDropZone();
  }

  private setupDropZone(): void {
    const dropZone = this._container.querySelector('#mainDropZone') as HTMLDivElement;
    
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (this._draggedItem) {
        this.addFieldNode(this._draggedItem);
      }
    });
  }

  private async loadEntities(): Promise<void> {
    try {
      const response = await this._context.webAPI.retrieveMultipleRecords(
        'entitydefinition',
        '?$select=logicalname,displayname&$filter=isvalidforuicreation eq true&$orderby=displayname'
      );

      this._entities = response.entities.map((entity: Record<string, unknown>) => ({
        logicalName: entity.logicalname as string,
        displayName: (entity.displayname as string) || (entity.logicalname as string),
        fields: [],
        relationships: []
      }));

      this.populateEntitySelect();
    } catch (error) {
      console.error('Failed to load entities:', error);
      this._entitySelect.innerHTML = '<option>Error loading entities</option>';
    }
  }

  private populateEntitySelect(): void {
    this._entitySelect.innerHTML = '<option value="">Select an entity...</option>';
    this._entities.forEach(entity => {
      const option = document.createElement('option');
      option.value = entity.logicalName;
      option.textContent = entity.displayName;
      this._entitySelect.appendChild(option);
    });
  }

  private async onEntitySelected(): Promise<void> {
    const selectedLogicalName = this._entitySelect.value;
    if (!selectedLogicalName) {
      this._selectedEntity = null;
      this.renderFieldsPanel();
      return;
    }

    this._selectedEntity = this._entities.find(e => e.logicalName === selectedLogicalName) || null;
    if (!this._selectedEntity) return;

    this._fieldsPanel.innerHTML = '<div class="asb-loading">Loading entity metadata...</div>';

    try {
      // Load fields
      const fieldsResponse = await this._context.webAPI.retrieveMultipleRecords(
        'attributedefinition',
        `?$select=logicalname,displayname,attributetype&$filter=entitylogicalname eq '${selectedLogicalName}'&$orderby=displayname`
      );

      this._selectedEntity.fields = fieldsResponse.entities.map((field: Record<string, unknown>) => ({
        logicalName: field.logicalname as string,
        displayName: (field.displayname as string) || (field.logicalname as string),
        attributeType: field.attributetype as string
      }));

      this.renderFieldsPanel();
    } catch (error) {
      console.error('Failed to load entity metadata:', error);
      this._fieldsPanel.innerHTML = '<div class="asb-error">Error loading entity metadata</div>';
    }
  }

  private renderFieldsPanel(): void {
    if (!this._selectedEntity) {
      this._fieldsPanel.innerHTML = '<p>Select an entity to see available fields.</p>';
      return;
    }

    let html = `<h5>${this._selectedEntity.displayName}</h5><h6>Fields</h6>`;

    this._selectedEntity.fields.forEach(field => {
      html += `<div class="asb-field-item" draggable="true" data-type="field" data-field="${field.logicalName}" data-entity="${this._selectedEntity!.logicalName}">${field.displayName}</div>`;
    });

    this._fieldsPanel.innerHTML = html;

    // Add drag events
    this._fieldsPanel.querySelectorAll('.asb-field-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        const element = e.target as HTMLElement;
        this._draggedItem = {
          type: element.dataset.type || '',
          field: element.dataset.field || '',
          entity: element.dataset.entity || '',
          displayName: element.textContent || ''
        };
        element.classList.add('dragging');
      });

      item.addEventListener('dragend', (e) => {
        (e.target as HTMLElement).classList.remove('dragging');
      });
    });
  }

  private addNode(type: 'object' | 'array', parent?: string): void {
    const node: SchemaNode = {
      id: `node_${++this._nodeCounter}`,
      type,
      key: type === 'object' ? 'newObject' : 'newArray',
      children: [],
      parent
    };

    if (parent) {
      const parentNode = this.findNode(parent);
      if (parentNode) {
        parentNode.children = parentNode.children || [];
        parentNode.children.push(node);
      }
    } else {
      this._schema.nodes.push(node);
    }

    this.renderCanvas();
    this.updatePreview();
    this._notifyOutputChanged();
  }

  private getDataSet(): ComponentFramework.PropertyTypes.DataSet | undefined {
    // Read the dataset by its manifest name - remove this unused method or fix the cast
    return undefined;
  }

  private addFieldNode(draggedItem: DraggedItem, parent?: string): void {
    const node: SchemaNode = {
      id: `node_${++this._nodeCounter}`,
      type: 'field',
      key: draggedItem.field,
      fieldName: draggedItem.field,
      entityName: draggedItem.entity,
      parent
    };

    if (parent) {
      const parentNode = this.findNode(parent);
      if (parentNode) {
        parentNode.children = parentNode.children || [];
        parentNode.children.push(node);
      }
    } else {
      this._schema.nodes.push(node);
    }

    this.renderCanvas();
    this.updatePreview();
    this._notifyOutputChanged();
  }

  private findNode(id: string): SchemaNode | null {
    const search = (nodes: SchemaNode[]): SchemaNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = search(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this._schema.nodes);
  }

  private renderCanvas(): void {
    const dropZone = this._container.querySelector('#mainDropZone') as HTMLDivElement;
    if (!dropZone) return;

    if (this._schema.nodes.length === 0) {
      dropZone.innerHTML = '<p>Drag fields here or add objects/arrays to build your API response structure</p>';
      return;
    }

    let html = '';
    this._schema.nodes.forEach(node => {
      html += this.renderNode(node);
    });
    dropZone.innerHTML = html;

    // Add event listeners for the rendered nodes
    this.addCanvasEventListeners(dropZone);
  }

  private renderNode(node: SchemaNode, level = 0): string {
    const indent = level * 20;
    let html = `<div class="asb-node asb-node-${node.type}" style="margin-left: ${indent}px;" data-node-id="${node.id}">`;
    
    html += `<div class="asb-node-header">`;
    html += `<input class="asb-input" value="${node.key || ''}" style="flex: 1; margin-right: 8px;">`;
    html += `<span style="color: #666; margin-right: 8px;">(${node.type})</span>`;
    html += `<button class="asb-btn asb-btn-danger" data-node-id="${node.id}">×</button>`;
    html += `</div>`;

    if (node.children && node.children.length > 0) {
      html += `<div class="asb-node-children">`;
      node.children.forEach(child => {
        html += this.renderNode(child, level + 1);
      });
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  private addCanvasEventListeners(container: HTMLElement): void {
    // Handle button clicks
    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const nodeId = target.dataset.nodeId;
      
      if (target.classList.contains('asb-btn-danger') && nodeId) {
        this.deleteNode(nodeId);
      }
    });

    // Handle input changes for key renaming
    container.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const nodeId = target.closest('[data-node-id]')?.getAttribute('data-node-id');
      
      if (nodeId && target.classList.contains('asb-input')) {
        const node = this.findNode(nodeId);
        if (node) {
          node.key = target.value;
          this.updatePreview();
          this._notifyOutputChanged();
        }
      }
    });
  }

  private deleteNode(nodeId: string): void {
    const deleteFromArray = (nodes: SchemaNode[]): boolean => {
      const index = nodes.findIndex(n => n.id === nodeId);
      if (index >= 0) {
        nodes.splice(index, 1);
        return true;
      }
      for (const node of nodes) {
        if (node.children && deleteFromArray(node.children)) {
          return true;
        }
      }
      return false;
    };

    deleteFromArray(this._schema.nodes);
    this.renderCanvas();
    this.updatePreview();
    this._notifyOutputChanged();
  }

  private buildConfigFromSchema(): Record<string, unknown[]> {
    const config: Record<string, unknown[]> = { select: [], expand: [] };

    this._schema.nodes.forEach(node => {
      if (node.type === 'field' && node.fieldName) {
        (config.select as { column: string }[]).push({ column: node.fieldName });
      }
    });

    return config;
  }

  private loadExistingSchema(): void {
    if (!this._currentValue) {
      this._schema = { entityName: '', nodes: [] };
      this.renderCanvas();
      this.updatePreview();
      return;
    }

    try {
      this._schema = JSON.parse(this._currentValue);
      if (this._schema.entityName) {
        this._entitySelect.value = this._schema.entityName;
        void this.onEntitySelected();
      }
      this.renderCanvas();
      this.updatePreview();
    } catch (error) {
      console.error('Failed to parse existing schema:', error);
      this._schema = { entityName: '', nodes: [] };
    }
  }

  private updatePreview(): void {
    const config = this.buildConfigFromSchema();
    if (this._previewPanel) {
      this._previewPanel.textContent = JSON.stringify(config, null, 2);
    }
  }
}