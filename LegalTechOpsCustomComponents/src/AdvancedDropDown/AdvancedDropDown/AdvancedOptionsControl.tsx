/** @jsx React.createElement */
import * as React from 'react';

import {Dropdown, IDropdownOption} from "@fluentui/react/lib/Dropdown"
import {initializeIcons} from "@fluentui/react/lib/Icons"
import { Icon} from "@fluentui/react/lib/Icon";
import {ISelectableOption} from "@fluentui/react/lib/SelectableOption";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";
import {dropdownStyles, myTheme} from "./DropdownStyles";

export interface ISetupSchemaValue{
  icon ?: string;
  color ?: string;
} 
export type ISetupSchema = Record<string, ISetupSchemaValue>;

export interface IConfig{
  jsonConfig: ISetupSchema | undefined;
  defaultIconName : string;
  sortBy: "Text" | "Value";
  hideHiddenOptions: boolean;
  showColorIcon: boolean;
  showColorBorder: boolean;
  showColorBackground: "No" | "Lighter" | "Full";
  makeFontBold: boolean;
}

/*
  //IComboBoxOption[]
  export interface IColorIndexer {
      [index : number] : string;      
  }*/

initializeIcons();

// Helper function to lighten a hex color
const lightenColor = (color: string, amount = 0.7): string => {
  if (!color || !color.startsWith('#')) return color;
  
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Lighten by blending with white
  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);
  
  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};


interface IAdvancedOptionsProperties {
    rawOptions: ComponentFramework.PropertyHelper.OptionMetadata[];
    selectedKey: number | null;          
    onChange: (value: number|null) => void
    isDisabled : boolean;
    defaultValue : number | undefined;
    config: IConfig;
    selectedColor?: string;
}  







//export default class AdvancedOptionsControl extends React.Component<IAdvancedOptionsProperties, {}> {            
//export const AdvancedOptionsControl = ({rawOptions, selectedKey, onChange, isDisabled, defaultValue, config}:IAdvancedOptionsProperties): JSX.Element =>{    
export const AdvancedOptionsControl = React.memo(({rawOptions, selectedKey, onChange, isDisabled, defaultValue, config, selectedColor}:IAdvancedOptionsProperties): React.ReactElement =>{    
  console.log("%cEntered control", "color:red");
  
  // Detect if we're in test mode
  const isTestMode = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location?.hostname || '';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost');
    const isTestHarness = window.location?.port === '8181' || 
                         window.location?.href?.includes('_pkg/') || 
                         document.title?.includes('Test harness');
    return isLocalhost || isTestHarness;
  }, []);
  
  const allOptions = [{Label: "--Select--", Value: -1, Color: "transparent", Description: "Select an option"}, ...rawOptions];	
  let options = allOptions.map((option : ComponentFramework.PropertyHelper.OptionMetadata ) =>  ({
    key: option.Value, 
    text: option.Label, 
    data: {
      color: option.Color,
      description: (option as ComponentFramework.PropertyHelper.OptionMetadata & {Description?: string}).Description || ""
    }
  }))
  if(config.sortBy==="Text"){  
    options = options.sort((a, b) =>a.text.localeCompare(b.text));
  }			

  const _onSelectedChanged = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {       
    const val = (option?.key == null || option?.key===-1) ? null : option?.key as number;   
    onChange(val);           
  }

  const _renderOption =(option: ISelectableOption | undefined, className ?:string) : React.ReactElement => {
    const icon = ((config.jsonConfig && option?.key) ? config.jsonConfig[option?.key]?.icon : config.defaultIconName)  ?? config.defaultIconName;
    const defaultColor = option?.data?.color || "#ffffff";
    const color = ((config.jsonConfig && option?.key) ? config.jsonConfig[option?.key]?.color : defaultColor)  ?? defaultColor;
    const description = option?.data?.description || "";
    
    // If showColorBackground is not 'No', use text color for icon instead of option color
    const iconColor = config.showColorBackground !== "No" ? "#323130" : color;
    
    const content = (
      <div className={`${className} option-content`}>
          {config.showColorIcon && (
            isTestMode ? 
              // Fallback: CSS-based color indicator for test mode
              <span 
                className="color-indicator"
                data-color={iconColor}
                ref={(el) => el && (el.style.backgroundColor = iconColor)}
              /> :
              // Normal: Fluent UI Icon
              <Icon className="colorIcon" style={{color: iconColor, marginRight: "8px"}} iconName={icon} aria-hidden="true" />
          )}
        <span>{option?.text || ""}</span>
      </div>
    );

    // Only wrap with tooltip if there's a description
    if (description && description.trim() !== "") {
      return (
        <TooltipHost content={description}>
          {content}
        </TooltipHost>
      );
    }
    
    return content;
  }

  const _onRenderOption = (option: ISelectableOption | undefined): React.ReactElement => {
  return _renderOption(option, "lops_AdvancedOptions_item")
  };

const _onRenderTitle = (options: IDropdownOption[] | undefined): React.ReactElement => {
    const option = (options || [])[0];
    return _renderOption(option, "option");
        
  };
     
    return (
        <Dropdown        
            placeHolder="---"
            options={options}
            defaultValue={defaultValue || -1}
            selectedKey={selectedKey}  
            onRenderTitle = {_onRenderTitle}            
            onRenderOption = {_onRenderOption}            
            onChange={_onSelectedChanged}                         
            disabled={isDisabled} 
            className="ComboBox"                        
             styles = {(props) => dropdownStyles(props, config.showColorBorder ? selectedColor : undefined, config.showColorBackground, config.showColorBorder, config.makeFontBold)}
            theme = {myTheme}           
        />
    );

});
/*, (prev, next)=> {  
  return prev.rawOptions === next.rawOptions
        && prev.selectedKey === next.selectedKey 
        && prev.isDisabled===next.isDisabled 
        && prev.defaultValue===next.defaultValue 
        && prev.config===next.config;  
})   */
   




