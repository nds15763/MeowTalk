export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataCallback: ((buffer: Float32Array) => void) | null = null;
  private animationFrame: number | null = null;

  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // 立即停止，我们只是测试权限
      return true;
    } catch (error) {
      console.error('Permission denied or error:', error);
      return false;
    }
  }

  async start({ sampleRate, onData }: { sampleRate: number, onData: (buffer: Float32Array) => void }): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.audioContext = new AudioContext({ sampleRate });
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);
      
      this.dataCallback = onData;
      this.startAnalysis();
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  private startAnalysis() {
    const bufferLength = this.analyser!.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    
    const analyze = () => {
      this.analyser!.getFloatTimeDomainData(dataArray);
      if (this.dataCallback) {
        this.dataCallback(dataArray);
      }
      this.animationFrame = requestAnimationFrame(analyze);
    };
    
    this.animationFrame = requestAnimationFrame(analyze);
  }

  async stop(): Promise<void> {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.dataCallback = null;
  }
}

export default new AudioRecorder(); 