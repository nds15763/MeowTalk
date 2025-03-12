#include <jni.h>
#include <string.h>

// 导入Go导出的函数
extern char* ProcessAudioData(float* data, int length);
extern void FreeCString(char* str);

// JNI桥接函数
JNIEXPORT jstring JNICALL
Java_com_meowtalk_MeowDetectorNativeModule_processAudioNative(
        JNIEnv *env, jobject thiz, jfloatArray data, jint length) {
    // 获取Java数组元素
    jfloat *nativeData = (*env)->GetFloatArrayElements(env, data, 0);
    
    // 调用Go函数处理音频
    char *result = ProcessAudioData(nativeData, length);
    
    // 释放Java数组
    (*env)->ReleaseFloatArrayElements(env, data, nativeData, 0);
    
    // 转换结果为Java字符串
    jstring jResult = (*env)->NewStringUTF(env, result);
    
    // 释放Go分配的内存
    FreeCString(result);
    
    return jResult;
}

JNIEXPORT void JNICALL
Java_com_meowtalk_MeowDetectorNativeModule_freeCString(
        JNIEnv *env, jobject thiz, jstring pointer) {
    // 这个函数可能不需要实现，因为我们已经在processAudioNative中释放了内存
    // 但为了完整性保留此函数
}
