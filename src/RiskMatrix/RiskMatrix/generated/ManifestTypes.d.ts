/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    Impact: ComponentFramework.PropertyTypes.WholeNumberProperty;
    Probability: ComponentFramework.PropertyTypes.WholeNumberProperty;
    LowColor: ComponentFramework.PropertyTypes.StringProperty;
    MediumColor: ComponentFramework.PropertyTypes.StringProperty;
    HighColor: ComponentFramework.PropertyTypes.StringProperty;
    CriticalColor: ComponentFramework.PropertyTypes.StringProperty;
}
export interface IOutputs {
    Impact?: number;
    Probability?: number;
}
