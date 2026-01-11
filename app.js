/**
 * YouTube Video Downloader
 * 使用本地 Node.js 后端 + yt-dlp 实现视频下载
 */

// ===== API 配置 =====
const API_BASE = 'http://localhost:3001';

// ===== DOM Elements =====
const elements = {
  urlInput: document.getElementById('urlInput'),
  parseBtn: document.getElementById('parseBtn'),
  errorSection: document.getElementById('errorSection'),
  errorMessage: document.getElementById('errorMessage'),
  videoSection: document.getElementById('videoSection'),
  videoThumbnail: document.getElementById('videoThumbnail'),
  videoDuration: document.getElementById('videoDuration'),
  videoTitle: document.getElementById('videoTitle'),
  videoAuthor: document.getElementById('videoAuthor'),
  videoFormats: document.getElementById('videoFormats'),
  audioFormats: document.getElementById('audioFormats'),
  qualityGrid: document.getElementById('qualityGrid'),
  audioOptions: document.getElementById('audioOptions'),
  downloadBtn: document.getElementById('downloadBtn'),
  playlistSection: document.getElementById('playlistSection'),
  playlistTitle: document.getElementById('playlistTitle'),
  playlistCount: document.getElementById('playlistCount'),
  playlistItems: document.getElementById('playlistItems'),
  selectAllBtn: document.getElementById('selectAllBtn'),
  downloadSelectedBtn: document.getElementById('downloadSelectedBtn'),
  downloadSelectedMp3Btn: document.getElementById('downloadSelectedMp3Btn'),
};

// ===== State =====
let currentState = {
  url: '',
  videoId: null,
  videoInfo: null,
  formats: null,
  selectedFormat: null,
  playlistVideos: [],
  selectedVideos: new Set(),
};

// ===== URL Parsing =====
function parseYouTubeUrl(url) {
  const result = { videoId: null, playlistId: null };

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      result.videoId = urlObj.searchParams.get('v');
      result.playlistId = urlObj.searchParams.get('list');
    } else if (hostname === 'youtu.be') {
      result.videoId = urlObj.pathname.slice(1);
      result.playlistId = urlObj.searchParams.get('list');
    }
  } catch (e) {
    console.error('URL parsing error:', e);
  }

  return result;
}

// ===== API Functions =====
async function fetchVideoInfo(url) {
  const response = await fetch(`${API_BASE}/api/info?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch video info');
  }
  return response.json();
}

async function fetchFormats(url) {
  const response = await fetch(`${API_BASE}/api/formats?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch formats');
  }
  return response.json();
}

