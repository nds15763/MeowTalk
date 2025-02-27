package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// MockAudioProcessor 用于开发测试的mock处理器
type MockAudioProcessor struct {
	sessions sync.Map
}

// 模拟的情感识别结果
type MockResult struct {
	Emotion    string    `json:"emotion"`
	Confidence float64   `json:"confidence"`
	Timestamp  time.Time `json:"timestamp"`
}

// HTTP请求结构体
type SendAudioRequest struct {
	StreamID string      `json:"streamId"`
	Data     interface{} `json:"data"` // 使用 interface{} 支持多种类型的数据
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许所有来源，仅用于测试
	},
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
	// 初始化处理器
	http.HandleFunc("/init", m.handleInit)
	http.HandleFunc("/start", m.handleStart)
	http.HandleFunc("/send", m.handleSend)
	http.HandleFunc("/recv", m.handleReceive)
	http.HandleFunc("/stop", m.handleStop)

	// 添加CORS中间件
	handler := corsMiddleware(http.DefaultServeMux)

	// 启动服务器
	addr := fmt.Sprintf(":%d", port)
	log.Printf("Mock服务器启动在 http://localhost%s\n", addr)
	return http.ListenAndServe(addr, handler)
}

// CORS中间件
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 设置CORS头
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		// 处理预检请求
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// 继续处理实际请求
		next.ServeHTTP(w, r)
	})
}

// HTTP处理函数
func (m *MockAudioProcessor) handleInit(w http.ResponseWriter, r *http.Request) {
	// 处理OPTIONS预检请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		log.Printf("错误的请求方法: %s\n", r.Method)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (m *MockAudioProcessor) handleStart(w http.ResponseWriter, r *http.Request) {
	// 处理OPTIONS预检请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		log.Printf("错误的请求方法: %s\n", r.Method)
		return
	}

	// 解析请求体
	var req struct {
		StreamID string `json:"streamId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		log.Printf("解析请求失败: %v\n", err)
		return
	}

	// 使用客户端提供的 streamId
	if req.StreamID == "" {
		http.Error(w, "StreamID is required", http.StatusBadRequest)
		log.Printf("StreamID 不能为空\n")
		return
	}

	// 存储会话
	m.sessions.Store(req.StreamID, &sync.Map{})
	log.Printf("创建新会话 - StreamID: %s\n", req.StreamID)

	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (m *MockAudioProcessor) handleSend(w http.ResponseWriter, r *http.Request) {
	// 处理OPTIONS预检请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		log.Printf("错误的请求方法: %s\n", r.Method)
		return
	}

	var req SendAudioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		log.Printf("解析请求体失败: %v\n", err)
		return
	}

	// 记录原始请求内容
	log.Printf("收到请求 - StreamID: %s\n", req.StreamID)
	log.Printf("音频数据原始类型: %T\n", req.Data)

	// 处理不同类型的音频数据
	var audioData []float64

	switch data := req.Data.(type) {
	case []interface{}:
		// 将 []interface{} 转换为 []float64
		log.Printf("数据类型为 []interface{}, 长度: %d\n", len(data))
		audioData = make([]float64, len(data))
		for i, v := range data {
			log.Printf("  第 %d 个元素, 类型: %T, 值: %v\n", i, v, v)
			switch val := v.(type) {
			case float64:
				audioData[i] = val
			case json.Number:
				if f, err := val.Float64(); err == nil {
					audioData[i] = f
				}
			case int:
				audioData[i] = float64(val)
			case float32:
				audioData[i] = float64(val)
			case string:
				if f, err := strconv.ParseFloat(val, 64); err == nil {
					audioData[i] = f
				}
			default:
				// 对于无法转换的值，使用0
				audioData[i] = 0
				log.Printf("    无法处理的类型: %T\n", v)
			}
		}
	case []float64:
		// 已经是正确类型
		log.Printf("数据类型为 []float64, 长度: %d\n", len(data))
		audioData = data
	default:
		log.Printf("未知的数据类型: %T\n", req.Data)
		// 尝试以JSON方式转换
		if jsonData, err := json.Marshal(req.Data); err == nil {
			log.Printf("数据JSON表示: %s\n", string(jsonData))
		}
	}

	// 记录处理后的音频数据统计信息
	if len(audioData) > 0 {
		maxVal := audioData[0]
		minVal := audioData[0]
		sumVal := 0.0

		for _, v := range audioData {
			if v > maxVal {
				maxVal = v
			}
			if v < minVal {
				minVal = v
			}
			sumVal += v
		}

		avgVal := sumVal / float64(len(audioData))
		log.Printf("音频数据统计 - 长度: %d, 最小值: %.2f, 最大值: %.2f, 平均值: %.2f\n",
			len(audioData), minVal, maxVal, avgVal)
	} else {
		log.Printf("警告: 处理后的音频数据为空\n")
	}

	// 处理音频数据
	result, err := m.ProcessAudio(audioData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("处理音频失败: %v\n", err)
		return
	}

	// 存储结果
	if session, ok := m.sessions.Load(req.StreamID); ok {
		session.(*sync.Map).Store(time.Now().UnixNano(), result)
	}

	w.Write(result)
}

func (m *MockAudioProcessor) handleReceive(w http.ResponseWriter, r *http.Request) {
	// 处理OPTIONS预检请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 获取streamId
	streamID := r.URL.Query().Get("streamId")
	if streamID == "" {
		http.Error(w, "StreamID is required", http.StatusBadRequest)
		return
	}

	// 获取会话
	sessionInterface, ok := m.sessions.Load(streamID)
	if !ok {
		http.Error(w, "No session found", http.StatusNotFound)
		return
	}

	// 转换类型
	session := sessionInterface.(*sync.Map)

	// 查找最新的结果
	var latestResult []byte
	var latestTime int64 = 0

	session.Range(func(key, value interface{}) bool {
		timestamp := key.(int64)
		if timestamp > latestTime {
			latestTime = timestamp
			latestResult = value.([]byte)
		}
		return true
	})

	if latestResult == nil {
		// 返回空结果
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("{}"))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(latestResult)
}

func (m *MockAudioProcessor) handleStop(w http.ResponseWriter, r *http.Request) {
	// 处理OPTIONS预检请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		StreamID string `json:"streamId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// 结束会话（但不删除，保留结果可查询）
	log.Printf("结束会话 - StreamID: %s\n", req.StreamID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
