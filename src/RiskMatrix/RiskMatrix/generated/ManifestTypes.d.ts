/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    Impact: ComponentFramework.PropertyTypes.WholeNumberProperty;
    Probability: ComponentFramework.PropertyTypes.WholeNumberProperty;
    Size: ComponentFramework.PropertyTypes.EnumProperty<"0" | "1" | "2">;
    ShowCategoryLabels: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    ShowAxisLabels: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    GridSize: ComponentFramework.PropertyTypes.EnumProperty<"2" | "3" | "4">;
    ImpactLabel: ComponentFramework.PropertyTypes.StringProperty;
    ProbabilityLabel: ComponentFramework.PropertyTypes.StringProperty;
    ShowRiskLabel: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    LowColor: ComponentFramework.PropertyTypes.StringProperty;
    MediumColor: ComponentFramework.PropertyTypes.StringProperty;
    HighColor: ComponentFramework.PropertyTypes.StringProperty;
    CriticalColor: ComponentFramework.PropertyTypes.StringProperty;
}
export interface IOutputs {
    Impact?: number;
    Probability?: number;
}
