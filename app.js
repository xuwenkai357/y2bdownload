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

// ===== WebM 转 MP4 功能 =====
const convertElements = {
  // 方式一：生成命令
  fileInput: document.getElementById('convertFileInput'),
  dropZone: document.getElementById('convertDropZone'),
  commandOutput: document.getElementById('commandOutput'),
  commandText: document.getElementById('commandText'),
  copyCommandBtn: document.getElementById('copyCommandBtn'),
  // 方式二：上传转换
  uploadFileInput: document.getElementById('uploadConvertFileInput'),
  status: document.getElementById('convertStatus'),
  progressBar: document.getElementById('convertProgressBar'),
  statusText: document.getElementById('convertStatusText'),
};

/**
 * 方式一：根据文件路径生成 ffmpeg 命令
 */
function generateFfmpegCommand(file) {
  if (!file) return;

  // 检查文件类型
  const allowedExt = ['.webm', '.mkv', '.avi', '.mov', '.flv'];
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!allowedExt.includes(ext)) {
    showToast(`❌ 不支持的文件格式: ${ext}`);
    return;
  }

  // 生成输出文件名（将扩展名改为 .mp4）
  const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
  const outputName = `${baseName}.mp4`;

  // 直接使用文件名，用户需要先 cd 到文件所在目录
  const command = `ffmpeg -i "${file.name}" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k "${outputName}"`;

  // 显示命令
  convertElements.commandOutput.classList.remove('hidden');
  convertElements.commandText.textContent = command;

  // 提示用户先 cd 到目录
  showToast('📋 命令已生成，请先 cd 到文件所在目录再执行');
}

/**
 * 方式二：上传文件到服务器进行转换
 */
async function handleUploadConvert(file) {
  if (!file) return;

  // 检查文件类型
  const allowedExt = ['.webm', '.mkv', '.avi', '.mov', '.flv'];
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!allowedExt.includes(ext)) {
    showToast(`❌ 不支持的文件格式: ${ext}`);
    return;
  }

  // 显示状态区域
  convertElements.status.classList.remove('hidden');
  convertElements.progressBar.style.width = '20%';
  convertElements.statusText.textContent = `正在上传: ${file.name}...`;
  convertElements.statusText.className = 'convert-status-text';

  const formData = new FormData();
  formData.append('video', file);

  try {
    convertElements.progressBar.style.width = '40%';
    convertElements.statusText.textContent = '正在转换中，请稍候...';

    // 使用 fetch 获取转换后的文件
    const response = await fetch(`${API_BASE}/api/convert-webm`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '转换失败');
    }

    convertElements.progressBar.style.width = '80%';
    convertElements.statusText.textContent = '转换完成，正在下载...';

    // 获取文件名
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'converted.mp4';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
      if (filenameMatch) {
        filename = decodeURIComponent(filenameMatch[1]);
      }
    }

    // 创建下载链接
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    convertElements.progressBar.style.width = '100%';
    convertElements.statusText.textContent = `✅ 转换完成: ${filename}`;
    convertElements.statusText.className = 'convert-status-text success';

    showToast(`✅ 转换成功: ${filename}`);

    // 5秒后隐藏状态
    setTimeout(() => {
      convertElements.status.classList.add('hidden');
      convertElements.progressBar.style.width = '0%';
    }, 5000);

  } catch (error) {
    console.error('Convert error:', error);
    convertElements.statusText.textContent = `❌ ${error.message}`;
    convertElements.statusText.className = 'convert-status-text error';
    showToast(`❌ 转换失败: ${error.message}`);
  }
}

function initConvertUpload() {
  // 方式一：选择文件生成命令
  if (convertElements.fileInput) {
    convertElements.fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        generateFfmpegCommand(file);
      }
      e.target.value = '';
    });
  }

  // 方式一：拖放支持
  if (convertElements.dropZone) {
    convertElements.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      convertElements.dropZone.classList.add('dragover');
    });

    convertElements.dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      convertElements.dropZone.classList.remove('dragover');
    });

    convertElements.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      convertElements.dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files?.[0];
      if (file) {
        generateFfmpegCommand(file);
      }
    });
  }

  // 方式一：复制命令按钮
  if (convertElements.copyCommandBtn) {
    convertElements.copyCommandBtn.addEventListener('click', async () => {
      const command = convertElements.commandText.textContent;
      try {
        await navigator.clipboard.writeText(command);
        convertElements.copyCommandBtn.textContent = '已复制 ✓';
        convertElements.copyCommandBtn.classList.add('copied');
        showToast('✅ 命令已复制到剪贴板');

        setTimeout(() => {
          convertElements.copyCommandBtn.textContent = '复制命令';
          convertElements.copyCommandBtn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        showToast('❌ 复制失败，请手动复制');
      }
    });
  }

  // 方式二：上传文件转换
  if (convertElements.uploadFileInput) {
    convertElements.uploadFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUploadConvert(file);
      }
      e.target.value = '';
    });
  }
}

