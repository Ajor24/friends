<template>
  <div class="onboarding">
    <h2>加入群聊</h2>
    <p class="desc">请输入群码，加入已安装应用用户的公共群</p>
    <div class="row">
      <input v-model="code" placeholder="例如：friends-all 或任意字符串" />
      <button @click="join" :disabled="!code">加入</button>
    </div>
    <p class="hint">提示：请输入规定的群码后即可加入群聊</p>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['join']);

const code = ref(localStorage.getItem('groupCode') || '');



const requiredCode = import.meta.env.VITE_GROUP_CODE;
const errorMsg = ref('');

function join() {
  errorMsg.value = '';

  const input = (code.value || '').trim();
  if (!input || input !== requiredCode) {
    errorMsg.value = '群码不正确，请输入规定的群码';
    return;
  }
  emit('join', input);
}
</script>

<style scoped>
.onboarding { max-width: 480px; margin: 24px auto; padding: 16px; }
h2 { margin: 0 0 8px; }
.desc { color: #666; margin-bottom: 12px; }
.row { display: flex; gap: 8px; }
input { flex: 1; padding: 8px; border: 1px solid #bbb; border-radius: 6px; }
button { padding: 8px 12px; border: none; background: #1976d2; color: #fff; border-radius: 6px; cursor: pointer; }
.hint { font-size: 12px; color: #888; margin-top: 8px; }
.error { color: #c62828; margin-top: 8px; font-size: 13px; }
@media (max-width: 420px) {
  .onboarding { max-width: 100%; margin: 12px auto; padding: 12px; }
  .row { gap: 6px; }
  input { padding: 10px; font-size: 16px; }
  button { padding: 10px 12px; font-size: 15px; }
}
</style>