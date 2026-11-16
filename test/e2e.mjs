// End-to-end check: real browser, real page. Run: node test/e2e.mjs
// Part A runs the standalone (GitHub Pages) build with localStorage.
// Part B runs the same file as a Claude artifact with a fake window.claude (db, user, mcp, assets, downloads)
// and checks the exact connector calls (Notion, Google Calendar) the page makes.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = path.join(root, "test", "shots");
fs.mkdirSync(shots, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = http.createServer((q, s) => {
  const f = path.join(root, decodeURIComponent(q.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!f.startsWith(root) || !fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(s);
}).listen(0);
const URL0 = `http://localhost:${server.address().port}/`;

const results = []; let failed = 0;
async function t(name, fn) {
  try { await fn(); results.push("PASS " + name); }
  catch (e) { failed++; results.push("FAIL " + name + " :: " + (e.message || e).split("\n")[0]); }
}
const ok = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const today = new Date(); const pad = n => String(n).padStart(2, "0");
const T = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const errors = [];

/* ---------------- Part A: standalone ---------------- */
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", e => errors.push("A: " + e.message));
await page.goto(URL0 + "#month"); await page.waitForSelector(".book");
const tab = v => page.click(`.tabs [data-view="${v}"]`);
const reload = async () => { await page.waitForTimeout(700); await page.reload(); await page.waitForSelector(".book"); };

await t("A01 탭 7개(YEAR·MONTH·WEEK·DAY·NOTES·HABIT·SETTING) 이동", async () => {
  for (const v of ["year", "month", "week", "day", "notes", "habit", "setting"]) { await tab(v); ok(await page.locator(`.tabs [data-view="${v}"].on`).count() === 1, v); ok(page.url().endsWith("#" + v), "hash " + v); }
});
await t("A02 연간 인덱스 12개월 + 월 누르면 월간으로", async () => {
  await tab("year"); ok(await page.locator(".mb").count() === 12, "12 blocks");
  await page.locator(".mb h3").nth(2).click(); ok(await page.locator(".tabs [data-view=month].on").count() === 1); ok((await page.textContent(".page.l .ph h1")).startsWith("March"));
  await page.click("[data-act=today]");
});
await t("A03 월간 두 쪽 펼침(월~목 | 금~일+MEMO)과 주차 표시", async () => {
  await tab("month");
  const lh = await page.locator(".page.l .cal .hd").allTextContents(), rh = await page.locator(".page.r .cal .hd").allTextContents();
  ok(lh.join() === ",MON,TUE,WED,THU", lh.join()); ok(rh.join() === "FRI,SAT,SUN,MEMO", rh.join()); ok(await page.locator(".page.l .wk").count() >= 4, "week labels");
});
await t("A04 월간 목표 추가·체크·저장 유지", async () => {
  await page.fill('[data-add="m-' + T.slice(0, 7) + '|goals"]', "운동 12번"); await page.press('[data-add="m-' + T.slice(0, 7) + '|goals"]', "Enter");
  await page.locator(".memo .ck input[type=checkbox]").first().check(); await page.fill('.memo textarea', "기간 기록 시험"); await reload();
  ok(await page.locator(".memo .ck.done .in").first().inputValue() === "운동 12번"); ok(await page.inputValue(".memo textarea") === "기간 기록 시험");
});
await t("A05 날짜 칸 눌러 일정 추가 → 칸에 표시·유지", async () => {
  await page.click(`.c[data-ds="${T}"]`, { position: { x: 40, y: 50 } }); await page.fill("#evT", "주간 회의"); await page.fill("#evH", "10:00"); await page.click("#evAdd");
  await reload(); ok((await page.textContent(`.c[data-ds="${T}"]`)).includes("주간 회의"), "event in cell");
});
await t("A06 날짜 숫자 누르면 그날 데일리로", async () => {
  await page.click(`.c[data-ds="${T}"] .n`); ok(await page.locator(".tabs [data-view=day].on").count() === 1); await tab("month");
});
await t("A07 사진 다이어리 전환 → 날짜에 사진 올림 + 키워드 일기", async () => {
  await page.click("[data-act=photo]"); ok(await page.locator(".memo .lbl", { hasText: "KEYWORD" }).count() === 1, "keyword col");
  const fc = page.waitForEvent("filechooser"); await page.click(`.c[data-ds="${T}"]`, { position: { x: 40, y: 50 } }); await (await fc).setFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
  await page.waitForTimeout(300); ok(((await page.getAttribute(`.c[data-ds="${T}"]`, "style")) || "").includes("data:image"), "photo bg");
  await page.fill(`[data-bind="m-${T.slice(0, 7)}|keywords.${T.slice(8)}"]`, "첫눈"); await reload();
  ok(await page.inputValue(`[data-bind="m-${T.slice(0, 7)}|keywords.${T.slice(8)}"]`) === "첫눈"); await page.click("[data-act=photo]");
});
await t("A08 데일리 전 항목 입력·저장 유지(기상·취침·수면·아침·할일·로그·JOY·RESET·작은일·TOMORROW·COMMENT)", async () => {
  await tab("day"); const k = "d-" + T.slice(0, 7), d = T.slice(8);
  await page.fill(`[data-bind="${k}|${d}.wake"]`, "07:00"); await page.fill(`[data-bind="${k}|${d}.bed"]`, "23:30");
  const f = { sleep: "개운함", morning: "여유", log: "현장 점검", joy: "커피", reset: "걱정 비우기", resetAct: "산책 10분", tomorrow: "친절한 사람", comment: "좋은 하루" };
  for (const [x, v] of Object.entries(f)) await page.fill(`[data-bind="${k}|${d}.${x}"]`, v);
  await page.fill(`[data-add="${k}|${d}.todos"]`, "서류 제출"); await page.press(`[data-add="${k}|${d}.todos"]`, "Enter");
  await reload(); await tab("day");
  ok(await page.inputValue(`[data-bind="${k}|${d}.wake"]`) === "07:00" && await page.inputValue(`[data-bind="${k}|${d}.bed"]`) === "23:30", "times");
  for (const [x, v] of Object.entries(f)) ok(await page.inputValue(`[data-bind="${k}|${d}.${x}"]`) === v, x);
  ok(await page.locator(`[data-bind="${k}|${d}.todos.0.t"]`).inputValue() === "서류 제출", "todo");
  ok((await page.textContent(".page.l")).includes("주간 회의"), "schedule on day");
});
await t("A09 주간: 주차·기간·목표·기간기록·7일(일정·할일 체크 연동)", async () => {
  await tab("week"); ok(/^Week \d+/.test(await page.textContent(".page.l .ph h1")), "week no");
  await page.locator(".page.l [data-add]").fill("장보기"); await page.locator(".page.l [data-add]").press("Enter");
  await page.locator(".page.l .ck input[type=checkbox]").first().check(); ok(await page.locator(".wd").count() === 7, "7 days");
  ok((await page.textContent(".page.r")).includes("주간 회의"), "event in week");
  await page.locator(".page.r .wd input[type=checkbox]").first().check(); await reload(); await tab("day");
  ok(await page.locator(".page.l .ck.done").count() >= 1, "todo checked from week shows on day");
});
await t("A10 습관: 이름 입력+Enter로 생성, 아이콘·분류·시작일·켜기끄기", async () => {
  await tab("habit"); await page.fill("[data-addhabit]", "물 2L"); await page.press("[data-addhabit]", "Enter");
  await page.fill("[data-addhabit]", "독서"); await page.press("[data-addhabit]", "Enter");
  await page.locator(".hl", { hasText: "물 2L" }).click(); await page.fill("#hI", "💧"); await page.fill("#hC", "건강"); await page.click("#hSave");
  ok((await page.textContent(".hl >> nth=0")).includes("💧"), "icon"); ok((await page.textContent(".hl >> nth=0")).includes("건강"), "cat");
  await page.locator(".hl", { hasText: "독서" }).click(); await page.uncheck("#hO"); await page.click("#hSave");
  ok(await page.locator(".hl.offh").count() === 1, "off");
});
await t("A11 습관 체크(습관 표·데일리 양쪽) + 통계·연간 히트맵", async () => {
  await page.click(`.hg td.c[data-ds="${T}"]`); ok(await page.locator(`.hg td.c.on[data-ds="${T}"]`).count() === 1, "grid check");
  const st = await page.locator(".stats b").allTextContents(); ok(st[0] === "1개" && st[1] === "1/1", st.join("|"));
  ok(await page.locator('.heat i[style*="rgba"]').count() >= 1, "heatmap");
  await tab("day"); ok(await page.locator(".chip.on", { hasText: "물 2L" }).count() === 1, "day chip on"); await page.click(".chip.on"); await tab("habit");
  ok(await page.locator(`.hg td.c.on[data-ds="${T}"]`).count() === 0, "unchecked from day");
  await page.click(`.hg td.c[data-ds="${T}"]`);
});
await t("A12 노트: 새 노트(제목·날짜·분류) → 목차 → 본문 → 유지 → 삭제", async () => {
  await tab("notes"); await page.click("[data-act=newnote]"); await page.fill("#nT", "책 리뷰"); await page.selectOption("#nC", "책"); await page.click("#nGo");
  await page.fill(".page.r textarea", "좋은 하루는 저녁에 시작된다"); await reload(); await tab("notes");
  ok((await page.textContent(".nl")).includes("책 리뷰"), "listed"); await page.click(".nl"); ok(await page.inputValue(".page.r textarea") === "좋은 하루는 저녁에 시작된다", "body");
  await page.click("[data-act=newnote]"); await page.fill("#nT", "지울 노트"); await page.click("#nGo");
  await page.click("[data-act=delnote]"); await page.click("[data-act=delnote]"); ok(await page.locator(".nl").count() === 1, "deleted");
});
await t("A13 설정: 노트 분류 추가·삭제가 새 노트 창에 반영", async () => {
  await tab("setting"); await page.fill("[data-addcat]", "업무"); await page.press("[data-addcat]", "Enter");
  await tab("notes"); await page.click("[data-act=newnote]"); ok((await page.locator("#nC option").allTextContents()).includes("업무")); await page.click(".dlg [data-close]");
});
await t("A14 설정: 한 주 시작 일요일", async () => {
  await tab("setting"); await page.click('[data-act=ws][data-v="0"]'); await tab("month");
  ok((await page.locator(".page.l .cal .hd").allTextContents()).join() === ",SUN,MON,TUE,WED"); await tab("setting"); await page.click('[data-act=ws][data-v="1"]');
});
await t("A15 설정: 사진 기능 끄면 카메라 버튼 사라짐", async () => {
  await page.click('[data-act=photos][data-v="0"]'); await tab("month"); ok(await page.locator("[data-act=photo]").count() === 0);
  await tab("setting"); await page.click('[data-act=photos][data-v="1"]');
});
let backup;
await t("A16 백업 파일 받기 → 다른 기기(새 브라우저)에서 불러오기", async () => {
  const dl = page.waitForEvent("download"); await page.click("[data-act=export]"); const d = await dl; backup = await d.path();
  const j = JSON.parse(fs.readFileSync(backup, "utf8")); ok(j.app === "twin-diary" && Object.keys(j.docs).length > 3, "backup content");
  const c2 = await browser.newContext(); const p2 = await c2.newPage(); await p2.goto(URL0 + "#setting"); await p2.waitForSelector(".book");
  const fc = p2.waitForEvent("filechooser"); await p2.click("[data-act=import]"); await (await fc).setFiles(backup); await p2.waitForTimeout(300);
  await p2.click('.tabs [data-view="habit"]'); ok((await p2.textContent(".page.l")).includes("물 2L"), "restored"); await c2.close();
});
await t("A17 PREV/NEXT·TODAY 이동", async () => {
  await tab("month"); const h0 = await page.textContent(".page.l .ph h1"); await page.click(".page.r [data-act=nav][data-n='1']");
  ok(await page.textContent(".page.l .ph h1") !== h0, "next"); await page.click("[data-act=today]"); ok(await page.textContent(".page.l .ph h1") === h0, "today");
  await tab("day"); await page.click(".page.r [data-act=nav][data-n='-1']"); await page.click("[data-act=today]");
});
await t("A18 PWA: manifest·아이콘·서비스워커 파일 제공", async () => {
  for (const f of ["manifest.webmanifest", "sw.js", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"]) { const r = await page.request.get(URL0 + f); ok(r.ok(), f); }
  const m = await (await page.request.get(URL0 + "manifest.webmanifest")).json(); ok(m.display === "standalone" && m.icons.length === 2);
});

/* ---- devices: no sideways overflow, tabs reachable, right layout ---- */
const devices = [
  ["iPhone", 393, 852, 3, true, "narrow"], ["iPhone-SE", 375, 667, 2, true, "narrow"],
  ["Galaxy-Z-Flip-main", 412, 1004, 2.6, true, "narrow"], ["Galaxy-Z-Flip-cover", 260, 300, 2, true, "narrow"],
  ["Galaxy-Z-Fold-cover", 344, 882, 2.6, true, "narrow"], ["Galaxy-Z-Fold-open", 673, 841, 2.6, true, "wide"],
  ["Galaxy-Fold-Ultra-open", 1000, 900, 2.4, true, "wide"], ["iPad-portrait", 820, 1180, 2, true, "wide"], ["iPad-landscape", 1180, 820, 2, true, "wide"],
  ["Galaxy-Book-laptop", 1366, 768, 1.5, false, "wide"], ["Mac", 1512, 982, 2, false, "wide"], ["Windows", 1920, 1080, 1, false, "wide"]];
for (const [name, w, h, dpr, touch, mode] of devices) {
  await t(`D ${name} ${w}x${h} 화면 맞춤(${mode})`, async () => {
    const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch && w < 900 });
    const p = await c.newPage(); p.on("pageerror", e => errors.push(name + ": " + e.message));
    await p.goto(URL0 + "#month"); await p.waitForSelector(".book");
    for (const v of ["month", "day", "habit", "week"]) {
      await p.click(`.tabs [data-view="${v}"]`);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(ov <= 1, `${v} overflow ${ov}px`);
      const cols = await p.evaluate(() => getComputedStyle(document.querySelector(".book")).gridTemplateColumns.split(" ").length);
      ok(mode === "wide" ? cols === 2 : cols === 1, `${v} columns ${cols}`);
      const tb = await p.locator(".tabs [data-view=day]").boundingBox(); ok(tb && tb.x >= 0 && tb.x + tb.width <= w + 1 && tb.y + tb.height <= h + 1, "tab visible");
    }
    await p.click('.tabs [data-view="month"]'); await p.screenshot({ path: path.join(shots, `${name}.png`) }); await c.close();
  });
}
await t("D Surface Duo 두 화면(경첩 피해서 쪽마다 한 화면)", async () => {
  const c = await browser.newContext({ viewport: { width: 1114, height: 705 }, deviceScaleFactor: 2.5, hasTouch: true });
  const p = await c.newPage(); const s = await c.newCDPSession(p);
  await s.send("Emulation.setDeviceMetricsOverride", { width: 1114, height: 705, deviceScaleFactor: 2.5, mobile: true, displayFeature: { orientation: "vertical", offset: 540, maskLength: 34 } });
  await p.goto(URL0 + "#month"); await p.waitForSelector(".book");
  const seg = await p.evaluate(() => matchMedia("(horizontal-viewport-segments:2)").matches); ok(seg, "segments media");
  const r = await p.evaluate(() => [...document.querySelectorAll(".page")].map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; }));
  ok(r[0][1] <= 541 && r[1][0] >= 573, "pages avoid hinge " + JSON.stringify(r)); fs.writeFileSync(path.join(shots, "Surface-Duo.png"), Buffer.from((await s.send("Page.captureScreenshot")).data, "base64")); await c.close();
});
await ctx.close();

/* ---------------- Part B: Claude artifact (fake runtime) ---------------- */
const fake = `(() => {
  const store = {}; const subs = []; window.__calls = []; window.__store = store; window.__watch = [];
  window.__gev = [{ id: "g1", summary: "구글 일정", start: { dateTime: "${T}T09:00:00+09:00" }, status: "confirmed" }];
  let n = 0; const hex = () => ("f" + (++n).toString(16)).padStart(32, "0");
  const uuid = () => { const h = hex(); return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20); };
  const snapDoc = id => ({ id, exists: true, data: () => store[id], metadata: { fromCache: false, hasPendingWrites: false } });
  const col = { limit() { return col; }, async get() { const docs = Object.keys(store).map(snapDoc); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [] }; },
    doc: id => ({ id, async set(v) { store[id] = JSON.parse(JSON.stringify(v)); window.__calls.push({ t: "db.set", id }); }, async get() { return snapDoc(id); } }),
    onSnapshot(next) { subs.push(next); return () => {}; } };
  window.__remote = (id, v) => { store[id] = v; subs.forEach(f => f({ docs: [], docChanges: () => [{ type: "modified", doc: snapDoc(id) }] })); };
  const mcp = {
    async callTool(s, t, i) { window.__calls.push({ s, t, i });
      if (window.__failNext) { const c = window.__failNext; window.__failNext = null; throw { code: c, message: c }; }
      if (t === "notion-create-pages") { const ps = (i.pages || []).map(() => ({ id: uuid(), url: "https://www.notion.so/x" })); return { content: [{ type: "text", text: JSON.stringify({ pages: ps }) }], payload: { pages: ps } }; }
      if (t === "notion-create-database") { const u = uuid(); return { content: [{ type: "text", text: '<database><data-source url="collection://' + u + '"></data-source></database>' }], payload: '<data-source url="collection://' + u + '">' }; }
      if (t === "notion-update-page") return { content: [{ type: "text", text: "ok" }], payload: { ok: true } };
      if (t === "list_calendars") return { content: [], payload: { items: [{ id: "primary", summary: "내 캘린더" }, { id: "work@x", summary: "업무" }] } };
      if (t === "create_event") { window.__gev.push({ id: "g" + Date.now(), summary: i.summary, start: i.allDay ? { date: i.startTime.slice(0, 10) } : { dateTime: i.startTime + "+09:00" } }); return { content: [], payload: { id: "new" } }; }
      return { content: [], payload: {} }; },
    watchTool(s, t, i, h) { window.__calls.push({ s, t, i, watch: 1 }); const w = { s, t, i, h }; window.__watch.push(w);
      setTimeout(() => h({ type: "data", result: { payload: { events: window.__gev } } }), 0); return () => { w.dead = 1; }; },
    async invalidate() { window.__calls.push({ t: "invalidate" }); window.__watch.filter(w => !w.dead).forEach(w => w.h({ type: "data", result: { payload: { events: window.__gev } } })); },
    async listTools() { return { servers: [] }; } };
  const caps = { db: { collection: p => { window.__colPath = p; return col; }, doc: () => null }, user: { id: async () => "u1" }, mcp,
    assets: { async upload(b) { window.__calls.push({ t: "asset.upload", size: b.size }); return { id: "a1", url: "data:image/png;base64,AAAA", sizeBytes: b.size, contentType: b.type }; } },
    downloads: { async save(x) { window.__calls.push({ t: "download", name: x.filename, len: x.data.length }); } } };
  window.claude = { use: async name => caps[name] ?? null };
})();`;
const bctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await bctx.addInitScript(fake);
const b = await bctx.newPage(); b.on("pageerror", e => errors.push("B: " + e.message));
await b.goto(URL0 + "#day"); await b.waitForSelector(".book");
const calls = () => b.evaluate(() => window.__calls);
const btab = v => b.click(`.tabs [data-view="${v}"]`);
let lastCalls = [];
const props = () => lastCalls.flatMap(x => x.t === "notion-update-page" ? [x.i.properties || {}] : x.t === "notion-create-pages" ? (x.i.pages || []).map(p => p.properties) : []);

await t("B01 아티팩트: 계정 저장소(data/users/<id>)에 저장 — 모든 기기 동기화, localStorage 안 씀", async () => {
  const k = "d-" + T.slice(0, 7), d = T.slice(8); await b.fill(`[data-bind="${k}|${d}.joy"]`, "기기 동기화"); await b.waitForTimeout(800);
  ok(await b.evaluate(() => window.__colPath) === "data/users/u1", "private path");
  ok((await b.evaluate(k => window.__store[k], k))[d].joy === "기기 동기화", "in db");
  ok(await b.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("twd:")).length) === 0, "no localStorage data");
  ok((await b.textContent(".page.l .set, .page.l") || "") !== null);
});
await t("B02 다른 기기에서 고친 내용이 바로 반영(실시간 구독)", async () => {
  const k = "d-" + T.slice(0, 7), d = T.slice(8);
  await b.evaluate(() => document.activeElement && document.activeElement.blur());
  await b.evaluate(([k, d]) => window.__remote(k, { [d]: { joy: "폰에서 씀" } }), [k, d]); await b.waitForTimeout(200);
  ok(await b.inputValue(`[data-bind="${k}|${d}.joy"]`) === "폰에서 씀");
});
await t("B03 노션 연결: 부모 페이지 + 데이터베이스 5개(Diary·Planner·Notes·Habits·Habit Log) 생성", async () => {
  await btab("setting"); await b.click("[data-act=nsetup]"); await b.waitForSelector("text=연결됨");
  const c = (await calls()).filter(x => x.s === "Notion");
  ok(c[0].t === "notion-create-pages" && c[0].i.creation_mode === "draft", "parent page");
  const dbs = c.filter(x => x.t === "notion-create-database"); ok(dbs.map(x => x.i.title).join() === "Diary,Planner,Notes,Habits,Habit Log", dbs.map(x => x.i.title).join());
  ok(dbs.every(x => x.i.parent.page_id && /CREATE TABLE/.test(x.i.schema)), "schemas under parent");
  ok(/"Joy" RICH_TEXT/.test(dbs[0].i.schema) && /"Reset" RICH_TEXT/.test(dbs[0].i.schema) && /"Tomorrow"/.test(dbs[0].i.schema), "diary fields");
});
await t("B04 데일리 [노션 저장]: 처음엔 Diary에 페이지 생성, 다음엔 같은 페이지 속성 갱신", async () => {
  await btab("day"); await b.click("[data-act=nsave]"); await b.waitForTimeout(200);
  let c = (await calls()).filter(x => x.t === "notion-create-pages" && x.i.parent && x.i.parent.data_source_id);
  const p = c.at(-1).i.pages[0].properties; ok(p.Title === T && p["date:Date:start"] === T && p.Joy === "폰에서 씀", JSON.stringify(p).slice(0, 120));
  const k = "d-" + T.slice(0, 7), d = T.slice(8); await b.fill(`[data-bind="${k}|${d}.tomorrow"]`, "다정한 사람"); ok((await b.textContent("#nstat")).includes("저장 안 됨"), "unsaved flag");
  await b.click("[data-act=nsave]"); await b.waitForTimeout(200);
  const u = (await calls()).filter(x => x.t === "notion-update-page").at(-1); ok(u && u.i.command === "update_properties" && u.i.properties.Tomorrow === "다정한 사람", "update");
});
await t("B05 [전부 만들기]: 2027년 말까지 날짜·월·주 페이지 일괄 생성(50개씩)", async () => {
  await btab("setting"); const before = (await calls()).length; await b.click("[data-act=nall]"); await b.waitForSelector("text=전부 만들기", { timeout: 30000 });
  const c = (await calls()).slice(before).filter(x => x.t === "notion-create-pages"); const total = c.reduce((s, x) => s + x.i.pages.length, 0);
  const y0 = today.getFullYear(); const days = Math.round((new Date(2027, 11, 31) - new Date(y0, 0, 1)) / 864e5) + 1;
  ok(c.every(x => x.i.pages.length <= 50), "batch ≤50"); ok(total >= days - 1 + 12, `pages ${total} for ${days} days`);
  const map = await b.evaluate(() => window.__store.nmap); ok(map["d:2027-12-31"] && map["m:2027-12"], "map filled");
});
await t("B06 월간 목표 바꾸면 Planner(Month)로 자동 반영", async () => {
  await btab("month"); const k = "m-" + T.slice(0, 7); await b.fill(`[data-add="${k}|goals"]`, "책 2권"); await b.press(`[data-add="${k}|goals"]`, "Enter"); await b.waitForTimeout(3000); lastCalls = await calls();
  const u = props().filter(p => p.Category === "Month").at(-1); ok(u && u.Goal.includes("[ ] 책 2권"), "planner month");
});
await t("B07 주간 목표 체크도 Planner(Week)로 반영", async () => {
  await btab("week"); await b.locator(".page.l [data-add]").fill("정리"); await b.locator(".page.l [data-add]").press("Enter"); await b.locator(".page.l .ck input[type=checkbox]").first().check(); await b.waitForTimeout(3000); lastCalls = await calls();
  const u = props().filter(p => p.Category === "Week").at(-1); ok(u && u.Goal.includes("[x] 정리"), "planner week");
});
await t("B08 습관 생성→Habits, 체크→Habit Log 반영", async () => {
  await btab("habit"); await b.fill("[data-addhabit]", "스트레칭"); await b.press("[data-addhabit]", "Enter"); await b.click(`.hg td.c[data-ds="${T}"]`); await b.waitForTimeout(3000);
  const c = await calls(); const dsIds = await b.evaluate(() => JSON.parse(JSON.stringify(window.__store.settings.notion.ds)));
  ok(c.some(x => x.t === "notion-create-pages" && x.i.parent?.data_source_id === dsIds.habits && x.i.pages[0].properties.Name === "스트레칭"), "habits row");
  ok(c.some(x => x.t === "notion-create-pages" && x.i.parent?.data_source_id === dsIds.habitlog && x.i.pages[0].properties.Done === "스트레칭"), "habit log row");
});
await t("B09 노트 [노션 저장] → Notes(제목·날짜·분류 + 본문)", async () => {
  await btab("notes"); await b.click("[data-act=newnote]"); await b.fill("#nT", "영화 리뷰"); await b.selectOption("#nC", "영화"); await b.click("#nGo");
  await b.fill(".page.r textarea", "장면이 오래 남았다"); await b.click("[data-act=nnote]"); await b.waitForTimeout(200);
  const c = (await calls()).filter(x => x.t === "notion-create-pages").at(-1); ok(c.i.pages[0].properties.Name === "영화 리뷰" && c.i.pages[0].properties.Category === "영화" && c.i.pages[0].content === "장면이 오래 남았다");
});
await t("B10 구글 캘린더 연동: 월 단위 일정 읽어 칸에 표시 + 캘린더 목록 선택", async () => {
  await btab("setting"); await b.click('[data-act=gcal][data-v="1"]'); await b.waitForSelector("#calSel option >> nth=2", { state: "attached" });
  await b.selectOption("#calSel", "work@x"); await btab("month"); await b.waitForTimeout(100);
  const w = (await calls()).filter(x => x.watch && x.t === "list_events").at(-1); ok(w.s === "Google Calendar" && w.i.calendarId === "work@x" && w.i.startTime.endsWith("-01T00:00:00"), JSON.stringify(w.i));
  ok((await b.textContent(`.c[data-ds="${T}"]`)).includes("구글 일정"), "gcal event shown");
});
await t("B11 날짜 눌러 일정 추가 → 구글 캘린더 create_event, 바뀐 일정 다시 읽어 반영", async () => {
  await b.click(`.c[data-ds="${T}"]`, { position: { x: 40, y: 60 } }); await b.fill("#evT", "점심 약속"); await b.fill("#evH", "12:30"); await b.click("#evAdd"); await b.waitForTimeout(200);
  const c = (await calls()).filter(x => x.t === "create_event").at(-1); ok(c.i.summary === "점심 약속" && c.i.startTime === `${T}T12:30:00` && c.i.endTime.endsWith("13:30:00") && c.i.calendarId === "work@x", JSON.stringify(c.i));
  ok((await calls()).some(x => x.t === "invalidate"), "refetch"); ok((await b.textContent(`.c[data-ds="${T}"]`)).includes("점심 약속"), "shown after refetch");
  await b.evaluate(T => { window.__gev[0].summary = "구글에서 고침"; window.__watch.forEach(w => !w.dead && w.h({ type: "data", result: { payload: { events: window.__gev } } })); }, T);
  await b.waitForTimeout(100); ok((await b.textContent(`.c[data-ds="${T}"]`)).includes("구글에서 고침"), "edit in Google reflected");
});
await t("B12 아티팩트 사진: assets 저장소에 올리고 주소만 기록", async () => {
  await b.click("[data-act=photo]"); const fc = b.waitForEvent("filechooser"); await b.click(`.c[data-ds="${T}"]`, { position: { x: 40, y: 60 } }); await (await fc).setFiles({ name: "a.png", mimeType: "image/png", buffer: PNG }); await b.waitForTimeout(400);
  ok((await calls()).some(x => x.t === "asset.upload"), "uploaded"); ok((await b.evaluate(k => window.__store[k], "p-" + T.slice(0, 7)))[T.slice(8)].startsWith("data:image/png"), "url stored"); await b.click("[data-act=photo]");
});
await t("B13 아티팩트 백업: downloads 기능으로 파일 저장", async () => {
  await btab("setting"); await b.click("[data-act=export]"); await b.waitForTimeout(100); ok((await calls()).some(x => x.t === "download" && x.name.startsWith("twin-diary-") && x.len > 100));
});
await t("B14 커넥터 끊김 오류는 원인별 안내(재연결/추가)", async () => {
  await btab("day"); await b.evaluate(() => window.__failNext = "needs_reauth"); await b.click("[data-act=nsave]"); await b.waitForTimeout(150);
  ok((await b.textContent("#toast")).includes("다시 연결"), await b.textContent("#toast"));
  await b.evaluate(() => window.__failNext = "server_not_connected"); await b.click("[data-act=nsave]"); await b.waitForTimeout(150); ok((await b.textContent("#toast")).includes("추가"));
});
await b.screenshot({ path: path.join(shots, "artifact-day.png") });
await bctx.close(); await browser.close(); server.close();

await t("Z 페이지 스크립트 오류 0건", async () => { ok(errors.length === 0, errors.join(" / ")); });
const out = results.join("\n") + `\n\n${results.length - failed}/${results.length} passed`;
console.log(out);
fs.writeFileSync(path.join(root, "test", "last-run.txt"), new Date().toISOString() + "\n" + out + "\n");
process.exit(failed ? 1 : 0);
