import { ref } from 'vue';
import { io } from 'socket.io-client';

const socket = ref(null);
const isConnected = ref(false);

export function connectSocket(serverUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', deviceId) {
  const accessKey = import.meta.env.VITE_ACCESS_KEY || '';
  socket.value = io(serverUrl, { auth: { deviceId, accessKey } });

  socket.value.on('connect', () => {
    isConnected.value = true;
    console.log('Socket connected');
  });

  socket.value.on('disconnect', () => {
    isConnected.value = false;
    console.log('Socket disconnected');
  });

  return { socket, isConnected };
}

export function sendMessage(toDevice, content) {
  if (!socket.value || !isConnected.value) return;
  socket.value.emit('send_message', {
    toDevice,
    content,
    type: 'text'
  });
}

/** 加入群聊（房间名来源于群码） */
export function joinGroup(groupCode) {
  if (!socket.value || !isConnected.value) return;
  socket.value.emit('join_group', groupCode);
}

/** 发送群聊消息（广播到群房间） */
export function sendGroupMessage(groupCode, payload) {
  if (!socket.value || !isConnected.value) return;
  const p = (payload && typeof payload === 'object') ? payload : { type: 'text', content: payload };
  socket.value.emit('send_group_message', {
    groupCode,
    ...p
  });
}

export { socket, isConnected };