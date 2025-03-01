/*
MeowTalk SDK - 猫咪情感识别库

这是一个用于实时识别猫咪情感的CGO SDK。主要功能包括：
1. 音频流实时处理
2. 特征提取与分析
3. 基于样本库的情感分类

编译指令：
  Windows: go build -buildmode=c-shared -o meowsdk.dll
  Linux:   go build -buildmode=c-shared -o meowsdk.so
  macOS:   go build -buildmode=c-shared -o meowsdk.dylib

错误码说明：
  0: 成功
  1: SDK未初始化
  2: 参数无效
  3: 会话不存在
  4: 内存分配失败
  5: 音频处理错误
*/

package main

import "C"
import (
	"sync"
	"unsafe"
)

var (
	resultPool sync.Pool
	strPool    sync.Pool
)

func init() {
	// 初始化对象池
	resultPool.New = func() interface{} {
		return new(C.EmotionResult)
	}
	strPool.New = func() interface{} {
		return make([]byte, 1024)
	}
}

//export InitSDK
func InitSDK(cConfig *C.AudioConfig) C.ErrorCode {
	if cConfig == nil {
		return C.ERR_INVALID_PARAM
	}

	config := AudioStreamConfig{
		ModelPath:  C.GoString(cConfig.model_path),
		SampleRate: int(cConfig.sample_rate),
		BufferSize: int(cConfig.buffer_size),
	}

	// 参数验证
	if config.SampleRate <= 0 || config.BufferSize <= 0 {
		return C.ERR_INVALID_PARAM
	}

	if !InitializeSDK(config) {
		return C.ERR_NOT_INITIALIZED
	}

	return C.ERR_SUCCESS
}

//export StartStream
func StartStream(streamId *C.char) C.ErrorCode {
	if streamId == nil {
		return C.ERR_INVALID_PARAM
	}

	id := C.GoString(streamId)
	if err := StartAudioStream(id); err != nil {
		return C.ERR_SESSION_NOT_FOUND
	}

	return C.ERR_SUCCESS
}

//export SendAudio
func SendAudio(streamId *C.char, data *C.uchar, length C.int) C.bool {
	id := C.GoString(streamId)
	err := SendAudioChunk(id, C.GoBytes(unsafe.Pointer(data), length))
	return C.bool(err == nil)
}

//export RecvMessage
func RecvMessage(streamId *C.char) *C.char {
	id := C.GoString(streamId)
	result, err := RecvMessage(id)
	if err != nil || result == nil {
		return nil
	}
	return C.CString(string(result))
}

//export StopStream
func StopStream(streamId *C.char) C.ErrorCode {
	if streamId == nil {
		return C.ERR_INVALID_PARAM
	}

	id := C.GoString(streamId)
	if err := StopAudioStream(id); err != nil {
		return C.ERR_SESSION_NOT_FOUND
	}

	return C.ERR_SUCCESS
}

//export ReleaseSDK
func ReleaseSDK() {
	ReleaseSDK()
}

// func main() {
// }
