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
  relationshipType: 'OneToMany' | 'ManyToOne' | 'ManyToMany';
}

interface LocalizedLabel {
  Label: string;
  LanguageCode: number;
}

interface DisplayNameMetadata {
  UserLocalizedLabel: LocalizedLabel;
}

interface EntityDefinitionResponse {
  LogicalName: string;
  DisplayName: DisplayNameMetadata;
}

interface AttributeDefinitionResponse {
  LogicalName: string;
  DisplayName: DisplayNameMetadata;
  AttributeType: string;
}

interface SchemaNode {
  id: string;
  type: 'field' | 'object' | 'array';
  key?: string;
  fieldName?: string;
  displayName?: string;
  entityName?: string;
  children?: SchemaNode[];
  parent?: string;
  isCollectionContainer?: boolean; // New: marks this as a collection container
  relationshipName?: string; // New: which relationship this represents
  collectionDisplayName?: string; // New: display name for the collection
}

interface APISchema {
  entityName: string;
  nodes: SchemaNode[];
}

interface StorageSchema {
  entity: string;
  searchQuery: string;
  schema: {
    entity: string;
    select: { column: string; as: string; in?: string }[];
    expand: {
      nav: string;
      as: string;
      cardinality: string;
      in?: string;
      select: { column: string; as: string }[];
    }[];
  };
}

interface DraggedItem {
  type: string;
  field: string;
  entity: string;
  displayName: string;
  referencedEntity?: string;
  relationshipType?: 'OneToMany' | 'ManyToOne' | 'ManyToMany';
  arrayOnly?: boolean;
  isCollectionContainer?: boolean; // New: indicates this creates a collection container
  relationshipName?: string; // New: for tracking which collection this belongs to
}

interface DraggedNode {
  nodeId: string;
  sourceParent?: string;
  sourceIndex: number;
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
  private _draggedNode: DraggedNode | null = null;
  private _nodeCounter = 0;
  private _expandedRelationships = new Set<string>();
  private _canvasEventsAttached = false;
  private _deleteInProgress = false;

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
    // Convert internal schema to storage format
    const storageFormat = this.convertToStorageFormat();
    return {
      schemaField: JSON.stringify(storageFormat)
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
    addObjectBtn.addEventListener('click', () => this.addNode('object'));

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
    // Check if we're running locally (no context.webAPI or in test environment)
    if (this.isLocalDevelopment()) {
      console.log('Local development detected, using test data...');
      this.loadTestEntities();
      this.populateEntitySelect();
      return;
    }

    try {
      console.log('Loading entities using EntityDefinitions...');
      // Try EntityDefinitions with proper case and simpler query first
      await this.loadEntitiesFromEntityDefinitions();
      if (this._entities.length > 0) {
        console.log(`Successfully loaded ${this._entities.length} entities from EntityDefinitions`);
        this.populateEntitySelect();
        return;
      }
    } catch (error) {
      console.error('EntityDefinitions failed:', error);
      // Fall back to testing common entities
      console.log('Falling back to testing common entities...');
      await this.loadEntitiesAlternative();
    }
  }

  private async loadEntitiesFromEntityDefinitions(): Promise<void> {
    try {
      console.log('Loading entities using correct EntityDefinitions syntax...');
      
      // Use the correct syntax for EntityDefinitions
      const response = await this._context.webAPI.retrieveMultipleRecords(
        'EntityDefinitions', 
        '?$select=LogicalName,DisplayName&$filter=IsValidForAdvancedFind eq true&$orderby=DisplayName desc&$top=100'
      );
      
      if (response && response.entities && response.entities.length > 0) {
        this._entities = response.entities.map((entity: Record<string, unknown>) => {
          const logicalName = entity.LogicalName as string;
          let displayName = logicalName;
          
          // Try to get display name from different possible structures
          if (entity.DisplayName) {
            const displayNameObj = entity.DisplayName as Record<string, unknown>;
            if (displayNameObj.UserLocalizedLabel && 
                typeof displayNameObj.UserLocalizedLabel === 'object' &&
                displayNameObj.UserLocalizedLabel !== null) {
              const localizedLabel = displayNameObj.UserLocalizedLabel as Record<string, unknown>;
              if (localizedLabel.Label && typeof localizedLabel.Label === 'string') {
                displayName = localizedLabel.Label;
              }
            } else if (displayNameObj.Label && typeof displayNameObj.Label === 'string') {
              displayName = displayNameObj.Label;
            } else if (typeof displayNameObj === 'string') {
              displayName = displayNameObj;
            }
          }
          
          return {
            logicalName,
            displayName,
            fields: [],
            relationships: []
          };
        });
        
        console.log(`Successfully loaded ${this._entities.length} entities from EntityDefinitions`);
        return;
      }
    } catch (error) {
      console.error('EntityDefinitions query failed:', error);
      throw error;
    }
  }

  private async loadEntitiesAlternative(): Promise<void> {
    try {
      // Common standard entities that are usually available
      const commonEntities = [
        { logicalName: 'account', displayName: 'Account' },
        { logicalName: 'contact', displayName: 'Contact' },
        { logicalName: 'lead', displayName: 'Lead' },
        { logicalName: 'opportunity', displayName: 'Opportunity' },
        { logicalName: 'incident', displayName: 'Case' },
        { logicalName: 'systemuser', displayName: 'User' },
        { logicalName: 'team', displayName: 'Team' },
        { logicalName: 'task', displayName: 'Task' },
        { logicalName: 'appointment', displayName: 'Appointment' },
        { logicalName: 'email', displayName: 'Email' },
        { logicalName: 'phonecall', displayName: 'Phone Call' },
        { logicalName: 'letter', displayName: 'Letter' },
        { logicalName: 'annotation', displayName: 'Note' },
        { logicalName: 'activitypointer', displayName: 'Activity' },
        // Add some potential custom entities that might exist in legal environments
        { logicalName: 'contract', displayName: 'Contract' },
        { logicalName: 'invoice', displayName: 'Invoice' },
        { logicalName: 'quote', displayName: 'Quote' },
        { logicalName: 'salesorder', displayName: 'Order' }
      ];

      // Try to validate these entities exist by attempting to retrieve metadata
      const validEntities = [];
      for (const entity of commonEntities) {
        try {
          // Try to query the entity with minimal data to check if it exists
          await this._context.webAPI.retrieveMultipleRecords(entity.logicalName, '?$top=1&$select=createdon');
          validEntities.push({
            logicalName: entity.logicalName,
            displayName: entity.displayName,
            fields: [],
            relationships: []
          });
        } catch {
          // Entity doesn't exist or no access, skip it
          console.log(`Entity ${entity.logicalName} not available or no access`);
        }
      }

      this._entities = validEntities;
      this.populateEntitySelect();
      
      if (validEntities.length === 0) {
        this._entitySelect.innerHTML = '<option>No accessible entities found. Check permissions.</option>';
      }
    } catch (error) {
      console.error('Failed to load entities with alternative method:', error);
      this._entitySelect.innerHTML = '<option>Error loading entities. Check permissions.</option>';
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
      this._schema.entityName = '';
      this.renderFieldsPanel();
      this._notifyOutputChanged();
      return;
    }

    this._selectedEntity = this._entities.find(e => e.logicalName === selectedLogicalName) || null;
    if (!this._selectedEntity) return;

    // Update schema with selected entity
    this._schema.entityName = selectedLogicalName;
    this._notifyOutputChanged();

    this._fieldsPanel.innerHTML = '<div class="asb-loading">Loading entity metadata...</div>';

    // Check if we're in local development mode
    if (this.isLocalDevelopment()) {
      console.log(`Loading test fields for entity: ${selectedLogicalName}`);
      this.loadTestFields(selectedLogicalName);
      this.renderFieldsPanel();
      return;
    }

    try {
      console.log(`Loading fields for entity: ${selectedLogicalName}`);
      
      // Try AttributeDefinitions first
      await this.loadFieldsFromAttributeDefinitions(selectedLogicalName);
      if (this._selectedEntity.fields.length > 0) {
        console.log(`Successfully loaded ${this._selectedEntity.fields.length} fields from AttributeDefinitions`);
        this.renderFieldsPanel();
        return;
      }
    } catch (error) {
      console.error('AttributeDefinitions failed:', error);
      console.log('Falling back to alternative field loading...');
      await this.loadFieldsAlternative(selectedLogicalName);
    }
  }

