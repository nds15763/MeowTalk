/**
 * u97f3u9891u5904u7406u5de5u5177u7c7b
 * u63d0u4f9bu97f3u9891u7279u5f81u63d0u53d6u548cu732bu53ebu5224u65adu529fu80fd
 */

import { AudioFeatures } from './audioTypes';
import sampleLibrary from './new_sample_library.json';

// u9759u9ed8u68c0u6d4bu914du7f6e
const SILENCE_THRESHOLD = 0.02;
const MIN_SILENCE_TIME = 0.3; // u79d2
const MIN_PROCESS_TIME = 1.0; // u79d2
const MAX_BUFFER_TIME = 5.0; // u79d2

/**
 * u97f3u9891u5904u7406u5668u7c7b
 */
export class AudioProcessor {
  private audioBuffer: Float32Array = new Float32Array();
  private sampleRate: number;
  private minSilenceTime: number;
  private silenceThreshold: number;
  private minProcessTime: number;
  private maxBufferTime: number;
  private lastProcessTime: number;

  constructor(options?: {
    sampleRate?: number;
    silenceThreshold?: number;
    minSilenceTime?: number;
    minProcessTime?: number;
    maxBufferTime?: number;
  }) {
    this.sampleRate = options?.sampleRate || 44100;
    this.silenceThreshold = options?.silenceThreshold || SILENCE_THRESHOLD;
    this.minSilenceTime = options?.minSilenceTime || MIN_SILENCE_TIME;
    this.minProcessTime = options?.minProcessTime || MIN_PROCESS_TIME;
    this.maxBufferTime = options?.maxBufferTime || MAX_BUFFER_TIME;
    this.lastProcessTime = Date.now();
  }

  /**
   * u6dfbu52a0u97f3u9891u6570u636eu5230u7f13u51b2u533a
   */
  public addAudioData(data: Float32Array): void {
    // u521bu5efau65b0u7f13u51b2u533au5e76u590du5236u6570u636e
    const newBuffer = new Float32Array(this.audioBuffer.length + data.length);
    newBuffer.set(this.audioBuffer, 0);
    newBuffer.set(data, this.audioBuffer.length);
    this.audioBuffer = newBuffer;

    // u68c0u67e5u7f13u51b2u533au662fu5426u8d85u8fc7u6700u5927u957fu5ea6uff0cu5982u679cu662fu5219u4fddu7559u6700u540eu90e8u5206
    const maxSamples = this.maxBufferTime * this.sampleRate;
    if (this.audioBuffer.length > maxSamples) {
      this.audioBuffer = this.audioBuffer.slice(-maxSamples);
    }
  }

  /**
   * u5224u65adu662fu5426u9700u8981u5904u7406u97f3u9891
   */
  public shouldProcessAudio(): boolean {
    const bufferDuration = this.audioBuffer.length / this.sampleRate;
    const timeSinceLastProcess = (Date.now() - this.lastProcessTime) / 1000;

    // u68c0u67e5u662fu5426u68c0u6d4bu5230u9759u9ed8
    const [segments, silenceDetected] = this.detectSilence(this.audioBuffer);

    // u6761u4ef61: u68c0u6d4bu5230u9759u9ed8u4e14u6709u8db3u591fu7684u7247u6bb5
    if (silenceDetected && segments.length > 0) {
      return true;
    }

    // u6761u4ef62: u7f13u51b2u533au8fbeu5230u6700u5927u7f13u51b2u65f6u95f4
    if (bufferDuration >= this.maxBufferTime) {
      return true;
    }

    // u6761u4ef63: u8fbeu5230u6700u5c0fu5904u7406u65f6u95f4u4e14u8dddu79bbu4e0au6b21u5904u7406u8db3u591fu957f
    if (bufferDuration >= this.minProcessTime && timeSinceLastProcess >= 0.5) {
      return true;
    }

    return false;
  }

