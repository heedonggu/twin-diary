# 외부 채점 — Gemini

- 채점자: Gemini 웹(gemini.google.com), ego 브라우저로 새 대화에서 요청. 이 앱을 만든 모델이 아님.
- 첨부: index.html, test/e2e.mjs, audit/CHECKLIST.md, 같은 날 `node test/e2e.mjs` 실행 출력(60/60), README·LICENSE·COMMERCIAL·CONTRIBUTING·sw.js·manifest, 기기 캡처 5장.
- 요청문: 아래 결과 앞의 채점 지시(항목마다 화면→동작→저장→시험 대조, 구현만 점수).

## 결과(원문)

평가자: Gemini, 2026-11-19 00:37 KST

시험 실행 결과 요약: 60/60 통과

#	항목	판정	근거(함수, 시험 이름)
1	연간·월간·주간·데일리·노트·습관·설정 페이지를 오른쪽 세로 인덱스 탭으로 오감	구현	render(), VIEWS, click [data-view], hashchange / A01
2	연간 인덱스: 12개월을 한눈에, 월 누르면 그 달로	구현	vYear(), openm / A02
3	월간: 두 쪽 펼침 — 왼쪽 월~목, 오른쪽 금~일 + MEMO 칸, 주차(W) 표시	구현	vMonth(), grid(), isoWeek() / A03
4	월간 목표(Monthly Goal) 체크리스트·기간 기록(Period Log)	구현	memoCol(), checklist(), ta(), S.save() / A04
5	날짜 칸을 눌러 일정 추가, 넣은 일정 고치기·지우기	구현	eventDialog(), addEvent(), updateEvent(), removeEvent(), S.save() / A05, A05b, B16, B16b
6	날짜에서 그날 데일리로 이동	구현	vMonth() [data-go-day], go2("day") / A06
7	카메라 아이콘으로 월간이 사진 다이어리로 바뀌고 날짜마다 사진 추가	구현	vMonth() [data-act=photo], pickPhoto(), shrink(), S.save() / A07, B17
8	월간 오른쪽 칸에 키워드 일기	구현	memoCol(k, pm), `data-bind="m-...
9	주간: Week N·기간 표시, Weekly Goal 체크리스트, Period Log, 7일 일정	구현	vWeek(), weekNo(), checklist(), ta(), S.save() / A09
10	위클리·데일리에서도 같은 일정이 보임	구현	eventsOn(), vWeek(), vDay() / A08, A09
11	데일리: WAKE UP·IN BED 시간	구현	vDay() .tm input, S.save() / A08
12	데일리: SLEEP JOURNAL·MORNING NOTE	구현	vDay() ta(..., ".sleep"), ta(..., ".morning"), S.save() / A08
13	데일리: TO DO·LOG	구현	vDay() checklist(..., ".todos"), ta(..., ".log"), S.save() / A08
14	데일리: JOY — 작은 기쁨	구현	vDay() ta(..., ".joy"), S.save() / A08
15	데일리: RESET — 생각 비우기 + 옆에 내가 할 수 있는 작은 일 하나	구현	vDay() ta(..., ".reset"), resetAct, S.save() / A08
16	데일리: TOMORROW — 내일 되고 싶은 사람	구현	vDay() ta(..., ".tomorrow"), S.save() / A08
17	데일리: COMMENT	구현	vDay() ta(..., ".comment"), S.save() / A08
18	데일리 [노션 저장] 버튼 → Diary 데이터베이스 속성이 바로 채워짐, 안 눌렀으면 표시	구현	vDay() [data-act=nsave], saveDayNotion(), diaryProps(), isUnsaved(), markUnsaved() / B06
19	습관: 이름 쓰고 Enter로 생성	구현	vHabit() [data-addhabit], keydown Enter, S.save(), syncHabit() / A10, B11
20	습관 눌러 아이콘·분류·시작일 바꾸기, 끄기	구현	habitDialog(), S.save(), syncHabit(), hab 시작일 검사 / A10
21	습관 페이지와 데일리 양쪽에서 체크	구현	vHabit(), vDay() .chips, hab 액션, S.save(), syncHabitDay() / A11
22	습관 통계(진행 중 습관·오늘 완료·이 달 전체·최고 습관)와 연간 달성 그래프	구현	vHabit() .stats, .heat, streak() / A11
23	월간·주간 목표와 체크박스가 노션 Planner에 동기화	구현	afterEdit(), syncMonth(), syncWeek(), plannerProps(), nUpsert() / B09, B10
24	습관이 노션 Habits·Habit Log에 연결	구현	syncHabit(), syncHabitDay(), nUpsert() / B11
25	노트: 제목 쓰고 분류 골라 새 노트, 연도별 목차(CONTENTS)에 쌓임	구현	noteDialog(), vNotes(), S.save(), delnote / A12
26	노트 분류를 내 취향대로 바꿈	구현	vSetting() rmcat, [data-addcat], S.save() / A13
27	노트가 노션 Notes에 들어감	구현	noteDialog(), afterEdit(), syncNote(), nUpsert() / B12
28	노션 연결 시 데이터베이스 템플릿 5개 자동 생성(Diary·Planner·Notes·Habits·Habit Log)	구현	notionSetup(), NDB, notionPart 이어받기 / B05
29	설정의 [전부 만들기] 한 번으로 2027년까지 필요한 페이지 전부 생성	구현	notionCreateAll(), 50개 청크, NM() 중복 방지 / B08
30	구글 캘린더 일정이 실시간 연동되어 보임	구현	ensureMonth(), MCP.watchTool, morePages(), addG() / B14, B15
31	앱에서 넣은 일정이 구글 캘린더로, 구글 캘린더에서 고친 일정이 앱으로	구현	addEvent(), updateEvent(), removeEvent(), MCP.invalidate, watchTool / B16, B16b
32	사진은 노션에 안 가고 아티팩트 안에만 저장, 용량 한도 있음	구현	#file change, ASSETS.upload(), shrink(), vSetting() 안내 / A07, B17
33	시작 요일 등 취향 설정	구현	vSetting() ws, weekStart(), S.save() / A14
34	사진 기능 사용 여부 선택	구현	vSetting() photos, vMonth(), vDay(), S.save() / A15
35	데스크톱·노트북·태블릿·폰 어디서나 같은 다이어리	구현	boot() db.collection("data/users/"+id), onSnapshot, S.flush() 필드 단위 update, exportData(), #importFile / B01, B02, B03, B18, A16
36	고치고 싶은 곳은 아티팩트 채팅으로 말해서 수정, 같은 스타일로 가계부·업무일지 확장	구현	vSetting() 안내 문구, README.md §6 / C01
37	설치 안내 문서(원작은 노션 페이지, 프롬프트 복사 → 파일 첨부 → 자동 설치)	구현	README.md §2-2 설치 프롬프트 / C02
38	노션 계정 필요(무료로 충분), 클로드 유료 구독 필요(노션 연결 시)	구현	README.md §1 / C03
39	이전·다음 이동(PREV/NEXT)과 오늘로	구현	nav, today 액션 / A17
40	커넥터 권한 허용 흐름과 오류 안내	구현	mcpMsg(), vSetting() 오류 표시, toast() / B19
41	(대표 추가) 아이폰	구현	@media (max-width:639px), env(safe-area-inset-*), apple-mobile-web-app-capable, iPhone.png 캡처 확인 / D iPhone, D iPhone-SE
42	(대표 추가) 듀오(두 화면) — 쪽마다 한 화면, 경첩 피함	구현	@media (horizontal-viewport-segments:2), env(viewport-segment-*), Surface-Duo.png 캡처 확인 / D Surface Duo
43	(대표 추가) 갤럭시 Z 폴드 — 접었을 때·펼쳤을 때	구현	mqWide (640px), @media (max-width:639px) / D Fold-cover, D Fold-open
44	(대표 추가) 갤럭시 Z 플립 — 메인·커버 화면	구현	@media (max-width:359px) 4×2 하단 탭 그리드, Galaxy-Z-Flip-cover.png 캡처 확인 / D Flip-main, D Flip-cover
45	(대표 추가) 폴드 울트라(큰 펼침 화면)	구현	mqWide, .book 2열, Galaxy-Fold-Ultra-open.png 캡처 확인 / D Fold-Ultra-open
46	(대표 추가) 아이패드 세로·가로	구현	mqWide, .book 2열, iPad-landscape.png 캡처 확인 / D iPad-portrait, D iPad-landscape
47	(대표 추가) 갤럭시북·노트북·맥·윈도우	구현	mqWide, .book 2열, PWA 설치 / D Galaxy-Book, D Mac, D Windows, A18
48	(대표 추가) 앱처럼 설치(오프라인)	구현	manifest.webmanifest, sw.js, boot() 서비스워커 등록 / A18
49	(대표 추가) 설명서 포함 GitHub 저장소 공개	구현	README.md, LICENSE, COMMERCIAL.md, CONTRIBUTING.md, CHECKLIST.md / C04
50	노션에서 고친 내용이 다이어리로 돌아옴 — Diary·Planner·Habit Log·Habits·Notes, 미전송 편집 보호	구현	pullNotionMonth(), nRows(), unsent(), vDay() [data-act=npull] / B07, B07b
51	(품질) 저장 상태 표시, 저장 실패 시 자동 재시도	구현	S.flush(), saveStatus(), .sstat / A08, B04
52	(품질) 노션에서 지운 페이지는 다시 만들어 이어서 동기화	구현	nUpsert() 삭제 오류 정규식 감지 후 notion-create-pages 재생성 / B13
53	(품질) 입력값·백업 파일로 화면 스크립트 실행 불가, 아티팩트 규격 준수, 페이지 오류 0건	구현	esc(), okPhoto(), KEY_OK, safeJSON() / A19, C01, Z
54	(품질) 노션 자동 반영이 실패하면 잠시 뒤 스스로 다시 보내고, 끝내 못 보내면 다음에 열 때 보냄	구현	autoNotion(), pend(), resendNotion() / B21

점수 = 54 ÷ 54 × 100 = 100%

빠진 기능·결함 목록:

원작 누락 기능: CHECKLIST.md 하단 주석에 명시된 PROJECT 탭 외 누락 없음(단, README.md §4 안내대로 노션에서 새로 추가한 페이지나 노트 본문 역방향 동기화는 미지원).

보안: 사용자 입력 및 백업 JSON의 HTML 속성은 esc()로 이스케이프되며, 사진 URL은 okPhoto() 화이트리스트 검증, 백업 키는 KEY_OK 및 safeJSON() 프로토타입 오염 방지가 적용되어 있음. 커넥터 오류는 mcpMsg()로 분기 처리되며 자동 재시도 큐(autoNotion, pend)가 동작함. 다만 nRows()의 limit: 100 제한으로 월간·전체 행이 100건을 초과할 경우 이후 행은 누락될 수 있음(소스 주석에 ponytail로 표기됨).

기기별 화면 캡처(5장): Galaxy-Z-Flip-cover.png, Surface-Duo.png, Galaxy-Fold-Ultra-open.png, iPad-landscape.png, iPhone.png 모두 텍스트 잘림, 요소 겹침, 경첩 침범 없음.

결론: 배포 가능(100%)