import jwt from 'jsonwebtoken';
import { GoogleGenAI } from '@google/genai';
import { GeminiLiveSession } from '#services/geminiLiveService.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const FEEDBACK_MODEL = 'gemini-2.5-flash';

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(jobDescription, candidateProfile) {
    const profileSection = candidateProfile?.trim()
        ? `CANDIDATE PROFILE:\n${candidateProfile.trim()}`
        : 'CANDIDATE PROFILE:\nNot provided — ask the candidate to briefly introduce themselves first.';

    return `You are a professional, senior interviewer conducting a real job interview.

JOB DESCRIPTION:
${jobDescription}

${profileSection}

Instructions:
- Tailor every question directly to the candidate's background and the role above.
- If the candidate gives a vague or incomplete answer, ask ONE targeted follow-up before moving on.
- Challenge senior-level answers — do not accept surface-level responses.
- Focus on their actual projects, past decisions, and real outcomes.
- Do NOT ask generic textbook questions if specific profile data is available.

Interview Structure (5 phases, one question at a time):
1. Warm-up / motivation — why this role, why now
2. Experience deep-dive — specific projects, contributions, challenges
3. Behavioral (STAR format) — past situations and how they handled them
4. Problem-solving — walk through a relevant scenario or trade-off decision
5. Technical — stack-specific depth based on the job requirements

Rules:
- Ask ONE question at a time.
- Wait for the candidate's response before proceeding.
- Keep the tone professional but conversational — this is a real interview, not a quiz.
- When you have covered all 5 phases, wrap up naturally and thank the candidate.
`;
}

// ── Feedback generation ───────────────────────────────────────────────────────

async function generateFeedback(transcriptLines, jobDescription, candidateProfile) {
    console.log(`[Feedback] Using model: ${FEEDBACK_MODEL}`);
    if (!transcriptLines.length) {
        return {
            overallScore: 0,
            communicationScore: 0,
            technicalScore: 0,
            relevanceScore: 0,
            strengths: [],
            improvements: ['The interview session was too short to evaluate.'],
            summary: 'No meaningful interview content was captured.',
        };
    }

    const transcript = transcriptLines.join('\n');

    const prompt = `You are an expert interview coach. Analyze the following interview transcript and return a structured performance assessment.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE PROFILE:
${candidateProfile?.trim() || 'Not provided'}

FULL INTERVIEW TRANSCRIPT:
${transcript}

Scoring criteria:
- overallScore (1–10): holistic performance considering all dimensions
- communicationScore (1–10): clarity, fluency, confidence, and how well answers were structured
- technicalScore (1–10): accuracy and depth of technical/domain answers relative to the role requirements
- relevanceScore (1–10): how directly and completely answers addressed what was actually asked

For strengths and improvements, be specific — reference actual moments or patterns from the transcript, not generic advice.

Return ONLY the JSON object, nothing else.`;

    const result = await ai.models.generateContent({
        model: FEEDBACK_MODEL,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'object',
                properties: {
                    overallScore:       { type: 'number' },
                    communicationScore: { type: 'number' },
                    technicalScore:     { type: 'number' },
                    relevanceScore:     { type: 'number' },
                    strengths:    { type: 'array', items: { type: 'string' } },
                    improvements: { type: 'array', items: { type: 'string' } },
                    summary:      { type: 'string' },
                },
                required: [
                    'overallScore', 'communicationScore', 'technicalScore',
                    'relevanceScore', 'strengths', 'improvements', 'summary',
                ],
            },
        },
    });

    return JSON.parse(result.text);
}
// ── WebSocket handler ─────────────────────────────────────────────────────────

