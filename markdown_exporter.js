class MarkdownExporter {
  constructor(parser) {
    this.parser = parser;
  }

  generateMarkdown(conversationData, imageMap) {
    this.parser.setImageMap(imageMap);
    this.parser.extractMessages(conversationData);
    
    const title = conversationData.title || "ChatGPT Conversation";
    const messages = this.parser.messages;

    let markdown = `# ${title}\n\n`;

    messages.forEach((msg) => {
      const role = msg.role === "USER" ? "User" : "ChatGPT";
      const timestamp = msg.timestamp
        ? new Date(msg.timestamp * 1000).toLocaleString()
        : "";

      markdown += `## ${role} ${timestamp ? `(${timestamp})` : ""}\n\n`;
      
      // Process content to fit Markdown format better if needed
      let content = msg.content;

      // Replace internal image placeholders with Markdown image syntax
      // Since we can't easily bundle images in a single .md file without base64 (which is ugly),
      // or a zip, we will use a placeholder or the base64 if it's not too huge.
      // For now, let's use a clear placeholder indicating an image was there.
      // Or if the user really wants it "instead of image", maybe they don't care about the images?
      // I will try to preserve the structure.
      
      content = content.replace(/\[\[IMAGE:([^\]]+)\]\]/g, (match, imgId) => {
        // We could potentially put the base64 here, but it makes the MD file massive and unreadable.
        // Let's just note it.
        return `\n![ImagePlaceholder](Image_${imgId})\n*[Image referencing ID: ${imgId}]*\n`;
      });

      markdown += `${content}\n\n---\n\n`;
    });

    return markdown;
  }
}
