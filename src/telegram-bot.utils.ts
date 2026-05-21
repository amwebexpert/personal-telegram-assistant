import { Token, Tokens, marked } from "marked";
import { promises as fs } from "node:fs";
import path from "node:path";

const escapeHtmlAttr = (url: string): string =>
  url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const renderTokens = (tokens: Token[]): string =>
  tokens.map(renderToken).join("");

const EMPTY_HEADER_CELL: Tokens.TableCell = {
  text: "",
  tokens: [],
  header: true,
  align: null,
};

const EMPTY_BODY_CELL: Tokens.TableCell = {
  text: "",
  tokens: [],
  header: false,
  align: null,
};

const getCellText = (cell: Tokens.TableCell): string => escapeHtml(cell.text);

interface PadCellArgs {
  text: string;
  width: number;
  align: Tokens.TableCell["align"];
}

const padCell = ({ text, width, align }: PadCellArgs): string => {
  if (align === "right") return text.padStart(width);
  if (align === "center") {
    const total = width - text.length;
    return (
      " ".repeat(Math.floor(total / 2)) +
      text +
      " ".repeat(Math.ceil(total / 2))
    );
  }
  return text.padEnd(width);
};

interface BuildSepCellArgs {
  width: number;
  align: Tokens.TableCell["align"];
}

const buildSepCell = ({ width, align }: BuildSepCellArgs): string => {
  if (align === "center") return ":" + "-".repeat(Math.max(1, width - 2)) + ":";
  if (align === "right") return "-".repeat(Math.max(1, width - 1)) + ":";
  return "-".repeat(width);
};

interface FmtTableRowArgs {
  cells: Tokens.TableCell[];
  colWidths: number[];
  aligns: Tokens.TableCell["align"][];
}

const fmtTableRow = ({ cells, colWidths, aligns }: FmtTableRowArgs): string => {
  const paddedCells = colWidths.map((width, i) =>
    padCell({
      text: getCellText(cells[i] ?? EMPTY_BODY_CELL),
      width,
      align: aligns[i],
    }),
  );
  const rowInner = paddedCells.join(" | ");
  return `| ${rowInner} |`;
};

interface BuildSepRowArgs {
  colWidths: number[];
  aligns: Tokens.TableCell["align"][];
}

const buildSepRow = ({ colWidths, aligns }: BuildSepRowArgs): string => {
  const sepCells = colWidths.map((width, i) =>
    buildSepCell({ width, align: aligns[i] }),
  );
  const rowInner = sepCells.join(" | ");
  return `| ${rowInner} |`;
};

const renderTable = (token: Tokens.Table): string => {
  const colCount = token.header.length;

  const colWidths = Array.from({ length: colCount }, (_, i) =>
    Math.max(
      3,
      getCellText(token.header[i] ?? EMPTY_HEADER_CELL).length,
      ...token.rows.map((row) => getCellText(row[i] ?? EMPTY_BODY_CELL).length),
    ),
  );

  const aligns = token.align;
  const headerRow = fmtTableRow({ cells: token.header, colWidths, aligns });
  const sepRow = buildSepRow({ colWidths, aligns });
  const bodyRows = token.rows.map((cells) =>
    fmtTableRow({ cells, colWidths, aligns }),
  );

  return `<pre>${[headerRow, sepRow, ...bodyRows].join("\n")}</pre>\n\n`;
};

const renderToken = (token: Token): string => {
  switch (token.type) {
    case "space":
      return "\n";
    case "hr":
      return "────────────\n\n";
    case "heading":
      return `<b>${renderTokens(token.tokens ?? [])}</b>\n\n`;
    case "code": {
      const lang = token.lang as string;
      const langAttr = lang ? ` class="language-${escapeHtmlAttr(lang)}"` : "";
      return `<pre><code${langAttr}>${escapeHtml(token.text as string)}</code></pre>\n\n`;
    }
    case "blockquote":
      return `<blockquote>${renderTokens(token.tokens ?? []).trim()}</blockquote>\n\n`;
    case "list": {
      const items = token.items as Tokens.ListItem[];
      return (
        items
          .map((item) => `• ${renderTokens(item.tokens ?? []).trim()}\n`)
          .join("") + "\n"
      );
    }
    case "paragraph":
      return `${renderTokens(token.tokens ?? [])}\n\n`;
    case "table":
      return renderTable(token as Tokens.Table);
    case "html":
    case "tag":
      return "";
    case "text": {
      const tokens = token.tokens as Token[];
      return tokens
        ? renderTokens(token.tokens ?? [])
        : escapeHtml(token.text as string);
    }
    case "escape": {
      const text = token.text as string;
      return escapeHtml(text);
    }
    case "strong":
      return `<b>${renderTokens(token.tokens ?? [])}</b>`;
    case "em":
      return `<i>${renderTokens(token.tokens ?? [])}</i>`;
    case "del":
      return `<s>${renderTokens(token.tokens ?? [])}</s>`;
    case "codespan":
      return `<code>${escapeHtml(token.text as string)}</code>`;
    case "link": {
      const tokens = token.tokens as Token[];
      return tokens
        ? `<a href="${escapeHtmlAttr(token.href as string)}">${renderTokens(tokens)}</a>`
        : escapeHtml(token.text as string);
    }
    case "image": {
      const title = token.title as string;
      const text = token.text as string;
      return escapeHtml(title ?? text);
    }
    case "br":
      return "\n";
    default:
      return "";
  }
};

export const loadSessionId = async (
  fullPath: string,
): Promise<string | undefined> => {
  try {
    const raw: unknown = JSON.parse(await fs.readFile(fullPath, "utf-8"));
    if (raw && typeof raw === "object" && "sessionId" in raw) {
      const sid = Reflect.get(raw, "sessionId");
      if (typeof sid === "string") return sid;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

interface SaveSessionIdArgs {
  fullPath: string;
  sessionId: string;
}

export const saveSessionId = async ({
  fullPath,
  sessionId,
}: SaveSessionIdArgs): Promise<void> => {
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, JSON.stringify({ sessionId }));
};

export const clearSession = async (fullPath: string): Promise<void> => {
  await fs.rm(fullPath, { force: true });
};

const MAX_TEXT_LEN = 120;

export const truncLongText = (text: string): string =>
  text.length > MAX_TEXT_LEN ? `${text.slice(0, MAX_TEXT_LEN)}…` : text;

export const toTelegramHtml = (markdown: string): string => {
  const rendered = renderTokens(marked.lexer(markdown));
  const normalized = rendered.replace(/\n{3,}/g, "\n\n");
  return normalized.trim();
};
