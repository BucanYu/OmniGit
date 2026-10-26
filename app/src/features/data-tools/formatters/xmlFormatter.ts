/**
 * Pure client-side XML/HTML Formatter & Minifier (Zero eval, Zero external deps)
 */

export function formatXml(xml: string, indent = 2): { formatted: string; error?: string } {
  if (!xml.trim()) return { formatted: '' };

  try {
    let formatted = '';
    let pad = 0;
    const padStr = ' '.repeat(indent);

    // Normalize spacing around tags
    const reg = /(>)(<)(\/*)/g;
    const cleanXml = xml
      .replace(/\r\n/g, '\n')
      .replace(reg, '$1\r\n$2$3')
      .trim();

    const lines = cleanXml.split('\r\n');

    for (let i = 0; i < lines.length; i++) {
      let node = lines[i].trim();
      if (!node) continue;

      let indentAdjustment = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        // Tag with text content inside same line e.g. <name>John</name>
        indentAdjustment = 0;
      } else if (node.match(/^<\/\w/)) {
        // Closing tag e.g. </root>
        if (pad !== 0) pad -= 1;
      } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
        // Opening tag e.g. <root>
        indentAdjustment = 1;
      } else {
        indentAdjustment = 0;
      }

      formatted += padStr.repeat(pad) + node + '\n';
      pad += indentAdjustment;
    }

    return { formatted: formatted.trimEnd() };
  } catch (err: any) {
    return { formatted: xml, error: err.message || 'XML Format Error' };
  }
}

export function minifyXml(xml: string): { minified: string; error?: string } {
  if (!xml.trim()) return { minified: '' };
  try {
    const minified = xml
      .replace(/\r\n/g, '')
      .replace(/\n/g, '')
      .replace(/\t/g, '')
      .replace(/>\s+</g, '><')
      .trim();
    return { minified };
  } catch (err: any) {
    return { minified: xml, error: err.message || 'XML Minify Error' };
  }
}
