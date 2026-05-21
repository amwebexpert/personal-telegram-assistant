import { Tokens } from "marked";

import { escapeHtml } from "./telegram-bot.utils";

const buildHeaderCells = (table: Tokens.Table): string => {
  return table.header.map((h) => `<th>${escapeHtml(h.text)}</th>`).join("");
};

const buildBodyRows = (table: Tokens.Table): string => {
  return table.rows
    .map((row) => {
      const cells = row
        .map((cell) => `<td>${escapeHtml(cell.text)}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("\n        ");
};

export const buildTableHtmlDoc = (table: Tokens.Table): string => {
  const headerCells = buildHeaderCells(table);
  const bodyRows = buildBodyRows(table);

  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head><meta charset='UTF-8'></head>",
    "<body>",
    "  <table>",
    "    <thead>",
    `      <tr>${headerCells}</tr>`,
    "    </thead>",
    "    <tbody>",
    `        ${bodyRows}`,
    "    </tbody>",
    "  </table>",
    "</body>",
    "</html>",
  ].join("\n");
};