// ===== 音频截取工具 =====
const audioTrimElements = {
  fileInput: document.getElementById('audioTrimFileInput'),
  dropZone: document.getElementById('audioTrimDropZone'),
  workspace: document.getElementById('audioTrimWorkspace'),
  fileName: document.getElementById('audioTrimFileName'),
  duration: document.getElementById('audioTrimDuration'),
  loading: document.getElementById('audioTrimLoading'),
  loadingProgress: document.getElementById('audioTrimLoadingProgress'),
  loadingText: document.getElementById('audioTrimLoadingText'),
  player: document.getElementById('audioTrimPlayer'),
  playBtn: document.getElementById('audioTrimPlayBtn'),
  playIcon: document.getElementById('audioTrimPlayIcon'),
  playSelectionBtn: document.getElementById('audioTrimPlaySelectionBtn'),
  playStartBtn: document.getElementById('audioTrimPlayStartBtn'),
  playEndBtn: document.getElementById('audioTrimPlayEndBtn'),
  currentTime: document.getElementById('audioTrimCurrentTime'),
  totalTime: document.getElementById('audioTrimTotalTime'),
  canvas: document.getElementById('audioTrimCanvas'),
  rangeStart: document.getElementById('audioTrimRangeStart'),
  rangeEnd: document.getElementById('audioTrimRangeEnd'),
  rangeLength: document.getElementById('audioTrimRangeLength'),
  startInput: document.getElementById('audioTrimStartInput'),
  endInput: document.getElementById('audioTrimEndInput'),
  applyInputBtn: document.getElementById('audioTrimApplyInputBtn'),
  outputExt: document.getElementById('audioTrimOutputExt'),
  generateBtn: document.getElementById('audioTrimGenerateBtn'),
  commandOutput: document.getElementById('audioTrimCommandOutput'),
  commandText: document.getElementById('audioTrimCommandText'),
  copyBtn: document.getElementById('audioTrimCopyBtn'),
};

const audioTrimState = {
  file: null,
  audioUrl: null,
  audio: null,
  peaks: null,
  duration: 0,
  trimStart: 0,
  trimEnd: 0,
  currentTime: 0,
  isPlaying: false,
  playSelectionMode: false,
  playStopAt: null,
  dragging: null, // 'start' | 'end' | 'region' | null
  pointerDownX: 0,
  pointerDownHit: null,
  hasDragged: false,
  pendingSeekTime: null,
  dragStartX: 0,
  dragStartTrimStart: 0,
  dragStartTrimEnd: 0,
  canvasWidth: 0,
  canvasHeight: 0,
};

const PLAY_ICON = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
const PAUSE_ICON = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
const PEAK_COUNT = 3000;
const MIN_TRIM_GAP = 0.1;

function formatTimePrecise(seconds, withMs = true) {
  if (seconds == null || isNaN(seconds)) return withMs ? '00:00:00.000' : '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  const base = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  if (!withMs) return base;
  return `${base}.${ms.toString().padStart(3, '0')}`;
}

function parseTimeInput(str) {
  if (!str || !str.trim()) return null;
  str = str.trim();

  if (/^\d+(\.\d+)?$/.test(str)) {
    return parseFloat(str);
  }

  const parts = str.split(':').map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

function extractPeaks(audioBuffer, numPeaks) {
  const channelData = audioBuffer.getChannelData(0);
  const secondChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;
  const samplesPerPeak = Math.floor(channelData.length / numPeaks);
  const peaks = new Float32Array(numPeaks);

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, channelData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      let val = Math.abs(channelData[j]);
      if (secondChannel) val = Math.max(val, Math.abs(secondChannel[j]));
      if (val > max) max = val;
    }
    peaks[i] = max;
  }

  const maxPeak = Math.max(...peaks, 0.001);
  for (let i = 0; i < numPeaks; i++) {
    peaks[i] /= maxPeak;
  }

  return peaks;
}

