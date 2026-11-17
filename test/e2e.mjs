// End-to-end check: real browser, real page. Run: npm test   (or: node test/e2e.mjs)
// A = standalone build (GitHub Pages, localStorage)   B = the same file as a Claude artifact, with a fake
// window.claude (db, user, mcp, assets, downloads) recording the exact Notion / Google Calendar calls
// C = packaging and docs   D = device screens   Z = no page errors
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
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

// Browser: CHROME_PATH, else Playwright's own, else the newest Chromium already in the Playwright cache.
function browserPath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try { if (fs.existsSync(chromium.executablePath())) return undefined; } catch {}
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || (process.platform === "win32" ? path.join(process.env.LOCALAPPDATA || "", "ms-playwright") : path.join(os.homedir(), process.platform === "darwin" ? "Library/Caches/ms-playwright" : ".cache/ms-playwright"));
  const exe = process.platform === "win32" ? "chrome-win64/chrome.exe" : process.platform === "darwin" ? "chrome-mac/Chromium.app/Contents/MacOS/Chromium" : "chrome-linux/chrome";
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split("-")[1] - +a.split("-")[1]) : [];
  for (const d of dirs) { const p = path.join(base, d, exe); if (fs.existsSync(p)) return p; }
  return undefined;
}

const results = []; let failed = 0;
async function t(name, fn) {
  try { await fn(); results.push("PASS " + name); }
  catch (e) { failed++; results.push("FAIL " + name + " :: " + String(e.message || e).split("\n")[0]); }
}
const ok = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");
const exePath = browserPath();
const browser = await chromium.launch(exePath ? { executablePath: exePath } : {});
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date(); const T = ymd(today); const M = T.slice(0, 7), DD = T.slice(8);
const Y1 = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
const firstOfMonth = DD === "01";
const errors = [];
const tz = "Asia/Seoul";
const MONU = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

/* ================= Part A: standalone ================= */
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, timezoneId: tz });
const page = await ctx.newPage();
page.on("pageerror", e => errors.push("A: " + e.message));
await page.goto(URL0 + "#month"); await page.waitForSelector(".book");
const tab = v => page.click(`.tabs [data-view="${v}"]`);
const reload = async () => { await page.waitForTimeout(700); await page.reload(); await page.waitForSelector(".book"); };
const h1 = (side = "l") => page.textContent(`.page.${side} .ph h1`);

