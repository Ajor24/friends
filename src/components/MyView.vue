<template>
  <div class="my-view">
    <h2>我的</h2>
    <section class="info">
      <div class="row"><span class="label">设备ID</span><span class="value">{{ deviceId }}</span></div>
      <div class="row"><span class="label">当前群码</span><span class="value">{{ groupCode || '未加入' }}</span></div>
      <div class="row"><span class="label">连接状态</span><span class="value" :class="isConnected ? 'ok' : 'bad'">{{ isConnected ? '已连接' : '未连接' }}</span></div>
    </section>

    <section class="actions">
      <h3>常用功能</h3>
      <div class="btns">
        <button @click="requestNotify">开启消息通知</button>
        <button class="warn" @click="clearAll">清除数据</button>
        <button class="warn" @click="exitGroup">退出群</button>
      </div>
      <p class="tips">清除数据：仅删除当前群的聊天记录与离线队列，并清理已上传文件；退出群：在清除数据基础上同时移除群码并返回入群页。设备ID保留。</p>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { clearAllData, clearGroupData } from '../utils/db';

const props = defineProps({
  myDeviceId: { type: String, default: '' },
  groupCode: { type: String, default: '' },
  isConnected: { type: Boolean, default: false }
});
const emit = defineEmits(['cleared']);

const deviceId = ref(props.myDeviceId);

// 开启通知授权
async function requestNotify() {
  try {
    if (!('Notification' in window)) {
      alert('当前浏览器不支持通知');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification('通知已开启', { body: '您将收到新消息提醒' });
    } else {
      alert('通知未授权');
    }
  } catch (e) {
    console.error(e);
    alert('通知授权失败');
  }
}

/**
 * 清除数据：仅清当前群的聊天数据（消息与离线队列），不退群；同时清理已上传文件
 */
async function clearAll() {
  try {
    if (props.groupCode) {
      await clearGroupData(props.groupCode);
    } else {
      // 未加入群时，清空全部聊天数据以保持一致
      await clearAllData();
    }
  } catch {}
  try {
    // 兼容旧版本地缓存
    localStorage.removeItem('messages');
  } catch {}
  try {
    await fetch('http://localhost:3000/uploads/clear', { method: 'POST' });
  } catch {}
  // 通知父组件清理内存中的该群消息
  emit('cleared', props.groupCode);
  alert('已清除当前群的聊天数据与已上传文件');
}

/**
 * 退出群：先清聊天数据与已上传文件，再移除群码并回到入群页
 */
async function exitGroup() {
  await clearAll();
  try {
    localStorage.removeItem('groupCode');
  } catch {}
  location.reload();
}
</script>

<style scoped>
.my-view { max-width: 640px; margin: 16px auto; padding: 12px; }
h2 { margin: 0 0 12px;text-align: center; }
.info { border: 1px solid #eee; border-radius: 8px; padding: 10px; }
.row { display: flex; justify-content: space-between; padding: 6px 4px; }
.label { color: #666; }
.value { font-weight: 600; }
.ok { color: #2e7d32; }
.bad { color: #c62828; }
.actions { margin-top: 16px; }
.btns { display: flex; gap: 8px; flex-wrap: wrap; }
button { padding: 8px 12px; border: none; background: #1976d2; color: #fff; border-radius: 6px; cursor: pointer; }
button.warn { background: #c62828; }
button:hover { opacity: 0.92; }
.tips { font-size: 12px; color: #777; margin-top: 8px; }
@media (max-width: 420px) {
  .my-view { margin: 8px auto; padding: 10px; }
  .row { padding: 6px 2px; font-size: 14px; }
  .btns { gap: 6px; }
  button { padding: 10px 12px; font-size: 14px; }
}
</style>