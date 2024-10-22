export interface Emotion {
  id: string;
  icon: string;
  title: string;
  description: string;
  audioFile: any; // 使用 any 类型，因为 require 的返回类型在 TypeScript 中不是很明确
}