async function fetchDownloadUrl(url, format) {
  const response = await fetch(`${API_BASE}/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(format)}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get download URL');
  }
  return response.json();
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// ===== UI Functions =====
function showError(message) {
  elements.errorSection.classList.remove('hidden');
  elements.errorMessage.textContent = message;
  elements.videoSection.classList.add('hidden');
  elements.playlistSection.classList.add('hidden');
}

function hideError() {
  elements.errorSection.classList.add('hidden');
}

function setLoading(isLoading) {
  elements.parseBtn.classList.toggle('loading', isLoading);
  elements.parseBtn.disabled = isLoading;
  elements.urlInput.disabled = isLoading;
}

function formatDuration(seconds) {
  if (!seconds) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// ===== Video Section =====
function showVideoSection(videoInfo, formats) {
  hideError();
  elements.videoSection.classList.remove('hidden');
  elements.playlistSection.classList.add('hidden');

  currentState.videoInfo = videoInfo;
  currentState.formats = formats;

  // 设置视频信息
  elements.videoThumbnail.src = videoInfo.thumbnail || `https://img.youtube.com/vi/${videoInfo.id}/maxresdefault.jpg`;
  elements.videoThumbnail.onerror = () => {
    elements.videoThumbnail.src = `https://img.youtube.com/vi/${videoInfo.id}/hqdefault.jpg`;
  };
  elements.videoTitle.textContent = videoInfo.title;
  elements.videoAuthor.textContent = videoInfo.uploader || '';
  elements.videoDuration.textContent = formatDuration(videoInfo.duration);

  // 渲染格式选择
  renderFormatOptions(formats);
}

function renderFormatOptions(formats) {
  const formatSection = document.querySelector('.format-section');

  // 推荐格式（为 MP3 添加特殊样式）
  const recommendedHtml = formats.formats.recommended.map((fmt, index) => {
    return `
        <div class="quality-option ${index === 0 ? 'selected' : ''}" 
             data-format="${fmt.format_id}">
            <span class="quality-label">${fmt.label}</span>
            <span class="quality-note">${fmt.note}</span>
        </div>
    `;
  }).join('');

  // 详细视频格式
  const videoFormatsHtml = formats.formats.video.slice(0, 10).map(fmt => `
        <div class="quality-option detailed" data-format="${fmt.format_id}">
            <span class="quality-label">${fmt.height ? fmt.height + 'p' : fmt.resolution}</span>
            <span class="quality-meta">
                ${fmt.ext} · ${fmt.fps ? fmt.fps + 'fps' : ''} ${formatFileSize(fmt.filesize)}
            </span>
        </div>
    `).join('');

  // 音频预设（MP3、M4A等）
  const audioPresetsHtml = (formats.formats.audioPresets || []).map((fmt, index) => `
        <div class="audio-option preset ${index === 0 ? 'selected' : ''}" 
             data-format="${fmt.format_id}"
             data-needs-convert="${fmt.needsConvert || false}">
            <span class="audio-label">${fmt.label}</span>
            <span class="audio-meta">${fmt.note}</span>
        </div>
    `).join('');

  // 原始音频格式
  const audioFormatsHtml = formats.formats.audio.slice(0, 5).map(fmt => `
        <div class="audio-option" data-format="${fmt.format_id}">
            <span class="audio-label">${fmt.ext.toUpperCase()}</span>
            <span class="audio-meta">${fmt.abr ? fmt.abr + 'kbps' : ''} ${formatFileSize(fmt.filesize)}</span>
        </div>
    `).join('');

  formatSection.innerHTML = `
        <h3 class="section-title">选择格式</h3>
        <div class="format-tabs">
            <button class="format-tab active" data-type="recommended">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                推荐
            </button>
            <button class="format-tab" data-type="video">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                    <line x1="7" y1="2" x2="7" y2="22"></line>
                    <line x1="17" y1="2" x2="17" y2="22"></line>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                </svg>
                视频
            </button>
            <button class="format-tab" data-type="audio">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
                音频
            </button>
        </div>
        
        <div id="recommendedFormats" class="format-options">
            <div class="quality-grid">${recommendedHtml}</div>
        </div>
        
        <div id="videoFormats" class="format-options hidden">
            <div class="quality-grid detailed-grid">${videoFormatsHtml}</div>
        </div>
        
        <div id="audioFormats" class="format-options hidden">
            <p class="audio-section-label">常用格式</p>
            <div class="audio-options">${audioPresetsHtml}</div>
            <p class="audio-section-label" style="margin-top: 16px;">原始格式</p>
            <div class="audio-options">${audioFormatsHtml}</div>
        </div>
    `;

  // 添加样式
  addFormatStyles();

  // 绑定事件
  bindFormatEvents();

  // 默认选中第一个推荐格式
  currentState.selectedFormat = formats.formats.recommended[0].format_id;
  updateDownloadButton();
}

function addFormatStyles() {
  if (document.getElementById('format-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'format-styles';
  styles.textContent = `
        .quality-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 10px;
        }
        
        .detailed-grid {
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        }
        
        .quality-option {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: var(--bg-card);
            border: 2px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 16px 12px;
            cursor: pointer;
            transition: all var(--transition-fast);
        }
        
        .quality-option:hover {
            border-color: var(--border-hover);
            background: var(--bg-card-hover);
        }
        
        .quality-option.selected {
            border-color: var(--accent-primary);
            background: rgba(255, 0, 80, 0.08);
        }
        
        .quality-label {
            font-weight: 600;
            font-size: 1.1rem;
            margin-bottom: 4px;
        }
        
        .quality-note, .quality-meta {
            font-size: 0.75rem;
            color: var(--text-muted);
            text-align: center;
        }
        
        .audio-options {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .audio-option {
            display: flex;
            align-items: center;
            gap: 12px;
            background: var(--bg-card);
            border: 2px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 14px 20px;
            cursor: pointer;
            transition: all var(--transition-fast);
        }
        
        .audio-option:hover {
            border-color: var(--border-hover);
        }
        
        .audio-option.selected {
            border-color: var(--accent-primary);
            background: rgba(255, 0, 80, 0.08);
        }
        
        .audio-label {
            font-weight: 600;
        }
        
        .audio-meta {
            font-size: 0.8rem;
            color: var(--text-muted);
        }
        
        .audio-section-label {
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-bottom: 10px;
            font-weight: 500;
        }
        
        .audio-option.preset {
            border-color: var(--accent-secondary, #00d4aa);
        }
        
        .quality-option.audio-preset {
            border-color: #00c853;
        }
        
        .quality-option.audio-preset.selected {
            border-color: #00c853;
            background: rgba(0, 200, 83, 0.15);
        }
        
        .toast {
            position: fixed;
            top: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(-100px);
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 16px 32px;
            border-radius: var(--radius-md);
            font-size: 1.1rem;
            font-weight: 500;
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        .toast.show {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        
        .download-btn.loading {
            pointer-events: none;
            opacity: 0.7;
        }
        
        .download-btn.loading span::after {
            content: '...';
            animation: dots 1.5s infinite;
        }
        
        @keyframes dots {
            0%, 20% { content: '.'; }
            40% { content: '..'; }
            60%, 100% { content: '...'; }
        }
    `;
  document.head.appendChild(styles);
}

function bindFormatEvents() {
  // Tab 切换
  document.querySelectorAll('.format-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const type = tab.dataset.type;

      document.querySelectorAll('.format-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.format-options').forEach(panel => {
        panel.classList.add('hidden');
      });

      if (type === 'recommended') {
        document.getElementById('recommendedFormats').classList.remove('hidden');
      } else if (type === 'video') {
        document.getElementById('videoFormats').classList.remove('hidden');
      } else if (type === 'audio') {
        document.getElementById('audioFormats').classList.remove('hidden');
      }
    });
  });

  // 格式选择
  document.querySelectorAll('.quality-option, .audio-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.quality-option, .audio-option').forEach(o => {
        o.classList.remove('selected');
      });
      option.classList.add('selected');
      currentState.selectedFormat = option.dataset.format;
      updateDownloadButton();
    });
  });
}

