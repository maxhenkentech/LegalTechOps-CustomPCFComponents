import * as React from "react";
import { AlertType } from "./remarkAlertCallouts";

const ALERT_CLASS_NAME: Record<AlertType, string> = {
  note: "mhtext-alert-note",
  tip: "mhtext-alert-tip",
  important: "mhtext-alert-important",
  warning: "mhtext-alert-warning",
  caution: "mhtext-alert-caution",
};

interface IAlertCalloutProps {
  "data-alert-type"?: string;
  children?: React.ReactNode;
}

export const AlertCallout = (props: IAlertCalloutProps): React.ReactElement => {
  const className = ALERT_CLASS_NAME[props["data-alert-type"] as AlertType] ?? ALERT_CLASS_NAME.note;

  return (
    <div className={`mhtext-alert ${className}`}>
      <div className="mhtext-alert-body">{props.children}</div>
    </div>
  );
};
