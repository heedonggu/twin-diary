# 외부 채점 — Gemini

- 채점자: Gemini 웹(gemini.google.com), ego 브라우저로 새 대화에서 요청. 이 앱을 만든 모델이 아님.
- 첨부: index.html, test/e2e.mjs, audit/CHECKLIST.md, 같은 날 `node test/e2e.mjs` 실행 출력(63/63, audit/TEST-RUN.txt), README·LICENSE·COMMERCIAL·CONTRIBUTING·sw.js·manifest, 기기 캡처 5장, 원작 대조 시트 audit/compare.jpg.
- 요청문: 항목마다 화면→동작→저장→시험 대조, 구현만 점수, compare.jpg로 원작과 다른 화면을 결함으로 적기.

평가자: Gemini, 2026-11-21 11:46 KST

시험 실행 결과 요약: 63/63 통과 (node test/e2e.mjs 실행 출력 기준)

#	항목	판정	근거(함수, 시험 이름)
1	연간·월간·주간·데일리·노트·습관·설정 페이지 이동 (오른쪽 세로 인덱스 탭)	구현	render(), VIEWS, [data-view] 클릭 핸들러, hashchange / A01
2	연간 인덱스(2026 Goal): 12개월 상자 월 목표, 월 클릭 이동	구현	vYear(), checklist(), [data-act="openm"] / A02
3	월간: 두 쪽 펼침(월~목 / 금~일+MEMO), 주차(W) 표시	구현	vMonth(), grid(), isoWeek() / A03
4	월간 목표(Monthly Goal) 체크리스트·기간 기록(Period Log)	구현	memoCol(), checklist(), ta(), S.save("m-...") / A04
5	날짜 칸 클릭 일정 추가, 일정 수정·삭제	구현	eventDialog(), addEvent(), updateEvent(), removeEvent(), S.save("ev-...") / A05, A05b, B16, B16b
6	날짜에서 그날 데일리로 이동	구현	[data-go-day], go2("day", ...) / A06
7	카메라 아이콘으로 사진 다이어리 전환 및 날짜별 사진 추가	구현	st.photo, pickPhoto(), #file change, S.flush("p-...") / A07, B17
8	월간 오른쪽 칸 키워드 일기	구현	memoCol(pm), md.keywords, S.save("m-...") / A07
9	주간: Week N·기간 표시, Weekly Goal, Period Log, 7일 일정	구현	vWeek(), weekNo(), checklist(), ta(), S.save("w-...") / A09
10	위클리·데일리에서도 같은 일정 표시	구현	eventsOn(), evLines(), vWeek(), vDay() / A08, A09
11	데일리: WAKE UP·IN BED 시간	구현	vDay() .tm input[type=time], S.save("d-...") / A08
12	데일리: SLEEP JOURNAL·MORNING NOTE	구현	vDay() ta(dk, dd+".sleep"), ta(dk, dd+".morning") / A08
13	데일리: TO DO·LOG	구현	vDay() checklist(dk, dd+".todos"), ta(dk, dd+".log") / A08
14	데일리: JOY — 작은 기쁨	구현	vDay() ta(dk, dd+".joy") / A08
15	데일리: RESET — 생각 비우기 + 내가 할 수 있는 작은 일 하나	구현	vDay() ta(dk, dd+".reset"), data-bind="...resetAct" / A08
16	데일리: TOMORROW — 내일 되고 싶은 사람	구현	vDay() ta(dk, dd+".tomorrow") / A08
17	데일리: COMMENT	구현	vDay() ta(dk, dd+".comment") / A08
18	데일리 [노션 저장] 버튼, 미저장 변경 막대·「•」 표시, [되돌리기]	구현	saveDayNotion(), diaryProps(), ubar(), changed(), [data-act="revert"] / B06, B06b
19	습관: 이름 입력 후 Enter로 생성	구현	[data-addhabit] keydown, S.save("habits") / A10, B11
20	습관 상세 페이지: 미니 달력 12개·달성률·연속·아이콘·분류·시작일·순서·ON/OFF·삭제	구현	vHabitOne(), miniMonth(), EMO, hEdit(), applyHF() / A10, A11
21	습관 페이지와 데일리 양쪽에서 체크	구현	[data-act="hab"], vHabit() .hg td.c, vDay() .chip / A11
22	습관 통계 4종과 연간 달성 그래프	구현	vHabit() .stats, .heat / A11
23	월간·주간 목표와 체크박스가 노션 Planner에 동기화	구현	afterEdit(), syncMonth(), syncWeek(), plannerProps() / B09, B10
24	습관이 노션 Habits·Habit Log에 연결	구현	syncHabit(), syncHabitDay(), nUpsert() / B11
25	노트: 제목·분류 선택 생성(본문은 시트), 연도별 목차 분류별 묶음 + 월 달력 표시	구현	noteDialog(), noteEdit(), vNotes(), S.save("n-...") / A12, A19
26	노트 분류 커스텀 추가·삭제	구현	vSetting() [data-addcat], [data-act="rmcat"], S.save("settings") / A13
27	노트가 노션 Notes에 자동 반영(본문 수정 포함)	구현	noteDialog(), afterEdit(), syncNote(), noteProps() / B12
28	노션 연결 시 데이터베이스 5개 자동 생성(중단 후 이어서)	구현	notionSetup(), NDB, c.notionPart / B05
29	설정 [전부 만들기]로 2027년까지 일괄 생성(진행 토스트·페이지 수), 한 장씩 생성	구현	notionCreateAll(), [data-act="mkm"], [data-act="mkd"] / B08, B08b
30	구글 캘린더 일정 실시간 연동(다음 페이지·여러 날 일정 포함)	구현	ensureMonth(), watchTool(), morePages(), addG() / B14, B15
31	앱↔구글 캘린더 양방향 일정 추가·수정·삭제 반영	구현	addEvent(), updateEvent(), removeEvent(), MCP.invalidate() / B16, B16b
32	사진은 노션 미전송, 아티팩트(assets) 또는 로컬 축소 저장, 용량 안내	구현	ASSETS.upload(), shrink(), vSetting() 안내문 / A07, B17
33	시작 요일 등 취향 설정	구현	vSetting() [data-act="ws"], weekStart(), vMonth(), vWeek() / A14
34	사진 기능 사용 여부 선택, 습관 보기 ON만/전체	구현	vSetting() [data-act="photos"], [data-act="showoff"] / A15, A15b
35	멀티 디바이스 실시간 동기화(아티팩트 계정 저장소) / 단독 백업 파일	구현	boot() db.collection("data/users/"+id), onSnapshot(), exportData() / B01, B02, B03, B18, A16
36	아티팩트 채팅 수정 및 가계부·업무일지 확장 안내	구현	vSetting() 안내 섹션, README.md §6 / README.md 확인
37	설치 안내 문서 및 설치 프롬프트	구현	README.md §2-2 설치 프롬프트(도구·권한 전체 선언) / C02
38	노션 무료 계정·클로드 Pro 이상·구글 계정 필요 조건 안내	구현	README.md §1, §2-1 / C03
39	이전·다음 이동(PREV/NEXT)과 오늘로(TODAY)	구현	[data-act="nav"], [data-act="today"] / A17
40	커넥터 권한 허용 흐름과 원인별 오류 안내	구현	mcpMsg(), NPERM / B19
41	(대표 추가) 아이폰 대응	구현	@media (max-width:639px), viewport-fit=cover, safe-area-inset-* / D iPhone, D iPhone-SE
42	(대표 추가) 서피스 듀오(두 화면) — 쪽마다 한 화면, 경첩 회피	구현	@media (horizontal-viewport-segments:2), env(viewport-segment-*) / D Surface Duo
43	(대표 추가) 갤럭시 Z 폴드 — 접었을 때·펼쳤을 때	구현	mqWide (min-width:640px) 기준 1열/2열 전환 / D Fold-cover, D Fold-open
44	(대표 추가) 갤럭시 Z 플립 — 메인·커버 화면	구현	@media (max-width:639px), @media (max-width:359px) 4x2 탭 그리드 / D Flip-main, D Flip-cover
45	(대표 추가) 폴드 울트라(큰 펼침 화면)	구현	mqWide 2열 펼쳐짐 레이아웃 / D Fold-Ultra-open
46	(대표 추가) 아이패드 세로·가로	구현	mqWide 2열 펼쳐짐 레이아웃 / D iPad-portrait, D iPad-landscape
47	(대표 추가) 갤럭시북·노트북·맥·윈도우	구현	mqWide 2열 레이아웃 + PWA 설치 / D Galaxy-Book, D Mac, D Windows, A18
48	(대표 추가) 앱처럼 설치(오프라인 동작)	구현	manifest.webmanifest, sw.js, navigator.serviceWorker.register / A18
49	(대표 추가) 설명서 포함 GitHub 저장소 공개	구현	README.md, LICENSE, COMMERCIAL.md, CONTRIBUTING.md / C04
50	노션 수정 내용 다이어리로 역동기화 및 미전송 로컬 데이터 보호	구현	pullNotionMonth(), unsent(), [data-act="npull"] / B07, B07b
51	(품질) 저장 상태 표시, 저장 실패 시 자동 재시도	구현	S.flush(), saveStatus(), .sstat / A08, B04
52	(품질) 노션에서 지운 페이지는 다시 만들어 이어서 동기화	구현	nUpsert() 삭제 오류 감지 후 notion-create-pages 재호출 / B13
53	(품질) 입력값·백업 XSS 방어, 프로토타입 오염 차단, 아티팩트 규격, 오류 0건	구현	esc(), okPhoto(), KEY_OK, safeJSON() / A19, C01, Z
54	(품질) 노션 자동 반영 실패 시 지수 백오프 재시도 및 재실행 시 재전송	구현	autoNotion(), pend(), resendNotion(), S.get("npend") / B21

