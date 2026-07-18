import type { BlockContent, Blockquote, DefinitionContent, Paragraph, PhrasingContent, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export type AlertType = "note" | "tip" | "important" | "warning" | "caution";

export const ALERT_TAG_NAME = "mhtextalert";
export const ALERT_LABEL_TAG_NAME = "mhtextalertlabel";

const ALERT_MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;

function isParagraph(node: BlockContent | DefinitionContent | undefined): node is Paragraph {
  return !!node && node.type === "paragraph";
}

function buildLabelNode(alertType: AlertType): PhrasingContent {
  return {
    type: "mhtextAlertLabel",
    data: { hName: ALERT_LABEL_TAG_NAME, hProperties: { "data-alert-type": alertType } },
  } as unknown as PhrasingContent;
}

/**
 * Turns a GitHub-style alert blockquote (`> [!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]`
 * as the first line) into a `<mhtextalert data-alert-type="...">` hast element instead of a plain `<blockquote>`,
 * plus injects a `<mhtextalertlabel data-alert-type="...">` node as an inline sibling at the very start of the
 * body's first paragraph - both are intercepted by custom React components (AlertCallout / AlertLabel) via
 * react-markdown's `components` map. The label is spliced in at the mdast (AST) level, not by post-processing
 * react-markdown's rendered React children, specifically so it becomes a genuine inline sibling of the body
 * text and visibly starts on the same line as it - manipulating already-rendered React elements after the fact
 * (e.g. cloning/prepending into a rendered <p>'s children) turned out to be too brittle to rely on for this.
 * Hand-rolled rather than pulling a third-party alert plugin, since react-markdown 8 (the last version
 * supporting React 16, required by this repo's React 16.8.6 platform-library) pins an older unified v10
 * pipeline that not every third-party remark plugin declares compatibility with.
 */
export const remarkAlertCallouts: Plugin<[], Root> = () => (tree) => {
  visit(tree, "blockquote", (node: Blockquote) => {
    const firstParagraph = node.children[0];
    if (!isParagraph(firstParagraph)) return;

    const firstInline = firstParagraph.children[0];
    if (!firstInline || firstInline.type !== "text") return;

    const textNode = firstInline as Text;
    const match = ALERT_MARKER.exec(textNode.value);
    if (!match) return;

    const alertType = match[1].toLowerCase() as AlertType;
    const remainder = textNode.value.slice(match[0].length);
    const labelNode = buildLabelNode(alertType);

    if (remainder.length > 0) {
      // Marker and body text share one soft-wrapped line/paragraph (the common case) - strip the
      // marker text and splice the label in right before what's left of it.
      textNode.value = remainder;
      firstParagraph.children.unshift(labelNode);
    } else {
      // Marker sat alone on its own line/paragraph (e.g. a blank line before the body) - drop that
      // now-empty paragraph and attach the label to whatever comes next instead of leaving it
      // orphaned: the next paragraph if there is one, otherwise a new paragraph holding just the
      // label (e.g. when the body's first block is a list, which a label can't be spliced into).
      node.children.shift();
      const nextBlock = node.children[0];
      if (isParagraph(nextBlock)) {
        nextBlock.children.unshift(labelNode);
      } else {
        node.children.unshift({ type: "paragraph", children: [labelNode] });
      }
    }

    node.data = {
      ...node.data,
      hName: ALERT_TAG_NAME,
      hProperties: { "data-alert-type": alertType },
    };
  });
};