function timeToX(time) {
  if (!audioTrimState.duration) return 0;
  return (time / audioTrimState.duration) * audioTrimState.canvasWidth;
}

function xToTime(x) {
  if (!audioTrimState.duration) return 0;
  return Math.max(0, Math.min(audioTrimState.duration, (x / audioTrimState.canvasWidth) * audioTrimState.duration));
}

function drawWaveform() {
  const canvas = audioTrimElements.canvas;
  if (!canvas || !audioTrimState.peaks) return;

  const ctx = canvas.getContext('2d');
  const w = audioTrimState.canvasWidth;
  const h = audioTrimState.canvasHeight;
  const peaks = audioTrimState.peaks;
  const mid = h / 2;

  ctx.clearRect(0, 0, w, h);

  // 背景
  ctx.fillStyle = '#12121a';
  ctx.fillRect(0, 0, w, h);

  const startX = timeToX(audioTrimState.trimStart);
  const endX = timeToX(audioTrimState.trimEnd);

  // 选区外暗色遮罩
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, startX, h);
  ctx.fillRect(endX, 0, w - endX, h);

  // 选区内高亮背景
  ctx.fillStyle = 'rgba(0, 200, 83, 0.08)';
  ctx.fillRect(startX, 0, endX - startX, h);

  // 波形
  const barWidth = w / peaks.length;
  for (let i = 0; i < peaks.length; i++) {
    const x = i * barWidth;
    const barH = peaks[i] * (h * 0.85);
    const inSelection = x >= startX && x <= endX;

    ctx.fillStyle = inSelection ? '#00c853' : '#404050';
    ctx.fillRect(x, mid - barH / 2, Math.max(barWidth, 1), barH);
  }

  // 播放头
  const playX = timeToX(audioTrimState.currentTime);
  ctx.strokeStyle = '#ff0050';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(playX, 0);
  ctx.lineTo(playX, h);
  ctx.stroke();

  // 开始手柄
  drawHandle(ctx, startX, h, '#00c853', '开始');
  // 结束手柄
  drawHandle(ctx, endX, h, '#ff5252', '结束');
}

function drawHandle(ctx, x, h, color, label) {
  const handleW = 3;
  ctx.fillStyle = color;
  ctx.fillRect(x - handleW / 2, 0, handleW, h);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 6, 0);
  ctx.lineTo(x + 6, 0);
  ctx.lineTo(x, 8);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - 6, h);
  ctx.lineTo(x + 6, h);
  ctx.lineTo(x, h - 8);
  ctx.closePath();
  ctx.fill();
}

function updateTrimUI() {
  audioTrimElements.rangeStart.textContent = formatTimePrecise(audioTrimState.trimStart);
  audioTrimElements.rangeEnd.textContent = formatTimePrecise(audioTrimState.trimEnd);
  audioTrimElements.rangeLength.textContent = formatTimePrecise(audioTrimState.trimEnd - audioTrimState.trimStart);
  audioTrimElements.startInput.value = formatTimePrecise(audioTrimState.trimStart);
  audioTrimElements.endInput.value = formatTimePrecise(audioTrimState.trimEnd);
  drawWaveform();
}

function resizeCanvas() {
  const canvas = audioTrimElements.canvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  audioTrimState.canvasWidth = rect.width;
  audioTrimState.canvasHeight = rect.height;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  drawWaveform();
}

function getCanvasX(e) {
  const rect = audioTrimElements.canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  return clientX - rect.left;
}

function hitTestHandle(x) {
  const startX = timeToX(audioTrimState.trimStart);
  const endX = timeToX(audioTrimState.trimEnd);
  const threshold = 12;

  if (Math.abs(x - startX) <= threshold) return 'start';
  if (Math.abs(x - endX) <= threshold) return 'end';
  if (x > startX + threshold && x < endX - threshold) return 'region';
  return null;
}

function handleCanvasPointerDown(e) {
  e.preventDefault();
  const x = getCanvasX(e);
  const hit = hitTestHandle(x);

  audioTrimState.pointerDownX = x;
  audioTrimState.pointerDownHit = hit;
  audioTrimState.hasDragged = false;
  audioTrimState.pendingSeekTime = null;

  if (hit === 'start' || hit === 'end') {
    audioTrimState.dragging = hit;
  } else if (hit === 'region') {
    audioTrimState.dragging = 'region';
    audioTrimState.dragStartX = x;
    audioTrimState.dragStartTrimStart = audioTrimState.trimStart;
    audioTrimState.dragStartTrimEnd = audioTrimState.trimEnd;
  } else {
    audioTrimState.pendingSeekTime = xToTime(x);
  }

  document.addEventListener('mousemove', handleCanvasPointerMove);
  document.addEventListener('mouseup', handleCanvasPointerUp);
  document.addEventListener('touchmove', handleCanvasPointerMove, { passive: false });
  document.addEventListener('touchend', handleCanvasPointerUp);
}