점수 = 54 ÷ 54 × 100 = 100%

빠진 기능·결함 목록

노트 본문 역동기화 누락 (설계·구현 한계): pullNotionMonth()는 노션 Notes 데이터베이스의 속성(Name, Category)만 가져오며, 노션 페이지 본문(body)을 읽어오는 로직이 없어 노션에서 노트 본문을 수정해도 앱에 반영되지 않습니다. (단, 50번 체크리스트와 README §4·§5에 제한사항으로 명시됨)

노션 쿼리 100건 페이지네이션 미구현: nRows()의 limit: 100 고정 호출(index.html 303행)로 인해, 한 해 노트가 100건을 초과하면 101번째 이후 노트의 역동기화가 누락됩니다.

갤럭시 Z 플립 커버 화면(Galaxy-Z-Flip-cover.png, 260×300) 하단 네비게이션 가림: 300px의 극단적으로 낮은 세로 높이에서 position: fixed 하단 2줄 탭 바(.tabs)가 달력 4주 차(21일 칸) 하단 영역을 덮어 가립니다. 스크롤로 내릴 수 있으나 초기 뷰포트에서 달력 하단 일부가 탭 바에 가려집니다.

원작 화면 대비 차이 (compare.jpg 대조):

원작 1번(연간 Goal): 원작은 노션 페이지 상단 제목(2026 Goal)과 우측 페이지 상단 빈 헤더 없이 양쪽 열이 상단 정렬되어 있으나, 구현체는 우측 페이지 상단에도 높이 맞추기용 빈 .ph 헤더(&nbsp;)가 들어가 상단 여백이 존재합니다.

