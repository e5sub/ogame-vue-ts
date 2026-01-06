<script setup lang="ts">
/**
 * 调试面板
 * 仅在开发环境显示，用于查看性能数据
 */
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { profiler } from '@/services/profiler'
import { ChevronDown, ChevronUp, Bug, X } from 'lucide-vue-next'

// 是否展开
const expanded = ref(false)
// 是否显示面板
const visible = ref(true)
// 性能数据
const averages = ref<Record<string, number>>({})
// 更新定时器
let updateInterval: ReturnType<typeof setInterval> | null = null

// 是否为开发环境
const isDev = import.meta.env.DEV

// 格式化耗时
const formatTime = (ms: number) => {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`
  return `${ms.toFixed(2)}ms`
}

// 排序后的性能数据
const sortedAverages = computed(() => {
  return Object.entries(averages.value)
    .sort((a, b) => b[1] - a[1]) // 按耗时降序
    .map(([label, time]) => ({ label, time }))
})

// 总耗时
const totalTime = computed(() => {
  return averages.value['tick:total'] ?? 0
})

// 性能状态颜色
const statusColor = computed(() => {
  if (totalTime.value > 16) return 'text-red-500' // 超过 16ms，低于 60fps
  if (totalTime.value > 8) return 'text-yellow-500' // 超过 8ms
  return 'text-green-500' // 正常
})

onMounted(() => {
  if (!isDev) return

  // 每秒更新一次平均值
  updateInterval = setInterval(() => {
    averages.value = profiler.averages()
  }, 1000)
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
})

const toggleExpanded = () => {
  expanded.value = !expanded.value
}

const close = () => {
  visible.value = false
}

// 键盘快捷键：Ctrl+Shift+D 切换显示
const handleKeydown = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    visible.value = !visible.value
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    v-if="isDev && visible"
    class="fixed bottom-4 right-4 z-[9999] bg-black/80 text-white text-xs font-mono rounded-lg shadow-lg backdrop-blur-sm border border-white/20"
    :class="expanded ? 'w-64' : 'w-auto'"
  >
    <!-- 标题栏 -->
    <div
      class="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/10 rounded-t-lg"
      @click="toggleExpanded"
    >
      <div class="flex items-center gap-2">
        <Bug class="w-4 h-4" />
        <span>Debug</span>
        <span :class="statusColor">{{ formatTime(totalTime) }}</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          class="p-1 hover:bg-white/20 rounded"
          @click.stop="close"
          title="关闭 (Ctrl+Shift+D)"
        >
          <X class="w-3 h-3" />
        </button>
        <component :is="expanded ? ChevronDown : ChevronUp" class="w-4 h-4" />
      </div>
    </div>

    <!-- 展开内容 -->
    <div v-if="expanded" class="px-3 pb-3 space-y-2 max-h-64 overflow-y-auto">
      <!-- 性能数据 -->
      <div v-if="sortedAverages.length > 0">
        <div class="text-white/50 mb-1">平均耗时 (60帧)</div>
        <div
          v-for="item in sortedAverages"
          :key="item.label"
          class="flex justify-between py-0.5 border-b border-white/10 last:border-0"
        >
          <span class="text-white/70">{{ item.label }}</span>
          <span
            :class="{
              'text-red-400': item.time > 8,
              'text-yellow-400': item.time > 4 && item.time <= 8,
              'text-green-400': item.time <= 4
            }"
          >
            {{ formatTime(item.time) }}
          </span>
        </div>
      </div>
      <div v-else class="text-white/50">等待数据...</div>

      <!-- 提示 -->
      <div class="text-white/30 text-[10px] pt-2 border-t border-white/10">
        Ctrl+Shift+D 切换显示
      </div>
    </div>
  </div>
</template>
