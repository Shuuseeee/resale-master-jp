# Kaitorix Scraper

买取価格定期取得スクレイパー。Supabase のキューを監視し、JAN コードごとに kaitorix.app の価格情報を取得・キャッシュする。

## 仕組み

1. フロントエンドがユーザーから JAN コードを受け取ると、`/api/kaitorix/[jan]` 経由で Supabase の `kaitorix_scrape_queue` にジョブを追加する
2. このスクレイパーがキューを定期的にポーリングし、Playwright で kaitorix.app を開いて価格を取得する
3. 取得した価格を `kaitorix_price_cache` に保存する（TTL: 30 分）

## 初期セットアップ

### 1. 依存関係のインストール

```bash
cd scraper
npm install
npx playwright install chromium
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を開いて以下を記入：

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. PM2 のインストール（初回のみ）

```bash
npm install -g pm2
```

## 起動方法（バックグラウンド実行）

VSCode のターミナルを使わず、システムバックグラウンドで常時稼働させる手順。

### 起動

```bash
cd scraper
pm2 start ecosystem.config.js
```

### 状態確認

```bash
pm2 status
```

### ログ確認

```bash
pm2 logs kaitorix-scraper --lines 50
```

### 停止 / 再起動 / 削除

```bash
pm2 stop kaitorix-scraper
pm2 restart kaitorix-scraper
pm2 delete kaitorix-scraper
```

## macOS での注意事項（TMPDIR 問題）

tsx 4.x は起動時に IPC サーバーを立ち上げるために `TMPDIR` に一時ディレクトリを作成する。
PM2 デーモンはユーザーのシェル環境変数を継承しないため、デフォルトで `/var/folders/zz/...`（root の一時領域）に書き込もうとして `EACCES` エラーになる。

**解決策**：`ecosystem.config.js` で `TMPDIR: '/private/tmp'`（全ユーザー書き込み可能）を明示的に指定済み。

VSCode のターミナルで動くのに PM2 で動かない場合、まずログでこのエラーを確認すること：

```
Error: EACCES: permission denied, mkdir '/var/folders/zz/.../T/tsx-xxx'
```

## 開発モード（フォアグラウンド実行）

ログをリアルタイムで確認したい場合：

```bash
cd scraper
npm run dev    # tsx watch src/index.ts（ファイル変更で自動再起動）
npm start      # tsx src/index.ts（通常起動）
```
