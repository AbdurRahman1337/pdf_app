import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export interface TTSOptions {
    rate?: number; // 0.5 to 2.0 (default 1.0)
    pitch?: number; // 0.5 to 2.0 (default 1.0)
    language?: string; // e.g. 'en-US', 'es-ES'
    onStart?: () => void;
    onDone?: () => void;
    onStopped?: () => void;
    onError?: (error: any) => void;
}

class TTSService {
    private isCurrentlySpeaking: boolean = false;
    private currentSpeechRate: number = 1.0;

    public async speak(text: string, options?: TTSOptions): Promise<void> {
        if (!text || !text.trim()) return;

        // Clean text: strip markdown symbols, asterisks, bullet points for smooth natural narration
        const cleanText = text
            .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
            .replace(/[#*`_~]/g, '')
            .replace(/•\s*/g, '. ')
            .replace(/\n+/g, '. ')
            .trim();

        try {
            // Stop any ongoing speech before starting new utterance
            await this.stop();

            this.isCurrentlySpeaking = true;
            if (options?.onStart) options.onStart();

            if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                // Web Speech API for seamless browser preview
                const utterance = new SpeechSynthesisUtterance(cleanText);
                utterance.rate = options?.rate ?? this.currentSpeechRate;
                utterance.pitch = options?.pitch ?? 1.0;
                utterance.lang = options?.language ?? 'en-US';

                utterance.onend = () => {
                    this.isCurrentlySpeaking = false;
                    if (options?.onDone) options.onDone();
                };
                utterance.onerror = (e) => {
                    this.isCurrentlySpeaking = false;
                    if (options?.onError) options.onError(e);
                };

                window.speechSynthesis.speak(utterance);
            } else {
                // Native iOS / Android via expo-speech
                Speech.speak(cleanText, {
                    rate: options?.rate ?? this.currentSpeechRate,
                    pitch: options?.pitch ?? 1.0,
                    language: options?.language ?? 'en-US',
                    onDone: () => {
                        this.isCurrentlySpeaking = false;
                        if (options?.onDone) options.onDone();
                    },
                    onStopped: () => {
                        this.isCurrentlySpeaking = false;
                        if (options?.onStopped) options.onStopped();
                    },
                    onError: (err) => {
                        this.isCurrentlySpeaking = false;
                        if (options?.onError) options.onError(err);
                    },
                });
            }
        } catch (error) {
            this.isCurrentlySpeaking = false;
            console.warn('TTS error:', error);
            if (options?.onError) options.onError(error);
        }
    }

    public async stop(): Promise<void> {
        this.isCurrentlySpeaking = false;
        try {
            if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            } else {
                await Speech.stop();
            }
        } catch (e) {
            // Ignore stop errors
        }
    }

    public async isSpeaking(): Promise<boolean> {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
            return window.speechSynthesis.speaking;
        }
        try {
            return await Speech.isSpeakingAsync();
        } catch {
            return this.isCurrentlySpeaking;
        }
    }

    public setRate(rate: number) {
        this.currentSpeechRate = Math.max(0.5, Math.min(2.0, rate));
    }

    public getRate(): number {
        return this.currentSpeechRate;
    }
}

export const ttsService = new TTSService();
export default ttsService;

