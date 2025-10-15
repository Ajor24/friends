<template>
  <div class="messages-view">
    <h2>消息</h2>
    <div class="list">
      <div class="item" @click="$emit('openChat')">
        <div class="title">群：{{ groupCode }}</div>
        <div class="preview">{{ lastPreview }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  groupCode: { type: String, required: true },
  messages: { type: Array, default: () => [] }
});

const lastPreview = computed(() => {
  const groupMsgs = props.messages.filter(m => m.groupCode === props.groupCode);
  const last = groupMsgs[groupMsgs.length - 1];
  return last ? `${last.fromDevice.slice(0, 8)}: ${String(last.content).slice(0, 40)}` : '暂无消息';
});
</script>

<style scoped>
.messages-view { padding: 12px; }
h2 { margin:5px; text-align:center; }
.list { border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
.item { padding: 12px; cursor: pointer; }
.item:hover { background: #f7f7f7; }
.title { font-weight: 600; }
.preview { color: #666; margin-top: 4px; font-size: 13px; }
@media (max-width: 420px) {
  .messages-view { padding: 10px; }
  .item { padding: 10px; }
  .preview { font-size: 12px; }
}
</style>