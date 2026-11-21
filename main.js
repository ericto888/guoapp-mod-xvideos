// xvideos 站源模块 · 小果影视 / 红果鉴 模块 API 1
//
//   列表  /c/{cateId}/{n}
//   搜索  /?k={kw}&p={n}
//   详情  /video.{eid}/{slug}
//   播放  详情页 html5player.setVideoHLS('…/hls.m3u8')
//
// 模块函数必须同步。

const SITE = 'https://www.xvideos.com';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
};

const CATEGORIES = [
  { id: 'Amateur-65', name: 'Amateur' },
  { id: 'Asian_Woman-32', name: 'Asian' },
  { id: 'Anal-12', name: 'Anal' },
  { id: 'Big_Tits-23', name: 'Big Tits' },
  { id: 'Blowjob-15', name: 'Blowjob' },
  { id: 'Creampie-40', name: 'Creampie' },
  { id: 'Lesbian-26', name: 'Lesbian' },
  { id: 'Milf-19', name: 'Milf' },
  { id: 'Teen-13', name: 'Teen' },
  { id: 'Ass-14', name: 'Ass' },
  { id: 'bbw-51', name: 'BBW' },
  { id: 'Latina-16', name: 'Latina' },
  { id: 'Mature-38', name: 'Mature' },
  { id: 'Stockings-28', name: 'Stockings' },
  { id: 'Squinting-56', name: 'Squirt' },
  { id: 'Solo_and_Masturbation-33', name: 'Solo' },
  { id: 'Lingerie-83', name: 'Lingerie' },
  { id: 'Cuckold-237', name: 'Cuckold' }
];

function clean(s) {
  return String(s == null ? '' : s)
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function fetchPage(path, referer) {
  const url = path.indexOf('http') === 0 ? path : SITE + path;
  const headers = {};
  for (const k in HEADERS) headers[k] = HEADERS[k];
  headers['Referer'] = referer || SITE + '/';
  const res = host.fetch({ method: 'GET', url: url, headers: headers });
  return {
    status: typeof res.status === 'number' ? res.status : 0,
    body: res.body || '',
    url: res.url || url
  };
}

function get(path, referer) {
  const res = fetchPage(path, referer);
  if (res.status === 403) throw new Error('xvideos 拦了请求（403）');
  if (res.status < 200 || res.status >= 400) throw new Error('xvideos 返回 HTTP ' + res.status);
  return res.body;
}

function pageDiagnostics(response) {
  const html = response && response.body ? response.body : '';
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? clean(titleMatch[1]).slice(0, 100) : '(无标题)';
  return {
    status: response ? response.status : 0,
    length: html.length,
    title: title,
    url: response && response.url ? response.url : '(未知)',
    player: /html5player/i.test(html),
    hls: /setVideoHLS/i.test(html),
    high: /setVideoUrlHigh/i.test(html),
    low: /setVideoUrlLow/i.test(html),
    m3u8: /m3u8/i.test(html),
    videoConfig: /video_url|videoUrl|hls_url|hlsUrl|sources|contentUrl/i.test(html),
    playerScript: /html5player[^<]{0,120}\\.js|player[^<]{0,120}\\.js/i.test(html),
    cloudflare: /cloudflare|cf-challenge|captcha|验证您是人类|访问过于频繁/i.test(html)
  };
}

function formatDiagnostics(label, info) {
  if (!info) return label + ': 请求失败';
  return label + ': HTTP ' + info.status +
    ', 长度 ' + info.length +
    ', 标题「' + info.title + '」' +
    ', URL=' + info.url +
    ', html5player=' + (info.player ? '是' : '否') +
    ', HLS函数=' + (info.hls ? '是' : '否') +
    ', High函数=' + (info.high ? '是' : '否') +
    ', Low函数=' + (info.low ? '是' : '否') +
    ', m3u8文本=' + (info.m3u8 ? '是' : '否') +
    ', 视频配置标记=' + (info.videoConfig ? '是' : '否') +
    ', 播放器脚本=' + (info.playerScript ? '是' : '否') +
    ', 验证页=' + (info.cloudflare ? '疑似' : '未发现');
}

function parseCards(html) {
  const out = [];
  const seen = {};
  const re = /class="[^"]*frame-block[^"]*thumb-block/g;
  const starts = [];
  let m;
  while ((m = re.exec(html)) !== null) starts.push(m.index);
  for (let i = 0; i < starts.length; i++) {
    const chunk = html.substring(starts[i], i + 1 < starts.length ? starts[i + 1] : starts[i] + 3000);
    const link = chunk.match(/href="\/video\.([0-9a-zA-Z]+)\/([^"]+)"/);
    if (!link) continue;
    const eid = link[1];
    const slug = link[2];
    if (seen[eid]) continue;
    seen[eid] = 1;
    const titleAttr = chunk.match(/href="\/video\.[^"]+"\s+title="([^"]*)"/);
    const img = chunk.match(/<img[^>]+data-src="([^"]+)"/);
    let title = titleAttr ? decode(titleAttr[1]) : '';
    if (!title) {
      const textM = chunk.match(/<p class="title"><a[^>]*>([\s\S]*?)<\/a>/);
      title = textM ? clean(textM[1].replace(/<span[\s\S]*?<\/span>/g, '')) : '';
    }
    if (!title) continue;
    const dur = chunk.match(/<span class="duration">([^<]*)<\/span>/);
    out.push({
      sourceId: eid + '~' + slug,
      title: clean(title),
      cover: img ? decode(img[1]) : '',
      duration: dur ? clean(dur[1]) : ''
    });
  }
  return out;
}