  private isLocalDevelopment(): boolean {
    // Check if we're running in local development environment
    // This can be detected by various means:
    // 1. No webAPI context (development harness)
    // 2. localhost URL
    // 3. No actual Dataverse connection
    
    try {
      // Check if we have a proper webAPI context
      if (!this._context.webAPI) {
        return true;
      }
      
      // Check if we're running on localhost
      if (typeof window !== 'undefined' && window.location && 
          (window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' || 
           window.location.protocol === 'file:')) {
        return true;
      }
      
      // Check if this is the test harness (common in PCF development)
      if (typeof window !== 'undefined' && window.location && 
          window.location.href.includes('/_pkg/')) {
        return true;
      }
      
      return false;
    } catch {
      // If any of these checks fail, assume we're in local development
      return true;
    }
  }

  private loadTestEntities(): void {
    console.log('Loading test entities for local development...');
    
    this._entities = [
      {
        logicalName: 'account',
        displayName: 'Account',
        fields: [],
        relationships: []
      },
      {
        logicalName: 'contact',
        displayName: 'Contact',
        fields: [],
        relationships: []
      },
      {
        logicalName: 'lead',
        displayName: 'Lead',
        fields: [],
        relationships: []
      },
      {
        logicalName: 'opportunity',
        displayName: 'Opportunity',
        fields: [],
        relationships: []
      },
      {
        logicalName: 'incident',
        displayName: 'Case',
        fields: [],
        relationships: []
      },
      {
        logicalName: 'contract',
        displayName: 'Contract',
        fields: [],
        relationships: []
      },
      {
        logicalName: 'invoice',
        displayName: 'Invoice',
        fields: [],
        relationships: []
      },
      {
        logicalName: 'systemuser',
        displayName: 'User',
        fields: [],
        relationships: []
      },
      {
        logicalName: 'team',
        displayName: 'Team',
        fields: [],
        relationships: []
      },
      {
        logicalName: 'businessunit',
        displayName: 'Business Unit',
        fields: [],
        relationships: []
      }
    ];
  }

  private loadTestFields(entityName: string): void {
    if (!this._selectedEntity) return;
    
    console.log(`Loading test fields for entity: ${entityName}`);
    
    // Common base fields that appear in most entities
    const baseFields: FieldMetadata[] = [
      { logicalName: 'createdon', displayName: 'Created On', attributeType: 'DateTime' },
      { logicalName: 'modifiedon', displayName: 'Modified On', attributeType: 'DateTime' },
      { logicalName: 'createdby', displayName: 'Created By', attributeType: 'Lookup' },
      { logicalName: 'modifiedby', displayName: 'Modified By', attributeType: 'Lookup' },
      { logicalName: 'ownerid', displayName: 'Owner', attributeType: 'Owner' },
      { logicalName: 'statecode', displayName: 'Status', attributeType: 'Picklist' },
      { logicalName: 'statuscode', displayName: 'Status Reason', attributeType: 'Picklist' },
      { logicalName: 'versionnumber', displayName: 'Version Number', attributeType: 'BigInt' }
    ];

    const baseRelationships: RelationshipMetadata[] = [
      { schemaName: 'createdby_user', referencedEntity: 'systemuser', displayName: 'Created By (User)', relationshipType: 'ManyToOne' },
      { schemaName: 'modifiedby_user', referencedEntity: 'systemuser', displayName: 'Modified By (User)', relationshipType: 'ManyToOne' },
      { schemaName: 'owner_user', referencedEntity: 'systemuser', displayName: 'Owner (User)', relationshipType: 'ManyToOne' },
      { schemaName: 'owner_team', referencedEntity: 'team', displayName: 'Owner (Team)', relationshipType: 'ManyToOne' }
    ];

    let specificFields: FieldMetadata[] = [];
    let specificRelationships: RelationshipMetadata[] = [];

    // Entity-specific test fields
    switch (entityName.toLowerCase()) {
      case 'account':
        specificFields = [
          { logicalName: 'accountid', displayName: 'Account ID', attributeType: 'UniqueIdentifier' },
          { logicalName: 'name', displayName: 'Account Name', attributeType: 'String' },
          { logicalName: 'accountnumber', displayName: 'Account Number', attributeType: 'String' },
          { logicalName: 'telephone1', displayName: 'Main Phone', attributeType: 'String' },
          { logicalName: 'emailaddress1', displayName: 'Email', attributeType: 'String' },
          { logicalName: 'websiteurl', displayName: 'Website', attributeType: 'String' },
          { logicalName: 'revenue', displayName: 'Annual Revenue', attributeType: 'Money' },
          { logicalName: 'numberofemployees', displayName: 'Number of Employees', attributeType: 'Integer' },
          { logicalName: 'industrycode', displayName: 'Industry', attributeType: 'Picklist' },
          { logicalName: 'address1_line1', displayName: 'Street 1', attributeType: 'String' },
          { logicalName: 'address1_city', displayName: 'City', attributeType: 'String' },
          { logicalName: 'address1_stateorprovince', displayName: 'State/Province', attributeType: 'String' },
          { logicalName: 'address1_postalcode', displayName: 'ZIP/Postal Code', attributeType: 'String' },
          { logicalName: 'address1_country', displayName: 'Country', attributeType: 'String' },
          { logicalName: 'parentaccountid', displayName: 'Parent Account', attributeType: 'Lookup' },
          { logicalName: 'primarycontactid', displayName: 'Primary Contact', attributeType: 'Lookup' }
        ];
        specificRelationships = [
          { schemaName: 'account_parent_account', referencedEntity: 'account', displayName: 'Parent Account', relationshipType: 'ManyToOne' },
          { schemaName: 'account_primary_contact', referencedEntity: 'contact', displayName: 'Primary Contact', relationshipType: 'ManyToOne' },
          { schemaName: 'account_contacts', referencedEntity: 'contact', displayName: 'Contacts', relationshipType: 'OneToMany' },
          { schemaName: 'account_opportunities', referencedEntity: 'opportunity', displayName: 'Opportunities', relationshipType: 'OneToMany' }
        ];
        break;
      
      case 'contact':
        specificFields = [
          { logicalName: 'contactid', displayName: 'Contact ID', attributeType: 'UniqueIdentifier' },
          { logicalName: 'fullname', displayName: 'Full Name', attributeType: 'String' },
          { logicalName: 'firstname', displayName: 'First Name', attributeType: 'String' },
          { logicalName: 'lastname', displayName: 'Last Name', attributeType: 'String' },
          { logicalName: 'emailaddress1', displayName: 'Email', attributeType: 'String' },
          { logicalName: 'telephone1', displayName: 'Business Phone', attributeType: 'String' },
          { logicalName: 'mobilephone', displayName: 'Mobile Phone', attributeType: 'String' },
          { logicalName: 'jobtitle', displayName: 'Job Title', attributeType: 'String' },
          { logicalName: 'birthdate', displayName: 'Birthday', attributeType: 'DateTime' },
          { logicalName: 'gendercode', displayName: 'Gender', attributeType: 'Picklist' },
          { logicalName: 'parentcustomerid', displayName: 'Company Name', attributeType: 'Customer' },
          { logicalName: 'address1_line1', displayName: 'Street 1', attributeType: 'String' },
          { logicalName: 'address1_city', displayName: 'City', attributeType: 'String' },
          { logicalName: 'address1_stateorprovince', displayName: 'State/Province', attributeType: 'String' },
          { logicalName: 'address1_postalcode', displayName: 'ZIP/Postal Code', attributeType: 'String' }
        ];
        specificRelationships = [
          { schemaName: 'contact_customer_account', referencedEntity: 'account', displayName: 'Company (Account)', relationshipType: 'ManyToOne' },
          { schemaName: 'contact_opportunities', referencedEntity: 'opportunity', displayName: 'Opportunities', relationshipType: 'OneToMany' },
          { schemaName: 'contact_cases', referencedEntity: 'incident', displayName: 'Cases', relationshipType: 'OneToMany' }
        ];
        break;
      
      case 'opportunity':
        specificFields = [
          { logicalName: 'opportunityid', displayName: 'Opportunity ID', attributeType: 'UniqueIdentifier' },
          { logicalName: 'name', displayName: 'Topic', attributeType: 'String' },
          { logicalName: 'customerid', displayName: 'Potential Customer', attributeType: 'Customer' },
          { logicalName: 'estimatedvalue', displayName: 'Est. Revenue', attributeType: 'Money' },
          { logicalName: 'actualvalue', displayName: 'Actual Revenue', attributeType: 'Money' },
          { logicalName: 'closeprobability', displayName: 'Probability', attributeType: 'Integer' },
          { logicalName: 'estimatedclosedate', displayName: 'Est. Close Date', attributeType: 'DateTime' },
          { logicalName: 'actualclosedate', displayName: 'Actual Close Date', attributeType: 'DateTime' },
          { logicalName: 'salesstage', displayName: 'Sales Stage', attributeType: 'Picklist' },
          { logicalName: 'description', displayName: 'Description', attributeType: 'Memo' }
        ];
        specificRelationships = [
          { schemaName: 'opportunity_customer_account', referencedEntity: 'account', displayName: 'Customer (Account)', relationshipType: 'ManyToOne' },
          { schemaName: 'opportunity_customer_contact', referencedEntity: 'contact', displayName: 'Customer (Contact)', relationshipType: 'ManyToOne' },
          { schemaName: 'opportunity_quotes', referencedEntity: 'quote', displayName: 'Quotes', relationshipType: 'OneToMany' }
        ];
        break;
      
      case 'contract':
        specificFields = [
          { logicalName: 'contractid', displayName: 'Contract ID', attributeType: 'UniqueIdentifier' },
          { logicalName: 'title', displayName: 'Contract Title', attributeType: 'String' },
          { logicalName: 'contractnumber', displayName: 'Contract Number', attributeType: 'String' },
          { logicalName: 'customerid', displayName: 'Customer', attributeType: 'Customer' },
          { logicalName: 'totalvalue', displayName: 'Total Value', attributeType: 'Money' },
          { logicalName: 'activeon', displayName: 'Contract Start Date', attributeType: 'DateTime' },
          { logicalName: 'expireson', displayName: 'Contract End Date', attributeType: 'DateTime' },
          { logicalName: 'contracttypecode', displayName: 'Contract Type', attributeType: 'Picklist' },
          { logicalName: 'statuscode', displayName: 'Status Reason', attributeType: 'Picklist' },
          { logicalName: 'description', displayName: 'Description', attributeType: 'Memo' },
          { logicalName: 'legaldepartmentreview', displayName: 'Legal Review Required', attributeType: 'Boolean' },
          { logicalName: 'riskassessment', displayName: 'Risk Assessment', attributeType: 'Picklist' }
        ];
        specificRelationships = [
          { schemaName: 'contract_customer_account', referencedEntity: 'account', displayName: 'Customer (Account)', relationshipType: 'ManyToOne' },
          { schemaName: 'contract_customer_contact', referencedEntity: 'contact', displayName: 'Customer (Contact)', relationshipType: 'ManyToOne' },
          { schemaName: 'contract_opportunities', referencedEntity: 'opportunity', displayName: 'Related Opportunities', relationshipType: 'OneToMany' }
        ];
        break;
      
      case 'systemuser':
        specificFields = [
          { logicalName: 'systemuserid', displayName: 'User ID', attributeType: 'UniqueIdentifier' },
          { logicalName: 'fullname', displayName: 'Full Name', attributeType: 'String' },
          { logicalName: 'firstname', displayName: 'First Name', attributeType: 'String' },
          { logicalName: 'lastname', displayName: 'Last Name', attributeType: 'String' },
          { logicalName: 'internalemailaddress', displayName: 'Email', attributeType: 'String' },
          { logicalName: 'domainname', displayName: 'User Name', attributeType: 'String' },
          { logicalName: 'businessunitid', displayName: 'Business Unit', attributeType: 'Lookup' },
          { logicalName: 'title', displayName: 'Title', attributeType: 'String' },
          { logicalName: 'isdisabled', displayName: 'Status', attributeType: 'Boolean' },
          { logicalName: 'accessmode', displayName: 'Access Mode', attributeType: 'Picklist' }
        ];
        specificRelationships = [
          { schemaName: 'user_business_unit', referencedEntity: 'businessunit', displayName: 'Business Unit', relationshipType: 'ManyToOne' },
          { schemaName: 'user_accounts', referencedEntity: 'account', displayName: 'Owned Accounts', relationshipType: 'OneToMany' },
          { schemaName: 'user_contacts', referencedEntity: 'contact', displayName: 'Owned Contacts', relationshipType: 'OneToMany' }
        ];
        break;
      
      default:
        // Generic entity
        specificFields = [
          { logicalName: `${entityName}id`, displayName: `${entityName.charAt(0).toUpperCase() + entityName.slice(1)} ID`, attributeType: 'UniqueIdentifier' },
          { logicalName: 'name', displayName: 'Name', attributeType: 'String' },
          { logicalName: 'description', displayName: 'Description', attributeType: 'Memo' }
        ];
        break;
    }

    // Combine specific fields with base fields
    this._selectedEntity.fields = [...specificFields, ...baseFields];
    this._selectedEntity.relationships = [...specificRelationships, ...baseRelationships];

    console.log(`Loaded ${this._selectedEntity.fields.length} test fields and ${this._selectedEntity.relationships.length} test relationships for ${entityName}`);
  }

