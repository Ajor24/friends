const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

/**
 * CORS：若配置了 ALLOWED_ORIGIN 则只允许该域；否则开发环境下放开
 * 允许前端通过 x-access-key 头传递简单鉴权密钥
 */
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors({
  origin: allowedOrigin ? [allowedOrigin] : '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-access-key']
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Static uploads (placeholder)
const fs = require('fs');
const multer = require('multer');

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置 multer 存储与大小限制（例如 50MB）
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const base = path.basename(file.originalname || 'file', ext).replace(/[^a-zA-Z0-9_\-]/g, '');
    const name = `${Date.now()}_${Math.random().toString(16).slice(2)}_${base}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

/**
 * 上传接口：校验 x-access-key（若配置了 BACKEND_ACCESS_KEY），返回可公开访问的 URL
 * 公网上线建议改用对象存储（S3/OSS）并返回 CDN 外链
 */
app.post('/upload', (req, res, next) => {
  const requiredKey = process.env.BACKEND_ACCESS_KEY;
  if (requiredKey && req.headers['x-access-key'] !== requiredKey) {
    return res.status(401).json({ error: 'invalid access key' });
  }
  next();
}, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const host = req.get('host');
  const proto = req.protocol;
  const fileUrl = `${proto}://${host}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, mimetype: req.file.mimetype, size: req.file.size });
});

/**
 * 清理上传目录：删除 /backend/uploads 下所有文件
 * 注意：仅示例，生产环境需鉴权与细粒度控制
 */
app.post('/uploads/clear', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    for (const f of files) {
      const p = path.join(uploadsDir, f);
      try {
        const stat = fs.statSync(p);
        if (stat.isFile()) fs.unlinkSync(p);
      } catch {}
    }
    return res.json({ ok: true, cleared: files.length });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'clear uploads failed' });
  }
});

// 静态访问上传文件
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 统一错误处理（将 Multer/其他错误转为 JSON）
app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    return res.status(413).json({ error: err.code, message: err.message });
  }
  if (err) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
  next();
});

// Socket.IO
const io = new Server(server, {
  cors: { origin: allowedOrigin ? [allowedOrigin] : '*', methods: ['GET', 'POST'] },
  // 提高消息缓冲上限，支持较大的图片/视频 dataURL
  maxHttpBufferSize: 10 * 1024 * 1024
});

require('./sockets/chatSocket')(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Backend server running on 0.0.0.0:' + PORT);
});