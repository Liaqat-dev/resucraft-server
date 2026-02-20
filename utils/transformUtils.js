/**
 * Convert mm string to pixels at 96 DPI.
 */
export const mmToPx = (mm) => {
    return Math.round(parseFloat(mm) * 96 / 25.4);
};

/**
 * Convert nested structure (from frontend save) to flat structure (for PDF rendering).
 * Matches the frontend's nestedToFlat function.
 */
export const nestedToFlat = (nestedData) => {
    const elements = [...(nestedData.elements || [])];
    const sections = [];

    (nestedData.sections || []).forEach(section => {
        const { 'sub-sections': subsections, elements: sectionElements, backgroundColor, borderColor, direction, subsections: _unused, ...sectionData } = section;
        sections.push(sectionData);

        if (sectionElements && sectionElements.length > 0) {
            sectionElements.forEach(el => {
                elements.push({
                    ...el,
                    x: el.x + section.x,
                    y: el.y + section.y,
                    parentSection: section.id
                });
            });
        }

        if (subsections && subsections.length > 0) {
            subsections.forEach(subsection => {
                const { elements: subElements, backgroundColor: _bg, borderColor: _bc, direction: _dir, ...subsectionData } = subsection;

                sections.push({
                    ...subsectionData,
                    type: 'subsection',
                    x: subsectionData.x + section.x,
                    y: subsectionData.y + section.y,
                    parentSection: section.id
                });

                if (subElements && subElements.length > 0) {
                    subElements.forEach(el => {
                        elements.push({
                            ...el,
                            x: el.x + subsectionData.x + section.x,
                            y: el.y + subsectionData.y + section.y,
                            parentSection: subsection.id
                        });
                    });
                }
            });
        }
    });

    return { elements, sections };
};

/**
 * Render a single element to an HTML string.
 */
