# Y2B Download

🎬 一个本地化的 YouTube 视频/音频下载工具，基于 Node.js + yt-dlp 构建。

![YouTube Downloader](https://img.shields.io/badge/YouTube-Downloader-ff0050?style=for-the-badge&logo=youtube&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)

## ✨ 功能特点

- 🎯 **视频下载**：支持 4K/1080p/720p/480p 多种画质
- 🎵 **MP3 下载**：自动转换为 320kbps 高品质 MP3
- 📋 **播放列表**：批量下载整个播放列表
- 🚀 **队列下载**：后台按顺序下载，不会卡顿
- 🍪 **Cookies 管理**：页面直接上传 cookies，轻松解决 403 错误
- 🎨 **精美界面**：现代化深色主题设计
- 📱 **响应式布局**：支持各种设备访问

## 🖼️ 界面预览

- 解析 YouTube 链接，显示视频信息
- 选择下载格式（推荐/视频/音频）
- 播放列表支持全选下载

## 🚀 快速开始

**前提条件**：需要安装 Node.js、yt-dlp 和 ffmpeg

> 👉 **新手用户**：请查看 [完整安装指南 (INSTALL.md)](./INSTALL.md)

```bash
# 1. 克隆项目
git clone https://github.com/your-username/y2bdownload.git
cd y2bdownload

# 2. 安装依赖
npm install

# 3. 启动服务
npm run dev
```

打开浏览器访问 `http://localhost:5173`

## 📦 支持的格式

| 类型 | 格式     | 说明             |
| ---- | -------- | ---------------- |
| 视频 | MP4/WebM | 最高 4K 画质     |
| 音频 | MP3      | 320kbps 高品质   |
| 音频 | M4A      | AAC 格式         |
| 原始 | 多种     | YouTube 原始格式 |

## 🔗 支持的链接格式

```
https://www.youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID
https://www.youtube.com/playlist?list=PLAYLIST_ID
```

## 📁 项目结构

```
y2bdownload/
├── server/                 # 后端服务
│   ├── index.js           # Express 入口
│   ├── config.js          # 配置文件（Cookies 等）
│   ├── routes/api.js      # API 路由
│   └── services/
│       ├── ytdlp.js       # yt-dlp 封装
│       └── downloadQueue.js # 下载队列
├── index.html             # 前端页面
├── styles.css             # 样式文件
├── app.js                 # 前端逻辑
├── cookies.txt            # Cookies 文件（需自行上传）
├── package.json           # 项目配置
├── README.md              # 说明文档
└── INSTALL.md             # 安装指南
```

## 🛠️ 开发命令

```bash
# 同时启动前后端
npm run dev

# 仅启动后端 (端口 3001)
npm run dev:server

# 仅启动前端 (端口 5173)
npm run dev:client
```

## ⚠️ 注意事项

1. 本工具仅供个人学习使用，请尊重版权
2. 下载的视频/音频请勿用于商业用途
3. 部分视频可能因版权保护无法下载

## 🐛 常见问题

**Q: 提示 "Sign in to confirm you're not a bot" 或 403 错误？**
A: 需要上传 Cookies 文件。详见 [INSTALL.md](./INSTALL.md) 第 6 节

**Q: 提示 yt-dlp 未安装？**
A: 请按照 [INSTALL.md](./INSTALL.md) 安装 yt-dlp

**Q: MP3 下载失败？**
A: 请确保已安装 ffmpeg（用于音频转换）

**Q: 下载速度慢？**
A: 取决于你的网络速度和 YouTube 服务器

**Q: 开始频繁出现403错误？**
A: 可能是yt-dlp被youtube检测到了，可以尝试更新yt-dlp或者更换cookies文件。
```
brew upgrade yt-dlp

yt-dlp --version
```

## 📄 许可证

MIT License - 自由使用和修改
