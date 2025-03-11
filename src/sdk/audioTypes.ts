/**
 * 音频特征接口
 */
export interface AudioFeatures {
  Duration: number;
  Energy: number;
  RootMeanSquare: number;
  ZeroCrossRate: number;
  PeakFreq: number;
  FundamentalFreq: number;
  Pitch: number;
  SpectralCentroid: number;
  SpectralRolloff: number;
}

/**
 * 音频分析结果
 */
export interface AudioAnalysisResult {
  isMeow: boolean;
  emotion?: string;
  confidence?: number;
  features?: AudioFeatures;
}

/**
 * 猫叫检测器状态
 */
export enum MeowDetectorState {
  Idle = 'idle',
  Recording = 'recording',
  Processing = 'processing',
  Detected = 'detected'
}
