/**
 * 服务器配置文件
 */

module.exports = {
  // yt-dlp cookies 配置
  // 推荐使用 cookies 文件方式，更稳定
  COOKIES_FILE: './cookies.txt',

  // 或者从浏览器读取（macOS 上不稳定，浏览器运行时会锁定数据库）
  // 可选值：'chrome', 'safari', 'firefox', 'edge', 'opera', 'brave'
  // COOKIES_FROM_BROWSER: 'chrome',

  // 服务器端口
  PORT: process.env.PORT || 3001,
};
