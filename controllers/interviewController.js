import jwt from 'jsonwebtoken';
import { GeminiLiveSession } from '#services/geminiLiveService.js';

function buildSystemPrompt(jobDescription) {
    return `You are a professional job interviewer conducting a mock interview for the following position:

${jobDescription}

Guidelines:
- Ask exactly 5 questions covering: (1) motivation/background, (2) a relevant skill or experience, (3) a behavioral question (STAR method), (4) a problem-solving or situational question, (5) one role-specific technical question.
- Ask ONE question at a time. Wait for the candidate to finish before proceeding.
- Give a brief 1-sentence acknowledgment before each new question (e.g., "Great, thank you.").
- After the candidate answers question 5, say: "That concludes our interview. Thank you for your time — I'll now compile your feedback."
- Do not reveal you are an AI or mention Gemini.
- Be professional, concise, and encouraging.
- Speak naturally — this is a live voice interview.`;
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
        try { msg = JSON.parse(rawData.toString()); }
        catch { return; }

        switch (msg.type) {

            case 'start_session': {
                if (!msg.jobDescription || msg.jobDescription.trim().length < 20) {
                    return send({ type: 'error', message: 'Job description is too short (min 20 chars).' });
                }

                // Verify JWT if provided
                if (msg.token) {
                    try { jwt.verify(msg.token, process.env.JWT_SECRET); }
                    catch { return send({ type: 'error', message: 'Unauthorized.' }); }
                }

                gemini = new GeminiLiveSession({
                    apiKey: process.env.GEMINI_API_KEY,
                    systemPrompt: buildSystemPrompt(msg.jobDescription.trim()),

                    onAudio: (base64, mimeType) => {
                        send({ type: 'audio_chunk', data: base64, mimeType });
                    },

                    onText: (text) => {
                        transcriptLines.push(`Interviewer: ${text}`);
                        send({ type: 'transcript', speaker: 'ai', text });
                    },

                    onTurnComplete: () => send({ type: 'turn_complete' }),

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
                if (msg.data) gemini?.sendAudio(msg.data);
                break;
            }

            case 'user_transcript': {
                if (msg.text) {
                    transcriptLines.push(`Candidate: ${msg.text}`);
                    send({ type: 'transcript', speaker: 'user', text: msg.text });
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
