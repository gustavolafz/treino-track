cmake_minimum_required(VERSION 3.10.2)
project(treino_engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(
  treino_engine
  SHARED
  treino_engine.cpp
)

target_compile_options(
  treino_engine
  PRIVATE
  -O3
  -ffast-math
  -fvisibility=hidden
  -Wall
  -Wextra
)

find_library(log-lib log)
target_link_libraries(treino_engine ${log-lib})
