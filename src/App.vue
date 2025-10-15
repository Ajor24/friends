<template>
  <div class="app">
    <div v-if="!groupCode">
      <Onboarding @join="handleJoinGroup" />
    </div>
    <div v-else>
      <div class="content">
        <template v-if="!showChat">
          <component
            :is="activeTab === 'messages' ? MessagesView : MyView"
            :group-code="groupCode"
            :messages="messages"
            :my-device-id="myDeviceId"
            :is-connected="isConnected"
            @openChat="openChat"
            @cleared="handleCleared"
          />
        </template>
        <template v-else>
          <div class="chat-page">

            <ChatView
              :group-code="groupCode"
              :messages="messages"
              :my-device-id="myDeviceId"
              :is-connected="isConnected"
              :online-count="onlineCounts[groupCode] || 1"
              @sendGroup="sendGroup"
              @back="showChat = false"
            />
          </div>
        </template>
      </div>

      <nav class="tabs" v-if="!showChat">
        <button :class="{ active: activeTab==='messages' }" @click="activeTab='messages'">消息</button>
        <button :class="{ active: activeTab==='my' }" @click="activeTab='my'">我的</button>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { connectSocket, joinGroup, sendGroupMessage } from './composables/useSocket';

import Onboarding from './components/Onboarding.vue';
import MessagesView from './components/MessagesView.vue';
import ChatView from './components/ChatView.vue';
import MyView from './components/MyView.vue';
import { initDB, getMessagesByGroup, addMessage, addToOutbox, getOutboxByGroup, removeOutboxById, clearAllData } from './utils/db';

const myDeviceId = ref(localStorage.getItem('deviceId') || `device_${Math.random().toString(36).slice(2)}`);
onMounted(async () => {
  localStorage.setItem('deviceId', myDeviceId.value);
  await initDB();
  // 若已填写过群码，则自动加入并加载历史消息
  if (groupCode.value) {
    ensureSocket();
    joinGroup(groupCode.value);
    try {
      const history = await getMessagesByGroup(groupCode.value);
      messages.value = Array.isArray(history) ? history : [];
    } catch {
      // 保留现有内存消息（若有）
    }
    activeTab.value = 'messages';
    showChat.value = false;
  }
});

// 连接 Socket
let sRef = ref(null);
let isConnected = ref(false);
function ensureSocket() {
  if (!sRef.value) {
    const conn = connectSocket(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', myDeviceId.value);
    sRef = conn.socket;
    isConnected = conn.isConnected;
    // 连接后再挂载监听
    if (sRef.value) {
      sRef.value.on('new_message', async (msg) => {
        messages.value.push(msg);
        try { await addMessage(msg.groupCode, msg); } catch {}

        // 通知：仅在授权且为他人消息时弹出
        try {
          const isOther = msg && msg.fromDevice && msg.fromDevice !== myDeviceId.value;
          if (isOther && 'Notification' in window && Notification.permission === 'granted') {
            const title = `群：${msg.groupCode || groupCode.value || ''}`;
            const body =
              msg.type === 'image' ? `${msg.fromDevice}: [图片]` :
              msg.type === 'video' ? `${msg.fromDevice}: [视频]` :
              `${msg.fromDevice}: ${String(msg.content || '').slice(0, 80)}`;
            const n = new Notification(title, {
              body,
              tag: `group-${msg.groupCode || groupCode.value || ''}`,
              renotify: false,
              icon: '/favicon.ico'
            });
            n.onclick = () => {
              try { window.focus(); } catch {}
            };
            // 手机震动（支持设备）
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
          }
        } catch {}
      });
      sRef.value.on('group_joined', (info) => {
        console.log('group joined:', info);
      });
      sRef.value.on('connect', async () => {
        try {
          if (!groupCode.value) return;
          // 确保连接成功后加入群房间
          joinGroup(groupCode.value);

          // 重发离线消息
          const pending = await getOutboxByGroup(groupCode.value);
          for (const p of pending) {
            sendGroupMessage(groupCode.value, p.content);
            await removeOutboxById(p.id);
          }
        } catch (e) { console.warn('resend failed', e); }
      });
      sRef.value.on('group_user_count', (payload) => {
        const code = payload.groupCode || (payload.room && String(payload.room).split(':')[1]);
        if (code) onlineCounts.value[code] = payload.count ?? 0;
      });
    }
  }
}

// 群码与导航状态
const groupCode = ref(localStorage.getItem('groupCode') || '');



const activeTab = ref('messages');
const showChat = ref(false);



 // 在线人数映射：{ [groupCode]: count }
const onlineCounts = ref({});
 // 消息列表（本地持久化）
const messages = ref((() => {
  try {
    const raw = localStorage.getItem('messages');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
})());
// 监听消息变化并持久化到本地


// 监听消息
onMounted(() => {
  // 页面初始不连接；当用户输入正确群码并加入后再连接
});

// 首屏加入群
async function handleJoinGroup(code) {
  groupCode.value = code;
  localStorage.setItem('groupCode', code);
  ensureSocket();
  joinGroup(code);

  // 载入该群的历史消息
  try {
    const history = await getMessagesByGroup(code);
    messages.value = Array.isArray(history) ? history : [];
  } catch {
    messages.value = [];
  }

  // 本地生成一条加入群的消息，并持久化，供消息列表预览
  const joinMsg = {
    id: Date.now(),
    type: 'text',
    content: '已加入群',
    fromDevice: myDeviceId.value,
    groupCode: code,
    timestamp: new Date().toISOString()
  };
  messages.value.push(joinMsg);
  try { await addMessage(code, joinMsg); } catch {}

  activeTab.value = 'messages';
  showChat.value = false; // 加入后停留在消息列表，点击列表项再进入聊天
}


// 从消息列表进入聊天
function openChat() {
  showChat.value = true;
}

// 清除当前群的内存消息（配合“我的”页清除数据）
function handleCleared(code) {
  const c = code || groupCode.value;
  if (!c) return;
  messages.value = messages.value.filter(m => m.groupCode !== c);
}

// 发送群消息
async function sendGroup(payload) {
  const code = groupCode.value;
  if (!code || !payload) return;

  // 规范化 payload
  let type = 'text';
  let content = '';
  if (typeof payload === 'string') {
    type = 'text';
    content = payload;
  } else if (payload && typeof payload === 'object') {
    type = payload.type || 'text';
    content = payload.content ?? '';
  }

  // 已连接：直接发送，消息会通过 new_message 回显并持久化
  if (isConnected && isConnected.value) {
    sendGroupMessage(code, { type, content });
    return;
  }

  // 未连接：写入离线队列并本地显示
  try {
    const pending = await addToOutbox(code, content, myDeviceId.value);
    messages.value.push({
      id: pending.id,
      type,
      content,
      fromDevice: myDeviceId.value,
      groupCode: code,
      timestamp: pending.timestamp
    });
  } catch (e) {
    console.warn('add to outbox failed', e);
  }
}
</script>

<style>
.app { min-height: 100vh; display: flex; flex-direction: column; }
.content { flex: 1; position: relative; padding-bottom: 56px; }
.tabs {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; border-top: 1px solid #eee; background: #fff;
}
.tabs button {
  flex: 1; padding: 10px; border: none; background: transparent; cursor: pointer;
}
.tabs button.active { color: #1976d2; font-weight: 600; }
</style>