# Kaitorix Scraper

Supabase の `kaitorix_scrape_queue` を監視し、JAN コードごとに kaitorix.app の買取価格を取得して `kaitorix_price_cache` に保存する独立 Node.js サービス。

このディレクトリは Next.js PWA とは別プロジェクトであり、PWA の `npm run build` には含まれない。

## 仕組み（価格 scraper：ネイティブアプリ向けに残している）

> **Web 版（Next.js）は Kaitorix 公式 Open API に移行済みで、このキューには書き込まない。**
> 価格更新は `/api/kaitorix/[jan]`（ページ表示時）と `/api/kaitorix/force-refresh`（手動）が
> 公式 API を直接呼ぶ。このワーカーを残している理由は、ネイティブ（iOS / Mac）アプリの価格自動更新が
> まだ RPC `enqueue_kaitorix_scrape` でキューに入れ、このワーカーが書き戻すのを待っているため。
> ネイティブ側が web の API（`/api/kaitorix/[jan]`）に移行するまでは停止しないこと。

1. ネイティブアプリが `enqueue_kaitorix_scrape` でキュー（`kaitorix_scrape_queue`）に JAN を追加する。
2. scraper がキューをポーリングし、未処理 JAN を原子的に取得する。
3. Playwright で kaitorix.app を開き、店舗別の買取価格を取得する。
4. 結果を `kaitorix_price_cache`（`last_fetch_source = 'scraper'`）に保存する。

## 商品サムネイル（2026-10-11 から Vercel 側）

サムネイル取得は Vercel に移行済み（`lib/server/jan-thumbnails.ts`：`/api/thumbnail/enqueue` の after() で即時処理 + 毎日の Cron `/api/thumbnail/process`）。この scraper には全量リセット用の `src/reset-thumbnails.ts` だけが残る（Storage・キャッシュ・キューを空にして `batch_enqueue_jan_thumbnails()` で再投入。再取得は Vercel の Cron が 1 日最大 150 件ずつ処理し、急ぐ場合は `/api/thumbnail/process` を `CRON_SECRET` 付きで手動実行）。

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

`.env` に以下を設定する：

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
KAITORIX_API_TOKENS=your-kaitorix-token
```

`SUPABASE_SERVICE_ROLE_KEY` はキュー取得とキャッシュ更新に必要。ブラウザ向けの anon key は使わない。

### 3. PM2 のインストール

```bash
npm install -g pm2
```

## 起動方法

### バックグラウンド実行

```bash
cd scraper
pm2 start ecosystem.config.js
```

### 状態確認

```bash
pm2 status
pm2 logs kaitorix-scraper --lines 50
```

### 停止 / 再起動 / 削除

```bash
pm2 stop kaitorix-scraper
pm2 restart kaitorix-scraper
pm2 delete kaitorix-scraper
```

## 開発モード

ログをリアルタイムで確認したい場合：

```bash
cd scraper
npm run dev    # tsx watch src/index.ts
npm start      # tsx src/index.ts
```

## macOS / PM2 の TMPDIR 注意点

`tsx` は起動時に `TMPDIR` 配下へ IPC 用ディレクトリを作成する。PM2 デーモンは通常のシェル環境変数を継承しないため、環境によっては `/var/folders/zz/...` に書き込もうとして `EACCES` になることがある。

`ecosystem.config.js` では `TMPDIR: '/private/tmp'` を明示している。VSCode のターミナルでは動くが PM2 では失敗する場合、まず以下のようなログを確認する：

```text
Error: EACCES: permission denied, mkdir '/var/folders/zz/.../T/tsx-xxx'
```

## 運用メモ

- Supabase のマイグレーション `05_fix_scraper_queue_atomic.sql` が適用済みであることを確認する。
- 価格取得に失敗した JAN は PWA 側では pending / stale として扱われる場合がある。
- scraper は private service role key を扱うため、`.env` と PM2 ログを公開リポジトリへ含めない。
