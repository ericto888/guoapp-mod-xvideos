// xvideos 站源模块 · 小果影视 / 红果鉴 模块 API 1
//
//   列表  /c/{cateId}/{n}
//   搜索  /?k={kw}&p={n}
//   详情  /video.{eid}/{slug}
//   播放  详情页 html5player.setVideoHLS('…/hls.m3u8')
//
// 模块函数必须同步。

const SITE = 'https://www.xvideos.com';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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

function get(path, referer) {
  const url = path.indexOf('http') === 0 ? path : SITE + path;
  const headers = {};
  for (const k in HEADERS) headers[k] = HEADERS[k];
  headers['Referer'] = referer || SITE + '/';
  const res = host.fetch({ method: 'GET', url: url, headers: headers });
  if (res.status === 403) throw new Error('xvideos 拦了请求（403）');
  if (res.status < 200 || res.status >= 400) throw new Error('xvideos 返回 HTTP ' + res.status);
  return res.body || '';
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

function pageUrlOf(sourceId) {
  const parts = String(sourceId || '').split('~');
  if (parts.length < 2) throw new Error('缺少视频标识');
  return SITE + '/video.' + parts[0] + '/' + parts[1];
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
    const pageUrl = pageUrlOf(sourceId);
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

    const pageUrl = pageUrlOf(sid);
    const html = get(pageUrl.replace(SITE, ''));
    const m = html.match(/setVideoHLS\('([^']+)'\)/) || html.match(/setVideoHLS\("([^"]+)"\)/);
    if (!m) {
      const alt = html.match(/["'](https?:[^"']+\.m3u8[^"']*)["']/);
      if (!alt) throw new Error('详情页没有 HLS 地址');
      return {
        url: decode(alt[1]).replace(/\\\//g, '/'),
        referer: pageUrl,
        quality: 720,
        credentials: { referer: pageUrl, origin: SITE, userAgent: UA }
      };
    }
    return {
      url: decode(m[1]).replace(/\\\//g, '/'),
      referer: pageUrl,
      quality: 720,
      credentials: { referer: pageUrl, origin: SITE, userAgent: UA }
    };
  }
};
