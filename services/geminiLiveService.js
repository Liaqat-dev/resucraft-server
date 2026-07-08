import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity } from '@google/genai';
import { spawn } from 'child_process';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
const ffmpegPath = _require('ffmpeg-static');

/** Transcode any audio buffer (M4A/AAC/WebM/OGG) to raw 16 kHz mono Int16 PCM. */
function transcodeToRawPCM(base64Input) {
    return new Promise((resolve, reject) => {
        const inputBuf = Buffer.from(base64Input, 'base64');
        const pcmChunks = [];
        const stderrChunks = [];

        const ff = spawn(ffmpegPath, [
            '-hide_banner', '-loglevel', 'error',
            '-i', 'pipe:0',
            '-f', 's16le',
            '-ar', '16000',
            '-ac', '1',
            'pipe:1',
        ]);

        ff.stdout.on('data', chunk => pcmChunks.push(chunk));
        ff.stdout.on('end', () => resolve(Buffer.concat(pcmChunks).toString('base64')));
        ff.stderr.on('data', chunk => stderrChunks.push(chunk));
        ff.on('error', reject);
        ff.on('close', (code) => {
            if (code !== 0) {
                const stderr = Buffer.concat(stderrChunks).toString();
                reject(new Error(`ffmpeg exited ${code}: ${stderr}`));
            }
        });
        ff.stdin.write(inputBuf);
        ff.stdin.end();
    });
}

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest';

export class GeminiLiveSession {
    constructor({ apiKey, systemPrompt, onAudio, onText, onUserText, onTurnComplete, onReady, onError, onClose }) {
        this.ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
        this.systemPrompt = systemPrompt;
        this.onAudio = onAudio;
        this.onText = onText;
        this.onUserText = onUserText;
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
                    inputAudioTranscription: {},   // enables STT for candidate speech
                    realtimeInputConfig: {
                        automaticActivityDetection: {
                            // Defaults (LOW/LOW) make Gemini wait for a long silence gap
                            // before it considers the candidate done talking — this is
                            // what makes replies feel like they take "forever".
                            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
                            silenceDurationMs: 500,
                        },
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

                        // Native audio model AI transcript (AI speech → text)
                        if (sc.outputTranscription?.text) {
                            this.onText?.(sc.outputTranscription.text);
                        }

                        // Candidate speech → text (requires inputAudioTranscription in config)
                        if (sc.inputTranscription?.text) {
                            this.onUserText?.(sc.inputTranscription.text);
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

    async sendAudio(base64Data, mimeType = 'audio/pcm;rate=16000') {
        if (!this.session) return;
        let pcm = base64Data;
        if (!mimeType || !mimeType.includes('pcm')) {
            try {
                pcm = await transcodeToRawPCM(base64Data);
            } catch (err) {
                console.error('[Transcode] Failed to convert audio to PCM:', err.message);
                return;
            }
        }

        // Session may have been closed while transcoding was in flight.
        if (!this.session) return;

        this.session.sendRealtimeInput({
            audio: { data: pcm, mimeType: 'audio/pcm;rate=16000' },
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
