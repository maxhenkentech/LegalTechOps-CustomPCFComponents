import * as React from "react";
import { Icon } from "@fluentui/react/lib/Icon";
import { AlertType } from "./remarkAlertCallouts";

interface IAlertMeta {
  label: string;
  iconName: string;
  flipIcon?: boolean;
}

const ALERT_META: Record<AlertType, IAlertMeta> = {
  note: { label: "Note", iconName: "Info" },
  tip: { label: "Tip", iconName: "Lightbulb" },
  // Same glyph as Note ("i" in a circle), flipped vertically so the dot lands on the bottom -
  // reads as an exclamation point in a circle without needing a visually different icon family.
  important: { label: "Important", iconName: "Info", flipIcon: true },
  warning: { label: "Warning", iconName: "Warning" },
  caution: { label: "Caution", iconName: "ErrorBadge" },
};

interface IAlertLabelProps {
  "data-alert-type"?: string;
}

/**
 * The icon + "Note"/"Tip"/etc. badge inside an alert callout - rendered as an inline element
 * spliced directly into the body's first paragraph by remarkAlertCallouts (at the mdast/AST
 * level, not by post-processing rendered React children), so it sits inline with the start of
 * the body text rather than on its own line above it.
 */
export const AlertLabel = (props: IAlertLabelProps): React.ReactElement => {
  const meta = ALERT_META[props["data-alert-type"] as AlertType] ?? ALERT_META.note;

  return (
    <span className="mhtext-alert-label">
      <Icon
        iconName={meta.iconName}
        className={meta.flipIcon ? "mhtext-alert-icon mhtext-alert-icon-flip" : "mhtext-alert-icon"}
      />
      {meta.label}
    </span>
  );
};
