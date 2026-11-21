const siteBaseUrl = "https://www.xvideos.com";
const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const pageSize = 24;
const maxPages = 10000;
const responseLimit = 12 * 1024 * 1024;
const requestTimeoutMs = 20000;

const patterns = {
  card: /<div id="video_([a-z0-9]+)"/gi,
  numericId: /data-id="(\d+)"/i,
  cardTitle: /<p class="title">([\s\S]*?)<\/p>/i,
  attrTitle: /title="([^"]*)"/i,
  cover: /data-src="([^"]+)"/i,
  duration: /<span class="duration">([^<]*)<\/span>/i,
  hd: /<span class="video-hd-mark">([^<]*)<\/span>/i,
  pageTitle: /<h2 class="page-title">([\s\S]*?)<\/h2>/i,
  ogTitle: /property="og:title"\s+content="([^"]*)"/i,
  ogImage: /property="og:image"\s+content="([^"]*)"/i,
  ogDescription: /property="og:description"\s+content="([^"]*)"/i,
  hls: /html5player\.setVideoHLS\(\s*'([^']+)'/i,
  high: /html5player\.setVideoUrlHigh\(\s*'([^']+)'/i,
  low: /html5player\.setVideoUrlLow\(\s*'([^']+)'/i,
  jsonName: /"name":\s*"([^"]*)"/i,
  jsonDescription: /"description":\s*"([^"]*)"/i,
  jsonDuration: /"duration":\s*"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"/i,
  category: /<a[^>]+href="\/c\/([A-Za-z0-9_.%\-]+-\d{1,6})"[^>]*>([\s\S]*?)<\/a>/gi,
  tag: /<a[^>]*class="btn btn-default label[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
  categoryPage: /\/c\/[A-Za-z0-9_.%\-]+-\d{1,6}\/(\d+)/gi,
  newPage: /\/new\/(\d+)/gi,
  searchPage: /[?&]p=(\d+)/gi,
};

function value(input) {
  return input === null || input === undefined ? "" : String(input).trim();
}

