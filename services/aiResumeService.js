import {GoogleGenAI} from '@google/genai';
import OpenAI from "openai";

const client = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function extractTextFields(templateData) {
    const fields = {};
    const { elements = [], sections = [] } = templateData;

    const addElement = (el, keyPrefix) => {
        if (el.type === 'line-break') return;
        if (el.type === 'bullets') {
            if (el.bulletItems && el.bulletItems.length > 0) {
                fields[`${keyPrefix}__bullets`] = el.bulletItems;
            }
        } else if (el.content && String(el.ai_description).trim()) {
            fields[keyPrefix] = String(el.ai_description);
        }
    // } else if (el.content && String(el.content).trim()) {
    //         fields[keyPrefix] = String(el.content);
    //     }
    };

    // Top-level elements (not inside any section)
    elements.forEach((el, eIdx) => addElement(el, `el__${eIdx}`));

    // Section elements and sub-section elements
    sections.forEach((section, sIdx) => {
        (section.elements || []).forEach((el, eIdx) =>
            addElement(el, `sec${sIdx}_el${eIdx}`)
        );

        (section['sub-sections'] || []).forEach((ss, ssIdx) => {
            (ss.elements || []).forEach((el, eIdx) =>
                addElement(el, `sec${sIdx}_ss${ssIdx}_el${eIdx}`)
            );
        });
    });

    return fields;
}


function applyFieldValues(templateData, values) {
    const data = JSON.parse(JSON.stringify(templateData));
    const { elements = [], sections = [] } = data;

    const applyElement = (el, keyPrefix) => {
        if (el.type === 'bullets') {
            const v = values[`${keyPrefix}__bullets`];
            if (Array.isArray(v) && v.length > 0) el.bulletItems = v;
        } else {
            const v = values[keyPrefix];
            if (v !== undefined) el.content = v;
        }
    };

    elements.forEach((el, eIdx) => applyElement(el, `el__${eIdx}`));

    sections.forEach((section, sIdx) => {
        (section.elements || []).forEach((el, eIdx) =>
            applyElement(el, `sec${sIdx}_el${eIdx}`)
        );

        (section['sub-sections'] || []).forEach((ss, ssIdx) => {
            (ss.elements || []).forEach((el, eIdx) =>
                applyElement(el, `sec${sIdx}_ss${ssIdx}_el${eIdx}`)
            );
        });
    });

    return data;
}

function buildPrompt(profile, jobDescription, fields) {
    const { personalInfo, education, experience, skills, projects, certificates } = profile;

    const educationText = education.length
        ? education.map(e =>
            `- ${e.degree}${e.fieldOfStudy ? ' in ' + e.fieldOfStudy : ''} at ${e.school} (${e.startDate} – ${e.endDate || 'Present'})${e.grade ? ', Grade: ' + e.grade : ''}${e.description ? '\n  ' + e.description : ''}`
        ).join('\n')
        : 'None';

    const experienceText = experience.length
        ? experience.map(e =>
            `- ${e.role} at ${e.company} (${e.startDate} – ${e.currentlyWorking ? 'Present' : (e.endDate || 'N/A')})${e.description ? '\n  ' + e.description : ''}`
        ).join('\n')
        : 'None';

    const skillsText = skills.length
        ? skills.map(s => `${s.name} (${s.category})`).join(', ')
        : 'None';

    const projectsText = projects.length
        ? projects.map(p =>
            `- ${p.title}${p.description ? ': ' + p.description : ''}${p.technologies?.length ? ' [' + p.technologies.join(', ') + ']' : ''}`
        ).join('\n')
        : 'None';

    const certsText = certificates.length
        ? certificates.map(c => `- ${c.name} by ${c.issuer} (${c.issueDate})`).join('\n')
        : 'None';

    return `You are an expert resume writer. Fill a resume template with content tailored to a specific job application.

## Candidate Profile
Name: ${personalInfo?.firstName || ''} ${personalInfo?.lastName || ''}
Profession: ${personalInfo?.profession || ''}
Email: ${personalInfo?.email || ''}
Phone: ${personalInfo?.phone || ''}
Address: ${personalInfo?.address || ''}
Bio: ${personalInfo?.bio || ''}
GitHub: ${personalInfo?.github || ''}
LinkedIn: ${personalInfo?.linkedin || ''}

Education:
${educationText}

Work Experience:
${experienceText}

Skills: ${skillsText}

Projects:
${projectsText}

Certificates:
${certsText}

## Target Job Description
${jobDescription}

## Template Fields to Fill
Each key identifies a text element in the resume template. The value is the current ai description text.

${JSON.stringify(fields, null, 2)}

## Instructions
Return ONLY a valid JSON object with the SAME keys. Replace each value with tailored content that:
- Matches the candidate's actual profile data
- Is optimized for the target job description
- Uses strong, professional language
- Keeps each field roughly the same length as the placeholder
- Does NOT invent qualifications not in the profile
- Returns ONLY the JSON object — no markdown, no code fences, no explanation

### Special rule for keys ending in "__bullets"
These fields represent bullet-point lists. Their current value is an array of strings.
- Return the value as a JSON **array of strings** (same format)
- Keep roughly the same number of items as the placeholder, or add more if the profile warrants it
- Each item should be a concise, action-oriented bullet point relevant to the candidate's profile and job description
- Example: ["Led cross-functional team of 8 engineers", "Reduced API latency by 40% via caching"]`;
}

/**
 * Main entry point: generates a filled copy of templateData tailored to the job description.
 */
export async function generateTailoredResume(templateData, jobDescription, profile) {
    const fields = extractTextFields(templateData);
    console.log(fields);

    if (Object.keys(fields).length === 0) {
        throw new Error('No fillable text fields found in this template');
    }

    const prompt = buildPrompt(profile, jobDescription, fields);
    //
    // const response = await ai.models.generateContentStream({
    //     model: 'gemini-2.5-flash',
    //     contents: [{ role: 'user', parts: [{ text: prompt }] }],
    //     config: { thinkingConfig: { thinkingBudget: 0 } },
    // });
    //  console.log("ai response", response);
    //
    // let fullText = '';
    // for await (const chunk of response) {
    //     fullText += chunk.text;
    // }
    //
    // // Strip markdown code fences in case Gemini wraps the response
    // const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    // if (!jsonMatch) {
    //     throw new Error('AI did not return a valid JSON response');
    // }

    const response = await client.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
        temperature: 1,
        top_p: 1,
        max_tokens: 4096,
        stream: true,
    });

    console.log("ai response", response);

    let fullText = "";

    for await (const chunk of response) {
        fullText += chunk.choices?.[0]?.delta?.content || "";
    }

// Strip markdown code fences in case model wraps JSON
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
        throw new Error("AI did not return a valid JSON response");
    }

    const parsedJson = JSON.parse(jsonMatch[0]);

    console.log(parsedJson);

    const values = JSON.parse(jsonMatch[0]);
    return applyFieldValues(templateData, values);
}
