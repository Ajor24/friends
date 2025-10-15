<template>
  <div class="chat-view">
    <div class="header">
      <button class="back" @click="$emit('back')">← 返回</button>
      <div class="title">群：{{ groupCode }}</div>
      <div class="count">人数：{{ onlineCount != null ? onlineCount : participantCount }}</div>
    </div>
    <div class="messages" ref="msgEl">
      <template v-for="m in groupMessages" :key="m.timestamp + '_' + m.id">
        <div class="time-sep">{{ formatTs(m.timestamp) }}</div>
        <div :class="['bubble', m.fromDevice === myDeviceId ? 'sent' : 'received']">
          <div class="meta">
            <span>{{ m.fromDevice }}</span>
          </div>
          <div class="content">
          <template v-if="m.type === 'image'">
            <img :src="m.content" alt="图片" @click="openViewer(m.content, 'image')" style="display:block; max-width: 200px; max-height: 200px; border-radius:6px; cursor:pointer;" />
          </template>
          <template v-else-if="m.type === 'video'">
            <video :src="m.content" controls style="display:block; max-width: 200px; max-height: 200px; border-radius:6px;"></video>
          </template>
          <template v-else>
            {{ m.content }}
          </template>
          </div>
        </div>
      </template>
    </div>
    <div v-if="mediaPreview" class="pending-media">
      <div class="content">
        <div class="thumb">
          <img v-if="mediaType==='image'" :src="mediaPreview" alt="预览" />
          <video v-else controls :src="mediaPreview"></video>
          <button class="cancel-btn" @click="clearMedia" aria-label="取消">✕</button>
        </div>
      </div>
    </div>
    <div class="input-row">
      <input v-model="input" @keyup.enter="send" placeholder="输入消息，回车或点击发送" />
      <button class="plus" @click="togglePicker">＋</button>
      <button @click="send" :disabled="!canSend && !mediaPreview">发送</button>
    </div>
    <div v-if="showPicker" class="picker-row">
      <button class="pick" @click="pickImage">🖼 照片</button>
      <button class="pick" @click="pickVideo">🎥 视频</button>
    </div>
    <input ref="imageInput" type="file" accept="image/*" @change="onImageSelected" style="display:none" />
    <input ref="videoInput" type="file" accept="video/*" @change="onVideoSelected" style="display:none" />
    <!-- 全屏预览层 -->
    <div v-if="viewerSrc" class="viewer-overlay" @click="closeViewer">
      <button class="viewer-close" @click.stop="closeViewer">✕</button>
      <img v-if="viewerType==='image'" :src="viewerSrc" class="viewer-img" alt="预览" />
      <video v-else controls :src="viewerSrc" class="viewer-video"></video>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';

const props = defineProps({
  groupCode: { type: String, required: true },
  messages: { type: Array, default: () => [] },
  myDeviceId: { type: String, required: true },
  isConnected: { type: Boolean, default: false },
  onlineCount: { type: Number, default: null }
});
const emit = defineEmits(['sendGroup', 'back']);

const input = ref('');
const msgEl = ref(null);
// 媒体选择
const showPicker = ref(false);
const mediaPreview = ref(null); // ObjectURL 或 dataURL
const mediaType = ref(null); // 'image' | 'video'
const imageInput = ref(null);
const videoInput = ref(null);
// 大小限制（图片10MB，视频200MB）
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
function togglePicker() {
  showPicker.value = !showPicker.value;
}
function pickImage() {
  if (imageInput.value) imageInput.value.click();
}
function pickVideo() {
  if (videoInput.value) videoInput.value.click();
}
function onImageSelected(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  // 尺寸校验：图片最大10MB
  if (f.size > MAX_IMAGE_SIZE) {
    alert('图片大小超出限制（最大 10MB）');
    e.target.value = '';
    return;
  }
  mediaType.value = 'image';
  const reader = new FileReader();
  reader.onload = () => {
    mediaPreview.value = reader.result;
    showPicker.value = false;
  };
  reader.readAsDataURL(f);
}
function clearMedia() {
  mediaPreview.value = null;
  mediaType.value = null;
}
async function onVideoSelected(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  // 尺寸校验：视频最大200MB
  if (f.size > MAX_VIDEO_SIZE) {
    alert('视频大小超出限制（最大 200MB）');
    e.target.value = '';
    return;
  }
  try {
    // 先上传到后端，使用返回的 URL
    const form = new FormData();
    form.append('file', f);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const resp = await fetch(`${API_URL}/upload`, {
  method: 'POST',
  headers: { 'x-access-key': import.meta.env.VITE_ACCESS_KEY || '' },
  body: form
});
    const data = await resp.json();
    if (!resp.ok || !data.url) throw new Error(data.error || 'upload failed');

    mediaType.value = 'video';
    mediaPreview.value = data.url; // 使用可访问的 URL
    showPicker.value = false;
  } catch (err) {
    console.warn('视频上传失败', err);
    // 回退策略：仍可清理预览
    mediaType.value = null;
    mediaPreview.value = null;
  }
}

