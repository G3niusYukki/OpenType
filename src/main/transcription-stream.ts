import { EventEmitter } from 'events';
import { TranscriptionService, TranscriptionResult } from './transcription';

export interface TranscriptionChunk {
  text: string;
  isPartial: boolean;
  confidence?: number;
  startTime: number;
  endTime: number;
}

export interface StreamConfig {
  chunkDurationMs: number;
  overlapMs: number;
  language?: string;
}

export class TranscriptionStream extends EventEmitter {
  private transcriptionService: TranscriptionService;
  private config: StreamConfig;
  private audioChunks: Buffer[] = [];
  private isStreaming: boolean = false;
  private streamInterval: NodeJS.Timeout | null = null;
  private accumulatedText: string = '';

  constructor(
    transcriptionService: TranscriptionService,
    config: Partial<StreamConfig> = {}
  ) {
    super();
    this.transcriptionService = transcriptionService;
    this.config = {
      chunkDurationMs: 3000,
      overlapMs: 500,
      ...config
    };
  }

  start(): void {
    if (this.isStreaming) return;
    
    this.isStreaming = true;
    this.audioChunks = [];
    this.accumulatedText = '';
    
    this.emit('started');
    
    // Process chunks periodically
    this.streamInterval = setInterval(() => {
      this.processChunk();
    }, this.config.chunkDurationMs);
  }

  stop(): void {
    if (!this.isStreaming) return;
    
    this.isStreaming = false;
    
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }
    
    // Process any remaining audio
    this.processFinalChunk();
    
    this.emit('stopped', this.accumulatedText);
  }

  addAudioChunk(chunk: Buffer): void {
    if (!this.isStreaming) return;
    this.audioChunks.push(chunk);
  }

  private async processChunk(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    try {
      // Combine chunks into a single buffer
      const audioBuffer = Buffer.concat(this.audioChunks);
      
      // Clear processed chunks (keep overlap)
      const overlapBytes = Math.floor(
        (this.config.overlapMs / 1000) * 16000 * 2 // 16kHz, 16-bit
      );
      
      if (audioBuffer.length > overlapBytes) {
        this.audioChunks = [audioBuffer.slice(-overlapBytes)];
      }

      // Create temporary file for transcription
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');
      
      const tempFile = path.join(os.tmpdir(), `stream-${Date.now()}.wav`);
      
      // Write WAV header + audio data
      const wavBuffer = this.createWavBuffer(audioBuffer);
      fs.writeFileSync(tempFile, wavBuffer);

      try {
        // Transcribe the chunk
        const result = await this.transcriptionService.transcribe(tempFile);
        
        if (result.success && result.text) {
          // Extract new text (remove overlap from previous transcription)
          const newText = this.extractNewText(result.text);
          
          if (newText) {
            this.accumulatedText += (this.accumulatedText ? ' ' : '') + newText;
            
            this.emit('partial', {
              text: this.accumulatedText,
              isPartial: true,
              startTime: Date.now() - this.config.chunkDurationMs,
              endTime: Date.now()
            } as TranscriptionChunk);
          }
        }
      } finally {
        // Cleanup temp file
        try {
          fs.unlinkSync(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.error('[TranscriptionStream] Error processing chunk:', error);
      this.emit('error', error);
    }
  }

  private async processFinalChunk(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    try {
      const audioBuffer = Buffer.concat(this.audioChunks);
      
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');
      
      const tempFile = path.join(os.tmpdir(), `stream-final-${Date.now()}.wav`);
      const wavBuffer = this.createWavBuffer(audioBuffer);
      fs.writeFileSync(tempFile, wavBuffer);

      try {
        const result = await this.transcriptionService.transcribe(tempFile);
        
        if (result.success && result.text) {
          const newText = this.extractNewText(result.text);
          if (newText) {
            this.accumulatedText += (this.accumulatedText ? ' ' : '') + newText;
          }
        }

        this.emit('final', {
          text: this.accumulatedText,
          isPartial: false,
          startTime: 0,
          endTime: Date.now()
        } as TranscriptionChunk);
      } finally {
        try {
          fs.unlinkSync(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.error('[TranscriptionStream] Error processing final chunk:', error);
      this.emit('error', error);
    }
  }

  private createWavBuffer(audioData: Buffer): Buffer {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = audioData.length;
    const fileSize = 36 + dataSize;

    const header = Buffer.alloc(44);
    
    // RIFF chunk
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);
    
    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20); // AudioFormat (PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    
    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    return Buffer.concat([header, audioData]);
  }

  private extractNewText(currentText: string): string {
    // Simple implementation: check if current text contains accumulated text
    if (!this.accumulatedText) {
      return currentText;
    }

    // Find overlap and return only new portion
    const accumulatedWords = this.accumulatedText.split(' ');
    const currentWords = currentText.split(' ');
    
    // Find where accumulated text ends in current text
    let overlapIndex = 0;
    for (let i = 0; i <= currentWords.length - accumulatedWords.length; i++) {
      const slice = currentWords.slice(i, i + accumulatedWords.length).join(' ');
      if (slice === this.accumulatedText) {
        overlapIndex = i + accumulatedWords.length;
        break;
      }
    }
    
    return currentWords.slice(overlapIndex).join(' ');
  }
}
