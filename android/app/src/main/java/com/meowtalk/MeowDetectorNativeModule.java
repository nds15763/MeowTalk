package com.meowtalk;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;

@ReactModule(name = MeowDetectorNativeModule.NAME)
public class MeowDetectorNativeModule extends ReactContextBaseJavaModule {
    public static final String NAME = "MeowDetectorNative";
    private static final String TAG = "MeowDetectorNative";
    private static final int SAMPLE_RATE = 44100;
    private static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    private static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_FLOAT;
    private AudioRecord audioRecord;
    private boolean isRecording = false;
    private int bufferSize;

    // 加载原生库
    static {
        System.loadLibrary("meowlib");
    }

    // 声明原生方法
    private native String processAudioNative(float[] data, int length);
    private native void freeCString(String pointer);

    public MeowDetectorNativeModule(ReactApplicationContext reactContext) {
        super(reactContext);
        // 计算最小缓冲区大小
        bufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            CHANNEL_CONFIG,
            AUDIO_FORMAT
        );
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

    @ReactMethod
    public void getAudioData(Promise promise) {
        try {
            if (audioRecord == null) {
                // 创建 AudioRecord 实例
                audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT,
                    bufferSize
                );
            }

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                promise.reject("AUDIO_RECORD_ERROR", "AudioRecord 初始化失败");
                return;
            }

            if (!isRecording) {
                audioRecord.startRecording();
                isRecording = true;
            }

            // 创建缓冲区
            float[] audioBuffer = new float[bufferSize / 4]; // 因为使用 ENCODING_PCM_FLOAT
            
            // 读取音频数据
            int readResult = audioRecord.read(audioBuffer, 0, audioBuffer.length, AudioRecord.READ_BLOCKING);
            
            if (readResult > 0) {
                // 将数据转换为 WritableArray
                WritableArray result = Arguments.createArray();
                for (int i = 0; i < readResult; i++) {
                    result.pushDouble(audioBuffer[i]);
                }
                promise.resolve(result);
                
                Log.d(TAG, "成功读取音频数据，长度: " + readResult);
            } else {
                Log.w(TAG, "读取音频数据失败，错误码: " + readResult);
                promise.reject("READ_ERROR", "读取音频数据失败，错误码: " + readResult);
            }
        } catch (Exception e) {
            Log.e(TAG, "获取音频数据失败", e);
            promise.reject("AUDIO_ERROR", "获取音频数据失败: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopRecording(Promise promise) {
        if (audioRecord != null && isRecording) {
            try {
                audioRecord.stop();
                isRecording = false;
                promise.resolve(null);
            } catch (Exception e) {
                Log.e(TAG, "停止录音失败", e);
                promise.reject("STOP_ERROR", "停止录音失败: " + e.getMessage());
            }
        } else {
            promise.resolve(null);
        }
    }
}
