class ChatGPTParser {
  constructor() {
    this.messages = [];
    this.imageMap = {};
  }

  setImageMap(map) {
    this.imageMap = map || {};
  }

  extractMessages(data) {
    this.messages = [];
    const mapping = data.mapping || {};

    let path = [];
    let currId = data.current_node;

    while (currId && mapping[currId]) {
      path.unshift(currId);
      currId = mapping[currId].parent;
    }

    path.forEach((nodeId) => {
      const node = mapping[nodeId];
      const message = node.message;
      if (message && message.content && message.content.parts) {
        const role = message.author.role;
        if (["user", "assistant", "tool"].includes(role)) {
          let textContent = "";
          const contentParts = message.content.parts;
          const attachments = (message.metadata && message.metadata.attachments) || [];

          contentParts.forEach((part) => {
            if (typeof part === "string") {
              textContent += part;
            } else if (typeof part === "object") {
              const partType = part.type || part.content_type;
              if (partType === "text") {
                textContent += part.text || "";
              } else if (partType === "image_asset_pointer") {
                const assetId = (part.asset_pointer || "").replace("sediment://", "");
                textContent += `\n[[IMAGE:${assetId}]]\n`;
              } else if (partType === "multimodal_text") {
                (part.content || []).forEach((subPart) => {
                  if (typeof subPart === "string") {
                    textContent += subPart;
                  } else if (subPart.type === "image_asset_pointer") {
                    const assetId = (subPart.asset_pointer || "").replace("sediment://", "");
                    textContent += `\n[[IMAGE:${assetId}]]\n`;
                  }
                });
              }
            }
          });

          attachments.forEach((att) => {
            if (att.id && !textContent.includes(`[[IMAGE:${att.id}]]`)) {
              if (att.name && /\.(png|jpg|jpeg|gif|webp)$/i.test(att.name)) {
                textContent += `\n[[IMAGE:${att.id}]]\n`;
              }
            }
          });

          const contentRefs = (message.metadata && message.metadata.content_references) || [];
          contentRefs.forEach((ref) => {
            if (ref.type === "image" && ref.file_id && !textContent.includes(`[[IMAGE:${ref.file_id}]]`)) {
              textContent += `\n[[IMAGE:${ref.file_id}]]\n`;
            }
          });

          if (textContent.trim()) {
            this.messages.push({
              role: role === "user" ? "USER" : "LLM",
              content: textContent.trim(),
              timestamp: message.create_time || 0,
              content_references: contentRefs,
            });
          }
        }
      }
    });
  }

