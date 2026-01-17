/**
 * API 路由
 * 提供视频信息、格式列表、下载链接等接口
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ytdlp = require('../services/ytdlp');
const downloadQueue = require('../services/downloadQueue');
const config = require('../config');

// 配置 multer 用于 cookies 文件上传
const cookiesUpload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: 1024 * 1024 }, // 1MB 限制
});

/**
 * 获取 cookies 参数
 */
function getCookiesArgs() {
  if (config.COOKIES_FILE) {
    const cookiesPath = path.resolve(__dirname, '../../', config.COOKIES_FILE);
    return ['--cookies', cookiesPath];
  } else if (config.COOKIES_FROM_BROWSER) {
    return ['--cookies-from-browser', config.COOKIES_FROM_BROWSER];
  }
  return [];
}

/**
 * GET /api/info
 * 获取视频或播放列表信息
 * Query: url - YouTube URL
 */
router.get('/info', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // 判断是否为播放列表
    const isPlaylist = url.includes('list=') && !url.includes('watch?v=');

    if (isPlaylist) {
      const info = await ytdlp.getPlaylistInfo(url);
      res.json({ type: 'playlist', data: info });
    } else {
      const info = await ytdlp.getVideoInfo(url);
      res.json({ type: 'video', data: info });
    }
  } catch (error) {
    console.error('Error fetching video info:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch video info' });
  }
});

/**
 * GET /api/formats
 * 获取可用的下载格式
 * Query: url - YouTube URL
 */
router.get('/formats', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const formats = await ytdlp.getFormats(url);
    res.json(formats);
  } catch (error) {
    console.error('Error fetching formats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch formats' });
  }
});

/**
 * GET /api/download
 * 获取下载链接
 * Query: url - YouTube URL, format - 格式 ID (可选)
 */
router.get('/download', async (req, res) => {
  const { url, format = 'best' } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const downloadInfo = await ytdlp.getDownloadInfo(url, format);
    res.json(downloadInfo);
  } catch (error) {
    console.error('Error getting download URL:', error);
    res.status(500).json({ error: error.message || 'Failed to get download URL' });
  }
});

/**
 * GET /api/proxy-download
 * 代理下载 - 使用 yt-dlp 直接下载文件
 * Query: url - YouTube URL, format - 格式 ID (可选)
 */
router.get('/proxy-download', async (req, res) => {
  const { url, format = 'best' } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  const { spawn } = require('child_process');
  const path = require('path');
  const fs = require('fs');
  const os = require('os');

  // 创建临时文件路径
  const tempDir = os.tmpdir();
  const tempId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  const tempFilePath = path.join(tempDir, `ytdl-${tempId}`);

  try {
    // 解析格式
    let actualFormat = format;
    let audioFormat = null;

    if (format.includes('--')) {
      const parts = format.split('--');
      actualFormat = parts[0];
      audioFormat = parts[1]; // mp3, m4a 等
    }

    // 构建 yt-dlp 参数
    const args = [
      ...getCookiesArgs(),
      '-f', actualFormat,
      '-o', tempFilePath + '.%(ext)s',
      '--no-playlist',
      '--no-warnings',
    ];

    // 如果需要音频转换
    if (audioFormat) {
      args.push('-x'); // 提取音频
      args.push('--audio-format', audioFormat);
      args.push('--audio-quality', '0'); // 最高质量
    }

    args.push(url);

    console.log('yt-dlp args:', args);

    // 执行 yt-dlp 下载
    const ytdlp = spawn('yt-dlp', args);

    let stderr = '';

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('yt-dlp:', data.toString());
    });

    ytdlp.stdout.on('data', (data) => {
      console.log('yt-dlp stdout:', data.toString());
    });

    ytdlp.on('close', async (code) => {
      if (code !== 0) {
        console.error('yt-dlp failed:', stderr);
        return res.status(500).json({ error: 'Download failed: ' + stderr });
      }

      // 查找下载的文件
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith(`ytdl-${tempId}`));

      if (files.length === 0) {
        return res.status(500).json({ error: 'Downloaded file not found' });
      }

      const downloadedFile = path.join(tempDir, files[0]);
      const ext = path.extname(files[0]);
      const stat = fs.statSync(downloadedFile);

      // 获取视频标题作为文件名
      let filename = `download${ext}`;
      try {
        const { execSync } = require('child_process');
        const cookiesArg = config.COOKIES_FROM_BROWSER ? `--cookies-from-browser ${config.COOKIES_FROM_BROWSER}` : (config.COOKIES_FILE ? `--cookies ${path.resolve(__dirname, '../../', config.COOKIES_FILE)}` : '');
        const title = execSync(`yt-dlp ${cookiesArg} --get-title --no-warnings "${url}"`, { encoding: 'utf-8' }).trim();
        if (title) {
          // 清理文件名
          filename = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 200) + ext;
        }
      } catch (e) {
        console.log('Failed to get title:', e.message);
      }

      // ASCII 安全的文件名
      const asciiFilename = filename
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim() || `download${ext}`;

      // 设置响应头
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

      // 流式返回文件
      const readStream = fs.createReadStream(downloadedFile);
      readStream.pipe(res);

      // 下载完成后删除临时文件
      readStream.on('close', () => {
        fs.unlink(downloadedFile, (err) => {
          if (err) console.error('Failed to delete temp file:', err);
        });
      });
    });

    ytdlp.on('error', (err) => {
      console.error('yt-dlp spawn error:', err);
      res.status(500).json({ error: 'Failed to start yt-dlp: ' + err.message });
    });

  } catch (error) {
    console.error('Error in proxy download:', error);
    res.status(500).json({ error: error.message || 'Failed to download' });
  }
});