function updateDownloadButton() {
  elements.downloadBtn.disabled = !currentState.selectedFormat;
  elements.downloadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>下载</span>
    `;
}

// ===== Playlist Section =====
function showPlaylistSection(playlistData) {
  hideError();
  elements.videoSection.classList.add('hidden');
  elements.playlistSection.classList.remove('hidden');

  currentState.playlistVideos = playlistData.videos || [];
  currentState.selectedVideos = new Set();

  elements.playlistTitle.textContent = playlistData.title || '播放列表';
  elements.playlistCount.textContent = `共 ${currentState.playlistVideos.length} 个视频`;

  if (currentState.playlistVideos.length === 0) {
    elements.playlistItems.innerHTML = `
            <div class="playlist-empty">
                <p>播放列表为空或无法访问</p>
            </div>
        `;
    return;
  }

  elements.playlistItems.innerHTML = currentState.playlistVideos.map((video, index) => `
        <div class="playlist-item" data-index="${index}" data-video-id="${video.id}">
            <input type="checkbox" class="playlist-checkbox" data-index="${index}">
            <img class="playlist-item-thumb" 
                 src="https://img.youtube.com/vi/${video.id}/mqdefault.jpg" 
                 alt="${video.title}"
                 onerror="this.src='https://img.youtube.com/vi/${video.id}/default.jpg'">
            <div class="playlist-item-info">
                <div class="playlist-item-title" title="${video.title}">${video.title}</div>
                <div class="playlist-item-meta">
                    <span class="playlist-item-author">${video.uploader || '未知'}</span>
                    <span class="playlist-item-duration">${formatDuration(video.duration)}</span>
                </div>
            </div>
            <button class="playlist-item-download" data-video-url="${video.url}" title="单独下载">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            </button>
        </div>
    `).join('');

  addPlaylistStyles();
  bindPlaylistEvents();
  updatePlaylistButtons();
}

function addPlaylistStyles() {
  if (document.getElementById('playlist-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'playlist-styles';
  styles.textContent = `
        .playlist-empty {
            text-align: center;
            padding: 48px 24px;
            color: var(--text-muted);
        }
        
        .playlist-item {
            display: flex;
            align-items: center;
            gap: 12px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 12px;
            transition: all var(--transition-fast);
        }
        
        .playlist-item:hover {
            border-color: var(--border-hover);
            background: var(--bg-card-hover);
        }
        
        .playlist-item.selected {
            border-color: var(--accent-primary);
            background: rgba(255, 0, 80, 0.05);
        }
        
        .playlist-checkbox {
            width: 18px;
            height: 18px;
            accent-color: var(--accent-primary);
            cursor: pointer;
            flex-shrink: 0;
        }
        
        .playlist-item-thumb {
            width: 120px;
            aspect-ratio: 16/9;
            object-fit: cover;
            border-radius: var(--radius-sm);
            flex-shrink: 0;
        }
        
        .playlist-item-info {
            flex: 1;
            min-width: 0;
        }
        
        .playlist-item-title {
            font-size: 0.95rem;
            font-weight: 500;
            margin-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .playlist-item-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.8rem;
            color: var(--text-muted);
        }
        
        .playlist-item-download {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-sm);
            padding: 8px;
            cursor: pointer;
            transition: all var(--transition-fast);
            flex-shrink: 0;
        }
        
        .playlist-item-download svg {
            width: 18px;
            height: 18px;
            color: var(--text-secondary);
            display: block;
        }
        
        .playlist-item-download:hover {
            border-color: var(--accent-primary);
            background: rgba(255, 0, 80, 0.1);
        }
        
        .playlist-item-download:hover svg {
            color: var(--accent-primary);
        }
    `;
  document.head.appendChild(styles);
}

function bindPlaylistEvents() {
  // 复选框事件
  document.querySelectorAll('.playlist-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      const item = e.target.closest('.playlist-item');

      if (e.target.checked) {
        currentState.selectedVideos.add(index);
        item.classList.add('selected');
      } else {
        currentState.selectedVideos.delete(index);
        item.classList.remove('selected');
      }

      updatePlaylistButtons();
    });
  });

  // 单独下载按钮
  document.querySelectorAll('.playlist-item-download').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const videoUrl = btn.dataset.videoUrl;
      await handleSingleDownload(videoUrl);
    });
  });

  // 全选按钮
  elements.selectAllBtn.addEventListener('click', () => {
    const allSelected = currentState.selectedVideos.size === currentState.playlistVideos.length;

    if (allSelected) {
      currentState.selectedVideos.clear();
      document.querySelectorAll('.playlist-checkbox').forEach(cb => cb.checked = false);
      document.querySelectorAll('.playlist-item').forEach(item => item.classList.remove('selected'));
      elements.selectAllBtn.textContent = '全选';
    } else {
      currentState.playlistVideos.forEach((_, index) => currentState.selectedVideos.add(index));
      document.querySelectorAll('.playlist-checkbox').forEach(cb => cb.checked = true);
      document.querySelectorAll('.playlist-item').forEach(item => item.classList.add('selected'));
      elements.selectAllBtn.textContent = '取消全选';
    }

    updatePlaylistButtons();
  });

  // 下载选中按钮
  elements.downloadSelectedBtn.addEventListener('click', async () => {
    if (currentState.selectedVideos.size === 0) return;

    showToast(`正在获取 ${currentState.selectedVideos.size} 个视频的下载链接...`);

    for (const index of currentState.selectedVideos) {
      const video = currentState.playlistVideos[index];
      await handleSingleDownload(video.url);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  });

  // 下载选中 MP3 按钮 - 使用队列系统
  elements.downloadSelectedMp3Btn.addEventListener('click', async () => {
    if (currentState.selectedVideos.size === 0) return;

    const urls = [];
    for (const index of currentState.selectedVideos) {
      urls.push(currentState.playlistVideos[index].url);
    }

    showToast(`正在创建下载任务 (${urls.length} 个文件)...`);

    try {
      // 创建批量下载任务
      const createRes = await fetch(`${API_BASE}/api/queue/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, format: 'bestaudio--mp3' })
      });
      const { taskId, total } = await createRes.json();

      showToast(`后台下载中... (0/${total})`);

      // 轮询状态并逐个下载
      let downloadedCount = 0;

      const pollInterval = setInterval(async () => {
        try {
          // 获取任务状态
          const statusRes = await fetch(`${API_BASE}/api/queue/status/${taskId}`);
          const status = await statusRes.json();

          // 检查是否有新完成的文件
          const nextRes = await fetch(`${API_BASE}/api/queue/next/${taskId}`);
          const next = await nextRes.json();

          if (next.hasFile) {
            // 触发下载
            const downloadUrl = `${API_BASE}/api/queue/download/${taskId}/${next.index}`;
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            downloadedCount++;
            showToast(`下载中... (${downloadedCount}/${total}) - ${next.filename}`);
          }

          // 检查是否全部完成
          if (status.status === 'completed' && downloadedCount >= total) {
            clearInterval(pollInterval);
            showToast(`✅ 全部下载完成 (${total} 个文件)`);

            // 清理任务
            setTimeout(() => {
              fetch(`${API_BASE}/api/queue/${taskId}`, { method: 'DELETE' });
            }, 5000);
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 2000); // 每 2 秒轮询一次

    } catch (error) {
      console.error('Queue error:', error);
      showToast('创建下载任务失败: ' + error.message);
    }
  });
}