  /**
   * u5904u7406u97f3u9891u6570u636e
   * u8fd4u56deu662fu5426u4e3au732bu53ebu58f0u4ee5u53cau76f8u5173u7279u5f81
   */
  public processAudio(): { isMeow: boolean; emotion?: string; confidence?: number; features: AudioFeatures } {
    // u63d0u53d6u97f3u9891u7279u5f81
    const features = this.extractAudioFeatures(this.audioBuffer);

    // u5224u65adu662fu5426u4e3au732bu53eb
    const isMeow = this.isCatMeow(features);

    // u5982u679cu662fu732bu53ebuff0cu5219u8bc6u522bu60c5u611f
    let emotion: string | undefined;
    let confidence: number | undefined;

    if (isMeow) {
      const result = this.recognizeEmotionWithSamples(features);
      emotion = result.emotion;
      confidence = result.confidence;
    }

    // u4fddu7559u90e8u5206u7f13u51b2u533au4ee5u4fddu6301u8fdeu7eedu6027
    const retainSamples = Math.floor(0.5 * this.sampleRate); // u4fddu75090.5u79d2
    if (this.audioBuffer.length > retainSamples) {
      this.audioBuffer = this.audioBuffer.slice(-retainSamples);
    }

    // u66f4u65b0u5904u7406u65f6u95f4
    this.lastProcessTime = Date.now();

    // u786eu4fddu8fd4u56deu7684u97f3u9891u7279u5f81u683cu5f0fu4e0eu6240u9700u683cu5f0fu4e00u81f4
    return { 
      isMeow, 
      emotion, 
      confidence, 
      features: {
        Duration: features.Duration,
        Energy: features.Energy,
        RootMeanSquare: features.RootMeanSquare,
        ZeroCrossRate: features.ZeroCrossRate,
        PeakFreq: features.PeakFreq,
        FundamentalFreq: features.FundamentalFreq,
        Pitch: features.Pitch,
        SpectralCentroid: features.SpectralCentroid,
        SpectralRolloff: features.SpectralRolloff
      } 
    };
  }

  /**
   * u68c0u6d4bu9759u9ed8u6bb5
   * u8fd4u56de[u97f3u9891u7247u6bb5, u662fu5426u68c0u6d4bu5230u9759u9ed8]
   */
  private detectSilence(data: Float32Array): [Float32Array[], boolean] {
    const segments: Float32Array[] = [];
    const minSilenceSamples = Math.floor(this.minSilenceTime * this.sampleRate);
    
    let silenceStart = -1;
    let segmentStart = 0;
    let consecutiveSilentSamples = 0;
    let silenceDetected = false;
    
    // u904du5386u97f3u9891u6837u672c
    for (let i = 0; i < data.length; i++) {
      const amplitude = Math.abs(data[i]);
      
      // u68c0u67e5u662fu5426u4e3au9759u9ed8u6837u672c
      if (amplitude < this.silenceThreshold) {
        if (silenceStart === -1) {
          silenceStart = i;
        }
        consecutiveSilentSamples++;
      } else {
        // u5982u679cu4e0du662fu9759u9ed8u6837u672cuff0cu91cdu7f6eu8ba1u6570
        silenceStart = -1;
        consecutiveSilentSamples = 0;
      }
      
      // u68c0u67e5u662fu5426u8fbeu5230u6700u5c0fu9759u9ed8u65f6u95f4
      if (consecutiveSilentSamples >= minSilenceSamples) {
        // u9759u9ed8u65f6u95f4u8fbeu5230u9608u503cuff0cu7ed3u675fu5f53u524du6bb5
        silenceDetected = true;
        
        // u4eceu6bb5u843du5f00u59cbu5230u9759u9ed8u5f00u59cbuff0cu521bu5efau4e00u4e2au6709u6548u7684u97f3u9891u6bb5
        const segmentEnd = silenceStart;
        const segmentLength = segmentEnd - segmentStart;
        
        // u53eau4fddu7559u8db3u591fu957fu5ea6u7684u6bb5uff08u8d85u8fc70.2u79d2uff09
        const minSegmentLength = 0.2 * this.sampleRate;
        if (segmentLength > minSegmentLength) {
          const segment = data.slice(segmentStart, segmentEnd);
          segments.push(segment);
        }
        
        // u66f4u65b0u6bb5u843du5f00u59cbu4f4du7f6e
        segmentStart = i + 1;
        consecutiveSilentSamples = 0;
        silenceStart = -1;
      }
    }
    
    // u5904u7406u6700u540eu4e00u4e2au6bb5u843d
    if (segmentStart < data.length) {
      const segmentLength = data.length - segmentStart;
      const minSegmentLength = 0.2 * this.sampleRate;
      
      if (segmentLength > minSegmentLength) {
        const segment = data.slice(segmentStart);
        segments.push(segment);
      }
    }
    
    return [segments, silenceDetected];
  }

