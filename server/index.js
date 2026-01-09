/**
 * YouTube 下载后端服务
 * 提供 API 接口，封装 yt-dlp 调用
 */

const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 配置 - 允许前端跨域访问
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}));

// JSON 解析
app.use(express.json());

// API 路由
app.use('/api', apiRoutes);

// 根路由 - 简单信息
app.get('/', (req, res) => {
  res.json({
    name: 'YouTube Download API',
    version: '1.0.0',
    endpoints: {
      '/api/health': 'Health check & yt-dlp status',
      '/api/info?url=': 'Get video/playlist info',
      '/api/formats?url=': 'Get available formats',
      '/api/download?url=&format=': 'Get download URL'
    }
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   YouTube Download API Server                ║
║   Running on http://localhost:${PORT}           ║
╚══════════════════════════════════════════════╝

Available endpoints:
  GET /api/health         - Check yt-dlp status
  GET /api/info?url=      - Get video info
  GET /api/formats?url=   - Get formats list  
  GET /api/download?url=  - Get download URL
  `);
});
