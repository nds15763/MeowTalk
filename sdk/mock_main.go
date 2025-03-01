package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	log.Println("=== MeowTalk SDK 服务启动中 ===")
	log.Println("版本: 1.2.0")
	log.Println("支持功能:")
	log.Println(" - 实时猫咪声音处理")
	log.Println(" - 自适应静默检测")
	log.Println(" - 多窗口音频特征提取")
	log.Println(" - 情感分析和模式识别")
	log.Println(" - WebSocket和HTTP API支持")
	log.Println(" - 跨域资源共享(CORS)支持")
	log.Println("==============================")

	// 创建音频处理器
	processor := NewMockAudioProcessor()

	// 设置HTTP路由
	mux := http.NewServeMux()
	
	// 设置CORS中间件
	corsMiddleware := func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, Authorization")
			
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			
			h.ServeHTTP(w, r)
		})
	}

	// API文档和介绍页面
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		html := `
		<!DOCTYPE html>
		<html>
		<head>
			<title>MeowTalk SDK API</title>
			<style>
				body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
				h1 { color: #333; }
				h2 { color: #666; margin-top: 30px; }
				code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
				pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
				.endpoint { background: #e9f7ff; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
				.method { font-weight: bold; color: #0066cc; }
			</style>
		</head>
		<body>
			<h1>MeowTalk SDK - 猫咪声音情感识别API</h1>
			<p>这个服务提供猫咪声音的实时情感分析，支持HTTP和WebSocket接口。</p>
			
			<h2>HTTP接口</h2>
			
			<div class="endpoint">
				<p><span class="method">POST</span> /api/send</p>
				<p>发送音频数据进行分析</p>
				<p>请求体格式:</p>
				<pre>{
  "streamId": "唯一标识符",
  "data": [浮点数音频数据数组]
}</pre>
				<p>响应格式:</p>
				<pre>{
  "status": "success|empty|no_cat_sound|too_short",
  "emotion": "识别的情感",
  "confidence": 0.85  // 置信度0-1
}</pre>
			</div>
			
			<h2>WebSocket接口</h2>
			
			<div class="endpoint">
				<p><span class="method">WebSocket</span> /ws</p>
				<p>建立WebSocket连接进行实时音频分析</p>
				<p>发送消息格式:</p>
				<pre>{
  "streamId": "唯一标识符",
  "data": [浮点数音频数据数组]
}</pre>
				<p>接收消息格式:</p>
				<pre>{
  "status": "success|empty|no_cat_sound|too_short",
  "emotion": "识别的情感",
  "confidence": 0.85  // 置信度0-1
}</pre>
			</div>
			
			<h2>支持的情感类别</h2>
			<ul>
				<li>angry - 生气</li>
				<li>happy - 开心</li>
				<li>excited - 兴奋</li>
				<li>curious - 好奇</li>
				<li>contented - 满足</li>
				<li>sad - 悲伤</li>
				<li>sleepy - 困倦</li>
				<li>affectionate - 亲昵</li>
				<li>unknown - 未知情感</li>
			</ul>
			
			<h2>调用示例</h2>
			<pre>
// JavaScript示例
fetch('/api/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    streamId: 'cat1',
    data: [0.01, 0.02, 0.03, ...] // 音频数据
  }),
})
.then(response => response.json())
.then(data => console.log(data));
			</pre>
		</body>
		</html>
		`
		w.Write([]byte(html))
	})

	// 音频处理API
	mux.HandleFunc("/api/send", processor.HandleSend)
	
	// WebSocket端点
	mux.HandleFunc("/ws", processor.HandleWebSocket)

	// 将应用包装在CORS中间件中
	handler := corsMiddleware(mux)

	// 启动服务器
	log.Println("正在启动HTTP服务器，监听端口: 8080...")
	log.Println("API端点: http://localhost:8080/api/send")
	log.Println("WebSocket端点: ws://localhost:8080/ws")
	
	err := http.ListenAndServe(":8080", handler)
	if err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}