export const renderElement = (el) => {
    // ── Line Break ──
    if (el.type === 'line-break') {
        const thickness = el.lineBreakThickness || 1;
        const color = el.lineBreakColor || '#d1d5db';
        const style = el.lineBreakStyle || 'solid';
        const widthPercent = el.lineBreakWidthPercent || 100;

        const wrapperStyle = `
            position: absolute;
            left: ${el.x}px;
            top: ${el.y}px;
            width: ${el.width}px;
            height: ${el.height}px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        const lineStyle = `
            width: ${widthPercent}%;
            height: 0;
            border-top: ${thickness}px ${style} ${color};
        `;
        return `
            <div class="element line-break" style="${wrapperStyle}">
                <div style="${lineStyle}"></div>
            </div>
        `;
    }

    const bulletSymbol = {
        'disc': '•',
        'circle': '○',
        'square': '■',
        'numbered': '1.',
        'roman': 'i.'
    };

    const bullet = el.type === 'list-item' && el.bulletType
        ? bulletSymbol[el.bulletType] || '•'
        : '';

    const content = el.type === 'list-item'
        ? el.content.replace(/^[•○■]\s*/, '').replace(/^\d+\.\s*/, '').replace(/^[ivxlcdm]+\.\s*/i, '')
        : el.content;

    const elementStyle = `
        left: ${el.x}px;
        top: ${el.y}px;
        width: ${el.width}px;
        height: ${el.height}px;
        font-size: ${el.fontSize || 16}px;
        font-weight: ${el.fontWeight || 'normal'};
        font-family: ${el.fontFamily || 'Arial'}, sans-serif;
        color: ${el.color || '#000000'};
        text-align: ${el.textAlign || 'left'};
        line-height: ${el.lineHeight || 1.5};
        ${el.letterSpacing != null ? `letter-spacing: ${el.letterSpacing}px;` : ''}
        ${el.underline ? 'text-decoration: underline;' : ''}
    `;

    return `
        <div class="element ${el.type === 'list-item' ? 'list-item' : ''}" style="${elementStyle}">
            ${bullet ? `<span class="bullet">${bullet}</span>` : ''}
            <span class="element-content">${content || ''}</span>
        </div>
    `;
};

/**
 * Render all sections (including nested subsections) to HTML.
 * canvasSettings provides width/margins so section width is always derived
 * from canvas dimensions (never stored in the JSON).
 */
export const renderSections = (sections, elements, canvasSettings) => {
    const canvasWidthPx = mmToPx(canvasSettings?.width || '210mm');
    const margins = canvasSettings?.margins || { left: 1, right: 1 };
    const sectionWidth = canvasWidthPx - (margins.left * 96) - (margins.right * 96);

    let html = '';

    sections.forEach(section => {
        if (section.parentSection) return;

        const isSubsection = section.type === 'subsection';

        const px = section.px ?? 0;
        const py = section.py ?? 0;
        const mx = section.mx ?? 0;
        const my = section.my ?? 0;

        const sectionStyle = `
            left: ${section.x}px;
            top: ${section.y}px;
            width: ${sectionWidth}px;
            height: ${section.height}px;
            padding-left: ${px}px;
            padding-right: ${px}px;
            padding-top: ${py}px;
            padding-bottom: ${py}px;
            margin-left: ${mx}px;
            margin-right: ${mx}px;
            margin-top: ${my}px;
            margin-bottom: ${my}px;
        `;

        html += `<div class="section ${isSubsection ? 'subsection' : ''}" style="${sectionStyle}">`;

        if (!isSubsection && section.title && section.headerVisible !== false) {
            const titleStyle = `
                font-size: ${section.headerFontSize || 16}px;
                font-weight: ${section.headerFontWeight || 'bold'};
                font-family: ${section.headerFontFamily || 'Arial'}, sans-serif;
                color: ${section.headerColor || '#1f2937'};
                text-align: ${section.headerTextAlign || 'left'};
                line-height: ${section.headerLineHeight || 1.0};
                ${section.headerLetterSpacing != null ? `letter-spacing: ${section.headerLetterSpacing}px;` : ''}
                ${section.headerUnderline ? 'text-decoration: underline;' : ''}
            `;
            html += `<div class="section-title" style="${titleStyle}">${section.title}</div>`;
        }

        const subsections = sections.filter(s => s.parentSection === section.id);
        subsections.forEach(subsection => {
            const relativeX = subsection.x - section.x;
            const relativeY = subsection.y - section.y;

            const subPx = subsection.px ?? 0;
            const subPy = subsection.py ?? 0;
            const subMx = subsection.mx ?? 0;
            const subMy = subsection.my ?? 0;

            const subStyle = `
                left: ${relativeX}px;
                top: ${relativeY}px;
                width: ${sectionWidth}px;
                height: ${subsection.height}px;
                padding-left: ${subPx}px;
                padding-right: ${subPx}px;
                padding-top: ${subPy}px;
                padding-bottom: ${subPy}px;
                margin-left: ${subMx}px;
                margin-right: ${subMx}px;
                margin-top: ${subMy}px;
                margin-bottom: ${subMy}px;
            `;

            html += `<div class="section subsection" style="${subStyle}">`;

            const subElements = elements.filter(el => el.parentSection === subsection.id);
            subElements.forEach(el => {
                const relativeEl = {
                    ...el,
                    x: el.x - subsection.x,
                    y: el.y - subsection.y
                };
                html += renderElement(relativeEl);
            });

            html += `</div>`;
        });

        const sectionElements = elements.filter(el => {
            if (el.parentSection !== section.id) return false;
            const belongsToSubsection = subsections.some(sub => el.parentSection === sub.id);
            return !belongsToSubsection;
        });

        sectionElements.forEach(el => {
            const relativeEl = {
                ...el,
                x: el.x - section.x,
                y: el.y - section.y
            };
            html += renderElement(relativeEl);
        });

        html += `</div>`;
    });

    return html;
};