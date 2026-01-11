# 安装指南 - 从零开始

本指南适合**完全没有开发环境**的用户，将手把手教你安装所有必需的工具。

---

## 📋 目录

1. [安装 Homebrew（仅 macOS）](#1-安装-homebrew仅-macos)
2. [安装 Node.js](#2-安装-nodejs)
3. [安装 yt-dlp](#3-安装-yt-dlp)
4. [安装 ffmpeg](#4-安装-ffmpeg)
5. [下载并运行项目](#5-下载并运行项目)
6. [配置 Cookies（重要）](#6-配置-cookies重要解决-403报错)
7. [验证安装](#7-验证安装)

---

## 1. 安装 Homebrew（仅 macOS）

Homebrew 是 macOS 的软件包管理器，用于安装其他工具。

### 安装步骤

1. 打开 **终端**（按 `Cmd + 空格`，输入 `Terminal`，回车）

2. 复制粘贴以下命令并回车：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

3. 按照提示输入你的电脑密码（输入时不会显示）

4. 安装完成后，运行以下命令（如果提示需要）：

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

5. 验证安装：

```bash
brew --version
```

应该显示类似 `Homebrew 4.x.x`

---

## 2. 安装 Node.js

Node.js 是运行本项目的环境。

### macOS

```bash
brew install node
```

### Windows

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 **LTS 版本**（推荐）
3. 双击安装包，一路点击 Next 完成安装

### 验证安装

```bash
node --version
npm --version
```

应该显示版本号，如 `v20.x.x` 和 `10.x.x`

---

## 3. 安装 yt-dlp

yt-dlp 是下载 YouTube 视频的核心工具。

### macOS

```bash
brew install yt-dlp
```

### Windows

1. 访问 [yt-dlp 发布页](https://github.com/yt-dlp/yt-dlp/releases/latest)
2. 下载 `yt-dlp.exe`
3. 将文件放到 `C:\Windows\` 目录（或添加到系统 PATH）

### 验证安装

```bash
yt-dlp --version
```

应该显示版本号，如 `2024.xx.xx`

---

## 4. 安装 ffmpeg

ffmpeg 用于将音频转换为 MP3 格式。

### macOS

```bash
brew install ffmpeg
```

### Windows

1. 访问 [ffmpeg 官网](https://ffmpeg.org/download.html)
2. 点击 Windows 图标
3. 选择 "Windows builds from gyan.dev"
4. 下载 `ffmpeg-release-essentials.zip`
5. 解压到 `C:\ffmpeg`
6. 将 `C:\ffmpeg\bin` 添加到系统 PATH：
   - 右键"此电脑" → 属性 → 高级系统设置
   - 环境变量 → 系统变量 → Path → 编辑 → 新建
   - 输入 `C:\ffmpeg\bin`
   - 确定保存

### 验证安装

```bash
ffmpeg -version
```

应该显示类似 `ffmpeg version 6.x`

---

## 5. 下载并运行项目

### 方式一：使用 Git（推荐）

```bash
# 安装 Git（如果没有）
brew install git  # macOS
# Windows 访问 https://git-scm.com 下载安装

# 克隆项目
git clone https://github.com/your-username/y2bdownload.git
cd y2bdownload

# 安装依赖
npm install

# 启动服务
npm run dev
```

### 方式二：直接下载

1. 在 GitHub 页面点击 **Code** → **Download ZIP**
2. 解压到任意目录
3. 打开终端，进入项目目录：

```bash
cd /path/to/y2bdownload
npm install
npm run dev
```

### 打开应用

启动成功后，打开浏览器访问：

```
http://localhost:5173
```

你应该看到一个精美的 YouTube 下载页面！🎉

---

## 6. 配置 Cookies（重要！解决 403/报错）

YouTube 有严格的反机器人检测，如果不配置 Cookies，下载可能会失败（报错 `Sign in to confirm you're not a bot` 或 `HTTP Error 403`）。

### 🍪 方式一：通过页面上传（推荐！）

本项目支持直接在网页上传 cookies 文件，最简单方便：

1. **安装浏览器扩展**：
   - Chrome: [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - Firefox: 搜索 "cookies.txt" 扩展

2. **导出 Cookies**：
   - 用浏览器访问 [YouTube](https://www.youtube.com) 并**登录账号**
   - 点击扩展图标，选择 "Export" 下载 `cookies.txt` 文件

3. **上传到应用**：
   - 打开本地应用页面 `http://localhost:5173`
   - 页面顶部会显示 Cookies 状态指示器
   - 点击 **「上传 cookies.txt」** 按钮上传文件

4. **状态说明**：
   - 🟢 绿色：Cookies 有效，可以正常下载
   - 🟡 黄色：Cookies 超过 7 天，建议更新
   - 🔴 红色：需要上传 Cookies

### 方式二：手动放置文件

1. 按上述方法导出 `cookies.txt` 文件
2. 将文件放在项目根目录（`y2bdownload` 文件夹下）
3. 确保 `server/config.js` 配置正确：
   ```javascript
   COOKIES_FILE: './cookies.txt',
   ```

### 方式三：从浏览器自动读取（macOS 不稳定）

> ⚠️ 此方式在 macOS 上可能因浏览器锁定数据库而失败，推荐使用方式一。

1. 确保 Chrome/Safari/Firefox 中已登录 YouTube
2. 修改 `server/config.js`：
   ```javascript
   COOKIES_FILE: null,  // 注释掉或设为 null
   COOKIES_FROM_BROWSER: 'chrome',  // 或 'safari', 'firefox'
   ```
3. 如果使用 Safari，需开启终端的「完全磁盘访问权限」

---

## 7. 验证安装

运行以下命令检查所有工具是否正确安装：

```bash
# 检查 Node.js
node --version

# 检查 npm
npm --version

# 检查 yt-dlp
yt-dlp --version

# 检查 ffmpeg
ffmpeg -version
```

如果所有命令都显示版本号，恭喜你安装成功！

---

## 🐛 常见问题

### Q1: 命令找不到（command not found）

重新打开终端，或运行：

```bash
source ~/.zprofile  # macOS
```

### Q2: npm install 失败

尝试使用管理员权限：

```bash
sudo npm install  # macOS/Linux
```

### Q3: 下载失败

确保你的网络可以访问 YouTube。如果在中国大陆，可能需要代理。

### Q4: MP3 转换失败

确保 ffmpeg 已正确安装：

```bash
which ffmpeg  # macOS/Linux
where ffmpeg  # Windows
```

---

## 📞 获取帮助

如果遇到其他问题，请：

1. 在项目 GitHub 页面提交 Issue
2. 附上错误信息和你的操作系统版本

---

**祝你使用愉快！** 🎵
