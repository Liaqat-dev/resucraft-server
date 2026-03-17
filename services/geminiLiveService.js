import { GoogleGenAI, Modality } from '@google/genai';

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest';

export class GeminiLiveSession {
    constructor({ apiKey, systemPrompt, onAudio, onText, onTurnComplete, onReady, onError, onClose }) {
        this.ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
        this.systemPrompt = systemPrompt;
        this.onAudio = onAudio;
        this.onText = onText;
        this.onTurnComplete = onTurnComplete;
        this.onReady = onReady;
        this.onError = onError;
        this.onClose = onClose;
        this.session = null;
    }

    async connect() {
        try {
            this.session = await this.ai.live.connect({
                model: LIVE_MODEL,
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: {
                        parts: [{ text: this.systemPrompt }],
                    },
                },
                callbacks: {
                    onopen: () => {
                        // session is assigned after connect() resolves — greeting sent there
                    },
                    onmessage: (msg) => {
                        // msg is an already-parsed LiveServerMessage object from the SDK
                        const sc = msg.serverContent;
                        if (!sc) return;

                        // Audio via audioChunks (native audio model)
                        if (sc.audioChunks?.length) {
                            for (const chunk of sc.audioChunks) {
                                this.onAudio?.(chunk.data, chunk.mimeType ?? 'audio/pcm;rate=24000');
                            }
                        }

                        // Audio + text parts from modelTurn
                        const parts = sc.modelTurn?.parts ?? [];
                        for (const part of parts) {
                            if (part.inlineData?.data) {
                                this.onAudio?.(part.inlineData.data, part.inlineData.mimeType ?? 'audio/pcm;rate=24000');
                            }
                            if (part.text) {
                                this.onText?.(part.text);
                            }
                        }

                        // Native audio model AI transcript
                        if (sc.outputTranscription?.text) {
                            this.onText?.(sc.outputTranscription.text);
                        }

                        if (sc.turnComplete) {
                            this.onTurnComplete?.();
                        }
                    },
                    onerror: (event) => {
                        console.error('[Gemini Live] error:', event);
                        this.onError?.(new Error(event?.message ?? 'WebSocket error'));
                    },
                    onclose: (event) => {
                        console.error('[Gemini WS] closed — code:', event?.code, 'reason:', event?.reason);
                        this.onClose?.();
                    },
                },
            });
            // Session is now assigned — notify ready and kick off the interview
            this.onReady?.();
            this.session.sendClientContent({
                turns: 'Please greet the candidate warmly and ask your first interview question.',
                turnComplete: true,
            });
        } catch (err) {
            console.error('[Gemini Live] connect failed:', err.message);
            this.onError?.(err);
        }
    }

    sendAudio(base64PCM) {
        if (!this.session) return;
        this.session.sendRealtimeInput({
            audio: { data: base64PCM, mimeType: 'audio/pcm;rate=16000' },
        });
    }

    sendText(text) {
        if (!this.session) return;
        this.session.sendClientContent({
            turns: text,
            turnComplete: true,
        });
    }

    close() {
        this.session?.close();
        this.session = null;
    }
}
