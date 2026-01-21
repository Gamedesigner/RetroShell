const STORAGE_KEY_SOUND = 'retro-shell-sound-enabled';

export class SoundManager {
    private audioContext: AudioContext | null = null;
    private keyClickBuffer: AudioBuffer | null = null;
    private beepBuffer: AudioBuffer | null = null;
    private enabled: boolean = true;
    private volume: number = 0.3;

    constructor() {
        // Load saved preference
        const saved = localStorage.getItem(STORAGE_KEY_SOUND);
        this.enabled = saved !== 'false'; // Default to enabled
    }

    // Lazy init audio context (must be after user interaction)
    private ensureAudioContext(): AudioContext | null {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                this.createBuffers();
            } catch (e) {
                return null;
            }
        }
        // Resume if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    }

    private createBuffers() {
        if (!this.audioContext) return;
        
        // Key click - a very short tick sound
        const clickDuration = 0.015; // 15ms for snappier response
        const clickSampleRate = this.audioContext.sampleRate;
        this.keyClickBuffer = this.audioContext.createBuffer(1, clickSampleRate * clickDuration, clickSampleRate);
        const clickData = this.keyClickBuffer.getChannelData(0);
        
        // Generate a click sound (short burst of noise with fast decay)
        for (let i = 0; i < this.keyClickBuffer.length; i++) {
            const t = i / clickSampleRate;
            const envelope = Math.exp(-t * 300); // Very fast decay
            clickData[i] = (Math.random() * 2 - 1) * envelope * 0.5;
        }
        
        // Beep - classic PC speaker beep
        const beepDuration = 0.15; // 150ms
        const beepFrequency = 800; // Hz
        this.beepBuffer = this.audioContext.createBuffer(1, clickSampleRate * beepDuration, clickSampleRate);
        const beepData = this.beepBuffer.getChannelData(0);
        
        // Generate a square wave beep with envelope
        for (let i = 0; i < this.beepBuffer.length; i++) {
            const t = i / clickSampleRate;
            const envelope = Math.min(1, Math.min(t * 50, (beepDuration - t) * 50));
            const wave = Math.sin(2 * Math.PI * beepFrequency * t) > 0 ? 1 : -1;
            beepData[i] = wave * envelope * 0.3;
        }
    }

    private playBuffer(buffer: AudioBuffer | null): void {
        const ctx = this.ensureAudioContext();
        if (!ctx || !buffer) return;
        
        // Create a new buffer source for each play (they're one-shot)
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        
        // Create gain node for volume control
        const gainNode = ctx.createGain();
        gainNode.gain.value = this.volume;
        
        // Connect: source -> gain -> destination
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Play immediately
        source.start(0);
    }

    playKeyClick(): void {
        if (!this.enabled) return;
        
        const ctx = this.ensureAudioContext();
        if (!ctx) return;
        
        // Generate a unique click sound each time for natural variation
        const duration = 0.012 + Math.random() * 0.008; // 12-20ms variation
        const sampleRate = ctx.sampleRate;
        const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        // Randomize click characteristics
        const decayRate = 250 + Math.random() * 150; // 250-400 decay speed
        const clickType = Math.random(); // Determines click character
        const pitchVariation = 0.8 + Math.random() * 0.4; // 0.8-1.2 pitch multiplier
        const attackSharpness = 0.3 + Math.random() * 0.4; // 0.3-0.7 initial transient
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * decayRate);
            
            let sample: number;
            if (clickType < 0.33) {
                // Noise-based click (like a mechanical switch)
                sample = (Math.random() * 2 - 1) * envelope;
            } else if (clickType < 0.66) {
                // Tonal click (like a key bottoming out)
                const freq = (2000 + Math.random() * 1000) * pitchVariation;
                sample = Math.sin(2 * Math.PI * freq * t) * envelope;
                // Add some noise for texture
                sample += (Math.random() * 2 - 1) * envelope * 0.3;
            } else {
                // Mixed click (combination)
                const freq = (1500 + Math.random() * 500) * pitchVariation;
                const tonal = Math.sin(2 * Math.PI * freq * t);
                const noise = Math.random() * 2 - 1;
                sample = (tonal * 0.6 + noise * 0.4) * envelope;
            }
            
            // Sharp attack transient at the very start
            if (i < sampleRate * 0.002) {
                sample += (Math.random() * 2 - 1) * attackSharpness * (1 - i / (sampleRate * 0.002));
            }
            
            data[i] = sample * 0.5;
        }
        
        // Play the generated buffer
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = ctx.createGain();
        gainNode.gain.value = this.volume * (0.85 + Math.random() * 0.3); // Volume variation too
        
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
    }

    playKeyDelete(): void {
        if (!this.enabled) return;
        
        const ctx = this.ensureAudioContext();
        if (!ctx) return;
        
        // Generate a click sound and play it backwards for a subtle "unclick"
        const duration = 0.015 + Math.random() * 0.008;
        const sampleRate = ctx.sampleRate;
        const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        const decayRate = 200 + Math.random() * 100;
        const pitchVariation = 0.7 + Math.random() * 0.3;
        
        const tempData: number[] = [];
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * decayRate);
            const freq = (1200 + Math.random() * 400) * pitchVariation;
            const tonal = Math.sin(2 * Math.PI * freq * t);
            const noise = Math.random() * 2 - 1;
            let sample = (tonal * 0.5 + noise * 0.5) * envelope;
            if (i < sampleRate * 0.002) {
                sample += (Math.random() * 2 - 1) * 0.3 * (1 - i / (sampleRate * 0.002));
            }
            tempData.push(sample * 0.35);
        }
        
        // Reverse the sound
        for (let i = 0; i < buffer.length; i++) {
            data[i] = tempData[buffer.length - 1 - i];
        }
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.value = this.volume * (0.6 + Math.random() * 0.2);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
    }

    playSpacebar(): void {
        if (!this.enabled) return;
        
        const ctx = this.ensureAudioContext();
        if (!ctx) return;
        
        // Spacebar: deeper/lower pitch click
        const duration = 0.018 + Math.random() * 0.01;
        const sampleRate = ctx.sampleRate;
        const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        const decayRate = 180 + Math.random() * 100; // Slower decay
        const clickType = Math.random();
        const pitchVariation = 0.55 + Math.random() * 0.25; // Much lower pitch range
        const attackSharpness = 0.3 + Math.random() * 0.4;
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * decayRate);
            
            let sample: number;
            if (clickType < 0.33) {
                sample = (Math.random() * 2 - 1) * envelope;
            } else if (clickType < 0.66) {
                const freq = (1400 + Math.random() * 600) * pitchVariation;
                sample = Math.sin(2 * Math.PI * freq * t) * envelope;
                sample += (Math.random() * 2 - 1) * envelope * 0.3;
            } else {
                const freq = (1000 + Math.random() * 400) * pitchVariation;
                const tonal = Math.sin(2 * Math.PI * freq * t);
                const noise = Math.random() * 2 - 1;
                sample = (tonal * 0.6 + noise * 0.4) * envelope;
            }
            
            if (i < sampleRate * 0.002) {
                sample += (Math.random() * 2 - 1) * attackSharpness * (1 - i / (sampleRate * 0.002));
            }
            
            data[i] = sample * 0.5;
        }
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.value = this.volume * (0.9 + Math.random() * 0.25);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
    }

    playReturn(): void {
        if (!this.enabled) return;
        
        const ctx = this.ensureAudioContext();
        if (!ctx) return;
        
        // Enter: deeper than spacebar, played backwards
        const duration = 0.02 + Math.random() * 0.01;
        const sampleRate = ctx.sampleRate;
        const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        const decayRate = 160 + Math.random() * 80; // Slower decay for deeper sound
        const clickType = Math.random();
        const pitchVariation = 0.45 + Math.random() * 0.25; // Deeper than spacebar
        const attackSharpness = 0.3 + Math.random() * 0.4;
        
        // Generate forward first
        const tempData: number[] = [];
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * decayRate);
            
            let sample: number;
            if (clickType < 0.33) {
                sample = (Math.random() * 2 - 1) * envelope;
            } else if (clickType < 0.66) {
                const freq = (1200 + Math.random() * 500) * pitchVariation;
                sample = Math.sin(2 * Math.PI * freq * t) * envelope;
                sample += (Math.random() * 2 - 1) * envelope * 0.3;
            } else {
                const freq = (900 + Math.random() * 350) * pitchVariation;
                const tonal = Math.sin(2 * Math.PI * freq * t);
                const noise = Math.random() * 2 - 1;
                sample = (tonal * 0.6 + noise * 0.4) * envelope;
            }
            
            if (i < sampleRate * 0.002) {
                sample += (Math.random() * 2 - 1) * attackSharpness * (1 - i / (sampleRate * 0.002));
            }
            
            tempData.push(sample * 0.55);
        }
        
        // Reverse it
        for (let i = 0; i < buffer.length; i++) {
            data[i] = tempData[buffer.length - 1 - i];
        }
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.value = this.volume * (0.95 + Math.random() * 0.25);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
    }

    playBeep(): void {
        if (!this.enabled) return;
        this.playBuffer(this.beepBuffer);
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        localStorage.setItem(STORAGE_KEY_SOUND, String(enabled));
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
    }
}

// Singleton instance
export const soundManager = new SoundManager();
