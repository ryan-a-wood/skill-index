import { parse as parseYaml } from "yaml";

export interface ParseResult {
  data: Record<string, unknown>;
  body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

export function parseFrontmatter(source: string): ParseResult {
  const match = FRONTMATTER.exec(source);
  if (!match) {
    return { data: {}, body: source };
  }

  const parsed = parseYaml(match[1]);
  const data =
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  let body = source.slice(match[0].length);
  if (body.startsWith("\r\n")) {
    body = body.slice(2);
  } else if (body.startsWith("\n")) {
    body = body.slice(1);
  }

  return { data, body };
}
