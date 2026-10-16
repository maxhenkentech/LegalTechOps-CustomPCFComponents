import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

// hast-util-sanitize's schema (see MarkdownHelpTextControl.tsx's styleSanitizeSchema) allows the
// "style" attribute to survive on <span>, <div> and <p> at all, but has no concept of validating
// individual CSS declarations inside it - an allowed attribute passes through with whatever value
// it had. This plugin runs immediately after rehypeSanitize and closes that gap: it keeps only
// the declarations below with a plain, fully-matched value, dropping everything else (url(),
// expression(), var(), calc(), or anything with a stray ';'/'(' outside those forms - exactly the
// shapes historically used to smuggle script execution or exfiltration through a "harmless" style
// attribute) and removing the attribute entirely if nothing safe remains.
//
//   color, background-color  a hex / rgb() / rgba() / hsl() / hsla() / named color (Font Coloring)
//   background               the same single color only, rewritten to background-color - the
//                            shorthand's images, positions etc. are never accepted
//   font-size                a keyword, or a number in em/rem/%/px/pt clamped to FONT_SIZE_LIMITS
//                            (user, 2026-10-16: "add support for font size and background")
const SAFE_COLOR_VALUE = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.%,\s]+\)|hsla?\(\s*[\d.%,\s]+\)|[a-zA-Z]+)$/;

const FONT_SIZE_KEYWORDS = new Set([
  "xx-small", "x-small", "small", "medium", "large", "x-large", "xx-large", "xxx-large", "smaller", "larger"
]);
const FONT_SIZE_VALUE = /^(\d+(?:\.\d+)?|\.\d+)(em|rem|%|px|pt)$/;
// Help text must not swamp (or vanish from) the form: anything outside these is clamped to the
// nearest limit, not dropped, so a maker who typed 100px still gets "big" rather than nothing.
// em/rem/% follow the form's own text size (see the em-based CSS); px/pt are absolute. The upper
// limit is 3x a 16px form text (48px): a first cut at 4x (64px) was measured in the harness and
// dwarfed everything else on the form.
const FONT_SIZE_LIMITS: Record<string, [number, number]> = {
  em: [0.5, 3],
  rem: [0.5, 3],
  "%": [50, 300],
  px: [8, 48],
  pt: [6, 36]
};

function sanitizeFontSize(value: string): string | undefined {
  const lower = value.toLowerCase();
  if (FONT_SIZE_KEYWORDS.has(lower)) return lower;
  const match = FONT_SIZE_VALUE.exec(lower);
  if (!match) return undefined;
  const [min, max] = FONT_SIZE_LIMITS[match[2]];
  const size = Math.min(max, Math.max(min, parseFloat(match[1])));
  return `${size}${match[2]}`;
}

function sanitizeDeclaration(property: string, value: string): string | undefined {
  switch (property) {
    case "color":
    case "background-color":
      return SAFE_COLOR_VALUE.test(value) ? `${property}: ${value}` : undefined;
    case "background":
      return SAFE_COLOR_VALUE.test(value) ? `background-color: ${value}` : undefined;
    case "font-size": {
      const size = sanitizeFontSize(value);
      return size ? `font-size: ${size}` : undefined;
    }
    default:
      return undefined;
  }
}

export function sanitizeStyleValue(style: string): string | undefined {
  const kept: string[] = [];
  for (const declaration of style.split(";")) {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex === -1) continue;
    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration.slice(separatorIndex + 1).trim();
    if (!property || !value) continue;
    const safe = sanitizeDeclaration(property, value);
    if (safe) kept.push(safe);
  }
  return kept.length > 0 ? kept.join("; ") : undefined;
}

export const rehypeSanitizeStyle: Plugin<[], Root> = () => (tree) => {
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
