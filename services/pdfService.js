import puppeteer    from "puppeteer";
import { mmToPx, nestedToFlat, renderSections, renderElement } from '#utils/transformUtils.js';

/**
 * Generate a PDF buffer from resume data.
 *
 * @param {Object} params
 * @param {Array}  params.elements   - Canvas elements
 * @param {Array}  params.sections   - Canvas sections
 * @param {Object} params.canvasSize - { width: '210mm', height: '297mm' }
 * @returns {Buffer} PDF file buffer
 */
export const generatePdfBuffer = async ({ elements, sections, canvasSize, margins }) => {
    // Transform nested structure to flat if needed
    const isNested = sections && sections.some(s => s['sub-sections']);
    if (isNested) {
        const flatData = nestedToFlat({ elements, sections });
        elements = flatData.elements;
        sections = flatData.sections;
    }

    const width = canvasSize?.width || '210mm';
    const height = canvasSize?.height || '297mm';
    const widthPx = mmToPx(width);
    const heightPx = mmToPx(height);

    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            width: ${widthPx}px;
            height: ${heightPx}px;
            position: relative;
            background: white;
            font-family: Arial, sans-serif;
        }
        .section {
            position: absolute;
            border-radius: 2px;
            box-sizing: border-box;
        }
        .subsection {
            border-radius: 2px;
        }
        .section-title {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 4px;
            padding-bottom: 3px;
        }
        .element {
            position: absolute;
            word-wrap: break-word;
            overflow-wrap: break-word;
            display: flex;
            align-items: flex-start;
        }
        .element.list-item {
            display: flex;
            gap: 8px;
        }
        .element .bullet {
            flex-shrink: 0;
            margin-right: 4px;
        }
        .element-content {
            flex: 1;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
`;

    html += renderSections(sections, elements, { width, margins });

    elements.forEach(el => {
        if (!el.parentSection) {
            html += renderElement(el);
        }
    });

    html += `
</body>
</html>
`;

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.setViewport({ width: widthPx, height: heightPx });

    const pdf = await page.pdf({
        width,
        height,
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });

    await browser.close();

    return pdf;
};