  /**
   * u63d0u53d6u97f3u9891u7279u5f81
   */
  private extractAudioFeatures(data: Float32Array): AudioFeatures {
    // u5e94u7528u6c49u660eu7a97
    const windowedData = this.applyHammingWindow(data);
    
    // u8ba1u7b97u57fau672cu7279u5f81
    const energy = this.calculateEnergy(windowedData);
    const zeroCrossRate = this.calculateZeroCrossRate(windowedData);
    const rms = Math.sqrt(energy / windowedData.length);
    
    // u8ba1u7b97u9891u57dfu7279u5f81
    const spectrum = this.calculateSpectrum(windowedData);
    const spectralCentroid = this.calculateSpectralCentroid(spectrum);
    const spectralRolloff = this.calculateSpectralRolloff(spectrum);
    const peakFreq = this.calculatePeakFrequency(windowedData);
    const fundamentalFreq = this.estimateFundamentalFrequency(windowedData);
    
    // u97f3u9ad8u4f30u8ba1
    const pitch = fundamentalFreq > 0 ? fundamentalFreq : peakFreq;
    
    // u65f6u957fu7279u5f81
    const duration = data.length / this.sampleRate;
    
    return {
      Duration: duration,
      Energy: energy,
      RootMeanSquare: rms,
      ZeroCrossRate: zeroCrossRate,
      PeakFreq: peakFreq,
      FundamentalFreq: fundamentalFreq,
      Pitch: pitch,
      SpectralCentroid: spectralCentroid,
      SpectralRolloff: spectralRolloff
    };
  }