  private async loadFieldsFromAttributeDefinitions(entityName: string): Promise<void> {
    try {
      console.log(`Loading fields and relationships for entity: ${entityName}`);
      
      // Method 1: Get comprehensive entity metadata with attributes and relationships in one call
      try {
        const expandQuery = `?$select=LogicalName&$expand=Attributes($select=LogicalName,AttributeType,DisplayName,IsCustomAttribute,IsValidForCreate,IsValidForRead,IsValidForUpdate,RequiredLevel),ManyToOneRelationships($select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute),OneToManyRelationships($select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute),ManyToManyRelationships($select=SchemaName,Entity1LogicalName,Entity2LogicalName,IntersectEntityName)`;
        
        const response = await this._context.webAPI.retrieveRecord(
          'EntityDefinitions',
          `(LogicalName='${entityName}')`,
          expandQuery
        );
        
        if (response && response.Attributes) {
          const fields: FieldMetadata[] = [];
          const relationships: RelationshipMetadata[] = [];
          
          // Process attributes
          response.Attributes.forEach((attr: Record<string, unknown>) => {
            const logicalName = attr.LogicalName as string;
            const attributeType = attr.AttributeType as string;
            let displayName = logicalName;
            
            // Get display name
            if (attr.DisplayName) {
              const displayNameObj = attr.DisplayName as Record<string, unknown>;
              if (displayNameObj.UserLocalizedLabel && 
                  typeof displayNameObj.UserLocalizedLabel === 'object' &&
                  displayNameObj.UserLocalizedLabel !== null) {
                const localizedLabel = displayNameObj.UserLocalizedLabel as Record<string, unknown>;
                if (localizedLabel.Label && typeof localizedLabel.Label === 'string') {
                  displayName = localizedLabel.Label;
                }
              }
            }
            
            // If we still don't have a good display name, format the logical name
            if (displayName === logicalName) {
              displayName = this.formatFieldName(logicalName);
            }
            
            fields.push({
              logicalName,
              displayName,
              attributeType: attributeType || 'string'
            });
          });
          
          // Process ManyToOne relationships
          if (response.ManyToOneRelationships) {
            response.ManyToOneRelationships.forEach((rel: Record<string, unknown>) => {
              const schemaName = rel.SchemaName as string;
              const referencedEntity = rel.ReferencedEntity as string;
              relationships.push({
                schemaName,
                referencedEntity,
                displayName: `${schemaName} (${referencedEntity})`,
                relationshipType: 'ManyToOne'
              });
            });
          }
          
          // Process OneToMany relationships
          if (response.OneToManyRelationships) {
            response.OneToManyRelationships.forEach((rel: Record<string, unknown>) => {
              const schemaName = rel.SchemaName as string;
              const referencingEntity = rel.ReferencingEntity as string;
              relationships.push({
                schemaName,
                referencedEntity: referencingEntity,
                displayName: `${schemaName} (${referencingEntity} collection)`,
                relationshipType: 'OneToMany'
              });
            });
          }
          
          // Process ManyToMany relationships
          if (response.ManyToManyRelationships) {
            response.ManyToManyRelationships.forEach((rel: Record<string, unknown>) => {
              const schemaName = rel.SchemaName as string;
              const entity1 = rel.Entity1LogicalName as string;
              const entity2 = rel.Entity2LogicalName as string;
              const otherEntity = entity1 === entityName ? entity2 : entity1;
              relationships.push({
                schemaName,
                referencedEntity: otherEntity,
                displayName: `${schemaName} (${otherEntity} collection)`,
                relationshipType: 'ManyToMany'
              });
            });
          }
          
          if (this._selectedEntity) {
            // Sort fields by display name
            fields.sort((a, b) => a.displayName.localeCompare(b.displayName));
            this._selectedEntity.fields = fields;
            this._selectedEntity.relationships = relationships;
          }
          
          console.log(`Successfully loaded ${fields.length} fields and ${relationships.length} relationships`);
          return;
        }
      } catch (error) {
        console.log('Comprehensive query failed, trying individual queries:', error);
      }
      
      // Method 2: If comprehensive query fails, try just attributes
      try {
        const attributesQuery = `/Attributes?$select=LogicalName,AttributeType,DisplayName,IsCustomAttribute,IsValidForCreate,IsValidForRead,IsValidForUpdate,RequiredLevel`;
        const response = await this._context.webAPI.retrieveMultipleRecords(
          'EntityDefinitions',
          `(LogicalName='${entityName}')${attributesQuery}`
        );
        
        if (response && response.entities && response.entities.length > 0) {
          const fields = response.entities.map((field: Record<string, unknown>) => {
            const logicalName = field.LogicalName as string;
            let displayName = logicalName;
            const attributeType = field.AttributeType as string;
            
            // Get display name
            if (field.DisplayName) {
              const displayNameObj = field.DisplayName as Record<string, unknown>;
              if (displayNameObj.UserLocalizedLabel && 
                  typeof displayNameObj.UserLocalizedLabel === 'object' &&
                  displayNameObj.UserLocalizedLabel !== null) {
                const localizedLabel = displayNameObj.UserLocalizedLabel as Record<string, unknown>;
                if (localizedLabel.Label && typeof localizedLabel.Label === 'string') {
                  displayName = localizedLabel.Label;
                }
              }
            }
            
            // If we still don't have a good display name, format the logical name
            if (displayName === logicalName) {
              displayName = this.formatFieldName(logicalName);
            }
            
            return {
              logicalName,
              displayName,
              attributeType: attributeType || 'string'
            };
          });
          
          if (this._selectedEntity) {
            // Sort fields by display name
            fields.sort((a, b) => a.displayName.localeCompare(b.displayName));
            this._selectedEntity.fields = fields;
          }
          
          console.log(`Successfully loaded ${fields.length} fields from individual attributes query`);
          return;
        }
      } catch (error) {
        console.log('Individual attributes query also failed:', error);
        throw error;
      }
      
    } catch (error) {
      console.error('All AttributeDefinitions queries failed:', error);
      throw error;
    }
  }

