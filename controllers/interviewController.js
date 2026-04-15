import jwt from 'jsonwebtoken';
import {GeminiLiveSession} from '#services/geminiLiveService.js';

function buildSystemPrompt(jobDescription, candidateProfile) {
    return `
You are a professional interviewer.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE PROFILE:
${candidateProfile}

Instructions:
- Tailor questions based on the candidate's experience.
- If the candidate gives a vague or incomplete answer, ask a follow-up question before moving on.
- Only proceed when you have enough detail.
- Focus on their actual projects and skills.
- Avoid generic questions if specific info is available.

Interview Structure:
1. Motivation (based on their background)
2. Experience deep-dive (based on projects)
3. Behavioral (STAR)
4. Problem-solving
5. Technical (based on stack)

Rules:
- Ask ONE question at a time.
- Ask follow-up questions when needed before moving on.
- Keep it natural and conversational.
`;
}

export function handleInterviewSocket(ws, req) {
    let gemini = null;
    let transcriptLines = [];
    let sessionStarted = false;
    let hadError = false;

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
                    return send({type: 'error', message: 'Job description is too short (min 20 chars).'});
                }

                // Verify JWT if provided
                if (msg.token) {
                    try {
                        jwt.verify(msg.token, process.env.JWT_SECRET);
                    } catch {
                        return send({type: 'error', message: 'Unauthorized.'});
                    }
                }

                gemini = new GeminiLiveSession({
                    apiKey: process.env.GEMINI_API_KEY,
                    systemPrompt: buildSystemPrompt(msg.jobDescription.trim()),

                    onAudio: (base64, mimeType) => {
                        send({type: 'audio_chunk', data: base64, mimeType});
                    },

                    onText: (text) => {
                        transcriptLines.push(`Interviewer: ${text}`);
                        send({type: 'transcript', speaker: 'ai', text});
                    },

                    onTurnComplete: () => send({type: 'turn_complete'}),

                    onReady: () => {
                        sessionStarted = true;
                        send({type: 'session_ready'});
                    },

                    onError: (err) => {
                        console.error('[Gemini Live] Error:', err.message);
                        hadError = true;
                        send({type: 'error', message: 'AI connection error. Please try again.'});
                    },

                    onClose: () => {
                        if (hadError) return;
                        if (!sessionStarted) {
                            send({type: 'error', message: 'Could not connect to AI interviewer. Please try again.'});
                            return;
                        }
                        send({type: 'session_ended'});
                    },
                });

                gemini.connect();
                break;
            }

            case 'audio_chunk': {
                if (msg.data) gemini?.sendAudio(msg.data, msg.mimeType);
                break;
            }

            case 'user_transcript': {
                if (msg.text) {
                    transcriptLines.push(`Candidate: ${msg.text}`);
                    send({type: 'transcript', speaker: 'user', text: msg.text});
                }
                break;
            }

            case 'end_interview': {
                gemini?.close();
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
