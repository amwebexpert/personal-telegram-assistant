import { Tokens } from "marked";
import sharp from "sharp";

const FONT_SIZE = 14;
const CHAR_WIDTH = 8.4;
const CELL_PAD_X = 16;
const CELL_PAD_Y = 10;
const ROW_HEIGHT = FONT_SIZE + CELL_PAD_Y * 2;
const OUTER_PAD = 16;
const BG_COLOR = "#1e1e1e";
const HEADER_BG = "#2d2d2d";
const ALT_ROW_BG = "#252525";
const TEXT_COLOR = "#e8e8e8";
const HEADER_TEXT_COLOR = "#ffffff";
const BORDER_COLOR = "#3d3d3d";

const escSvg = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const calcColWidths = (table: Tokens.Table): number[] =>
  table.header.map((h, i) => {
    const maxLen = Math.max(
      h.text.length,
      ...table.rows.map((row) => (row[i]?.text ?? "").length),
    );
    return Math.ceil(maxLen * CHAR_WIDTH) + CELL_PAD_X * 2;
  });

const calcXPositions = (colWidths: number[]): number[] => {
  const positions: number[] = [];
  let sum = OUTER_PAD;
  for (const w of colWidths) {
    positions.push(sum);
    sum += w;
  }
  return positions;
};

interface TableSectionArgs {
  table: Tokens.Table;
  colWidths: number[];
}

const buildHeaderParts = ({ table, colWidths }: TableSectionArgs): string[] => {
  const innerWidth = colWidths.reduce((a, b) => a + b, 0);
  const xPositions = calcXPositions(colWidths);

  const headerBg = `  <rect x="${OUTER_PAD}" y="${OUTER_PAD}" width="${innerWidth}" height="${ROW_HEIGHT}" fill="${HEADER_BG}"/>`;
  const headerTexts = table.header.map((h, i) => {
    const textX = xPositions[i] + CELL_PAD_X;
    const textY = OUTER_PAD + CELL_PAD_Y + FONT_SIZE;
    return `  <text x="${textX}" y="${textY}" font-family="monospace" font-size="${FONT_SIZE}" font-weight="bold" fill="${HEADER_TEXT_COLOR}">${escSvg(h.text)}</text>`;
  });

  return [headerBg, ...headerTexts];
};

const buildBodyParts = ({ table, colWidths }: TableSectionArgs): string[] => {
  const innerWidth = colWidths.reduce((a, b) => a + b, 0);
  const xPositions = calcXPositions(colWidths);

  return table.rows.flatMap((row, ri) => {
    const rowY = OUTER_PAD + ROW_HEIGHT * (ri + 1);
    const altBg =
      ri % 2 === 0
        ? [
            `  <rect x="${OUTER_PAD}" y="${rowY}" width="${innerWidth}" height="${ROW_HEIGHT}" fill="${ALT_ROW_BG}"/>`,
          ]
        : [];
    const cellTexts = row.map((cell, ci) => {
      const textX = xPositions[ci] + CELL_PAD_X;
      const textY = rowY + CELL_PAD_Y + FONT_SIZE;
      return `  <text x="${textX}" y="${textY}" font-family="monospace" font-size="${FONT_SIZE}" fill="${TEXT_COLOR}">${escSvg(cell.text)}</text>`;
    });
    const separator = `  <line x1="${OUTER_PAD}" y1="${rowY + ROW_HEIGHT}" x2="${OUTER_PAD + innerWidth}" y2="${rowY + ROW_HEIGHT}" stroke="${BORDER_COLOR}" stroke-width="1"/>`;
    return [...altBg, ...cellTexts, separator];
  });
};

interface BuildGridPartsArgs {
  headerLength: number;
  colWidths: number[];
  innerWidth: number;
  totalHeight: number;
}

const buildGridParts = ({
  headerLength,
  colWidths,
  innerWidth,
  totalHeight,
}: BuildGridPartsArgs): string[] => {
  const xPositions = calcXPositions(colWidths);
  const colSeps = xPositions
    .slice(1, headerLength)
    .map(
      (cx) =>
        `  <line x1="${cx}" y1="${OUTER_PAD}" x2="${cx}" y2="${totalHeight - OUTER_PAD}" stroke="${BORDER_COLOR}" stroke-width="1"/>`,
    );
  const outerBorder = `  <rect x="${OUTER_PAD}" y="${OUTER_PAD}" width="${innerWidth}" height="${totalHeight - OUTER_PAD * 2}" fill="none" stroke="${BORDER_COLOR}" stroke-width="1"/>`;
  return [...colSeps, outerBorder];
};

const buildTableSvg = (table: Tokens.Table): string => {
  const colWidths = calcColWidths(table);
  const innerWidth = colWidths.reduce((a, b) => a + b, 0);
  const totalWidth = innerWidth + OUTER_PAD * 2;
  const totalHeight = ROW_HEIGHT * (table.rows.length + 1) + OUTER_PAD * 2;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}">`,
    `  <rect width="${totalWidth}" height="${totalHeight}" fill="${BG_COLOR}"/>`,
    ...buildHeaderParts({ table, colWidths }),
    ...buildBodyParts({ table, colWidths }),
    ...buildGridParts({
      headerLength: table.header.length,
      colWidths,
      innerWidth,
      totalHeight,
    }),
    `</svg>`,
  ];

  return parts.join("\n");
};

export const tableToBuffer = async (table: Tokens.Table): Promise<Buffer> => {
  const svg = buildTableSvg(table);
  return sharp(Buffer.from(svg)).png().toBuffer();
};
