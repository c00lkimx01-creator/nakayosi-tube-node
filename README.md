# 仲良しTube+ (nakaoshi-tube-plus) — 改良版

YouTube 風 UI + youtubei.js による自前バックエンド。Vercel / Render / CodeSandbox / Railway / Replit / ローカルで動作。

## 主な改良点

- **偽装 (カモフラージュ) 機能**: `/disguise` にアクセスするとランダムに HTML を表示。`file/` か `public/disguise/` に `.html` を置くだけで追加可能。
- **ESC キー / ヘッダー盾アイコン** でいつでも偽装ページへ。
- **API レスポンスの LRU メモリキャッシュ** で高速化 & YouTube への負荷軽減 (search / trending / video / streams / comments / channel)。
- **静的ファイルの ETag / Cache-Control 最適化** で帯域削減。
- **InnerTube セッション自動再生成** (30 分) で長時間稼働でも cipher 変更に追従。
- **Vercel ルーティング修正** (`/disguise`, `/public/disguise/*` を追加)。

## ローカル起動

```bash
npm install
npm start          # http://localhost:3000
```

## デプロイ

| サービス | 設定ファイル | 備考 |
|---|---|---|
| Vercel | `vercel.json` | サーバーレス関数 (`api/index.js`) として動作 |
| Render | `render.yaml` | `npm install` → `npm start` |
| Railway | `railway.json` | NIXPACKS, ヘルスチェック `/healthz` |
| Replit | `replit.nix` | Node 20 |
| CodeSandbox | `sandbox.config.json` | port 3000 |

## 偽装 HTML の追加

`file/` または `public/disguise/` にお好きな HTML を追加 → 自動で抽選対象に。
同梱例: `google.html` `notes.html` `docs.html` `calc.html` `weather.html`

## エンドポイント

- `GET /` — メイン UI
- `GET /disguise` — ランダム偽装 HTML
- `GET /disguise/list` — 偽装ファイル一覧 (JSON)
- `GET /api/yt/search?q=&type=&page=` — 検索
- `GET /api/yt/suggest?q=` — サジェスト
- `GET /api/yt/trending?region=JP` — 急上昇
- `GET /api/yt/video/:id` — 動画メタ + 関連
- `GET /api/yt/streams/:id` — ストリーム URL
- `GET /api/yt/comments/:id?sort_by=top|new` — コメント
- `GET /api/yt/channel/:id` / `.../videos?page=` — チャンネル
- `GET /api-proxy?url=` — 汎用プロキシ
- `GET /healthz` — ヘルスチェック
- `GET /download/zip` — ソース ZIP

ライセンス: MIT
