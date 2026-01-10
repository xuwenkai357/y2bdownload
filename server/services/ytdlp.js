/**
 * yt-dlp 服务封装
 * 通过子进程调用 yt-dlp 命令行工具获取视频信息和下载链接
 */

const { spawn } = require('child_process');
const path = require('path');
const config = require('../config');

/**
 * 获取 cookies 参数
 * @returns {string[]} - cookies 相关的命令行参数
 */
function getCookiesArgs() {
  if (config.COOKIES_FILE) {
    // 使用 cookies 文件
    const cookiesPath = path.resolve(__dirname, '../../', config.COOKIES_FILE);
    return ['--cookies', cookiesPath];
  } else if (config.COOKIES_FROM_BROWSER) {
    // 从浏览器获取 cookies
    return ['--cookies-from-browser', config.COOKIES_FROM_BROWSER];
  }
  return [];
}

/**
 * 执行 yt-dlp 命令并返回 JSON 结果
 * @param {string[]} args - yt-dlp 命令参数
 * @returns {Promise<object>} - 解析后的 JSON 对象
 */
function executeYtdlp(args) {
  return new Promise((resolve, reject) => {
    const process = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        // 如果不是 JSON，直接返回字符串
        resolve(stdout.trim());
      }
    });

    process.on('error', (err) => {
      reject(new Error(`Failed to start yt-dlp: ${err.message}. Make sure yt-dlp is installed.`));
    });
  });
}

/**
 * 获取视频/播放列表信息
 * @param {string} url - YouTube URL
 * @returns {Promise<object>} - 视频信息对象
 */
async function getVideoInfo(url) {
  const args = [
    ...getCookiesArgs(),
    '--dump-json',
    '--no-download',
    '--no-warnings',
    url
  ];

  const result = await executeYtdlp(args);

  // 格式化返回数据
  return {
    id: result.id,
    title: result.title,
    description: result.description,
    thumbnail: result.thumbnail,
    duration: result.duration,
    uploader: result.uploader,
    uploader_id: result.uploader_id,
    view_count: result.view_count,
    upload_date: result.upload_date,
    webpage_url: result.webpage_url,
  };
}

/**
 * 获取播放列表信息
 * @param {string} url - YouTube 播放列表 URL
 * @returns {Promise<object>} - 播放列表信息
 */
async function getPlaylistInfo(url) {
  const args = [
    ...getCookiesArgs(),
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    url
  ];

  return new Promise((resolve, reject) => {
    const process = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        return;
      }

      try {
        // 每行是一个 JSON 对象
        const lines = stdout.trim().split('\n').filter(line => line);
        const videos = lines.map(line => {
          const item = JSON.parse(line);
          return {
            id: item.id,
            title: item.title,
            duration: item.duration,
            uploader: item.uploader,
            url: item.url || `https://www.youtube.com/watch?v=${item.id}`
          };
        });

        resolve({
          title: videos.length > 0 ? '播放列表' : '未知播放列表',
          videoCount: videos.length,
          videos
        });
      } catch (e) {
        reject(new Error('Failed to parse playlist data'));
      }
    });

    process.on('error', (err) => {
      reject(new Error(`Failed to start yt-dlp: ${err.message}`));
    });
  });
}

/**
 * 获取可用的下载格式列表
 * @param {string} url - YouTube URL
 * @returns {Promise<object>} - 格式列表
 */