// ===== 批量下载队列 API =====

/**
 * POST /api/queue/create
 * 创建批量下载任务
 * Body: { urls: string[], format: string }
 */
router.post('/queue/create', (req, res) => {
  const { urls, format = 'best' } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid urls' });
  }

  const taskId = downloadQueue.createTask(urls, format);
  res.json({ taskId, total: urls.length });
});

/**
 * GET /api/queue/status/:taskId
 * 获取任务状态
 */
router.get('/queue/status/:taskId', (req, res) => {
  const { taskId } = req.params;
  const status = downloadQueue.getTaskStatus(taskId);

  if (!status) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(status);
});

/**
 * GET /api/queue/next/:taskId
 * 获取下一个已完成的文件
 */
router.get('/queue/next/:taskId', (req, res) => {
  const { taskId } = req.params;
  const file = downloadQueue.getNextCompletedFile(taskId);

  if (!file) {
    return res.json({ hasFile: false });
  }

  res.json({
    hasFile: true,
    index: file.index,
    filename: file.filename
  });
});

/**
 * GET /api/queue/download/:taskId/:index
 * 下载指定索引的文件
 */
router.get('/queue/download/:taskId/:index', (req, res) => {
  const { taskId, index } = req.params;
  const fs = require('fs');

  const fileInfo = downloadQueue.getFileInfo(taskId, parseInt(index));

  if (!fileInfo || !fs.existsSync(fileInfo.filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(fileInfo.filepath);

  // ASCII 安全的文件名
  const asciiFilename = fileInfo.filename
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim() || 'download';

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(fileInfo.filename)}`);

  const readStream = fs.createReadStream(fileInfo.filepath);
  readStream.pipe(res);
});

/**
 * DELETE /api/queue/:taskId
 * 清理任务
 */
router.delete('/queue/:taskId', (req, res) => {
  const { taskId } = req.params;
  downloadQueue.cleanupTask(taskId);
  res.json({ success: true });
});

/**
 * GET /api/health
 * 健康检查，同时验证 yt-dlp 是否可用
 */
router.get('/health', async (req, res) => {
  try {
    const { spawn } = require('child_process');

    const checkYtdlp = new Promise((resolve, reject) => {
      const process = spawn('yt-dlp', ['--version']);
      let version = '';

      process.stdout.on('data', (data) => {
        version += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(version.trim());
        } else {
          reject(new Error('yt-dlp not found'));
        }
      });

      process.on('error', () => {
        reject(new Error('yt-dlp not installed'));
      });
    });

    const ytdlpVersion = await checkYtdlp;

    res.json({
      status: 'ok',
      ytdlp: {
        installed: true,
        version: ytdlpVersion
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      ytdlp: {
        installed: false,
        error: error.message
      }
    });
  }
});

// ===== WebM 转 MP4 API =====

// 配置 multer 用于视频文件上传
const videoUpload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB 限制
  fileFilter: (req, file, cb) => {
    const allowedExt = ['.webm', '.mkv', '.avi', '.mov', '.flv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件格式: ${ext}。支持的格式: ${allowedExt.join(', ')}`));
    }
  }
});

/**
 * POST /api/convert-webm
 * 将 WebM 等视频文件转换为 MP4
 */