  private async loadFieldsAlternative(entityName: string): Promise<void> {
    try {
      // Try to get one record to inspect available fields, but with fallback
      let response;
      try {
        response = await this._context.webAPI.retrieveMultipleRecords(
          entityName,
          '?$top=1'
        );
      } catch (error) {
        // If that fails, try with common fields that usually exist
        const commonFields = this.getCommonFieldsForEntity(entityName);
        if (this._selectedEntity) {
          this._selectedEntity.fields = commonFields;
        }
        this.renderFieldsPanel();
        return;
      }

      if (response && response.entities && response.entities.length > 0) {
        const sampleRecord = response.entities[0];
        const fields = Object.keys(sampleRecord)
          .filter(key => !key.startsWith('_') && !key.endsWith('_formatted')) // Filter out system fields
          .map(key => ({
            logicalName: key,
            displayName: this.formatFieldName(key),
            attributeType: typeof sampleRecord[key]
          }));

        if (this._selectedEntity) {
          this._selectedEntity.fields = fields;
        }
      } else {
        // Fallback to common fields
        const commonFields = this.getCommonFieldsForEntity(entityName);
        if (this._selectedEntity) {
          this._selectedEntity.fields = commonFields;
        }
      }

      this.renderFieldsPanel();
    } catch (error) {
      console.error('Failed to load fields with alternative method:', error);
      // Last resort: use common fields
      const commonFields = this.getCommonFieldsForEntity(entityName);
      if (this._selectedEntity) {
        this._selectedEntity.fields = commonFields;
      }
      this.renderFieldsPanel();
    }
  }

  private formatFieldName(logicalName: string): string {
    // Convert logical names to readable format
    return logicalName
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .replace(/id$/i, 'ID'); // Replace 'id' at end with 'ID'
  }

  private getCommonFieldsForEntity(entityName: string): FieldMetadata[] {
    const commonBaseFields = [
      { logicalName: 'createdon', displayName: 'Created On', attributeType: 'datetime' },
      { logicalName: 'modifiedon', displayName: 'Modified On', attributeType: 'datetime' },
      { logicalName: 'createdby', displayName: 'Created By', attributeType: 'lookup' },
      { logicalName: 'modifiedby', displayName: 'Modified By', attributeType: 'lookup' },
      { logicalName: 'ownerid', displayName: 'Owner', attributeType: 'lookup' },
      { logicalName: 'statecode', displayName: 'Status', attributeType: 'picklist' },
      { logicalName: 'statuscode', displayName: 'Status Reason', attributeType: 'picklist' }
    ];

    switch (entityName.toLowerCase()) {
      case 'account':
        return [
          { logicalName: 'accountid', displayName: 'Account ID', attributeType: 'uniqueidentifier' },
          { logicalName: 'name', displayName: 'Account Name', attributeType: 'string' },
          { logicalName: 'accountnumber', displayName: 'Account Number', attributeType: 'string' },
          { logicalName: 'telephone1', displayName: 'Main Phone', attributeType: 'string' },
          { logicalName: 'emailaddress1', displayName: 'Email', attributeType: 'string' },
          { logicalName: 'websiteurl', displayName: 'Website', attributeType: 'string' },
          { logicalName: 'address1_line1', displayName: 'Street 1', attributeType: 'string' },
          { logicalName: 'address1_city', displayName: 'City', attributeType: 'string' },
          { logicalName: 'address1_stateorprovince', displayName: 'State/Province', attributeType: 'string' },
          { logicalName: 'address1_postalcode', displayName: 'ZIP/Postal Code', attributeType: 'string' },
          { logicalName: 'address1_country', displayName: 'Country', attributeType: 'string' },
          ...commonBaseFields
        ];
      case 'contact':
        return [
          { logicalName: 'contactid', displayName: 'Contact ID', attributeType: 'uniqueidentifier' },
          { logicalName: 'fullname', displayName: 'Full Name', attributeType: 'string' },
          { logicalName: 'firstname', displayName: 'First Name', attributeType: 'string' },
          { logicalName: 'lastname', displayName: 'Last Name', attributeType: 'string' },
          { logicalName: 'emailaddress1', displayName: 'Email', attributeType: 'string' },
          { logicalName: 'telephone1', displayName: 'Business Phone', attributeType: 'string' },
          { logicalName: 'mobilephone', displayName: 'Mobile Phone', attributeType: 'string' },
          { logicalName: 'jobtitle', displayName: 'Job Title', attributeType: 'string' },
          { logicalName: 'parentcustomerid', displayName: 'Company Name', attributeType: 'lookup' },
          { logicalName: 'address1_line1', displayName: 'Street 1', attributeType: 'string' },
          { logicalName: 'address1_city', displayName: 'City', attributeType: 'string' },
          { logicalName: 'address1_stateorprovince', displayName: 'State/Province', attributeType: 'string' },
          { logicalName: 'address1_postalcode', displayName: 'ZIP/Postal Code', attributeType: 'string' },
          ...commonBaseFields
        ];
      case 'systemuser':
        return [
          { logicalName: 'systemuserid', displayName: 'User ID', attributeType: 'uniqueidentifier' },
          { logicalName: 'fullname', displayName: 'Full Name', attributeType: 'string' },
          { logicalName: 'firstname', displayName: 'First Name', attributeType: 'string' },
          { logicalName: 'lastname', displayName: 'Last Name', attributeType: 'string' },
          { logicalName: 'internalemailaddress', displayName: 'Email', attributeType: 'string' },
          { logicalName: 'domainname', displayName: 'User Name', attributeType: 'string' },
          { logicalName: 'businessunitid', displayName: 'Business Unit', attributeType: 'lookup' },
          { logicalName: 'title', displayName: 'Title', attributeType: 'string' },
          { logicalName: 'isdisabled', displayName: 'Status', attributeType: 'boolean' },
          ...commonBaseFields
        ];
      default:
        return [
          { logicalName: `${entityName}id`, displayName: `${entityName.charAt(0).toUpperCase() + entityName.slice(1)} ID`, attributeType: 'uniqueidentifier' },
          { logicalName: 'name', displayName: 'Name', attributeType: 'string' },
          ...commonBaseFields
        ];
    }
  }

