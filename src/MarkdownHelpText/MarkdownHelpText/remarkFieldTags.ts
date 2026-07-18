import type { Parent, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { FIELD_TAG_PATTERN, IFieldTagResolution } from "./dynamicFieldTags";

/**
 * Splices already-resolved {!field}/{!lookupField:targetField} tag values into the Markdown AST.
 * Deliberately a synchronous, already-resolved-map-in/text-out transform - the async Web API
 * fetches happen once up front (see dynamicFieldTags.resolveFieldTags) before this plugin runs,
 * since remark plugins are synchronous tree transformers.
 *
 * Only visits "text" mdast nodes, which is what keeps this from touching a tag written inside
 * inline code or a fenced code block (e.g. documentation *about* this feature demonstrating its
 * own syntax) - those become "inlineCode"/"code" nodes instead of "text" nodes, so they're never
 * visited here and render as literal, unsubstituted text.
 *
 * Substituting by splicing plain "text" mdast nodes (rather than re-parsing the resolved value as
 * Markdown, or string-replacing in the raw source before parsing) means a resolved value that
 * happens to contain Markdown-special characters (an apostrophe, asterisk, etc. in a record's
 * text field) can't accidentally alter the surrounding formatting - it renders as inert text.
 */
export const remarkFieldTags = (resolutions: Map<string, IFieldTagResolution>): Plugin<[], Root> => () => (tree) => {
  visit(tree, "text", (node: Text, index, parentNode: Parent | undefined) => {
    if (!parentNode || index === undefined || !node.value.includes("{!")) return undefined;

    const pattern = new RegExp(FIELD_TAG_PATTERN.source, "g");
    const replacementNodes: Text[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let matched = false;

    while ((match = pattern.exec(node.value))) {
      matched = true;
      if (match.index > lastIndex) {
        replacementNodes.push({ type: "text", value: node.value.slice(lastIndex, match.index) });
      }
      const resolution = resolutions.get(match[0]);
      replacementNodes.push({ type: "text", value: resolution?.text ?? match[0] });
      lastIndex = match.index + match[0].length;
    }

    if (!matched) return undefined;

    if (lastIndex < node.value.length) {
      replacementNodes.push({ type: "text", value: node.value.slice(lastIndex) });
    }

    parentNode.children.splice(index, 1, ...replacementNodes);
    return index + replacementNodes.length;
  });
};
