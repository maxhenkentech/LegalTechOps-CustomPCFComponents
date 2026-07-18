import * as React from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { AlertCallout } from "./AlertCallout";
import { AlertLabel } from "./AlertLabel";
import { ALERT_LABEL_TAG_NAME, ALERT_TAG_NAME, remarkAlertCallouts } from "./remarkAlertCallouts";
import { IFieldTagResolution, resolveFieldTags, resolveFieldTagsTestMode } from "./dynamicFieldTags";
import { remarkFieldTags } from "./remarkFieldTags";
import { rehypeSanitizeColorStyle } from "./rehypeSanitizeColorStyle";
import { TEST_MODE_FIELD_VALUES, TEST_MODE_LOOKUP_TARGETS } from "./TestModeData";

// Extends hast-util-sanitize's default (GitHub-derived) schema with just enough to let inline
// `<span style="color:...">`/`<span style="background-color:...">` HTML - the same syntax GitHub,
// Obsidian, and most other Markdown editors use for font coloring - survive rehypeSanitize, since
// "style" isn't in the default schema's attribute allowlist for any tag. rehypeSanitizeColorStyle
// (run immediately after, in the pipeline below) then narrows that surviving "style" value down to
// just color/background-color with a safe value - this schema only controls which *attribute*
// passes through, not what's inside it.
//
// Also allowlists this control's own custom hast tags (ALERT_TAG_NAME/ALERT_LABEL_TAG_NAME, plus
// their "data-alert-type" attribute) produced by remarkAlertCallouts.ts - the default schema has
// no idea these exist, so without this rehypeSanitize would unwrap them (dropping the element but
// keeping its children), silently stripping the alert callout's colored box/icon down to plain
// paragraph text while leaving the body content behind - exactly the regression Font Coloring's
// sanitizer introduced for alert callouts until this was added.
const colorSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ALERT_TAG_NAME, ALERT_LABEL_TAG_NAME],
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), "style"],
    [ALERT_TAG_NAME]: ["data-alert-type"],
    [ALERT_LABEL_TAG_NAME]: ["data-alert-type"],
  },
};

export interface IMarkdownHelpTextControlProps {
  markdown: string;
  navigation: ComponentFramework.Navigation;
  isTestMode: boolean;
  calloutTextLayout?: string;
  lineSpacing?: number;
  webAPI: ComponentFramework.WebApi;
  entityLogicalName?: string;
  entityId?: string;
}

export const MarkdownHelpTextControl = (props: IMarkdownHelpTextControlProps): React.ReactElement => {
  const { markdown, navigation, calloutTextLayout, lineSpacing, webAPI, entityLogicalName, entityId, isTestMode } = props;
  const rootStyle: React.CSSProperties = { lineHeight: lineSpacing ?? 1.55 };
  const rootClassName = calloutTextLayout === "NewLine" ? "mhtext-root mhtext-callout-stacked" : "mhtext-root";

  // Resolved once up front (async for the live path, synchronous for test mode) rather than
  // inside a remark plugin, since remark plugins are synchronous tree transformers - see
  // remarkFieldTags.ts. Until resolution completes, tags render as their own raw {!...} text
  // (remarkFieldTags falls back to the raw match when a tag isn't in the map yet).
  const [fieldTagResolutions, setFieldTagResolutions] = React.useState<Map<string, IFieldTagResolution>>(new Map());

  React.useEffect(() => {
    let cancelled = false;

    if (isTestMode) {
      setFieldTagResolutions(resolveFieldTagsTestMode(markdown, TEST_MODE_FIELD_VALUES, TEST_MODE_LOOKUP_TARGETS));
      return;
    }

    if (!entityLogicalName || !entityId) {
      setFieldTagResolutions(new Map());
      return;
    }

    resolveFieldTags(webAPI, entityLogicalName, entityId, markdown)
      .then((resolved) => {
        if (!cancelled) setFieldTagResolutions(resolved);
        return undefined;
      })
      .catch((err: unknown) => {
        console.warn("MarkdownHelpText: dynamic field tag resolution failed", err);
      });

    return () => {
      cancelled = true;
    };
  }, [markdown, isTestMode, entityLogicalName, entityId, webAPI]);

  const remarkPlugins = React.useMemo(() => [remarkGfm, remarkAlertCallouts, remarkFieldTags(fieldTagResolutions)], [fieldTagResolutions]);

  const components: Components = React.useMemo(
    () => ({
      a: ({ href, children, ...rest }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            if (!href) return;
            event.preventDefault();
            navigation.openUrl(href);
          }}
          {...rest}
        >
          {children}
        </a>
      ),
      table: ({ children, ...rest }) => (
        <div className="mhtext-table-wrap">
          <table {...rest}>{children}</table>
        </div>
      ),
      [ALERT_TAG_NAME]: AlertCallout,
      [ALERT_LABEL_TAG_NAME]: AlertLabel,
    }),
    [navigation]
  ) as Components;

  if (!markdown.trim()) {
    return (
      <div className="mhtext-root mhtext-empty" style={rootStyle}>
        <span>No help text configured.</span>
      </div>
    );
  }

  return (
    <div className={rootClassName} style={rootStyle}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, colorSanitizeSchema], rehypeSanitizeColorStyle, rehypeHighlight]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};