  /**
   * u6c49u660eu7a97u51fdu6570
   */
  private applyHammingWindow(data: Float32Array): Float32Array {
    const result = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const windowCoef = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (data.length - 1));
      result[i] = data[i] * windowCoef;
    }
    return result;
  }

  /**
   * u8ba1u7b97u97f3u9891u80fdu91cf
   */
  private calculateEnergy(data: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < data.length; i++) {
      energy += data[i] * data[i];
    }
    return energy;
  }

  /**
   * u8ba1u7b97u8fc7u96f6u7387
   */
  private calculateZeroCrossRate(data: Float32Array): number {
    let zeroCrossings = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    return zeroCrossings / (data.length - 1);
  }

  /**
   * u8ba1u7b97FFTu9891u8c31
   */
  private calculateSpectrum(data: Float32Array): Float32Array {
    // u8fd9u91ccu4f7fu7528u7b80u5316u7684FFTu5b9eu73b0uff0cu5b9eu9645u9879u76eeu4e2du53efu4ee5u4f7fu7528u5e93u5982fft.js
    // u7b80u5316u8d77u89c1uff0cu8fd9u91ccu8fd4u56deu6570u636eu7684u7eddu5bf9u503cu4f5cu4e3au6a21u62dfu9891u8c31
    const spectrum = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      spectrum[i] = Math.abs(data[i]);
    }
    return spectrum;
  }

  /**
   * u8ba1u7b97u9891u8c31u8d28u5fc3
   */
  private calculateSpectralCentroid(spectrum: Float32Array): number {
    let weightedSum = 0;
    let sum = 0;
    
    for (let i = 0; i < spectrum.length / 2; i++) {
      const freq = i * this.sampleRate / spectrum.length;
      const mag = spectrum[i];
      
      weightedSum += freq * mag;
      sum += mag;
    }
    
    return sum === 0 ? 0 : weightedSum / sum;
  }

  /**
   * u8ba1u7b97u9891u8c31u6edau964du70b9 (85%u80fdu91cfu70b9)
   */
  private calculateSpectralRolloff(spectrum: Float32Array): number {
    let totalEnergy = 0;
    
    // u8ba1u7b97u603bu80fdu91cf
    for (let i = 0; i < spectrum.length / 2; i++) {
      totalEnergy += spectrum[i] * spectrum[i];
    }
    
    // u76eeu6807u80fdu91cf (85%u7684u603bu80fdu91cf)
    const targetEnergy = totalEnergy * 0.85;
    let cumulativeEnergy = 0;
    
    // u627eu523085%u80fdu91cfu5bf9u5e94u7684u9891u7387
    for (let i = 0; i < spectrum.length / 2; i++) {
      cumulativeEnergy += spectrum[i] * spectrum[i];
      if (cumulativeEnergy >= targetEnergy) {
        return i * this.sampleRate / spectrum.length;
      }
    }
    
    return 0;
  }

  /**
   * u8ba1u7b97u5cf0u503cu9891u7387
   */
  private calculatePeakFrequency(data: Float32Array): number {
    const spectrum = this.calculateSpectrum(data);
    let maxIndex = 0;
    let maxValue = 0;
    
    // u53eau8003u8651u524du4e00u534au7684u9891u8c31uff08u5948u5947u65afu7279u9891u7387u4ee5u4e0buff09
    for (let i = 0; i < spectrum.length / 2; i++) {
      if (spectrum[i] > maxValue) {
        maxValue = spectrum[i];
        maxIndex = i;
      }
    }
    
    return maxIndex * this.sampleRate / spectrum.length;
  }

  /**
   * u4f30u8ba1u57fau9891
   */
  private estimateFundamentalFrequency(data: Float32Array): number {
    // u7b80u5316u7684u57fau9891u4f30u8ba1uff0cu4f7fu7528u81eau76f8u5173u6cd5
    // u771fu5b9eu9879u76eeu4e2du53efu80fdu9700u8981u66f4u590du6742u7684u97f3u9ad8u68c0u6d4bu7b97u6cd5
    const minFreq = 200; // u6700u5c0fu68c0u6d4bu9891u7387
    const maxFreq = 900; // u6700u5927u68c0u6d4bu9891u7387
    
    const minLag = Math.floor(this.sampleRate / maxFreq);
    const maxLag = Math.floor(this.sampleRate / minFreq);
    
    let bestCorrelation = 0;
    let bestLag = 0;
    
    // u8ba1u7b97u81eau76f8u5173
    for (let lag = minLag; lag <= maxLag; lag++) {
      let correlation = 0;
      let num = 0;
      
      for (let i = 0; i < data.length - lag; i++) {
        correlation += data[i] * data[i + lag];
        num++;
      }
      
      correlation = correlation / num;
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestLag = lag;
      }
    }
    
    return bestLag > 0 ? this.sampleRate / bestLag : 0;
  }

  /**
   * u5224u65adu662fu5426u4e3au732bu53ebu58f0
   */
  private isCatMeow(features: AudioFeatures): boolean {
    // u732bu53ebu58f0u7684u7279u5f81u8303u56f4
    const meowFreqLower = 300;
    const meowFreqUpper = 850;
    const meowPitchLower = 400;
    const meowPitchUpper = 800;
    const meowDurationLower = 0.2;
    const meowDurationUpper = 3.0;
    
    // u57fau4e8eu9891u8c31u7279u5f81u7684u5224u65ad
    const freqInRange = features.FundamentalFreq > meowFreqLower && features.FundamentalFreq < meowFreqUpper;
    const pitchInRange = features.Pitch > meowPitchLower && features.Pitch < meowPitchUpper;
    const durationInRange = features.Duration > meowDurationLower && features.Duration < meowDurationUpper;
    
    // u80fdu91cfu548cu8fc7u96f6u7387u7279u5f81u7684u5224u65ad
    const hasEnoughEnergy = features.Energy > 1.0;
    const zeroCrossRateInRange = features.ZeroCrossRate > 0.05 && features.ZeroCrossRate < 0.3;
    
    // u7efcu5408u5224u65ad
    return freqInRange && pitchInRange && durationInRange && hasEnoughEnergy && zeroCrossRateInRange;
  }

  /**
   * u6839u636eu6837u672cu5e93u5224u65adu60c5u611fu7c7bu522b
   */
  private recognizeEmotionWithSamples(features: AudioFeatures): { emotion: string; confidence: number } {
    // u9ed8u8ba4u60c5u611fu7c7bu578bu548cu7f6eu4fe1u5ea6
    let bestEmotion = 'unknown';
    let bestConfidence = 0;
    
    try {
      // u8ba1u7b97u6bcfu4e2au60c5u611fu7c7bu522bu7684u5206u6570
      const emotionScores: Record<string, number> = {};
      const emotionCounts: Record<string, number> = {};
      
      // u904du5386u6837u672cu5e93u4e2du7684u6240u6709u60c5u611fu7c7bu522b
      const samples = sampleLibrary.samples as Record<string, Array<{
        FilePath: string;
        Emotion: string;
        Features: AudioFeatures;
      }>>;
      
      const emotions = Object.keys(samples || {});
      
      for (const emotion of emotions) {
        const emotionSamples = samples[emotion];
        let totalScore = 0;
        
        if (!emotionSamples || !Array.isArray(emotionSamples) || emotionSamples.length === 0) {
          continue;
        }
        
        // u904du5386u8be5u60c5u611fu4e0bu7684u6240u6709u6837u672c
        for (const sample of emotionSamples) {
          if (!sample.Features) continue;
          
          // u8ba1u7b97u7279u5f81u76f8u4f3cu5ea6u5206u6570
          const score = this.calculateFeaturesSimilarity(features, sample.Features);
          totalScore += score;
        }
        
        // u8ba1u7b97u5e73u5747u5206u6570
        const avgScore = totalScore / emotionSamples.length;
        emotionScores[emotion] = avgScore;
        emotionCounts[emotion] = emotionSamples.length;
      }
      
      // u627eu51fau5f97u5206u6700u9ad8u7684u60c5u611f
      for (const emotion in emotionScores) {
        if (emotionScores[emotion] > bestConfidence) {
          bestConfidence = emotionScores[emotion];
          bestEmotion = emotion;
        }
      }
    } catch (error) {
      console.error('u60c5u611fu8bc6u522bu9519u8bef:', error);
    }
    
    return { emotion: bestEmotion, confidence: bestConfidence };
  }

  /**
   * u8ba1u7b97u7279u5f81u76f8u4f3cu5ea6
   */
  private calculateFeaturesSimilarity(features1: AudioFeatures, features2: AudioFeatures): number {
    // u8ba1u7b97u5404u4e2au7279u5f81u7684u6743u91cdu76f8u4f3cu5ea6
    const pitchSimilarity = this.calculateSingleFeatureSimilarity(features1.Pitch, features2.Pitch, 100);
    const energySimilarity = this.calculateSingleFeatureSimilarity(features1.Energy, features2.Energy, 500);
    const durationSimilarity = this.calculateSingleFeatureSimilarity(features1.Duration, features2.Duration, 1);
    const spectralCentroidSimilarity = this.calculateSingleFeatureSimilarity(features1.SpectralCentroid, features2.SpectralCentroid, 200);
    const zeroCrossRateSimilarity = this.calculateSingleFeatureSimilarity(features1.ZeroCrossRate, features2.ZeroCrossRate, 0.1);
    
    // u52a0u6743u5e73u5747
    const weights = {
      pitch: 0.3,
      energy: 0.2,
      duration: 0.15,
      spectralCentroid: 0.2,
      zeroCrossRate: 0.15
    };
    
    const weightedSimilarity = 
      pitchSimilarity * weights.pitch +
      energySimilarity * weights.energy +
      durationSimilarity * weights.duration +
      spectralCentroidSimilarity * weights.spectralCentroid +
      zeroCrossRateSimilarity * weights.zeroCrossRate;
    
    return weightedSimilarity;
  }

  /**
   * u8ba1u7b97u5355u4e2au7279u5f81u7684u76f8u4f3cu5ea6
   */
  private calculateSingleFeatureSimilarity(value1: number, value2: number, tolerance: number): number {
    const diff = Math.abs(value1 - value2);
    return Math.max(0, 1 - diff / tolerance);
  }

  /**
   * u6e05u7a7au97f3u9891u7f13u51b2u533a
   */
  public reset(): void {
    this.audioBuffer = new Float32Array();
    this.lastProcessTime = Date.now();
  }
}