export function handleInterviewSocket(ws, req) {
    let gemini = null;
    let transcriptLines = [];
    let sessionStarted = false;
    let hadError = false;
    let intentionalEnd = false;   // set when user triggers end_interview
    let jobDescription = '';
    let candidateProfile = '';
    let userTranscriptBuffer = '';  // accumulates streamed inputTranscription chunks

    function send(obj) {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
    }

    ws.on('message', async (rawData) => {
        let msg;
        try {
            msg = JSON.parse(rawData.toString());
        } catch {
            return;
        }

        switch (msg.type) {

            case 'start_session': {
                if (!msg.jobDescription || msg.jobDescription.trim().length < 20) {
                    return send({ type: 'error', message: 'Job description is too short (min 20 chars).' });
                }

                if (msg.token) {
                    try {
                        jwt.verify(msg.token, process.env.JWT_SECRET);
                    } catch {
                        return send({ type: 'error', message: 'Unauthorized.' });
                    }
                }

                jobDescription   = msg.jobDescription.trim();
                candidateProfile = msg.candidateProfile?.trim() ?? '';

                gemini = new GeminiLiveSession({
                    apiKey: process.env.GEMINI_API_KEY,
                    systemPrompt: buildSystemPrompt(jobDescription, candidateProfile),

                    onAudio: (base64, mimeType) => {
                        send({ type: 'audio_chunk', data: base64, mimeType });
                    },

                    onText: (text) => {
                        transcriptLines.push(`Interviewer: ${text}`);
                        send({ type: 'transcript', speaker: 'ai', text });
                    },

                    // Candidate speech transcribed by Gemini Live (inputAudioTranscription).
                    // Gemini streams these in small chunks (especially for non-Latin scripts),
                    // so accumulate and flush the full sentence on turnComplete.
                    onUserText: (text) => {
                        userTranscriptBuffer += text;
                    },

                    onTurnComplete: () => {
                        if (userTranscriptBuffer.trim()) {
                            const text = userTranscriptBuffer.trim();
                            userTranscriptBuffer = '';
                            transcriptLines.push(`Candidate: ${text}`);
                            send({ type: 'transcript', speaker: 'user', text });
                        }
                        send({ type: 'turn_complete' });
                    },

                    onReady: () => {
                        sessionStarted = true;
                        send({ type: 'session_ready' });
                    },

                    onError: (err) => {
                        console.error('[Gemini Live] Error:', err.message);
                        hadError = true;
                        send({ type: 'error', message: 'AI connection error. Please try again.' });
                    },

                    onClose: () => {
                        if (hadError) return;
                        if (intentionalEnd) return; // feedback message already handles this path
                        if (!sessionStarted) {
                            send({ type: 'error', message: 'Could not connect to AI interviewer. Please try again.' });
                            return;
                        }
                        send({ type: 'session_ended' });
                    },
                });

                gemini.connect();
                break;
            }

            case 'audio_chunk': {
                if (msg.data) gemini?.sendAudio(msg.data, msg.mimeType);
                break;
            }

            // Fallback: client can still push its own transcript text if it has STT
            case 'user_transcript': {
                if (msg.text) {
                    transcriptLines.push(`Candidate: ${msg.text}`);
                    send({ type: 'transcript', speaker: 'user', text: msg.text });
                }
                break;
            }

            case 'end_interview': {
                intentionalEnd = true;
                gemini?.close();
                gemini = null;

                send({ type: 'ending' });
                console.log(transcriptLines.join('\n'));

                try {
                    const feedbackData = await generateFeedback(
                        transcriptLines,
                        jobDescription,
                        candidateProfile,
                    );
                    send({ type: 'feedback', data: feedbackData });
                } catch (err) {
                    console.error('[Feedback] Generation failed:', err.message);
                    // Fall back gracefully — let the client know the session ended
                    // even if feedback couldn't be generated
                    send({
                        type: 'error',
                        message: 'Interview ended but feedback generation failed. Please try again.',
                    });
                }
                break;
            }
        }
    });

    ws.on('close', () => {
        gemini?.close();
        gemini = null;
    });

    ws.on('error', (err) => {
        console.error('[Client WS] Error:', err.message);
        gemini?.close();
    });
}