function updatePlaylistButtons() {
  const count = currentState.selectedVideos.size;
  elements.downloadSelectedBtn.disabled = count === 0;
  elements.downloadSelectedBtn.textContent = count > 0 ? `下载选中 (${count})` : '下载选中';

  // 更新 MP3 按钮状态
  if (elements.downloadSelectedMp3Btn) {
    elements.downloadSelectedMp3Btn.disabled = count === 0;
    elements.downloadSelectedMp3Btn.textContent = count > 0 ? `🎵 下载MP3 (${count})` : '🎵 下载MP3';
  }

  if (count === currentState.playlistVideos.length && count > 0) {
    elements.selectAllBtn.textContent = '取消全选';
  } else {
    elements.selectAllBtn.textContent = '全选';
  }
}

// ===== Download Handler =====
async function handleSingleDownload(url) {
  try {
    const format = currentState.selectedFormat || 'best';

    // 使用代理下载 API，直接触发浏览器下载
    const proxyDownloadUrl = `${API_BASE}/api/proxy-download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(format)}`;

    // 使用 a 标签触发下载，更可靠
    const a = document.createElement('a');
    a.href = proxyDownloadUrl;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('下载已开始...');

  } catch (error) {
    console.error('Download error:', error);
    showToast('下载失败: ' + error.message);
  }
}

