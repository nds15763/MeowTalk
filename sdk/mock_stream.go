package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// MockAudioProcessor 用于开发测试的mock处理器
type MockAudioProcessor struct {
	sessions sync.Map // 存储所有活动的会话
}

// 模拟的情感识别结果
type MockResult struct {
	Emotion    string    `json:"emotion"`
	Confidence float64   `json:"confidence"`
	Timestamp  time.Time `json:"timestamp"`
}

// HTTP请求结构体
type SendAudioRequest struct {
	StreamID string    `json:"streamId"`
	Data     []float64 `json:"data"`
}

func (m *MockAudioProcessor) ProcessAudio(data []float64) ([]byte, error) {
	// 模拟处理延迟
	time.Sleep(100 * time.Millisecond)

	// 返回模拟的结果
	result := MockResult{
		Emotion:    "happy",
		Confidence: 0.85,
		Timestamp:  time.Now(),
	}

	return json.Marshal(result)
}

// StartMockServer 启动mock服务器
func (m *MockAudioProcessor) StartMockServer(port int) error {
	// 初始化路由
	http.HandleFunc("/init", m.handleInit)
	http.HandleFunc("/start", m.handleStart)
	http.HandleFunc("/send", m.handleSend)
	http.HandleFunc("/recv", m.handleReceive)
	http.HandleFunc("/stop", m.handleStop)

	// 启动服务器
	addr := fmt.Sprintf(":%d", port)
	log.Printf("Mock server starting on http://localhost%s", addr)
	return http.ListenAndServe(addr, nil)
}

// HTTP处理函数
func (m *MockAudioProcessor) handleInit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		log.Printf("错误的请求方法: %s\n", r.Method)
		return
	}

	// 设置CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (m *MockAudioProcessor) handleStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		log.Printf("错误的请求方法: %s\n", r.Method)
		return
	}

	// 设置CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	// 生成新的streamId
	streamID := fmt.Sprintf("mock-%d", time.Now().UnixNano())
	m.sessions.Store(streamID, &sync.Map{})

	json.NewEncoder(w).Encode(map[string]string{"streamId": streamID})
}

func (m *MockAudioProcessor) handleSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		log.Printf("错误的请求方法: %s\n", r.Method)
		return
	}

	// 设置CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	var req SendAudioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		log.Printf("解析请求失败: %v\n", err)
		return
	}

	// 打印音频数据信息
	dataLen := len(req.Data)
	var maxVal, minVal, sum float64
	if dataLen > 0 {
		maxVal = req.Data[0]
		minVal = req.Data[0]
		for _, v := range req.Data {
			sum += v
			if v > maxVal {
				maxVal = v
			}
			if v < minVal {
				minVal = v
			}
		}
	}
	
	log.Printf("收到音频数据 - StreamID: %s, 数据点数: %d, 最大值: %.2f, 最小值: %.2f, 平均值: %.2f\n",
		req.StreamID, dataLen, maxVal, minVal, sum/float64(dataLen))

	// 处理音频数据
	result, err := m.ProcessAudio(req.Data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("处理音频数据失败: %v\n", err)
		return
	}

	// 存储结果
	if session, ok := m.sessions.Load(req.StreamID); ok {
		session.(*sync.Map).Store(time.Now().UnixNano(), result)
	}

	w.Write(result)
}

func (m *MockAudioProcessor) handleReceive(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		log.Printf("错误的请求方法: %s\n", r.Method)
		return
	}

	// 设置CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	streamID := r.URL.Query().Get("streamId")
	if streamID == "" {
		http.Error(w, "Missing streamId", http.StatusBadRequest)
		log.Printf("缺少 streamId 参数\n")
		return
	}

	// 返回最新的结果
	if session, ok := m.sessions.Load(streamID); ok {
		var lastResult []byte
		session.(*sync.Map).Range(func(key, value interface{}) bool {
			lastResult = value.([]byte)
			return false // 只获取最新的一个结果
		})
		if lastResult != nil {
			w.Write(lastResult)
			return
		}
	}

	// 如果没有结果，返回空对象
	json.NewEncoder(w).Encode(map[string]interface{}{})
}

func (m *MockAudioProcessor) handleStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		log.Printf("错误的请求方法: %s\n", r.Method)
		return
	}

	// 设置CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	streamID := r.URL.Query().Get("streamId")
	if streamID == "" {
		http.Error(w, "Missing streamId", http.StatusBadRequest)
		log.Printf("缺少 streamId 参数\n")
		return
	}

	// 删除会话
	m.sessions.Delete(streamID)

	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
