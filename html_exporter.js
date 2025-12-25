class HTMLExporter {
    constructor(parser) {
      this.parser = parser;
    }
  
    generateHTML(conversationData, title, theme = "light", isPdf = false, imageMap = {}) {
        this.parser.setImageMap(imageMap);
        this.parser.extractMessages(conversationData);
        // Sanitize title for encoding issues
      const sanitizedTitle = title.replace(/•/g, "&bull;");
  
      const css = `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  
          :root {
              color-scheme: light;
              --bg-color: #ffffff;
              --container-bg: #ffffff;
              --text-color: #1a1a1a;
              --heading-color: #111827;
              --user-label-color: #2563eb;
              --llm-label-color: #059669;
              --border-color: #e5e7eb;
              --code-bg: #f8fafc;
              --code-header-bg: #e2e8f0;
              --code-text: #475569;
              --quote-bg: #f8fafc;
              --quote-border: #e2e8f0;
              --quote-text: #334155;
              --timestamp-color: #9ca3af;
              --max-width: 850px;
          }
  
          .dark-mode {
              color-scheme: dark;
              --bg-color: #0f172a;
              --container-bg: #1e293b;
              --text-color: #f1f5f9;
              --heading-color: #f8fafc;
              --user-label-color: #60a5fa;
              --llm-label-color: #34d399;
              --border-color: #334155;
              --code-bg: #0f172a;
              --code-header-bg: #1e293b;
              --code-text: #94a3b8;
              --quote-bg: #1e293b;
              --quote-border: #334155;
              --quote-text: #cbd5e1;
              --timestamp-color: #64748b;
          }
  
          * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
          }
  
          body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
              line-height: 1.6;
              color: var(--text-color);
              background-color: var(--bg-color);
              margin: 0;
              padding: 0; /* Reset for PDF */
          }

  
          .container {
              max-width: var(--max-width);
              margin: 0 auto;
              background: var(--container-bg);
              color: var(--text-color);
              padding: 60px;
              border-radius: 12px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
  
          /* PDF Capture Styles */
          .pdf-mode {
              width: 800px !important;
              margin: 0 !important;
              padding: 0 !important;
              background-color: var(--bg-color) !important;
          }
  
          .pdf-mode .container {
              max-width: none !important;
              width: 100% !important;
              padding: 0 20mm !important; /* Horizontal spacing only, vertical handled by library margin */
              margin: 0 !important;
              box-shadow: none !important;
              background-color: var(--bg-color) !important;
              min-height: 100vh;
          }
  
          .pdf-mode h1, .pdf-mode h2, .pdf-mode h3, .pdf-mode p, .pdf-mode li, .pdf-mode .code-container, .pdf-mode .quote-item {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              display: block !important;
              width: 100% !important;
              position: relative !important;
              padding: 2px 0 !important; /* Helps engine distinguish element boundaries */
              margin-bottom: 0.5rem !important;
          }
  
          .pdf-mode h1, .pdf-mode h2, .pdf-mode h3 {
              page-break-after: avoid !important;
              break-after: avoid !important;
              margin-top: 1.5rem !important;
          }
  
          /* Force emojis to be visible */
          .pdf-mode img.emoji {
              height: 1.2em;
              width: 1.2em;
              vertical-align: middle;
          }

  
          header {
              border-bottom: 2px solid var(--border-color);
              margin-bottom: 30px;
              padding-bottom: 20px;
              page-break-inside: avoid;
          }
  
          h1 { font-size: 2.25rem; font-weight: 700; margin: 0 0 1.5rem 0; color: var(--heading-color); }
          h2 { font-size: 1.5rem; font-weight: 600; margin: 2.5rem 0 1.25rem 0; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; color: var(--heading-color); }
          h3 { font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.75rem 0; color: var(--heading-color); }
  
          .message {
              margin-bottom: 48px;
              position: relative;
              page-break-inside: avoid;
          }
  
          .role-label {
              font-weight: 700;
              font-size: 0.75rem;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 12px;
              display: block;
              page-break-after: avoid;
          }
  
          .role-USER { color: var(--user-label-color); }
          .role-LLM { color: var(--llm-label-color); }
  
          .content {
              font-size: 1.05rem;
          }
  
          p { margin: 0 0 1rem 0; }
          
          .code-container {
              background: var(--code-bg);
              border: 1px solid var(--border-color);
              border-radius: 8px;
              margin: 1.5rem 0;
              overflow: hidden;
              page-break-inside: avoid;
          }
  
          .code-header {
              background: var(--code-header-bg);
              padding: 4px 12px;
              font-size: 0.75rem;
              font-family: 'JetBrains Mono', monospace;
              color: var(--code-text);
              text-transform: uppercase;
          }
  
          pre {
              margin: 0;
              padding: 16px;
              overflow-x: auto;
              white-space: pre-wrap; /* Better wrapping for PDF */
          }
  
          code {
              font-family: 'JetBrains Mono', monospace;
              font-size: 0.9rem;
              background: var(--code-bg);
              padding: 2px 4px;
              border-radius: 4px;
              color: var(--text-color);
          }
  
          pre code {
              background: transparent;
              padding: 0;
              text-wrap: wrap;
          }
  
          .quote-group {
              margin: 1rem 0;
          }
  
          .quote-item {
              background: var(--quote-bg);
              padding: 12px 20px;
              margin-bottom: 8px;
              border-radius: 6px;
              border-left: 4px solid var(--quote-border);
              font-style: italic;
              color: var(--quote-text);
              font-size: 0.95rem;
              line-height: 1.5;
          }
  
          .quote-item:last-child { margin-bottom: 0; }
  
          .image-container {
              margin: 1.5rem 0;
              text-align: center;
          }
  
          .image-container img {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
  
          .image-caption {
              font-size: 0.8rem;
              color: var(--timestamp-color);
              margin-top: 8px;
          }
  
          .image-placeholder {
              background: var(--code-bg);
              border: 2px dashed var(--border-color);
              padding: 24px;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 16px;
              color: var(--code-text);
              margin: 1.5rem 0;
              font-size: 0.9rem;
          }
  
          .image-placeholder .placeholder-icon {
              font-size: 3rem;
              opacity: 0.5;
          }
  
          .image-placeholder .placeholder-text {
              text-align: left;
              line-height: 1.6;
          }
  
          .image-placeholder .placeholder-text strong {
              color: var(--heading-color);
              font-size: 0.95rem;
          }
  
          .image-placeholder .placeholder-text small {
              color: var(--timestamp-color);
              font-size: 0.85rem;
          }
  
          .image-gallery {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 20px;
              margin: 1.5rem 0;
          }
  
          .gallery-item {
              background: var(--container-bg);
              border: 1px solid var(--border-color);
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              transition: transform 0.2s, box-shadow 0.2s;
          }
  
          .gallery-item:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
  
          .gallery-item img {
              width: 100%;
              height: 200px;
              object-fit: cover;
              display: block;
          }
  
          .gallery-item .image-caption {
              padding: 12px;
              font-size: 0.85rem;
              background: var(--code-bg);
          }
  
          .gallery-item .image-caption a {
              color: var(--user-label-color);
              text-decoration: none;
              word-break: break-word;
          }
  
          .gallery-item .image-caption a:hover {
              text-decoration: underline;
          }
  
          table {
              width: 100%;
              border-collapse: collapse;
              margin: 1.5rem 0;
          }
  
          th, td {
              border: 1px solid var(--border-color);
              padding: 12px;
              text-align: left;
          }
  
          th { 
            background: var(--code-bg) !important; 
            font-weight: 600; 
            color: var(--heading-color); 
            -webkit-print-color-adjust: exact !important;
        }

  
          hr {
              border: 0;
              border-top: 1px solid var(--border-color);
              margin: 3rem 0;
          }
  
          ul, ol { margin-bottom: 1.25rem; padding-left: 1.5rem; }
          ul { list-style-type: disc; }
          li { margin-bottom: 0.5rem; }
  
          /* Ensure bullets render correctly in PDF */
          /* Ensure bullets render correctly in PDF */
          .pdf-mode ul, .pdf-mode ol {
              padding-left: 1rem !important;
              margin-bottom: 1.5rem !important;
              display: block !important;
          }
          .pdf-mode ul li {
              list-style-type: none !important;
              display: block !important;
              margin-bottom: 0.5rem !important;
          }
          .pdf-mode ol li {
              list-style-type: decimal !important;
              display: list-item !important;
              margin-bottom: 0.5rem !important;
          }



  
          /* PDF Page Break Fixes */
          .pdf-mode .code-container,
          .pdf-mode .image-container,
          .pdf-mode .image-gallery,
          .pdf-mode blockquote,
          .pdf-mode .quote-group {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              position: relative;
          }
  
          .pdf-mode .message {
              margin-bottom: 30px !important;
              page-break-inside: auto !important; /* Allow messages to break between paragraphs */
              page-break-after: auto !important;
              display: block !important;
          }
  
          .pdf-mode img {
              max-width: 100%;
              height: auto;
              display: block;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
          }
  
          .timestamp {
              font-size: 0.75rem;
              color: var(--timestamp-color);
              margin-top: 8px;
              display: block;
          }
  
          @media print {
              body { padding: 0; }
              .container { box-shadow: none; width: 100%; max-width: none; padding: 0; }
              .message, .code-container, .image-container, table, blockquote { 
                  page-break-inside: avoid !important; 
                  break-inside: avoid !important;
              }
          }
  
          @media (max-width: 640px) {
              .container { padding: 30px 20px; }
              body { padding: 20px 10px; }
          }
          `;
  
      let messagesHtml = "";
      this.parser.messages.forEach((msg) => {
        const roleClass = `role-${msg.role}`;
        let contentHtml = this.parser.renderMarkdown(
          msg.content,
          msg.content_references
        );



        const timeStr = msg.timestamp
          ? new Date(msg.timestamp * 1000).toLocaleString()
          : "";
  
        messagesHtml += `
              <div class="message">
                  <span class="role-label ${roleClass}">${msg.role}</span>
                  <div class="content">
                      ${contentHtml}
                  </div>
                  ${timeStr ? `<span class="timestamp">${timeStr}</span>` : ""}
              </div>
              `;
      });
  
      const finalHtml = `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${sanitizedTitle}</title>
      <style>${css}</style>
  </head>
  <body class="${theme === "dark" ? "dark-mode" : ""} ${isPdf ? "pdf-mode" : ""}">
      <div class="container ${theme === "dark" ? "dark-mode" : ""}">
          <header>
              <h1>${sanitizedTitle}</h1>
          </header>
          <main>
              ${messagesHtml}
          </main>
      </div>
  </body>
  </html>`;

      return finalHtml;
    }
  }


