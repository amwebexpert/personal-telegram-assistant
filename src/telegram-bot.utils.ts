import { promises as fs } from 'fs';
import { marked } from 'marked';
import path from 'path';

const MAX_LEN = 4096;

export const loadSessionId = async (
  fullPath: string,
): Promise<string | undefined> => {
  try {
    const raw: unknown = JSON.parse(await fs.readFile(fullPath, 'utf-8'));
    if (raw && typeof raw === 'object' && 'sessionId' in raw) {
      const sid = Reflect.get(raw, 'sessionId');
      if (typeof sid === 'string') return sid;
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

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const toTelegramHtml = (markdown: string): string => {
  const parsed = marked.parse(markdown);
  const html = typeof parsed === 'string' ? parsed : '';
  return (
    html
      // headings → bold
      .replace(/<h[1-6][^>]*>/gi, '<b>')
      .replace(/<\/h[1-6]>/gi, '</b>\n\n')
      // paragraphs
      .replace(/<p>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      // list items
      .replace(/<li>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      // strip ul/ol wrapper tags
      .replace(/<\/?[uo]l[^>]*>/gi, '\n')
      // hr and br
      .replace(/<hr\s*\/?>/gi, '───────────\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      // normalize strong/em to b/i (Telegram supports both but let's be safe)
      .replace(/<strong>/gi, '<b>')
      .replace(/<\/strong>/gi, '</b>')
      .replace(/<em>/gi, '<i>')
      .replace(/<\/em>/gi, '</i>')
      // strip any remaining tags not in Telegram's allowed set
      // allowed: b, i, u, ins, s, strike, del, code, pre, a, blockquote
      .replace(
        /<(?!\/?(b|i|u|ins|s|strike|del|code|pre|a|blockquote)[\s>/])[^>]+>/gi,
        '',
      )
      // collapse 3+ blank lines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
};

export const splitMessage = (text: string): string[] => {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_LEN) {
    let split = remaining.lastIndexOf('\n', MAX_LEN);
    if (split <= 0) split = MAX_LEN;
    chunks.push(remaining.slice(0, split));
    remaining = remaining.slice(split).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
};
