# MeowTalker设计文档

## 项目概述

MeowTalker是一个猫咪声音情感识别系统，通过分析猫咪的叫声和图像，帮助用户理解猫咪的情感状态和需求。系统结合了音频处理、计算机视觉和人工智能技术，实现高效准确的猫咪情感分析。

### 核心业务
- 猫咪声音识别与情感分析
- [[猫叫检测功能设计]]
- 实时视频处理和图像捕获
- 多模态（音频+图像）AI分析

### 核心模块导航
- [[#系统架构]]
- [[#业务功能]]
- [[#应用层组件]]
- [[#服务层组件]]
- [[#基础设施层]]
- [[#关键流程]]
- [[#数据结构]]
- [[#性能与优化]]

## 系统架构

### 技术栈
- 前端框架：React Native
- 音频处理：Go语言服务（通过CGO导出为共享库）
- 平台桥接：JNI (Java Native Interface)
- AI分析：MoonShot API
- 状态管理：Zustand

### 架构图
```
+-------------------+     +-------------------+     +-------------------+
|     UI层          |     |      服务层        |     |     基础设施层     |
|                   |     |                   |     |                   |
| - HomePage        |     | - MeowDetector    |     | - Go音频处理       |
| - VideoAITrans    |<--->| - AudioProcessor  |<--->| - JNI桥接         |
| - TranslatePage   |     | - MoonShotService |     | - 静默检测算法     |
| - TestAudioPage   |     |                   |     | - 特征提取         |
+-------------------+     +-------------------+     +-------------------+
                                    |
                                    v
                          +-------------------+
                          |    外部服务        |
                          |                   |
                          | - MoonShot API    |
                          +-------------------+
```

## 业务功能

### 猫咪声音识别业务

#### 功能概述
系统通过实时采集猫咪的叫声，结合视频画面，分析猫咪的情感状态。核心业务流程包括：音频采集、静默检测、音频分段、特征提取、情感分析和结果展示。

#### 业务流程
1. 用户启动应用，进入视频AI助手页面
2. 系统自动启动相机和麦克风
3. 系统实时检测猫咪叫声
4. 检测到叫声后，系统捕获当前画面
5. 系统分析音频特征和图像内容
6. 展示分析结果，包括情感类型和置信度

#### 关键用例
- **实时猫咪叫声检测**：系统持续监听环境音，当检测到猫咪叫声时触发分析流程
- **猫咪情感分析**：结合音频特征和图像内容，分析猫咪的情感状态
- **历史分析记录**：保存和展示历史分析结果，便于用户了解猫咪情感变化

## 应用层组件

### 用户界面组件

#### HomePage组件
应用的入口页面，提供三个主要功能入口：
- 翻译页面
- AI视频助手页面
- 音频测试页面

**关键代码**：@src/components/HomePage.tsx#L35-L45

#### VideoAITransNative组件
核心功能页面，实现猫咪声音和图像的实时分析：
- 相机视图管理
- 音频检测控制
- 分析结果展示
- 历史记录管理

**关键代码**：@src/components/VideoAITransNative.tsx#L295-L324

#### TranslatePage组件
提供猫咪声音翻译功能，专注于声音到文本的转换。

**关键代码**：@src/components/TranslatePage.tsx#L1-L100

#### TestAudioPage组件
音频功能测试页面，用于验证音频采集和处理功能。

**关键代码**：@src/components/TestAudioPage.tsx#L1-L200

### 状态管理

#### VideoStore
使用Zustand管理视频分析相关状态：
- 视频采集状态
- 分析中状态
- 分析结果历史
- 各种状态更新方法

**关键代码**：@src/components/VideoAITransNative.tsx#L75-L104

## 服务层组件

### 音频处理服务

#### MeowDetectorModule
提供猫叫检测功能，协调音频录制和处理：
- 开始/停止录音和检测
- 音频缓冲区处理
- 猫叫事件触发

**关键代码**：@src/sdk/MeowDetectorModule.ts#L119-L148

#### AudioProcessor
核心音频处理类：
- 音频数据的缓冲和管理
- 静默检测功能
- 特征提取算法

### AI分析服务

#### MoonShotService
调用MoonShot API分析图像和音频特征：
- 图像和音频数据格式转换
- API调用和响应处理
- 结果解析和转换

**关键代码**：@src/sdk/MoonShot.ts#L63-L126

## 基础设施层

### 原生模块

#### Go语言音频处理库
高性能的音频处理核心：
- 实现自适应缓冲机制
- 静默检测算法
- 音频特征提取

#### JNI桥接
连接JavaScript和Go代码的桥梁：
- 原生模块封装
- 数据转换和传递
- 事件回调机制

## 关键流程

### 初始化流程
系统启动时的初始化过程：
1. 请求相机和麦克风权限
   - **相关代码**：@src/components/VideoAITransNative.tsx#L441-L470
2. 初始化AI服务和猫叫检测模块
   - **相关代码**：@src/components/VideoAITransNative.tsx#L295-L324
3. 设置相机参数和回调
4. 准备音频处理缓冲区

### 猫叫检测流程
系统如何检测和处理猫叫：
1. 音频数据实时采集
2. 通过静默检测分割音频
3. 过滤过短的音频片段
4. 特征提取和初步分析
5. 触发猫叫检测事件
   - **相关代码**：@src/components/VideoAITransNative.tsx#L310-L323

### AI分析流程
从猫叫检测到AI分析的完整流程：
1. 检测到猫叫后捕获当前图像
   - **相关代码**：@src/components/VideoAITransNative.tsx#L343-L398
2. 提取音频特征数据
3. 将图像和音频特征发送到AI服务
   - **相关代码**：@src/sdk/MoonShot.ts#L63-L126
4. 解析AI响应数据
5. 更新UI显示分析结果
   - **相关代码**：@src/components/VideoAITransNative.tsx#L400-L417

## 数据结构

### 核心数据类型

#### VideoContext
视频分析结果数据结构：
- message: 消息内容
- timestamp: 时间戳
- frameDataUrl: 帧数据URL
- is_meow: 是否为猫叫
- most_likely_meaning: 最可能的含义
- emotions: 情感列表
- rawResponse: 原始JSON响应

**关键代码**：@src/components/VideoAITransNative.tsx#L49-L57

#### MeowEmotion
猫咪情感类型数据结构：
- emotion: 表示的情感
- confidence: 置信度，0-1范围

**关键代码**：@src/components/VideoAITransNative.tsx#L60-L63

## 性能与优化

### 缓冲机制
系统采用自适应缓冲机制处理音频数据：
- 最小处理时间：1秒
- 最大缓冲时间：5秒
- 静默阈值：0.02
- 最小静默时间：0.3秒

### 内存优化
- 使用共享内存减少数据复制
- 优化缓冲区管理，减少内存占用
- 图像压缩处理，降低传输负担

### 实时性优化
- 高效的静默检测算法
- 并行处理音频和图像数据
- 延迟优化策略