function handleCanvasPointerMove(e) {
  const x = getCanvasX(e);

  if (Math.abs(x - audioTrimState.pointerDownX) > 5) {
    audioTrimState.hasDragged = true;
  }

  if (!audioTrimState.dragging) return;
  e.preventDefault();
  const time = xToTime(x);

  if (audioTrimState.dragging === 'start') {
    audioTrimState.trimStart = Math.min(time, audioTrimState.trimEnd - MIN_TRIM_GAP);
  } else if (audioTrimState.dragging === 'end') {
    audioTrimState.trimEnd = Math.max(time, audioTrimState.trimStart + MIN_TRIM_GAP);
  } else if (audioTrimState.dragging === 'region') {
    const dx = x - audioTrimState.dragStartX;
    const dt = (dx / audioTrimState.canvasWidth) * audioTrimState.duration;
    const len = audioTrimState.dragStartTrimEnd - audioTrimState.dragStartTrimStart;
    let newStart = audioTrimState.dragStartTrimStart + dt;
    let newEnd = audioTrimState.dragStartTrimEnd + dt;

    if (newStart < 0) {
      newStart = 0;
      newEnd = len;
    }
    if (newEnd > audioTrimState.duration) {
      newEnd = audioTrimState.duration;
      newStart = audioTrimState.duration - len;
    }

    audioTrimState.trimStart = newStart;
    audioTrimState.trimEnd = newEnd;
  }

  updateTrimUI();
}

function handleCanvasPointerUp(e) {
  if (!audioTrimState.hasDragged && audioTrimState.pendingSeekTime != null) {
    playFromTime(audioTrimState.pendingSeekTime);
  } else if (!audioTrimState.hasDragged && audioTrimState.pointerDownHit === 'region') {
    playFromTime(xToTime(audioTrimState.pointerDownX));
  }

  audioTrimState.dragging = null;
  audioTrimState.pendingSeekTime = null;
  audioTrimState.pointerDownHit = null;
  document.removeEventListener('mousemove', handleCanvasPointerMove);
  document.removeEventListener('mouseup', handleCanvasPointerUp);
  document.removeEventListener('touchmove', handleCanvasPointerMove);
  document.removeEventListener('touchend', handleCanvasPointerUp);
}

function applyTimeInputs() {
  const start = parseTimeInput(audioTrimElements.startInput.value);
  const end = parseTimeInput(audioTrimElements.endInput.value);

  if (start == null || end == null) {
    showToast('❌ 时间格式无效，请使用 HH:MM:SS.000 或秒数');
    return;
  }
  if (start < 0 || end > audioTrimState.duration || start >= end) {
    showToast('❌ 时间范围无效');
    return;
  }

  audioTrimState.trimStart = start;
  audioTrimState.trimEnd = end;
  updateTrimUI();
  showToast('✅ 选区已更新');
}

function generateTrimCommand() {
  if (!audioTrimState.file) return;

  const fileName = audioTrimState.file.name;
  const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
  const ext = fileName.substring(fileName.lastIndexOf('.'));
  const start = formatTimePrecise(audioTrimState.trimStart);
  const end = formatTimePrecise(audioTrimState.trimEnd);
  const outputFormat = audioTrimElements.outputExt.value;

  let outputName;
  let encodeOpts;

  switch (outputFormat) {
    case 'mp3':
      outputName = `${baseName}_trim.mp3`;
      encodeOpts = '-c:a libmp3lame -b:a 320k';
      break;
    case 'wav':
      outputName = `${baseName}_trim.wav`;
      encodeOpts = '-c:a pcm_s16le';
      break;
    case 'm4a':
      outputName = `${baseName}_trim.m4a`;
      encodeOpts = '-c:a aac -b:a 256k';
      break;
    default:
      outputName = `${baseName}_trim${ext}`;
      encodeOpts = '-c copy';
  }

  const command = `ffmpeg -i "${fileName}" -ss ${start} -to ${end} ${encodeOpts} "${outputName}"`;

  audioTrimElements.commandOutput.classList.remove('hidden');
  audioTrimElements.commandText.textContent = command;
  showToast('📋 命令已生成，请先 cd 到文件所在目录');
}

