document.addEventListener("DOMContentLoaded", () => {
    const statusDiv = document.getElementById("status");
    const exportBtn = document.getElementById("exportBtn");
    const pdfBtn = document.getElementById("pdfBtn");
    const exportMdBtn = document.getElementById("exportMdBtn");
    const themeSelect = document.getElementById("themeSelect");
    const filenameInput = document.getElementById("filenameInput");
    const debugBtn = document.getElementById("debugBtn");
    const clearCacheBtn = document.getElementById("clearCacheBtn");
  
    // State
    let conversationData = null;
    let authToken = null;
  
    // Initialize Modules
    const imageFetcher = new ImageFetcher(null);
    const parser = new ChatGPTParser();
    const htmlExporter = new HTMLExporter(parser);
    const markdownExporter = new MarkdownExporter(parser);
  
    // Load saved filename preference
    chrome.storage.local.get(["custom_filename"], (result) => {
      if (result.custom_filename) {
        filenameInput.value = result.custom_filename;
      }
    });
  
    // Save filename preference on change
    filenameInput.oninput = () => {
      chrome.storage.local.set({ custom_filename: filenameInput.value });
    };
  
    clearCacheBtn.onclick = () => {
      chrome.storage.local.remove(
        ["image_cache", "file_url_map", "download_url_map"],
        () => {
          alert(
            "Extension cache cleared. Please refresh ChatGPT and scroll through the chat to re-capture images."
          );
        }
      );
    };
  
    debugBtn.onclick = () => {
      chrome.storage.local.get(
        [
          "latest_conversation",
          "auth_token",
          "image_cache",
          "file_url_map",
          "download_url_map",
        ],
        (result) => {
          console.log("--- ChatGPT Exporter Debug Data ---");
          console.log("Conversation Data:", result.latest_conversation);
          console.log("Auth Token:", result.auth_token ? "Present" : "Missing");
  
          // Use ImageFetcher to inspect data (optional debug logic)
          // For now, reuse the manual logging as it's specific to debugging storage state
          // but we can assume ImageFetcher works if we use it correctly.
          // I'll keep the simple debug log but simplified.
          const imgCacheSize = result.image_cache
            ? Object.keys(result.image_cache).length
            : 0;
          const dlMapSize = result.download_url_map
            ? Object.keys(result.download_url_map).length
            : 0;
  
          alert(
            `Debug data logged to console.\n\nImage Cache Size: ${imgCacheSize}\nDownload URLs: ${dlMapSize}`
          );
        }
      );
    };
  
    function getFilename(title, extension) {
      let baseFilename = filenameInput.value.trim() || title;
      baseFilename = baseFilename.replace(/[/\\?%*:|"<>]/g, "-");
      return `${baseFilename}.${extension}`;
    }
  
    function setStatus(msg, isError = false) {
      statusDiv.innerHTML = msg;
      if (isError) statusDiv.style.color = "#ef4444";
      else statusDiv.style.color = "#1e293b";
    }
  
    async function handleExport(type) {
      if (!conversationData) return;
  
      const title = conversationData.title || "ChatGPT Conversation";
      setStatus(`<strong>Processing...</strong><br><small>Fetching images...</small>`);
  
      try {
        // 1. Fetch Images
        const imageMap = await imageFetcher.getAllImages(conversationData, (count) => {
            setStatus(`<strong>Processing...</strong><br><small>Fetching ${count} images...</small>`);
        });
  
        // 2. Generate Content
        if (type === "html") {
          const content = htmlExporter.generateHTML(
            conversationData,
            title,
            themeSelect.value,
            false,
            imageMap
          );
          const blob = new Blob([content], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = getFilename(title, "html");
          a.click();
          URL.revokeObjectURL(url);
          setStatus(`<strong>Success!</strong><br><small>Exported as HTML</small>`);
  
        } else if (type === "pdf") {
          // Use high-fidelity html2pdf-based exporter
          const pdfExporter = new PDFExporter();
          pdfExporter.generatePDF(
            conversationData,
            title,
            themeSelect.value,
            imageMap
          );
          setStatus(`<strong>Success!</strong><br><small>Exported as PDF</small>`);


  
        } else if (type === "md") {
          const content = markdownExporter.generateMarkdown(conversationData, imageMap);
          const blob = new Blob([content], { type: "text/markdown" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = getFilename(title, "md");
          a.click();
          URL.revokeObjectURL(url);
          setStatus(`<strong>Success!</strong><br><small>Exported as Markdown</small>`);
        }
  
      } catch (err) {
        console.error(err);
        setStatus(`<strong>Error:</strong> ${err.message}`, true);
      }
    }
  
    // Check for latest conversation and Initialize
    chrome.storage.local.get(
      ["latest_conversation", "auth_token"],
      async (result) => {
        if (result.latest_conversation) {
          conversationData = result.latest_conversation;
          authToken = result.auth_token;
          
          // Update ImageFetcher auth token
          imageFetcher.setAuthToken(authToken);
  
          const title = conversationData.title || "ChatGPT Conversation";
          if (!filenameInput.value) {
            filenameInput.placeholder = title;
          }
  
          setStatus(`<strong>Detected:</strong> ${title}<br><small>Ready to export</small>`);
          statusDiv.style.color = "#059669";
  
          // Enable buttons
          exportBtn.disabled = false;
          pdfBtn.disabled = false;
          exportMdBtn.disabled = false;
  
          // Pre-fetch in background
          if (authToken) {
             imageFetcher.preFetchMissingDownloadUrls(conversationData).catch(() => {});
          }
  
          // Attach listeners
          exportBtn.onclick = () => handleExport("html");
          pdfBtn.onclick = () => handleExport("pdf");
          exportMdBtn.onclick = () => handleExport("md");
        }
      }
    );
  });
