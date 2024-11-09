package bridge

// #include <stdlib.h>
import "C"
import (
	"encoding/json"
	"unsafe"
	
	"meowtalk/go_sdk/core"
)

var detector *core.MeowDetector

//export InitMeowDetector
func InitMeowDetector(templatesDir *C.char) *C.char {
	dir := C.GoString(templatesDir)
	var err error
	detector, err = core.NewMeowDetector(dir)
	if err != nil {
		return C.CString(fmt.Sprintf(`{"error": "%s"}`, err.Error()))
	}
	return C.CString(`{"status": "success"}`)
}

//export DetectMeowEmotion
func DetectMeowEmotion(audioData *C.float, length C.int) *C.char {
	data := unsafe.Slice((*float32)(unsafe.Pointer(audioData)), int(length))
	
	emotionID, similarity := detector.DetectEmotion(data)
	
	result := struct {
		EmotionID  string  `json:"emotionId"`
		Similarity float64 `json:"similarity"`
	}{
		EmotionID:  emotionID,
		Similarity: similarity,
	}
	
	jsonResult, _ := json.Marshal(result)
	return C.CString(string(jsonResult))
}

func main() {} 