async function getFormats(url) {
  const args = [
    ...getCookiesArgs(),
    '--dump-json',
    '--no-download',
    '--no-warnings',
    url
  ];

  const result = await executeYtdlp(args);

  if (!result.formats) {
    throw new Error('No formats available');
  }

  // 分类并格式化
  const videoFormats = [];
  const audioFormats = [];

  for (const format of result.formats) {
    const formatInfo = {
      format_id: format.format_id,
      ext: format.ext,
      resolution: format.resolution || 'audio only',
      filesize: format.filesize || format.filesize_approx,
      tbr: format.tbr, // 总比特率
      vcodec: format.vcodec,
      acodec: format.acodec,
      format_note: format.format_note,
    };

    if (format.vcodec && format.vcodec !== 'none') {
      // 视频格式
      formatInfo.width = format.width;
      formatInfo.height = format.height;
      formatInfo.fps = format.fps;
      videoFormats.push(formatInfo);
    } else if (format.acodec && format.acodec !== 'none') {
      // 纯音频格式
      formatInfo.abr = format.abr; // 音频比特率
      audioFormats.push(formatInfo);
    }
  }

  // 按分辨率/比特率排序
  videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
  audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0));

  return {
    video: {
      id: result.id,
      title: result.title,
      thumbnail: result.thumbnail,
      duration: result.duration,
      uploader: result.uploader,
    },
    formats: {
      video: videoFormats,
      audio: audioFormats,
      // 推荐的合并格式（最佳视频+最佳音频）
      recommended: [
        { format_id: 'bestvideo+bestaudio/best', label: '最佳质量', note: '自动选择最高画质' },
        { format_id: 'bestvideo[height<=1080]+bestaudio/best', label: '1080p', note: '全高清' },
        { format_id: 'bestvideo[height<=720]+bestaudio/best', label: '720p', note: '高清' },
        { format_id: 'bestvideo[height<=480]+bestaudio/best', label: '480p', note: '标清' },
        { format_id: 'bestaudio--mp3', label: 'MP3', note: '320kbps (需要ffmpeg)', ext: 'mp3', needsConvert: true },
      ],
      // 音频格式选项
      audioPresets: [
        { format_id: 'bestaudio', label: '最佳音质', note: '原始格式 (m4a/webm)', ext: 'auto' },
        { format_id: 'bestaudio--mp3', label: 'MP3', note: '320kbps (需要ffmpeg)', ext: 'mp3', needsConvert: true },
        { format_id: 'bestaudio--m4a', label: 'M4A', note: 'AAC音频', ext: 'm4a', needsConvert: true },
      ]
    }
  };
}

/**
 * 获取直接下载链接
 * @param {string} url - YouTube URL
 * @param {string} formatId - 格式 ID
 * @returns {Promise<string>} - 下载链接
 */
async function getDownloadUrl(url, formatId = 'best') {
  const args = [
    ...getCookiesArgs(),
    '-f', formatId,
    '-g', // 只输出 URL
    '--no-warnings',
    url
  ];

  const result = await executeYtdlp(args);

  // 可能返回多个 URL（视频和音频分开）
  const urls = result.split('\n').filter(u => u.trim());

  return {
    urls,
    // 如果只有一个 URL，可以直接下载
    // 如果有两个，需要合并（通常前端无法处理，需要后端代理）
    canDirectDownload: urls.length === 1
  };
}

/**
 * 获取带文件名的下载信息
 * @param {string} url - YouTube URL
 * @param {string} formatId - 格式 ID
 * @returns {Promise<object>} - 下载信息
 */
async function getDownloadInfo(url, formatId = 'best') {
  // 检查是否是需要转换的格式（如 bestaudio--mp3）
  let actualFormat = formatId;
  let needsConversion = false;
  let targetFormat = null;

  if (formatId.includes('--')) {
    const parts = formatId.split('--');
    actualFormat = parts[0]; // e.g., 'bestaudio'
    targetFormat = parts[1]; // e.g., 'mp3'
    needsConversion = true;
  }

  const args = [
    ...getCookiesArgs(),
    '-f', actualFormat,
    '--get-url',
    '--get-filename',
    '--no-warnings',
    url
  ];

  return new Promise((resolve, reject) => {
    const process = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        return;
      }

      const lines = stdout.trim().split('\n').filter(l => l);

      // 输出格式：URL(s) 在前，filename 在最后
      if (lines.length >= 2) {
        let filename = lines[lines.length - 1];
        const urls = lines.slice(0, -1);

        // 如果需要转换，修改文件扩展名提示
        if (needsConversion && targetFormat) {
          const extIndex = filename.lastIndexOf('.');
          if (extIndex > 0) {
            filename = filename.substring(0, extIndex) + '.' + targetFormat;
          }
        }

        resolve({
          filename,
          urls,
          canDirectDownload: urls.length === 1,
          needsConversion,
          targetFormat,
          note: needsConversion
            ? `下载后请使用 ffmpeg 转换为 ${targetFormat.toUpperCase()} 格式，或直接播放原始格式`
            : null
        });
      } else if (lines.length === 1) {
        // 只有 URL 没有文件名
        resolve({
          filename: 'video',
          urls: lines,
          canDirectDownload: true,
          needsConversion,
          targetFormat
        });
      } else {
        reject(new Error('Unexpected output format from yt-dlp'));
      }
    });

    process.on('error', (err) => {
      reject(new Error(`Failed to start yt-dlp: ${err.message}`));
    });
  });
}

module.exports = {
  getVideoInfo,
  getPlaylistInfo,
  getFormats,
  getDownloadUrl,
  getDownloadInfo,
};
