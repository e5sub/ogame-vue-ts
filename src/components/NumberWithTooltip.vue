<template>
  <Popover>
    <PopoverTrigger as-child>
      <span class="cursor-pointer underline decoration-dotted underline-offset-4 touch-manipulation">{{ abbreviatedValue }}</span>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-2" side="top" align="center">
      <p class="font-mono text-sm">{{ formattedValue }}</p>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

  const props = defineProps<{
    value: number
  }>()

  // 完整格式化的数字（带千位分隔符）
  const formattedValue = computed(() => {
    return props.value.toLocaleString()
  })

  // 缩写格式的数字
  const abbreviatedValue = computed(() => {
    const num = props.value

    // 小于1000直接显示
    if (num < 1000) {
      return num.toString()
    }

    // 1000 - 999,999: 使用 K (千)
    if (num < 1000000) {
      const k = num / 1000
      return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`
    }

    // 1,000,000 - 999,999,999: 使用 M (百万)
    if (num < 1000000000) {
      const m = num / 1000000
      return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`
    }

    // 1,000,000,000+: 使用 B (十亿)
    const b = num / 1000000000
    return b % 1 === 0 ? `${b}B` : `${b.toFixed(1)}B`
  })
</script>
