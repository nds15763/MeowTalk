/**
 * OpenAI APIu9002u914du5668
 * u63d0u4f9bu4e0eOpenAI SDKu517cu5bb9u7684u63a5u53e3uff0cu4f46u4f7fu7528u7b80u5316u7684fetchu5b9eu73b0
 */

export default class OpenAI {
  private apiKey: string;
  private baseURL: string;

  constructor(config: { apiKey: string; baseURL: string }) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
  }

  chat = {
    completions: {
      create: async (params: any) => {
        try {
          const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(params)
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`APIu8c03u7528u5931u8d25: ${response.status} ${errorText}`);
          }

          return await response.json();
        } catch (error) {
          console.error('OpenAI APIu8c03u7528u9519u8bef:', error);
          throw error;
        }
      }
    }
  };
}
