import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

// hast-util-sanitize's schema (see MarkdownHelpTextControl.tsx's colorSanitizeSchema) allows the
// "style" attribute to survive on <span> at all, but has no concept of validating individual CSS
// declarations inside it - an allowed attribute passes through with whatever value it had. This
// plugin runs immediately after rehypeSanitize and closes that gap: it keeps only `color`/
// `background-color` declarations with a plain hex/rgb/hsl/named-color value, dropping everything
// else (url(), expression(), var(), calc(), or anything with a stray ';'/'(' outside those forms -
// exactly the shapes historically used to smuggle script execution or exfiltration through a
// "harmless" style attribute) and removing the attribute entirely if nothing safe remains.
const ALLOWED_PROPERTIES = new Set(["color", "background-color"]);
const SAFE_COLOR_VALUE = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.%,\s]+\)|hsla?\(\s*[\d.%,\s]+\)|[a-zA-Z]+)$/;

function sanitizeStyleValue(style: string): string | undefined {
  const kept: string[] = [];
  for (const declaration of style.split(";")) {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex === -1) continue;
    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration.slice(separatorIndex + 1).trim();
    if (!property || !value || !ALLOWED_PROPERTIES.has(property) || !SAFE_COLOR_VALUE.test(value)) continue;
    kept.push(`${property}: ${value}`);
  }
  return kept.length > 0 ? kept.join("; ") : undefined;
}

export const rehypeSanitizeColorStyle: Plugin<[], Root> = () => (tree) => {
  visit(tree, "element", (node: Element) => {
    const properties = node.properties;
    const style = properties?.style;
    if (!properties || typeof style !== "string") return;

    const sanitized = sanitizeStyleValue(style);
    if (sanitized) {
      properties.style = sanitized;
    } else {
      delete properties.style;
    }
  });
};
