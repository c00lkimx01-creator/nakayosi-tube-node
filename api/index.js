/**
 * Vercel サーバーレス関数のエントリポイント。
 * server.js の Express app をそのまま import して使う。
 * (server.js は VERCEL=1 のとき app.listen() を呼ばず module.exports = app する)
 */
process.env.VERCEL = process.env.VERCEL || '1';
module.exports = require('../server.js');