// 指定格式下载
async function handleDownloadWithFormat(url, format) {
  try {
    // 使用代理下载 API，直接触发浏览器下载
    const proxyDownloadUrl = `${API_BASE}/api/proxy-download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(format)}`;

    // 使用 a 标签触发下载，更可靠
    const a = document.createElement('a');
    a.href = proxyDownloadUrl;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

  } catch (error) {
    console.error('Download error:', error);
    showToast('下载失败: ' + error.message);
  }
}

// ===== Event Handlers =====
async function handleParse() {
  const url = elements.urlInput.value.trim();

  if (!url) {
    showError('请输入 YouTube 视频链接');
    return;
  }

  const parsed = parseYouTubeUrl(url);

  if (!parsed.videoId && !parsed.playlistId) {
    showError('无效的 YouTube 链接，请检查后重试');
    return;
  }

  currentState.url = url;
  currentState.videoId = parsed.videoId;

  setLoading(true);
  hideError();

  try {
    // 先检查后端是否可用
    const isHealthy = await checkHealth();
    if (!isHealthy) {
      throw new Error('后端服务未启动，请先运行 npm run dev:server');
    }

    // 获取视频信息和格式
    const infoResult = await fetchVideoInfo(url);

    if (infoResult.type === 'playlist') {
      showPlaylistSection(infoResult.data);
    } else {
      const formats = await fetchFormats(url);
      showVideoSection(infoResult.data, formats);
    }
  } catch (error) {
    console.error('Parse error:', error);
    showError(error.message || '解析失败，请稍后重试');
  } finally {
    setLoading(false);
  }
}

