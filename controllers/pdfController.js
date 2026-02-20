import { generatePdfBuffer } from '#services/pdfService.js';


export const generatePdf = async (req, res) => {
    try {
        const { elements, sections, canvasSize, margins, fileName } = req.body;

        console.log(`Generating PDF: ${fileName}`);

        const pdf = await generatePdfBuffer({ elements, sections, canvasSize, margins });

        console.log(`PDF generated successfully: ${fileName}`);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'resume'}.pdf"`);
        res.send(pdf);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({
            error: 'Failed to generate PDF',
            message: error.message
        });
    }
};

