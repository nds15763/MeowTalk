import { MeowAIModelResponse } from '../components/VideoAITransNative';
import { AudioFeatures } from './audioTypes';

/**
 * MoonShot API服务类
 * 用于调用MoonShot大模型进行图像分析
 */
export class MoonShotService {
  private apiKey: string;
  private baseUrl: string;

  /**
   * 构造函数
   * @param apiKey MoonShot API密钥
   * @param baseUrl API基础URL
   */
  constructor(apiKey?: string, baseUrl?: string) {
    // 如果没有提供API密钥，可以尝试从环境变量获取
    this.apiKey = apiKey ||  'sk-r4sVBNCVkOHXDn6mpgDBbYs1qnTIfSfO2twFwWM0JCT23OdJ';
    this.baseUrl = baseUrl || 'https://api.moonshot.cn/v1';

    if (!this.apiKey) {
      console.warn('警告: MoonShot API密钥未设置，请确保在使用前设置API密钥');
    }
  }

  /**
   * 设置API密钥
   * @param apiKey MoonShot API密钥
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * 分析图像和音频特征
   * @param imageBase64 图像的base64编码
   * @param audioFeatures 音频特征
   * @returns 分析结果
   */
  async analyzeImageWithAudio(imageBase64: string, audioFeatures: AudioFeatures): Promise<MeowAIModelResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('MoonShot API密钥未设置');
      }

      // 构建图像URL
      const imageUrl = `data:image/jpeg;base64,${imageBase64}`;

      // 构建请求体
      const requestBody = {
        model: "moonshot-v1-128k-vision-preview", // 使用视觉模型
        messages: [
          {
            "role": "system", 
            "content": "你是一个专业的猫咪行为分析师，擅长分析猫咪的行为表现和声音含义。"
          },
          {
            "role": "user",
            "content": [
              {
                "type": "image_url",
                "image_url": {
                  "url": imageUrl,
                }
              },
              {
                "type": "text",
                "text": `请分析这张猫咪图片，同时考虑以下音频特征数据：${JSON.stringify(audioFeatures)}。分析猫咪可能的情绪状态和行为意图。`
              }
            ]
          }
        ]
      };

      // 发送请求到MoonShot API
      const response = await fetch(this.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API调用失败: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // 返回处理后的结果
      return {
        text: data.choices[0].message.content
      };
    } catch (error) {
      console.error('MoonShot API调用错误:', error);
      
      // 在生产环境中，您可能希望提供更友好的错误信息
      // 这里为了调试方便，直接返回错误信息
      return {
        text: `分析失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