router.post('/convert-webm', videoUpload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择视频文件' });
  }

  const { spawn } = require('child_process');
  const os = require('os');

  const inputPath = req.file.path;
  const originalName = req.file.originalname;
  const baseName = path.basename(originalName, path.extname(originalName));
  const outputName = `${baseName}.mp4`;
  const outputPath = path.join(os.tmpdir(), `convert-${Date.now()}-${outputName}`);

  console.log(`Converting: ${originalName} -> ${outputName}`);

  try {
    // 使用 ffmpeg 进行转换
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-crf', '23',
      '-preset', 'fast',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-y', // 覆盖已存在的文件
      outputPath
    ]);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      // 可以从 stderr 中解析进度信息
    });

    ffmpeg.on('close', (code) => {
      // 删除上传的原始文件
      fs.unlink(inputPath, (err) => {
        if (err) console.error('Failed to delete uploaded file:', err);
      });

      if (code !== 0) {
        console.error('ffmpeg failed:', stderr);
        return res.status(500).json({ error: '转换失败: ' + stderr.slice(-500) });
      }

      // 检查输出文件是否存在
      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({ error: '转换后的文件未找到' });
      }

      const stat = fs.statSync(outputPath);

      // ASCII 安全的文件名
      const asciiFilename = outputName
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim() || 'converted.mp4';

      // 设置响应头
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(outputName)}`);

      // 流式返回文件
      const readStream = fs.createReadStream(outputPath);
      readStream.pipe(res);

      // 下载完成后删除临时文件
      readStream.on('close', () => {
        fs.unlink(outputPath, (err) => {
          if (err) console.error('Failed to delete converted file:', err);
        });
      });
    });

    ffmpeg.on('error', (err) => {
      // 删除上传的原始文件
      fs.unlink(inputPath, () => { });
      console.error('ffmpeg spawn error:', err);
      res.status(500).json({ error: 'ffmpeg 启动失败，请确保已安装 ffmpeg: ' + err.message });
    });

  } catch (error) {
    // 清理上传的文件
    fs.unlink(inputPath, () => { });
    console.error('Convert error:', error);
    res.status(500).json({ error: error.message || '转换失败' });
  }
});

// ===== Cookies 管理 API =====

/**
 * GET /api/cookies/status
 * 检查 cookies 文件状态
 */
router.get('/cookies/status', (req, res) => {
  const cookiesPath = config.COOKIES_FILE
    ? path.resolve(__dirname, '../../', config.COOKIES_FILE)
    : null;

  if (!cookiesPath) {
    return res.json({
      configured: false,
      message: '未配置 cookies 文件路径'
    });
  }

  try {
    if (!fs.existsSync(cookiesPath)) {
      return res.json({
        configured: true,
        exists: false,
        path: config.COOKIES_FILE,
        message: 'cookies.txt 文件不存在，请上传'
      });
    }

    const stats = fs.statSync(cookiesPath);
    const content = fs.readFileSync(cookiesPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));

    // 检查是否是有效的 Netscape cookies 格式
    const isValidFormat = lines.length > 0 && lines.some(l => l.includes('.youtube.com'));

    // 检查文件是否太旧（超过7天提醒更新）
    const ageMs = Date.now() - stats.mtime.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const isStale = ageDays > 7;

    res.json({
      configured: true,
      exists: true,
      path: config.COOKIES_FILE,
      valid: isValidFormat,
      cookieCount: lines.length,
      lastModified: stats.mtime.toISOString(),
      ageDays,
      isStale,
      message: isValidFormat
        ? (isStale ? `cookies 文件已 ${ageDays} 天未更新，建议重新导出` : 'cookies 文件有效')
        : 'cookies 文件格式无效，请使用 Netscape 格式导出'
    });
  } catch (error) {
    res.status(500).json({
      configured: true,
      error: error.message
    });
  }
});

/**
 * POST /api/cookies/upload
 * 上传 cookies 文件
 */
router.post('/cookies/upload', cookiesUpload.single('cookies'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择文件' });
  }

  const cookiesPath = config.COOKIES_FILE
    ? path.resolve(__dirname, '../../', config.COOKIES_FILE)
    : path.resolve(__dirname, '../../cookies.txt');

  try {
    // 读取上传的文件内容
    const content = fs.readFileSync(req.file.path, 'utf-8');

    // 简单验证格式
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const hasYouTubeCookies = lines.some(l => l.includes('.youtube.com') || l.includes('.google.com'));

    if (!hasYouTubeCookies) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: '文件中未找到 YouTube 相关的 cookies，请确保已登录 YouTube 后导出'
      });
    }

    // 移动到目标位置
    fs.copyFileSync(req.file.path, cookiesPath);
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      cookieCount: lines.length,
      message: `成功上传 ${lines.length} 条 cookies`
    });
  } catch (error) {
    // 清理临时文件
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: '保存文件失败: ' + error.message });
  }
});

/**
 * DELETE /api/cookies
 * 删除 cookies 文件
 */
router.delete('/cookies', (req, res) => {
  const cookiesPath = config.COOKIES_FILE
    ? path.resolve(__dirname, '../../', config.COOKIES_FILE)
    : null;

  if (!cookiesPath || !fs.existsSync(cookiesPath)) {
    return res.json({ success: true, message: '文件不存在' });
  }

  try {
    fs.unlinkSync(cookiesPath);
    res.json({ success: true, message: '已删除 cookies 文件' });
  } catch (error) {
    res.status(500).json({ error: '删除失败: ' + error.message });
  }
});

module.exports = router;
