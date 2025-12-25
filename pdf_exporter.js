class PDFExporter {

    constructor() {
        // We use HTMLExporter to generate the base HTML content
        // and then html2pdf to convert it to a PDF.
    }

    generatePDF(conversationData, title, theme = "light", imageMap = {}) {
        const parser = new ChatGPTParser();
        const htmlExporter = new HTMLExporter(parser);

        // 1. Generate the same high-quality HTML used for standard export
        // Note: isPdf=true enables specific @media and .pdf-mode styles
        const htmlContent = htmlExporter.generateHTML(
            conversationData, 
            title, 
            theme, 
            true, 
            imageMap
        );

        // 2. Configure html2pdf options for high fidelity
        const opt = {
            // Margin [top, left, bottom, right] in points (pt)
            // We use top/bottom margins to prevent "slicing" at page edges
            margin: [40, 0, 40, 0], 
            filename: `${this.sanitizeFilename(title)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 3, 
                useCORS: true, 
                letterRendering: true,
                logging: false,
                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                windowWidth: 800 
            },
            jsPDF: { 
                unit: 'pt', 
                format: 'a4', 
                orientation: 'portrait',
                compress: true 
            },
            pagebreak: { 
                mode: ['css', 'legacy'],
                avoid: ['h1', 'h2', 'h3', '.code-container', '.image-container']
            }
        };

        // 3. Execute capture and download using the Worker API for better stability
        html2pdf()
            .set(opt)
            .from(htmlContent)
            .toPdf()
            .get('pdf')
            .save()
            .then(() => {
                console.log("PDF Export complete");
            })
            .catch(err => {
                console.error("PDF Export failed:", err);
                alert("PDF Export failed. Try refreshing the page.");
            });
    }


    sanitizeFilename(name) {
        return name.replace(/[/\\?%*:|"<>]/g, '-');
    }
}
