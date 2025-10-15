// 简易 IndexedDB 封装：消息与离线队列
const DB_NAME = 'friendApp';
const DB_VERSION = 1;
let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('messages')) {
        const s = db.createObjectStore('messages', { keyPath: 'id' });
        s.createIndex('by_group', 'groupCode', { unique: false });
        s.createIndex('by_group_ts', ['groupCode', 'timestamp'], { unique: false });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        const o = db.createObjectStore('outbox', { keyPath: 'id' });
        o.createIndex('by_group', 'groupCode', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

export async function initDB() {
  return openDB();
}

export async function addMessage(groupCode, msg) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.objectStore('messages').put({ ...msg, groupCode });
  });
}

export async function getMessagesByGroup(groupCode) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly');
    tx.onerror = () => reject(tx.error);
    const idx = tx.objectStore('messages').index('by_group');
    const req = idx.getAll(groupCode);
    req.onsuccess = () => {
      const list = (req.result || []).sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return ta - tb;
      });
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

function genId() {
  return Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

export async function addToOutbox(groupCode, content, fromDevice) {
  const db = await openDB();
  const item = {
    id: genId(),
    groupCode,
    content,
    fromDevice,
    timestamp: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
    tx.objectStore('outbox').put(item);
  });
}

export async function getOutboxByGroup(groupCode) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    tx.onerror = () => reject(tx.error);
    const idx = tx.objectStore('outbox').index('by_group');
    const req = idx.getAll(groupCode);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOutboxById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.objectStore('outbox').delete(id);
  });
}

export async function clearAllData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['messages', 'outbox'], 'readwrite');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.objectStore('messages').clear();
    tx.objectStore('outbox').clear();
  });
}

/**
 * 清除指定群的聊天数据（仅该群的消息与离线队列）
 * @param {string} groupCode
 */
export async function clearGroupData(groupCode) {
  if (!groupCode) return;
  const db = await openDB();
  // 删除 messages 中该群的记录
  await new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const idx = store.index('by_group');
    const req = idx.getAllKeys(groupCode);
    req.onsuccess = () => {
      const keys = req.result || [];
      if (!keys.length) return resolve(true);
      keys.forEach((key) => store.delete(key));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
  // 删除 outbox 中该群的记录
  await new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    const idx = store.index('by_group');
    const req = idx.getAllKeys(groupCode);
    req.onsuccess = () => {
      const keys = req.result || [];
      if (!keys.length) return resolve(true);
      keys.forEach((key) => store.delete(key));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}