async function handleDownload() {
  if (!currentState.url || !currentState.selectedFormat) return;

  elements.downloadBtn.classList.add('loading');
  elements.downloadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
        </svg>
        <span>获取中</span>
    `;

  try {
    await handleSingleDownload(currentState.url);
  } finally {
    elements.downloadBtn.classList.remove('loading');
    updateDownloadButton();
  }
}

// ===== Cookies 管理 =====
const cookiesElements = {
  dot: document.getElementById('cookiesDot'),
  text: document.getElementById('cookiesText'),
  fileInput: document.getElementById('cookiesFileInput'),
  uploadLabel: document.getElementById('cookiesUploadLabel'),
};

async function checkCookiesStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/cookies/status`);
    const status = await response.json();

    updateCookiesUI(status);
    return status;
  } catch (error) {
    console.error('Failed to check cookies status:', error);
    updateCookiesUI({ error: '无法连接服务器' });
    return null;
  }
}

function updateCookiesUI(status) {
  if (!cookiesElements.dot || !cookiesElements.text) return;

  cookiesElements.dot.className = 'cookies-dot';

  if (status.error) {
    cookiesElements.dot.classList.add('error');
    cookiesElements.text.textContent = status.error;
  } else if (!status.exists) {
    cookiesElements.dot.classList.add('error');
    cookiesElements.text.textContent = '⚠️ 需要上传 cookies.txt 才能下载';
  } else if (!status.valid) {
    cookiesElements.dot.classList.add('error');
    cookiesElements.text.textContent = '❌ cookies 格式无效';
  } else if (status.isStale) {
    cookiesElements.dot.classList.add('warning');
    cookiesElements.text.textContent = `⚡ cookies 已 ${status.ageDays} 天，建议更新`;
  } else {
    cookiesElements.dot.classList.add('valid');
    cookiesElements.text.textContent = `✅ ${status.cookieCount} 条 cookies 已就绪`;
  }
}

async function uploadCookiesFile(file) {
  const formData = new FormData();
  formData.append('cookies', file);

  cookiesElements.uploadLabel?.classList.add('uploading');

  try {
    const response = await fetch(`${API_BASE}/api/cookies/upload`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      showToast(`✅ ${result.message}`);
      await checkCookiesStatus();
    } else {
      showToast(`❌ ${result.error}`);
    }
  } catch (error) {
    showToast('❌ 上传失败: ' + error.message);
  } finally {
    cookiesElements.uploadLabel?.classList.remove('uploading');
    if (cookiesElements.fileInput) {
      cookiesElements.fileInput.value = '';
    }
  }
}

function initCookiesUpload() {
  if (cookiesElements.fileInput) {
    cookiesElements.fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadCookiesFile(file);
      }
    });
  }
}

// ===== Initialize =====
async function init() {
  // 解析按钮点击
  elements.parseBtn.addEventListener('click', handleParse);

  // 输入框回车
  elements.urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleParse();
    }
  });

  // 下载按钮点击
  elements.downloadBtn.addEventListener('click', handleDownload);

  // 粘贴自动解析
  elements.urlInput.addEventListener('paste', () => {
    setTimeout(() => {
      if (elements.urlInput.value.includes('youtube.com') ||
        elements.urlInput.value.includes('youtu.be')) {
        handleParse();
      }
    }, 100);
  });

  // 初始化 cookies 上传
  initCookiesUpload();

  // 检查后端状态
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    console.warn('⚠️ Backend server is not running. Please start it with: npm run dev:server');
  }

  // 检查 cookies 状态
  await checkCookiesStatus();
}

// 启动应用
init();

