/**
 * 服务器配置文件
 */

module.exports = {
  // yt-dlp cookies 配置
  // 可选值：'chrome', 'safari', 'firefox', 'edge', 'opera', 'brave'
  // 或者设置为 cookies 文件路径，如 './cookies.txt'
  COOKIES_FROM_BROWSER: 'chrome',
  
  // 如果使用 cookies 文件，设置文件路径（相对于项目根目录）
  // COOKIES_FILE: './cookies.txt',
  
  // 服务器端口
  PORT: process.env.PORT || 3001,
};
