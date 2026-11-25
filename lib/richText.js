const ALLOWED = new Set(['p','br','strong','b','em','i','u','h2','h3','ul','ol','li','blockquote']);

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function cleanRichHtml(input) {
  const source = String(input || '');
  if (typeof window !== 'undefined' && window.DOMParser) {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    const cleanNode = (node) => {
      if (node.nodeType === 3) return escapeHtml(node.nodeValue || '');
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object') return '';
      const children = Array.from(node.childNodes).map(cleanNode).join('');
      if (!ALLOWED.has(tag)) return children;
      return tag === 'br' ? '<br>' : '<' + tag + '>' + children + '</' + tag + '>';
    };
    return Array.from(doc.body.childNodes).map(cleanNode).join('');
  }
  return source
    .replace(/<(script|style|iframe|object)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(\/?)([a-z0-9]+)\b[^>]*>/gi, (match, slash, tag) => ALLOWED.has(tag.toLowerCase()) ? '<' + slash + tag.toLowerCase() + '>' : '');
}

export function richTextToEditorHtml(input) {
  const source = String(input || '');
  if (!source) return '';
  if (/<\/?(?:p|br|strong|b|em|i|u|h2|h3|ul|ol|li|blockquote)\b/i.test(source)) return cleanRichHtml(source);
  return source.replace(/\r\n?/g, '\n').split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => '<p>' + escapeHtml(line) + '</p>').join('');
}

export function richTextToDisplayHtml(input) {
  return richTextToEditorHtml(input);
}

export function richTextWordCount(input) {
  const text = String(input || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
  const words = text.trim().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu);
  return words ? words.length : 0;
}
