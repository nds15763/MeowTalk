@echo off
echo 正在编译 MeowTalk 音频处理库...

REM 设置环境变量
set CGO_ENABLED=1

REM 如果不存在输出目录，则创建
if not exist ".\output" mkdir .\output

REM 编译 Windows 版本
echo 编译 Windows 版本...
go build -buildmode=c-shared -o .\output\meowlib.dll mock_stream.go

REM 复制到 Android 项目
echo 复制到 Android 项目...
if not exist "..\android\app\src\main\jniLibs\x86_64" mkdir ..\android\app\src\main\jniLibs\x86_64
if not exist "..\android\app\src\main\jniLibs\arm64-v8a" mkdir ..\android\app\src\main\jniLibs\arm64-v8a
copy /Y .\output\meowlib.dll ..\android\app\src\main\jniLibs\x86_64\libmeowlib.so

REM 如果有需要，可以添加 Android 和 iOS 的交叉编译
echo 编译 Android arm64 版本...
set GOOS=android
set GOARCH=arm64
go build -buildmode=c-shared -o .\output\meowlib_arm64.so mock_stream.go
copy /Y .\output\meowlib_arm64.so ..\android\app\src\main\jniLibs\arm64-v8a\libmeowlib.so

REM 恢复环境变量
set GOOS=windows
set GOARCH=amd64

echo 编译完成！
echo 请在 Android Studio 中重新构建项目以完成集成。
