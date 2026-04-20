// ─── ATS Scorer Service ───────────────────────────────────────────────────────
// Rule-based scoring engine. No external API calls.
// Scores a resume's JSON data (elements + sections) against optional JD text.

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_VERBS = new Set([
    'led', 'managed', 'developed', 'built', 'designed', 'implemented', 'created',
    'improved', 'increased', 'reduced', 'achieved', 'delivered', 'launched',
    'coordinated', 'analyzed', 'collaborated', 'optimized', 'deployed', 'maintained',
    'resolved', 'established', 'generated', 'streamlined', 'transformed', 'spearheaded',
    'authored', 'automated', 'mentored', 'negotiated', 'oversaw', 'planned', 'reviewed',
    'supervised', 'trained', 'upgraded', 'executed', 'facilitated', 'identified',
    'initiated', 'integrated', 'monitored', 'operated', 'performed', 'produced',
    'provided', 'supported', 'tested', 'utilized', 'engineered', 'architected',
    'refactored', 'migrated', 'scaled', 'secured', 'researched', 'presented',
    'wrote', 'configured', 'administered', 'debugged', 'enhanced', 'evaluated',
]);

const TECH_KEYWORDS = new Set([
    'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue',
    'node', 'express', 'django', 'flask', 'spring', 'sql', 'mysql', 'postgresql',
    'mongodb', 'redis', 'html', 'css', 'tailwind', 'bootstrap', 'git', 'github',
    'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'linux', 'rest', 'graphql',
    'api', 'microservices', 'ci', 'cd', 'agile', 'scrum', 'figma', 'jira',
]);

const STOP_WORDS = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has',
    'her', 'was', 'one', 'our', 'out', 'day', 'get', 'use', 'how', 'will',
    'with', 'this', 'that', 'have', 'from', 'they', 'know', 'want', 'been',
    'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just',
    'like', 'long', 'make', 'many', 'more', 'only', 'over', 'such', 'take',
    'than', 'then', 'them', 'well', 'were', 'what', 'your', 'also', 'into',
    'work', 'able', 'each', 'role', 'team',
]);

// ── Text Extraction ───────────────────────────────────────────────────────────

/**
 * Walk resume data and collect all text content + bullet items.
 * Returns { allText: string, bulletItems: string[], sectionLabels: string[] }
 */
function extractResumeText(resumeData) {
    const { elements = [], sections = [] } = resumeData || {};
    const textParts = [];
    const bulletItems = [];
    const sectionLabels = [];

    const collectElement = (el) => {
        if (!el || el.type === 'line-break') return;
        if (el.type === 'bullets') {
            const items = el.bulletItems || [];
            items.forEach(b => {
                const s = String(b || '').trim();
                if (s) { textParts.push(s); bulletItems.push(s); }
            });
        } else if (el.content) {
            const s = String(el.content).trim();
            if (s) textParts.push(s);
        }
    };

    elements.forEach(collectElement);

    sections.forEach((section) => {
        const label = String(section.label || section.title || section.name || '').trim();
        if (label) sectionLabels.push(label.toLowerCase());

        (section.elements || []).forEach(collectElement);
        (section['sub-sections'] || []).forEach((ss) => {
            (ss.elements || []).forEach(collectElement);
        });
    });

    return {
        allText: textParts.join(' '),
        bulletItems,
        sectionLabels,
    };
}

// ── Individual Scorers ────────────────────────────────────────────────────────

function scoreContactInfo(allText, maxPoints) {
    const details = [];
    let score = 0;
    const emailShare   = Math.round(maxPoints * 0.33);
    const phoneShare   = Math.round(maxPoints * 0.33);
    const nameShare    = Math.round(maxPoints * 0.20);
    const locationShare = maxPoints - emailShare - phoneShare - nameShare;

    const hasEmail = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(allText);
    if (hasEmail) { score += emailShare; details.push('Email address found'); }
    else details.push('Email address missing');

    const hasPhone = /(\+?\d[\d\s\-().]{7,}\d)/.test(allText);
    if (hasPhone) { score += phoneShare; details.push('Phone number found'); }
    else details.push('Phone number missing');

    // Name heuristic: at least one token looks like a proper name (2+ words, first letters cap)
    const nameMatch = allText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/);
    if (nameMatch) { score += nameShare; details.push('Full name detected'); }
    else details.push('Full name not detected');

    const hasLocation = /\b(city|location|address|country|state|province|remote|street|zip|postal)\b/i.test(allText)
        || /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(allText);   // "City, ST" pattern
    if (hasLocation) { score += locationShare; details.push('Location/address found'); }
    else details.push('Location or address missing');

    return { score, max: maxPoints, label: 'Contact Information', details };
}

