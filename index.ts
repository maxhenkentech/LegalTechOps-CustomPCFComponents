import {IInputs, IOutputs} from "./generated/ManifestTypes";

export class RiskMatrix implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;

    constructor() {
    }

    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container:HTMLDivElement): void {
        this._context = context;
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;
        
        this.renderRiskMatrix();
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        this.renderRiskMatrix();
    }

    private renderRiskMatrix(): void {
        this._container.innerHTML = `
            <div class="risk-matrix-container">
                <h3>Risk Matrix</h3>
                <div class="risk-grid">
                    <div class="risk-cell low">Low</div>
                    <div class="risk-cell medium">Medium</div>
                    <div class="risk-cell high">High</div>
                </div>
            </div>
        `;
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        // cleanup if needed
    }
}
