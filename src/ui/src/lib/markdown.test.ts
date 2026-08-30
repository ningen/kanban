import { describe, expect, it } from "bun:test";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("escapes raw HTML to prevent XSS", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders headings", () => {
    expect(renderMarkdown("# Title")).toContain("<h1>Title</h1>");
    expect(renderMarkdown("## Sub")).toContain("<h2>Sub</h2>");
  });

  it("renders paragraphs", () => {
    expect(renderMarkdown("hello\nworld")).toContain("<p>hello world</p>");
  });

  it("renders bold, italic, and inline code", () => {
    const html = renderMarkdown("**bold** and *italic* and `code`");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<code>code</code>");
  });

  it("renders unordered and ordered lists", () => {
    expect(renderMarkdown("- a\n- b")).toContain("<ul><li>a</li><li>b</li></ul>");
    expect(renderMarkdown("1. a\n2. b")).toContain("<ol><li>a</li><li>b</li></ol>");
  });

  it("renders task lists with checkboxes", () => {
    const html = renderMarkdown("- [x] done\n- [ ] todo");
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('data-checked="false"');
    expect(html).toContain("disabled");
  });

  it("renders fenced code blocks and escapes content", () => {
    const html = renderMarkdown("```js\nconst a = 1 < 2;\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("&lt;");
  });

  it("renders blockquotes and horizontal rules", () => {
    expect(renderMarkdown("> note")).toContain("<blockquote>note</blockquote>");
    expect(renderMarkdown("---")).toContain("<hr />");
  });

  it("renders http(s) links safely", () => {
    expect(renderMarkdown("[x](https://example.com)")).toContain('href="https://example.com"');
    expect(renderMarkdown("[x](javascript:alert(1))")).toContain("(javascript:alert(1))");
  });
});