function scoreSections(sectionLabels, maxPoints) {
    const details = [];
    let score = 0;

    const matches = (keywords) =>
        sectionLabels.some(l => keywords.some(k => l.includes(k)));

    const expShare   = Math.round(maxPoints * 0.36);
    const eduShare   = Math.round(maxPoints * 0.28);
    const skillShare = maxPoints - expShare - eduShare;

    if (matches(['experience', 'work', 'employment', 'professional', 'career', 'history'])) {
        score += expShare; details.push('Experience section found');
    } else details.push('Experience section missing');

    if (matches(['education', 'academic', 'degree', 'university', 'college', 'school', 'qualification', 'study'])) {
        score += eduShare; details.push('Education section found');
    } else details.push('Education section missing');

    if (matches(['skill', 'technolog', 'tool', 'competenc', 'expertise', 'proficien', 'language', 'framework'])) {
        score += skillShare; details.push('Skills section found');
    } else details.push('Skills section missing');

    return { score, max: maxPoints, label: 'Section Coverage', details };
}

function scoreContentQuality(allText, bulletItems, sectionLabels, maxPoints) {
    const details = [];
    let score = 0;

    const verbShare    = Math.round(maxPoints * 0.40);
    const quantShare   = Math.round(maxPoints * 0.40);
    const summaryShare = maxPoints - verbShare - quantShare;

    // Action verbs
    const words = allText.toLowerCase().match(/\b[a-z]+\b/g) || [];
    const verbsFound = words.filter(w => ACTION_VERBS.has(w));
    const uniqueVerbs = [...new Set(verbsFound)];
    const verbRatio = Math.min(uniqueVerbs.length / 5, 1); // ≥5 unique verbs = full score
    const verbScore = Math.round(verbRatio * verbShare);
    score += verbScore;
    details.push(`${uniqueVerbs.length} action verb${uniqueVerbs.length !== 1 ? 's' : ''} found (need ≥5 for full marks)`);

    // Quantified achievements
    const quantMatches = allText.match(
        /\d+\s*(%|percent|users?|clients?|projects?|hours?|days?|months?|years?|k\b|M\b|\$|x\b|times?|team|member)/gi
    ) || [];
    const quantRatio = Math.min(quantMatches.length / 3, 1); // ≥3 = full score
    const quantScore = Math.round(quantRatio * quantShare);
    score += quantScore;
    details.push(`${quantMatches.length} quantified achievement${quantMatches.length !== 1 ? 's' : ''} found (need ≥3 for full marks)`);

    // Summary / objective section
    const hasSummary = sectionLabels.some(l =>
        ['summary', 'objective', 'profile', 'about', 'overview', 'introduction'].some(k => l.includes(k))
    );
    if (hasSummary) { score += summaryShare; details.push('Professional summary/objective present'); }
    else details.push('No summary or objective section found');

    return { score, max: maxPoints, label: 'Content Quality', details };
}