function htmlUnescape(input) {
  return String(input)
    .replace(/&#x([0-9a-f]+);/gi, function (all, code) {
      const number = parseInt(code, 16);
      return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : all;
    })
    .replace(/&#(\d+);/g, function (all, code) {
      const number = parseInt(code, 10);
      return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : all;
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function clean(input) {
  return htmlUnescape(String(input || "").replace(/<[^>]+>/g, " "))
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validSourceId(sourceId) {
  return /^[a-z0-9]{4,24}-\d{4,12}$/.test(value(sourceId));
}

function validCategory(category) {
  return category === "" || /^[A-Za-z0-9_.%\-]{1,64}-\d{1,6}$/.test(category);
}

function resetRegex(regex) {
  regex.lastIndex = 0;
  return regex;
}

function matches(regex, input) {
  return Array.from(String(input).matchAll(resetRegex(regex)));
}

function fixUrl(raw) {
  let address = htmlUnescape(value(raw));
  if (address.startsWith("//")) {
    address = "https:" + address;
  }
  if (!/^https?:\/\//i.test(address)) {
    return "";
  }
  try {
    const parsed = new URL(address);
    if (!/^https?:$/.test(parsed.protocol)) {
      return "";
    }
    return parsed.toString();
  } catch (error) {
    return "";
  }
}

function requestText(path) {
  const address = /^https?:\/\//i.test(path) ? path : siteBaseUrl + path;
  const response = host.fetchText({
    url: address,
    method: "GET",
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: siteBaseUrl + "/",
    },
    referer: siteBaseUrl + "/",
    userAgent: userAgent,
    limit: responseLimit,
    timeoutMs: requestTimeoutMs,
    followRedirects: true,
    anyStatus: true,
  });
  if (response && typeof response.status === "number" && response.status !== 200) {
    throw new Error("XVideos 请求失败，HTTP " + response.status);
  }
  const body = response && response.body !== undefined ? String(response.body) : "";
  if (body === "") {
    throw new Error("XVideos 返回内容为空");
  }
  return body;
}

function parseCards(body) {
  const found = matches(patterns.card, body);
  const items = [];
  const seen = {};
  for (let index = 0; index < found.length; index++) {
    const eid = found[index][1];
    const start = found[index].index + found[index][0].length;
    const end = index + 1 < found.length ? found[index + 1].index : body.length;
    const chunk = body.slice(start, end);
    const idMatch = patterns.numericId.exec(chunk);
    if (!idMatch) continue;
    const sourceId = eid + "-" + idMatch[1];
    if (!validSourceId(sourceId) || seen[sourceId]) continue;

    const titleBlock = patterns.cardTitle.exec(chunk);
    if (!titleBlock) continue;
    const titleAttr = patterns.attrTitle.exec(titleBlock[1]);
    const title = clean(titleAttr ? titleAttr[1] : titleBlock[1].replace(patterns.duration, " "));
    if (title === "") continue;

    seen[sourceId] = true;
    const coverMatch = patterns.cover.exec(chunk);
    const durationMatch = patterns.duration.exec(chunk);
    const hdMatch = patterns.hd.exec(chunk);
    let remark = durationMatch ? clean(durationMatch[1]) : "";
    if (hdMatch && clean(hdMatch[1])) {
      remark = (remark + " " + clean(hdMatch[1])).trim();
    }
    const cover = coverMatch ? fixUrl(coverMatch[1]) : "";
    const drama = {
      id: host.dramaId(sourceId),
      source: host.source,
      sourceId: sourceId,
      title: title.slice(0, 512),
      name: title.slice(0, 512),
      channelName: "XVideos",
      categoryName: "视频",
      remark: remark.slice(0, 64),
    };
    if (cover) {
      drama.cover = cover;
      drama.coverUrl = cover;
    }
    items.push(drama);
    if (items.length >= 800) break;
  }
  return items;
}

function pageCount(body, category, isSearch, page, count) {
  let maxPage = page;
  const regex = isSearch ? patterns.searchPage : category ? patterns.categoryPage : patterns.newPage;
  for (const match of matches(regex, body)) {
    const number = parseInt(match[1], 10);
    if (number > maxPage && number < maxPages) maxPage = number;
  }
  if (maxPage > page) return maxPage;
  return count >= pageSize ? page + 1 : page;
}

function catalogPath(page, category, query) {
  if (query !== "") {
    let path = "/?k=" + encodeURIComponent(query);
    if (page > 1) path += "&p=" + page;
    return path;
  }
  if (!validCategory(category)) {
    throw new Error("XVideos 内容分类无效");
  }
  if (category !== "") {
    return "/c/" + category + (page > 1 ? "/" + page : "");
  }
  return page > 1 ? "/new/" + page : "/";
}

function catalogResult(page, category, query) {
  const body = requestText(catalogPath(page, category, query));
  const items = parseCards(body);
  return {
    items: items,
    hasMore: items.length > 0 && page < pageCount(body, category, query !== "", page, items.length),
  };
}

function categories() {
  const body = requestText("/");
  const result = [];
  const seen = {};
  for (const match of matches(patterns.category, body)) {
    const id = match[1];
    const name = clean(match[2]);
    if (!validCategory(id) || name === "" || name.length > 24 || seen[id]) continue;
    seen[id] = true;
    result.push({ id: id, name: name.slice(0, 32) });
    if (result.length >= 48) break;
  }
  return result;
}

function pageTitle(body) {
  const heading = patterns.pageTitle.exec(body);
  if (heading) {
    const title = clean(heading[1].replace(patterns.duration, " ").replace(patterns.hd, " "));
    if (title) return title;
  }
  for (const regex of [patterns.ogTitle, patterns.jsonName]) {
    const match = regex.exec(body);
    if (match) {
      const title = clean(match[1]);
      if (title) return title;
    }
  }
  return "";
}

function durationText(body) {
  const visible = patterns.duration.exec(body);
  if (visible && clean(visible[1])) return clean(visible[1]);
  const match = patterns.jsonDuration.exec(body);
  if (!match) return "";
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  const total = hours * 3600 + minutes * 60 + seconds;
  if (total <= 0) return "";
  if (hours > 0) {
    return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
  }
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function tagsFromPage(body, title) {
  const result = [];
  const seen = {};
  seen[title] = true;
  for (const match of matches(patterns.tag, body)) {
    const name = clean(match[1]);
    if (!name || name.length > 48 || seen[name]) continue;
    seen[name] = true;
    result.push(name);
    if (result.length >= 16) break;
  }
  return result;
}

function mediaUrl(body) {
  for (const regex of [patterns.hls, patterns.high, patterns.low]) {
    const match = regex.exec(body);
    if (!match) continue;
    const address = fixUrl(match[1]);
    if (address) return address;
  }
  return "";
}

function detail(sourceId) {
  const id = value(sourceId);
  if (!validSourceId(id)) throw new Error("XVideos 视频 ID 无效");
  const parts = id.split("-");
  const path = "/video." + parts[0] + "/" + parts[1] + "/0/";
  const body = requestText(path);
  const title = pageTitle(body);
  if (!title) throw new Error("XVideos 详情缺少视频名称");

  const image = patterns.ogImage.exec(body);
  const descriptionMatches = [patterns.ogDescription, patterns.jsonDescription];
  let description = "";
  for (const regex of descriptionMatches) {
    const match = regex.exec(body);
    if (match) {
      description = clean(match[1]);
      if (description && description !== title) break;
      description = "";
    }
  }
  const cover = image ? fixUrl(image[1]) : "";
  const drama = {
    id: host.dramaId(id),
    source: host.source,
    sourceId: id,
    title: title.slice(0, 512),
    name: title.slice(0, 512),
    desc: description.slice(0, 12000),
    intro: description.slice(0, 12000),
    channelName: "XVideos",
    categoryName: "视频",
    remark: durationText(body).slice(0, 64),
    tags: tagsFromPage(body, title),
    totalEpisode: 1,
    episodeCount: 1,
  };
  if (cover) {
    drama.cover = cover;
    drama.coverUrl = cover;
  }
  const address = mediaUrl(body);
  if (!address) throw new Error("XVideos 该视频暂无可用播放地址");
  const chapters = [{
    id: host.chapterId(id, "1"),
    source: host.source,
    title: "正片",
    videoUrl: address,
    pageUrl: siteBaseUrl + path,
    currentEpisode: 1,
  }];
  return { drama: drama, chapters: chapters };
}

function resolveMedia(task) {
  if (!task || !task.dramaId || !task.chapter) {
    throw new Error("XVideos 播放任务信息无效");
  }
  const dramaId = value(task.dramaId);
  const sourceId = dramaId.indexOf(":") >= 0 ? dramaId.slice(dramaId.lastIndexOf(":") + 1) : dramaId;
  if (!validSourceId(sourceId) || !String(task.chapter.id || "").startsWith(host.chapterId(sourceId, ""))) {
    throw new Error("XVideos 播放分集信息无效，请刷新详情");
  }
  let address = value(task.chapter.videoUrl);
  if (!/^https?:\/\//i.test(address)) {
    const parts = sourceId.split("-");
    const body = requestText("/video." + parts[0] + "/" + parts[1] + "/0/");
    address = mediaUrl(body);
  }
  if (!address) throw new Error("XVideos 该视频暂无可用播放地址");
  const referer = value(task.chapter.referer) || siteBaseUrl + "/";
  return host.finishMedia({
    url: address,
    referer: referer,
    headers: { Referer: referer, "User-Agent": userAgent },
  });
}

module.exports = {
  categories: categories,
  catalogPage: function (page, category) {
    const current = Math.max(1, Math.min(maxPages, Math.floor(Number(page) || 1)));
    return catalogResult(current, value(category), "");
  },
  search: function (page, query) {
    const keyword = value(query);
    if (!keyword) return { items: [], hasMore: false };
    if (keyword.length > 256) throw new Error("XVideos 搜索关键词无效");
    const current = Math.max(1, Math.min(maxPages, Math.floor(Number(page) || 1)));
    return catalogResult(current, "", keyword);
  },
  detail: detail,
  resolveMedia: resolveMedia,
  validCategory: validCategory,
};