function cleanupAudioTrim() {
  if (audioTrimState.audio) {
    audioTrimState.audio.pause();
    audioTrimState.audio.removeEventListener('timeupdate', onAudioTimeUpdate);
    audioTrimState.audio.removeEventListener('ended', onAudioEnded);
    audioTrimState.audio = null;
  }
  if (audioTrimState.audioUrl) {
    URL.revokeObjectURL(audioTrimState.audioUrl);
    audioTrimState.audioUrl = null;
  }
  audioTrimState.peaks = null;
  audioTrimState.isPlaying = false;
  audioTrimState.playSelectionMode = false;
  audioTrimState.playStopAt = null;
}

function playFromTime(time, { selectionMode = false, stopAt = null } = {}) {
  if (!audioTrimState.audio) return;

  const clampedTime = Math.max(0, Math.min(audioTrimState.duration, time));
  audioTrimState.playSelectionMode = selectionMode;
  audioTrimState.playStopAt = stopAt;
  audioTrimState.audio.currentTime = clampedTime;
  audioTrimState.currentTime = clampedTime;
  audioTrimElements.currentTime.textContent = formatTimePrecise(clampedTime, false);
  audioTrimState.audio.play();
  audioTrimState.isPlaying = true;
  audioTrimElements.playIcon.innerHTML = PAUSE_ICON;
  drawWaveform();
}

function onAudioTimeUpdate() {
  if (!audioTrimState.audio) return;
  audioTrimState.currentTime = audioTrimState.audio.currentTime;
  audioTrimElements.currentTime.textContent = formatTimePrecise(audioTrimState.currentTime, false);

  const stopAt = audioTrimState.playSelectionMode
    ? audioTrimState.trimEnd
    : audioTrimState.playStopAt;

  if (stopAt != null && audioTrimState.currentTime >= stopAt) {
    audioTrimState.audio.pause();
    audioTrimState.isPlaying = false;
    audioTrimState.playSelectionMode = false;
    audioTrimState.playStopAt = null;
    audioTrimElements.playIcon.innerHTML = PLAY_ICON;
  }

  drawWaveform();
}

function onAudioEnded() {
  audioTrimState.isPlaying = false;
  audioTrimState.playSelectionMode = false;
  audioTrimState.playStopAt = null;
  audioTrimElements.playIcon.innerHTML = PLAY_ICON;
}

function togglePlay() {
  if (!audioTrimState.audio) return;

  if (audioTrimState.isPlaying) {
    audioTrimState.audio.pause();
    audioTrimState.isPlaying = false;
    audioTrimElements.playIcon.innerHTML = PLAY_ICON;
  } else {
    audioTrimState.playSelectionMode = false;
    audioTrimState.playStopAt = null;
    audioTrimState.audio.play();
    audioTrimState.isPlaying = true;
    audioTrimElements.playIcon.innerHTML = PAUSE_ICON;
  }
}

function playSelection() {
  playFromTime(audioTrimState.trimStart, { selectionMode: true });
}

