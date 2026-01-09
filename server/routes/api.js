/**
 * API 路由
 * 提供视频信息、格式列表、下载链接等接口
 */

const express = require('express');
const router = express.Router();
const ytdlp = require('../services/ytdlp');
const downloadQueue = require('../services/downloadQueue');

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
        const title = execSync(`yt-dlp --get-title --no-warnings "${url}"`, { encoding: 'utf-8' }).trim();
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

module.exports = router;