  private renderFieldsPanel(): void {
    if (!this._selectedEntity) {
      this._fieldsPanel.innerHTML = '<p>Select an entity to see available fields.</p>';
      return;
    }

    let html = `<h5>${this._selectedEntity.displayName}</h5>`;

    // Fields Section
    html += `<div class="asb-field-section">`;
    html += `<h6>Fields <span class="asb-hint">(${this._selectedEntity.fields.length} fields - drag to objects or root)</span></h6>`;
    this._selectedEntity.fields.forEach(field => {
      const isLookup = field.attributeType === 'Lookup' || field.attributeType === 'Customer' || field.attributeType === 'Owner';
      const fieldClass = isLookup ? 'asb-field-item asb-lookup-field' : 'asb-field-item';
      html += `<div class="${fieldClass}" draggable="true" data-type="field" data-field="${field.logicalName}" data-entity="${this._selectedEntity!.logicalName}" data-field-type="${field.attributeType}">`;
      html += `<span class="asb-field-name">${field.displayName}</span>`;
      html += `<span class="asb-field-type">${field.attributeType}</span>`;
      html += `</div>`;
    });
    html += `</div>`;

    // Group relationships by type
    const lookupRelationships = this._selectedEntity.relationships.filter(r => r.relationshipType === 'ManyToOne');
    const collectionRelationships = this._selectedEntity.relationships.filter(r => r.relationshipType === 'OneToMany' || r.relationshipType === 'ManyToMany');

    // Lookup Relationships Section (ManyToOne - expandable)
    if (lookupRelationships.length > 0) {
      html += `<div class="asb-relationship-section">`;
      html += `<div class="asb-section-header">`;
      html += `<h5 class="asb-section-title">📎 Lookup Relationships</h5>`;
      html += `<span class="asb-section-badge">${lookupRelationships.length}</span>`;
      html += `</div>`;
      html += `<p class="asb-section-description">Expand to see related entity fields (can be dragged anywhere)</p>`;
      lookupRelationships.forEach(rel => {
        const isExpanded = this._expandedRelationships.has(rel.schemaName);
        html += `<div class="asb-expandable-relationship">`;
        html += `<div class="asb-relationship-pill asb-lookup-pill" data-relationship="${rel.schemaName}" data-referenced-entity="${rel.referencedEntity}">`;
        html += `<span class="asb-expand-icon">${isExpanded ? '▼' : '▶'}</span>`;
        html += `<span class="asb-relationship-text">`;
        html += `<span class="asb-relationship-name">${rel.displayName}</span>`;
        html += `<span class="asb-relationship-type">${rel.relationshipType}</span>`;
        html += `</span>`;
        html += `</div>`;
        
        if (isExpanded) {
          html += `<div class="asb-related-fields">`;
          // In a real implementation, we'd load the fields for the referenced entity
          // For now, show some common fields as example
          const relatedFields = this.getCommonFieldsForEntity(rel.referencedEntity);
          relatedFields.slice(0, 6).forEach(field => { // Show first 6 fields
            html += `<div class="asb-field-item asb-related-field" draggable="true" data-type="field" data-field="${field.logicalName}" data-entity="${rel.referencedEntity}" data-field-type="${field.attributeType}">`;
            html += `<span class="asb-field-name">${field.displayName}</span>`;
            html += `<span class="asb-field-type">${field.attributeType}</span>`;
            html += `</div>`;
          });
          html += `</div>`;
        }
        html += `</div>`;
      });
      html += `</div>`;
    }

    // Collection Relationships Section (OneToMany/ManyToMany - expandable, fields only draggable into arrays)
    if (collectionRelationships.length > 0) {
      html += `<div class="asb-relationship-section">`;
      html += `<div class="asb-section-header">`;
      html += `<h5 class="asb-section-title">📂 Collection Relationships</h5>`;
      html += `<span class="asb-section-badge">${collectionRelationships.length}</span>`;
      html += `</div>`;
      html += `<p class="asb-section-description">Drag relationship names to create collections, or expand to drag individual fields</p>`;
      collectionRelationships.forEach(rel => {
        const isExpanded = this._expandedRelationships.has(rel.schemaName);
        html += `<div class="asb-expandable-relationship">`;
        html += `<div class="asb-relationship-pill asb-collection-pill asb-draggable-relationship" draggable="true" data-type="collection-container" data-relationship="${rel.schemaName}" data-referenced-entity="${rel.referencedEntity}" data-display-name="${rel.displayName}">`;
        html += `<span class="asb-drag-handle">⋮⋮</span>`;
        html += `<span class="asb-expand-icon">${isExpanded ? '▼' : '▶'}</span>`;
        html += `<span class="asb-relationship-text">`;
        html += `<span class="asb-relationship-name">${rel.displayName}</span>`;
        html += `<span class="asb-relationship-type">${rel.relationshipType}</span>`;
        html += `</span>`;
        html += `</div>`;
        
        if (isExpanded) {
          html += `<div class="asb-related-fields">`;
          // In a real implementation, we'd load the fields for the referenced entity
          const relatedFields = this.getCommonFieldsForEntity(rel.referencedEntity);
          relatedFields.slice(0, 6).forEach(field => { // Show first 6 fields
            html += `<div class="asb-field-item asb-related-field asb-collection-field" draggable="true" data-type="related-field" data-field="${field.logicalName}" data-entity="${rel.referencedEntity}" data-field-type="${field.attributeType}" data-relation-type="collection" data-relationship-name="${rel.schemaName}">`;
            html += `<span class="asb-field-name">${field.displayName}</span>`;
            html += `<span class="asb-field-type">${field.attributeType}</span>`;
            html += `</div>`;
          });
          html += `</div>`;
        }
        html += `</div>`;
      });
      html += `</div>`;
    }

    // Fallback: Show lookup fields as relationships if we don't have explicit relationship data
    if (lookupRelationships.length === 0 && collectionRelationships.length === 0) {
      const lookupFields = this._selectedEntity.fields.filter(f => 
        f.attributeType === 'Lookup' || f.attributeType === 'Customer' || f.attributeType === 'Owner'
      );
      if (lookupFields.length > 0) {
        html += `<div class="asb-relationship-section">`;
        html += `<h6>Relationships (from lookups) <span class="asb-hint">(expand for related fields)</span></h6>`;
        lookupFields.forEach(field => {
          const isExpanded = this._expandedRelationships.has(field.logicalName);
          html += `<div class="asb-expandable-relationship">`;
          html += `<div class="asb-relationship-header" data-relationship="${field.logicalName}" data-referenced-entity="systemuser">`;
          html += `<span class="asb-expand-icon">${isExpanded ? '▼' : '▶'}</span>`;
          html += `<span class="asb-field-name">${field.displayName} (related)</span>`;
          html += `<span class="asb-field-type">ManyToOne</span>`;
          html += `</div>`;
          if (isExpanded) {
            html += `<div class="asb-related-fields">`;
            const relatedFields = this.getCommonFieldsForEntity('systemuser');
            relatedFields.slice(0, 4).forEach(relField => {
              html += `<div class="asb-field-item asb-related-field" draggable="true" data-type="field" data-field="${relField.logicalName}" data-entity="systemuser" data-field-type="${relField.attributeType}">`;
              html += `<span class="asb-field-name">${relField.displayName}</span>`;
              html += `<span class="asb-field-type">${relField.attributeType}</span>`;
              html += `</div>`;
            });
            html += `</div>`;
          }
          html += `</div>`;
        });
        html += `</div>`;
      }
    }

    this._fieldsPanel.innerHTML = html;

    // Add event listeners
    this.addFieldsPanelEventListeners();
  }

