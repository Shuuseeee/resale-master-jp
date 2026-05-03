# Kaitorix Scraper

Supabase の `kaitorix_scrape_queue` を監視し、JAN コードごとに kaitorix.app の買取価格を取得して `kaitorix_price_cache` に保存する独立 Node.js サービス。

このディレクトリは Next.js PWA とは別プロジェクトであり、PWA の `npm run build` には含まれない。

## 仕組み

1. PWA 側の `/api/kaitorix/[jan]` または `/api/jan-product/[jan]` がキャッシュミス時に Supabase のキューへ JAN を追加する。
2. scraper がキューをポーリングし、未処理 JAN を原子的に取得する。
3. Playwright で kaitorix.app を開き、店舗別の買取価格を取得する。
4. 結果を `kaitorix_price_cache` に保存し、PWA 側は以後キャッシュから価格と商品名を表示する。

PWA の JAN 商品名補完は、最初に API 直接検索を試し、取得できない場合はキュー投入後もフロント側で一定時間リトライする。

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