원작 3번(데일리): 원작은 좌측 페이지 최상단부터 WAKE UP / IN BED가 바로 시작되나, 구현체는 미저장 변경이 있을 때 상단에 검은색 .ubar("저장하지 않은 변경 N건") 막대가 삽입되고, 노션 페이지가 없을 때 안내 문구와 [이 날짜 페이지 만들기] 버튼이 추가되어 원작에 없는 UI 요소가 상단을 차지합니다.

원작 8번(설정 - 전부 만들기): 원작은 노션 데이터베이스 자체의 New 버튼 템플릿이나 외부 생성 방식을 사용하나, 구현체는 SETTING 탭 우측 패널 안에 [전부 만들기] 버튼과 페이지 카운터(PAGES) UI를 별도 구획으로 배치했습니다.

원작 체크리스트 누락 항목: 원작 영상 5:36 탭 바에 노출된 PROJECT 탭 및 관련 프로젝트 관리 뷰가 체크리스트와 구현체에서 제외되었습니다(영상 내 실제 화면·동작 시연이 없어 제외 사유는 타당함).

결론: 배포 가능 (체크리스트 54개 기준 100% 충족 및 E2E 63개 전 항목 통과. 단, Z 플립 커버 화면 하단 바 가림 현상과 노트 100건 초과 시 역동기화 한계는 향후 패치 권장)