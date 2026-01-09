/**
 * 下载队列管理器
 * 管理批量下载任务，按顺序执行
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 下载队列
const downloadQueue = new Map(); // taskId -> { items: [], currentIndex: number, status: string }
const completedFiles = new Map(); // taskId -> [{ filename, filepath }]

/**
 * 创建新的下载任务
 */
function createTask(urls, format) {
  const taskId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  downloadQueue.set(taskId, {
    items: urls.map(url => ({
      url,
      format,
      status: 'pending', // pending, downloading, completed, error
      filename: null,
      filepath: null,
      error: null
    })),
    currentIndex: 0,
    status: 'processing'
  });
  
  completedFiles.set(taskId, []);
  
  // 开始处理队列
  processQueue(taskId);
  
  return taskId;
}

/**
 * 处理队列中的下载任务
 */
async function processQueue(taskId) {
  const task = downloadQueue.get(taskId);
  if (!task) return;
  
  while (task.currentIndex < task.items.length) {
    const item = task.items[task.currentIndex];
    item.status = 'downloading';
    
    try {
      const result = await downloadFile(item.url, item.format);
      item.status = 'completed';
      item.filename = result.filename;
      item.filepath = result.filepath;
      
      // 添加到已完成列表
      completedFiles.get(taskId).push({
        index: task.currentIndex,
        filename: result.filename,
        filepath: result.filepath
      });
      
      console.log(`[Queue] Completed ${task.currentIndex + 1}/${task.items.length}: ${result.filename}`);
    } catch (error) {
      item.status = 'error';
      item.error = error.message;
      console.error(`[Queue] Error downloading:`, error.message);
    }
    
    task.currentIndex++;
  }
  
  task.status = 'completed';
  console.log(`[Queue] Task ${taskId} completed`);
}

/**
 * 下载单个文件
 */
function downloadFile(url, format) {
  return new Promise((resolve, reject) => {
    const tempDir = os.tmpdir();
    const tempId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const tempFilePath = path.join(tempDir, `ytdl-${tempId}`);
    
    // 解析格式
    let actualFormat = format;
    let audioFormat = null;
    
    if (format.includes('--')) {
      const parts = format.split('--');
      actualFormat = parts[0];
      audioFormat = parts[1];
    }
    
    // 构建 yt-dlp 参数
    const args = [
      '-f', actualFormat,
      '-o', tempFilePath + '.%(ext)s',
      '--no-playlist',
      '--no-warnings',
    ];
    
    if (audioFormat) {
      args.push('-x');
      args.push('--audio-format', audioFormat);
      args.push('--audio-quality', '0');
    }
    
    args.push(url);
    
    console.log('[Queue] Downloading:', url);
    
    const ytdlp = spawn('yt-dlp', args);
    let stderr = '';
    
    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ytdlp.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr));
      }
      
      // 查找下载的文件
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith(`ytdl-${tempId}`));
      
      if (files.length === 0) {
        return reject(new Error('Downloaded file not found'));
      }
      
      const downloadedFile = path.join(tempDir, files[0]);
      const ext = path.extname(files[0]);
      
      // 获取视频标题
      let filename = `download${ext}`;
      try {
        const title = execSync(`yt-dlp --get-title --no-warnings "${url}"`, { encoding: 'utf-8' }).trim();
        if (title) {
          filename = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 200) + ext;
        }
      } catch (e) {
        // 忽略
      }
      
      resolve({
        filename,
        filepath: downloadedFile
      });
    });
    
    ytdlp.on('error', reject);
  });
}

/**
 * 获取任务状态
 */
function getTaskStatus(taskId) {
  const task = downloadQueue.get(taskId);
  if (!task) return null;
  
  return {
    status: task.status,
    total: task.items.length,
    completed: task.items.filter(i => i.status === 'completed').length,
    current: task.currentIndex,
    items: task.items.map(i => ({
      status: i.status,
      filename: i.filename,
      error: i.error
    }))
  };
}

/**
 * 获取下一个已完成的文件（用于下载）
 */
function getNextCompletedFile(taskId) {
  const files = completedFiles.get(taskId);
  if (!files || files.length === 0) return null;
  
  return files.shift(); // 取出第一个
}

/**
 * 获取文件信息（用于下载）
 */
function getFileInfo(taskId, index) {
  const task = downloadQueue.get(taskId);
  if (!task || !task.items[index]) return null;
  
  const item = task.items[index];
  if (item.status !== 'completed') return null;
  
  return {
    filename: item.filename,
    filepath: item.filepath
  };
}

/**
 * 清理任务
 */
function cleanupTask(taskId) {
  const task = downloadQueue.get(taskId);
  if (task) {
    // 删除所有临时文件
    task.items.forEach(item => {
      if (item.filepath && fs.existsSync(item.filepath)) {
        fs.unlinkSync(item.filepath);
      }
    });
  }
  downloadQueue.delete(taskId);
  completedFiles.delete(taskId);
}

module.exports = {
  createTask,
  getTaskStatus,
  getNextCompletedFile,
  getFileInfo,
  cleanupTask
};