async function loadAudioFile(file) {
  if (!file) return;

  const allowedExt = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.wma', '.opus', '.webm'];
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!allowedExt.includes(ext)) {
    showToast(`❌ 不支持的音频格式: ${ext}`);
    return;
  }

  cleanupAudioTrim();

  audioTrimState.file = file;
  audioTrimElements.workspace.classList.remove('hidden');
  audioTrimElements.player.classList.add('hidden');
  audioTrimElements.loading.classList.remove('hidden');
  audioTrimElements.commandOutput.classList.add('hidden');
  audioTrimElements.fileName.textContent = file.name;
  audioTrimElements.duration.textContent = formatFileSize(file.size);

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > 100) {
    audioTrimElements.loadingText.textContent = `文件较大 (${sizeMB.toFixed(0)} MB)，分析可能需要 1-2 分钟，请耐心等待...`;
  } else if (sizeMB > 30) {
    audioTrimElements.loadingText.textContent = `正在分析波形 (${sizeMB.toFixed(0)} MB)...`;
  } else {
    audioTrimElements.loadingText.textContent = '正在分析波形...';
  }
  audioTrimElements.loadingProgress.style.width = '10%';

  try {
    audioTrimState.audioUrl = URL.createObjectURL(file);
    audioTrimState.audio = new Audio(audioTrimState.audioUrl);

    await new Promise((resolve, reject) => {
      audioTrimState.audio.addEventListener('loadedmetadata', resolve, { once: true });
      audioTrimState.audio.addEventListener('error', reject, { once: true });
    });

    audioTrimState.duration = audioTrimState.audio.duration;
    audioTrimState.trimStart = 0;
    audioTrimState.trimEnd = audioTrimState.duration;
    audioTrimState.currentTime = 0;

    audioTrimElements.totalTime.textContent = formatTimePrecise(audioTrimState.duration, false);
    audioTrimElements.duration.textContent = `时长 ${formatTimePrecise(audioTrimState.duration, false)} · ${formatFileSize(file.size)}`;

    audioTrimElements.loadingProgress.style.width = '30%';

    audioTrimState.audio.addEventListener('timeupdate', onAudioTimeUpdate);
    audioTrimState.audio.addEventListener('ended', onAudioEnded);

    audioTrimElements.loadingProgress.style.width = '50%';
    audioTrimElements.loadingText.textContent = '正在解码音频生成波形...';

    const arrayBuffer = await file.arrayBuffer();
    audioTrimElements.loadingProgress.style.width = '70%';

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioTrimElements.loadingProgress.style.width = '90%';

    audioTrimState.peaks = extractPeaks(audioBuffer, PEAK_COUNT);
    await audioContext.close();

    audioTrimElements.loadingProgress.style.width = '100%';

    audioTrimElements.loading.classList.add('hidden');
    audioTrimElements.player.classList.remove('hidden');

    requestAnimationFrame(() => {
      resizeCanvas();
      updateTrimUI();
    });

    showToast('✅ 音频加载完成');
  } catch (error) {
    console.error('Audio load error:', error);
    audioTrimElements.loading.classList.add('hidden');
    showToast('❌ 音频加载失败: ' + error.message);
  }
}

function initAudioTrim() {
  if (!audioTrimElements.fileInput) return;

  audioTrimElements.fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) loadAudioFile(file);
    e.target.value = '';
  });

  if (audioTrimElements.dropZone) {
    audioTrimElements.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      audioTrimElements.dropZone.classList.add('dragover');
    });
    audioTrimElements.dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      audioTrimElements.dropZone.classList.remove('dragover');
    });
    audioTrimElements.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      audioTrimElements.dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files?.[0];
      if (file) loadAudioFile(file);
    });
  }

  audioTrimElements.playBtn?.addEventListener('click', togglePlay);
  audioTrimElements.playSelectionBtn?.addEventListener('click', playSelection);
  audioTrimElements.playStartBtn?.addEventListener('click', () => {
    playFromTime(audioTrimState.trimStart);
  });
  audioTrimElements.playEndBtn?.addEventListener('click', () => {
    playFromTime(audioTrimState.trimEnd);
  });
  audioTrimElements.applyInputBtn?.addEventListener('click', applyTimeInputs);
  audioTrimElements.generateBtn?.addEventListener('click', generateTrimCommand);

  audioTrimElements.startInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyTimeInputs();
  });
  audioTrimElements.endInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyTimeInputs();
  });

  audioTrimElements.canvas?.addEventListener('mousedown', handleCanvasPointerDown);
  audioTrimElements.canvas?.addEventListener('touchstart', handleCanvasPointerDown, { passive: false });

  window.addEventListener('resize', () => {
    if (audioTrimState.peaks) resizeCanvas();
  });

  audioTrimElements.copyBtn?.addEventListener('click', async () => {
    const command = audioTrimElements.commandText.textContent;
    try {
      await navigator.clipboard.writeText(command);
      audioTrimElements.copyBtn.textContent = '已复制 ✓';
      audioTrimElements.copyBtn.classList.add('copied');
      showToast('✅ 命令已复制到剪贴板');
      setTimeout(() => {
        audioTrimElements.copyBtn.textContent = '复制命令';
        audioTrimElements.copyBtn.classList.remove('copied');
      }, 2000);
    } catch {
      showToast('❌ 复制失败，请手动复制');
    }
  });

  const detailsEl = audioTrimElements.dropZone?.closest('details');
  detailsEl?.addEventListener('toggle', () => {
    if (detailsEl.open && audioTrimState.peaks) {
      requestAnimationFrame(() => resizeCanvas());
    }
  });
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

  // 初始化 WebM 转 MP4 功能
  initConvertUpload();

  // 初始化音频截取工具
  initAudioTrim();

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