// import jwt from 'jsonwebtoken';
// import { GoogleGenAI } from '@google/genai';
// import { GeminiLiveSession } from '#services/geminiLiveService.js';
//
// const FEEDBACK_MODEL = 'gemini-2.5-flash';
//
// // ── System prompt ─────────────────────────────────────────────────────────────
//
// function buildSystemPrompt(jobDescription, candidateProfile) {
//     const profileSection = candidateProfile?.trim()
//         ? `CANDIDATE PROFILE:\n${candidateProfile.trim()}`
//         : 'CANDIDATE PROFILE:\nNot provided — ask the candidate to briefly introduce themselves first.';
//
//     return `You are a professional, senior interviewer conducting a real job interview.
//
// JOB DESCRIPTION:
// ${jobDescription}
//
// ${profileSection}
//
// Instructions:
// - Tailor every question directly to the candidate's background and the role above.
// - If the candidate gives a vague or incomplete answer, ask ONE targeted follow-up before moving on.
// - Challenge senior-level answers — do not accept surface-level responses.
// - Focus on their actual projects, past decisions, and real outcomes.
// - Do NOT ask generic textbook questions if specific profile data is available.
//
// Interview Structure (5 phases, one question at a time):
// 1. Warm-up / motivation — why this role, why now
// 2. Experience deep-dive — specific projects, contributions, challenges
// 3. Behavioral (STAR format) — past situations and how they handled them
// 4. Problem-solving — walk through a relevant scenario or trade-off decision
// 5. Technical — stack-specific depth based on the job requirements
//
// Rules:
// - Ask ONE question at a time.
// - Wait for the candidate's response before proceeding.
// - Keep the tone professional but conversational — this is a real interview, not a quiz.
// - When you have covered all 5 phases, wrap up naturally and thank the candidate.
// `;
// }
//
// // ── Feedback generation ───────────────────────────────────────────────────────
//
// async function generateFeedback(transcriptLines, jobDescription, candidateProfile) {
//     if (!transcriptLines.length) {
//         return {
//             overallScore: 0,
//             communicationScore: 0,
//             technicalScore: 0,
//             relevanceScore: 0,
//             strengths: [],
//             improvements: ['The interview session was too short to evaluate.'],
//             summary: 'No meaningful interview content was captured.',
//         };
//     }
//
//     const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' });
//
//     const transcript = transcriptLines.join('\n');
//
//     const prompt = `You are an expert interview coach. Analyze the following interview transcript and return a structured performance assessment.
//
// JOB DESCRIPTION:
// ${jobDescription}
//
// CANDIDATE PROFILE:
// ${candidateProfile?.trim() || 'Not provided'}
//
// FULL INTERVIEW TRANSCRIPT:
// ${transcript}
//
// Scoring criteria:
// - overallScore (1–10): holistic performance considering all dimensions
// - communicationScore (1–10): clarity, fluency, confidence, and how well answers were structured
// - technicalScore (1–10): accuracy and depth of technical/domain answers relative to the role requirements
// - relevanceScore (1–10): how directly and completely answers addressed what was actually asked
//
// For strengths and improvements, be specific — reference actual moments or patterns from the transcript, not generic advice.
//
// Return ONLY the JSON object, nothing else.`;
//
//     const result = await ai.models.generateContent({
//         model: FEEDBACK_MODEL,
//         contents: prompt,
//         config: {
//             responseMimeType: 'application/json',
//             responseSchema: {
//                 type: 'object',
//                 properties: {
//                     overallScore:       { type: 'number' },
//                     communicationScore: { type: 'number' },
//                     technicalScore:     { type: 'number' },
//                     relevanceScore:     { type: 'number' },
//                     strengths:    { type: 'array', items: { type: 'string' } },
//                     improvements: { type: 'array', items: { type: 'string' } },
//                     summary:      { type: 'string' },
//                 },
//                 required: [
//                     'overallScore', 'communicationScore', 'technicalScore',
//                     'relevanceScore', 'strengths', 'improvements', 'summary',
//                 ],
//             },
//         },
//     });
//
//     return JSON.parse(result.text);
// }
//
// // ── WebSocket handler ─────────────────────────────────────────────────────────
//
// export function handleInterviewSocket(ws, req) {
//     let gemini = null;
//     let transcriptLines = [];
//     let sessionStarted = false;
//     let hadError = false;
//     let intentionalEnd = false;   // set when user triggers end_interview
//     let jobDescription = '';
//     let candidateProfile = '';
//
//     function send(obj) {
//         if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
//     }
//
//     ws.on('message', async (rawData) => {
//         let msg;
//         try {
//             msg = JSON.parse(rawData.toString());
//         } catch {
//             return;
//         }
//
//         switch (msg.type) {
//
//             case 'start_session': {
//                 if (!msg.jobDescription || msg.jobDescription.trim().length < 20) {
//                     return send({ type: 'error', message: 'Job description is too short (min 20 chars).' });
//                 }
//
//                 if (msg.token) {
//                     try {
//                         jwt.verify(msg.token, process.env.JWT_SECRET);
//                     } catch {
//                         return send({ type: 'error', message: 'Unauthorized.' });
//                     }
//                 }
//
//                 jobDescription   = msg.jobDescription.trim();
//                 candidateProfile = msg.candidateProfile?.trim() ?? '';
//
//                 gemini = new GeminiLiveSession({
//                     apiKey: process.env.GEMINI_API_KEY,
//                     systemPrompt: buildSystemPrompt(jobDescription, candidateProfile),
//
//                     onAudio: (base64, mimeType) => {
//                         send({ type: 'audio_chunk', data: base64, mimeType });
//                     },
//
//                     onText: (text) => {
//                         transcriptLines.push(`Interviewer: ${text}`);
//                         send({ type: 'transcript', speaker: 'ai', text });
//                     },
//
//                     // Candidate speech transcribed by Gemini Live (inputAudioTranscription)
//                     onUserText: (text) => {
//                         transcriptLines.push(`Candidate: ${text}`);
//                         send({ type: 'transcript', speaker: 'user', text });
//                     },
//
//                     onTurnComplete: () => send({ type: 'turn_complete' }),
//
//                     onReady: () => {
//                         sessionStarted = true;
//                         send({ type: 'session_ready' });
//                     },
//
//                     onError: (err) => {
//                         console.error('[Gemini Live] Error:', err.message);
//                         hadError = true;
//                         send({ type: 'error', message: 'AI connection error. Please try again.' });
//                     },
//
//                     onClose: () => {
//                         if (hadError) return;
//                         if (intentionalEnd) return; // feedback message already handles this path
//                         if (!sessionStarted) {
//                             send({ type: 'error', message: 'Could not connect to AI interviewer. Please try again.' });
//                             return;
//                         }
//                         send({ type: 'session_ended' });
//                     },
//                 });
//
//                 gemini.connect();
//                 break;
//             }
//
//             case 'audio_chunk': {
//                 if (msg.data) gemini?.sendAudio(msg.data, msg.mimeType);
//                 break;
//             }
//
//             // Fallback: client can still push its own transcript text if it has STT
//             case 'user_transcript': {
//                 if (msg.text) {
//                     transcriptLines.push(`Candidate: ${msg.text}`);
//                     send({ type: 'transcript', speaker: 'user', text: msg.text });
//                 }
//                 break;
//             }
//
//             case 'end_interview': {
//                 intentionalEnd = true;
//                 gemini?.close();
//                 gemini = null;
//
//                 send({ type: 'ending' });
//
//                 try {
//                     const feedbackData = await generateFeedback(
//                         transcriptLines,
//                         jobDescription,
//                         candidateProfile,
//                     );
//                     send({ type: 'feedback', data: feedbackData });
//                 } catch (err) {
//                     console.error('[Feedback] Generation failed:', err.message);
//                     // Fall back gracefully — let the client know the session ended
//                     // even if feedback couldn't be generated
//                     send({
//                         type: 'error',
//                         message: 'Interview ended but feedback generation failed. Please try again.',
//                     });
//                 }
//                 break;
//             }
//         }
//     });
//
//     ws.on('close', () => {
//         gemini?.close();
//         gemini = null;
//     });
//
//     ws.on('error', (err) => {
//         console.error('[Client WS] Error:', err.message);
//         gemini?.close();
//     });
// }