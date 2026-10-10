-- 20_product_shipping_meta.sql（2026-10-11）
-- 出货方案 MCP 用的商品尺寸表 + 历史数据导入。可重复执行。

-- 商品出货尺寸（出货方案求解用，按用户 × JAN）：体积（L/件，含缓冲）、最小箱型（三辺合計 cm）、分类（规则里「スマホ 3台以上」等按分类计数）
CREATE TABLE IF NOT EXISTS public.product_shipping_meta (
  user_id uuid DEFAULT auth.uid() NOT NULL,
  jan text NOT NULL,
  vol numeric(8,2) NOT NULL,
  min_size integer DEFAULT 60 NOT NULL,
  category text,
  note text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT product_shipping_meta_pkey PRIMARY KEY (user_id, jan),
  CONSTRAINT product_shipping_meta_vol_check CHECK (vol > 0),
  CONSTRAINT product_shipping_meta_min_size_check CHECK (min_size IN (60, 80, 100, 120, 140, 160))
);
ALTER TABLE public.product_shipping_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_shipping_meta_own ON public.product_shipping_meta;
CREATE POLICY product_shipping_meta_own ON public.product_shipping_meta FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 从原 ResaleAssist 各天 data_MMDD.py 汇总的历史尺寸（同一 JAN 取最新一天），note 记商品名
INSERT INTO public.product_shipping_meta (user_id, jan, vol, min_size, category, note) VALUES
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '0840080512204', 2.2, 60, NULL, 'Echo Dot 第5世代 グレーシャーホワイト'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '0840080592077', 2.2, 60, NULL, 'Echo Dot 第5世代 チャコール'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '0840268942847', 1.1, 60, NULL, 'Kindle Paperwhite (16GB) 2024モデル ブラック'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '0850049670180', 32.0, 120, '家電', 'SpaceX Starlink Standard kit V4'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4521329368009', 1.2, 60, NULL, 'Pokémon GO Plus +（ポケモンゴープラスプラス）'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4521329460420', 0.3, 60, 'ゲーム', 'ぽこ あ ポケモン (Switch2)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4547410337556', 1.0, 60, '家電', 'instax mini モノクローム (10枚)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4547410377224', 0.3, 60, '家電', 'チェキ フイルム JP1 #4'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4547410440911', 1.3, 60, NULL, 'instax SQUARE モノクローム 10枚入'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4547410560763', 1.0, 60, NULL, 'instax mini ソフトグリッター 10枚入り'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4547410564631', 1.5, 60, '家電', 'instax mini 13 フロストブルー'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4547410564655', 1.5, 60, '家電', 'instax mini 13 ラグーングリーン'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4547410576467', 3.9, 60, NULL, 'instax mini 99 チェキ シルバー'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4548736129894', 15.0, 140, NULL, 'SONY SA-SW5 [単品]'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4549576187037', 0.3, 60, 'ゲーム', 'Minecraft Dungeons Ultimate Edition (Switch)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4549995623086', 2.1, 60, NULL, 'Apple Watch Series 11 GPS 46mm ローズゴールド'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4549995647532', 0.3, 60, 'スマホ', 'iPhone Air 256GB スカイブルー MG2A4J/A SIMフリー'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4573542237419', 0.2, 60, 'トレカ・ホビー', 'BLACKPINK Original Tamagotchi'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4582239433621', 1.9, 60, NULL, 'moto g66j 5G グレーミスト'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4582769733352', 1.0, 60, 'トレカ・ホビー', 'たまごっちパラダイス Blue Water'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4595057030071', 0.3, 60, 'ゲーム', 'Minecraft (PS5)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370536058', 0.3, 60, 'ゲーム', 'ゼルダ BotW (Switch) #4'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370536485', 0.3, 60, 'ゲーム', 'マリオカート8 デラックス (Switch)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370540437', 0.3, 60, 'ゲーム', 'スーパーマリオパーティ (Switch)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370549454', 0.3, 60, 'ゲーム', '星のカービィ ディスカバリー (Switch)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370551600', 0.3, 60, 'ゲーム', '超おどる メイド イン ワリオ (Switch)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370552195', 2.5, 60, 'ゲーム', 'Alarmo サウンドクロック CLO-S-RAAAA'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370553291', 0.3, 60, NULL, 'ゼルダ BOTW Switch2 Edition'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370553352', 0.3, 60, 'ゲーム', 'マリオパーティ ジャンボリー (Switch2)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370553413', 0.3, 60, 'ゲーム', 'ドンキーコング バナンザ (Switch2) #2'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370554113', 0.3, 60, 'ゲーム', 'マリオ ワンダー NS2 Edition (Switch2)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370554243', 0.3, 60, 'ゲーム', 'XenobladeX Definitive Edition (Switch2)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370554328', 0.3, 60, 'ゲーム', 'Star Fox (Switch2)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370554359', 0.3, 60, NULL, '任天堂 スプラトゥーン レイダース [Nintendo Switch 2 専用]'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370554380', 0.3, 60, NULL, 'ゼノブレイド ディフィニティブ・エディション Switch2 Edition'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4902370554472', 0.3, 60, 'ゲーム', 'FE 万紫千紅 (Switch2) #9'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4904810096092', 0.1, 60, 'トレカ・ホビー', 'BEYBLADE X BX-48 ランダムブースター'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4906274014933', 3.5, 60, '家電', 'IZUMI everedge IZF-E863W-K'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4938833024404', 0.3, 60, 'ゲーム', 'It Takes Two (Switch)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4948872016490', 18.0, 100, 'ゲーム', 'PS VR2 CFIJ-17000'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4948872016612', 18.0, 100, 'ゲーム', 'PS VR2 同梱版 CFIJ-17001'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4948872017183', 0.3, 60, 'ゲーム', 'ASTRO BOT (PS5) #2'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4948872415729', 0.4, 60, NULL, 'DualSense Edge スティックモジュール CFI-ZSM1G'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4948872417419', 19.0, 100, NULL, 'プレイステーション5 デジタル・エディション CFI-2200B01'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4960759916631', 12.9, 80, NULL, 'Nikon COOLPIX P1100'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4974365870843', 0.3, 60, 'ゲーム', '龍が如く 極3 (Switch2)'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '4987176250735', 5.2, 60, NULL, 'BRAUN メンズシェーバー BT9560'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '5025155089811', 9.0, 80, '家電', 'Dyson Supersonic r HD17 CPATO #2'),
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', '8806095700670', 0.1, 60, '家電', 'Samsung microSD Express 256GB')
ON CONFLICT (user_id, jan) DO NOTHING;