const groupMessages = computed(() => props.messages.filter(m => m.groupCode === props.groupCode));
const participantCount = computed(() => {
  // 统计当前群的唯一设备数
  const set = new Set(groupMessages.value.map(m => m.fromDevice));
  // 确保包含自己
  set.add(props.myDeviceId);
  return set.size;
});
const canSend = computed(() => !!input.value && props.isConnected);

function send() {
  // 若选择了媒体，优先发送媒体
  if (mediaPreview.value && mediaType.value) {
    emit('sendGroup', { type: mediaType.value, content: mediaPreview.value });
    // 清理预览
    mediaPreview.value = null;
    mediaType.value = null;
    return;
  }
  if (!canSend.value) return;
  emit('sendGroup', input.value);
  input.value = '';
}

watch(groupMessages, () => {
  queueMicrotask(() => {
    if (msgEl.value) msgEl.value.scrollTop = msgEl.value.scrollHeight;
  });
});

function formatTs(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  } catch {
    return String(ts);
  }
}

// 大图/视频预览
const viewerSrc = ref(null);
const viewerType = ref(null);
function openViewer(src, type = 'image') {
  viewerSrc.value = src;
  viewerType.value = type;
}
function closeViewer() {
  viewerSrc.value = null;
  viewerType.value = null;
}
</script>

<style scoped>
.chat-view { position: fixed; inset: 0; display: flex; flex-direction: column; }
.header { padding: 8px 12px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 8px; }
.back { border: none; background: transparent; color: #1976d2; cursor: pointer; }
.title { flex: 1; text-align: center; font-weight: 600; }
.count { min-width: 80px; text-align: right; color: #666; font-size: 13px; }
.messages { flex: 1; overflow: auto; padding: 8px; }
.pending-media { max-width: 70%; padding: 4px 0; margin: 2px 0; border-radius: 8px; background: transparent; border: none; }
.pending-media .content img { width: 140px; height: 140px; object-fit: contain; border-radius: 6px; }
.pending-media .content video { width: 140px; height: 140px; object-fit: contain; border-radius: 6px; }
.pending-media .thumb { position: relative; display: inline-block; }
.cancel-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 22px;
  height: 22px;
  line-height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.6);
  color: #fff;
  cursor: pointer;
}
.bubble { width: fit-content; padding: 4px 8px; margin: 2px 0; border-radius: 8px; background: #f5f5f5; }
.bubble.sent { margin-left: auto; background: #e3f2fd; }
.bubble.received { margin-right: auto; background: #fce4ec; }
.meta { font-size: 12px; color: #666; display: flex; justify-content: space-between; }
.time-sep { text-align: center; color: #999; font-size: 12px; margin: 4px 0; }
.viewer-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.viewer-img, .viewer-video {
  max-width: 90vw; max-height: 90vh; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,0.4);
}
.viewer-close {
  position: absolute; top: 12px; right: 12px;
  width: 32px; height: 32px; border-radius: 50%;
  border: none; background: rgba(255,255,255,0.85); color: #333; cursor: pointer; font-size: 18px;
}
.content { margin: 0; padding: 2px 0 4px; white-space: pre-wrap; word-break: break-word; }
.input-row { display: flex; gap: 8px; padding: 8px; border-top: 1px solid #eee; }
.plus { padding: 8px 12px; border: none; background: #eee; color: #333; border-radius: 6px; cursor: pointer; }
.picker-row { display: flex; gap: 8px; padding: 0 8px 8px; }
.pick { padding: 6px 10px; border: 1px solid #bbb; background: #fafafa; border-radius: 6px; cursor: pointer; }
input { flex: 1; padding: 8px; border: 1px solid #bbb; border-radius: 6px; }
button { padding: 8px 12px; border: none; background: #1976d2; color: #fff; border-radius: 6px; cursor: pointer; }
button:disabled { opacity: 0.6; cursor: not-allowed; }
@media (max-width: 420px) {
  .header { padding: 6px 8px; }
  .back { font-size: 14px; }
  .title { font-size: 15px; }
  .count { min-width: 64px; font-size: 12px; }
  .messages { padding: 6px; }
  .bubble { padding: 3px 6px; margin: 2px 0; max-width: 88vw; }
  .meta { font-size: 11px; }
  .time-sep { margin: 2px 0; font-size: 11px; }
  .content { padding: 2px 0 3px; }
  /* 媒体元素在小屏缩小些，避免撑满 */
  .viewer-img, .viewer-video { max-width: 94vw; max-height: 86vh; }
  .pending-media .content img,
  .pending-media .content video { width: 120px; height: 120px; }
  .input-row { padding: 6px; gap: 6px; }
  input { padding: 8px; font-size: 14px; }
  .plus, button { padding: 8px 10px; }
}
</style>