function scoreSkills(allText, sectionLabels, maxPoints) {
    const details = [];
    let score = 0;

    const countShare = Math.round(maxPoints * 0.60);
    const techShare  = maxPoints - countShare;

    // Estimate skill count: comma-separated or newline-separated items in skills section area
    const wordTokens = allText.toLowerCase().match(/\b[a-z.#+]{2,}\b/g) || [];
    const techFound = wordTokens.filter(w => TECH_KEYWORDS.has(w));
    const uniqueTech = [...new Set(techFound)];

    // Count skill-like tokens (rough heuristic: unique short technical words)
    const genericSkillCount = uniqueTech.length;
    const countRatio = Math.min(genericSkillCount / 8, 1); // ≥8 tech skills = full
    const countScore = Math.round(countRatio * countShare);
    score += countScore;
    details.push(`${genericSkillCount} technical skill${genericSkillCount !== 1 ? 's' : ''} detected (need ≥8 for full marks)`);

    if (uniqueTech.length > 0) {
        score += techShare;
        details.push(`Technical keywords found: ${uniqueTech.slice(0, 6).join(', ')}${uniqueTech.length > 6 ? '…' : ''}`);
    } else {
        details.push('No recognized technical keywords found');
    }

    return { score, max: maxPoints, label: 'Skills', details };
}

function scoreKeywords(allText, jobDescription, maxPoints) {
    const jdWords = jobDescription.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const uniqueJdWords = [...new Set(jdWords.filter(w => !STOP_WORDS.has(w)))];

    if (uniqueJdWords.length === 0) {
        return { score: 0, max: maxPoints, label: 'Keyword Match', matched: [], missing: [], details: ['Job description had no extractable keywords'] };
    }

    const resumeLower = allText.toLowerCase();
    const matched = [];
    const missing = [];

    uniqueJdWords.forEach(word => {
        if (resumeLower.includes(word)) matched.push(word);
        else missing.push(word);
    });

    const ratio = matched.length / uniqueJdWords.length;
    const score = Math.round(ratio * maxPoints);

    return {
        score,
        max: maxPoints,
        label: 'Keyword Match',
        matched: matched.slice(0, 20),
        missing: missing.slice(0, 20),
        details: [`${matched.length}/${uniqueJdWords.length} job description keywords matched`],
    };
}

// ── Suggestions Generator ─────────────────────────────────────────────────────

function buildSuggestions(breakdown) {
    const suggestions = [];

    const { contactInfo, sections, contentQuality, skills, keywords } = breakdown;

    // Contact suggestions
    if (contactInfo.details.some(d => d.includes('Email') && d.includes('missing')))
        suggestions.push('Add your email address to the contact section.');
    if (contactInfo.details.some(d => d.includes('Phone') && d.includes('missing')))
        suggestions.push('Include a phone number so recruiters can reach you.');
    if (contactInfo.details.some(d => d.includes('Location') && d.includes('missing')))
        suggestions.push('Add your city/country or specify "Remote" in the contact area.');
    if (contactInfo.details.some(d => d.includes('Full name') && d.includes('not')))
        suggestions.push('Make sure your full name appears prominently at the top.');

    // Section suggestions
    if (sections.details.some(d => d.includes('Experience') && d.includes('missing')))
        suggestions.push(`Add a Work Experience section — it's the most important section for ATS.`);
    if (sections.details.some(d => d.includes('Education') && d.includes('missing')))
        suggestions.push('Include an Education section with your degree and institution.');
    if (sections.details.some(d => d.includes('Skills') && d.includes('missing')))
        suggestions.push('Add a Skills section listing your technical and soft skills.');

    // Content quality suggestions
    if (contentQuality.details.some(d => d.includes('action verb') && d.includes('0')))
        suggestions.push('Start bullet points with strong action verbs (Led, Built, Improved, Designed…).');
    else if (contentQuality.score / contentQuality.max < 0.5 &&
             contentQuality.details.some(d => d.includes('action verb')))
        suggestions.push('Use more action verbs to open your experience bullet points.');

    if (contentQuality.details.some(d => d.includes('quantified') && d.includes('0')))
        suggestions.push('Add numbers to your achievements (e.g., "Reduced load time by 40%", "Managed team of 5").');
    else if (contentQuality.score / contentQuality.max < 0.5 &&
             contentQuality.details.some(d => d.includes('quantified')))
        suggestions.push('Quantify more achievements — use percentages, counts, or dollar amounts.');

    if (contentQuality.details.some(d => d.includes('No summary')))
        suggestions.push('Add a 2–3 sentence professional summary at the top of your resume.');

    // Skills suggestions
    if (skills.score / skills.max < 0.5)
        suggestions.push('Expand your skills section with more technical tools and technologies.');
    if (skills.details.some(d => d.includes('No recognized')))
        suggestions.push('List specific technologies (React, Python, SQL…) — ATS systems scan for these.');

    // Keyword suggestions
    if (keywords && keywords.missing.length > 0) {
        const topMissing = keywords.missing.slice(0, 5).join(', ');
        suggestions.push(`Your resume is missing these job-relevant keywords: ${topMissing}.`);
    }

    return suggestions;
}

// ── Grade ─────────────────────────────────────────────────────────────────────

function getGrade(score) {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    return 'D';
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Score a resume.
 * @param {object} resumeData - { elements, sections, canvasSettings }
 * @param {string} [jobDescription] - optional JD text for keyword matching
 * @returns {object} ATS score report
 */
export function scoreResume(resumeData, jobDescription = '') {
    const { allText, bulletItems, sectionLabels } = extractResumeText(resumeData);
    const hasJD = jobDescription.trim().length >= 20;

    let breakdown;

    if (hasJD) {
        // 5 categories: 15 + 20 + 25 + 15 + 25 = 100
        const contactInfo    = scoreContactInfo(allText, 15);
        const sections       = scoreSections(sectionLabels, 20);
        const contentQuality = scoreContentQuality(allText, bulletItems, sectionLabels, 25);
        const skills         = scoreSkills(allText, sectionLabels, 15);
        const keywords       = scoreKeywords(allText, jobDescription, 25);
        breakdown = { contactInfo, sections, contentQuality, skills, keywords };
    } else {
        // 4 categories: 20 + 25 + 30 + 25 = 100
        const contactInfo    = scoreContactInfo(allText, 20);
        const sections       = scoreSections(sectionLabels, 25);
        const contentQuality = scoreContentQuality(allText, bulletItems, sectionLabels, 30);
        const skills         = scoreSkills(allText, sectionLabels, 25);
        breakdown = { contactInfo, sections, contentQuality, skills };
    }

    const totalScore = Object.values(breakdown).reduce((sum, cat) => sum + cat.score, 0);
    const grade = getGrade(totalScore);
    const suggestions = buildSuggestions(breakdown);

    return { totalScore, grade, hasJD, breakdown, suggestions };
}