await t("A01 탭 7개(YEAR·MONTH·WEEK·DAY·NOTES·HABIT·SETTING) 이동 + 주소(#)로 바로 열기", async () => {
  for (const v of ["year", "month", "week", "day", "notes", "habit", "setting"]) { await tab(v); ok(await page.locator(`.tabs [data-view="${v}"].on`).count() === 1, v); ok(page.url().endsWith("#" + v), "hash " + v); }
  await page.goto(URL0 + "#habit"); await page.waitForSelector(".book"); ok(await page.locator('.tabs [data-view="habit"].on').count() === 1, "open by hash");
});
await t("A02 연간 인덱스 12개월 + 월 누르면 그 달 월간", async () => {
  await tab("year"); ok(await page.locator(".mb").count() === 12, "12 blocks"); ok((await h1()).startsWith(String(today.getFullYear())), "year title");
  await page.locator(".mb h3").nth(2).click(); ok(await page.locator(".tabs [data-view=month].on").count() === 1); ok((await h1()).startsWith("March"));
  await page.click("[data-act=today]");
});
await t("A03 월간 두 쪽 펼침(월~목 | 금~일+MEMO) + 주차 번호가 ISO 주차와 같음", async () => {
  await tab("month");
  const lh = await page.locator(".page.l .cal .hd").allTextContents(), rh = await page.locator(".page.r .cal .hd").allTextContents();
  ok(lh.join() === ",MON,TUE,WED,THU", lh.join()); ok(rh.join() === "FRI,SAT,SUN,MEMO", rh.join());
  const wk = await page.locator(".page.l .wk").allTextContents(); ok(wk.length >= 4, "week labels");
  const iso = d => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day); return Math.ceil(((x - Date.UTC(x.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); };
  const first = new Date(today.getFullYear(), today.getMonth(), 1); const mon = new Date(first); mon.setDate(1 - ((first.getDay() + 6) % 7));
  ok(wk[0] === "W" + iso(mon), `first week ${wk[0]} vs W${iso(mon)}`);
});
await t("A04 월간 목표 추가·체크·기간 기록 → 새로고침 뒤에도 유지", async () => {
  await page.fill(`[data-add="m-${M}|goals"]`, "운동 12번"); await page.press(`[data-add="m-${M}|goals"]`, "Enter");
  await page.locator(".memo .ck input[type=checkbox]").first().check(); await page.fill(".memo textarea", "기간 기록 시험"); await reload();
  ok(await page.locator(".memo .ck.done .in").first().inputValue() === "운동 12번", "goal checked"); ok(await page.inputValue(".memo textarea") === "기간 기록 시험", "period log");
});
await t("A05 날짜 칸 눌러 일정 추가 → 칸에 시간·제목 표시, 새로고침 뒤 유지", async () => {
  await page.click(`.c[data-ds="${T}"]`, { position: { x: 40, y: 50 } }); await page.fill("#evT", "주간 회의"); await page.fill("#evH", "10:00"); await page.click("#evAdd");
  await reload(); const txt = await page.textContent(`.c[data-ds="${T}"]`); ok(txt.includes("주간 회의") && txt.includes("10:00"), txt);
});
await t("A06 날짜 숫자 누르면 바로 그 날짜의 데일리", async () => {
  await page.click(`.c[data-ds="${T}"] .n`); ok(await page.locator(".tabs [data-view=day].on").count() === 1);
  ok((await h1()).startsWith(`${T.slice(5, 7)}.${DD}`), await h1()); await tab("month");
});
await t("A07 사진 다이어리: 날짜에 사진 → 새로고침 뒤에도 그 칸에 보임(이미지 열림) + 키워드 일기 유지", async () => {
  await page.click("[data-act=photo]"); ok(await page.locator(".memo .lbl", { hasText: "KEYWORD" }).count() === 1, "keyword col");
  const fc = page.waitForEvent("filechooser"); await page.click(`.c[data-ds="${T}"]`, { position: { x: 40, y: 50 } }); await (await fc).setFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(T => (document.querySelector(`.c[data-ds="${T}"]`).getAttribute("style") || "").includes("data:image"), T);
  await page.fill(`[data-bind="m-${M}|keywords.${DD}"]`, "첫눈"); await reload();
  ok(((await page.getAttribute(`.c[data-ds="${T}"]`, "style")) || "").includes("data:image/jpeg"), "photo kept after reload");
  const loaded = await page.evaluate(T => new Promise(r => { const m = /url\('(.+)'\)/.exec(document.querySelector(`.c[data-ds="${T}"]`).getAttribute("style")); const i = new Image(); i.onload = () => r(i.width > 0); i.onerror = () => r(false); i.src = m[1]; }), T);
  ok(loaded, "image decodes"); ok(await page.inputValue(`[data-bind="m-${M}|keywords.${DD}"]`) === "첫눈", "keyword"); await page.click("[data-act=photo]");
});
await t("A08 데일리 전 항목(기상·취침·수면·아침·할일·로그·JOY·RESET·작은일·TOMORROW·COMMENT) 저장 유지 + 그날 일정 + 저장 상태", async () => {
  await tab("day"); const k = "d-" + M;
  await page.fill(`[data-bind="${k}|${DD}.wake"]`, "07:00"); await page.fill(`[data-bind="${k}|${DD}.bed"]`, "23:30");
  const f = { sleep: "개운함", morning: "여유", log: "현장 점검", joy: "커피", reset: "걱정 비우기", resetAct: "산책 10분", tomorrow: "친절한 사람", comment: "좋은 하루" };
  for (const [x, v] of Object.entries(f)) await page.fill(`[data-bind="${k}|${DD}.${x}"]`, v);
  await page.fill(`[data-add="${k}|${DD}.todos"]`, "서류 제출"); await page.press(`[data-add="${k}|${DD}.todos"]`, "Enter");
  ok((await page.textContent(".foot .sstat")).length > 0, "save status shown");
  await reload(); await tab("day");
  ok(await page.inputValue(`[data-bind="${k}|${DD}.wake"]`) === "07:00" && await page.inputValue(`[data-bind="${k}|${DD}.bed"]`) === "23:30", "times");
  for (const [x, v] of Object.entries(f)) ok(await page.inputValue(`[data-bind="${k}|${DD}.${x}"]`) === v, x);
  ok(await page.locator(`[data-bind="${k}|${DD}.todos.0.t"]`).inputValue() === "서류 제출", "todo");
  ok((await page.textContent(".page.l")).includes("주간 회의"), "schedule on day");
  ok(await page.textContent(".foot .sstat") === "저장됨", "saved status");
});
await t("A09 주간: Week N·기간 표시, 목표·기간기록 저장 유지, 7일 일정, 할 일 체크가 데일리와 연동", async () => {
  await tab("week"); const head = await page.textContent(".page.l .ph"); ok(/Week \d+/.test(head) && /\d\d\.\d\d – \d\d\.\d\d/.test(head), head);
  await page.locator(".page.l [data-add]").fill("장보기"); await page.locator(".page.l [data-add]").press("Enter");
  await page.locator(".page.l .ck input[type=checkbox]").first().check(); await page.locator(".page.l textarea").first().fill("이번 주 흐름 시험");
  ok(await page.locator(".wd").count() === 7, "7 days"); ok((await page.textContent(".page.r")).includes("주간 회의"), "event in week");
  await page.locator(".page.r .wd input[type=checkbox]").first().check(); await reload(); await tab("week");
  ok(await page.locator(".page.l .ck.done .in").first().inputValue() === "장보기", "weekly goal kept"); ok(await page.locator(".page.l textarea").first().inputValue() === "이번 주 흐름 시험", "period log kept");
  await tab("day"); ok(await page.locator(".page.l .ck.done").count() >= 1, "todo checked from week shows on day");
});
await t("A10 습관: 이름+Enter 생성, 아이콘·분류·시작일 변경 유지, 끄기, 시작일 전 체크 막음", async () => {
  await tab("habit"); await page.fill("[data-addhabit]", "물 2L"); await page.press("[data-addhabit]", "Enter");
  await page.fill("[data-addhabit]", "독서"); await page.press("[data-addhabit]", "Enter");
  if (!firstOfMonth) { await page.locator(`.hg td.c[data-ds="${Y1}"]`).first().click(); ok(await page.locator(`.hg td.c.on[data-ds="${Y1}"]`).count() === 0, "before start blocked"); }
  const startDay = `${today.getFullYear()}-01-01`;
  await page.locator(".hl", { hasText: "물 2L" }).click(); await page.fill("#hI", "💧"); await page.fill("#hC", "건강"); await page.fill("#hS", startDay); await page.click("#hSave");
  await page.locator(".hl", { hasText: "독서" }).click(); await page.uncheck("#hO"); await page.click("#hSave");
  await reload(); await tab("habit");
  const row = page.locator(".hl", { hasText: "물 2L" }); const rt = await row.textContent(); ok(rt.includes("💧") && rt.includes("건강"), "icon/cat kept");
  await row.click(); ok(await page.inputValue("#hS") === startDay, "start kept"); await page.click(".dlg [data-close]");
  ok(await page.locator(".hl.offh").count() === 1, "off kept");
  if (!firstOfMonth) { await page.locator(`.hg td.c[data-ds="${Y1}"]`).first().click(); ok(await page.locator(`.hg td.c.on[data-ds="${Y1}"]`).count() === 1, "after start allowed"); await page.locator(`.hg td.c[data-ds="${Y1}"]`).first().click(); }
});
await t("A11 습관 체크(표·데일리 양쪽) + 통계 4종 정확 + 1년 달성 그래프 칸 수 + 달 넘기기", async () => {
  await page.click(`.hg td.c[data-ds="${T}"]`); ok(await page.locator(`.hg td.c.on[data-ds="${T}"]`).count() === 1, "grid check");
  const st = await page.locator(".stats div").allTextContents(); const pct = Math.round(100 / today.getDate());
  ok(st[0].startsWith("1개") && st[1].startsWith("1/1") && st[2].startsWith(pct + "%") && st[3].includes("1일") && st[3].includes("물 2L"), st.join("|"));
  const y = today.getFullYear(); const days = Math.round((new Date(y + 1, 0, 1) - new Date(y, 0, 1)) / 864e5); ok(await page.locator(".heat i").count() === days, "heat cells");
  ok(/rgba/.test((await page.locator(`.heat i[title^="${T}"]`).getAttribute("style")) || ""), "today shaded");
  await tab("day"); ok(await page.locator(".chip.on", { hasText: "물 2L" }).count() === 1, "day chip on"); await page.click(".chip.on"); await tab("habit");
  ok(await page.locator(`.hg td.c.on[data-ds="${T}"]`).count() === 0, "unchecked from day"); await page.click(`.hg td.c[data-ds="${T}"]`);
  await page.click("[data-act=hm][data-n='-1']"); ok(!(await h1("r")).includes(MONU[today.getMonth()]), "habit month prev"); await page.click("[data-act=hm][data-n='1']");
});
await t("A12 노트: 새 노트(제목·날짜·분류) → 연도별 목차 → 본문·분류 유지 → 다른 해 노트는 그 해에만 → 삭제 유지", async () => {
  await tab("notes"); await page.click("[data-act=newnote]"); await page.fill("#nT", "책 리뷰"); await page.selectOption("#nC", "책"); await page.click("#nGo");
  await page.fill(".page.r textarea", "좋은 하루는 저녁에 시작된다");
  await page.click("[data-act=newnote]"); await page.fill("#nT", "작년 메모"); await page.fill("#nD", `${today.getFullYear() - 1}-06-01`); await page.click("#nGo");
  await reload(); await page.click("[data-act=today]"); await tab("notes");
  const list = await page.locator(".nl").allTextContents(); ok(list.length === 1 && list[0].includes("책 리뷰") && list[0].includes("책"), list.join("|"));
  await page.click(".nl"); ok(await page.inputValue(".page.r textarea") === "좋은 하루는 저녁에 시작된다", "body");
  await page.click("[data-act=ny][data-n='-1']"); ok((await page.locator(".nl").allTextContents()).join().includes("작년 메모"), "other year");
  await page.click(".nl"); await page.click("[data-act=delnote]"); await page.click("[data-act=delnote]"); await reload(); await tab("notes"); await page.click("[data-act=ny][data-n='-1']");
  ok(await page.locator(".nl").count() === 0, "deleted after reload"); await page.click("[data-act=ny][data-n='1']");
});
await t("A13 설정: 노트 분류 추가·삭제가 새 노트 창에 반영, 새로고침 뒤 유지", async () => {
  await tab("setting"); await page.fill("[data-addcat]", "업무"); await page.press("[data-addcat]", "Enter");
  await tab("notes"); await page.click("[data-act=newnote]"); ok((await page.locator("#nC option").allTextContents()).includes("업무"), "added"); await page.click(".dlg [data-close]");
  await tab("setting"); await page.locator(".chip", { hasText: "맛집" }).locator("[data-act=rmcat]").click(); await reload(); await tab("notes"); await page.click("[data-act=newnote]");
  const o = await page.locator("#nC option").allTextContents(); ok(o.includes("업무") && !o.includes("맛집"), o.join()); await page.click(".dlg [data-close]");
});
await t("A14 설정: 한 주 시작 일요일 → 월간·주간 모두 일요일부터, 새로고침 뒤 유지", async () => {
  await tab("setting"); await page.click('[data-act=ws][data-v="0"]'); await reload(); await tab("month");
  ok((await page.locator(".page.l .cal .hd").allTextContents()).join() === ",SUN,MON,TUE,WED", "month");
  await tab("week"); ok((await page.locator(".wd .dl span").first().textContent()) === "SUN", "week starts SUN");
  await tab("setting"); await page.click('[data-act=ws][data-v="1"]');
});
await t("A15 설정: 사진 기능 끄면 월간 카메라·데일리 사진칸 사라짐, 유지", async () => {
  await page.click('[data-act=photos][data-v="0"]'); await reload(); await tab("month"); ok(await page.locator("[data-act=photo]").count() === 0, "month");
  await tab("day"); ok(await page.locator("[data-act=dphoto]").count() === 0, "day"); await tab("setting"); await page.click('[data-act=photos][data-v="1"]');
});
await t("A16 백업 파일 받기 → 다른 기기(새 브라우저)에서 불러오기 → 습관·일기·일정 그대로", async () => {
  const dl = page.waitForEvent("download"); await page.click("[data-act=export]"); const d = await dl; const backup = await d.path();
  const j = JSON.parse(fs.readFileSync(backup, "utf8")); ok(j.app === "twin-diary" && Object.keys(j.docs).length > 3, "backup content");
  const c2 = await browser.newContext({ timezoneId: tz }); const p2 = await c2.newPage(); await p2.goto(URL0 + "#setting"); await p2.waitForSelector(".book");
  const fc = p2.waitForEvent("filechooser"); await p2.click("[data-act=import]"); await (await fc).setFiles(backup); await p2.waitForTimeout(400);
  await p2.click('.tabs [data-view="habit"]'); ok((await p2.textContent(".page.l")).includes("물 2L"), "habits");
  await p2.click('.tabs [data-view="day"]'); ok(await p2.inputValue(`[data-bind="d-${M}|${DD}.joy"]`) === "커피", "diary");
  await p2.click('.tabs [data-view="month"]'); ok((await p2.textContent(`.c[data-ds="${T}"]`)).includes("주간 회의"), "events"); await c2.close();
});
await t("A17 PREV/NEXT·TODAY: 연간·월간·주간·데일리 각각 날짜가 맞게 이동", async () => {
  await tab("year"); await page.click("[data-act=nav][data-n='1']"); ok((await h1()).startsWith(String(today.getFullYear() + 1)), "year next"); await page.click("[data-act=today]");
  await tab("month"); const h0 = await h1(); await page.click(".page.r [data-act=nav][data-n='1']"); ok(await h1() !== h0, "month next"); await page.click("[data-act=today]"); ok(await h1() === h0, "month today");
  await tab("week"); const w0 = await h1(); await page.click(".page.r [data-act=nav][data-n='1']"); ok(await h1() !== w0, "week next"); await page.click("[data-act=today]"); ok(await h1() === w0, "week today");
  await tab("day"); await page.click(".page.r [data-act=nav][data-n='-1']"); ok((await h1()).startsWith(`${Y1.slice(5, 7)}.${Y1.slice(8)}`), "day prev " + await h1());
  await page.click("[data-act=today]"); ok((await h1()).startsWith(`${T.slice(5, 7)}.${DD}`), "day today");
});
await t("A18 PWA: manifest·아이콘 + 서비스워커 등록 → 인터넷 끊고 다시 열어도 열리고 기록 보임", async () => {
  for (const f of ["manifest.webmanifest", "sw.js", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"]) { const r = await page.request.get(URL0 + f); ok(r.ok(), f); }
  const m = await (await page.request.get(URL0 + "manifest.webmanifest")).json(); ok(m.display === "standalone" && m.icons.length === 2, "manifest");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true)); await page.reload(); await page.waitForSelector(".book");
  await page.waitForFunction(() => caches.has("twin-diary-v1")); await ctx.setOffline(true); await page.reload(); await page.waitForSelector(".book");
  await tab("day"); ok(await page.inputValue(`[data-bind="d-${M}|${DD}.joy"]`) === "커피", "offline open with data"); await ctx.setOffline(false);
});
await t("A19 보안: 악성 백업(일정 시간·노트 id·습관 id에 HTML, __proto__ 키)을 불러와도 스크립트 실행·오염 없음", async () => {
  const evil = `{"app":"twin-diary","v":1,"docs":{
    "ev-${M}":{"list":[{"id":"e1","date":"${T}","time":"<img src=x onerror=\\"window.__pwned=1\\">","title":"ok"}]},
    "n-${T.slice(0, 4)}":{"list":[{"id":"x\\"><img src=x onerror=\\"window.__pwned=2\\">","title":"악성","date":"${T}","cat":"","body":""}]},
    "habits":{"list":[{"id":"h\\"><img src=x onerror=\\"window.__pwned=3\\">","name":"악성습관","start":"${T}","on":true}],"log":{}},
    "settings":{"__proto__":{"polluted":1},"weekStart":1,"photos":true,"noteCats":[]},
    "__proto__":{"polluted":1},"x<y":{"a":1}}}`;
  const f = path.join(os.tmpdir(), "twd-evil.json"); fs.writeFileSync(f, evil);
  const c3 = await browser.newContext({ timezoneId: tz }); const p3 = await c3.newPage(); p3.on("pageerror", e => errors.push("A19: " + e.message));
  await p3.goto(URL0 + "#setting"); await p3.waitForSelector(".book"); const fc = p3.waitForEvent("filechooser"); await p3.click("[data-act=import]"); await (await fc).setFiles(f); await p3.waitForTimeout(300);
  for (const v of ["month", "day", "week", "habit", "notes"]) { await p3.click(`.tabs [data-view="${v}"]`); await p3.waitForTimeout(80); }
  await p3.click(".nl"); await p3.waitForTimeout(200);
  ok((await p3.textContent(".page.l")).includes("악성"), "data imported");
  ok(await p3.evaluate(() => window.__pwned) === undefined, "no script ran"); ok(await p3.evaluate(() => ({}).polluted) === undefined, "no prototype pollution");
  ok(await p3.evaluate(() => Object.keys(localStorage).some(k => k.includes("x<y") || k.includes("__proto__"))) === false, "unknown keys refused"); await c3.close();
});
await ctx.close();

/* ================= Part C: packaging & docs ================= */
const html = fs.readFileSync(path.join(root, "index.html"), "utf8"), readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
await t("C01 아티팩트 규격: 한 파일 HTML·외부 스크립트/스타일/요청 없음·16MiB 미만 — 클로드 채팅으로 그대로 고칠 수 있는 형태", async () => {
  ok(html.startsWith("<!DOCTYPE html>"), "doctype"); ok(Buffer.byteLength(html) < 16 * 1024 * 1024, "size");
  ok(!/<script[^>]+src=/i.test(html) && !/<link[^>]+stylesheet/i.test(html) && !/fetch\(\s*["'`]https?:/i.test(html), "no external loads");
  ok(/<title>트윈 다이어리<\/title>/.test(html), "title");
});
await t("C02 설치 설명서: README 설치 프롬프트가 앱이 쓰는 커넥터 도구·기능을 빠짐없이 선언", async () => {
  const used = new Set([...html.matchAll(/(?:callTool|watchTool)\((?:NOTION|GCAL),"([^"]+)"/g)].map(m => m[1]));
  const prompt = (readme.match(/```\r?\n첨부한[\s\S]*?```/) || [""])[0];
  ok(used.size >= 7, "tools found " + [...used]); for (const x of used) ok(prompt.includes(x), "prompt missing " + x);
  for (const cap of ["db", "user", "assets", "downloads"]) ok(new RegExp(`\\b${cap}\\b`).test(prompt), "cap " + cap);
});
await t("C03 필요 조건 안내: 노션 계정(무료로 충분)·클로드 Pro 이상·구글 계정", async () => {
  ok(/노션 계정\(무료로 충분\)/.test(readme) && /클로드 Pro 이상/.test(readme) && /구글 계정/.test(readme));
});
await t("C04 공개 저장소 구성: README·LICENSE(PolyForm NC)·COMMERCIAL·CONTRIBUTING·체크리스트", async () => {
  for (const f of ["README.md", "LICENSE", "COMMERCIAL.md", "CONTRIBUTING.md", "audit/CHECKLIST.md"]) ok(fs.existsSync(path.join(root, f)), f);
  ok(/PolyForm Noncommercial License 1\.0\.0/.test(fs.readFileSync(path.join(root, "LICENSE"), "utf8")), "license"); ok(!/비상업용 무료/.test(readme), "wording rule");
});

/* ================= Part D: devices ================= */
const seed = `if(!localStorage.getItem("twd:habits")){localStorage.setItem("twd:habits", JSON.stringify({list:[{id:"h1",name:"물 2L",icon:"💧",start:"2020-01-01",on:true},{id:"h2",name:"독서",start:"2020-01-01",on:true}],log:{h1:{"${T}":1}}}));
  localStorage.setItem("twd:n-${T.slice(0, 4)}", JSON.stringify({list:[{id:"n1",title:"노트",date:"${T}",cat:"책",body:"본문"}]}));}`;
const devices = [
  ["iPhone", 393, 852, 3, "narrow"], ["iPhone-SE", 375, 667, 2, "narrow"],
  ["Galaxy-Z-Flip-main", 412, 1004, 2.6, "narrow"], ["Galaxy-Z-Flip-cover", 260, 300, 2, "narrow"],
  ["Galaxy-Z-Fold-cover", 344, 882, 2.6, "narrow"], ["Galaxy-Z-Fold-open", 673, 841, 2.6, "wide"],
  ["Galaxy-Fold-Ultra-open", 1000, 900, 2.4, "wide"], ["iPad-portrait", 820, 1180, 2, "wide"], ["iPad-landscape", 1180, 820, 2, "wide"],
  ["Galaxy-Book-laptop", 1366, 768, 1.5, "wide"], ["Mac", 1512, 982, 2, "wide"], ["Windows", 1920, 1080, 1, "wide"]];
const layoutCheck = () => {
  const bad = [];
  for (const pg of document.querySelectorAll(".page")) { const pr = pg.getBoundingClientRect();
    for (const el of pg.querySelectorAll("*")) { const r = el.getBoundingClientRect(); if (!r.width) continue;
      let a = el.parentElement, clip = false; while (a && a !== pg) { const o = getComputedStyle(a).overflowX; if (o === "auto" || o === "hidden" || o === "scroll") { clip = true; break; } a = a.parentElement; }
      if (!clip && (r.right > pr.right + 2 || r.left < pr.left - 2)) bad.push(el.tagName + "." + el.className); } }
  return { overflow: document.documentElement.scrollWidth - innerWidth, bad: bad.slice(0, 3), cols: getComputedStyle(document.querySelector(".book")).gridTemplateColumns.split(" ").length };
};
for (const [name, w, h, dpr, mode] of devices) {
  await t(`D ${name} ${w}x${h}: 7개 화면 넘침·잘림 없음·${mode === "wide" ? "두 쪽" : "한 쪽"}·탭 보임·습관 칸 눌림·글 입력됨`, async () => {
    const touch = !/Mac|Windows|Galaxy-Book/.test(name);
    const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch && w < 900, timezoneId: tz });
    await c.addInitScript(seed); const p = await c.newPage(); p.on("pageerror", e => errors.push(name + ": " + e.message));
    await p.goto(URL0 + "#month"); await p.waitForSelector(".book");
    for (const v of ["year", "month", "week", "day", "notes", "habit", "setting"]) {
      await p.click(`.tabs [data-view="${v}"]`); const L = await p.evaluate(layoutCheck);
      ok(L.overflow <= 1, `${v} page overflow ${L.overflow}px`); ok(L.bad.length === 0, `${v} clipped ${L.bad}`);
      ok(mode === "wide" ? L.cols === 2 : L.cols === 1, `${v} columns ${L.cols}`);
      const tb = await p.locator(`.tabs [data-view="${v}"]`).boundingBox(); ok(tb && tb.x >= 0 && tb.x + tb.width <= w + 1 && tb.y + tb.height <= h + 1, "tab visible " + v);
    }
    await p.click('.tabs [data-view="habit"]'); const cell = p.locator(`.hg td.c[data-ds="${T}"]`).nth(1); await cell.scrollIntoViewIfNeeded(); await cell.click();
    ok(await p.locator(`.hg td.c.on[data-ds="${T}"]`).count() === 2, "small habit cell tappable");
    await p.click('.tabs [data-view="day"]'); const jy = p.locator(`[data-bind="d-${M}|${DD}.joy"]`); await jy.click(); await p.keyboard.type("기기 입력"); ok(await jy.inputValue() === "기기 입력", "typing");
    await p.click('.tabs [data-view="month"]'); await p.screenshot({ path: path.join(shots, `${name}.png`) }); await c.close();
  });
}
await t("D Surface Duo 두 화면: 7개 화면 모두 쪽이 경첩을 피하고, 아래 탭 버튼도 경첩에 안 걸림", async () => {
  const c = await browser.newContext({ viewport: { width: 1114, height: 705 }, deviceScaleFactor: 2.5, hasTouch: true, timezoneId: tz }); await c.addInitScript(seed);
  const p = await c.newPage(); const s = await c.newCDPSession(p);
  await s.send("Emulation.setDeviceMetricsOverride", { width: 1114, height: 705, deviceScaleFactor: 2.5, mobile: true, displayFeature: { orientation: "vertical", offset: 540, maskLength: 34 } });
  await p.goto(URL0 + "#month"); await p.waitForSelector(".book");
  ok(await p.evaluate(() => matchMedia("(horizontal-viewport-segments:2)").matches), "segments media");
  for (const v of ["year", "month", "week", "day", "notes", "habit", "setting"]) {
    await p.evaluate(v => document.querySelector(`.tabs [data-view="${v}"]`).click(), v);
    const r = await p.evaluate(() => ({ pages: [...document.querySelectorAll(".page")].map(e => { const b = e.getBoundingClientRect(); return [b.left, b.right]; }), tabs: [...document.querySelectorAll(".tabs button")].map(e => { const b = e.getBoundingClientRect(); return [b.left, b.right]; }) }));
    ok(r.pages[0][1] <= 541 && r.pages[1][0] >= 573, `${v} pages ${JSON.stringify(r.pages)}`);
    ok(r.tabs.every(([a, b]) => b <= 541 || a >= 573), `${v} tab on hinge ${JSON.stringify(r.tabs)}`);
  }
  await p.evaluate(() => document.querySelector('.tabs [data-view="month"]').click());
  fs.writeFileSync(path.join(shots, "Surface-Duo.png"), Buffer.from((await s.send("Page.captureScreenshot")).data, "base64")); await c.close();
});

/* ================= Part B: Claude artifact (fake runtime) ================= */
const fake = `(() => {
  const store = JSON.parse(sessionStorage.getItem("__fakedb") || "{}"); const subs = [];
  const persist = () => sessionStorage.setItem("__fakedb", JSON.stringify(store));
  window.__calls = JSON.parse(sessionStorage.getItem("__calls") || "[]"); window.__store = store; window.__watch = [];
  const log = x => { window.__calls.push(x); sessionStorage.setItem("__calls", JSON.stringify(window.__calls)); };
  window.__gev = [{ id: "g1", summary: "구글 일정", start: { dateTime: "${T}T09:00:00+09:00" }, end: { dateTime: "${T}T10:00:00+09:00" }, status: "confirmed" }];
  window.__gpage2 = [{ id: "g9", summary: "둘째 쪽 일정", start: { date: "${T}" }, end: { date: "${T}" } }];
  window.__notionRows = []; let n = +(sessionStorage.getItem("__n") || 0);
  const hex = () => { n++; sessionStorage.setItem("__n", n); return ("f" + n.toString(16)).padStart(32, "0"); };
  const uuid = () => { const h = hex(); return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20); };
  const snapDoc = id => ({ id, exists: true, data: () => store[id], metadata: { fromCache: false, hasPendingWrites: false } });
  const merge = (a, b) => { for (const k of Object.keys(b)) { if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) merge(a[k], b[k]); else a[k] = b[k]; } return a; };
  const col = { limit() { return col; }, async get() { const docs = Object.keys(store).map(snapDoc); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [] }; },
    doc: id => ({ id,
      async set(v) { if (window.__dbFail) { window.__dbFail--; throw { code: "unavailable", message: "unavailable" }; } store[id] = JSON.parse(JSON.stringify(v)); persist(); log({ t: "db.set", id }); },
      async update(v) { if (window.__dbFail) { window.__dbFail--; throw { code: "unavailable", message: "unavailable" }; } if (!store[id]) throw { code: "invalid_argument", message: "missing" }; merge(store[id], JSON.parse(JSON.stringify(v))); persist(); log({ t: "db.update", id, keys: Object.keys(v) }); },
      async get() { return snapDoc(id); } }),
    onSnapshot(next) { subs.push(next); return () => {}; } };
  window.__remote = (id, v) => { store[id] = v; persist(); subs.forEach(f => f({ docs: [], docChanges: () => [{ type: "modified", doc: snapDoc(id) }] })); };
  const mcp = {
    async callTool(s, t, i) { log({ s, t, i });
      if (window.__failNext) { const c = window.__failNext; window.__failNext = null; throw typeof c === "string" ? { code: c, message: c } : c; }
      if (window.__failOn && window.__failOn.t === t && window.__failOn.title === (i.title || "")) { window.__failOn = null; throw { code: "server_unavailable", message: "timeout", retryable: true }; }
      if (t === "notion-create-pages") { const ps = (i.pages || []).map(() => ({ id: uuid(), url: "https://www.notion.so/x" })); return { content: [{ type: "text", text: JSON.stringify({ pages: ps }) }], payload: { pages: ps } }; }
      if (t === "notion-create-database") { const u = uuid(); return { content: [{ type: "text", text: '<database><data-source url="collection://' + u + '"></data-source></database>' }], payload: '<data-source url="collection://' + u + '">' }; }
      if (t === "notion-update-page") return { content: [{ type: "text", text: "ok" }], payload: { ok: true } };
      if (t === "notion-query-data-sources") return { content: [], payload: { results: window.__notionRows } };
      if (t === "list_calendars") return { content: [], payload: { items: [{ id: "primary", summary: "내 캘린더" }, { id: "work@x", summary: "업무" }] } };
      if (t === "list_events") return { content: [], payload: { events: i.pageToken ? window.__gpage2 : window.__gev } };
      if (t === "create_event") { window.__gev.push({ id: "g" + Date.now(), summary: i.summary, start: i.allDay ? { date: i.startTime.slice(0, 10) } : { dateTime: i.startTime + "+09:00" }, end: i.allDay ? { date: i.endTime.slice(0, 10) } : { dateTime: i.endTime + "+09:00" } }); return { content: [], payload: { id: "new" } }; }
      return { content: [], payload: {} }; },
    watchTool(s, t, i, h) { log({ s, t, i, watch: 1 }); const w = { s, t, i, h }; window.__watch.push(w);
      setTimeout(() => h({ type: "data", result: { payload: { events: window.__gev, nextPageToken: "p2" } } }), 0); return () => { w.dead = 1; }; },
    async invalidate() { log({ t: "invalidate" }); window.__watch.filter(w => !w.dead).forEach(w => w.h({ type: "data", result: { payload: { events: window.__gev, nextPageToken: "p2" } } })); },
    async listTools() { return { servers: [] }; } };
  const caps = { db: { collection: p => { window.__colPath = p; return col; }, doc: () => null }, user: { id: async () => "u1" }, mcp,
    assets: { async upload(b) { log({ t: "asset.upload", size: b.size }); return { id: "a1", url: "data:image/png;base64,${PNG.toString("base64")}", sizeBytes: b.size, contentType: b.type }; } },
    downloads: { async save(x) { log({ t: "download", name: x.filename, len: x.data.length }); } } };
  window.claude = { use: async name => caps[name] ?? null };
})();`;
const bctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, timezoneId: tz });
await bctx.addInitScript(fake);
const b = await bctx.newPage(); b.on("pageerror", e => errors.push("B: " + e.message));
await b.goto(URL0 + "#day"); await b.waitForSelector(".book");
const calls = () => b.evaluate(() => window.__calls);
const btab = v => b.click(`.tabs [data-view="${v}"]`);
const settle = () => b.waitForFunction(() => [...document.querySelectorAll(".sstat")].every(e => e.dataset.state === "ok"), undefined, { timeout: 20000 });
const breload = async () => { await settle().catch(() => {}); await b.reload(); await b.waitForSelector(".book"); };
const K = "d-" + M;
const dsIds = () => b.evaluate(() => JSON.parse(JSON.stringify(window.__store.settings.notion.ds)));
const lastProps = (list, pred) => list.flatMap(x => x.t === "notion-update-page" && x.i.command === "update_properties" ? [{ id: x.i.page_id, p: x.i.properties, how: "update" }] : x.t === "notion-create-pages" ? (x.i.pages || []).map(p => ({ p: p.properties, how: "create", parent: x.i.parent, content: p.content })) : []).filter(pred).at(-1);

await t("B01 아티팩트: 계정 저장소(data/users/<id>)에 저장 — 모든 기기 동기화, 이 기기 localStorage에 기록 안 남김", async () => {
  await b.fill(`[data-bind="${K}|${DD}.joy"]`, "기기 동기화"); await settle();
  ok(await b.evaluate(() => window.__colPath) === "data/users/u1", "private path");
  ok((await b.evaluate(k => window.__store[k], K))[DD].joy === "기기 동기화", "in db");
  ok(await b.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("twd:")).length) === 0, "no localStorage data");
  await breload(); ok(await b.inputValue(`[data-bind="${K}|${DD}.joy"]`) === "기기 동기화", "reload reads db");
});
await t("B02 다른 기기에서 고친 내용이 바로 반영(실시간 구독)", async () => {
  await b.evaluate(([k, d]) => window.__remote(k, { ...window.__store[k], [d]: { ...window.__store[k][d], joy: "폰에서 씀" } }), [K, DD]); await b.waitForTimeout(200);
  ok(await b.inputValue(`[data-bind="${K}|${DD}.joy"]`) === "폰에서 씀");
});
await t("B03 두 기기가 같은 달 다른 날을 동시에 써도 서로 안 덮어씀(날짜 단위 저장)", async () => {
  const other = DD === "01" ? "02" : "01";
  await b.fill(`[data-bind="${K}|${DD}.log"]`, "이 기기 로그");
  await b.evaluate(([k, o]) => window.__remote(k, { ...window.__store[k], [o]: { joy: "다른 기기" } }), [K, other]); await settle();
  const doc = await b.evaluate(k => window.__store[k], K); ok(doc[other] && doc[other].joy === "다른 기기", "other device kept"); ok(doc[DD].log === "이 기기 로그", "mine kept");
  ok((await calls()).some(x => x.t === "db.update" && x.id === K && x.keys.join() === DD), "field update only");
});
await t("B04 저장 실패 시 '저장 실패' 표시 후 자동 재시도로 저장 완료", async () => {
  await b.evaluate(() => { window.__dbFail = 2; }); await b.fill(`[data-bind="${K}|${DD}.comment"]`, "재시도 시험");
  await b.waitForFunction(() => document.querySelector(".foot .sstat").dataset.state === "fail", undefined, { timeout: 5000 });
  await settle(); ok((await b.evaluate(k => window.__store[k], K))[DD].comment === "재시도 시험", "saved after retry");
});
await t("B05 노션 연결: 부모 페이지 + 데이터베이스 5개(Diary·Planner·Notes·Habits·Habit Log), 중간 실패 후 다시 누르면 이어서", async () => {
  await btab("setting"); await b.evaluate(() => { window.__failOn = { t: "notion-create-database", title: "Notes" }; });
  await b.click("[data-act=nsetup]"); await b.waitForFunction(() => document.querySelector("[data-act=nsetup]") && !document.querySelector("[data-act=nsetup]").disabled);
  await b.click("[data-act=nsetup]"); await b.waitForSelector("text=연결됨");
  const c = (await calls()).filter(x => x.s === "Notion");
  ok(c.filter(x => x.t === "notion-create-pages" && x.i.creation_mode === "draft").length === 1, "parent page once");
  const dbs = c.filter(x => x.t === "notion-create-database"); ok(dbs.map(x => x.i.title).join() === "Diary,Planner,Notes,Notes,Habits,Habit Log", dbs.map(x => x.i.title).join());
  ok(dbs.every(x => x.i.parent.page_id && /CREATE TABLE/.test(x.i.schema)), "under parent");
  for (const f of ["Wake Up", "In Bed", "Sleep Journal", "Morning Note", "To do", "Log", "Joy", "Reset", "Tomorrow", "Comment"]) ok(dbs[0].i.schema.includes(`"${f}"`), "diary field " + f);
});
await t("B06 데일리 [노션 저장]: Diary에 전 속성 생성 → 다시 저장하면 같은 페이지 갱신, '저장 안 됨' 표시는 새로고침해도 유지", async () => {
  await btab("day"); await b.click("[data-act=nsave]"); await b.waitForTimeout(250);
  const cr = lastProps(await calls(), x => x.how === "create" && x.p.Title === T); const D = await dsIds();
  ok(cr && cr.parent.data_source_id === D.diary, "diary ds");
  for (const [f, v] of Object.entries({ "date:Date:start": T, "Joy": "폰에서 씀", "Log": "이 기기 로그", "Comment": "재시도 시험" })) ok(cr.p[f] === v, f + "=" + cr.p[f]);
  for (const f of ["Wake Up", "In Bed", "Sleep Journal", "Morning Note", "To do", "Event", "Habits", "Reset", "Tomorrow"]) ok(f in cr.p, "prop " + f);
  ok(!(await b.textContent("#nstat")).includes("안 됨"), "saved flag");
  await b.fill(`[data-bind="${K}|${DD}.tomorrow"]`, "다정한 사람"); ok((await b.textContent("#nstat")).includes("저장 안 됨"), "unsaved flag");
  await breload(); await btab("day"); ok((await b.textContent("#nstat")).includes("저장 안 됨"), "unsaved survives reload");
  await b.click("[data-act=nsave]"); await b.waitForTimeout(250);
  const map = await b.evaluate(() => window.__store.nmap); const up = lastProps(await calls(), x => x.how === "update" && x.p.Title === T);
  ok(up && up.id === map["d:" + T] && up.p.Tomorrow === "다정한 사람", "same page updated"); ok(!(await b.textContent("#nstat")).includes("안 됨"), "flag cleared");
});
await t("B07 노션에서 고친 일기를 [노션에서 가져오기]로 받아옴, 이 기기에서 아직 노션 저장 안 한 날은 덮어쓰지 않음", async () => {
  const other = DD === "01" ? "02" : "01", od = `${M}-${other}`;
  await b.evaluate(([od, T]) => { window.__notionRows = [{ properties: { "Title": od, "date:Date:start": od, "Joy": "노션에서 고침", "To do": "[x] 노션 할일\n[ ] 둘째", "Reset": "비움\n→ 걷기" } }, { properties: { "Title": T, "date:Date:start": T, "Joy": "덮어쓰면 안 됨" } }]; }, [od, T]);
  await b.fill(`[data-bind="${K}|${DD}.log"]`, "아직 노션 저장 안 함");
  await b.click("[data-act=npull]"); await b.waitForTimeout(400);
  const q = (await calls()).filter(x => x.t === "notion-query-data-sources").at(-1); ok(q && q.i.data.mode === "rows" && q.i.data.data_source_url.endsWith((await dsIds()).diary), "query");
  const doc = await b.evaluate(k => window.__store[k], K); ok(doc[other].joy === "노션에서 고침" && doc[other].reset === "비움" && doc[other].resetAct === "걷기", JSON.stringify(doc[other]));
  ok(doc[other].todos[0].done === true && doc[other].todos[1].t === "둘째", "todos"); ok(doc[DD].joy !== "덮어쓰면 안 됨", "unsaved day protected");
  await b.click("[data-act=nsave]"); await b.waitForTimeout(200);
});
await t("B08 [전부 만들기]: 올해 1월 1일~2027년 말 모든 날짜·월·주 페이지, 50개씩, 중복 없음, 다시 누르면 새로 안 만듦", async () => {
  await btab("setting"); const preMap = await b.evaluate(() => ({ ...window.__store.nmap })); const before = (await calls()).length; await b.click("[data-act=nall]"); await b.waitForSelector("text=전부 만들기", { timeout: 60000 });
  const c = (await calls()).slice(before).filter(x => x.t === "notion-create-pages");
  const y0 = today.getFullYear(), end = new Date(2027, 11, 31);
  const days = []; for (let d = new Date(y0, 0, 1); d <= end; d.setDate(d.getDate() + 1)) days.push(ymd(d));
  const months = []; for (let d = new Date(y0, 0, 1); d <= end; d.setMonth(d.getMonth() + 1)) months.push(ymd(d).slice(0, 7));
  const mon = new Date(y0, 0, 1); mon.setDate(1 - ((mon.getDay() + 6) % 7)); const weeks = []; for (let d = new Date(mon); d <= end; d.setDate(d.getDate() + 7)) weeks.push(ymd(d));
  const map = await b.evaluate(() => window.__store.nmap);
  ok(days.every(d => map["d:" + d]) && months.every(m => map["m:" + m]) && weeks.every(w => map["w:" + w]), "every page mapped");
  const D = await dsIds(); const pre = ["d:" + T, `d:${M}-${DD === "01" ? "02" : "01"}`].filter(k => k);
  const diaryTitles = c.filter(x => x.i.parent.data_source_id === D.diary).flatMap(x => x.i.pages.map(p => p.properties.Title));
  ok(new Set(diaryTitles).size === diaryTitles.length && !diaryTitles.includes(T), "no duplicates, existing day skipped");
  const want = days.filter(d => !preMap["d:" + d]).length; ok(diaryTitles.length === want, `diary ${diaryTitles.length} vs ${want}`); ok(c.every(x => x.i.pages.length <= 50), "≤50 per call");
  ok(new Set(Object.values(map)).size === Object.keys(map).length, "unique page ids");
  const b2 = (await calls()).length; await b.click("[data-act=nall]"); await b.waitForTimeout(250); ok((await calls()).slice(b2).filter(x => x.t === "notion-create-pages").length === 0, "resume creates nothing");
});
await t("B09 월간 목표·체크·기간기록 → Planner(Month) 같은 페이지로 자동 반영", async () => {
  await btab("month"); await b.fill(`[data-add="m-${M}|goals"]`, "책 2권"); await b.press(`[data-add="m-${M}|goals"]`, "Enter");
  await b.locator(".memo .ck input[type=checkbox]").last().check(); await b.fill(".memo textarea", "월간 흐름"); await b.waitForTimeout(3200);
  const u = lastProps(await calls(), x => x.p.Category === "Month" && x.p.Title === M); const map = await b.evaluate(() => window.__store.nmap);
  ok(u && u.how === "update" && u.id === map["m:" + M] && u.p.Goal.includes("[x] 책 2권") && u.p["Period Log"] === "월간 흐름", JSON.stringify(u && u.p));
});
await t("B10 주간 목표 체크·기간기록 → Planner(Week) 자동 반영", async () => {
  await btab("week"); await b.locator(".page.l [data-add]").fill("정리"); await b.locator(".page.l [data-add]").press("Enter"); await b.locator(".page.l .ck input[type=checkbox]").first().check();
  await b.locator(".page.l textarea").first().fill("주간 흐름"); await b.waitForTimeout(3200);
  const u = lastProps(await calls(), x => x.p.Category === "Week"); ok(u && u.how === "update" && u.p.Goal.includes("[x] 정리") && u.p["Period Log"] === "주간 흐름", JSON.stringify(u && u.p));
});
await t("B11 습관 생성·수정→Habits, 체크·해제→Habit Log(개수 포함)", async () => {
  await btab("habit"); await b.fill("[data-addhabit]", "스트레칭"); await b.press("[data-addhabit]", "Enter"); await b.click(`.hg td.c[data-ds="${T}"]`); await b.waitForTimeout(3200);
  const D = await dsIds(); let c = await calls();
  ok(lastProps(c, x => x.how === "create" && x.parent?.data_source_id === D.habits && x.p.Name === "스트레칭" && x.p.On === "__YES__"), "habits row");
  ok(lastProps(c, x => x.how === "create" && x.parent?.data_source_id === D.habitlog && x.p.Done === "스트레칭" && x.p.Count === 1), "log row");
  await b.locator(".hl", { hasText: "스트레칭" }).click(); await b.fill("#hC", "건강"); await b.click("#hSave"); await b.click(`.hg td.c[data-ds="${T}"]`); await b.waitForTimeout(3200); c = await calls();
  ok(lastProps(c, x => x.how === "update" && x.p.Name === "스트레칭" && x.p.Category === "건강"), "habit edit"); ok(lastProps(c, x => x.how === "update" && x.p.Title === T && x.p.Count === 0), "uncheck");
});
await t("B12 노트를 만들면 노션 Notes에 바로 들어가고, 본문을 고치면 노션 본문도 바뀜", async () => {
  await btab("notes"); await b.click("[data-act=newnote]"); await b.fill("#nT", "영화 리뷰"); await b.selectOption("#nC", "영화"); await b.click("#nGo"); await b.waitForTimeout(3200);
  const D = await dsIds(); ok(lastProps(await calls(), x => x.how === "create" && x.parent?.data_source_id === D.notes && x.p.Name === "영화 리뷰" && x.p.Category === "영화"), "auto created");
  await b.fill(".page.r textarea", "장면이 오래 남았다"); await b.waitForTimeout(3200);
  ok((await calls()).some(x => x.t === "notion-update-page" && x.i.command === "replace_content" && x.i.new_str === "장면이 오래 남았다"), "body synced");
});
await t("B13 노션 페이지 갱신 실패: 지워진 페이지면 새로 만들고, 다른 오류면 중복 생성하지 않음", async () => {
  await btab("day"); await b.evaluate(() => { window.__failNext = { code: "tool_error", message: "validation_error: bad property" }; });
  const n0 = (await calls()).filter(x => x.t === "notion-create-pages").length; await b.click("[data-act=nsave]"); await b.waitForTimeout(250);
  ok((await calls()).filter(x => x.t === "notion-create-pages").length === n0, "no duplicate");
  await b.evaluate(() => { window.__failNext = { code: "tool_error", message: "Could not find page with ID" }; }); await b.click("[data-act=nsave]"); await b.waitForTimeout(250);
  ok((await calls()).filter(x => x.t === "notion-create-pages").length === n0 + 1, "recreated");
});
await t("B14 구글 캘린더: 연동·캘린더 선택 → 월 단위로 읽어 칸에 표시(다음 쪽까지)", async () => {
  await btab("setting"); await b.click('[data-act=gcal][data-v="1"]'); await b.waitForSelector("#calSel option >> nth=2", { state: "attached" });
  await b.selectOption("#calSel", "work@x"); await btab("month"); await b.waitForTimeout(300);
  const w = (await calls()).filter(x => x.watch && x.t === "list_events").at(-1); ok(w.s === "Google Calendar" && w.i.calendarId === "work@x" && w.i.startTime.endsWith("-01T00:00:00"), JSON.stringify(w.i));
  const txt = await b.textContent(`.c[data-ds="${T}"]`); ok(txt.includes("구글 일정") && txt.includes("09:00"), txt); ok(txt.includes("둘째 쪽 일정"), "page 2");
  ok((await calls()).some(x => x.t === "list_events" && x.i.pageToken === "p2"), "pageToken");
});
await t("B15 구글 일정: 시간대 변환(UTC→한국), 여러 날 일정은 걸친 날마다 표시", async () => {
  const N2 = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)); const N3 = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2));
  await b.evaluate(([T, N3]) => { window.__gev.push({ id: "gz", summary: "UTC 일정", start: { dateTime: T + "T00:30:00Z" }, end: { dateTime: T + "T01:30:00Z" } }, { id: "gm", summary: "여행", start: { date: T }, end: { date: N3 } });
    window.__watch.forEach(w => !w.dead && w.h({ type: "data", result: { payload: { events: window.__gev } } })); }, [T, N3]); await b.waitForTimeout(200);
  await btab("week"); await btab("day"); const dtxt = await b.textContent(".page.l"); ok(dtxt.includes("09:30") && dtxt.includes("UTC 일정"), "UTC→KST 09:30");
  await btab("month"); if (N2.slice(0, 7) === M) ok((await b.textContent(`.c[data-ds="${N2}"]`)).includes("여행"), "multi-day shown on next day");
  ok(!N3.startsWith(M) || !(await b.textContent(`.c[data-ds="${N3}"]`)).includes("여행"), "end date exclusive");
});
await t("B16 날짜 눌러 일정 추가 → create_event(선택 캘린더·1시간), 다시 읽어 반영, 구글에서 고치면 반영", async () => {
  await b.click(`.c[data-ds="${T}"]`, { position: { x: 40, y: 70 } }); await b.fill("#evT", "점심 약속"); await b.fill("#evH", "12:30"); await b.click("#evAdd"); await b.waitForTimeout(300);
  const c = (await calls()).filter(x => x.t === "create_event").at(-1); ok(c.i.summary === "점심 약속" && c.i.startTime === `${T}T12:30:00` && c.i.endTime === `${T}T13:30:00` && c.i.calendarId === "work@x", JSON.stringify(c.i));
  ok((await calls()).some(x => x.t === "invalidate"), "refetch"); await btab("day"); ok((await b.textContent(".page.l")).includes("점심 약속"), "shown");
  await b.evaluate(() => { window.__gev[0].summary = "구글에서 고침"; window.__watch.forEach(w => !w.dead && w.h({ type: "data", result: { payload: { events: window.__gev } } })); });
  await b.waitForTimeout(150); ok((await b.textContent(".page.l")).includes("구글에서 고침"), "edit in Google reflected"); await btab("month");
});
await t("B17 아티팩트 사진: assets 저장소에 올리고 주소만 기록, 새로고침 뒤 표시, 노션에는 안 보냄", async () => {
  await b.click("[data-act=photo]"); const fc = b.waitForEvent("filechooser"); await b.click(`.c[data-ds="${T}"]`, { position: { x: 40, y: 70 } }); await (await fc).setFiles({ name: "a.png", mimeType: "image/png", buffer: PNG }); await b.waitForTimeout(400);
  ok((await calls()).some(x => x.t === "asset.upload"), "uploaded"); const p = (await b.evaluate(k => window.__store[k], "p-" + M))[DD]; ok(p.startsWith("data:image/png") && p.length < 400, "url stored, not bytes");
  await breload(); await btab("month"); ok(((await b.getAttribute(`.c[data-ds="${T}"]`, "style")) || "").includes("data:image/png"), "shown after reload");
  ok(!JSON.stringify((await calls()).filter(x => x.s === "Notion")).includes("data:image"), "never sent to Notion"); await b.click("[data-act=photo]");
});
await t("B18 아티팩트 백업: downloads 기능으로 파일 저장", async () => {
  await btab("setting"); await b.click("[data-act=export]"); await b.waitForTimeout(150); ok((await calls()).some(x => x.t === "download" && x.name.startsWith("twin-diary-") && x.len > 100));
});
await t("B19 커넥터 오류는 원인별 안내(다시 연결·추가·허용·정책·일시 장애), 다시 누르면 정상 동작", async () => {
  await btab("day");
  for (const [code, word] of [["needs_reauth", "다시 연결"], ["server_not_connected", "추가"], ["approval_required", "허용"], ["blocked_by_policy", "정책"], ["server_unavailable", "잠시 뒤"]]) {
    await b.evaluate(c => window.__failNext = c, code); await b.click("[data-act=nsave]"); await b.waitForTimeout(180); ok((await b.textContent("#toast")).includes(word), code + ": " + await b.textContent("#toast"));
  }
  await b.click("[data-act=nsave]"); await b.waitForTimeout(250); ok((await b.textContent("#toast")).includes("저장했어요"), "works again after error");
});
await b.screenshot({ path: path.join(shots, "artifact-day.png") });
await bctx.close(); await browser.close(); server.close();

await t("Z 페이지 스크립트 오류 0건", async () => { ok(errors.length === 0, errors.join(" / ")); });
const out = results.join("\n") + `\n\n${results.length - failed}/${results.length} passed  (browser: ${exePath || "playwright default"})`;
console.log(out);
fs.writeFileSync(path.join(root, "test", "last-run.txt"), new Date().toISOString() + "\n" + out + "\n");
process.exit(failed ? 1 : 0);