  private addFieldsPanelEventListeners(): void {
    // Handle relationship expand/collapse for both header and pill styles
    this._fieldsPanel.querySelectorAll('.asb-relationship-header, .asb-relationship-pill').forEach(header => {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        const relationship = (e.currentTarget as HTMLElement).dataset.relationship;
        if (relationship) {
          if (this._expandedRelationships.has(relationship)) {
            this._expandedRelationships.delete(relationship);
          } else {
            this._expandedRelationships.add(relationship);
          }
          this.renderFieldsPanel(); // Re-render to show/hide fields
        }
      });
    });

    // Add drag events for draggable relationship headers (collection containers)
    this._fieldsPanel.querySelectorAll('.asb-draggable-relationship').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        const element = e.target as HTMLElement;
        this._draggedItem = {
          type: 'collection-container',
          field: element.dataset.relationship || '',
          entity: element.dataset.referencedEntity || '',
          displayName: element.dataset.displayName || '',
          referencedEntity: element.dataset.referencedEntity,
          isCollectionContainer: true,
          relationshipName: element.dataset.relationship
        };
        element.classList.add('dragging');
      });

      item.addEventListener('dragend', (e) => {
        (e.target as HTMLElement).classList.remove('dragging');
        this._draggedItem = null;
        this.hideDropIndicator();
        
        const dropZones = this._container.querySelectorAll('.drag-over');
        dropZones.forEach(zone => zone.classList.remove('drag-over'));
      });
    });

    // Add drag events for regular fields and related fields
    this._fieldsPanel.querySelectorAll('.asb-field-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        const element = e.target as HTMLElement;
        const isCollectionField = element.classList.contains('asb-collection-field');
        
        this._draggedItem = {
          type: element.dataset.type || 'field',
          field: element.dataset.field || '',
          entity: element.dataset.entity || '',
          displayName: element.querySelector('.asb-field-name')?.textContent || element.textContent || '',
          referencedEntity: element.dataset.referencedEntity,
          relationshipType: element.dataset.relationshipType as 'OneToMany' | 'ManyToOne' | 'ManyToMany',
          relationshipName: element.dataset.relationshipName, // For collection fields
          arrayOnly: false // Remove array-only restriction
        };
        element.classList.add('dragging');
      });

      item.addEventListener('dragend', (e) => {
        (e.target as HTMLElement).classList.remove('dragging');
        this._draggedItem = null;
        this.hideDropIndicator(); // Clean up any drop indicators
        
        // Remove drag-over from all drop zones
        const dropZones = this._container.querySelectorAll('.drag-over');
        dropZones.forEach(zone => zone.classList.remove('drag-over'));
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

    // If we're creating an array, automatically add an object inside it
    if (type === 'array') {
      const childObject: SchemaNode = {
        id: `node_${++this._nodeCounter}`,
        type: 'object',
        key: 'item',
        children: [],
        parent: node.id
      };
      node.children = [childObject];
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
    // Handle collection container creation
    if (draggedItem.isCollectionContainer) {
      const node: SchemaNode = {
        id: `node_${++this._nodeCounter}`,
        type: 'array',
        key: draggedItem.displayName.toLowerCase().replace(/\s+/g, ''),
        children: [],
        parent,
        isCollectionContainer: true,
        relationshipName: draggedItem.relationshipName,
        collectionDisplayName: draggedItem.displayName
      };

      // Add default object inside the collection
      const childObject: SchemaNode = {
        id: `node_${++this._nodeCounter}`,
        type: 'object',
        key: 'item',
        children: [],
        parent: node.id
      };
      node.children = [childObject];

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
      return;
    }

    // Handle collection field restriction - can only go into matching collection container
    if (draggedItem.relationshipName) {
      const parentNode = parent ? this.findNode(parent) : null;
      if (!parentNode || !this.isValidCollectionTarget(parentNode, draggedItem.relationshipName)) {
        console.log(`Collection field "${draggedItem.displayName}" can only be dropped into containers for the "${draggedItem.relationshipName}" relationship`);
        return; // Don't allow the drop
      }
    }

    this.addRegularFieldNode(draggedItem, parent);
  }

  private addRegularFieldNode(draggedItem: DraggedItem, parent?: string): void {
    console.log('addRegularFieldNode called with parent:', parent);
    
    const node: SchemaNode = {
      id: `node_${++this._nodeCounter}`,
      type: 'field',
      key: draggedItem.field,
      fieldName: draggedItem.field,
      displayName: draggedItem.displayName,
      entityName: draggedItem.entity,
      parent
    };

    console.log('Created field node:', node);

    if (parent) {
      const parentNode = this.findNode(parent);
      console.log('Found parent node:', parentNode);
      if (parentNode) {
        parentNode.children = parentNode.children || [];
        parentNode.children.push(node);
        console.log('Added field to parent children. Parent now has', parentNode.children.length, 'children');
      } else {
        console.error('Parent node not found for ID:', parent);
      }
    } else {
      this._schema.nodes.push(node);
      console.log('Added field to root schema nodes');
    }

    console.log('Current schema after adding field:', JSON.stringify(this._schema, null, 2));

    this.renderCanvas();
    this.updatePreview();
    this._notifyOutputChanged();
  }

  private isValidCollectionTarget(targetNode: SchemaNode, relationshipName: string): boolean {
    // Check if the target is a collection container for the same relationship
    if (targetNode.isCollectionContainer && targetNode.relationshipName === relationshipName) {
      return true;
    }

    // Check if the target is inside a collection container for the same relationship
    let currentNode = targetNode;
    while (currentNode.parent) {
      const parentNode = this.findNode(currentNode.parent);
      if (!parentNode) break;
      
      if (parentNode.isCollectionContainer && parentNode.relationshipName === relationshipName) {
        return true;
      }
      currentNode = parentNode;
    }

    return false;
  }

  private isInsideCollectionContainer(node: SchemaNode): boolean {
    if (!node.parent) return false;
    
    let currentNode = node;
    while (currentNode.parent) {
      const parentNode = this.findNode(currentNode.parent);
      if (!parentNode) break;
      
      if (parentNode.isCollectionContainer) {
        return true;
      }
      currentNode = parentNode;
    }
    
    return false;
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
      dropZone.innerHTML = '<p>Drag fields here or add objects to build your API response structure</p>';
      dropZone.classList.remove('has-content');
      return;
    }

    let html = '';
    this._schema.nodes.forEach(node => {
      html += this.renderNode(node);
    });
    dropZone.innerHTML = html;
    dropZone.classList.add('has-content');

    // Only add event listeners once
    if (!this._canvasEventsAttached) {
      this.addCanvasEventListeners(dropZone);
      this._canvasEventsAttached = true;
    }

    // Setup drag and drop for newly rendered nodes
    this.setupNestedDropZones(dropZone);
  }

  private renderNode(node: SchemaNode, level = 0): string {
    const indent = level * 20;
    let html = `<div class="asb-node asb-node-${node.type}" style="margin-left: ${indent}px; width: calc(100% - ${indent}px);" data-node-id="${node.id}" draggable="true">`;
    
    html += `<div class="asb-node-header">`;
    html += `<span class="asb-drag-handle" style="cursor: move; margin-right: 8px;">⋮⋮</span>`;
    
    // Show collection info if this is a collection container
    if (node.isCollectionContainer && node.collectionDisplayName) {
      html += `<span class="asb-collection-label">📂 ${node.collectionDisplayName}:</span>`;
    }
    
    // Show field name pill for fields
    if (node.type === 'field' && node.displayName) {
      html += `<span class="asb-field-pill">🏷️ ${node.displayName}</span>`;
    }
    
    html += `<input class="asb-input" value="${node.key || ''}" style="flex: 1; margin-right: 8px;" placeholder="Enter field name">`;
    html += `<span style="color: #666; margin-right: 8px;">(${node.type})</span>`;
    
    // Add buttons - completely remove array button from collection containers
    if (node.type === 'object' || node.type === 'array') {
      html += `<button class="asb-btn asb-btn-secondary asb-add-child-object" data-parent-id="${node.id}" style="margin-right: 4px;">+ Obj</button>`;
      // Only show array button if this is not a collection container AND not inside a collection container
      if (!node.isCollectionContainer && !this.isInsideCollectionContainer(node)) {
        html += `<button class="asb-btn asb-btn-secondary asb-add-child-array" data-parent-id="${node.id}" style="margin-right: 8px;">+ Arr</button>`;
      }
    }
    
    html += `<button class="asb-btn asb-btn-danger" data-node-id="${node.id}">×</button>`;
    html += `</div>`;

    // Add drop zone for objects and arrays with better sizing
    if (node.type === 'object' || node.type === 'array') {
      const hasChildren = node.children && node.children.length > 0;
      html += `<div class="asb-node-drop-zone ${hasChildren ? 'has-children' : ''}" data-parent-id="${node.id}">`;
      if (!hasChildren) {
        const dropHint = node.isCollectionContainer 
          ? `Drop fields from the "${node.collectionDisplayName}" relationship here`
          : `Drop fields here or use + buttons to add nested structures`;
        html += `<p class="asb-drop-hint">${dropHint}</p>`;
      } else {
        // Render children inside the drop zone
        html += `<div class="asb-node-children">`;
        node.children?.forEach(child => {
          html += this.renderNode(child, level + 1);
        });
        html += `</div>`;
      }
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
      const parentId = target.dataset.parentId;
      
      if (target.classList.contains('asb-btn-danger') && nodeId) {
        // Prevent rapid successive delete operations
        if (this._deleteInProgress) return;
        this._deleteInProgress = true;
        
        this.deleteNode(nodeId);
        
        // Reset delete lock after a short delay
        setTimeout(() => {
          this._deleteInProgress = false;
        }, 200);
      } else if (target.classList.contains('asb-add-child-object') && parentId) {
        this.addNode('object', parentId);
      } else if (target.classList.contains('asb-add-child-array') && parentId) {
        this.addNode('array', parentId);
      }
    });

    // Handle input changes for key renaming - only update when user clicks away
    container.addEventListener('blur', (e) => {
      const target = e.target as HTMLInputElement;
      const nodeElement = target.closest('[data-node-id]');
      const nodeId = nodeElement?.getAttribute('data-node-id');
      
      if (nodeId && target.classList.contains('asb-input')) {
        const node = this.findNode(nodeId);
        if (node) {
          node.key = target.value;
          this.updatePreview();
          this._notifyOutputChanged();
        }
      }
    }, true); // Use capture phase to ensure we catch blur events

    // Handle Enter key to trigger blur (so user can press Enter to save)
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const target = e.target as HTMLInputElement;
        if (target.classList.contains('asb-input')) {
          target.blur(); // This will trigger the blur event above
        }
      }
    });

    // Add node drag and drop functionality
    this.setupNodeDragAndDrop(container);

    // Setup drag and drop for nested drop zones
    this.setupNestedDropZones(container);
  }

  private setupNodeDragAndDrop(container: HTMLElement): void {
    // Handle dragstart for nodes
    container.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('asb-node')) {
        e.stopPropagation();
        const nodeId = target.dataset.nodeId;
        if (nodeId) {
          const parentElement = target.parentElement;
          let sourceParent: string | undefined;
          let sourceIndex = 0;
          
          if (parentElement?.classList.contains('asb-node-children')) {
            // This node is inside another node's children
            const grandParent = parentElement.closest('[data-node-id]');
            sourceParent = grandParent?.getAttribute('data-node-id') || undefined;
          }
          
          // Find the index of this node among its siblings
          const siblings = Array.from(target.parentElement?.children || [])
            .filter(child => child.classList.contains('asb-node'));
          sourceIndex = siblings.indexOf(target);
          
          this._draggedNode = {
            nodeId,
            sourceParent,
            sourceIndex
          };
          
          target.classList.add('dragging');
          e.dataTransfer?.setData('text/plain', ''); // Required for drag to work
        }
      }
    });

    // Handle dragend for nodes
    container.addEventListener('dragend', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('asb-node')) {
        target.classList.remove('dragging');
        this._draggedNode = null;
        this.hideDropIndicator(); // Clean up any drop indicators
        
        // Remove drag-over from all drop zones
        const dropZones = this._container.querySelectorAll('.drag-over');
        dropZones.forEach(zone => zone.classList.remove('drag-over'));
      }
    });

    // Handle dragover for drop zones to allow node reordering
    container.addEventListener('dragover', (e) => {
      if (this._draggedNode) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Handle drop for node reordering
    container.addEventListener('drop', (e) => {
      if (this._draggedNode) {
        e.preventDefault();
        e.stopPropagation();
        
        const dropTarget = e.target as HTMLElement;
        let targetParent: string | undefined;
        
        // Determine the target parent
        if (dropTarget.classList.contains('asb-node-drop-zone')) {
          targetParent = dropTarget.dataset.parentId;
        } else if (dropTarget.closest('.asb-node-drop-zone')) {
          const dropZone = dropTarget.closest('.asb-node-drop-zone') as HTMLElement;
          targetParent = dropZone.dataset.parentId;
        } else if (dropTarget.id === 'mainDropZone') {
          targetParent = undefined; // Root level
        }
        
        this.moveNode(this._draggedNode.nodeId, this._draggedNode.sourceParent, targetParent);
        this._draggedNode = null;
      }
    });
  }

  private moveNode(nodeId: string, sourceParent: string | undefined, targetParent: string | undefined): void {
    // Find and remove the node from its current location
    const node = this.findNode(nodeId);
    if (!node) return;
    
    this.removeNodeFromParent(nodeId, sourceParent);
    
    // Add the node to its new location
    if (targetParent) {
      const parentNode = this.findNode(targetParent);
      if (parentNode) {
        parentNode.children = parentNode.children || [];
        parentNode.children.push(node);
        node.parent = targetParent;
      }
    } else {
      this._schema.nodes.push(node);
      node.parent = undefined;
    }
    
    this.renderCanvas();
    this.updatePreview();
    this._notifyOutputChanged();
  }

  private removeNodeFromParent(nodeId: string, parentId: string | undefined): void {
    if (parentId) {
      const parentNode = this.findNode(parentId);
      if (parentNode && parentNode.children) {
        parentNode.children = parentNode.children.filter(child => child.id !== nodeId);
      }
    } else {
      this._schema.nodes = this._schema.nodes.filter(node => node.id !== nodeId);
    }
  }

  private setupNestedDropZones(container: HTMLElement): void {
    // Find all drop zones (main and nested)
    const dropZones = container.querySelectorAll('.asb-drop-zone, .asb-node-drop-zone');
    
    dropZones.forEach((dropZone) => {
      const element = dropZone as HTMLElement;
      
      element.addEventListener('dragover', (e) => {
        // Allow both field drops and node reordering
        if (this._draggedItem || this._draggedNode) {
          e.preventDefault();
          e.stopPropagation();
          
          // Add visual drop indicator
          element.classList.add('drag-over');
          this.showDropIndicator(element, e);
        }
      });

      element.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        // Only remove drag-over if we're actually leaving this element
        if (!element.contains(e.relatedTarget as Node)) {
          element.classList.remove('drag-over');
          this.hideDropIndicator();
        }
      });

      element.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        element.classList.remove('drag-over');
        this.hideDropIndicator();
        
        // Handle field drops (from the fields panel)
        if (this._draggedItem) {
          const parentId = element.dataset.parentId;
          this.addFieldNode(this._draggedItem, parentId);
          this._draggedItem = null;
        }
        // Node reordering is handled in setupNodeDragAndDrop
      });
    });
  }

  private showDropIndicator(dropZone: HTMLElement, event: DragEvent): void {
    // Remove any existing drop indicators
    this.hideDropIndicator();
    
    // Create a drop indicator line
    const indicator = document.createElement('div');
    indicator.className = 'asb-drop-indicator';
    indicator.style.cssText = `
      position: absolute;
      height: 2px;
      background: #007acc;
      border-radius: 1px;
      pointer-events: none;
      z-index: 1000;
      transition: all 0.1s ease;
    `;
    
    // Calculate position within the drop zone
    const rect = dropZone.getBoundingClientRect();
    const children = Array.from(dropZone.children).filter(child => 
      child.classList.contains('asb-node') || child.classList.contains('asb-node-children')
    );
    
    let insertIndex = children.length;
    let indicatorTop = rect.bottom - 10;
    
    // Find the insertion point based on mouse position
    for (let i = 0; i < children.length; i++) {
      const childRect = children[i].getBoundingClientRect();
      const childMiddle = childRect.top + childRect.height / 2;
      
      if (event.clientY < childMiddle) {
        insertIndex = i;
        indicatorTop = childRect.top - 1;
        break;
      }
    }
    
    // Position the indicator
    indicator.style.top = `${indicatorTop}px`;
    indicator.style.left = `${rect.left + 20}px`;
    indicator.style.width = `${rect.width - 40}px`;
    
    document.body.appendChild(indicator);
  }

  private hideDropIndicator(): void {
    const existingIndicator = document.querySelector('.asb-drop-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
  }

  private deleteNode(nodeId: string): void {
    if (!nodeId) return;
    
    try {
      const deleteFromArray = (nodes: SchemaNode[]): boolean => {
        if (!Array.isArray(nodes)) return false;
        
        const index = nodes.findIndex(n => n?.id === nodeId);
        if (index >= 0) {
          nodes.splice(index, 1);
          return true;
        }
        for (const node of nodes) {
          if (node?.children && Array.isArray(node.children) && deleteFromArray(node.children)) {
            return true;
          }
        }
        return false;
      };

      const deleted = deleteFromArray(this._schema.nodes);
      if (deleted) {
        // Use a small delay to prevent rapid successive calls from causing issues
        setTimeout(() => {
          this.renderCanvas();
          this.updatePreview();
          this._notifyOutputChanged();
        }, 10);
      }
    } catch (error) {
      console.error('Error deleting node:', error);
    }
  }

  private buildConfigFromSchema(): Record<string, unknown> {
    const selectFields: { column: string; as: string; in?: string }[] = [];
    const expandFields: {
      nav: string;
      as: string;
      cardinality: string;
      in?: string;
      select: { column: string; as: string }[]
    }[] = [];

    // Process all nodes to build select and expand arrays
    this._schema.nodes.forEach(node => {
      this.processNodeForNewFormat(node, selectFields, expandFields, '/');
    });

    // Build the searchQuery URL
    const baseUrl = `https://your-environment.crm.dynamics.com/api/data/v9.2/${this._schema.entityName}s`;
    const selectParams = selectFields.map(f => f.column).join(',');
    const expandParams = expandFields.map(exp => {
      const selectPart = exp.select.map(s => s.column).join(',');
      return `${exp.nav}($select=${selectPart})`;
    }).join(',');
    
    const searchQuery = `${baseUrl}?$select=${selectParams}${expandParams ? `&$expand=${expandParams}` : ''}`;

    return {
      entity: this._schema.entityName,
      searchQuery: searchQuery,
      schema: {
        entity: this._schema.entityName,
        select: selectFields,
        expand: expandFields
      }
    };
  }

  private convertToStorageFormat(): StorageSchema {
    const selectFields: { column: string; as: string; in?: string }[] = [];
    const expandFields: {
      nav: string;
      as: string;
      cardinality: string;
      in?: string;
      select: { column: string; as: string }[];
    }[] = [];

    // Process all nodes to build select and expand arrays
    this._schema.nodes.forEach(node => {
      this.processNodeForNewFormat(node, selectFields, expandFields, '/');
    });

    // Build the searchQuery URL
    const baseUrl = `https://your-environment.crm.dynamics.com/api/data/v9.2/${this._schema.entityName}s`;
    const selectParams = selectFields.map(f => f.column).join(',');
    const expandParams = expandFields.map(exp => {
      const selectPart = exp.select.map(s => s.column).join(',');
      return `${exp.nav}($select=${selectPart})`;
    }).join(',');
    
    const searchQuery = `${baseUrl}?$select=${selectParams}${expandParams ? `&$expand=${expandParams}` : ''}`;

    return {
      entity: this._schema.entityName,
      searchQuery: searchQuery,
      schema: {
        entity: this._schema.entityName,
        select: selectFields,
        expand: expandFields
      }
    };
  }

  private processNodeForNewFormat(
    node: SchemaNode, 
    selectFields: { column: string; as: string; in?: string }[],
    expandFields: {
      nav: string;
      as: string;
      cardinality: string;
      in?: string;
      select: { column: string; as: string }[]
    }[],
    currentPath: string
  ): void {
    if (node.type === 'field' && node.fieldName) {
      const selectItem: { column: string; as: string; in?: string } = {
        column: node.fieldName,
        as: this.camelCase(node.displayName || node.fieldName)
      };

      // Add "in" property if we're inside a nested structure
      if (currentPath !== '/') {
        selectItem.in = currentPath;
      }

      selectFields.push(selectItem);
    } else if (node.type === 'array' && node.isCollectionContainer) {
      // This is a collection container representing a relationship
      const expandItem = {
        nav: node.relationshipName || '',
        as: this.camelCase(node.collectionDisplayName || ''),
        cardinality: 'multiple',
        select: [] as { column: string; as: string }[]
      };

      // Process children of this collection
      if (node.children) {
        node.children.forEach(child => {
          this.processChildrenForExpand(child, expandItem.select);
        });
      }

      expandFields.push(expandItem);
    } else if (node.type === 'object') {
      // For objects, update the path and process children
      const newPath = currentPath === '/' ? `/${node.key || 'object'}` : `${currentPath}/${node.key || 'object'}`;
      
      if (node.children) {
        node.children.forEach(child => {
          this.processNodeForNewFormat(child, selectFields, expandFields, newPath);
        });
      }
    }

    // Process other children recursively (for arrays that are not collection containers)
    if (node.children && !node.isCollectionContainer && node.type !== 'object') {
      node.children.forEach(child => {
        this.processNodeForNewFormat(child, selectFields, expandFields, currentPath);
      });
    }
  }

  private processChildrenForExpand(
    node: SchemaNode, 
    selectArray: { column: string; as: string }[]
  ): void {
    if (node.type === 'field' && node.fieldName) {
      selectArray.push({
        column: node.fieldName,
        as: this.camelCase(node.displayName || node.fieldName)
      });
    }

    if (node.children) {
      node.children.forEach(child => {
        this.processChildrenForExpand(child, selectArray);
      });
    }
  }

  private camelCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, '')
      .replace(/[^\w]/g, '');
  }

  private convertFromStorageFormat(storageSchema: StorageSchema): APISchema {
    const schema: APISchema = {
      entityName: storageSchema.entity,
      nodes: []
    };

    // Convert select fields to nodes
    storageSchema.schema.select.forEach(selectItem => {
      if (!selectItem.in || selectItem.in === '/') {
        // Root level field
        const node: SchemaNode = {
          id: `node_${++this._nodeCounter}`,
          type: 'field',
          key: selectItem.column,
          fieldName: selectItem.column,
          displayName: this.convertFromCamelCase(selectItem.as),
          entityName: storageSchema.entity
        };
        schema.nodes.push(node);
      }
    });

    // Convert expand fields to collection containers
    storageSchema.schema.expand.forEach(expandItem => {
      const collectionNode: SchemaNode = {
        id: `node_${++this._nodeCounter}`,
        type: 'array',
        key: this.camelCase(expandItem.as),
        children: [],
        isCollectionContainer: true,
        relationshipName: expandItem.nav,
        collectionDisplayName: this.convertFromCamelCase(expandItem.as)
      };

      // Create child object
      const childObject: SchemaNode = {
        id: `node_${++this._nodeCounter}`,
        type: 'object',
        key: 'item',
        children: [],
        parent: collectionNode.id
      };

      // Add expand select fields as children
      expandItem.select.forEach(selectItem => {
        const fieldNode: SchemaNode = {
          id: `node_${++this._nodeCounter}`,
          type: 'field',
          key: selectItem.column,
          fieldName: selectItem.column,
          displayName: this.convertFromCamelCase(selectItem.as),
          entityName: storageSchema.entity,
          parent: childObject.id
        };
        childObject.children!.push(fieldNode);
      });

      collectionNode.children = [childObject];
      schema.nodes.push(collectionNode);
    });

    return schema;
  }

  private convertFromCamelCase(str: string): string {
    return str
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }

  private loadExistingSchema(): void {
    if (!this._currentValue) {
      this._schema = { entityName: '', nodes: [] };
      this.renderCanvas();
      this.updatePreview();
      return;
    }

    try {
      const parsed = JSON.parse(this._currentValue);
      
      // Check if it's the new storage format
      if (parsed.entity && parsed.schema && parsed.schema.select) {
        // New storage format
        this._schema = this.convertFromStorageFormat(parsed as StorageSchema);
      } else {
        // Old internal format
        this._schema = parsed as APISchema;
      }

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
    console.log('updatePreview called with schema:', JSON.stringify(this._schema, null, 2));
    const config = this.buildConfigFromSchema();
    console.log('Generated config:', JSON.stringify(config, null, 2));
    if (this._previewPanel) {
      // Create a formatted JSON display
      this._previewPanel.innerHTML = `<pre style="text-align: left; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; margin: 0; padding: 12px; background: #f8f9fa; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">${JSON.stringify(config, null, 2)}</pre>`;
    }
  }
}