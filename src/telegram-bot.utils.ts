import { marked } from 'marked';

const MAX_LEN = 4096;

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