  renderMarkdown(text, contentRefs = []) {
    // 1. Ultra-Aggressive Sanitization: Replace ALL bullet variations with "*"
    // This fixes the "â€¢" issue once and for all by returning to simple ASCII
    text = text
      .replace(/\u00E2\u20AC\u00A2/g, "*") // â€¢ -> *
      .replace(/\u00E2\u0080\u00A2/g, "*") // alternate hex for â€¢
      .replace(/â€¢/g, "*")               // literal â€¢
      .replace(/[•\u2022\u2023\u25E6\u2043]/g, "*") // standard bullets -> *
      .replace(/\u00E2\u20AC\u201D/g, "-") // dash
      .replace(/\u00E2\u20AC\u201C/g, "-");

    // 2. Escape HTML
    text = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 3. Code Blocks
    const codeBlocks = [];
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = `<!--CODE_BLOCK_${codeBlocks.length}-->`;
      codeBlocks.push(
        `<div class="code-container"><div class="code-header">${lang}</div><pre><code>${code.trim()}</code></pre></div>`
      );
      return placeholder;
    });

    // 4. Image Groups
    if (contentRefs) {
      contentRefs.forEach((ref) => {
        if (ref.type === "image_group") {
          const matchedText = ref.matched_text || "";
          const escapedMatchedText = matchedText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

          let galleryHtml = '<div class="image-gallery">';
          (ref.images || []).forEach((imgData) => {
            const imgResult = imgData.image_result || {};
            const fileId = imgResult.file_id || "";
            let contentUrl = imgResult.content_url || "";
            const title = imgResult.title || "Image";
            const sourceUrl = imgResult.url || "";
            if (fileId && this.imageMap[fileId]) contentUrl = this.imageMap[fileId];
            if (contentUrl) {
              galleryHtml += `<div class="gallery-item">
                                <img src="${contentUrl}" alt="${title}" loading="lazy">
                                <div class="image-caption">
                                    <a href="${sourceUrl}" target="_blank" rel="noopener">${title}</a>
                                </div>
                            </div>`;
            }
          });
          galleryHtml += "</div>";
          text = text.replace(escapedMatchedText, galleryHtml);
        }
      });
    }

    // 5. Tables
    text = text.replace(/((?:\|.*\|(?:\n|$))+)/g, (match) => {
      const rows = match.trim().split("\n");
      if (rows.length < 2) return match;
      let html = "<table><thead><tr>";
      const headers = rows[0].split("|").filter((cell) => cell.trim());
      headers.forEach((h) => (html += `<th>${h.trim()}</th>`));
      html += "</tr></thead><tbody>";
      rows.slice(2).forEach((row) => {
        const cells = row.split("|").filter((cell) => cell.trim());
        if (cells.length === 0) return;
        html += "<tr>";
        cells.forEach((c) => (html += `<td>${c.trim()}</td>`));
        html += "</tr>";
      });
      html += "</tbody></table>";
      return html;
    });

    // 6. Headings
    text = text.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.*)$/gm, "<h1>$1</h1>");

    // 7. Horizontal Rules
    text = text.replace(/^---+\s*$/gm, "<hr>");

    // 8. Blockquotes
    text = text.replace(/((?:^&gt; .*(?:\n|$))+)/gm, (match) => {
      const lines = match.trim().split("\n");
      const htmlParts = lines
        .map((line) => {
          let content = line.replace(/^&gt; ?/, "").trim();
          if (content) {
            content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
            content = content.replace(/`([^`]+)`/g, "<code>$1</code>");
            return `<div class="quote-item">${content}</div>`;
          }
          return "";
        })
        .filter(Boolean);
      return `<div class="quote-group">${htmlParts.join("")}</div>`;
    });

    // 9. Lists (Unordered)
    // We now catch standard markdown bullets AND the literal "*" we created in step 1
    text = text.replace(/((?:^[ \t]*[*-•\u2022\u2023\u25E6\u2043]|â€¢|&bull;) .*(?:\n|$))+/gm, (match) => {
      const items = match.trim().split("\n");
      let html = '<ul style="list-style-type: none !important; padding-left: 10px !important; margin-left: 0 !important;">';
      items.forEach((item) => {
        const content = item.replace(/^[ \t]*[*-•\u2022\u2023\u25E6\u2043]|â€¢|&bull;/, "").trim();
        // Use a safe literal "*" as the bullet for maximum PDF compatibility
        html += `<li style="margin-bottom: 0.5rem !important;"><span style="color: inherit; margin-right: 8px;">*</span>${content}</li>`;
      });
      html += "</ul>";
      return html;
    });

    // 10. Lists (Ordered)
    text = text.replace(/((?:^\d+\. .*(?:\n|$))+)/gm, (match) => {
      const items = match.trim().split("\n");
      let html = "<ol>";
      items.forEach((item) => {
        const content = item.replace(/^\d+\. /, "");
        html += `<li>${content}</li>`;
      });
      html += "</ol>";
      return html;
    });

    // 11. Inline Formatting
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

    // 12. Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, alt, url) => {
      if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].some((ext) => url.toLowerCase().endsWith(ext)) || url.includes("estuary/content")) {
        return `<div class="image-container"><img src="${url}" alt="${alt}"><div class="image-caption">${alt}</div></div>`;
      }
      return `<a href="${url}" target="_blank">${alt}</a>`;
    });

    // 13. Images
    text = text.replace(/\[\[IMAGE:([^\]]+)\]\]/g, (match, imgId) => {
      imgId = imgId.trim();
      if (this.imageMap[imgId]) {
        return `<div class="image-container"><img src="${this.imageMap[imgId]}" alt="Image ${imgId}"><div class="image-caption">Image: ${imgId}</div></div>`;
      }
      return `<div class="image-placeholder"><div class="placeholder-icon">🖼️</div><div class="placeholder-text"><strong>Image: ${imgId}</strong><br><small>Loading or not available.</small></div></div>`;
    });

    // 14. Paragraphs
    const parts = text.split("\n\n");
    const newParts = parts
      .map((p) => {
        p = p.trim();
        if (!p) return "";
        if (p.startsWith("<!--CODE_BLOCK_")) {
          const index = parseInt(p.match(/\d+/)[0]);
          return codeBlocks[index];
        }
        if (/<(h1|h2|h3|div|table|ul|ol|blockquote|hr|pre)/.test(p)) {
          codeBlocks.forEach((html, i) => { p = p.replace(`<!--CODE_BLOCK_${i}-->`, html); });
          return p;
        } else {
          p = p.replace(/\n/g, "<br>");
          codeBlocks.forEach((html, i) => { p = p.replace(`<!--CODE_BLOCK_${i}-->`, html); });
          return `<p>${p}</p>`;
        }
      })
      .filter(Boolean);

    return newParts.join("\n");
  }
}
