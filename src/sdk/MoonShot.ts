import { MeowAIModelResponse } from '../components/VideoAITransNative';
import { AudioFeatures } from './audioTypes';
import OpenAI from './openai-adapter';

/**
 * MoonShot API服务类
 * 用于调用MoonShot大模型进行图像分析
 */
export class MoonShotService {
  private apiKey: string;
  private baseUrl: string;
  private client: OpenAI;
  private lastCallTime: number = 0; // 记录上一次调用时间
  private minCallInterval: number = 3000; // 最小调用间隔，单位毫秒

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

    // 初始化OpenAI客户端
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl
    });
  }

  /**
   * 设置API密钥
   * @param apiKey MoonShot API密钥
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    // 更新客户端API密钥
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl
    });
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

      const currentTime = new Date().getTime();
      if (currentTime - this.lastCallTime < this.minCallInterval) {
        throw new Error(`请至少等待${this.minCallInterval}毫秒后再次调用`);
      }
      this.lastCallTime = currentTime;

      // 检查imageBase64的格式
      let imageUrl = '';
      if (imageBase64.startsWith('data:image/')) {
        imageUrl = imageBase64;
      } else {
        imageUrl = `data:image/jpeg;base64,${imageBase64}`;
      }

      // 使用OpenAI SDK调用MoonShot API
      const completion = await this.client.chat.completions.create({
        model: "moonshot-v1-128k-vision-preview", // 使用视觉模型
        messages: [
          {
            "role": "system", 
            "content": "你是一个专业的猫咪行为分析师，擅长分析猫咪的行为表现和声音含义。请分析提供的图片和音频特征，输出JSON格式的分析结果。\n\n你的回答必须是以下JSON格式：\n{\n  \"is_meow\": true/false, // 是否有猫叫声，布尔值\n  \"emotions\": [\n    {\n      \"emotion\": \"识别的情感\",\n      \"confidence\": 0.85  // 置信度0-1\n    }\n    // 可以有多个情感，但只返回置信度大于0.8的\n  ],\n  \"most_likely_meaning\": \"最可能想表达的意思，用人类语言描述\"\n}"
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
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      // 返回处理后的结果
      try {
        // 尝试将返回的内容解析为JSON
        const jsonContent = completion.choices[0].message.content || '{}';
        const parsedResult = JSON.parse(jsonContent);
        
        return {
          text: jsonContent, // 保留原始文本内容
          is_meow: parsedResult.is_meow,
          emotions: parsedResult.emotions,
          most_likely_meaning: parsedResult.most_likely_meaning
        };
      } catch (jsonError) {
        console.error('解析JSON内容错误:', jsonError);
        // 如果解析JSON内容错误，返回原始文本内容
        return {
          text: completion.choices[0].message.content || '无法识别猫咪声音的含义，请重试'
        };
      }
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
