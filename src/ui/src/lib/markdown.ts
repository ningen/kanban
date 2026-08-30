/**
 * Minimal, safe Markdown renderer for task notes.
 *
 * Supports the subset people actually write in task bodies: headings,
 * paragraphs, unordered/ordered/task lists, bold/italic/inline code, links,
 * code blocks, blockquotes, and horizontal rules. It escapes HTML, so the
 * output is safe to inject (no XSS). Input is normalized to blocks.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Inline formatting: code, bold, italic, links. Applied to already-escaped text. */
function inline(text: string): string {
  let out = text;
  // `code` first so its markers are not modified.
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);
  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, b: string) => `<strong>${b}</strong>`);
  // *italic* (single asterisk not part of **)
  out = out.replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, (_m, pre: string, i: string) => `${pre}<em>${i}</em>`);
  // [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    // Only allow safe http(s) links.
    if (!/^https?:\/\//i.test(url)) return `${label} (${url})`;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return out;
}

/** Render a single line as a list item (with optional task checkbox). */
function listItem(line: string): string {
  const task = line.match(/^\[([ xX])\]\s+(.*)$/);
  if (task !== null) {
    const checked = task[1] === "x" || task[1] === "X" ? "checked" : "";
    return `<li class="task" data-checked="${task[1] === "x" || task[1] === "X" ? "true" : "false"}">` +
      `<input type="checkbox" disabled ${checked} /><span>${inline(task[2] ?? "")}</span></li>`;
  }
  return `<li>${inline(line)}</li>`;
}

/** Render a block list (ul/ol) with a task-aware item renderer. */
function renderList(lines: string[], ordered: boolean): string {
  const items = lines
    .map((line) => {
      // Strip the list marker before passing to the item renderer.
      const stripped = ordered
        ? line.replace(/^\s*\d+\.\s+/, "")
        : line.replace(/^\s*[-*+]\s+/, "");
      return listItem(stripped);
    })
    .join("");
  return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
}

/** Render all blocks. */
export function renderMarkdown(src: string): string {
  const unescaped = src.replace(/\r\n/g, "\n");
  const lines = unescaped.split("\n");
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence !== null) {
      const lang = fence[1] ?? "";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? "")) {
        buf.push(lines[i] ?? "");
        i++;
      }
      i++; // skip closing fence
      const code = buf.join("\n");
      html.push(
        `<pre${lang ? ` data-lang="${escapeHtml(lang)}"` : ""}><code>${escapeHtml(code)}</code></pre>`,
      );
      continue;
    }

    // Headings
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading !== null) {
      const level = heading[1]?.length ?? 1;
      html.push(`<h${level}>${inline(escapeHtml(heading[2] ?? ""))}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      html.push("<hr />");
      i++;
      continue;
    }

    // Blockquote (single line)
    if (/^\s*>\s?/.test(line)) {
      html.push(`<blockquote>${inline(escapeHtml(line.replace(/^\s*>\s?/, "")))}</blockquote>`);
      i++;
      continue;
    }

    // Lists — gather consecutive items
    if (/^(\s*[-*+]\s+|\s*\d+\.\s+)/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const buf: string[] = [];
      while (i < lines.length) {
        const l = lines[i] ?? "";
        if (ordered ? /^\s*\d+\.\s+/.test(l) : /^(\s*[-*+]\s+)/.test(l)) {
          buf.push(l);
          i++;
        } else {
          break;
        }
      }
      html.push(renderList(buf, ordered));
      continue;
    }

    // Paragraph — join consecutive plain lines.
    const buf: string[] = [line];
    i++;
    while (i < lines.length) {
      const l = lines[i] ?? "";
      if (l.trim() === "" || /^(#|\s*>\s?|```|\s*[-*+]\s+|\s*\d+\.\s+)/.test(l)) break;
      buf.push(l);
      i++;
    }
    html.push(`<p>${inline(escapeHtml(buf.join(" ")))}</p>`);
  }

  return html.join("\n");
}
