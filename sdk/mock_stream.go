package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
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
		return
	}

	var req SendAudioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	log.Printf("收到音频数据 - StreamID: %s, 长度: %d\n", req.StreamID, len(req.Data))
	// 处理音频数据
	result, err := m.ProcessAudio(req.Data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
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
	log.Printf("发送处理情感数据 - StreamID: %s\n", req.StreamID)
	// 处理音频数据
	session, ok := m.sessions.Load(req.StreamID)
	if !ok {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	// 返回最新的结果
	var latestResult []byte
	session.(*sync.Map).Range(func(key, value interface{}) bool {
		latestResult = value.([]byte)
		return true
	})

	if latestResult == nil {
		json.NewEncoder(w).Encode(map[string]string{"message": "No results available"})
		return
	}

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

	// 删除会话
	m.sessions.Delete(req.StreamID)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
