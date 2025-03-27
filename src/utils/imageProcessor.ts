import * as ImageManipulator from 'expo-image-manipulator';

/**
 * 压缩图像为指定尺寸
 * @param imageUri 图像URI
 * @param width 目标宽度（默认为200）
 * @param height 目标高度（默认为200）
 * @param quality 压缩质量（0-1，默认为0.6）
 * @returns 压缩后的图像URI
 */
export const compressImage = async (
  imageUri: string,
  width: number = 200,
  height: number = 200,
  quality: number = 0.6
): Promise<string> => {
  try {
    // 使用expo-image-manipulator压缩图像
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width, height } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (error) {
    console.error('图像压缩失败:', error);
    // 如果压缩失败，返回原始图像URI
    return imageUri;
  }
};

/**
 * 将图像URI转换为base64
 * @param imageUri 图像URI
 * @returns base64编码的图像
 */
export const imageToBase64 = async (imageUri: string): Promise<string | null> => {
  try {
    // 使用FileSystem读取文件内容，并转换为base64
    const { FileSystem } = require('expo-file-system');
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.error('图像转换为base64失败:', error);
    return null;
  }
};
