module.exports = (io) => {
  // 简单鉴权：要求客户端提供 accessKey（与后端环境变量 BACKEND_ACCESS_KEY 相同）
  io.use((socket, next) => {
    const auth = (socket.handshake && socket.handshake.auth) || {};
    const deviceId = auth.deviceId;
    const accessKey = auth.accessKey;
    if (!deviceId) return next(new Error('Authentication error: deviceId required'));

    const requiredKey = process.env.BACKEND_ACCESS_KEY;
    if (requiredKey) {
      if (!accessKey || accessKey !== requiredKey) {
        return next(new Error('Authentication error: invalid access key'));
      }
    }

    socket.deviceId = deviceId;
    next();
  });

  io.on('connection', (socket) => {
    console.log('Connected:', socket.deviceId);
    // 每个设备加入自己的房间（点对点透传）
    socket.join(socket.deviceId);

    // 加入群聊房间：基于群码命名房间
    socket.on('join_group', (groupCode) => {
      try {
        if (!groupCode || typeof groupCode !== 'string') {
          return socket.emit('message_error', { error: 'Invalid group code' });
        }
        const room = `group:${groupCode.trim()}`;
        socket.join(room);
        socket.emit('group_joined', { room, groupCode });
        // 广播当前房间的实时在线人数
        try {
          const roomObj = io.sockets.adapter.rooms.get(room);
          const count = roomObj ? roomObj.size : 0;
          io.to(room).emit('group_user_count', { room, groupCode, count });
        } catch (e) {}
        console.log('Joined group', room, 'by', socket.deviceId);
      } catch (err) {
        socket.emit('message_error', { error: err.message });
      }
    });

    // 禁用点对点消息：统一提示使用群聊
    socket.on('send_message', () => {
      socket.emit('message_error', { error: 'Direct messaging is disabled. Please use group chat with a group code.' });
    });

    // 群聊消息：广播到群房间，同时回显
    socket.on('send_group_message', (payload = {}) => {
      try {
        const groupCode = payload.groupCode;
        if (!groupCode) {
          return socket.emit('message_error', { error: 'groupCode required' });
        }
        const room = `group:${String(groupCode).trim()}`;
        const msg = {
          id: Date.now(),
          type: payload.type || 'text',
          content: payload.content,
          fromDevice: socket.deviceId,
          groupCode: groupCode,
          timestamp: new Date().toISOString()
        };
        socket.to(room).emit('new_message', msg);
        socket.emit('new_message', msg);
      } catch (err) {
        socket.emit('message_error', { error: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected:', socket.deviceId);
      // 用户离开后更新其所在的所有群的在线人数
      try {
        for (const r of socket.rooms) {
          if (r === socket.id) continue; // 跳过自身房间
          const roomObj = io.sockets.adapter.rooms.get(r);
          const count = roomObj ? roomObj.size : 0;
          // 从 r 推断 groupCode（格式为 group:CODE）
          const code = String(r).startsWith('group:') ? String(r).slice(6) : r;
          io.to(r).emit('group_user_count', { room: r, groupCode: code, count });
        }
      } catch (e) {}
    });
  });
};