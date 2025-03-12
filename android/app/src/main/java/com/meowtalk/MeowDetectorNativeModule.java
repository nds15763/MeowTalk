package com.meowtalk;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.module.annotations.ReactModule;

import java.nio.FloatBuffer;

@ReactModule(name = MeowDetectorNativeModule.NAME)
public class MeowDetectorNativeModule extends ReactContextBaseJavaModule {
    public static final String NAME = "MeowDetectorNative";

    // 加载原生库
    static {
        System.loadLibrary("meowlib");
    }

    // 声明原生方法
    private native String processAudioNative(float[] data, int length);
    private native void freeCString(String pointer);

    public MeowDetectorNativeModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    @NonNull
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void processAudio(ReadableArray audioData, Promise promise) {
        try {
            // 将JS数组转换为float数组
            float[] data = new float[audioData.size()];
            for (int i = 0; i < audioData.size(); i++) {
                data[i] = (float) audioData.getDouble(i);
            }

            // 调用原生方法处理音频
            String result = processAudioNative(data, data.length);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("PROCESS_ERROR", "处理音频时出错: " + e.getMessage());
        }
    }
}
