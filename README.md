# 仲良しTube+ (nakaoshi-tube-plus)

Invidious / Piped の公開 API を使った YouTube フロントエンドです。
公開インスタンスが落ちている場合や、より安定したストリーム取得のために
**`youtube.js`**（[youtubei.js](https://github.com/LuanRT/YouTube.js) のラッパー）を使った
自前バックエンド API (`/api/yt/*`) を搭載しています。再生方法パネルで **「Native」** を選ぶと
このバックエンドから直接ストリームURLを取得して再生します。

## 構成

```
.
├── server.js          # Express サーバー本体 (静的配信 + /api/yt/*)
├── youtube.js         # youtubei.js を使った YouTube API ラッパー
├── api/index.js       # Vercel サーバーレス関数のエントリポイント
├── public/            # フロントエンド (HTML/CSS/JS)
├── render.yaml         # Render デプロイ設定
├── vercel.json         # Vercel デプロイ設定
├── railway.json         # Railway デプロイ設定
├── .replit / replit.nix # Replit 実行設定
└── .codesandbox/tasks.json, sandbox.config.json  # CodeSandbox 実行設定
```

## ローカル実行

```bash
npm install
npm start
# http://localhost:3000
```

## `/api/yt/*` — Native バックエンド API

| エンドポイント | 説明 |
|---|---|
| `GET /api/yt/search?q=...&type=video\|channel&page=1` | 検索 |
| `GET /api/yt/suggest?q=...` | 検索サジェスト |
| `GET /api/yt/trending?region=JP` | トレンド |
| `GET /api/yt/video/:id` | 動画メタデータ + 関連動画 |
| `GET /api/yt/streams/:id` | デコード済みストリームURL (mp4/m4a/HLS) |
| `GET /api/yt/comments/:id?sort_by=top\|new` | コメント |
| `GET /api/yt/channel/:id` | チャンネル情報 |
| `GET /api/yt/channel/:id/videos?page=1` | チャンネルの動画一覧 |

`:id` には動画ID・チャンネルID (`UC...`) もしくはハンドル名 (`@`は省略可) を渡せます。

> **注意:** youtubei.js は YouTube の非公開 InnerTube API を利用するため、YouTube側の仕様変更で
> 動作しなくなる可能性があります。動かなくなった場合は `npm update youtubei.js` を試してください。

## デプロイ

### Render

1. GitHubリポジトリを Render に接続
2. リポジトリ内の `render.yaml` が自動検出されます (Blueprint デプロイ)
3. もしくは手動で Web Service を作成し、Build: `npm install` / Start: `npm start` を設定

### Vercel

1. `vercel` CLI または GitHub 連携でデプロイ
2. `vercel.json` により `/api/yt/*` 等はサーバーレス関数、それ以外は `public/` の静的配信になります
3. コールドスタート対策として `functions.maxDuration` を 30 秒に設定済みです

```bash
npm i -g vercel
vercel --prod
```

### Railway

1. GitHub 連携でプロジェクト作成、または `railway up` でCLIデプロイ
2. `railway.json` が Nixpacks ビルダーと起動コマンドを自動設定します
3. Settings → Networking で生成されたドメインを公開すれば完了です

```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

### Replit

1. このリポジトリを Import (GitHub URL を貼るだけ)
2. `.replit` / `replit.nix` が Node.js 20 環境を自動構成します
3. 実行ボタン (▶) を押すと `npm start` が走り、Webview にプレビューが表示されます
4. 常時稼働させたい場合は Replit の Deployments 機能 (Autoscale / Reserved VM) を利用してください

### CodeSandbox

1. GitHub リポジトリの URL を CodeSandbox の「Import from GitHub」に貼り付け
2. `.codesandbox/tasks.json` が `npm install` → `npm start` を自動実行し、ポート3000をプレビューします
3. （旧UI向けに `sandbox.config.json` も同梱しています）

## ライセンス

MIT
