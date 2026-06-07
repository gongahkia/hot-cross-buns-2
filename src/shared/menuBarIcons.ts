const allowedSvgTags = new Set(["svg", "g", "path", "rect", "circle", "line", "polyline", "polygon", "ellipse"]);
const blockedSvgPattern =
  /<(script|foreignObject|iframe|object|embed|style|image|use)\b|(?:\s|<)on[a-z]+\s*=|\sstyle\s*=|\b(?:href|xlink:href)\s*=|url\s*\(/i;
const svgTagPattern = /<\/?([a-zA-Z][\w:-]*)(?:\s[^>]*)?>/g;

export function sanitizeMenuBarIconSvg(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("<svg") || !trimmed.endsWith("</svg>") || blockedSvgPattern.test(trimmed)) {
    return null;
  }

  const tags = [...trimmed.matchAll(svgTagPattern)];
  if (!tags.length || tags.some((tag) => !allowedSvgTags.has(tag[1].toLowerCase()))) {
    return null;
  }

  const inner = trimmed
    .replace(/^<svg\b[^>]*>/i, "")
    .replace(/<\/svg>$/i, "")
    .replace(/\sclass="[^"]*"/gi, "")
    .trim();

  return inner.length > 0 ? inner : null;
}
