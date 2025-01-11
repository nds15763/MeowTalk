# MeowTalk SDK 编译指南

## 准备工作
1. 确保已安装 Go 1.21.3 或更高版本
2. 安装 Android NDK (用于 Android 编译)
3. 安装 Xcode 和命令行工具 (用于 iOS 编译)

## 项目结构
```
sdk/
├── pkg/
│   └── soundsdk/           # SDK 核心代码
│       ├── recording.go    # 录音处理
│       ├── sound_identify.go # 声音识别
│       ├── sample_library.go # 样本库管理
│       └── types.go        # 类型定义
├── emotion_samples/        # 情感样本库
└── build/                  # 编译输出目录
```

## 创建构建目录
```bash
mkdir -p build
```

## Android 编译命令
```bash
# Android ARM64 版本
CC=/Users/Zhuanz1/xyakim/Android-NDK-r26/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android21-clang \
CGO_ENABLED=1 \
GOOS=android \
GOARCH=arm64 \
go build \
    -o build/meowsdk.arm64.so \
    -buildmode=c-shared \
    ./pkg/soundsdk/*.go
```

## iOS 编译命令
```bash
# iOS ARM64 版本
GOOS=ios \
GOARCH=arm64 \
CGO_ENABLED=1 \
CC=/usr/local/go/misc/ios/clangwrap.sh \
CGO_CFLAGS=-fembed-bitcode \
go build \
    -ldflags '-s -w -extldflags "-static"' \
    -tags ios \
    -o build/meowsdk.a \
    -buildmode=c-archive \
    ./pkg/soundsdk/*.go
```

## 运行测试
```bash
# 运行所有测试
cd pkg/soundsdk
go test -v ./...

# 运行特定测试
go test -v -run TestEmotionIdentification
```

## 编译产物说明
- Android: `build/meowsdk.arm64.so` (动态库)
- iOS: `build/meowsdk.a` (静态库)

## 注意事项
1. Android 使用动态库 (.so)，iOS 使用静态库 (.a)，这是因为 iOS 不支持 c-shared 模式
2. 确保所有源文件都包含在编译命令中
3. 编译前确保 `build` 目录存在
4. Android NDK 路径可能需要根据实际安装位置调整
5. 运行测试前确保 emotion_samples 目录中有测试音频文件