function toDrama(item) {
  const title = item.title || item.sourceId;
  return {
    id: host.dramaId(item.sourceId),
    source: host.source,
    sourceId: item.sourceId,
    title: title,
    name: title,
    desc: item.duration ? '时长 ' + item.duration : '',
    intro: '',
    cover: item.cover || '',
    totalEpisode: 1
  };
}

function pageUrlOf(sourceId, playerPath) {
  const parts = String(sourceId || '').split('~');
  if (parts.length < 2) throw new Error('缺少视频标识');
  const base = SITE + '/video.' + parts[0] + '/' + parts[1];
  return playerPath ? base + '/0/' : base;
}

function mediaAddress(raw) {
  let value = decode(String(raw || '').trim()).replace(/\\\//g, '/').replace(/&amp;/gi, '&');
  value = value.replace(/\\u0026/gi, '&');
  if (value.indexOf('//') === 0) value = 'https:' + value;
  return /^https?:\/\//i.test(value) ? value : '';
}

function extractMedia(html) {
  const patterns = [
    /html5player\s*\.\s*setVideoHLS\s*\(\s*(['"])([\s\S]*?)\1\s*\)/i,
    /html5player\s*\.\s*setVideoUrlHigh\s*\(\s*(['"])([\s\S]*?)\1\s*\)/i,
    /html5player\s*\.\s*setVideoUrlLow\s*\(\s*(['"])([\s\S]*?)\1\s*\)/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = patterns[i].exec(html);
    if (match && match[2]) {
      const address = mediaAddress(match[2]);
      if (address) return { url: address, type: i === 0 ? 'hls' : 'direct' };
    }
  }

  const rawPatterns = [
    /["'](?:hls|video_hls|hls_url)["']\s*:\s*["']([^"']+)["']/ig,
    /(?:https?:)?\\?\/\\?\/[^"'\s<>]+\.m3u8[^"'\s<>]*/ig
  ];
  for (let i = 0; i < rawPatterns.length; i++) {
    let match;
    while ((match = rawPatterns[i].exec(html)) !== null) {
      const address = mediaAddress(match[1] || match[0]);
      if (address && /m3u8/i.test(address)) return { url: address, type: 'hls' };
    }
  }
  return null;
}

module.exports = {
  validCategory(category) {
    return !category || category === 'new' || CATEGORIES.some(function (e) { return e.id === category; });
  },

  categories() {
    return CATEGORIES;
  },

  catalogPage(page, category) {
    if (!this.validCategory(category)) throw new Error('没有分类 ' + category);
    const n = Number(page || 1) < 1 ? 1 : Number(page || 1);
    const cate = (!category || category === 'new') ? 'Amateur-65' : category;
    const items = parseCards(get('/c/' + cate + '/' + n)).map(toDrama);
    return { items: items, hasMore: items.length >= 20 };
  },

  search(page, query) {
    const kw = clean(query || '');
    if (!kw) return { items: [], hasMore: false };
    const n = Number(page || 1) < 1 ? 1 : Number(page || 1);
    const items = parseCards(get('/?k=' + encodeURIComponent(kw) + '&p=' + n)).map(toDrama);
    return { items: items, hasMore: false };
  },

  detail(sourceId) {
    // 详情页使用站点标准视频 URL，不附加播放器路径 /0/。
    const pageUrl = pageUrlOf(sourceId, false);
    const html = get(pageUrl.replace(SITE, ''));

    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    let title = t ? clean(t[1]) : '';
    title = title.replace(/\s*[-–]\s*XVideos[\s\S]*$/i, '').trim();
    if (!title) {
      const og = html.match(/property="og:title"[^>]+content="([^"]*)"/);
      title = og ? clean(og[1]) : '';
    }
    if (!title) {
      const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
      title = h2 ? clean(h2[1]) : String(sourceId).split('~')[1] || String(sourceId);
    }
    const cover = html.match(/property="og:image"[^>]+content="([^"]+)"/);
    const durM = html.match(/"duration"\s*:\s*"?([0-9]+)"?/);

    const drama = {
      id: host.dramaId(sourceId),
      source: host.source,
      sourceId: sourceId,
      title: title,
      name: title,
      desc: '',
      intro: '',
      cover: cover ? decode(cover[1]) : '',
      totalEpisode: 1
    };
    const chapter = {
      id: host.chapterId(sourceId, 'video'),
      source: host.source,
      title: '正片',
      currentEpisode: 1,
      pageUrl: pageUrl,
      referer: pageUrl
    };
    return { drama: drama, chapters: [chapter] };
  },

  resolveMedia(task) {
    let sid = '';
    const fromDrama = String((task && task.dramaId) || '').split(':');
    if (fromDrama.length >= 2) sid = fromDrama.slice(1).join(':');
    if (!sid) {
      const fromChapter = String((task && task.chapter && task.chapter.id) || '').split(':');
      if (fromChapter.length >= 3) sid = fromChapter.slice(1, fromChapter.length - 1).join(':');
    }
    if (!sid) throw new Error('无法确定视频标识');

    // 与上游一致，优先使用详情阶段保存的原始页面 URL，不再拼接 /0/ 备用路径。
    const chapterPage = task && task.chapter && task.chapter.pageUrl;
    const pageUrl = (typeof chapterPage === 'string' && chapterPage.indexOf(SITE + '/') === 0)
      ? chapterPage
      : pageUrlOf(sid, false);
    let response = null;
    let fetchError = '';
    let media = null;
    try {
      response = fetchPage(pageUrl, pageUrl);
      if (response.status >= 200 && response.status < 400) {
        media = extractMedia(response.body);
      }
    } catch (e) {
      fetchError = String(e && e.message ? e.message : e).replace(/[\\r\\n]+/g, ' ').slice(0, 180);
    }

    if (!media) {
      const info = pageDiagnostics(response);
      throw new Error('XVideos 未解析到 HLS/MP4 地址。' +
        formatDiagnostics('视频页', info) +
        (fetchError ? '；请求异常=' + fetchError : ''));
    }

    return host.finishMedia({
      url: media.url,
      referer: (response && response.url) || pageUrl
    });
  }
};
