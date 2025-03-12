cmake_minimum_required(VERSION 3.4.1)

# 添加 meow_bridge.c 源文件
add_library(
        meow_bridge
        SHARED
        meow_bridge.c
)

# 设置 meowlib 的路径
set(MEOWLIB_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../../../../sdk/meowlib")

# 添加 meowlib 库
add_library(
        meowlib
        SHARED
        IMPORTED
)

# 设置 meowlib 导入的位置
set_target_properties(
        meowlib
        PROPERTIES
        IMPORTED_LOCATION
        "${MEOWLIB_PATH}.so"
)

# 包含头文件目录
target_include_directories(
        meow_bridge
        PRIVATE
        "${CMAKE_CURRENT_SOURCE_DIR}/../../../../sdk"
)

# 链接 meowlib 到 meow_bridge
target_link_libraries(
        meow_bridge
        meowlib
        log
)
