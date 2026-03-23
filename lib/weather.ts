// lib/weather.ts
// Fetches Tokyo Chuo-ku weather + dress index from tenki.jp
// Mirrors v2_weather.py logic

export interface DressInfo {
  img: string;
  num: string;
  text_jp: string;
  text_cn: string | null;
}

export interface WeatherInfo {
  weather: string;
  high: string;
  low: string;
  current: string;
  precip: string;
  wind: string;
  dress_morning: DressInfo;
  dress_daytime: DressInfo;
  dress_evening: DressInfo;
}

const EMPTY_DRESS: DressInfo = { img: '', num: '', text_jp: '暂无', text_cn: null };

const DIR_MAP: Record<string, string> = {
  '北': '北', '北北東': '偏北', '北東': '东北', '東北東': '偏东',
  '東': '东', '東南東': '偏东', '南東': '东南', '南南東': '偏南',
  '南': '南', '南南西': '偏南', '南西': '西南', '西南西': '偏西',
  '西': '西', '西北西': '偏西', '北西': '西北', '北北西': '偏北',
  '静穏': '无',
};

const WEATHER_MAP: Record<string, string> = {
  '晴れ': '晴', '曇り': '多云', '雨': '雨', '雪': '雪',
  '晴れ時々曇り': '晴转多云', '曇り時々晴れ': '多云转晴',
  '晴れのち曇り': '晴后多云', '曇りのち晴れ': '多云后晴',
  '雨のち晴': '雨后晴',
  '晴れ時々雨': '晴时有雨', '曇り時々雨': '多云时有雨',
  '雨時々晴れ': '雨转晴', '雨のち晴れ': '雨后晴',
};

function translateWeather(jp: string): string {
  return WEATHER_MAP[jp] ?? jp;
}

function getWindInfo(msStr: string): string {
  const m = msStr.match(/(\d+(\.\d+)?)/);
  if (!m) return msStr;
  const v = parseFloat(m[1]);
  const scales: [number, string][] = [
    [0.3, '0级'], [1.6, '1级'], [3.4, '2级'], [5.5, '3级'],
    [8.0, '4级'], [10.8, '5级'], [13.9, '6级'], [17.2, '7级'],
  ];
  for (const [limit, scale] of scales) {
    if (v < limit) return `${v}m/s(${scale})`;
  }
  return `${v}m/s(8级+)`;
}

async function translateToChinese(jpText: string): Promise<string | null> {
  try {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'ja');
    url.searchParams.set('tl', 'zh-CN');
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', jpText);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data[0]?.map((s: any[]) => s[0]).join('') ?? null;
  } catch {
    return null;
  }
}

function extractAttr(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern);
  return m ? m[1].trim() : null;
}

export async function getTokyoWeather(): Promise<WeatherInfo> {
  const result: WeatherInfo = {
    weather: '未知', high: '-', low: '-', current: '-',
    precip: '-', wind: '-',
    dress_morning: { ...EMPTY_DRESS },
    dress_daytime: { ...EMPTY_DRESS },
    dress_evening: { ...EMPTY_DRESS },
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8',
  };

  try {
    // 1. Dress index page (also has weather, high/low, precip)
    const res1 = await fetch('https://tenki.jp/indexes/dress/3/16/4410/13102/', {
      headers, signal: AbortSignal.timeout(10000),
    });
    if (res1.ok) {
      const html = await res1.text();

      const w = extractAttr(html, /<p class="weather-icon">\s*<img[^>]+alt="([^"]+)"/);
      if (w) result.weather = translateWeather(w);

      const h = extractAttr(html, /<span class="high-temp">([^<]+)<\/span>/);
      if (h) result.high = h.replace('℃', '');

      const l = extractAttr(html, /<span class="low-temp">([^<]+)<\/span>/);
      if (l) result.low = l.replace('℃', '');

      const p = extractAttr(html, /<span class="precip">([^<]+)<\/span>/);
      if (p) result.precip = p;

      async function getDressData(timeClass: string): Promise<DressInfo> {
        const tdMatch = html.match(new RegExp(`<td class="${timeClass}">(.*?)<\/td>`, 's'));
        if (!tdMatch) return { ...EMPTY_DRESS };
        const td = tdMatch[1];
        const img = extractAttr(td, /<img src="([^"]+)"/);
        const num = extractAttr(td, /<span class="indexes-telop-0">([^<]+)<\/span>/);
        const txt = extractAttr(td, /<span class="indexes-telop-1">([^<]+)<\/span>/);
        const jp_text = txt ?? '暂无';
        const cn_text = jp_text !== '暂无' ? await translateToChinese(jp_text) : null;
        return { img: img ?? '', num: num ?? '', text_jp: jp_text, text_cn: cn_text };
      }

      result.dress_morning = await getDressData('morning-icon');
      result.dress_daytime = await getDressData('daytime-icon');
      result.dress_evening = await getDressData('evening-icon');
    }

    // 2. 1-hour forecast for current temp + wind
    const res2 = await fetch('https://tenki.jp/forecast/3/16/4410/13102/1hour.html', {
      headers, signal: AbortSignal.timeout(10000),
    });
    if (res2.ok) {
      const html2 = await res2.text();

      function getDataTr(className: string): string | null {
        const trs = [...html2.matchAll(new RegExp(`<tr[^>]*class="[^"]*${className}[^"]*"[^>]*>(.*?)<\/tr>`, 'gs'))];
        for (const m of trs) {
          if (m[1].includes('<td')) return m[1];
        }
        return null;
      }

      function extractTdValues(trHtml: string | null): Array<{ isPast: boolean; val: string }> {
        if (!trHtml) return [];
        return [...trHtml.matchAll(/<td([^>]*)>(.*?)<\/td>/gs)].map(([, attrs, td]) => {
          const isPast = attrs.includes('past');
          const altM = td.match(/<img[^>]+alt="([^"]+)"/);
          const val = altM?.[1]?.trim()
            ? altM[1].trim()
            : td.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
          return { isPast, val };
        });
      }

      const tempTr = getDataTr('temperature');
      const dirTr = getDataTr('wind-direction') ?? getDataTr('wind-blow');
      const speedTr = getDataTr('wind-speed');

      const temps = extractTdValues(tempTr);
      const dirs = extractTdValues(dirTr);
      const speeds = extractTdValues(speedTr);

      let idx = temps.findIndex(({ isPast, val }) => !isPast && /^-?\d/.test(val));
      if (idx === -1) {
        for (let i = temps.length - 1; i >= 0; i--) {
          if (/^-?\d/.test(temps[i].val)) { idx = i; break; }
        }
      }

      if (idx !== -1) {
        const m = temps[idx].val.match(/^(-?\d+(\.\d+)?)/)?.at(0) ? temps[idx].val.match(/^(-?\d+(\.\d+)?)/) : null;
        if (m) {
          result.current = m[1];
          let windDir = dirs[idx]?.val?.replace(/\n/g, '').trim() || '静穏';
          let windSpd = speeds[idx]?.val?.replace(/\n/g, '').trim() || '0';
          if (!windDir || windDir === '---') windDir = '静穏';
          if (!windSpd || windSpd === '---') windSpd = '0';
          const dirCn = DIR_MAP[windDir] ?? windDir;
          const windInfo = getWindInfo(windSpd);
          result.wind = dirCn === '无' ? `微风 ${windInfo}` : `${dirCn}风 ${windInfo}`;
        }
      }
    }
  } catch (e) {
    console.error('[Weather] Failed to fetch:', e);
  }

  return result;
}
