const STORAGE_KEY = "ksimath-demo-data-v2";
const PHOTO_STUDENT_SESSION_KEY = "photoStudentSession";
const PHOTO_STUDENT_REMEMBER_KEY = "photoStudentSessionRemember";
const DEVICE_UA = navigator.userAgent;
const TABLET_DEVICE = /iPad/i.test(DEVICE_UA)
  || (/Macintosh/i.test(DEVICE_UA) && navigator.maxTouchPoints > 1)
  || (/Android/i.test(DEVICE_UA) && !/Mobile/i.test(DEVICE_UA));
const MOBILE_DEVICE = !TABLET_DEVICE && /Android|iPhone|iPod|KAKAOTALK/i.test(DEVICE_UA);
document.documentElement.classList.toggle("mobile-device", MOBILE_DEVICE);
document.documentElement.classList.toggle("tablet-device", TABLET_DEVICE);

let deferredInstallPrompt = null;
const IS_IOS_DEVICE = /iPhone|iPad|iPod/i.test(DEVICE_UA)
  || (/Macintosh/i.test(DEVICE_UA) && navigator.maxTouchPoints > 1);
const IS_STANDALONE = window.matchMedia("(display-mode: standalone)").matches
  || window.navigator.standalone === true;

const seedData = {
  classes: [
    { id: "11111111-1111-1111-1111-111111111111", name: "고1 수학 A반", gradeLevel: "고1", memo: "", weeklyReportTarget: true },
    { id: "22222222-2222-2222-2222-222222222222", name: "고1 수학 M반", gradeLevel: "고1", memo: "", weeklyReportTarget: true },
    { id: "33333333-3333-3333-3333-333333333333", name: "고3반", gradeLevel: "고3", memo: "" },
  ],
  students: [
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "김민준", password: "1111", school: "강남고", classId: "11111111-1111-1111-1111-111111111111" },
    { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "이서연", password: "2222", school: "서초고", classId: "22222222-2222-2222-2222-222222222222" },
    { id: "cccccccc-cccc-cccc-cccc-cccccccccccc", name: "박지후", password: "3333", school: "반포고", classId: "33333333-3333-3333-3333-333333333333" },
  ],
  homeworks: [
    { id: "h1", date: "2026-06-16", content: "쎈 수학 I p.42-49, 오답 노트 정리", classId: "11111111-1111-1111-1111-111111111111" },
    { id: "h2", date: "2026-06-18", content: "수열 프린트 2장 풀고 채점", classId: "11111111-1111-1111-1111-111111111111" },
    { id: "h3", date: "2026-06-17", content: "개념원리 함수 단원 확인 문제", classId: "22222222-2222-2222-2222-222222222222" },
    { id: "h4", date: "2026-06-22", content: "모의고사 21, 29, 30번 재풀이", classId: "33333333-3333-3333-3333-333333333333" },
    { id: "h5", date: "2026-06-28", content: "미적분 실전 모의 1회, 틀린 문항 해설 작성", classId: "33333333-3333-3333-3333-333333333333" },
    { id: "h6", date: "2026-07-02", content: "기말 대비 단원별 체크리스트 완성", classId: "22222222-2222-2222-2222-222222222222" },
    { id: "h7", date: "2026-07-04", content: "방학 특강 사전 진단지 풀기", classId: "11111111-1111-1111-1111-111111111111" },
  ],
  videos: [
    { id: "v1", classId: "11111111-1111-1111-1111-111111111111", title: "수학 I 지수함수 핵심 정리", url: "https://www.youtube.com/watch?v=ysz5S6PUM-U", createdAt: "2026-06-13" },
    { id: "v2", classId: "11111111-1111-1111-1111-111111111111", title: "고1 A반 6월 1주차 오답 해설", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw", createdAt: "2026-06-08" },
    { id: "v3", classId: "22222222-2222-2222-2222-222222222222", title: "함수 그래프 변환과 심화 유형", url: "https://www.youtube.com/watch?v=ysz5S6PUM-U", createdAt: "2026-06-14" },
    { id: "v4", classId: "22222222-2222-2222-2222-222222222222", title: "고1 M반 기말 대비 문제풀이", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw", createdAt: "2026-06-10" },
    { id: "v5", classId: "33333333-3333-3333-3333-333333333333", title: "6월 모의고사 킬러 문항 분석", url: "https://www.youtube.com/watch?v=ysz5S6PUM-U", createdAt: "2026-06-15" },
    { id: "v6", classId: "33333333-3333-3333-3333-333333333333", title: "미적분 도함수 활용 실전 풀이", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw", createdAt: "2026-06-09" },
  ],
  videoViews: [],
  studentScores: [],
  studentNotes: [],
  counselingRecords: [],
  classSessions: [],
  studentLessonRecords: [],
};

const config = window.KSIMATH_SUPABASE || {};
// 예전에는 여기에 이메일이 박혀 있었습니다. config.adminEmail이 이미 있었는데도
// 그 값은 로그인 칸 기본값에만 쓰고 권한 판정은 상수로 해서, 사실상 같은 값을
// 두 군데에 두고 있었습니다. 이제 빌드가 환경변수로 넣어주는 값 하나만 봅니다.
const ADMIN_EMAIL = String(config.adminEmail || "").trim().toLowerCase();
const supabaseUrl = cleanSupabaseUrl(config.url || "");
const isConfigured = Boolean(supabaseUrl && config.anonKey && !supabaseUrl.includes("YOUR_") && !config.anonKey.includes("YOUR_"));
const supabaseClient = isConfigured && window.supabase ? window.supabase.createClient(supabaseUrl, config.anonKey) : null;

const ADMIN_DASHBOARD_NAV = ["admin-dashboard", "관리자 대시보드"];
const ADMIN_NAV_GROUPS = [
  {
    id: "operations",
    label: "운영 관리",
    items: [
      ["students-admin", "학생 관리"],
      ["classes", "반 관리"],
    ],
  },
  {
    id: "learning",
    label: "학습 관리",
    items: [
      ["homework-admin", "숙제 관리"],
      ["photo-homework-admin", "사진 숙제"],
      ["videos-admin", "영상 관리"],
    ],
  },
  {
    id: "records",
    label: "기록·분석",
    items: [
      ["school-scores", "내신 성적"],
      ["student-records", "학생 기록"],
      ["lesson-journal", "수업일지"],
      ["weekly-report", "주간 보고서"],
      ["video-views", "시청 기록"],
    ],
  },
];
const ADMIN_NAV_ITEMS = [ADMIN_DASHBOARD_NAV, ...ADMIN_NAV_GROUPS.flatMap((group) => group.items)];
const WEEKLY_REPORT_TIME_ZONE = "Asia/Seoul";
const WEEKLY_REPORT_DAY_MS = 86400000;
const WEEKLY_REPORT_COLLATOR = new Intl.Collator("ko-KR", { sensitivity: "base", numeric: true });

function weeklyReportSeoulDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WEEKLY_REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function weeklyReportIsoToDay(value) {
  const dateKey = String(value || "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const day = Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / WEEKLY_REPORT_DAY_MS);
  return weeklyReportDayToIso(day) === dateKey ? day : null;
}

function weeklyReportDayToIso(day) {
  const date = new Date(day * WEEKLY_REPORT_DAY_MS);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function weeklyReportAddDays(value, amount) {
  const day = weeklyReportIsoToDay(value);
  return day == null ? "" : weeklyReportDayToIso(day + amount);
}

function weeklyReportRangeContaining(value, now = new Date()) {
  const selectedDay = weeklyReportIsoToDay(value);
  const todayDay = weeklyReportIsoToDay(weeklyReportSeoulDateKey(now));
  if (selectedDay == null || todayDay == null || selectedDay > todayDay) return null;
  const weekday = new Date(selectedDay * WEEKLY_REPORT_DAY_MS).getUTCDay();
  const startDay = selectedDay - ((weekday - 2 + 7) % 7);
  const endDay = startDay + 6;
  return {
    start: weeklyReportDayToIso(startDay),
    end: weeklyReportDayToIso(endDay),
    effectiveEnd: weeklyReportDayToIso(Math.min(endDay, todayDay)),
    status: endDay < todayDay ? "complete" : "provisional",
  };
}

function currentWeeklyReportRange(now = new Date()) {
  return weeklyReportRangeContaining(weeklyReportSeoulDateKey(now), now);
}

function defaultCompletedWeeklyReportRange(now = new Date()) {
  const current = currentWeeklyReportRange(now);
  return {
    start: weeklyReportAddDays(current.start, -7),
    end: weeklyReportAddDays(current.start, -1),
    effectiveEnd: weeklyReportAddDays(current.start, -1),
    status: "complete",
  };
}

function initialLessonJournalState() {
  return {
    view: "write",
    sessions: [],
    records: [],
    draft: null,
    dirty: false,
    saving: false,
    loading: false,
    loadPromises: {},
    sessionsLoaded: false,
    recordsLoaded: false,
    feedback: { type: "", text: "" },
    filters: {
      date: { from: "", to: "", classId: "", page: 1 },
      student: { studentId: "", from: "", to: "" },
      summary: { from: "", to: "", classId: "" },
    },
  };
}

function initialWeeklyReportState(requestId = 0) {
  const range = defaultCompletedWeeklyReportRange();
  return {
    periodStart: range.start,
    periodEnd: range.end,
    loading: false,
    loaded: false,
    requestId,
    result: null,
    error: "",
    expanded: { immediate: false, observation: false },
  };
}

function initialStudentPhotoState(requestId = 0) {
  return {
    loading: false,
    loaded: false,
    requestId,
    openAssignmentIds: [],
    details: {},
    detailRequestIds: {},
    summaryRequestIds: {},
  };
}

// 진행 중이던 요청이 늦게 도착했을 때 무시하려고 번호를 붙여 둡니다.
// 로그아웃하면 하나 올려서 그 전에 나간 응답을 전부 무효로 만듭니다.
// 0으로 되돌리면 옛 응답이 유효한 것으로 받아들여져 다음 사용자의 화면에
// 끼어들 수 있습니다.
function nextRequestId(previous) {
  return previous === undefined || previous === null ? 0 : Number(previous) + 1;
}

// 화면 상태 전체를 만드는 한 곳입니다.
//
// 예전에는 logout()이 초기화할 필드를 스무 줄 넘게 손으로 나열했습니다.
// 여기에 필드를 추가하면서 그쪽을 잊으면, 그 값만 로그아웃 뒤에도 남습니다.
// 실제로 관리자 화면 필터 여러 개가 그렇게 남아 있었습니다.
//
// previous를 주면 로그아웃으로 보고 요청 번호를 이어받아 올립니다.
function initialState(previous = null) {
  const isReset = Boolean(previous);
  return {
    data: structuredClone(seedData),
    user: null,
    // 로그인 화면의 학생/관리자 탭입니다. 방금 나간 쪽을 그대로 보여줍니다.
    role: previous?.role || "student",
    view: "calendar",
    adminMenu: { openGroup: "", mobileOpen: false, navigationId: nextRequestId(previous?.adminMenu?.navigationId) },
    selectedClassId: null,
    calendarDate: new Date(),
    adminCalendarGrade: "",
    homeworkDraftDate: "",
    edit: null,
    homeworkView: "upcoming",
    studentFilters: {},
    showArchivedStudents: false,
    openStudentId: "",
    recordFormType: "note",
    recordStudentId: "",
    recordFilters: { studentId: "", type: "all", from: "", to: "" },
    schoolScoreView: "bulk",
    schoolScoreCriteria: { schoolYear: new Date().getFullYear(), gradeLevel: "고1", classId: "", semester: "1학기", examType: "중간고사", maxScore: 100 },
    schoolReportFilters: { studentId: "", schoolYear: new Date().getFullYear(), gradeLevel: "고1" },
    schoolCompareFilters: { schoolYear: new Date().getFullYear(), gradeLevel: "고1", student: "", school: "", classId: "" },
    photoHomeworkView: "periods",
    photoData: { periods: [], homeworks: [], targets: [], assignments: [], rounds: [], photos: [], deletions: [] },
    photoFilters: { periodId: "", grade: "", classId: "", homeworkId: "", student: "", status: "" },
    photoStatsFilters: { periodId: "", grade: "", classId: "", homeworkId: "", student: "" },
    photoStatsSort: "completion_desc",
    photoPreview: {},
    photoUpload: { assignmentId: "", files: [], busy: false, progress: "" },
    photoLightbox: { ids: [], index: 0 },
    photoReviewOpenIds: [],
    photoReview: { items: [], page: 1, pageSize: 30, total: 0, pendingCount: 0, loading: false },
    photoReviewRequestId: nextRequestId(previous?.photoReviewRequestId),
    photoAdminRequestId: nextRequestId(previous?.photoAdminRequestId),
    photoAdminLoading: false,
    photoReviewDetails: {},
    photoStatsLoaded: false,
    photoSessionError: "",
    studentPhoto: initialStudentPhotoState(nextRequestId(previous?.studentPhoto?.requestId)),
    videoView: { search: "", page: 1, pageSize: 50, total: 0, loading: false, requestId: nextRequestId(previous?.videoView?.requestId) },
    lessonJournal: initialLessonJournalState(),
    weeklyReport: initialWeeklyReportState(nextRequestId(previous?.weeklyReport?.requestId)),
    // 첫 실행은 데이터를 불러오는 중이고, 로그아웃 뒤는 바로 로그인 화면입니다.
    // loading이 true면 렌더가 로그인 화면을 그리지 않습니다.
    loading: !isReset,
    message: "",
  };
}

let state = initialState();

// 검색 입력 디바운스
//
// 한글은 조합 중에도 oninput이 계속 들어옵니다. 조합이 끝나기 전에 검색을
// 돌리면 "ㄱ", "가", "강"처럼 중간 글자로 조회가 나갑니다. composing 표시가
// 붙어 있는 동안에는 예약만 취소하고 넘어갑니다.
//
// 예전에는 이 처리가 시청기록·사진검토·사진통계 세 곳에 따로 있었습니다.
// 지연 시간이나 조합 판정을 고치려면 세 곳을 맞춰야 했고, 타이머 변수도
// 세 개를 따로 들고 다녔습니다.
const SEARCH_DEBOUNCE_MS = 300;
const searchDebounceTimers = new Map();

function cancelSearchDebounce(key) {
  clearTimeout(searchDebounceTimers.get(key));
  searchDebounceTimers.delete(key);
}

function cancelAllSearchDebounces() {
  searchDebounceTimers.forEach((timer) => clearTimeout(timer));
  searchDebounceTimers.clear();
}

function debounceSearchInput(key, input, run) {
  cancelSearchDebounce(key);
  if (input.dataset.composing === "1") return;
  searchDebounceTimers.set(key, setTimeout(run, SEARCH_DEBOUNCE_MS));
}

// 전체 재렌더로 입력칸이 새로 만들어지므로 포커스를 되돌려주고 커서를
// 끝으로 보냅니다.
function refocusSearchInput(selector) {
  requestAnimationFrame(() => {
    const next = document.querySelector(selector);
    if (!next) return;
    next.focus();
    next.setSelectionRange(next.value.length, next.value.length);
  });
}

let videoViewSearchSelection = { start: 0, end: 0 };

function cleanSupabaseUrl(url) {
  return url.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

function isAdminEmail(email) {
  // 설정이 비면 둘 다 빈 문자열이 되어 아무나 통과하므로 먼저 막습니다.
  if (!ADMIN_EMAIL) return false;
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

function loadDemoData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(seedData);
  try {
    return { ...structuredClone(seedData), ...JSON.parse(saved) };
  } catch {
    return structuredClone(seedData);
  }
}

function saveDemoData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function getPhotoStudentSession() {
  return localStorage.getItem(PHOTO_STUDENT_REMEMBER_KEY) || sessionStorage.getItem(PHOTO_STUDENT_SESSION_KEY) || "";
}

function savePhotoStudentSession(token, remember = false) {
  clearPhotoStudentSession();
  if (!token) return;
  if (remember) localStorage.setItem(PHOTO_STUDENT_REMEMBER_KEY, token);
  else sessionStorage.setItem(PHOTO_STUDENT_SESSION_KEY, token);
}

function clearPhotoStudentSession() {
  sessionStorage.removeItem(PHOTO_STUDENT_SESSION_KEY);
  localStorage.removeItem(PHOTO_STUDENT_REMEMBER_KEY);
}

function normalizeClass(item) {
  return {
    id: item.id,
    name: item.name,
    gradeLevel: item.grade_level || item.gradeLevel || "",
    memo: item.memo || "",
    // 주간 보고서 집계 대상인지. 예전에는 반 이름 문자열로 판단했습니다.
    weeklyReportTarget: Boolean(item.weekly_report_target ?? item.weeklyReportTarget),
  };
}

function normalizeStudent(item) {
  return {
    id: item.id,
    name: item.name,
    school: item.school || "",
    classId: item.class_id || item.classId,
    archivedAt: item.archived_at || item.archivedAt || null,
  };
}

function isStudentArchived(student) {
  return Boolean(student?.archivedAt);
}

function activeStudents() {
  return (state.data.students || []).filter((student) => !isStudentArchived(student));
}

function normalizeHomework(item) {
  return { id: item.id, date: item.date, content: item.content, classId: item.class_id || item.classId };
}

function normalizeVideo(item) {
  return { id: item.id, classId: item.class_id || item.classId, title: item.title, url: item.url, createdAt: item.created_at || item.createdAt };
}

function normalizeVideoView(item) {
  return { id: item.id, studentId: item.student_id || item.studentId, videoId: item.video_id || item.videoId, clickedAt: item.clicked_at || item.clickedAt };
}

function normalizeStudentScore(item) {
  return {
    id: item.id,
    studentId: item.student_id,
    schoolYear: item.school_year == null ? null : Number(item.school_year),
    gradeLevel: item.grade_level || "",
    semester: item.semester || "",
    examType: item.exam_type || "",
    examDate: item.exam_date,
    examName: item.exam_name,
    subject: item.subject || "",
    score: item.score == null ? null : Number(item.score),
    maxScore: Number(item.max_score),
    grade: item.grade || "",
    memo: item.memo || "",
  };
}

function normalizeStudentNote(item) {
  return { id: item.id, studentId: item.student_id, recordDate: item.record_date, category: item.category, importance: item.importance, content: item.content };
}

function normalizeCounselingRecord(item) {
  return {
    id: item.id,
    studentId: item.student_id,
    counselingDate: item.counseling_date,
    target: item.target,
    content: item.content,
    followUp: item.follow_up || "",
    isCompleted: Boolean(item.is_completed),
  };
}

function normalizeClassSession(item) {
  return {
    id: item.id,
    classId: item.class_id || item.class_id_snapshot || item.classId || item.classIdSnapshot,
    sessionDate: item.session_date || item.sessionDate,
    title: item.title || "",
    lessonMemo: item.lesson_memo || item.lessonMemo || "",
    classNameSnapshot: item.class_name_snapshot || item.classNameSnapshot || "",
    gradeSnapshot: item.grade_snapshot || item.gradeSnapshot || "",
    createdAt: item.created_at || item.createdAt,
    updatedAt: item.updated_at || item.updatedAt,
  };
}

function normalizeStudentLessonRecord(item) {
  return {
    id: item.id,
    sessionId: item.session_id || item.sessionId,
    studentId: item.student_id || item.student_id_snapshot || item.studentId || item.studentIdSnapshot,
    studentNameSnapshot: item.student_name_snapshot || item.studentNameSnapshot || "",
    schoolSnapshot: item.school_snapshot || item.schoolSnapshot || "",
    classNameSnapshot: item.class_name_snapshot || item.classNameSnapshot || "",
    gradeSnapshot: item.grade_snapshot || item.gradeSnapshot || "",
    attendanceStatus: item.attendance_status || item.attendanceStatus || "present",
    homeworkAchievement: item.homework_achievement || item.homeworkAchievement || "pending",
    memo: item.memo || "",
    createdAt: item.created_at || item.createdAt,
    updatedAt: item.updated_at || item.updatedAt,
  };
}

function toDb(item) {
  const output = { ...item };
  const fields = {
    classId: "class_id",
    createdAt: "created_at",
    studentId: "student_id",
    videoId: "video_id",
    clickedAt: "clicked_at",
    examDate: "exam_date",
    examName: "exam_name",
    maxScore: "max_score",
    recordDate: "record_date",
    counselingDate: "counseling_date",
    followUp: "follow_up",
    isCompleted: "is_completed",
    archivedAt: "archived_at",
    schoolYear: "school_year",
    gradeLevel: "grade_level",
    examType: "exam_type",
    weeklyReportTarget: "weekly_report_target",
  };
  Object.entries(fields).forEach(([source, target]) => {
    if (source in output) {
      output[target] = output[source];
      delete output[source];
    }
  });
  return output;
}

async function refreshData() {
  if (!supabaseClient) {
    const demoData = loadDemoData();
    if (state.user?.role === "admin") demoData.videoViews = [];
    state.data = demoData;
    state.loading = false;
    return;
  }

  const [classes, homeworks, videos, students] = await Promise.all([
    supabaseClient.from("classes").select("*").order("created_at", { ascending: true }),
    supabaseClient.from("homeworks").select("*").order("date", { ascending: true }),
    supabaseClient.from("videos").select("*").order("created_at", { ascending: false }),
    state.user?.role === "admin"
      ? supabaseClient.from("students").select("id, name, school, class_id, archived_at, created_at").order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);
  const [studentScores, studentNotes, counselingRecords] = state.user?.role === "admin"
    ? await Promise.all([
        supabaseClient.from("student_scores").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("student_notes").select("*").order("record_date", { ascending: false }),
        supabaseClient.from("counseling_records").select("*").order("counseling_date", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const error = classes.error || homeworks.error || videos.error || students.error || studentScores.error || studentNotes.error || counselingRecords.error;
  if (error) throw error;

  state.data = {
    classes: classes.data.map(normalizeClass),
    homeworks: homeworks.data.map(normalizeHomework),
    videos: videos.data.map(normalizeVideo),
    students: (students.data || []).map(normalizeStudent),
    videoViews: state.data.videoViews || [],
    studentScores: (studentScores.data || []).map(normalizeStudentScore),
    studentNotes: (studentNotes.data || []).map(normalizeStudentNote),
    counselingRecords: (counselingRecords.data || []).map(normalizeCounselingRecord),
    classSessions: state.data.classSessions || [],
    studentLessonRecords: state.data.studentLessonRecords || [],
  };
  state.loading = false;
}

async function restoreStudentSession() {
  const token = getPhotoStudentSession();
  if (!supabaseClient || !token) return false;
  try {
    const session = await photoApi("student-session", {}, token);
    const student = session.student ? normalizeStudent(session.student) : null;
    if (!student) throw new Error("학생 정보를 찾을 수 없습니다.");
    state.user = { ...student, role: "student" };
    state.role = "student";
    state.view = "calendar";
    state.photoSessionError = "";
    return true;
  } catch (error) {
    clearPhotoStudentSession();
    state.photoSessionError = "";
    return false;
  }
}

async function init() {
  renderLoading();
  try {
    if (supabaseClient) {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session?.user) {
        if (isAdminEmail(data.session.user.email)) {
          state.user = { name: data.session.user.email, role: "admin" };
          state.view = "admin-dashboard";
        } else {
          await supabaseClient.auth.signOut();
          state.user = null;
          state.role = "admin";
          state.message = "관리자 권한이 없는 계정입니다.";
        }
      }
      if (!state.user) await restoreStudentSession();
    }
    await refreshData();
  } catch (error) {
    state.loading = false;
    state.message = `데이터를 불러오지 못했습니다: ${error.message}`;
  }
  render();
}

function h(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function js(value) {
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function uid(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// state.data는 refreshData에서 통째로 교체되고, 데모 모드 쓰기도 배열을 새로
// 만들도록 맞춰뒀습니다(writeRecord, deleteRecord, saveSchoolScores).
// 그래서 배열 자체를 키로 캐시해도 값이 상하지 않습니다.
//
// find와 동작을 맞추기 위해 같은 id가 여럿이면 먼저 나온 것을 씁니다.
let classIndexSource = null;
let classIndex = new Map();
function classById(classId) {
  const list = state.data.classes || [];
  if (classIndexSource !== list) {
    classIndex = new Map();
    list.forEach((item) => {
      if (!classIndex.has(item.id)) classIndex.set(item.id, item);
    });
    classIndexSource = list;
  }
  return classIndex.get(classId);
}

// 캘린더는 셀 42개를 그리면서 정렬 비교자마다 이걸 두 번씩 부르고,
// 사진 통계는 배정 한 건마다 부릅니다. 예전에는 그때마다 반 배열을
// 선형 탐색했습니다.
function className(classId) {
  return classById(classId)?.name || "미지정 반";
}

function gradeLabelFromClassName(name) {
  return String(name || "").match(/고[123]/)?.[0] || "";
}

function classGradeLevel(classOrId) {
  const classItem = classOrId && typeof classOrId === "object"
    ? classOrId
    : classById(classOrId);
  const storedGrade = classItem?.gradeLevel || classItem?.grade_level || "";
  if (["고1", "고2", "고3"].includes(storedGrade)) return storedGrade;
  return gradeLabelFromClassName(classItem?.name || "");
}

function studentVisibleClasses() {
  if (state.user?.role !== "student") return state.data.classes;
  const myClass = state.data.classes.find((item) => item.id === state.user.classId);
  const myGrade = classGradeLevel(myClass);
  if (!myGrade) return state.data.classes.filter((item) => item.id === state.user.classId);
  return state.data.classes.filter((item) => classGradeLevel(item) === myGrade);
}

function studentVisibleClassIds() {
  return new Set(studentVisibleClasses().map((item) => item.id));
}

function studentVisibleHomeworks() {
  const visibleClassIds = studentVisibleClassIds();
  return state.data.homeworks.filter((item) => visibleClassIds.has(item.classId));
}

function studentVisibleVideos() {
  const visibleClassIds = studentVisibleClassIds();
  return state.data.videos.filter((item) => visibleClassIds.has(item.classId));
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
}

function studentGrade(student) {
  return classGradeLevel(student.classId);
}

function studentFilterForGrade(grade) {
  if (!state.studentFilters[grade]) {
    state.studentFilters[grade] = { classIds: [], schools: [] };
  }
  return state.studentFilters[grade];
}

function toggleStudentFilter(grade, type, value) {
  const filters = studentFilterForGrade(grade);
  const list = filters[type];
  if (list.includes(value)) {
    filters[type] = list.filter((item) => item !== value);
  } else {
    filters[type] = [...list, value];
  }
  render();
}

function setStudentSchoolFilter(grade, value) {
  const filters = studentFilterForGrade(grade);
  filters.schools = value ? [value] : [];
  render();
}

function resetStudentGradeFilters(grade) {
  state.studentFilters[grade] = { classIds: [], schools: [] };
  render();
}

function toggleStudentDetail(studentId) {
  state.openStudentId = state.openStudentId === studentId ? "" : studentId;
  render();
}

function weekdayName(date) {
  return ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][date.getDay()];
}

function formatDateWithWeekday(value) {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdayName(date)}`;
}

function formatMonthDay(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdayName(date)} ${date.getHours()}:${minutes}`;
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function app(html) {
  document.querySelector("#app").innerHTML = html;
}

function renderLoading() {
  app(`<main class="loading-screen"><img src="assets/logo-vertical.png" alt="강성인수학" /><p>불러오는 중입니다.</p></main>`);
}

function render() {
  if (state.loading) {
    renderLoading();
    return;
  }
  if (!state.user) {
    renderLogin();
    return;
  }
  renderShell();
}

function connectionNotice() {
  if (supabaseClient) return "";
  return `<div class="notice">현재는 데모 모드입니다. 학생들이 각자 접속해 같은 데이터를 보려면 <strong>supabase-config.js</strong>에 Supabase 정보를 입력한 뒤 배포하세요.</div>`;
}

function renderLogin() {
  const adminMode = state.role === "admin";
  app(`
    <main class="login-shell">
      <section class="login-intro">
        <img src="assets/logo-horizontal.png" alt="강성인수학" />
        <div class="intro-copy">
          <h1>숙제와 수업 영상을 한곳에서 확인합니다.</h1>
          <p>고등학생 수강생이 필요한 과제와 반별 강의 링크를 빠르게 찾고, 선생님은 반복 공지를 단순하게 관리할 수 있는 강성인수학 전용 학습 공간입니다.</p>
        </div>
        <p class="subtle">${supabaseClient ? "관리자는 Supabase Auth에 만든 이메일 계정으로 로그인합니다." : "데모 학생: 김민준 / 1111 · 데모 관리자: 선생님 / admin123"}</p>
      </section>
      <section class="login-panel">
        <div class="login-card">
          <img class="mobile-logo" src="assets/logo-vertical.png" alt="강성인수학" />
          <h2>로그인</h2>
          <p class="subtle">학생 또는 관리자 계정으로 접속하세요.</p>
          ${connectionNotice()}
          ${state.message ? `<div class="notice error">${h(state.message)}</div>` : ""}
          <div class="role-tabs" aria-label="로그인 유형">
            <button class="${state.role === "student" ? "active" : ""}" onclick="setRole('student')">학생</button>
            <button class="${state.role === "admin" ? "active" : ""}" onclick="setRole('admin')">관리자</button>
          </div>
          <form onsubmit="login(event)">
            <div class="field">
              <label for="loginName">${adminMode && supabaseClient ? "이메일" : "이름"}</label>
              <input id="loginName" autocomplete="username" placeholder="${adminMode && supabaseClient ? "관리자 이메일" : "이름을 입력하세요"}" value="${adminMode ? h(supabaseClient ? ADMIN_EMAIL || "teacher@example.com" : "선생님") : h(state.loginName || "")}" />
            </div>
            <div class="field">
              <label for="loginPassword">비밀번호</label>
              <input id="loginPassword" type="password" autocomplete="current-password" placeholder="비밀번호를 입력하세요" />
            </div>
            ${!adminMode && (state.loginSchools || []).length ? `
              <div class="field">
                <label for="loginSchool">학교</label>
                <select id="loginSchool">
                  <option value="">학교를 선택하세요</option>
                  ${state.loginSchools.map((item) => `<option value="${h(item)}">${h(item)}</option>`).join("")}
                </select>
              </div>` : ""}
            ${!adminMode ? `
              <label class="remember-login">
                <input id="rememberStudentLogin" type="checkbox" />
                <span>
                  <strong>로그인 유지</strong>
                  <small>이 기기에서 30일 동안 자동으로 로그인합니다.</small>
                </span>
              </label>
            ` : ""}
            <button class="primary-btn" type="submit">로그인</button>
          </form>
          ${!adminMode ? installActionMarkup() : ""}
          <div class="hint">
            학생은 같은 학년의 숙제와 영상을 볼 수 있습니다.<br />
            관리자 화면에서는 반, 영상, 숙제, 학생 계정을 직접 관리합니다.
          </div>
        </div>
      </section>
    </main>
  `);
}

function installActionMarkup() {
  if (IS_STANDALONE) return "";
  return `
    <button class="pwa-install-btn" type="button" onclick="installPwa()">앱 설치</button>
    <p class="ios-install-guide" id="installGuide" hidden>${installGuideText()}</p>
  `;
}

function installGuideText() {
  if (IS_IOS_DEVICE) {
    return `Safari 공유 버튼을 누른 뒤 <strong>홈 화면에 추가</strong>를 선택하세요.`;
  }
  return `브라우저 메뉴에서 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택하세요. 이미 설치된 경우 버튼이 동작하지 않을 수 있습니다.`;
}

async function installPwa() {
  if (!deferredInstallPrompt) {
    toggleInstallGuide();
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  render();
}

function toggleInstallGuide() {
  const guide = document.querySelector("#installGuide");
  if (guide) guide.hidden = !guide.hidden;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (!state.user && !state.loading) renderLogin();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (!state.user && !state.loading) renderLogin();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.warn("Service Worker 등록 실패:", error);
    });
  });
}

function setRole(role) {
  state.role = role;
  state.message = "";
  state.loginSchools = [];
  state.loginName = "";
  renderLogin();
}

async function login(event) {
  event.preventDefault();
  const name = document.querySelector("#loginName").value.trim();
  const password = document.querySelector("#loginPassword").value;
  // 학교 칸은 동명이인일 때만 나타나고, 그 이름에만 유효합니다.
  // 공용 기기에서 다음 학생이 로그인할 때 남의 학교 목록이 남아 있으면
  // required에 걸려 아예 진행이 안 되므로 이름이 바뀌면 지웁니다.
  if (state.loginName && name !== state.loginName) {
    state.loginSchools = [];
    state.loginName = "";
  }
  const school = (state.loginSchools || []).length ? (document.querySelector("#loginSchool")?.value || "") : "";
  const rememberStudent = state.role === "student" && Boolean(document.querySelector("#rememberStudentLogin")?.checked);
  state.message = "";

  try {
    if (state.role === "admin") {
      if (supabaseClient) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email: name, password });
        if (error) throw error;
        if (!isAdminEmail(data.user?.email)) {
          await supabaseClient.auth.signOut();
          throw new Error("관리자 권한이 없는 계정입니다.");
        }
        state.user = { name: data.user.email, role: "admin" };
      } else {
        if (name !== "선생님" || password !== "admin123") throw new Error("관리자 계정 정보를 확인해주세요.");
        state.user = { name, role: "admin" };
      }
      state.view = "admin-dashboard";
      await refreshData();
      render();
      return;
    }

    let student;
    if (supabaseClient) {
      try {
        const session = await photoApi("student-login", { name, password, school, remember: rememberStudent }, "");
        savePhotoStudentSession(session.token, rememberStudent);
        state.photoSessionError = "";
        state.loginSchools = [];
        state.loginName = "";
        student = session.student ? normalizeStudent(session.student) : null;
      } catch (sessionError) {
        // 동명이인이라 학교를 더 받아야 하는 경우입니다.
        // 비밀번호는 이미 맞았고 어느 계정인지만 못 고른 상태이므로,
        // 학교 선택 칸을 띄우고 다시 시도하게 합니다.
        if (sessionError.data?.needSchool) {
          state.loginSchools = sessionError.data.schools || [];
          // 다시 그리면 입력칸이 비므로 이름은 남겨둡니다.
          // 비밀번호는 상태에 담지 않고 다시 받습니다.
          state.loginName = name;
          clearPhotoStudentSession();
          throw sessionError;
        }
        // 예전에는 여기서 login_student RPC를 브라우저에서 직접 호출했습니다.
        // 그 경로 때문에 RPC를 anon에 열어둬야 했고, 공개된 anon key로
        // 레이트 리밋 없이 비밀번호를 대입할 수 있었습니다.
        // 로그인은 이제 서버(Netlify Function)를 통해서만 처리합니다.
        clearPhotoStudentSession();
        state.photoSessionError = sessionError.message;
        throw sessionError;
      }
    } else {
      student = activeStudents().find((item) => item.name === name && item.password === password);
    }
    if (!student) throw new Error("학생 이름과 비밀번호를 확인해주세요.");
    state.user = { ...student, role: "student" };
    state.view = "calendar";
    await refreshData();
    render();
  } catch (error) {
    state.message = error.message;
    renderLogin();
  }
}

async function logout() {
  if (state.lessonJournal?.dirty && !confirmDiscardLessonJournalDraft()) return;

  // 상태 밖의 뒷정리입니다. 이건 초기화만으로 되지 않습니다.
  cancelAllSearchDebounces();
  (state.photoUpload?.files || []).forEach((file) => { if (file.preview) URL.revokeObjectURL(file.preview); });
  clearPhotoStudentSession();
  if (supabaseClient && state.user?.role === "admin") await supabaseClient.auth.signOut();
  videoViewSearchSelection = { start: 0, end: 0 };

  // 나머지는 상태를 통째로 새로 만듭니다. 예전에는 여기서 필드를 스무 줄
  // 넘게 나열했는데, 그 목록에서 빠진 값들이 로그아웃 뒤에도 남아 있었습니다.
  state = initialState(state);
  render();
}

function adminGroupForView(view) {
  return ADMIN_NAV_GROUPS.find((group) => group.items.some(([id]) => id === view)) || null;
}

function adminNavButtonMarkup([view, label], className) {
  const active = state.view === view;
  return `<button type="button" class="${className}${active ? " active" : ""}" ${active ? `aria-current="page"` : ""} onclick="go('${view}')"><span class="nav-dot"></span><span>${label}</span></button>`;
}

function adminDesktopNavMarkup() {
  return `
    <nav class="nav admin-nav" aria-label="관리자 메뉴">
      ${adminNavButtonMarkup(ADMIN_DASHBOARD_NAV, "admin-nav-direct")}
      ${ADMIN_NAV_GROUPS.map((group) => {
        const expanded = state.adminMenu.openGroup === group.id;
        const submenuId = `admin-nav-submenu-${group.id}`;
        return `
          <section class="admin-nav-group">
            <button id="admin-nav-toggle-${group.id}" class="admin-nav-group-toggle" type="button" aria-expanded="${expanded}" aria-controls="${submenuId}" onclick="toggleAdminMenuGroup('${group.id}')"><span>${group.label}</span></button>
            <div id="${submenuId}" class="admin-nav-submenu" ${expanded ? "" : "hidden"}>
              ${group.items.map((item) => adminNavButtonMarkup(item, "admin-nav-item")).join("")}
            </div>
          </section>
        `;
      }).join("")}
    </nav>
  `;
}

function adminMobileNavMarkup(currentLabel) {
  const expanded = state.adminMenu.mobileOpen;
  return `
    <div class="admin-mobile-menu">
      <button class="admin-mobile-menu-toggle" type="button" aria-expanded="${expanded}" aria-controls="admin-mobile-menu-panel" onclick="toggleAdminMobileMenu()"><span>메뉴</span><strong>${h(currentLabel)}</strong></button>
      <div id="admin-mobile-menu-panel" class="admin-mobile-menu-panel" ${expanded ? "" : "hidden"}>
        <nav class="admin-mobile-menu-list" aria-label="모바일 관리자 메뉴">
          <section class="admin-mobile-group">
            <span class="admin-mobile-group-title">대시보드</span>
            ${adminNavButtonMarkup(ADMIN_DASHBOARD_NAV, "admin-mobile-item")}
          </section>
          ${ADMIN_NAV_GROUPS.map((group) => `
            <section class="admin-mobile-group">
              <span class="admin-mobile-group-title">${group.label}</span>
              ${group.items.map((item) => adminNavButtonMarkup(item, "admin-mobile-item")).join("")}
            </section>
          `).join("")}
        </nav>
        <button class="admin-mobile-logout" type="button" onclick="logout()">로그아웃</button>
      </div>
    </div>
  `;
}

function syncAdminMenuDom() {
  ADMIN_NAV_GROUPS.forEach((group) => {
    const expanded = state.adminMenu.openGroup === group.id;
    const toggle = document.querySelector(`#admin-nav-toggle-${group.id}`);
    const submenu = document.querySelector(`#admin-nav-submenu-${group.id}`);
    toggle?.setAttribute("aria-expanded", String(expanded));
    if (submenu) submenu.hidden = !expanded;
  });
  const mobileToggle = document.querySelector(".admin-mobile-menu-toggle");
  const mobilePanel = document.querySelector("#admin-mobile-menu-panel");
  mobileToggle?.setAttribute("aria-expanded", String(state.adminMenu.mobileOpen));
  if (mobilePanel) mobilePanel.hidden = !state.adminMenu.mobileOpen;
}

function toggleAdminMenuGroup(groupId) {
  if (state.user?.role !== "admin" || !ADMIN_NAV_GROUPS.some((group) => group.id === groupId)) return;
  state.adminMenu.openGroup = state.adminMenu.openGroup === groupId ? "" : groupId;
  syncAdminMenuDom();
}

function toggleAdminMobileMenu() {
  if (state.user?.role !== "admin") return;
  state.adminMenu.mobileOpen = !state.adminMenu.mobileOpen;
  syncAdminMenuDom();
}

function renderShell() {
  const isAdmin = state.user.role === "admin";
  const nav = isAdmin
    ? ADMIN_NAV_ITEMS
    : [
        ["calendar", "숙제 캘린더"],
        ["photo-homework-student", "사진 숙제"],
        ["classes-student", "수업 영상"],
      ];
  const currentLabel = nav.find(([id]) => id === state.view)?.[1] || (isAdmin ? "관리자 대시보드" : "학습 공간");

  app(`
    <div class="app-shell ${isAdmin ? "admin-shell" : "student-shell"}">
      <aside class="sidebar ${isAdmin ? "admin-sidebar" : "student-sidebar"}">
        <div class="sidebar-brand">
          <img src="assets/logo-horizontal.png" alt="강성인수학" />
          <span>${isAdmin ? "STUDENT MANAGER" : "LEARNING SPACE"}</span>
        </div>
        <div class="sidebar-section-label">${isAdmin ? "관리 메뉴" : "학습 메뉴"}</div>
        ${isAdmin ? `${adminDesktopNavMarkup()}${adminMobileNavMarkup(currentLabel)}` : `
          <label class="mobile-nav-wrap">
            <span>메뉴 선택</span>
            <select class="mobile-nav" onchange="go(this.value)">
              ${nav.map(([id, label]) => `<option value="${id}" ${state.view === id ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
          <nav class="nav">
            ${nav.map(([id, label]) => `<button class="${state.view === id ? "active" : ""}" onclick="go('${id}')"><span class="nav-dot"></span>${label}</button>`).join("")}
          </nav>
        `}
        <div class="sidebar-account">
          <div class="account-avatar">${h(String(state.user.name || "U").slice(0, 1).toUpperCase())}</div>
          <div class="account-copy">
            <strong>${isAdmin ? "관리자" : h(state.user.name)}</strong>
            <span>${isAdmin ? h(state.user.name) : h(className(state.user.classId))}</span>
          </div>
          <button class="sidebar-logout" onclick="logout()" aria-label="로그아웃">나가기</button>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div class="topbar-title"><span>${isAdmin ? "강성인수학 운영 관리" : "나의 학습 공간"}</span><strong>${h(currentLabel)}</strong></div>
          <div class="topbar-actions">
            <div class="user-chip"><span>${h(state.user.name)}${isAdmin ? "" : ` · ${h(className(state.user.classId))}`}</span></div>
            <button class="topbar-logout" type="button" onclick="logout()">로그아웃</button>
          </div>
        </header>
        <main class="content">${state.message ? `<div class="notice error">${h(state.message)}</div>` : ""}${renderView()}</main>
      </div>
    </div>
  `);
}

async function go(view) {
  if (["lesson-journal", "weekly-report"].includes(view) && state.user?.role !== "admin") return;
  const previousView = state.view;
  if (previousView === "lesson-journal" && view !== "lesson-journal" && state.lessonJournal.dirty) {
    if (!confirmDiscardLessonJournalDraft()) return;
    state.lessonJournal.dirty = false;
    state.lessonJournal.draft = null;
  }
  const isAdminNavigation = state.user?.role === "admin";
  let navigationId = 0;
  if (isAdminNavigation) {
    const group = adminGroupForView(view);
    if (group) state.adminMenu.openGroup = group.id;
    state.adminMenu.mobileOpen = false;
    syncAdminMenuDom();
    if (previousView === view) return;
    state.adminMenu.navigationId += 1;
    navigationId = state.adminMenu.navigationId;
  }
  if (previousView === "video-views" && view !== "video-views") {
    cancelSearchDebounce("videoView");
    state.videoView.loading = false;
    state.videoView.requestId += 1;
  }
  if (previousView === "photo-homework-student" && view !== "photo-homework-student") {
    state.studentPhoto.requestId += 1;
    state.studentPhoto.loading = false;
    Object.keys(state.studentPhoto.detailRequestIds).forEach((assignmentId) => {
      state.studentPhoto.detailRequestIds[assignmentId] += 1;
    });
    Object.keys(state.studentPhoto.summaryRequestIds).forEach((assignmentId) => {
      state.studentPhoto.summaryRequestIds[assignmentId] += 1;
    });
    Object.values(state.studentPhoto.details).forEach((detail) => {
      detail.loading = false;
      detail.loadingUrls = false;
    });
  }
  state.view = view;
  state.selectedClassId = null;
  state.edit = null;
  state.message = "";
  if (previousView === "homework-admin" && view !== "homework-admin") state.homeworkDraftDate = "";
  if (previousView === "photo-homework-admin" && view !== "photo-homework-admin") {
    state.photoAdminRequestId += 1;
    state.photoAdminLoading = false;
    cancelSearchDebounce("photoStudent");
    cancelSearchDebounce("photoStats");
    clearPhotoReviewDetailCache();
  }
  if (previousView === "weekly-report" && view !== "weekly-report") {
    state.weeklyReport.requestId += 1;
    state.weeklyReport.loading = false;
  }
  if (view === "photo-homework-student") {
    if (previousView === view && state.studentPhoto.loading) return;
    const requestId = ++state.studentPhoto.requestId;
    state.studentPhoto.loading = true;
    render();
    await loadStudentPhotoHomework(requestId);
    if (requestId !== state.studentPhoto.requestId || state.view !== view) return;
    render();
    return;
  }
  if (view === "photo-homework-admin") {
    const requestId = ++state.photoAdminRequestId;
    state.photoAdminLoading = true;
    if (state.photoHomeworkView === "reviews") state.photoReview.loading = true;
    render();
    await loadAdminPhotoHomework(requestId, state.photoHomeworkView);
    if (requestId !== state.photoAdminRequestId || state.view !== view) return;
    if (isAdminNavigation && navigationId !== state.adminMenu.navigationId) return;
    state.photoAdminLoading = false;
    render();
    return;
  }
  if (view === "lesson-journal") {
    // 회차 목록만 새로 받습니다. 작은 테이블이라 매번 받아도 부담이 없고,
    // 그 사이 저장된 일지가 목록에 바로 보입니다.
    const loaded = await loadLessonJournalSessions(true);
    if (loaded && state.lessonJournal.view !== "write") await loadLessonJournalRecords();
    if (loaded && state.lessonJournal.draft?.sessionId && !state.lessonJournal.dirty) {
      await loadLessonJournalSessionRecords(state.lessonJournal.draft.sessionId);
      setLessonJournalDraftFromSession(state.lessonJournal.draft.sessionId, true);
    }
  }
  if (view === "weekly-report" && !state.weeklyReport.loaded) {
    await generateWeeklyReport();
    return;
  }
  if (isAdminNavigation && navigationId !== state.adminMenu.navigationId) return;
  if (view === "video-views") {
    await loadVideoViewPage(state.videoView.page);
    return;
  }
  render();
}

function renderView() {
  if (state.view === "calendar") return studentCalendar();
  if (state.view === "classes-student") return studentClasses();
  if (state.view === "photo-homework-student") return studentPhotoHomework();
  if (state.view === "class-videos") return studentVideos();
  if (state.view === "admin-dashboard") return adminDashboard();
  if (state.view === "classes") return manageClasses();
  if (state.view === "videos-admin") return manageVideos();
  if (state.view === "homework-admin") return manageHomeworks();
  if (state.view === "photo-homework-admin") return managePhotoHomework();
  if (state.view === "students-admin") return manageStudents();
  if (state.view === "school-scores") return manageSchoolScores();
  if (state.view === "student-records") return manageStudentRecords();
  if (state.view === "lesson-journal") return state.user?.role === "admin" ? manageLessonJournal() : studentCalendar();
  if (state.view === "weekly-report") return state.user?.role === "admin" ? manageWeeklyReport() : studentCalendar();
  if (state.view === "video-views") return manageVideoViews();
  return studentCalendar();
}

const PHOTO_API_URL = "/.netlify/functions/photo-homework";
// 날짜별 조회에서 한 쪽에 보여줄 수업 회차 수.
// 회차마다 학생 표가 통째로 붙으므로 15명 반이면 한 쪽에 150행쯤 됩니다.
const LESSON_JOURNAL_DATE_PAGE_SIZE = 10;

// 사진을 몇 장씩 동시에 올릴지. 학생들이 주로 폰에서 쓰므로 크게 잡지
// 않습니다. 서버는 한 번에 10장까지 받습니다.
const PHOTO_UPLOAD_CONCURRENCY = 3;

const PHOTO_STATUS = {
  not_submitted: ["미제출", "status-not-submitted"],
  pending: ["확인 대기", "status-pending"],
  completed: ["완료", "status-completed"],
  redo: ["다시 풀기", "status-redo"],
};

async function photoApi(action, payload = {}, explicitToken) {
  let token = explicitToken;
  if (token === undefined) {
    if (state.user?.role === "admin" && supabaseClient) token = (await supabaseClient.auth.getSession()).data.session?.access_token || "";
    else token = getPhotoStudentSession();
  }
  const response = await fetch(PHOTO_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    // 응답 본문을 오류에 실어 보냅니다. 동명이인 로그인처럼 호출한 쪽이
    // 메시지 말고 다른 값(학교 목록 등)까지 봐야 하는 경우가 있습니다.
    const error = new Error(result.error || "사진 숙제 서버 요청에 실패했습니다.");
    error.status = response.status;
    error.data = result;
    throw error;
  }
  return result;
}

async function signedPhotoUrlResults(photoIds, admin = false) {
  const urls = {};
  const failedPhotoIds = [];
  let signedUrlExpiresAt = "";
  for (let i = 0; i < photoIds.length; i += admin ? 100 : 50) {
    const batch = photoIds.slice(i, i + (admin ? 100 : 50));
    const result = await photoApi(admin ? "admin-photo-urls" : "student-photo-urls", { photoIds: batch });
    Object.assign(urls, result.urls || {});
    failedPhotoIds.push(...(result.failedPhotoIds || []));
    if (result.signedUrlExpiresAt) signedUrlExpiresAt = result.signedUrlExpiresAt;
  }
  return { urls, failedPhotoIds: [...new Set(failedPhotoIds)], signedUrlExpiresAt };
}

async function loadStudentPhotoHomework(requestId = ++state.studentPhoto.requestId) {
  const token = getPhotoStudentSession();
  const studentId = state.user?.id;
  if (!token) {
    if (requestId !== state.studentPhoto.requestId) return false;
    state.studentPhoto.loading = false;
    state.studentPhoto.loaded = false;
    state.message = state.photoSessionError
      ? `사진 숙제 서버 연결이 아직 완료되지 않았습니다. Netlify 환경변수와 Function 배포를 확인해주세요. (${state.photoSessionError})`
      : "사진 숙제 접속 정보가 없습니다. 방금 로그인했는데도 이 문구가 계속 보이면 Netlify에 최신 파일이 배포되지 않았거나, 브라우저/PWA가 예전 파일을 캐시하고 있는 상태입니다.";
    return false;
  }
  try {
    const dashboard = await photoApi("student-dashboard");
    if (requestId !== state.studentPhoto.requestId || state.user?.id !== studentId || state.view !== "photo-homework-student") return false;
    state.photoData = {
      periods: dashboard.periods || [],
      homeworks: dashboard.homeworks || [],
      targets: [],
      assignments: dashboard.assignments || [],
      rounds: [],
      photos: [],
      deletions: [],
    };
    const validAssignmentIds = new Set(state.photoData.assignments.map((assignment) => assignment.id));
    Object.keys(state.studentPhoto.details).forEach((assignmentId) => {
      if (!validAssignmentIds.has(assignmentId)) clearStudentPhotoDetail(assignmentId);
    });
    state.studentPhoto.openAssignmentIds = state.studentPhoto.openAssignmentIds.filter((assignmentId) => validAssignmentIds.has(assignmentId));
    state.studentPhoto.loading = false;
    state.studentPhoto.loaded = true;
    state.message = "";
    return true;
  } catch (error) {
    if (requestId !== state.studentPhoto.requestId || state.user?.id !== studentId) return false;
    state.studentPhoto.loading = false;
    state.studentPhoto.loaded = false;
    state.message = error.message;
    return false;
  }
}

// Supabase는 한 번에 최대 1000행만 돌려주므로 끝까지 나눠 받습니다.
//
// 예전에는 이 반복문이 세 벌 있었습니다.
//   fetchAllSupabaseRows        테이블 하나를 통째로
//   loadAllLessonJournalRows    위와 완전히 동일 (select가 "*" 고정인 것만 다름)
//   loadWeeklyReportPagedRows   쿼리를 직접 만들어 넘기는 형태
// 셋 다 같은 일을 하는데 끝 조건 표현만 조금씩 달랐습니다. 쪽 크기를 바꾸거나
// 오류 처리를 고칠 때 세 곳을 맞춰야 했습니다.
//
// 서버(netlify/functions)의 requestAll은 supabase-js 없이 raw fetch로 도는
// 다른 런타임이라 여기서 같이 쓸 수 없습니다.
async function fetchAllRows(buildQuery) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < pageSize) break;
  }
  return rows;
}

// 테이블 하나를 통째로 받는 흔한 경우를 위한 얇은 감싸개입니다.
function fetchAllSupabaseRows(table, order, ascending = true, select = "*") {
  return fetchAllRows(() => supabaseClient.from(table).select(select).order(order, { ascending }));
}

async function loadPhotoReviewPage(page = state.photoReview.page) {
  if (!supabaseClient || state.user?.role !== "admin") return;
  const requestId = ++state.photoReviewRequestId;
  state.photoReview.loading = true;
  try {
    const result = await photoApi("admin-review-list", {
      page,
      pageSize: state.photoReview.pageSize,
      filters: { ...state.photoFilters },
    });
    if (requestId !== state.photoReviewRequestId) return;
    const total = Number(result.total || 0);
    const pageCount = Math.max(1, Math.ceil(total / state.photoReview.pageSize));
    if (page > pageCount) return loadPhotoReviewPage(pageCount);
    state.photoReview = {
      items: result.items || [],
      page: Number(result.page || page),
      pageSize: Number(result.pageSize || state.photoReview.pageSize),
      total,
      pendingCount: Number(result.pendingCount || 0),
      loading: false,
    };
    state.message = "";
  } catch (error) {
    if (requestId !== state.photoReviewRequestId) return;
    state.photoReview.loading = false;
    state.message = error.message;
  }
}

async function loadAdminPhotoHomework(requestId = ++state.photoAdminRequestId, requestedTab = state.photoHomeworkView) {
  if (!supabaseClient || state.user?.role !== "admin" || state.view !== "photo-homework-admin") {
    if (requestId === state.photoAdminRequestId) state.photoAdminLoading = false;
    return;
  }
  state.photoAdminLoading = true;
  state.photoStatsLoaded = false;
  state.photoData.assignments = [];
  try {
    state.message = "";
    const [periods, homeworks, targets] = await Promise.all([
      fetchAllSupabaseRows("learning_periods", "start_date", true),
      fetchAllSupabaseRows("photo_homeworks", "lesson_date", false),
      fetchAllSupabaseRows("photo_homework_target_classes", "homework_id", true),
    ]);
    if (requestId !== state.photoAdminRequestId || state.view !== "photo-homework-admin") return;
    state.photoData.periods = periods;
    state.photoData.homeworks = homeworks;
    state.photoData.targets = targets;
    state.photoData.rounds = [];
    state.photoData.photos = [];
    state.photoData.deletions = [];
    state.photoPreview = {};
    state.photoReviewDetails = {};

    if (requestedTab === "stats" && state.photoHomeworkView === "stats") {
      const assignments = await fetchAllSupabaseRows("photo_homework_assignments", "created_at", false);
      if (requestId !== state.photoAdminRequestId || state.view !== "photo-homework-admin") return;
      state.photoData.assignments = assignments;
      state.photoStatsLoaded = true;
    } else {
      state.photoData.assignments = [];
      state.photoStatsLoaded = false;
    }
    if (requestedTab === "reviews" && state.photoHomeworkView === "reviews") await loadPhotoReviewPage(1);
  } catch (error) {
    if (requestId !== state.photoAdminRequestId || state.view !== "photo-homework-admin") return;
    if (requestedTab === "reviews") state.photoReview.loading = false;
    state.message = error.message.includes("does not exist") ? "사진 숙제 SQL을 먼저 Supabase에 적용해주세요." : error.message;
  } finally {
    if (requestId === state.photoAdminRequestId && state.view === "photo-homework-admin") state.photoAdminLoading = false;
  }
}

function photoStatusBadge(status) {
  const [label, className] = PHOTO_STATUS[status] || PHOTO_STATUS.not_submitted;
  return `<span class="photo-status ${className}">${label}</span>`;
}

// 예전에는 호출마다 숙제 배열을 선형 탐색했습니다. 사진 통계는 배정 한 건마다
// 이걸 부르므로 O(배정 × 숙제)가 됐고, 학생 이름을 한 글자 칠 때마다 전체
// 재렌더로 다시 돌았습니다.
//
// state.photoData.homeworks는 통째로 교체되기만 하고 제자리로 바뀌지 않으므로
// (loadPhotoAdminData) 배열 자체를 키로 캐시합니다. 새 배열이 들어오면 다시 만듭니다.
let photoHomeworkIndexSource = null;
let photoHomeworkIndex = new Map();
function photoHomeworkById(id) {
  const list = state.photoData.homeworks || [];
  if (photoHomeworkIndexSource !== list) {
    photoHomeworkIndex = new Map(list.map((homework) => [homework.id, homework]));
    photoHomeworkIndexSource = list;
  }
  return photoHomeworkIndex.get(id);
}
function photoPeriodById(id) { return state.photoData.periods.find((x) => x.id === id); }
function photoPeriodAcceptsSubmissions(period = {}) {
  const today = isoDate(new Date());
  return Boolean(period.id && period.is_active === true && (!period.end_date || period.end_date >= today));
}
function photoClassDates(homework = {}) {
  return [homework.lesson_date, homework.lesson_date_2, homework.lesson_date_3].filter(Boolean);
}
function photoClassDatesText(homework = {}) {
  const dates = photoClassDates(homework).map(formatMonthDay).filter(Boolean);
  return dates.length ? dates.join(", ") : "-";
}

function photoPeriodProgress(periodId) {
  const today = isoDate(new Date());
  const dueAssignments = (state.photoData.assignments || []).filter((assignment) => {
    const homework = photoHomeworkById(assignment.homework_id);
    return homework?.period_id === periodId && (homework?.lesson_date || "9999") <= today;
  });
  const completed = dueAssignments.filter((assignment) => assignment.status === "completed").length;
  const total = dueAssignments.length;
  return {
    total,
    completed,
    rate: total ? Math.round((completed / total) * 100) : 0,
    achieved: total > 0 && completed === total,
  };
}

function studentPhotoRewardMarkup() {
  const periods = (state.photoData.periods || []).filter((period) => {
    if (!String(period.reward_title || "").trim()) return false;
    return state.photoData.homeworks.some((homework) => homework.period_id === period.id);
  });
  if (!periods.length) return "";
  return `<div class="photo-reward-list">${periods.map((period) => {
    const progress = photoPeriodProgress(period.id);
    const message = progress.achieved
      ? period.reward_achieved_message
      : period.reward_before_message;
    return `<section class="photo-reward-card ${progress.achieved ? "achieved" : ""}">
      <div>
        <span>완주 보상</span>
        <strong>${h(period.reward_title)}</strong>
      </div>
      <p>${h(message || (progress.achieved ? "100% 달성을 축하합니다." : "이 기간을 100% 완료하면 보상을 받을 수 있어요."))}</p>
      <small>${h(period.name)} · ${progress.completed}/${progress.total} 완료</small>
    </section>`;
  }).join("")}</div>`;
}

function ensureStudentPhotoDetail(assignmentId) {
  if (!state.studentPhoto.details[assignmentId]) {
    state.studentPhoto.details[assignmentId] = {
      loaded: false,
      loading: false,
      loadingUrls: false,
      error: "",
      urlError: "",
      rounds: [],
      photos: [],
      deletions: [],
      failedPhotoIds: [],
      urlExpiresAtById: {},
      page: { page: 0, pageSize: 20, total: 0, loaded: 0, hasMore: false },
      urlRequestId: 0,
    };
  }
  return state.studentPhoto.details[assignmentId];
}

function replaceStudentPhotoAssignment(nextAssignment) {
  if (!nextAssignment?.id) return;
  const index = state.photoData.assignments.findIndex((assignment) => assignment.id === nextAssignment.id);
  if (index >= 0) state.photoData.assignments[index] = { ...state.photoData.assignments[index], ...nextAssignment };
}

function clearStudentPhotoDetail(assignmentId) {
  const detail = state.studentPhoto.details[assignmentId];
  (detail?.photos || []).forEach((photo) => { delete state.photoPreview[photo.id]; });
  state.studentPhoto.detailRequestIds[assignmentId] = (state.studentPhoto.detailRequestIds[assignmentId] || 0) + 1;
  delete state.studentPhoto.details[assignmentId];
}

async function refreshStudentPhotoAssignmentSummary(assignmentId) {
  const requestId = (state.studentPhoto.summaryRequestIds[assignmentId] || 0) + 1;
  const studentId = state.user?.id;
  state.studentPhoto.summaryRequestIds[assignmentId] = requestId;
  const result = await photoApi("student-assignment-summary", { assignmentId });
  if (
    state.studentPhoto.summaryRequestIds[assignmentId] !== requestId
    || state.user?.id !== studentId
    || state.view !== "photo-homework-student"
  ) return false;
  replaceStudentPhotoAssignment(result.assignment);
  return true;
}

async function loadStudentAssignmentDetail(assignmentId, page = 1, append = false) {
  const detail = ensureStudentPhotoDetail(assignmentId);
  if (detail.loading) return false;
  const requestId = (state.studentPhoto.detailRequestIds[assignmentId] || 0) + 1;
  const studentId = state.user?.id;
  state.studentPhoto.detailRequestIds[assignmentId] = requestId;
  detail.loading = true;
  detail.error = "";
  render();
  try {
    const result = await photoApi("student-assignment-detail", { assignmentId, page });
    if (
      state.studentPhoto.detailRequestIds[assignmentId] !== requestId
      || state.user?.id !== studentId
      || state.view !== "photo-homework-student"
    ) return false;
    const previous = ensureStudentPhotoDetail(assignmentId);
    if (!append) {
      previous.photos.forEach((photo) => { delete state.photoPreview[photo.id]; });
    }
    const mergedPhotos = append
      ? [...new Map([...previous.photos, ...(result.photos || [])].map((photo) => [photo.id, photo])).values()]
      : (result.photos || []);
    const expiry = Date.parse(result.signedUrlExpiresAt || "");
    const urlExpiresAtById = append ? { ...previous.urlExpiresAtById } : {};
    const failed = append ? new Set(previous.failedPhotoIds) : new Set();
    for (const photo of result.photos || []) {
      if (result.urls?.[photo.id]) {
        state.photoPreview[photo.id] = result.urls[photo.id];
        urlExpiresAtById[photo.id] = Number.isFinite(expiry) ? expiry : Date.now() + 240000;
        failed.delete(photo.id);
      } else {
        delete state.photoPreview[photo.id];
        failed.add(photo.id);
      }
    }
    for (const photoId of result.failedPhotoIds || []) failed.add(photoId);
    state.studentPhoto.details[assignmentId] = {
      ...previous,
      loaded: true,
      loading: false,
      error: "",
      urlError: "",
      rounds: result.rounds || [],
      photos: mergedPhotos,
      deletions: result.deletions || [],
      failedPhotoIds: [...failed],
      urlExpiresAtById,
      page: {
        ...(result.page || {}),
        loaded: mergedPhotos.length,
      },
    };
    if (Number(result.page?.page || page) === 1) replaceStudentPhotoAssignment(result.assignment);
    render();
    return true;
  } catch (error) {
    if (state.studentPhoto.detailRequestIds[assignmentId] !== requestId || state.user?.id !== studentId) return false;
    const current = ensureStudentPhotoDetail(assignmentId);
    current.loading = false;
    current.error = error.message;
    render();
    return false;
  }
}

function studentPhotoUrlsNeedRefresh(detail) {
  const threshold = Date.now() + 30000;
  return detail.photos.some((photo) =>
    !state.photoPreview[photo.id] || Number(detail.urlExpiresAtById[photo.id] || 0) <= threshold
  );
}

async function refreshStudentPhotoDetailUrls(assignmentId) {
  const detail = ensureStudentPhotoDetail(assignmentId);
  const threshold = Date.now() + 30000;
  const photoIds = detail.photos
    .filter((photo) => !state.photoPreview[photo.id] || Number(detail.urlExpiresAtById[photo.id] || 0) <= threshold)
    .map((photo) => photo.id);
  if (!photoIds.length || detail.loadingUrls) return;
  const requestId = detail.urlRequestId + 1;
  const studentId = state.user?.id;
  detail.urlRequestId = requestId;
  detail.loadingUrls = true;
  detail.urlError = "";
  render();
  try {
    const result = await signedPhotoUrlResults(photoIds);
    const current = state.studentPhoto.details[assignmentId];
    if (!current || current.urlRequestId !== requestId || state.user?.id !== studentId || state.view !== "photo-homework-student") return;
    const expiry = Date.parse(result.signedUrlExpiresAt || "");
    const failed = new Set(current.failedPhotoIds);
    photoIds.forEach((photoId) => {
      if (result.urls[photoId]) {
        state.photoPreview[photoId] = result.urls[photoId];
        current.urlExpiresAtById[photoId] = Number.isFinite(expiry) ? expiry : Date.now() + 240000;
        failed.delete(photoId);
      } else {
        delete state.photoPreview[photoId];
        failed.add(photoId);
      }
    });
    (result.failedPhotoIds || []).forEach((photoId) => failed.add(photoId));
    current.failedPhotoIds = [...failed];
    current.loadingUrls = false;
    render();
  } catch (error) {
    const current = state.studentPhoto.details[assignmentId];
    if (!current || current.urlRequestId !== requestId || state.user?.id !== studentId) return;
    current.loadingUrls = false;
    current.urlError = error.message;
    render();
  }
}

async function toggleStudentPhotoHistory(assignmentId) {
  const open = state.studentPhoto.openAssignmentIds.includes(assignmentId);
  if (open) {
    state.studentPhoto.openAssignmentIds = state.studentPhoto.openAssignmentIds.filter((id) => id !== assignmentId);
    render();
    return;
  }
  state.studentPhoto.openAssignmentIds.push(assignmentId);
  const detail = ensureStudentPhotoDetail(assignmentId);
  render();
  if (!detail.loaded) await loadStudentAssignmentDetail(assignmentId, 1, false);
  else if (studentPhotoUrlsNeedRefresh(detail)) await refreshStudentPhotoDetailUrls(assignmentId);
}

async function loadMoreStudentPhotoHistory(assignmentId) {
  const detail = ensureStudentPhotoDetail(assignmentId);
  if (detail.loading || !detail.page.hasMore) return;
  await loadStudentAssignmentDetail(assignmentId, Number(detail.page.page || 0) + 1, true);
}

function markStudentPhotoLoadError(assignmentId, photoId) {
  const detail = state.studentPhoto.details[assignmentId];
  if (!detail) return;
  delete state.photoPreview[photoId];
  if (!detail.failedPhotoIds.includes(photoId)) detail.failedPhotoIds.push(photoId);
  render();
}

function studentPhotoDetailMarkup(assignment, locked) {
  const detail = ensureStudentPhotoDetail(assignment.id);
  if (detail.loading && !detail.loaded) {
    return `<div class="student-photo-detail-state">제출 이력을 불러오는 중입니다.</div>`;
  }
  if (detail.error && !detail.loaded) {
    return `<div class="student-photo-detail-state student-photo-detail-error"><span>${h(detail.error)}</span><button type="button" class="small-btn" onclick="loadStudentAssignmentDetail(${js(assignment.id)}, 1, false)">다시 시도</button></div>`;
  }
  if (!detail.loaded) return "";
  const failedIds = new Set(detail.failedPhotoIds);
  const history = detail.rounds.map((round) => {
    const roundPhotos = detail.photos.filter((photo) => photo.round_id === round.id);
    const emptyText = detail.page.hasMore
      ? "이전 사진은 ‘더 보기’를 누르면 표시됩니다."
      : "남아 있는 사진이 없습니다.";
    const photos = roundPhotos.length
      ? `<div class="submitted-photo-grid">${roundPhotos.map((photo) => {
        const url = state.photoPreview[photo.id];
        const photoBody = url && !failedIds.has(photo.id)
          ? `<button class="student-photo-thumb" type="button" onclick="openPhotoLightbox(${js(photo.id)}, false)"><img src="${h(url)}" loading="lazy" decoding="async" onerror="markStudentPhotoLoadError(${js(assignment.id)}, ${js(photo.id)})" alt="제출 사진" /></button>`
          : `<div class="photo-thumb-placeholder"><span>사진을 불러오지 못했습니다.</span><button type="button" onclick="refreshStudentPhotoDetailUrls(${js(assignment.id)})">다시 시도</button></div>`;
        return `<figure>${photoBody}${!locked ? `<button class="photo-delete" onclick="deleteStudentPhoto(${js(photo.id)})">삭제</button>` : ""}</figure>`;
      }).join("")}</div>`
      : `<p class="subtle">${emptyText}</p>`;
    return `<div class="submission-round"><div><strong>${round.round_number}회차</strong><span>${formatDateTime(round.submitted_at)}</span></div>${photos}</div>`;
  }).join("");
  return `
    <section class="submission-history student-photo-detail">
      <div class="student-photo-detail-head">
        <h3>제출 이력</h3>
        <span>사진 ${detail.photos.length}/${detail.page.total}장 · 회차 ${detail.rounds.length}회</span>
      </div>
      ${detail.error ? `<div class="student-photo-detail-state student-photo-detail-error"><span>${h(detail.error)}</span><button type="button" class="small-btn" onclick="loadStudentAssignmentDetail(${js(assignment.id)}, ${Number(detail.page.page || 0) + 1}, true)">다시 시도</button></div>` : ""}
      ${detail.urlError ? `<div class="student-photo-detail-state student-photo-detail-error"><span>${h(detail.urlError)}</span><button type="button" class="small-btn" onclick="refreshStudentPhotoDetailUrls(${js(assignment.id)})">사진 다시 불러오기</button></div>` : ""}
      ${history || `<p class="subtle">아직 제출 이력이 없습니다.</p>`}
      ${detail.page.hasMore ? `<div class="student-photo-more"><button type="button" class="small-btn" ${detail.loading ? "disabled" : ""} onclick="loadMoreStudentPhotoHistory(${js(assignment.id)})">${detail.loading ? "불러오는 중" : "이전 사진 더 보기"}</button></div>` : ""}
      ${detail.deletions.length ? `<details class="deletion-history"><summary>사진 삭제 기록 ${detail.deletions.length}건</summary>${detail.deletions.map((item) => `<p>${item.round_number}회차 · ${h(item.original_file_name)} · ${formatDateTime(item.deleted_at)}</p>`).join("")}</details>` : ""}
    </section>`;
}

function studentPhotoHomework() {
  const assignments = state.photoData.assignments || [];
  if (state.studentPhoto.loading && !state.studentPhoto.loaded) {
    return `
      <section class="section-head"><div><h1>사진 숙제</h1><p>풀이 사진을 제출하고 선생님의 확인 결과를 확인하세요.</p></div></section>
      <div class="empty">사진 숙제를 불러오는 중입니다.</div>
    `;
  }
  const today = isoDate(new Date());
  const dueAssignments = assignments.filter((assignment) => {
    const homework = photoHomeworkById(assignment.homework_id);
    const period = photoPeriodById(homework?.period_id);
    return photoPeriodAcceptsSubmissions(period) && (homework?.lesson_date || "9999") <= today;
  });
  const completed = dueAssignments.filter((assignment) => assignment.status === "completed").length;
  const rate = dueAssignments.length ? Math.round((completed / dueAssignments.length) * 100) : 0;
  return `
    <section class="section-head"><div><h1>사진 숙제</h1><p>풀이 사진을 제출하고 선생님의 확인 결과를 확인하세요.</p></div></section>
    ${state.studentPhoto.loading ? `<div class="student-photo-refreshing">사진 숙제를 새로 확인하고 있습니다.</div>` : ""}
    <section class="photo-progress-summary">
      <div><strong>${rate}%</strong><span>현재 기간 완성률</span></div>
      <div class="photo-progress-track"><i style="width:${rate}%"></i></div>
      <small>${completed}개 완료 / 현재까지 ${dueAssignments.length}개</small>
    </section>
    ${studentPhotoRewardMarkup()}
    <div class="photo-homework-list">
      ${assignments.length ? assignments.map(studentPhotoHomeworkCard).join("") : `<div class="empty">배정된 사진 숙제가 없습니다.</div>`}
    </div>
    ${photoLightboxMarkup()}
  `;
}

function studentPhotoHomeworkCard(assignment) {
  const homework = photoHomeworkById(assignment.homework_id) || {};
  const period = photoPeriodById(homework.period_id) || {};
  const periodEnded = !photoPeriodAcceptsSubmissions(period);
  const locked = assignment.status === "completed" || periodEnded;
  const selected = state.photoUpload.assignmentId === assignment.id ? state.photoUpload.files : [];
  const detailOpen = state.studentPhoto.openAssignmentIds.includes(assignment.id);
  const photoCount = Number(assignment.photo_count || 0);
  const roundCount = Number(assignment.round_count || 0);
  const latestSubmittedAt = assignment.latest_submitted_at ? formatDateTime(assignment.latest_submitted_at) : "미제출";
  return `
    <article class="photo-homework-card">
      <header><div><span class="photo-period-name">${h(period.name || "학습 기간")}</span><h2>${h(homework.title || "사진 숙제")}</h2></div>${photoStatusBadge(assignment.status)}</header>
      <dl class="photo-homework-info">
        <div><dt>수업일</dt><dd>${h(photoClassDatesText(homework))}</dd></div>
        <div><dt>문항 범위</dt><dd>${h(homework.problem_range || "-")}</dd></div>
        ${homework.memo ? `<div><dt>안내</dt><dd>${h(homework.memo)}</dd></div>` : ""}
      </dl>
      ${assignment.admin_feedback ? `<div class="photo-feedback"><strong>선생님 피드백</strong><p>${h(assignment.admin_feedback)}</p></div>` : ""}
      <div class="student-photo-summary">
        <span>제출 사진 <strong>${photoCount}장</strong></span>
        <span>제출 회차 <strong>${roundCount}회</strong></span>
        <span>마지막 제출 <strong>${h(latestSubmittedAt)}</strong></span>
      </div>
      ${locked ? `<div class="photo-lock ${periodEnded ? "period-ended" : ""}">${periodEnded ? "종료된 학습기간입니다. 기존 제출 내용만 확인할 수 있습니다." : "확인 완료된 숙제입니다."}</div>` : `
        <label class="photo-picker">
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple onchange="selectPhotoHomeworkFiles(event, ${js(assignment.id)})" />
          <span>사진 선택 또는 촬영</span><small>최대 10장 · 장당 10MB</small>
        </label>
        ${selected.length ? `<div class="photo-selected-grid">${selected.map((file, index) => `<figure><img src="${file.preview}" alt="선택 사진 ${index + 1}" /><button onclick="removeSelectedPhoto(${index})" type="button">×</button></figure>`).join("")}</div><button class="primary-btn photo-submit-btn" ${state.photoUpload.busy ? "disabled" : ""} onclick="uploadPhotoHomework(${js(assignment.id)})">${state.photoUpload.busy ? "업로드 중" : "선택한 사진 제출"}</button>` : ""}
        ${state.photoUpload.assignmentId === assignment.id && state.photoUpload.progress ? `<p class="upload-progress">${h(state.photoUpload.progress)}</p>` : ""}
      `}
      <div class="student-photo-history-bar">
        <span>과거 제출 사진과 삭제 기록은 필요할 때만 불러옵니다.</span>
        <button type="button" class="small-btn" aria-expanded="${detailOpen}" onclick="toggleStudentPhotoHistory(${js(assignment.id)})">${detailOpen ? "제출 이력 접기" : "제출 이력 보기"}</button>
      </div>
      ${detailOpen ? studentPhotoDetailMarkup(assignment, locked) : ""}
    </article>`;
}

async function ensureHeicConverter() {
  if (window.heic2any) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
    script.onload = resolve; script.onerror = () => reject(new Error("HEIC 변환 도구를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

async function compressHomeworkImage(file) {
  if (file.size > 10485760) throw new Error(`${file.name}: 10MB를 초과했습니다.`);
  let source = file;
  if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    await ensureHeicConverter();
    const converted = await window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    source = Array.isArray(converted) ? converted[0] : converted;
  }
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error(`${file.name}: 사진 변환에 실패했습니다.`);
  return { blob, name: file.name, type: "image/webp", size: blob.size, preview: URL.createObjectURL(blob) };
}

async function selectPhotoHomeworkFiles(event, assignmentId) {
  const files = [...event.target.files];
  event.target.value = "";
  if (files.length > 10) { alert("사진은 한 번에 최대 10장까지 선택할 수 있습니다."); return; }
  state.photoUpload = { assignmentId, files: [], busy: true, progress: "사진을 준비하고 있습니다." }; render();
  try {
    const prepared = [];
    for (const file of files) prepared.push(await compressHomeworkImage(file));
    state.photoUpload = { assignmentId, files: prepared, busy: false, progress: "" };
  } catch (error) {
    state.photoUpload = { assignmentId, files: [], busy: false, progress: error.message };
  }
  render();
}

function removeSelectedPhoto(index) {
  const removed = state.photoUpload.files.splice(index, 1)[0];
  if (removed?.preview) URL.revokeObjectURL(removed.preview);
  render();
}

async function refreshStudentPhotoAssignmentAfterMutation(assignmentId) {
  const detailOpen = state.studentPhoto.openAssignmentIds.includes(assignmentId);
  clearStudentPhotoDetail(assignmentId);
  try {
    if (detailOpen) return await loadStudentAssignmentDetail(assignmentId, 1, false);
    const refreshed = await refreshStudentPhotoAssignmentSummary(assignmentId);
    if (refreshed) render();
    return refreshed;
  } catch (error) {
    state.message = error.message;
    render();
    return false;
  }
}

async function uploadPhotoHomework(assignmentId) {
  if (state.photoUpload.busy || !state.photoUpload.files.length) return;
  const assignment = state.photoData.assignments.find((item) => item.id === assignmentId);
  const homework = photoHomeworkById(assignment?.homework_id);
  if (!photoPeriodAcceptsSubmissions(photoPeriodById(homework?.period_id))) {
    alert("종료된 학습기간에는 사진을 제출할 수 없습니다.");
    return;
  }
  state.photoUpload.busy = true; state.photoUpload.progress = "업로드 준비 중"; render();
  try {
    const files = state.photoUpload.files;
    const signed = await photoApi("create-upload-urls", { assignmentId, files: files.map((f) => ({ type: f.type, size: f.size })) });
    // 사진마다 PUT과 finalize를 순차로 기다렸습니다. 10장이면 왕복 20회를
    // 하나씩 처리하는 셈이라 모바일 회선에서 대기가 그대로 쌓였습니다.
    // 몇 장씩 동시에 올립니다. 너무 많이 열면 회선이 좁은 환경에서
    // 오히려 느려지고 실패도 늘어 3으로 제한합니다.
    let uploadedCount = 0;
    for (let start = 0; start < files.length; start += PHOTO_UPLOAD_CONCURRENCY) {
      const batch = files.slice(start, start + PHOTO_UPLOAD_CONCURRENCY);
      // allSettled를 쓰는 이유: all은 첫 실패에서 바로 빠져나오는데 그때
      // 같은 묶음의 나머지가 아직 올라가는 중입니다. 그 상태로 catch가
      // 재시도 목록을 만들면, 실제로는 올라간 사진이 목록에 남아 두 번
      // 올라갑니다. 묶음이 다 끝난 뒤에 실패를 던집니다.
      const results = await Promise.allSettled(batch.map(async (file, offset) => {
        const index = start + offset;
        const upload = signed.uploads[index];
        const response = await fetch(upload.signedUrl, { method: "PUT", headers: { "Content-Type": file.type, ...(upload.token ? { "x-upsert": "false" } : {}) }, body: file.blob });
        if (!response.ok) throw new Error(`${index + 1}번째 사진 업로드에 실패했습니다.`);
        await photoApi("finalize-upload", { assignmentId, path: upload.path, originalName: file.name, type: file.type, size: file.size });
        file.uploaded = true;
        uploadedCount += 1;
        state.photoUpload.progress = `${uploadedCount}/${files.length}장 업로드 중`;
        render();
      }));
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
    }
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    state.photoUpload = { assignmentId: "", files: [], busy: false, progress: "" };
    await refreshStudentPhotoAssignmentAfterMutation(assignmentId);
  } catch (error) {
    const uploadedAny = state.photoUpload.files.some((file) => file.uploaded);
    state.photoUpload.files.filter((file) => file.uploaded).forEach((file) => URL.revokeObjectURL(file.preview));
    state.photoUpload.files = state.photoUpload.files.filter((file) => !file.uploaded);
    state.photoUpload.busy = false; state.photoUpload.progress = `실패: ${error.message} 남은 사진으로 다시 시도할 수 있습니다.`;
    if (uploadedAny) await refreshStudentPhotoAssignmentAfterMutation(assignmentId);
  }
  render();
}

async function deleteStudentPhoto(photoId) {
  const detailEntry = Object.entries(state.studentPhoto.details).find(([, detail]) =>
    detail.photos.some((item) => item.id === photoId)
  );
  const photo = detailEntry?.[1].photos.find((item) => item.id === photoId);
  const assignmentId = detailEntry?.[0] || photo?.assignment_id;
  const assignment = state.photoData.assignments.find((item) => item.id === assignmentId);
  if (!photo || !assignmentId || !assignment) {
    state.message = "삭제할 사진 정보를 찾을 수 없습니다. 제출 이력을 다시 열어주세요.";
    render();
    return;
  }
  const homework = photoHomeworkById(assignment?.homework_id);
  if (!photoPeriodAcceptsSubmissions(photoPeriodById(homework?.period_id))) {
    alert("종료된 학습기간에는 사진을 삭제할 수 없습니다.");
    return;
  }
  if (!confirm("이 사진을 삭제할까요? 삭제 기록은 선생님에게 표시됩니다.")) return;
  try {
    await photoApi("delete-photo", { photoId });
    await refreshStudentPhotoAssignmentAfterMutation(assignmentId);
  }
  catch (error) { state.message = error.message; }
  render();
}

function photoLightboxMarkup() {
  const ids = state.photoLightbox.ids || [];
  if (!ids.length) return "";
  const id = ids[state.photoLightbox.index];
  const url = state.photoPreview[id];
  return `<div class="photo-lightbox" role="dialog" aria-modal="true"><button class="lightbox-close" onclick="closePhotoLightbox()">닫기</button><button class="lightbox-prev" onclick="movePhotoLightbox(-1)" ${ids.length < 2 ? "disabled" : ""}>‹</button><img src="${h(url || "")}" alt="확대 사진" /><button class="lightbox-next" onclick="movePhotoLightbox(1)" ${ids.length < 2 ? "disabled" : ""}>›</button><span>${state.photoLightbox.index + 1} / ${ids.length}</span></div>`;
}

async function openPhotoLightbox(photoId, admin = false) {
  try {
    if (!admin) {
      const detailEntry = Object.entries(state.studentPhoto.details).find(([, detail]) =>
        detail.photos.some((photo) => photo.id === photoId)
      );
      if (!detailEntry) throw new Error("사진 상세 정보를 찾을 수 없습니다.");
      const [assignmentId, detail] = detailEntry;
      if (studentPhotoUrlsNeedRefresh(detail)) await refreshStudentPhotoDetailUrls(assignmentId);
      if (!state.photoPreview[photoId]) throw new Error("사진을 불러오지 못했습니다. 다시 시도해주세요.");
      const ids = detail.photos.filter((photo) => state.photoPreview[photo.id]).map((photo) => photo.id);
      state.photoLightbox = { ids, index: Math.max(0, ids.indexOf(photoId)) };
      render();
      return;
    }
    const assignmentId = state.photoData.photos.find((x) => x.id === photoId)?.assignment_id;
    const ids = state.photoData.photos.filter((x) => x.assignment_id === assignmentId && !x.deleted_at).map((x) => x.id);
    if (ids.length) Object.assign(state.photoPreview, (await signedPhotoUrlResults(ids, admin)).urls);
    state.photoLightbox = { ids, index: Math.max(0, ids.indexOf(photoId)) };
  } catch (error) { state.message = error.message; }
  render();
}
function closePhotoLightbox() { state.photoLightbox = { ids: [], index: 0 }; render(); }
function movePhotoLightbox(step) { const n = state.photoLightbox.ids.length; state.photoLightbox.index = (state.photoLightbox.index + step + n) % n; render(); }

async function setPhotoAdminView(view) {
  const requestId = ++state.photoAdminRequestId;
  state.photoHomeworkView = view;
  state.photoAdminLoading = false;
  state.edit = null;
  cancelSearchDebounce("photoStudent");
  cancelSearchDebounce("photoStats");
  clearPhotoReviewDetailCache();
  if (view !== "stats") {
    state.photoData.assignments = [];
    state.photoStatsLoaded = false;
  }
  if (view === "reviews") {
    state.photoReview.loading = true;
    render();
    await loadPhotoReviewPage(1);
    if (requestId !== state.photoAdminRequestId || state.photoHomeworkView !== view || state.view !== "photo-homework-admin") return;
    render();
    return;
  }
  if (view === "stats") {
    state.photoStatsLoaded = false;
    state.photoData.assignments = [];
    render();
    try {
      const assignments = await fetchAllSupabaseRows("photo_homework_assignments", "created_at", false);
      if (requestId !== state.photoAdminRequestId || state.photoHomeworkView !== view || state.view !== "photo-homework-admin") return;
      state.photoData.assignments = assignments;
      state.photoStatsLoaded = true;
      state.message = "";
    } catch (error) {
      if (requestId !== state.photoAdminRequestId || state.photoHomeworkView !== view || state.view !== "photo-homework-admin") return;
      state.photoStatsLoaded = true;
      state.message = error.message;
    }
  }
  if (requestId !== state.photoAdminRequestId || state.photoHomeworkView !== view || state.view !== "photo-homework-admin") return;
  render();
}

function managePhotoHomework() {
  const tabs = [["periods","학습 기간"],["homeworks","숙제 등록"],["reviews","제출 확인"],["stats","성취도 통계"]];
  const heading = `<section class="section-head"><div><h1>사진 숙제</h1><p>기간, 숙제, 제출 확인과 완성률을 관리합니다.</p></div></section>`;
  if (state.photoAdminLoading) {
    const message = state.photoHomeworkView === "reviews" ? "제출 목록을 불러오는 중입니다." : "사진 숙제 관리 데이터를 불러오는 중입니다.";
    return `${heading}<div class="empty photo-review-loading">${message}</div>`;
  }
  const content = state.photoHomeworkView === "stats" && !state.photoStatsLoaded
    ? `<div class="empty photo-review-loading">성취도 통계를 불러오는 중입니다.</div>`
    : state.photoHomeworkView === "periods" ? photoPeriodAdmin() : state.photoHomeworkView === "homeworks" ? photoHomeworkAdmin() : state.photoHomeworkView === "reviews" ? photoReviewAdmin() : photoStatsAdmin();
  return `${heading}<div class="sub-tabs">${tabs.map(([id,label]) => `<button class="${state.photoHomeworkView===id?"active":""}" onclick="setPhotoAdminView('${id}')">${label}</button>`).join("")}</div>${content}${photoLightboxMarkup()}`;
}

function photoPeriodAdmin() {
  const edit = state.edit?.type === "learning-period" ? state.photoData.periods.find((x) => x.id === state.edit.id) : null;
  return `<div class="admin-layout"><form class="form-panel" onsubmit="saveLearningPeriod(event)"><h2>${edit?"학습 기간 수정":"학습 기간 추가"}</h2><div class="field"><label>기간 이름</label><input id="periodName" required value="${h(edit?.name||"")}" /></div><div class="field"><label>대상 학년</label><select id="periodGrade">${["고1","고2","고3"].map(x=>`<option ${edit?.grade_level===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="field"><label>시작일</label><input id="periodStart" type="date" required value="${edit?.start_date||""}" /></div><div class="field"><label>종료일</label><input id="periodEnd" type="date" required value="${edit?.end_date||""}" /></div><div class="period-reward-fields"><h3>100% 달성 보상</h3><p>보상명이 비어 있으면 학생 화면에 표시하지 않습니다.</p><div class="field"><label>보상명</label><input id="periodRewardTitle" placeholder="예: 간식 쿠폰" value="${h(edit?.reward_title||"")}" /></div><div class="field"><label>100% 전 안내 문구</label><textarea id="periodRewardBefore" rows="2" placeholder="예: 이번 기간을 100% 완료하면 간식 쿠폰을 받을 수 있어요.">${h(edit?.reward_before_message||"")}</textarea></div><div class="field"><label>100% 달성 문구</label><textarea id="periodRewardAchieved" rows="2" placeholder="예: 축하합니다! 간식 쿠폰 지급 대상입니다.">${h(edit?.reward_achieved_message||"")}</textarea></div></div><label class="check-line"><input id="periodActive" type="checkbox" ${edit?.is_active!==false?"checked":""}/> 활성 기간</label><button class="primary-btn">저장</button>${edit?`<button type="button" class="secondary-btn" onclick="cancelEdit()">취소</button>`:""}</form><div class="grid-list photo-admin-list">${state.photoData.periods.map(p=>`<article class="item-card"><div><strong>${h(p.name)}</strong><p>${p.grade_level} · ${p.start_date}~${p.end_date}</p>${p.reward_title?`<small>완주 보상: ${h(p.reward_title)}</small>`:""}${photoPeriodAcceptsSubmissions(p)?`<span class="photo-status status-completed">활성</span>`:`<span class="photo-status status-not-submitted">종료</span>`}</div><div class="item-actions"><button onclick="editItem('learning-period',${js(p.id)})">수정</button></div></article>`).join("")||`<div class="empty">등록된 기간이 없습니다.</div>`}</div></div>`;
}

function photoHomeworkAdmin() {
  const edit = state.edit?.type === "photo-homework" ? state.photoData.homeworks.find((x) => x.id === state.edit.id) : null;
  const periods = state.photoData.periods.filter((p) => photoPeriodAcceptsSubmissions(p) || p.id === edit?.period_id);
  const lessonDates = [edit?.lesson_date || "", edit?.lesson_date_2 || "", edit?.lesson_date_3 || ""];
  const selectedTargetClassIds = edit ? photoTargetClassIds(edit.id) : [];
  const targetGrade = edit?.grade_level || "";
  return `<div class="admin-layout"><form class="form-panel" onsubmit="savePhotoHomework(event)"><h2>${edit?"사진 숙제 수정":"사진 숙제 등록"}</h2><div class="field"><label>학습 기간</label><select id="photoPeriod" required onchange="syncPhotoGrade()"><option value="">선택</option>${periods.map(p=>`<option value="${p.id}" data-grade="${p.grade_level}" ${edit?.period_id===p.id?"selected":""}>${h(p.name)} · ${p.grade_level}</option>`).join("")}</select></div><div class="field"><label>대상 학년</label><input id="photoGrade" readonly value="${h(targetGrade)}" /></div>${photoTargetClassSelectorMarkup(targetGrade,selectedTargetClassIds,edit?.id||"")}<div class="field"><label>수업일</label><div class="date-stack">${lessonDates.map((date,i)=>`<label class="date-input-line"><span>수업일 ${i+1}${i===0?" · 필수":" · 선택"}</span><input class="photo-lesson-date" type="date" ${i===0?"required":""} value="${date||""}" aria-label="수업일 ${i+1}" /></label>`).join("")}</div><small class="field-help">수업일 1은 성취도 계산 기준일이며, 수업일 2~3은 학생 참고용입니다.</small></div><div class="field"><label>숙제 제목</label><input id="photoTitle" required value="${h(edit?.title||"")}" /></div><div class="field"><label>문항 범위</label><input id="photoRange" required placeholder="예: 32번~45번" value="${h(edit?.problem_range||"")}" /></div><div class="field"><label>안내 메모</label><textarea id="photoMemo">${h(edit?.memo||"")}</textarea></div><button class="primary-btn">저장</button>${edit?`<button type="button" class="secondary-btn" onclick="cancelEdit()">취소</button>`:""}</form><div class="grid-list photo-admin-list">${state.photoData.homeworks.map(hw=>{const p=photoPeriodById(hw.period_id);const targetNames=photoTargetClassNames(hw.id);return `<article class="item-card"><div><strong>${h(hw.title)}</strong><p>수업일 ${h(photoClassDatesText(hw))} · ${hw.grade_level} · ${h(hw.problem_range)}</p><small>${h(p?.name||"")}</small><small>대상 반: ${h(targetNames.length?targetNames.join(", "):"대상 반 정보 없음")}</small></div><div class="item-actions"><button onclick="editItem('photo-homework',${js(hw.id)})">수정</button></div></article>`}).join("")||`<div class="empty">등록된 사진 숙제가 없습니다.</div>`}</div></div>`;
}

function photoTargetRows(homeworkId) {
  return (state.photoData.targets || []).filter((target) => target.homework_id === homeworkId);
}

function photoTargetClassIds(homeworkId) {
  return photoTargetRows(homeworkId)
    .map((target) => target.class_id)
    .filter(Boolean)
    .map(String);
}

function photoTargetClassNames(homeworkId) {
  return photoTargetRows(homeworkId)
    .map((target) => target.class_name_snapshot || className(target.class_id))
    .filter(Boolean);
}

function photoClassesForGrade(grade) {
  return (state.data.classes || [])
    .filter((classItem) => classGradeLevel(classItem) === grade)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function photoTargetSummaryText(classIds) {
  const selected = new Set((classIds || []).map(String));
  const studentCount = activeStudents().filter((student) => selected.has(String(student.classId))).length;
  if (!selected.size) return "대상 반을 한 개 이상 선택해주세요.";
  return `${selected.size}개 반 · 재학 학생 ${studentCount}명에게 배정`;
}

function photoTargetClassOptionsMarkup(grade, selectedClassIds = [], homeworkId = "") {
  if (!grade) return `<div class="photo-target-empty">학습 기간을 먼저 선택해주세요.</div>`;
  const classes = photoClassesForGrade(grade);
  const selected = new Set(selectedClassIds.map(String));
  const currentClassIds = new Set(classes.map((classItem) => String(classItem.id)));
  // 예전에는 반마다 activeStudents()를 다시 부르고 전체 학생을 걸렀습니다.
  // O(반 × 학생)이라 반과 학생이 늘수록 숙제 등록 화면이 무거워집니다.
  const studentCountByClassId = new Map();
  activeStudents().forEach((student) => {
    const key = String(student.classId);
    studentCountByClassId.set(key, (studentCountByClassId.get(key) || 0) + 1);
  });
  const currentOptions = classes.map((classItem) => {
    const studentCount = studentCountByClassId.get(String(classItem.id)) || 0;
    return `<label class="photo-target-option"><input type="checkbox" name="photoTargetClass" value="${h(classItem.id)}" ${selected.has(String(classItem.id))?"checked":""} onchange="updatePhotoTargetSummary()"/><span><strong>${h(classItem.name)}</strong><small>재학 ${studentCount}명</small></span></label>`;
  }).join("");
  const preservedOptions = homeworkId ? photoTargetRows(homeworkId)
    .filter((target) => target.class_id && !currentClassIds.has(String(target.class_id)))
    .map((target) => {
      const currentClass = state.data.classes.find((classItem) => String(classItem.id) === String(target.class_id));
      const currentGrade = classGradeLevel(currentClass) || "미지정";
      const displayName = target.class_name_snapshot || currentClass?.name || "기존 배정 반";
      return `<label class="photo-target-option preserved"><input type="checkbox" name="photoTargetClass" value="${h(target.class_id)}" checked disabled/><span><strong>${h(displayName)}</strong><small>기존 배정 · 학년 변경됨 (현재 ${h(currentGrade)})</small></span></label>`;
    }).join("") : "";
  if (!currentOptions && !preservedOptions) return `<div class="photo-target-empty">${h(grade)}에 등록된 반이 없습니다.</div>`;
  return `${currentOptions}${preservedOptions}`;
}

function photoTargetClassSelectorMarkup(grade, selectedClassIds = [], homeworkId = "") {
  const gradeClassIds = photoClassesForGrade(grade).map((classItem) => String(classItem.id));
  const selected = new Set(selectedClassIds.map(String));
  const classCount = gradeClassIds.length;
  const allSelected = classCount > 0 && gradeClassIds.every((classId) => selected.has(classId));
  return `<div class="field photo-target-field"><div class="photo-target-head"><label id="photoTargetLabel">대상 반</label><button id="photoTargetToggle" type="button" class="small-btn" onclick="togglePhotoTargetClasses()" ${classCount?"":"disabled"}>${allSelected?"전체 해제":"전체 선택"}</button></div><div id="photoTargetClasses" class="photo-target-options" aria-labelledby="photoTargetLabel">${photoTargetClassOptionsMarkup(grade,selectedClassIds,homeworkId)}</div><small id="photoTargetSummary" class="photo-target-summary" aria-live="polite">${h(photoTargetSummaryText(selectedClassIds))}</small><small class="field-help">여러 반을 동시에 선택할 수 있습니다.${homeworkId?" 기존 배정 반의 학년이 바뀐 경우 해당 배정은 자동으로 유지됩니다.":""}</small></div>`;
}

function selectedPhotoTargetClassIds() {
  return [...document.querySelectorAll('input[name="photoTargetClass"]:checked')].map((input) => input.value);
}

function updatePhotoTargetSummary() {
  const selectedIds = selectedPhotoTargetClassIds();
  const summary = document.querySelector("#photoTargetSummary");
  const toggle = document.querySelector("#photoTargetToggle");
  const checkboxes = [...document.querySelectorAll('input[name="photoTargetClass"]:not(:disabled)')];
  if (summary) summary.textContent = photoTargetSummaryText(selectedIds);
  if (toggle) {
    toggle.disabled = checkboxes.length === 0;
    toggle.textContent = checkboxes.length > 0 && checkboxes.every((input) => input.checked) ? "전체 해제" : "전체 선택";
  }
}

function togglePhotoTargetClasses() {
  const checkboxes = [...document.querySelectorAll('input[name="photoTargetClass"]:not(:disabled)')];
  const shouldSelect = checkboxes.some((input) => !input.checked);
  checkboxes.forEach((input) => { input.checked = shouldSelect; });
  updatePhotoTargetSummary();
}

function syncPhotoGrade() {
  const option = document.querySelector("#photoPeriod")?.selectedOptions[0];
  const grade = document.querySelector("#photoGrade");
  const targetClasses = document.querySelector("#photoTargetClasses");
  const nextGrade = option?.dataset.grade || "";
  const previousGrade = grade?.value || "";
  const editingHomework = state.edit?.type === "photo-homework"
    ? state.photoData.homeworks.find((homework) => homework.id === state.edit.id)
    : null;
  const preserveExistingTargets = Boolean(editingHomework && nextGrade === editingHomework.grade_level);
  const existingTargetIds = preserveExistingTargets ? photoTargetClassIds(editingHomework.id) : [];
  const selectedIds = previousGrade === nextGrade
    ? [...new Set([...selectedPhotoTargetClassIds(), ...existingTargetIds])]
    : existingTargetIds;
  const preservedHomeworkId = preserveExistingTargets ? editingHomework.id : "";
  if (grade) grade.value = nextGrade;
  if (targetClasses) targetClasses.innerHTML = photoTargetClassOptionsMarkup(nextGrade, selectedIds, preservedHomeworkId);
  updatePhotoTargetSummary();
}

async function saveLearningPeriod(event) {
  event.preventDefault(); const id=state.edit?.type==="learning-period"?state.edit.id:null;
  const payload={name:document.querySelector("#periodName").value.trim(),grade_level:document.querySelector("#periodGrade").value,start_date:document.querySelector("#periodStart").value,end_date:document.querySelector("#periodEnd").value,is_active:document.querySelector("#periodActive").checked,reward_title:document.querySelector("#periodRewardTitle").value.trim(),reward_before_message:document.querySelector("#periodRewardBefore").value.trim(),reward_achieved_message:document.querySelector("#periodRewardAchieved").value.trim()};
  try { const q=id?supabaseClient.from("learning_periods").update(payload).eq("id",id):supabaseClient.from("learning_periods").insert(payload); const {error}=await q;if(error)throw error;state.edit=null;await loadAdminPhotoHomework();render(); } catch(error){state.message=error.message;render();}
}

async function savePhotoHomework(event) {
  event.preventDefault();
  const id = state.edit?.type === "photo-homework" ? state.edit.id : null;
  const dates = [...document.querySelectorAll(".photo-lesson-date")].map((input) => input.value);
  const targetClassIds = selectedPhotoTargetClassIds();
  const submitButton = event.submitter;
  try {
    if (!dates[0]) throw new Error("수업일 1을 입력해주세요.");
    if (!targetClassIds.length) throw new Error("대상 반을 한 개 이상 선택해주세요.");
    if (submitButton) submitButton.disabled = true;
    const { error } = await supabaseClient.rpc("admin_save_photo_homework", {
      target_homework_id: id,
      target_period_id: document.querySelector("#photoPeriod").value,
      target_lesson_date: dates[0],
      target_lesson_date_2: dates[1] || null,
      target_lesson_date_3: dates[2] || null,
      target_title: document.querySelector("#photoTitle").value.trim(),
      target_problem_range: document.querySelector("#photoRange").value.trim(),
      target_memo: document.querySelector("#photoMemo").value.trim(),
      target_class_ids: targetClassIds,
    });
    if (error) throw error;
    state.edit = null;
    await loadAdminPhotoHomework();
    render();
  } catch (error) {
    state.message = error.message;
    render();
  } finally {
    if (submitButton?.isConnected) submitButton.disabled = false;
  }
}

function filteredPhotoAssignments(filters = state.photoFilters, includeStatus = true) {
  const f=filters;
  return state.photoData.assignments.filter(a=>{const hw=photoHomeworkById(a.homework_id)||{};return (!f.periodId||hw.period_id===f.periodId)&&(!f.grade||a.assigned_grade_level===f.grade)&&(!f.classId||a.assigned_class_id===f.classId)&&(!f.homeworkId||a.homework_id===f.homeworkId)&&(!f.student||String(a.student_name_snapshot||"").toLowerCase().includes(f.student.toLowerCase()))&&(!includeStatus||!f.status||a.status===f.status)}).sort((a,b)=>(a.status==="pending"?-1:1)-(b.status==="pending"?-1:1));
}

const PHOTO_STATS_SORT_OPTIONS = [
  ["completion_desc", "완성률 높은 순"],
  ["completion_asc", "완성률 낮은 순"],
  ["name", "이름순"],
  ["incomplete_desc", "미완료 많은 순"],
];

function photoFilterMarkup(scope = "reviews") {
  const isStats=scope==="stats";
  const f=isStats?state.photoStatsFilters:state.photoFilters;
  const classOptions=state.data.classes||[];
  const filterHandler=isStats?"setPhotoStatsFilter":"setPhotoFilter";
  const studentInput=isStats
    ? `<input id="photoStatsStudentFilter" placeholder="학생 이름" value="${h(f.student)}" oncompositionstart="this.dataset.composing='1'; cancelSearchDebounce('photoStats')" oncompositionend="this.dataset.composing=''; setPhotoStatsStudentFilter(this)" oninput="setPhotoStatsStudentFilter(this)"/>`
    : `<input id="photoStudentFilter" placeholder="학생 이름" value="${h(f.student)}" oncompositionstart="this.dataset.composing='1'; cancelSearchDebounce('photoStudent')" oncompositionend="this.dataset.composing=''; setPhotoStudentFilter(this)" oninput="setPhotoStudentFilter(this)"/>`;
  const statusFilter=isStats?"":`<select onchange="setPhotoFilter('status',this.value)"><option value="">모든 상태</option>${Object.entries(PHOTO_STATUS).map(([v,x])=>`<option value="${v}" ${f.status===v?"selected":""}>${x[0]}</option>`).join("")}</select>`;
  const sortFilter=isStats?`<select class="photo-stats-sort" aria-label="학생별 완성률 정렬" onchange="setPhotoStatsSort(this.value)">${PHOTO_STATS_SORT_OPTIONS.map(([value,label])=>`<option value="${value}" ${state.photoStatsSort===value?"selected":""}>${label}</option>`).join("")}</select>`:"";
  return `<div class="photo-filters"><select onchange="${filterHandler}('periodId',this.value)"><option value="">모든 기간</option>${state.photoData.periods.map(p=>`<option value="${p.id}" ${f.periodId===p.id?"selected":""}>${h(p.name)} · ${p.grade_level}</option>`).join("")}</select><select onchange="${filterHandler}('grade',this.value)"><option value="">모든 학년</option>${["고1","고2","고3"].map(x=>`<option ${f.grade===x?"selected":""}>${x}</option>`).join("")}</select><select onchange="${filterHandler}('classId',this.value)"><option value="">모든 반</option>${classOptions.map(c=>`<option value="${c.id}" ${f.classId===c.id?"selected":""}>${h(c.name)}</option>`).join("")}</select><select onchange="${filterHandler}('homeworkId',this.value)"><option value="">모든 숙제</option>${state.photoData.homeworks.map(hw=>`<option value="${hw.id}" ${f.homeworkId===hw.id?"selected":""}>${h(hw.title)}</option>`).join("")}</select>${studentInput}${statusFilter}${sortFilter}</div>`;
}
function clearPhotoReviewDetailCache(){
  state.photoReviewRequestId+=1;
  state.photoReviewOpenIds=[];
  state.photoReviewDetails={};
  state.photoData.rounds=[];
  state.photoData.photos=[];
  state.photoData.deletions=[];
  state.photoPreview={};
  state.photoLightbox={ids:[],index:0};
}
function setPhotoStudentFilter(input){
  state.photoFilters.student=input.value;
  debounceSearchInput("photoStudent", input, async () => {
    if(state.view!=="photo-homework-admin"||state.photoHomeworkView!=="reviews") return;
    clearPhotoReviewDetailCache();
    await loadPhotoReviewPage(1);
    if(state.view!=="photo-homework-admin"||state.photoHomeworkView!=="reviews") return;
    render();
    refocusSearchInput("#photoStudentFilter");
  });
}
function setPhotoStatsStudentFilter(input){
  state.photoStatsFilters.student=input.value;
  debounceSearchInput("photoStats", input, () => {
    if(state.view!=="photo-homework-admin"||state.photoHomeworkView!=="stats") return;
    render();
    refocusSearchInput("#photoStatsStudentFilter");
  });
}
async function setPhotoFilter(key,value){
  state.photoFilters[key]=value;
  clearPhotoReviewDetailCache();
  if(state.photoHomeworkView==="reviews") await loadPhotoReviewPage(1);
  render();
}
function setPhotoStatsFilter(key,value){
  state.photoStatsFilters[key]=value;
  render();
}

function setPhotoStatsSort(value){
  state.photoStatsSort=PHOTO_STATS_SORT_OPTIONS.some(([id])=>id===value)?value:"completion_desc";
  render();
}

function photoReviewAdmin() {
  const review=state.photoReview;
  const pageCount=Math.max(1,Math.ceil(review.total/review.pageSize));
  const first=review.total?(review.page-1)*review.pageSize+1:0;
  const last=Math.min(review.total,review.page*review.pageSize);
  const list=review.loading
    ? `<div class="empty photo-review-loading">제출 목록을 불러오는 중입니다.</div>`
    : review.items.map(photoReviewCard).join("")||`<div class="empty">조건에 맞는 제출이 없습니다.</div>`;
  return `<div class="pending-alert"><strong>확인 대기 ${review.pendingCount}건</strong><span>재제출을 포함해 위쪽에 우선 표시됩니다.</span></div>${photoFilterMarkup()}<div class="bulk-actions photo-bulk-bar"><span id="photoBulkCount">선택 0명</span><button class="primary-btn" onclick="bulkCompletePhotoAssignments()">선택 학생 일괄 완료</button></div><div class="photo-review-list photo-inbox-list">${list}</div><nav class="photo-review-pagination" aria-label="제출 확인 페이지"><span>${first}-${last} / 총 ${review.total}건</span><div><button type="button" class="small-btn" onclick="changePhotoReviewPage(-1)" ${review.page<=1||review.loading?"disabled":""}>이전</button><strong>${review.page} / ${pageCount}</strong><button type="button" class="small-btn" onclick="changePhotoReviewPage(1)" ${review.page>=pageCount||review.loading?"disabled":""}>다음</button></div></nav>`;
}

function photoReviewCard(item) {
  const base=item.assignment?{...item.assignment,...item}:item;
  const detail=state.photoReviewDetails[base.id];
  const a=detail?.assignment?{...base,...detail.assignment}:base;
  const hw=detail?.homework||item.homework||photoHomeworkById(a.homework_id)||{};
  const rounds=(detail?.rounds||[]).slice().sort((x,y)=>y.round_number-x.round_number);
  const photos=(detail?.photos||[]).filter(x=>!x.deleted_at);
  const deletions=detail?.deletions||[];
  const open=state.photoReviewOpenIds.includes(a.id);
  const feedback=a.admin_feedback?`피드백: ${a.admin_feedback.slice(0,38)}${a.admin_feedback.length>38?"…":""}`:"피드백 없음";
  const photoCount=Number(item.photo_count??item.photoCount??photos.length);
  const lastSubmitted=item.latest_submitted_at||item.latestSubmittedAt;
  const detailMarkup=!open?"":!detail?`<div class="inbox-detail"><p class="subtle">상세 내용을 불러오는 중입니다.</p></div>`:`<div class="inbox-detail"><div class="review-controls"><textarea id="feedback-${a.id}" placeholder="간단한 피드백">${h(a.admin_feedback||"")}</textarea><button class="success-btn" onclick="reviewPhotoAssignment(${js(a.id)},'completed')">완료 처리</button><button class="danger-btn" onclick="reviewPhotoAssignment(${js(a.id)},'redo')">다시 풀기</button>${a.status==="completed"?`<button class="danger-btn" onclick="deleteCompletedPhotoSubmission(${js(a.id)})">제출물 삭제</button>`:""}</div>${rounds.length?rounds.map(r=>{const ps=photos.filter(p=>p.round_id===r.id);return `<div class="submission-round"><div><strong>${r.round_number}회차</strong><span>${formatDateTime(r.submitted_at)}</span></div>${ps.length?`<div class="submitted-photo-grid">${ps.map(p=>`<button type="button" onclick="openPhotoLightbox(${js(p.id)},true)"><img src="${h(state.photoPreview[p.id]||"")}" alt="${h(a.student_name_snapshot)} 제출 사진" /></button>`).join("")}</div>`:`<p class="subtle">남아 있는 사진이 없습니다.</p>`}</div>`}).join(""):`<p class="subtle">제출 회차가 없습니다.</p>`}${deletions.length?`<details class="deletion-history"><summary>삭제 이력 · ${deletions.length}건</summary>${deletions.map(d=>`<p>${d.round_number}회차 · ${h(d.original_file_name)} · ${formatDateTime(d.deleted_at)}</p>`).join("")}</details>`:""}</div>`;
  return `<article class="photo-review-card inbox-row ${open?"open":""}" data-student-name="${h(a.student_name_snapshot)}"><div class="inbox-main"><label class="inbox-check"><input class="photo-bulk-check" type="checkbox" value="${a.id}" ${a.status!=="pending"?"disabled":""} onchange="updatePhotoBulkCount()"/></label><div class="inbox-student"><strong>${h(a.student_name_snapshot)}</strong><span>${h(a.school_snapshot)} · ${h(a.assigned_class_name)} · ${a.assigned_grade_level}</span></div><div class="inbox-homework"><strong>${h(hw.title||a.homework_title||"")}</strong><span>수업일 ${h(photoClassDatesText(hw))} · ${h(hw.problem_range||a.problem_range||"")}</span></div><div class="inbox-meta"><span>사진 ${photoCount}장</span><span>${lastSubmitted?`마지막 제출 ${formatDateTime(lastSubmitted)}`:"미제출"}</span><span>${h(feedback)}</span></div><div class="inbox-status">${photoStatusBadge(a.status)}<button type="button" class="detail-toggle" onclick="togglePhotoReviewDetail(${js(a.id)})">${open?"접기":"상세보기"}</button></div></div>${detailMarkup}</article>`;
}

async function changePhotoReviewPage(step){const pageCount=Math.max(1,Math.ceil(state.photoReview.total/state.photoReview.pageSize));const next=Math.min(pageCount,Math.max(1,state.photoReview.page+step));if(next===state.photoReview.page)return;clearPhotoReviewDetailCache();await loadPhotoReviewPage(next);render();}
async function togglePhotoReviewDetail(id){
  if(state.photoReviewOpenIds.includes(id)){state.photoReviewOpenIds=state.photoReviewOpenIds.filter(x=>x!==id);render();return;}
  state.photoReviewOpenIds=[id];
  render();
  if(state.photoReviewDetails[id])return;
  try{
    const detail=await photoApi("admin-review-detail",{assignmentId:id});
    if(!state.photoReviewOpenIds.includes(id))return;
    state.photoReviewDetails[id]=detail;
    state.photoData.rounds=[...state.photoData.rounds.filter(x=>x.assignment_id!==id),...(detail.rounds||[])];
    state.photoData.photos=[...state.photoData.photos.filter(x=>x.assignment_id!==id),...(detail.photos||[])];
    state.photoData.deletions=[...state.photoData.deletions.filter(x=>x.assignment_id!==id),...(detail.deletions||[])];
    Object.assign(state.photoPreview,detail.urls||{});
  }catch(error){state.photoReviewOpenIds=[];state.message=error.message;}
  render();
}
function updatePhotoBulkCount(){const count=document.querySelectorAll(".photo-bulk-check:checked").length;const label=document.querySelector("#photoBulkCount");if(label)label.textContent=`선택 ${count}명`;}

async function reviewPhotoAssignment(id,status){try{const feedback=document.querySelector(`#feedback-${id}`)?.value.trim()||"";const {error}=await supabaseClient.rpc("admin_review_photo_assignment",{target_assignment_id:id,target_status:status,target_feedback:feedback});if(error)throw error;state.photoStatsLoaded=false;clearPhotoReviewDetailCache();await loadPhotoReviewPage(state.photoReview.page);render();}catch(error){state.message=error.message;render();}}
async function deleteCompletedPhotoSubmission(id){const item=state.photoReview.items.find(x=>(x.assignment?.id||x.id)===id);const studentName=item?.assignment?.student_name_snapshot||item?.student_name_snapshot||"선택한";if(!confirm(`${studentName} 학생의 완료된 제출 사진을 삭제하고 상태를 미제출로 되돌릴까요?`))return;try{await photoApi("admin-delete-submission",{assignmentId:id});state.photoStatsLoaded=false;clearPhotoReviewDetailCache();await loadPhotoReviewPage(state.photoReview.page);state.message="제출물을 삭제하고 미제출 상태로 되돌렸습니다.";render();}catch(error){state.message=error.message;render();}}
async function bulkCompletePhotoAssignments(){const ids=[...document.querySelectorAll(".photo-bulk-check:checked")].map(x=>x.value);if(!ids.length){alert("완료 처리할 학생을 선택해주세요.");return;}try{const {data,error}=await supabaseClient.rpc("admin_complete_photo_assignments",{target_assignment_ids:ids});if(error)throw error;const failed=(data||[]).filter(x=>!x.success);state.photoStatsLoaded=false;clearPhotoReviewDetailCache();await loadPhotoReviewPage(state.photoReview.page);state.message=failed.length?`${ids.length-failed.length}건 완료, ${failed.length}건 실패: ${failed[0].message}`:"";render();}catch(error){state.message=error.message;render();}}

function photoStatsNumber(value){
  const number=Number(value);
  return Number.isFinite(number)?number:0;
}

function photoStatsIncomplete(student){
  return photoStatsNumber(student.not_submitted)+photoStatsNumber(student.pending)+photoStatsNumber(student.redo);
}

function comparePhotoStatsNames(a,b){
  return String(a.name||"").localeCompare(String(b.name||""),"ko")
    ||String(a.school||"").localeCompare(String(b.school||""),"ko")
    ||String(a.className||"").localeCompare(String(b.className||""),"ko");
}

function sortPhotoStatsStudents(students,sort=state.photoStatsSort){
  return students.slice().sort((a,b)=>{
    const aHasTotal=photoStatsNumber(a.total)>0;
    const bHasTotal=photoStatsNumber(b.total)>0;
    if(aHasTotal!==bHasTotal) return aHasTotal?-1:1;
    if(!aHasTotal&&!bHasTotal) return comparePhotoStatsNames(a,b);
    const aRate=Number.isFinite(a.rateValue)?a.rateValue:0;
    const bRate=Number.isFinite(b.rateValue)?b.rateValue:0;
    const aIncomplete=photoStatsIncomplete(a);
    const bIncomplete=photoStatsIncomplete(b);
    if(sort==="completion_asc"){
      return aRate-bRate||bIncomplete-aIncomplete||comparePhotoStatsNames(a,b);
    }
    if(sort==="name"){
      return comparePhotoStatsNames(a,b);
    }
    if(sort==="incomplete_desc"){
      return bIncomplete-aIncomplete||aRate-bRate||comparePhotoStatsNames(a,b);
    }
    return bRate-aRate
      ||photoStatsNumber(b.completed)-photoStatsNumber(a.completed)
      ||aIncomplete-bIncomplete
      ||comparePhotoStatsNames(a,b);
  });
}

function emptyPhotoStatusCounts(){
  return {total:0,not_submitted:0,pending:0,completed:0,redo:0};
}

function photoStatsAdmin(){
  const today=isoDate(new Date());
  const filteredRows=filteredPhotoAssignments(state.photoStatsFilters,false);
  const rows=filteredRows.filter(a=>(photoHomeworkById(a.homework_id)?.lesson_date||"9999")<=today);
  const byStudent=new Map();
  const ensureStudent=a=>{
    const grade=a.assigned_grade_level||"미지정 학년";
    const classNameSnapshot=a.assigned_class_name||className(a.assigned_class_id)||"미지정 반";
    const studentId=a.student_id||`snapshot:${a.student_name_snapshot||""}:${a.school_snapshot||""}`;
    const classIdentity=a.assigned_class_id||`snapshot:${classNameSnapshot}`;
    const studentKey=`${studentId}::${grade}::${classIdentity}`;
    if(!byStudent.has(studentKey)) byStudent.set(studentKey,{name:a.student_name_snapshot,school:a.school_snapshot,className:classNameSnapshot,classId:a.assigned_class_id||"",grade,total:0,completed:0,not_submitted:0,pending:0,redo:0});
    return byStudent.get(studentKey);
  };
  rows.forEach(a=>{
    const x=ensureStudent(a);
    x.total++;
    if(Object.prototype.hasOwnProperty.call(x,a.status)) x[a.status]++;
  });
  filteredRows.forEach(ensureStudent);
  const students=[...byStudent.values()].map(x=>{
    const rateValue=x.total?x.completed/x.total*100:null;
    return {...x,rateValue,rate:rateValue===null?0:Math.round(rateValue)};
  });
  const classGroups=new Map();
  const gradeGroups=new Map();
  students.filter(x=>x.total>0).forEach(x=>{
    const gradeGroup=gradeGroups.get(x.grade)||{label:`${x.grade} 평균`,total:0,completed:0};
    gradeGroup.total+=x.total;
    gradeGroup.completed+=x.completed;
    gradeGroups.set(x.grade,gradeGroup);
    const classKey=`${x.grade}::${x.classId||`snapshot:${x.className}`}`;
    const classGroup=classGroups.get(classKey)||{label:`${x.grade} · ${x.className} 평균`,total:0,completed:0};
    classGroup.total+=x.total;
    classGroup.completed+=x.completed;
    classGroups.set(classKey,classGroup);
  });
  // 예전에는 숙제마다 rows 전체를 훑어 list를 만들고, 거기서 상태별로 네 번 더
  // 훑었습니다. O(5 × 숙제 × 배정)이라 학생 200명 × 숙제 100개면 배정 2만 건에
  // 1천만 회 연산이었고, 이름을 한 글자 칠 때마다 다시 돌았습니다.
  // 한 번만 훑어 숙제별로 모읍니다.
  const countsByHomeworkId=new Map();
  rows.forEach(a=>{
    let counts=countsByHomeworkId.get(a.homework_id);
    if(!counts){
      counts=emptyPhotoStatusCounts();
      countsByHomeworkId.set(a.homework_id,counts);
    }
    counts.total++;
    // PHOTO_STATUS에 있는 상태만 셉니다. total과 이름이 겹칠 일이 없습니다.
    if(PHOTO_STATUS[a.status]) counts[a.status]++;
  });
  const homeworkRows=state.photoData.homeworks.filter(hw=>hw.lesson_date<=today).map(hw=>({title:hw.title,grade:hw.grade_level,...(countsByHomeworkId.get(hw.id)||emptyPhotoStatusCounts())})).filter(x=>x.total);
  const summaries=[...gradeGroups.values(),...classGroups.values()];
  const sortedStudents=sortPhotoStatsStudents(students);
  return `${photoFilterMarkup("stats")}<section class="stats-summary-grid">${summaries.map(x=>{const rate=x.total?Math.round(x.completed/x.total*100):0;return `<article><span>${h(x.label)}</span><strong>${rate}%</strong><small>완성률</small></article>`}).join("")||`<article><span>현재 조건</span><strong>0%</strong><small>분모 0건</small></article>`}</section><h2 class="compact-title">학생별 완성률</h2><div class="table-scroll"><table><thead><tr><th>학생</th><th>학교</th><th>학년·반</th><th>완료/부여</th><th>완성률</th><th>미제출</th><th>확인 대기</th><th>다시 풀기</th></tr></thead><tbody>${sortedStudents.map(x=>`<tr><td>${h(x.name)}</td><td>${h(x.school)}</td><td>${x.grade} · ${h(x.className)}</td><td>${x.completed}/${x.total}</td><td>${x.total?`<strong>${x.rate}%</strong>`:`<span class="subtle">집계할 숙제 없음</span>`}</td><td>${x.not_submitted}</td><td>${x.pending}</td><td>${x.redo}</td></tr>`).join("")}</tbody></table></div><h2 class="compact-title photo-stat-title">숙제별 상태 인원</h2><div class="table-scroll"><table><thead><tr><th>숙제</th><th>학년</th><th>미제출</th><th>확인 대기</th><th>완료</th><th>다시 풀기</th></tr></thead><tbody>${homeworkRows.map(x=>`<tr><td>${h(x.title)}</td><td>${x.grade}</td><td>${x.not_submitted}</td><td>${x.pending}</td><td>${x.completed}</td><td>${x.redo}</td></tr>`).join("")}</tbody></table></div>`;
}

function studentCalendar() {
  return `
    <section class="section-head">
      <div><h1>숙제 캘린더</h1></div>
    </section>
    ${calendarMarkup(state.calendarDate, studentVisibleHomeworks(), true)}
  `;
}

function calendarMarkup(baseDate, homeworks, showNextMonth, datesLinkToHomework = false) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(start.getDate() - first.getDay());
  const days = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const requiredCells = first.getDay() + daysInMonth;
  const totalDays = showNextMonth ? 42 : requiredCells > 35 ? 42 : 35;
  for (let i = 0; i < totalDays; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  const today = isoDate(new Date());
  return `
    <section class="panel">
      <div class="calendar-toolbar">
        <h2>${year}년 ${month + 1}월</h2>
        <div class="toolbar-actions">
          <button class="small-btn" onclick="moveMonth(-1)">이전</button>
          <button class="small-btn" onclick="moveMonth(1)">다음</button>
        </div>
      </div>
      <div class="calendar-grid">
        ${["일", "월", "화", "수", "목", "금", "토"].map((day) => `<div class="weekday">${day}</div>`).join("")}
        ${days
          .map((day) => {
            const dateKey = isoDate(day);
            const items = homeworks
              .filter((item) => item.date === dateKey)
              .sort((a, b) => className(a.classId).localeCompare(className(b.classId), "ko"));
            const dateLinkAttributes = datesLinkToHomework
              ? ` role="button" tabindex="0" aria-label="${dateKey} 숙제 등록" onclick="goToHomeworkRegistration('${dateKey}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goToHomeworkRegistration('${dateKey}')}"`
              : "";
            return `
              <div class="day-cell ${day.getMonth() !== month ? "muted-month" : ""} ${items.length ? "" : "no-items"} ${datesLinkToHomework ? "selectable-date" : ""}"${dateLinkAttributes}>
                <div class="date-row">
                  <span>${day.getDate()}<em>${weekdayName(day)}</em></span>
                  ${dateKey === today ? `<span class="today-dot" title="오늘"></span>` : ""}
                </div>
                ${items
                  .map(
                    (item) => `
                    <article class="homework-card">
                      <strong>${h(className(item.classId))}</strong>
                      <span>${h(item.content)}</span>
                    </article>
                  `,
                  )
                  .join("")}
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function moveMonth(delta) {
  state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + delta, 1);
  render();
}

function setAdminCalendarGrade(grade) {
  state.adminCalendarGrade = ["고1", "고2", "고3"].includes(grade) ? grade : "";
  render();
}

function goToHomeworkRegistration(date) {
  if (state.user?.role !== "admin" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const selectedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(selectedDate.getTime()) || isoDate(selectedDate) !== date) return;
  state.homeworkDraftDate = date;
  state.homeworkView = date < isoDate(new Date()) ? "past" : "upcoming";
  return go("homework-admin");
}

function studentClasses() {
  // 예전에는 반마다 studentVisibleVideos()를 다시 불렀습니다. 그때마다 볼 수
  // 있는 반 Set을 새로 만들고 전체 영상을 훑어서 O(반 × 영상)이었습니다.
  // 한 번만 세어둡니다.
  const videoCountByClassId = new Map();
  studentVisibleVideos().forEach((video) => {
    videoCountByClassId.set(video.classId, (videoCountByClassId.get(video.classId) || 0) + 1);
  });
  return `
    <section class="section-head">
      <div>
        <h1>반별 수업 영상</h1>
        <p class="subtle">반을 선택하면 최신 영상부터 볼 수 있습니다.</p>
      </div>
    </section>
    <div class="grid-list">
      ${studentVisibleClasses()
        .map(
          (item) => `
          <button class="class-card" onclick="openClassVideos('${item.id}')">
            <h2>${h(item.name)}</h2>
            <p class="subtle">${videoCountByClassId.get(item.id) || 0}개 영상</p>
          </button>
        `,
        )
        .join("")}
    </div>
  `;
}

function openClassVideos(classId) {
  state.selectedClassId = classId;
  state.view = "class-videos";
  render();
}

function studentVideos() {
  const visibleClasses = studentVisibleClasses();
  const selectedIsVisible = visibleClasses.some((item) => item.id === state.selectedClassId);
  const classId = selectedIsVisible ? state.selectedClassId : visibleClasses[0]?.id;
  const videos = studentVisibleVideos()
    .filter((item) => item.classId === classId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `
    <section class="section-head">
      <div>
        <h1>${h(className(classId))} 영상</h1>
        <p class="subtle">영상은 사이트 안에서 재생하지 않고 유튜브로 이동합니다.</p>
      </div>
      <button class="ghost-btn" onclick="go('classes-student')">반 목록</button>
    </section>
    <div class="video-list">
      ${
        videos.length
          ? videos
              .map((item) => {
                const url = safeHttpUrl(item.url);
                return `
                <article class="video-card">
                  <div>
                    <h2>${h(item.title)}</h2>
                  </div>
                  ${url
                    ? `<a class="link-btn" href="${h(url)}" target="_blank" rel="noopener" onclick="openVideo('${item.id}')">유튜브로 이동</a>`
                    : `<span class="subtle">영상 주소가 올바르지 않습니다. 선생님께 알려주세요.</span>`}
                </article>
              `;
              })
              .join("")
          : `<div class="empty panel">등록된 영상이 없습니다.</div>`
      }
    </div>
  `;
}

// 앵커 href에 넣어도 되는 주소인지 봅니다.
//
// 영상 주소는 관리자만 입력하지만, input type="url"은 javascript: 같은
// 주소도 유효한 URL로 통과시킵니다. 예전에는 onclick이 return false로
// 앵커를 막고 있어서 그런 주소가 실행되지 않았는데, 이동을 href에
// 맡기면서 그 방어가 사라졌습니다. 그래서 여기서 막습니다.
function safeHttpUrl(url) {
  const value = String(url || "").trim();
  return /^https?:\/\//i.test(value) ? value : "";
}

// 이동은 앵커의 href가 합니다. 여기서는 기록만 남깁니다.
//
// 예전에는 window.open으로 직접 열고 return false로 앵커를 막았습니다.
// href가 있는데 이동 경로를 하나 더 만든 셈인데, iOS PWA나 카카오톡
// 인앱 브라우저처럼 window.open이 차단되는 환경에서는 앵커도 이미
// 막혀 있어서 버튼을 눌러도 아무 일이 일어나지 않았습니다.
//
// target="_blank"라 현재 화면이 그대로 남으므로 기록 요청도 끊기지 않습니다.
// 기록이 실패해도 이동은 막지 않습니다. 영상 보는 것이 먼저입니다.
function openVideo(videoId) {
  recordVideoView(videoId).catch((error) => console.warn("영상 기록 저장 실패", error));
}

async function recordVideoView(videoId) {
  if (state.user?.role !== "student") return;
  const payload = {
    studentId: state.user.id,
    videoId,
    clickedAt: new Date().toISOString(),
  };
  if (supabaseClient) {
    // 서버가 세션 토큰으로 student_id를 정하고 clicked_at은 DB가 찍습니다.
    // 예전에는 여기서 브라우저가 직접 insert했고, 그 때문에 video_views를
    // anon에 열어둬야 했습니다. 공개된 anon key로 누구나 남의 이름을 달아
    // 시청 기록을 만들어 넣을 수 있는 상태였습니다.
    await photoApi("record-video-view", { videoId });
    return;
  }
  state.data.videoViews = state.data.videoViews || [];
  state.data.videoViews.unshift({ id: uid("view"), ...payload });
  saveDemoData();
}

async function goToPhotoAdminTab(tab) {
  if (state.user?.role !== "admin") return;
  if (state.view === "photo-homework-admin") {
    await setPhotoAdminView(tab);
    return;
  }
  state.photoHomeworkView = tab;
  await go("photo-homework-admin");
}

function goToSchoolScoreInput() {
  if (state.user?.role !== "admin") return;
  state.schoolScoreView = "bulk";
  return go("school-scores");
}

function adminDashboard() {
  const now = state.calendarDate;
  const selectedGrade = state.adminCalendarGrade;
  const monthHomeworks = state.data.homeworks.filter((item) => {
    const date = new Date(`${item.date}T00:00:00`);
    const isCurrentMonth = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    if (!isCurrentMonth || !selectedGrade) return isCurrentMonth;
    return classGradeLevel(item.classId) === selectedGrade;
  });
  return `
    <section class="section-head">
      <div>
        <h1>관리자 대시보드</h1>
        <p class="subtle">${supabaseClient ? "실제 공유 데이터베이스와 연결되어 있습니다." : "데모 모드입니다. 배포 전 Supabase 정보를 연결하세요."}</p>
      </div>
    </section>
    <nav class="dashboard-quick-links" aria-label="관리자 빠른 이동">
      <span>빠른 이동</span>
      <div>
        <button type="button" onclick="go('students-admin')">학생 등록</button>
        <button type="button" onclick="go('homework-admin')">숙제 등록</button>
        <button type="button" onclick="goToPhotoAdminTab('reviews')">사진 제출 확인</button>
        <button type="button" onclick="goToSchoolScoreInput()">내신 성적 입력</button>
      </div>
    </nav>
    <div class="dashboard-grid">
      <article class="summary-card"><h2>${state.data.classes.length}개</h2><p>운영 중인 반</p></article>
      <article class="summary-card"><h2>${state.data.videos.length}개</h2><p>등록된 수업 영상</p></article>
      <article class="summary-card"><h2>${activeStudents().length || "-"}명</h2><p>학생 계정</p></article>
    </div>
    <div class="dashboard-calendar-filter" aria-label="숙제 달력 학년 필터">
      <span>숙제 학년 · 날짜를 누르면 해당 날짜의 숙제를 등록할 수 있습니다.</span>
      <div class="dashboard-grade-buttons">
        ${[["", "전체"], ["고1", "고1"], ["고2", "고2"], ["고3", "고3"]].map(([value, label]) => `
          <button type="button" class="${selectedGrade === value ? "active" : ""}" aria-pressed="${selectedGrade === value}" onclick="setAdminCalendarGrade('${value}')">${label}</button>
        `).join("")}
      </div>
    </div>
    ${calendarMarkup(now, monthHomeworks, false, true)}
  `;
}

const LESSON_ATTENDANCE_OPTIONS = [
  ["present", "출석"],
  ["late", "지각"],
  ["absent", "결석"],
  ["early_leave", "조퇴"],
  ["makeup", "보강"],
];
const LESSON_HOMEWORK_OPTIONS = [
  ["A", "A"],
  ["B", "B"],
  ["C", "C"],
  ["pending", "제출 전"],
  ["not_recorded", "미기록"],
];

function lessonAttendanceLabel(value) {
  return LESSON_ATTENDANCE_OPTIONS.find(([id]) => id === value)?.[1] || "출석";
}

function lessonHomeworkLabel(value) {
  return LESSON_HOMEWORK_OPTIONS.find(([id]) => id === value)?.[1] || "제출 전";
}

// 수업일지는 두 테이블을 씁니다.
//
//   class_sessions          수업 회차. 반당 주 2~3회라 양이 적습니다.
//   student_lesson_records  회차마다 학생 수만큼 생깁니다. 이쪽이 계속 커집니다.
//
// 예전에는 메뉴에 들어갈 때마다(go에서 force=true) 둘 다 전부 다시
// 받았습니다. 학생 60명 기준 3년이면 기록이 1만 5천 행인데, 정작
// 작성 화면이 쓰는 건 편집할 회차 하나의 기록뿐입니다.
//
// 그래서 회차는 항상 받고(작아서 부담이 없고 목록이 최신이어야 합니다),
// 전체 기록은 그것이 실제로 필요한 조회 화면 셋에서만 받습니다.
// 조회 화면이 보여주는 범위는 예전과 똑같습니다.
async function runLessonJournalLoad(key, worker) {
  const journal = state.lessonJournal;
  if (state.user?.role !== "admin") return false;
  if (journal.loadPromises[key]) return journal.loadPromises[key];
  journal.loading = true;
  const promise = (async () => {
    try {
      await worker(journal);
      if (journal.feedback.type === "error") journal.feedback = { type: "", text: "" };
      return true;
    } catch (error) {
      journal.feedback = {
        type: "error",
        text: `수업일지 데이터를 불러오지 못했습니다. Supabase에 apply-lesson-journal.sql을 먼저 적용했는지 확인해주세요. (${error.message})`,
      };
      return false;
    } finally {
      if (journal.loadPromises[key] === promise) journal.loadPromises[key] = null;
      // 회차와 기록을 동시에 받을 수 있으므로, 남은 작업이 있으면 계속 켜둡니다.
      journal.loading = Object.values(journal.loadPromises).some(Boolean);
    }
  })();
  journal.loadPromises[key] = promise;
  return promise;
}

async function loadLessonJournalSessions(force = false) {
  const journal = state.lessonJournal;
  if (journal.sessionsLoaded && !force) return true;
  return runLessonJournalLoad("sessions", async () => {
    journal.sessions = supabaseClient
      ? (await fetchAllSupabaseRows("class_sessions", "session_date", false)).map(normalizeClassSession)
      : (state.data.classSessions || []).map(normalizeClassSession);
    journal.sessionsLoaded = true;
  });
}

// 조회 화면 셋은 전 기간을 훑습니다. 학생별 화면의 학생 목록은 기록에서
// "명단에 없는 과거 학생"을 찾아내고, 요약과 날짜별은 기간 필터가 비면
// 전체를 집계합니다. 그래서 여기서는 범위를 줄이지 않고 전부 받습니다.
// 화면에 보이는 내용을 조용히 바꾸지 않기 위해서입니다.
async function loadLessonJournalRecords(force = false) {
  const journal = state.lessonJournal;
  if (journal.recordsLoaded && !force) return true;
  return runLessonJournalLoad("records", async () => {
    journal.records = supabaseClient
      ? (await fetchAllSupabaseRows("student_lesson_records", "created_at", true)).map(normalizeStudentLessonRecord)
      : (state.data.studentLessonRecords || []).map(normalizeStudentLessonRecord);
    journal.recordsLoaded = true;
  });
}

// 작성 화면에서 기존 일지를 열 때는 그 회차의 기록만 있으면 됩니다.
async function loadLessonJournalSessionRecords(sessionId) {
  const journal = state.lessonJournal;
  if (journal.recordsLoaded || !sessionId) return true;
  return runLessonJournalLoad(`session:${sessionId}`, async () => {
    let rows;
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from("student_lesson_records")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      rows = (data || []).map(normalizeStudentLessonRecord);
    } else {
      rows = (state.data.studentLessonRecords || [])
        .map(normalizeStudentLessonRecord)
        .filter((record) => record.sessionId === sessionId);
    }
    // 같은 회차를 다시 열 수 있으므로 겹치는 기록은 새 값으로 갈아끼웁니다.
    journal.records = [...journal.records.filter((record) => record.sessionId !== sessionId), ...rows];
  });
}

function lessonJournalRoster(classId) {
  const selectedClass = state.data.classes.find((item) => item.id === classId);
  const classSnapshot = selectedClass?.name || "";
  const gradeSnapshot = classGradeLevel(selectedClass) || "미지정";
  return activeStudents()
    .filter((student) => student.classId === classId)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
    .map((student) => ({
      id: "",
      sessionId: "",
      studentId: student.id,
      studentNameSnapshot: student.name,
      schoolSnapshot: student.school || "",
      classNameSnapshot: classSnapshot,
      gradeSnapshot,
      attendanceStatus: "present",
      homeworkAchievement: "pending",
      memo: "",
    }));
}

function buildNewLessonJournalDraft(classId = "") {
  const resolvedClassId = state.data.classes.some((item) => item.id === classId)
    ? classId
    : state.data.classes[0]?.id || "";
  const selectedClass = state.data.classes.find((item) => item.id === resolvedClassId);
  return {
    sessionId: "",
    classId: resolvedClassId,
    sessionDate: isoDate(new Date()),
    title: "",
    lessonMemo: "",
    classNameSnapshot: selectedClass?.name || "",
    gradeSnapshot: classGradeLevel(selectedClass) || "미지정",
    records: lessonJournalRoster(resolvedClassId),
  };
}

function ensureLessonJournalDraft() {
  if (!state.lessonJournal.draft) state.lessonJournal.draft = buildNewLessonJournalDraft();
  return state.lessonJournal.draft;
}

function confirmDiscardLessonJournalDraft() {
  return !state.lessonJournal?.dirty
    || confirm("저장하지 않은 수업일지 입력 내용이 있습니다. 이동하면 입력 내용이 사라집니다. 계속할까요?");
}

function markLessonJournalDirty() {
  if (!state.lessonJournal.saving) state.lessonJournal.dirty = true;
}

async function setLessonJournalView(view) {
  const allowed = ["write", "date", "student", "summary"];
  if (!allowed.includes(view) || state.lessonJournal.view === view) return;
  if (state.lessonJournal.view === "write" && state.lessonJournal.dirty) {
    if (!confirmDiscardLessonJournalDraft()) return;
    state.lessonJournal.dirty = false;
    state.lessonJournal.draft = null;
  }
  state.lessonJournal.view = view;
  state.lessonJournal.feedback = { type: "", text: "" };
  if (view === "write") {
    render();
    return;
  }
  // 조회 화면 셋만 전체 기록이 필요합니다.
  // 먼저 호출해야 journal.loading이 켜져서 render가 안내 문구를 그립니다.
  const pending = loadLessonJournalRecords();
  render();
  await pending;
  render();
}

function updateLessonJournalDraftField(field, value) {
  const draft = ensureLessonJournalDraft();
  if (!["sessionDate", "title", "lessonMemo"].includes(field) || draft[field] === value) return;
  draft[field] = value;
  markLessonJournalDirty();
}

function changeLessonJournalClass(classId) {
  const draft = ensureLessonJournalDraft();
  if (draft.sessionId || draft.classId === classId) return;
  if (state.lessonJournal.dirty && !confirm("반을 변경하면 현재 학생별 입력 내용이 초기화됩니다. 계속할까요?")) {
    render();
    return;
  }
  const nextDraft = buildNewLessonJournalDraft(classId);
  nextDraft.sessionDate = draft.sessionDate;
  nextDraft.title = draft.title;
  nextDraft.lessonMemo = draft.lessonMemo;
  state.lessonJournal.draft = nextDraft;
  state.lessonJournal.dirty = true;
  state.lessonJournal.feedback = { type: "", text: "" };
  render();
}

function setLessonJournalRecordValue(index, field, value) {
  const draft = ensureLessonJournalDraft();
  const record = draft.records[index];
  const allowed = field === "attendanceStatus"
    ? LESSON_ATTENDANCE_OPTIONS.map(([id]) => id)
    : LESSON_HOMEWORK_OPTIONS.map(([id]) => id);
  if (!record || !["attendanceStatus", "homeworkAchievement"].includes(field) || !allowed.includes(value) || record[field] === value) return;
  record[field] = value;
  markLessonJournalDirty();
  render();
}

function updateLessonJournalRecordMemo(index, value) {
  const record = ensureLessonJournalDraft().records[index];
  if (!record || record.memo === value) return;
  record.memo = value;
  markLessonJournalDirty();
}

function setLessonJournalAllPresent() {
  const records = ensureLessonJournalDraft().records;
  let changed = false;
  records.forEach((record) => {
    if (record.attendanceStatus !== "present") {
      record.attendanceStatus = "present";
      changed = true;
    }
  });
  if (changed) markLessonJournalDirty();
  render();
}

function setLessonJournalAllHomeworkNotRecorded() {
  const records = ensureLessonJournalDraft().records;
  let changed = false;
  records.forEach((record) => {
    if (record.homeworkAchievement !== "not_recorded") {
      record.homeworkAchievement = "not_recorded";
      changed = true;
    }
  });
  if (changed) markLessonJournalDirty();
  render();
}

function resetLessonJournalDraft() {
  if (state.lessonJournal.dirty && !confirmDiscardLessonJournalDraft()) return;
  state.lessonJournal.draft = buildNewLessonJournalDraft();
  state.lessonJournal.dirty = false;
  state.lessonJournal.feedback = { type: "", text: "" };
  state.lessonJournal.view = "write";
  render();
}

function setLessonJournalDraftFromSession(sessionId, keepCurrentView = false) {
  const session = state.lessonJournal.sessions.find((item) => item.id === sessionId);
  if (!session) return false;
  const currentView = state.lessonJournal.view;
  const records = state.lessonJournal.records
    .filter((item) => item.sessionId === sessionId)
    .sort((a, b) => a.studentNameSnapshot.localeCompare(b.studentNameSnapshot, "ko"))
    .map((item) => ({ ...item }));
  state.lessonJournal.draft = {
    sessionId: session.id,
    classId: session.classId,
    sessionDate: session.sessionDate,
    title: session.title,
    lessonMemo: session.lessonMemo || "",
    classNameSnapshot: session.classNameSnapshot,
    gradeSnapshot: session.gradeSnapshot,
    records,
  };
  state.lessonJournal.dirty = false;
  state.lessonJournal.view = keepCurrentView ? currentView : "write";
  return true;
}

async function loadLessonJournalForEdit(sessionId) {
  if (!sessionId) return;
  if (state.lessonJournal.dirty && !confirmDiscardLessonJournalDraft()) return;
  // 전체 기록을 받지 않았다면 이 회차 것만 받아옵니다.
  await loadLessonJournalSessionRecords(sessionId);
  if (!setLessonJournalDraftFromSession(sessionId)) {
    state.lessonJournal.feedback = { type: "error", text: "선택한 수업일지를 찾을 수 없습니다." };
  } else {
    state.lessonJournal.feedback = { type: "", text: "" };
  }
  render();
}

function setLessonJournalFilter(section, field, value) {
  const filters = state.lessonJournal.filters[section];
  if (!filters || !(field in filters)) return;
  filters[field] = value;
  // 조건이 바뀌면 목록 자체가 달라지므로 첫 쪽으로 돌아갑니다.
  if (field !== "page" && "page" in filters) filters.page = 1;
  render();
}

// 날짜별 조회는 조건에 맞는 수업일지를 전부 그렸습니다. 한 회차마다 학생
// 표가 통째로 붙으므로, 필터 없이 열면 몇 년치가 한 번에 DOM에 들어갑니다.
// 쪽수 제한은 여기서만 두고, 실제 보정은 렌더에서 합니다(§3-1과 같은 이유로
// 그리는 도중에 상태를 바꾸지 않습니다).
function changeLessonJournalDatePage(delta) {
  const filters = state.lessonJournal.filters.date;
  filters.page = Math.max(1, (Number(filters.page) || 1) + Number(delta || 0));
  render();
}

async function saveLessonJournal(event) {
  event.preventDefault();
  const journal = state.lessonJournal;
  if (journal.saving) return;
  const draft = ensureLessonJournalDraft();
  if (!draft.sessionDate || !draft.classId || !draft.title.trim()) {
    journal.feedback = { type: "error", text: "수업 날짜, 대상 반, 수업 제목을 모두 입력해주세요." };
    render();
    return;
  }
  if (!draft.records.length) {
    journal.feedback = { type: "error", text: "선택한 반에 기록할 재학 학생이 없습니다." };
    render();
    return;
  }

  const records = draft.records.map((record) => ({
    student_id: record.studentId,
    attendance_status: record.attendanceStatus,
    homework_achievement: record.homeworkAchievement,
    memo: record.memo.trim(),
  }));
  journal.saving = true;
  journal.feedback = { type: "", text: "" };
  render();

  let storageCommitted = false;
  try {
    let savedSessionId = draft.sessionId;
    if (supabaseClient) {
      const { data, error } = await supabaseClient.rpc("admin_save_lesson_journal", {
        p_session_id: draft.sessionId || null,
        p_class_id: draft.classId,
        p_session_date: draft.sessionDate,
        p_title: draft.title.trim(),
        p_lesson_memo: draft.lessonMemo.trim(),
        p_records: records,
      });
      if (error) throw error;
      savedSessionId = data;
      draft.sessionId = savedSessionId;
    } else if (draft.sessionId) {
      const previousSessions = state.data.classSessions || [];
      const previousRecords = state.data.studentLessonRecords || [];
      const nextSessions = structuredClone(state.data.classSessions || []);
      const nextRecords = structuredClone(state.data.studentLessonRecords || []);
      const session = nextSessions.find((item) => item.id === draft.sessionId);
      if (!session) throw new Error("수정할 수업일지를 찾을 수 없습니다.");
      draft.records.forEach((record) => {
        const saved = nextRecords.find((item) => item.sessionId === draft.sessionId
          && (item.studentId === record.studentId || item.studentIdSnapshot === record.studentId));
        if (!saved) throw new Error(`${record.studentNameSnapshot} 학생의 기존 기록을 찾을 수 없습니다.`);
      });
      Object.assign(session, {
        sessionDate: draft.sessionDate,
        title: draft.title.trim(),
        lessonMemo: draft.lessonMemo.trim(),
        updatedAt: new Date().toISOString(),
      });
      draft.records.forEach((record) => {
        const saved = nextRecords.find((item) => item.sessionId === draft.sessionId
          && (item.studentId === record.studentId || item.studentIdSnapshot === record.studentId));
        Object.assign(saved, {
          attendanceStatus: record.attendanceStatus,
          homeworkAchievement: record.homeworkAchievement,
          memo: record.memo.trim(),
          updatedAt: new Date().toISOString(),
        });
      });
      state.data.classSessions = nextSessions;
      state.data.studentLessonRecords = nextRecords;
      try {
        saveDemoData();
      } catch (error) {
        state.data.classSessions = previousSessions;
        state.data.studentLessonRecords = previousRecords;
        throw error;
      }
    } else {
      const previousSessions = state.data.classSessions || [];
      const previousRecords = state.data.studentLessonRecords || [];
      const nextSessions = structuredClone(previousSessions);
      const nextRecords = structuredClone(previousRecords);
      const now = new Date().toISOString();
      savedSessionId = uid("session-");
      const session = {
        id: savedSessionId,
        classId: draft.classId,
        classIdSnapshot: draft.classId,
        sessionDate: draft.sessionDate,
        title: draft.title.trim(),
        lessonMemo: draft.lessonMemo.trim(),
        classNameSnapshot: draft.classNameSnapshot,
        gradeSnapshot: draft.gradeSnapshot,
        createdAt: now,
        updatedAt: now,
      };
      nextSessions.push(session);
      draft.records.forEach((record) => {
        nextRecords.push({
          id: uid("lesson-record-"),
          sessionId: savedSessionId,
          studentId: record.studentId,
          studentIdSnapshot: record.studentId,
          studentNameSnapshot: record.studentNameSnapshot,
          schoolSnapshot: record.schoolSnapshot,
          classNameSnapshot: draft.classNameSnapshot,
          gradeSnapshot: draft.gradeSnapshot,
          attendanceStatus: record.attendanceStatus,
          homeworkAchievement: record.homeworkAchievement,
          memo: record.memo.trim(),
          createdAt: now,
          updatedAt: now,
        });
      });
      state.data.classSessions = nextSessions;
      state.data.studentLessonRecords = nextRecords;
      try {
        saveDemoData();
      } catch (error) {
        state.data.classSessions = previousSessions;
        state.data.studentLessonRecords = previousRecords;
        throw error;
      }
      draft.sessionId = savedSessionId;
    }

    storageCommitted = true;
    journal.dirty = false;
    journal.saving = false;
    // 회차 목록은 방금 저장한 건이 보이도록 항상 다시 받습니다.
    // 기록은 이미 전체를 받아둔 경우에만 통째로 갱신하고,
    // 그렇지 않으면 방금 저장한 회차 것만 받습니다.
    const reloaded = await loadLessonJournalSessions(true);
    if (reloaded) {
      if (journal.recordsLoaded) await loadLessonJournalRecords(true);
      else await loadLessonJournalSessionRecords(savedSessionId);
    }
    if (!reloaded || !setLessonJournalDraftFromSession(savedSessionId)) {
      journal.feedback = {
        type: "error",
        text: "저장은 완료됐지만 목록을 새로 불러오지 못했습니다. 다시 저장하지 말고 수업일지 메뉴를 다시 열어 확인해주세요.",
      };
      render();
      return;
    }
    journal.feedback = {
      type: "success",
      text: `${draft.records.length}명의 수업 기록을 한 번에 저장했습니다.`,
    };
    render();
  } catch (error) {
    journal.saving = false;
    journal.feedback = {
      type: "error",
      text: storageCommitted
        ? `저장은 완료됐지만 화면 갱신 중 오류가 발생했습니다. 다시 저장하지 말고 메뉴를 다시 열어 확인해주세요. (${error.message})`
        : `수업일지를 저장하지 못했습니다. 어떤 기록도 반영되지 않았습니다. (${error.message})`,
    };
    render();
  }
}

function lessonJournalFeedbackMarkup() {
  const feedback = state.lessonJournal.feedback;
  if (!feedback?.text) return "";
  return `<div class="notice lesson-journal-notice ${feedback.type === "success" ? "success" : "error"}">${h(feedback.text)}</div>`;
}

function lessonJournalChoiceGroup(index, field, options, selected, label) {
  return `
    <div class="lesson-choice-group" role="group" aria-label="${h(label)}">
      ${options.map(([value, text]) => `
        <button type="button" class="${selected === value ? "active" : ""}" aria-pressed="${selected === value}" onclick="setLessonJournalRecordValue(${index}, '${field}', '${value}')">${text}</button>
      `).join("")}
    </div>
  `;
}

function lessonJournalStudentRow(record, index, mobile = false) {
  const attendance = lessonJournalChoiceGroup(index, "attendanceStatus", LESSON_ATTENDANCE_OPTIONS, record.attendanceStatus, `${record.studentNameSnapshot} 출결`);
  const homework = lessonJournalChoiceGroup(index, "homeworkAchievement", LESSON_HOMEWORK_OPTIONS, record.homeworkAchievement, `${record.studentNameSnapshot} 숙제 성취도`);
  const memo = `<textarea rows="${mobile ? 3 : 2}" aria-label="${h(record.studentNameSnapshot)} 개별 메모" placeholder="개별 메모 (선택)" oninput="updateLessonJournalRecordMemo(${index}, this.value)">${h(record.memo)}</textarea>`;
  if (mobile) {
    return `
      <article class="lesson-student-card">
        <header><strong>${h(record.studentNameSnapshot)}</strong><span>${h(record.schoolSnapshot || "학교 미등록")}</span></header>
        <div><label>출결</label>${attendance}</div>
        <div><label>숙제 성취도</label>${homework}</div>
        <div><label>개별 메모</label>${memo}</div>
      </article>
    `;
  }
  return `
    <tr>
      <td><strong>${h(record.studentNameSnapshot)}</strong></td>
      <td>${h(record.schoolSnapshot || "-")}</td>
      <td>${attendance}</td>
      <td>${homework}</td>
      <td>${memo}</td>
    </tr>
  `;
}

function lessonJournalWriteView() {
  const draft = ensureLessonJournalDraft();
  const journal = state.lessonJournal;
  const recentSessions = journal.sessions.slice().sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  return `
    ${lessonJournalFeedbackMarkup()}
    <div class="lesson-journal-loadbar">
      <div class="field">
        <label for="lessonExistingSession">기존 수업일지 불러오기</label>
        <select id="lessonExistingSession" onchange="loadLessonJournalForEdit(this.value)">
          <option value="">수업일지를 선택하세요</option>
          ${recentSessions.map((session) => `<option value="${session.id}" ${draft.sessionId === session.id ? "selected" : ""}>${h(session.sessionDate)} · ${h(session.classNameSnapshot)} · ${h(session.title)}</option>`).join("")}
        </select>
      </div>
      <button type="button" class="ghost-btn" onclick="resetLessonJournalDraft()">새 수업일지</button>
    </div>
    <form class="lesson-journal-form" onsubmit="saveLessonJournal(event)">
      <section class="form-panel lesson-journal-meta">
        <div class="lesson-journal-form-title">
          <div><h2>${draft.sessionId ? "수업일지 수정" : "새 수업일지 작성"}</h2><p>${draft.sessionId ? "저장 당시 학생과 반 스냅샷을 유지한 채 기록을 수정합니다." : "선택한 반의 현재 재학 학생 전체를 불러옵니다."}</p></div>
          ${journal.dirty ? `<span class="lesson-unsaved">저장되지 않은 변경사항</span>` : ""}
        </div>
        <div class="lesson-meta-grid">
          <div class="field"><label>수업 날짜</label><input type="date" required value="${h(draft.sessionDate)}" oninput="updateLessonJournalDraftField('sessionDate', this.value)" /></div>
          <div class="field"><label>대상 반</label><select required onchange="changeLessonJournalClass(this.value)" ${draft.sessionId ? "disabled" : ""}>${lessonJournalClassFilterOptions(draft.classId, false, draft, false)}</select></div>
          <div class="field lesson-title-field"><label>수업 제목 또는 수업 내용</label><input required value="${h(draft.title)}" placeholder="예: 수학 I 지수함수 문제풀이" oninput="updateLessonJournalDraftField('title', this.value)" /></div>
          <div class="field lesson-memo-field"><label>전체 수업 메모</label><textarea rows="2" placeholder="전체 수업에 대한 메모 (선택)" oninput="updateLessonJournalDraftField('lessonMemo', this.value)">${h(draft.lessonMemo)}</textarea></div>
        </div>
      </section>
      <section class="table-panel lesson-roster-panel">
        <div class="lesson-roster-head">
          <div><h2>${h(draft.classNameSnapshot || className(draft.classId))}</h2><p>${h(draft.gradeSnapshot)} · ${draft.records.length}명</p></div>
          <div class="lesson-roster-actions">
            <button type="button" class="small-btn" onclick="setLessonJournalAllPresent()">전체 출석</button>
            <button type="button" class="small-btn" onclick="setLessonJournalAllHomeworkNotRecorded()">숙제 전체 미기록</button>
          </div>
        </div>
        ${draft.records.length ? `
          <div class="lesson-entry-desktop table-scroll">
            <table class="lesson-entry-table">
              <thead><tr><th>학생</th><th>학교</th><th>출결</th><th>숙제 성취도</th><th>메모</th></tr></thead>
              <tbody>${draft.records.map((record, index) => lessonJournalStudentRow(record, index)).join("")}</tbody>
            </table>
          </div>
          <div class="lesson-entry-mobile">${draft.records.map((record, index) => lessonJournalStudentRow(record, index, true)).join("")}</div>
          <div class="lesson-save-bar">
            <p>출결과 숙제 성취도는 서로 독립적으로 저장됩니다.</p>
            <button class="primary-btn" type="submit" ${journal.saving ? "disabled" : ""}>${journal.saving ? "저장 중..." : "전체 저장"}</button>
          </div>
        ` : `<div class="empty">선택한 반에 재학 중인 학생이 없습니다.</div>`}
      </section>
    </form>
  `;
}

function lessonJournalAttendanceBadge(value) {
  return `<span class="lesson-status attendance-${h(value)}">${h(lessonAttendanceLabel(value))}</span>`;
}

function lessonJournalHomeworkBadge(value) {
  return `<span class="lesson-status homework-${h(String(value).toLowerCase())}">${h(lessonHomeworkLabel(value))}</span>`;
}

function lessonJournalRecordsTable(records) {
  return `
    <div class="table-scroll lesson-record-table-wrap">
      <table class="lesson-record-table">
        <thead><tr><th>학생</th><th>학교</th><th>출결</th><th>숙제 성취도</th><th>개별 메모</th></tr></thead>
        <tbody>${records.map((record) => `
          <tr>
            <td><strong>${h(record.studentNameSnapshot)}</strong></td>
            <td>${h(record.schoolSnapshot || "-")}</td>
            <td>${lessonJournalAttendanceBadge(record.attendanceStatus)}</td>
            <td>${lessonJournalHomeworkBadge(record.homeworkAchievement)}</td>
            <td class="lesson-memo-cell">${h(record.memo || "-")}</td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

function lessonJournalClassChoices() {
  const choices = new Map(state.data.classes.map((item) => [item.id, item.name]));
  state.lessonJournal.sessions.forEach((session) => {
    if (session.classId && !choices.has(session.classId)) choices.set(session.classId, `${session.classNameSnapshot} (과거 기록)`);
  });
  return [...choices].map(([id, name]) => ({ id, name }));
}

function lessonJournalClassFilterOptions(selected, includeAll = true, draft = null, includeHistorical = true) {
  const choices = includeHistorical
    ? lessonJournalClassChoices()
    : state.data.classes.map((item) => ({ id: item.id, name: item.name }));
  if (draft?.classId && !choices.some((item) => item.id === draft.classId)) {
    choices.push({ id: draft.classId, name: `${draft.classNameSnapshot || "삭제된 반"} (과거 기록)` });
  }
  return `${includeAll ? `<option value="">전체 반</option>` : ""}${choices.map((item) => `<option value="${item.id}" ${selected === item.id ? "selected" : ""}>${h(item.name)}</option>`).join("")}`;
}

function lessonJournalClassDisplayName(classId) {
  return lessonJournalClassChoices().find((item) => item.id === classId)?.name || "반 미지정";
}

function lessonJournalDateView() {
  const filters = state.lessonJournal.filters.date;
  const sessions = state.lessonJournal.sessions
    .filter((session) => !filters.from || session.sessionDate >= filters.from)
    .filter((session) => !filters.to || session.sessionDate <= filters.to)
    .filter((session) => !filters.classId || session.classId === filters.classId)
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  // 쪽 번호는 상태에 있지만 보정값은 지역 변수로만 씁니다.
  // 필터를 좁혀 총 쪽수가 줄어도 그리는 도중에 상태를 바꾸지 않습니다.
  const totalPages = Math.max(1, Math.ceil(sessions.length / LESSON_JOURNAL_DATE_PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(filters.page) || 1), totalPages);
  const pageStart = (page - 1) * LESSON_JOURNAL_DATE_PAGE_SIZE;
  const pageSessions = sessions.slice(pageStart, pageStart + LESSON_JOURNAL_DATE_PAGE_SIZE);
  const rangeStart = sessions.length ? pageStart + 1 : 0;
  const rangeEnd = sessions.length ? pageStart + pageSessions.length : 0;

  // 이 쪽에 그릴 회차의 기록만 모읍니다. 예전에는 전체 기록을 모아놓고
  // 전부 그렸습니다.
  const pageSessionIds = new Set(pageSessions.map((session) => session.id));
  const recordsBySession = new Map();
  state.lessonJournal.records.forEach((record) => {
    if (!pageSessionIds.has(record.sessionId)) return;
    if (!recordsBySession.has(record.sessionId)) recordsBySession.set(record.sessionId, []);
    recordsBySession.get(record.sessionId).push(record);
  });
  return `
    ${lessonJournalFeedbackMarkup()}
    <section class="table-panel lesson-query-panel">
      <div class="lesson-journal-filters">
        <div class="field"><label>시작일</label><input type="date" value="${h(filters.from)}" onchange="setLessonJournalFilter('date', 'from', this.value)" /></div>
        <div class="field"><label>종료일</label><input type="date" value="${h(filters.to)}" onchange="setLessonJournalFilter('date', 'to', this.value)" /></div>
        <div class="field"><label>반</label><select onchange="setLessonJournalFilter('date', 'classId', this.value)">${lessonJournalClassFilterOptions(filters.classId)}</select></div>
      </div>
      <div class="lesson-query-count">${rangeStart}–${rangeEnd} / 총 ${sessions.length}건</div>
      <div class="lesson-session-list">
        ${pageSessions.length ? pageSessions.map((session) => {
          const records = (recordsBySession.get(session.id) || [])
            .slice()
            .sort((a, b) => a.studentNameSnapshot.localeCompare(b.studentNameSnapshot, "ko"));
          return `
            <article class="lesson-session-card">
              <header>
                <div><time>${h(formatDateWithWeekday(session.sessionDate))}</time><h2>${h(session.title)}</h2><p>${h(session.classNameSnapshot)} · ${h(session.gradeSnapshot)} · ${records.length}명</p></div>
                <button type="button" class="small-btn" onclick="loadLessonJournalForEdit(${js(session.id)})">수정</button>
              </header>
              ${session.lessonMemo ? `<div class="lesson-overall-memo"><strong>전체 수업 메모</strong><p>${h(session.lessonMemo)}</p></div>` : ""}
              ${lessonJournalRecordsTable(records)}
            </article>
          `;
        }).join("") : `<div class="empty">조건에 맞는 수업일지가 없습니다.</div>`}
      </div>
      ${totalPages > 1 ? `
        <div class="list-pagination" aria-label="수업일지 페이지 이동">
          <span>${rangeStart}–${rangeEnd} / 총 ${sessions.length}건</span>
          <div>
            <button type="button" class="small-btn" onclick="changeLessonJournalDatePage(-1)" ${page <= 1 ? "disabled" : ""}>이전</button>
            <strong>${page} / ${totalPages} 페이지</strong>
            <button type="button" class="small-btn" onclick="changeLessonJournalDatePage(1)" ${page >= totalPages ? "disabled" : ""}>다음</button>
          </div>
        </div>` : ""}
    </section>
  `;
}

function lessonJournalStudentChoiceList() {
  const choices = new Map(state.data.students.map((student) => [student.id, {
    id: student.id,
    name: student.name,
    school: student.school || "",
    suffix: isStudentArchived(student) ? " (보관)" : "",
  }]));
  state.lessonJournal.records.forEach((record) => {
    if (record.studentId && !choices.has(record.studentId)) {
      choices.set(record.studentId, {
        id: record.studentId,
        name: record.studentNameSnapshot,
        school: record.schoolSnapshot || "",
        suffix: " (과거 기록)",
      });
    }
  });
  return [...choices.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function lessonJournalStudentOptions(selected) {
  return lessonJournalStudentChoiceList()
    .map((student) => `<option value="${student.id}" ${selected === student.id ? "selected" : ""}>${h(student.name)} · ${h(student.school || "학교 미등록")}${student.suffix}</option>`)
    .join("");
}

function lessonJournalStudentView() {
  const filters = state.lessonJournal.filters.student;
  const studentChoices = lessonJournalStudentChoiceList();
  // 고른 학생이 목록에 없으면 이번 그리기에만 첫 학생을 씁니다.
  // 예전에는 filters.studentId에 써넣었습니다. 그리는 행위가 상태를 바꾸면
  // 재렌더 순서에 따라 선생님이 고른 값이 조용히 사라집니다.
  const studentId = studentChoices.some((student) => student.id === filters.studentId)
    ? filters.studentId
    : studentChoices[0]?.id || "";
  const sessionMap = new Map(state.lessonJournal.sessions.map((session) => [session.id, session]));
  const items = state.lessonJournal.records
    .filter((record) => record.studentId === studentId)
    .map((record) => ({ record, session: sessionMap.get(record.sessionId) }))
    .filter((item) => item.session)
    .filter((item) => !filters.from || item.session.sessionDate >= filters.from)
    .filter((item) => !filters.to || item.session.sessionDate <= filters.to)
    .sort((a, b) => b.session.sessionDate.localeCompare(a.session.sessionDate));
  return `
    ${lessonJournalFeedbackMarkup()}
    <section class="table-panel lesson-query-panel">
      <div class="lesson-journal-filters student">
        <div class="field"><label>학생</label><select onchange="setLessonJournalFilter('student', 'studentId', this.value)"><option value="">학생 선택</option>${lessonJournalStudentOptions(studentId)}</select></div>
        <div class="field"><label>시작일</label><input type="date" value="${h(filters.from)}" onchange="setLessonJournalFilter('student', 'from', this.value)" /></div>
        <div class="field"><label>종료일</label><input type="date" value="${h(filters.to)}" onchange="setLessonJournalFilter('student', 'to', this.value)" /></div>
      </div>
      <div class="lesson-query-count">총 ${items.length}건</div>
      <div class="lesson-student-history">
        ${items.length ? items.map(({ record, session }) => `
          <article>
            <div class="lesson-history-date"><time>${h(formatDateWithWeekday(session.sessionDate))}</time><span>${h(record.classNameSnapshot)} · ${h(record.gradeSnapshot)}</span></div>
            <div class="lesson-history-main"><strong>${h(session.title)}</strong><div>${lessonJournalAttendanceBadge(record.attendanceStatus)}${lessonJournalHomeworkBadge(record.homeworkAchievement)}</div></div>
            <p>${h(record.memo || "개별 메모 없음")}</p>
            <small>${h(record.studentNameSnapshot)} · ${h(record.schoolSnapshot || "학교 미등록")} (저장 당시 정보)</small>
          </article>
        `).join("") : `<div class="empty">조건에 맞는 학생 수업 기록이 없습니다.</div>`}
      </div>
    </section>
  `;
}

function emptyLessonSummary(record) {
  return {
    studentId: record.studentId,
    studentName: record.studentNameSnapshot,
    school: record.schoolSnapshot || "",
    attendance: { present: 0, late: 0, absent: 0, early_leave: 0, makeup: 0 },
    homework: { A: 0, B: 0, C: 0, pending: 0, not_recorded: 0 },
  };
}

function lessonJournalSummaryView() {
  const filters = state.lessonJournal.filters.summary;
  const classChoices = lessonJournalClassChoices();
  // 고른 반이 목록에 없으면 이번 그리기에만 첫 반을 씁니다. 상태에 쓰지 않습니다.
  const classId = classChoices.some((item) => item.id === filters.classId)
    ? filters.classId
    : classChoices[0]?.id || "";
  const sessions = state.lessonJournal.sessions
    .filter((session) => !classId || session.classId === classId)
    .filter((session) => !filters.from || session.sessionDate >= filters.from)
    .filter((session) => !filters.to || session.sessionDate <= filters.to);
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const matchingRecords = state.lessonJournal.records
    .filter((record) => sessionMap.has(record.sessionId))
    .sort((a, b) => sessionMap.get(b.sessionId).sessionDate.localeCompare(sessionMap.get(a.sessionId).sessionDate));
  const summaryMap = new Map();
  matchingRecords.forEach((record) => {
    if (!summaryMap.has(record.studentId)) summaryMap.set(record.studentId, emptyLessonSummary(record));
    const summary = summaryMap.get(record.studentId);
    if (summary.attendance[record.attendanceStatus] != null) summary.attendance[record.attendanceStatus] += 1;
    if (summary.homework[record.homeworkAchievement] != null) summary.homework[record.homeworkAchievement] += 1;
  });
  const rows = [...summaryMap.values()].sort((a, b) => a.studentName.localeCompare(b.studentName, "ko"));
  return `
    ${lessonJournalFeedbackMarkup()}
    <section class="table-panel lesson-query-panel">
      <div class="lesson-journal-filters">
        <div class="field"><label>시작일</label><input type="date" value="${h(filters.from)}" onchange="setLessonJournalFilter('summary', 'from', this.value)" /></div>
        <div class="field"><label>종료일</label><input type="date" value="${h(filters.to)}" onchange="setLessonJournalFilter('summary', 'to', this.value)" /></div>
        <div class="field"><label>반</label><select onchange="setLessonJournalFilter('summary', 'classId', this.value)">${lessonJournalClassFilterOptions(classId, false)}</select></div>
      </div>
      <div class="lesson-query-count">${h(lessonJournalClassDisplayName(classId))} · 수업 ${sessions.length}회 · 학생 ${rows.length}명</div>
      ${rows.length ? `
        <div class="table-scroll lesson-summary-wrap">
          <table class="lesson-summary-table">
            <thead><tr><th>학생</th><th>학교</th><th>출석</th><th>지각</th><th>결석</th><th>조퇴</th><th>보강</th><th>A</th><th>B</th><th>C</th><th>제출 전</th><th>미기록</th></tr></thead>
            <tbody>${rows.map((row) => `<tr><td><strong>${h(row.studentName)}</strong></td><td>${h(row.school || "-")}</td><td>${row.attendance.present}</td><td>${row.attendance.late}</td><td>${row.attendance.absent}</td><td>${row.attendance.early_leave}</td><td>${row.attendance.makeup}</td><td>${row.homework.A}</td><td>${row.homework.B}</td><td>${row.homework.C}</td><td>${row.homework.pending}</td><td>${row.homework.not_recorded}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      ` : `<div class="empty">조건에 맞는 수업일지가 없습니다.</div>`}
    </section>
  `;
}

function manageLessonJournal() {
  if (state.user?.role !== "admin") return "";
  const journal = state.lessonJournal;
  const tabs = [
    ["write", "수업일지 작성"],
    ["date", "날짜별 조회"],
    ["student", "학생별 조회"],
    ["summary", "반별 요약"],
  ];
  const content = journal.loading
    ? `<div class="empty">수업일지를 불러오는 중입니다.</div>`
    : journal.view === "date"
      ? lessonJournalDateView()
      : journal.view === "student"
        ? lessonJournalStudentView()
        : journal.view === "summary"
          ? lessonJournalSummaryView()
          : lessonJournalWriteView();
  return `
    <section class="section-head">
      <div><h1>수업일지</h1><p class="subtle">반 학생 전체의 출결, 숙제 성취도와 메모를 기록하고 다시 조회합니다.</p></div>
    </section>
    <div class="sub-tabs lesson-journal-tabs">${tabs.map(([id, label]) => `<button type="button" class="${journal.view === id ? "active" : ""}" onclick="setLessonJournalView('${id}')">${label}</button>`).join("")}</div>
    ${content}
  `;
}

function weeklyReportEmptyAggregate() {
  return {
    recordCount: 0,
    attendance: { present: 0, late: 0, absent: 0, early_leave: 0, makeup: 0 },
    homework: { A: 0, B: 0, C: 0, pending: 0, not_recorded: 0 },
  };
}

function weeklyReportAggregate(entries) {
  const aggregate = weeklyReportEmptyAggregate();
  entries.forEach((entry) => {
    const record = entry.record || entry;
    aggregate.recordCount += 1;
    if (Object.prototype.hasOwnProperty.call(aggregate.attendance, record.attendanceStatus)) aggregate.attendance[record.attendanceStatus] += 1;
    if (Object.prototype.hasOwnProperty.call(aggregate.homework, record.homeworkAchievement)) aggregate.homework[record.homeworkAchievement] += 1;
  });
  return aggregate;
}

function weeklyReportFormatDate(value, withWeekday = false) {
  const day = weeklyReportIsoToDay(value);
  if (day == null) return "-";
  const date = new Date(day * WEEKLY_REPORT_DAY_MS);
  const base = `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;
  return withWeekday ? `${base} ${["일", "월", "화", "수", "목", "금", "토"][date.getUTCDay()]}요일` : base;
}

function weeklyReportFormatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: WEEKLY_REPORT_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function weeklyReportReviewedAt(value) {
  const text = String(value || "").trim();
  if (!text || !/(Z|[+-]\d{2}:\d{2})$/i.test(text)) return null;
  const instant = Date.parse(text);
  if (!Number.isFinite(instant)) return null;
  return { instant, dateKey: weeklyReportSeoulDateKey(new Date(instant)) };
}

function normalizeWeeklyPhotoAssignment(item) {
  return {
    id: item.id,
    homeworkId: item.homework_id || item.homeworkId,
    studentId: item.student_id || item.studentId,
    assignedClassId: item.assigned_class_id || item.assignedClassId || "",
    assignedClassName: item.assigned_class_name || item.assignedClassName || "",
    status: item.status || "",
    reviewedAt: item.reviewed_at || item.reviewedAt || null,
  };
}

async function loadWeeklyReportRecordRows(sessionIds) {
  const rows = [];
  for (let index = 0; index < sessionIds.length; index += 80) {
    const ids = sessionIds.slice(index, index + 80);
    const batch = await fetchAllRows(() => supabaseClient
      .from("student_lesson_records")
      .select("id, session_id, student_id, student_id_snapshot, student_name_snapshot, school_snapshot, class_name_snapshot, grade_snapshot, attendance_status, homework_achievement, memo, created_at, updated_at")
      .in("session_id", ids)
      .order("created_at", { ascending: true }));
    rows.push(...batch);
  }
  return rows;
}

async function loadWeeklyReportHomeworkRows(homeworkIds) {
  const rows = [];
  for (let index = 0; index < homeworkIds.length; index += 100) {
    const ids = homeworkIds.slice(index, index + 100);
    const batch = await fetchAllRows(() => supabaseClient
      .from("photo_homeworks")
      .select("id, title")
      .in("id", ids)
      .order("created_at", { ascending: true }));
    rows.push(...batch);
  }
  return rows;
}

const WEEKLY_REPORT_SESSION_COLUMNS = "id, class_id, class_id_snapshot, session_date, title, lesson_memo, class_name_snapshot, grade_snapshot, created_at, updated_at";

// 학생별 "최근 3회 기록"은 이번 주 이전 수업까지 거슬러 올라갑니다.
// 그래서 이번 주 세션만으로는 부족하고, 반별로 직전 수업 몇 회가 더 필요합니다.
// 한 주에 두세 번 수업하므로 10회면 3건을 채우기에 넉넉하고,
// 하한 없이 전체를 받던 예전과 달리 받아오는 양이 고정됩니다.
const WEEKLY_REPORT_PRIOR_SESSION_LIMIT = 10;

async function loadWeeklyReportPriorSessions(classIds, grades, start) {
  const results = await Promise.all(classIds.map((classId) => supabaseClient
    .from("class_sessions")
    .select(WEEKLY_REPORT_SESSION_COLUMNS)
    .eq("class_id_snapshot", classId)
    .in("grade_snapshot", grades)
    .lt("session_date", start)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(WEEKLY_REPORT_PRIOR_SESSION_LIMIT)));
  const rows = [];
  results.forEach(({ data, error }) => {
    if (error) throw error;
    rows.push(...(data || []));
  });
  return rows;
}

// 대상 반은 반 설정에서 읽습니다.
//
// 예전에는 반 이름 문자열("고1 수학 A반", "고1 수학 M반")로 찾았습니다.
// 반 이름은 관리자가 언제든 바꿀 수 있는 값인데, 한 글자만 달라져도
// 반을 못 찾아 보고서 전체가 막혔습니다.
//
// 학년도 "고1"로 박혀 있었습니다. 이제 대상 반들의 학년에서 끌어냅니다.
// 그대로 뒀다면 고2 반을 대상으로 켜는 순간 조용히 빠졌을 겁니다.
function weeklyReportTargetRoster() {
  const targetClasses = state.data.classes.filter((item) => item.weeklyReportTarget);
  if (!targetClasses.length) {
    throw new Error("주간 보고서 대상 반이 없습니다. 관리자 화면의 반 관리에서 대상 반을 지정해주세요.");
  }
  const grades = [...new Set(targetClasses.map((item) => classGradeLevel(item)).filter(Boolean))];
  const classIds = new Set(targetClasses.map((item) => item.id));
  const students = activeStudents().filter((student) => classIds.has(student.classId));
  return { targetClasses, students, grades };
}

async function loadWeeklyReportSources(range) {
  const roster = weeklyReportTargetRoster();
  if (!supabaseClient) {
    return {
      ...roster,
      sessions: (state.lessonJournal.sessions.length ? state.lessonJournal.sessions : state.data.classSessions || []).map(normalizeClassSession),
      records: (state.lessonJournal.records.length ? state.lessonJournal.records : state.data.studentLessonRecords || []).map(normalizeStudentLessonRecord),
      photoAssignments: (state.photoData.assignments || []).map(normalizeWeeklyPhotoAssignment),
      photoHomeworks: state.photoData.homeworks || [],
    };
  }

  const classIds = roster.targetClasses.map((item) => item.id);
  // 예전에는 하한 없이 .lte(effectiveEnd)만 걸어서, 한 주짜리 보고서를 만들려고
  // 개설 이후 전체 세션과 그에 딸린 모든 학생 기록을 받았습니다. 주가 지날수록
  // 받아오는 양이 계속 늘어나는 구조였습니다.
  //
  // 주간 집계에 필요한 건 이번 주 세션뿐이고, 그 이전 세션은 학생별
  // "최근 3회 기록" 표시에만 쓰이므로 반별 직전 몇 회로 제한합니다.
  const [weekSessionRows, priorSessionRows] = await Promise.all([
    fetchAllRows(() => supabaseClient
      .from("class_sessions")
      .select(WEEKLY_REPORT_SESSION_COLUMNS)
      .in("class_id_snapshot", classIds)
      .in("grade_snapshot", roster.grades)
      .gte("session_date", range.start)
      .lte("session_date", range.effectiveEnd)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })),
    loadWeeklyReportPriorSessions(classIds, roster.grades, range.start),
  ]);
  const sessionRows = [...weekSessionRows, ...priorSessionRows];
  const sessions = sessionRows.map(normalizeClassSession);
  const recordRows = sessionRows.length ? await loadWeeklyReportRecordRows(sessionRows.map((item) => item.id)) : [];

  const studentIds = roster.students.map((item) => item.id);
  let assignmentRows = [];
  if (studentIds.length) {
    const reviewedFrom = `${range.start}T00:00:00+09:00`;
    const reviewedBefore = `${weeklyReportAddDays(range.effectiveEnd, 1)}T00:00:00+09:00`;
    const [weeklyRows, missingReviewedRows] = await Promise.all([
      fetchAllRows(() => supabaseClient
        .from("photo_homework_assignments")
        .select("id, homework_id, student_id, assigned_class_id, assigned_class_name, status, reviewed_at, created_at")
        .in("student_id", studentIds)
        .eq("status", "completed")
        .gte("reviewed_at", reviewedFrom)
        .lt("reviewed_at", reviewedBefore)
        .order("reviewed_at", { ascending: true })),
      fetchAllRows(() => supabaseClient
        .from("photo_homework_assignments")
        .select("id, homework_id, student_id, assigned_class_id, assigned_class_name, status, reviewed_at, created_at")
        .in("student_id", studentIds)
        .eq("status", "completed")
        .is("reviewed_at", null)
        .order("created_at", { ascending: true })),
    ]);
    assignmentRows = [...weeklyRows, ...missingReviewedRows];
  }
  const photoAssignments = assignmentRows.map(normalizeWeeklyPhotoAssignment);
  const homeworkIds = [...new Set(photoAssignments.map((item) => item.homeworkId).filter(Boolean))];
  const photoHomeworks = homeworkIds.length ? await loadWeeklyReportHomeworkRows(homeworkIds) : [];

  return {
    ...roster,
    sessions,
    records: recordRows.map(normalizeStudentLessonRecord),
    photoAssignments,
    photoHomeworks,
  };
}

function weeklyReportIssueMetrics(student) {
  const attendance = student.week.attendance;
  const homework = student.week.homework;
  const attendanceIssueCount = attendance.absent + attendance.makeup + attendance.early_leave + attendance.late;
  const homeworkIssueCount = homework.C + homework.pending;
  const signalKindCount = [attendance.absent, attendance.makeup, attendance.early_leave, attendance.late, homework.C, homework.pending]
    .filter((count) => count > 0).length;
  return {
    attendanceIssueCount,
    homeworkIssueCount,
    signalKindCount,
    immediate: attendance.absent > 0
      || attendance.makeup > 0
      || attendance.early_leave > 0
      || attendance.late >= 2
      || homeworkIssueCount >= 2
      || (attendanceIssueCount > 0 && homeworkIssueCount > 0),
  };
}

function compareWeeklyReportProblems(a, b) {
  const aa = a.week.attendance;
  const ba = b.week.attendance;
  const ah = a.week.homework;
  const bh = b.week.homework;
  return Number(ba.absent + ba.makeup > 0) - Number(aa.absent + aa.makeup > 0)
    || (ba.absent + ba.makeup) - (aa.absent + aa.makeup)
    || Number(ba.early_leave > 0) - Number(aa.early_leave > 0)
    || ba.early_leave - aa.early_leave
    || b.signalKindCount - a.signalKindCount
    || bh.C - ah.C
    || bh.pending - ah.pending
    || ba.late - aa.late
    || String(b.latestWeekSessionDate).localeCompare(String(a.latestWeekSessionDate))
    || WEEKLY_REPORT_COLLATOR.compare(a.name, b.name)
    || WEEKLY_REPORT_COLLATOR.compare(a.school || "", b.school || "")
    || String(a.studentId).localeCompare(String(b.studentId));
}

function weeklyReportAttendanceIssueCount(aggregate) {
  const attendance = aggregate.attendance;
  return attendance.late + attendance.absent + attendance.early_leave + attendance.makeup;
}

function weeklyReportLessonPraise(student) {
  if (!student.hasWeekRecord) return null;
  const recent = weeklyReportAggregate(student.recent3Records);
  const recentEvaluable = recent.homework.A + recent.homework.B + recent.homework.C + recent.homework.pending;
  const weeklyEvaluable = student.week.homework.A + student.week.homework.B + student.week.homework.C + student.week.homework.pending;
  const steady = recentEvaluable >= 2
    && recent.homework.A >= 2
    && recent.homework.C === 0
    && recent.homework.pending === 0
    && weeklyReportAttendanceIssueCount(recent) === 0;
  const weekly = weeklyEvaluable >= 1
    && student.week.homework.A === weeklyEvaluable
    && weeklyReportAttendanceIssueCount(student.week) === 0;
  if (!steady && !weekly) return null;
  return { ...student, praiseType: steady ? "steady" : "weekly", recent };
}

function compareWeeklyReportLessonPraise(a, b) {
  return Number(a.praiseType === "weekly") - Number(b.praiseType === "weekly")
    || b.recent.homework.A - a.recent.homework.A
    || b.week.homework.A - a.week.homework.A
    || b.week.attendance.present - a.week.attendance.present
    || WEEKLY_REPORT_COLLATOR.compare(a.name, b.name)
    || String(a.studentId).localeCompare(String(b.studentId));
}

function groupWeeklyReportEntries(entries) {
  const grouped = new Map();
  entries.forEach((entry) => {
    const list = grouped.get(entry.record.studentId);
    if (list) list.push(entry);
    else grouped.set(entry.record.studentId, [entry]);
  });
  return grouped;
}

function calculateWeeklyReport(range, sources) {
  const classIds = new Set(sources.targetClasses.map((item) => item.id));
  const studentById = new Map(sources.students.map((item) => [item.id, item]));
  // 학년도 대상 반에서 끌어냅니다. "고1"로 박아두면 대상 반의 학년이
  // 바뀌거나 다른 학년 반을 대상으로 켤 때 조용히 빠집니다.
  const targetGrades = new Set(sources.grades || []);
  const sessionById = new Map(sources.sessions
    .filter((session) => classIds.has(session.classId) && targetGrades.has(session.gradeSnapshot) && session.sessionDate <= range.effectiveEnd)
    .map((session) => [session.id, session]));
  const entries = sources.records.map((record) => ({ record, session: sessionById.get(record.sessionId) }))
    .filter((entry) => entry.session && studentById.has(entry.record.studentId));
  const validAttendance = new Set(LESSON_ATTENDANCE_OPTIONS.map(([value]) => value));
  const validHomework = new Set(LESSON_HOMEWORK_OPTIONS.map(([value]) => value));
  const weekEntries = entries.filter((entry) => entry.session.sessionDate >= range.start && entry.session.sessionDate <= range.effectiveEnd);
  // 이번 주 기록만 셉니다. 예전에는 불러온 전체 기록을 훑었는데, 조회 범위가
  // 개설 이후 전체였기 때문에 몇 년 전 이상 데이터가 이번 주 보고서에
  // 계속 따라붙었습니다.
  const invalidLessonRecordCount = weekEntries.filter((entry) => !validAttendance.has(entry.record.attendanceStatus) || !validHomework.has(entry.record.homeworkAchievement)).length;

  // 학생마다 전체 기록을 훑던 것을 한 번의 그룹핑으로 바꿉니다.
  // 예전에는 filter가 학생 수만큼 반복돼 O(학생 × 전체기록)이었습니다.
  const entriesByStudentId = groupWeeklyReportEntries(entries);
  const weekEntriesByStudentId = groupWeeklyReportEntries(weekEntries);
  const classById = new Map(sources.targetClasses.map((item) => [item.id, item]));

  const studentSummaries = sources.students.map((student) => {
    const studentEntries = entriesByStudentId.get(student.id) || [];
    const weeklyEntries = weekEntriesByStudentId.get(student.id) || [];
    const recent3Records = studentEntries.slice().sort((a, b) => b.session.sessionDate.localeCompare(a.session.sessionDate)
      || String(b.record.createdAt || "").localeCompare(String(a.record.createdAt || ""))).slice(0, 3);
    const classItem = classById.get(student.classId);
    return {
      studentId: student.id,
      name: student.name,
      school: student.school || "",
      classId: student.classId,
      className: classItem?.name || "미지정 반",
      hasWeekRecord: weeklyEntries.length > 0,
      latestWeekSessionDate: weeklyEntries.reduce((latest, entry) => entry.session.sessionDate > latest ? entry.session.sessionDate : latest, ""),
      week: weeklyReportAggregate(weeklyEntries),
      recent3Records,
    };
  });
  const summaryByStudentId = new Map(studentSummaries.map((item) => [item.studentId, item]));

  const immediate = [];
  const observation = [];
  studentSummaries.forEach((student) => {
    if (!student.hasWeekRecord) return;
    const metrics = weeklyReportIssueMetrics(student);
    if (metrics.immediate) immediate.push({ ...student, ...metrics });
    else if (student.week.attendance.late === 1 || student.week.homework.C === 1 || student.week.homework.pending === 1) {
      observation.push({ ...student, ...metrics });
    }
  });
  immediate.sort(compareWeeklyReportProblems);
  observation.sort(compareWeeklyReportProblems);

  const lessonPraise = studentSummaries.map(weeklyReportLessonPraise).filter(Boolean).sort(compareWeeklyReportLessonPraise);
  const homeworkTitleById = new Map(sources.photoHomeworks.map((item) => [item.id, item.title || "사진 숙제"]));
  const photoDataIssues = sources.photoAssignments.filter((assignment) => assignment.status === "completed" && !weeklyReportReviewedAt(assignment.reviewedAt));
  const weeklyPhotoByStudent = new Map();
  sources.photoAssignments.forEach((assignment) => {
    if (assignment.status !== "completed" || !studentById.has(assignment.studentId)) return;
    const reviewed = weeklyReportReviewedAt(assignment.reviewedAt);
    if (!reviewed || reviewed.dateKey < range.start || reviewed.dateKey > range.effectiveEnd) return;
    const student = studentById.get(assignment.studentId);
    const current = weeklyPhotoByStudent.get(student.id) || {
      studentId: student.id,
      name: student.name,
      school: student.school || "",
      classId: student.classId,
      className: classById.get(student.classId)?.name || "미지정 반",
      completedCount: 0,
      firstCompletedAt: Number.POSITIVE_INFINITY,
      assignments: [],
    };
    current.completedCount += 1;
    current.firstCompletedAt = Math.min(current.firstCompletedAt, reviewed.instant);
    current.assignments.push({ ...assignment, title: homeworkTitleById.get(assignment.homeworkId) || "사진 숙제" });
    weeklyPhotoByStudent.set(student.id, current);
  });
  const photoPraise = [...weeklyPhotoByStudent.values()]
    .filter((item) => summaryByStudentId.get(item.studentId)?.hasWeekRecord)
    .sort((a, b) => b.completedCount - a.completedCount
      || a.firstCompletedAt - b.firstCompletedAt
      || WEEKLY_REPORT_COLLATOR.compare(a.name, b.name)
      || String(a.studentId).localeCompare(String(b.studentId)));

  const classReadiness = sources.targetClasses.map((classItem) => {
    const classSessions = [...sessionById.values()].filter((session) => session.classId === classItem.id);
    const periodSessions = classSessions.filter((session) => session.sessionDate >= range.start && session.sessionDate <= range.effectiveEnd);
    const periodSessionIds = new Set(periodSessions.map((session) => session.id));
    const periodEntries = weekEntries.filter((entry) => periodSessionIds.has(entry.session.id));
    const studentsWithRecord = new Set(periodEntries.map((entry) => entry.record.studentId));
    return {
      classId: classItem.id,
      className: classItem.name,
      studentCount: sources.students.filter((student) => student.classId === classItem.id).length,
      latestSessionDate: classSessions.reduce((latest, session) => session.sessionDate > latest ? session.sessionDate : latest, ""),
      latestPeriodSessionDate: periodSessions.reduce((latest, session) => session.sessionDate > latest ? session.sessionDate : latest, ""),
      periodSessionCount: periodSessions.length,
      periodRecordCount: periodEntries.length,
      studentsWithRecordCount: studentsWithRecord.size,
      unavailable: periodSessions.length === 0 || periodEntries.length === 0,
    };
  });
  const photoClassParticipation = sources.targetClasses.map((classItem) => ({
    classId: classItem.id,
    className: classItem.name,
    count: [...weeklyPhotoByStudent.values()].filter((item) => item.classId === classItem.id).length,
  }));
  const studentsWithRecordCount = studentSummaries.filter((item) => item.hasWeekRecord).length;
  const eligibleStudents = studentSummaries.filter((item) => item.hasWeekRecord);

  return {
    range,
    targetStudentCount: studentSummaries.length,
    studentsWithRecordCount,
    studentsWithoutRecordCount: Math.max(0, studentSummaries.length - studentsWithRecordCount),
    weekRecordCount: weekEntries.length,
    classReadiness,
    immediate,
    observation,
    lessonPraise,
    photoPraise,
    photoClassParticipation,
    multiplePhotoCompletionCount: photoPraise.filter((item) => item.completedCount >= 2).length,
    photoDataIssueCount: photoDataIssues.length,
    invalidLessonRecordCount,
    overall: {
      absentOrMakeup: eligibleStudents.filter((item) => item.week.attendance.absent + item.week.attendance.makeup > 0).length,
      lateOrEarlyLeave: eligibleStudents.filter((item) => item.week.attendance.late + item.week.attendance.early_leave > 0).length,
      homeworkIssue: eligibleStudents.filter((item) => item.week.homework.C + item.week.homework.pending > 0).length,
      lessonPraise: lessonPraise.length,
      photoPraise: photoPraise.length,
      unavailableClasses: classReadiness.filter((item) => item.unavailable).length,
      studentsWithoutRecord: Math.max(0, studentSummaries.length - studentsWithRecordCount),
    },
  };
}

function setWeeklyReportStart(value) {
  if (state.user?.role !== "admin") return;
  const range = weeklyReportRangeContaining(value);
  if (!range) {
    state.weeklyReport.error = "오늘 이후의 주간은 선택할 수 없습니다.";
    render();
    return;
  }
  state.weeklyReport.requestId += 1;
  state.weeklyReport.periodStart = range.start;
  state.weeklyReport.periodEnd = range.end;
  state.weeklyReport.loading = false;
  state.weeklyReport.loaded = false;
  state.weeklyReport.result = null;
  state.weeklyReport.error = "";
  state.weeklyReport.expanded = { immediate: false, observation: false };
  render();
}

async function setWeeklyReportPreset(type) {
  if (state.user?.role !== "admin") return;
  const range = type === "current" ? currentWeeklyReportRange() : defaultCompletedWeeklyReportRange();
  state.weeklyReport.requestId += 1;
  state.weeklyReport.periodStart = range.start;
  state.weeklyReport.periodEnd = range.end;
  state.weeklyReport.loading = false;
  state.weeklyReport.loaded = false;
  state.weeklyReport.result = null;
  state.weeklyReport.error = "";
  state.weeklyReport.expanded = { immediate: false, observation: false };
  await generateWeeklyReport();
}

function toggleWeeklyReportList(type) {
  if (!Object.prototype.hasOwnProperty.call(state.weeklyReport.expanded, type)) return;
  state.weeklyReport.expanded[type] = !state.weeklyReport.expanded[type];
  render();
}

async function generateWeeklyReport(event) {
  event?.preventDefault();
  if (state.user?.role !== "admin" || state.weeklyReport.loading) return;
  const range = weeklyReportRangeContaining(state.weeklyReport.periodStart);
  if (!range) {
    state.weeklyReport.error = "보고 기간을 확인해주세요. 오늘이 포함된 주간까지만 조회할 수 있습니다.";
    render();
    return;
  }
  state.weeklyReport.periodStart = range.start;
  state.weeklyReport.periodEnd = range.end;
  const requestId = ++state.weeklyReport.requestId;
  state.weeklyReport.loading = true;
  state.weeklyReport.error = "";
  render();
  try {
    const sources = await loadWeeklyReportSources(range);
    if (requestId !== state.weeklyReport.requestId || state.view !== "weekly-report") return;
    state.weeklyReport.result = calculateWeeklyReport(range, sources);
    state.weeklyReport.loaded = true;
  } catch (error) {
    if (requestId !== state.weeklyReport.requestId || state.view !== "weekly-report") return;
    state.weeklyReport.result = null;
    state.weeklyReport.loaded = false;
    state.weeklyReport.error = `주간 보고서를 만들지 못했습니다. (${error.message})`;
  } finally {
    if (requestId === state.weeklyReport.requestId && state.view === "weekly-report") {
      state.weeklyReport.loading = false;
      render();
    }
  }
}

function weeklyReportIssueReason(item) {
  const attendance = item.week.attendance;
  const homework = item.week.homework;
  return [
    attendance.absent ? `결석 ${attendance.absent}회` : "",
    attendance.makeup ? `보강 ${attendance.makeup}회` : "",
    attendance.early_leave ? `조퇴 ${attendance.early_leave}회` : "",
    homework.C ? `숙제 C ${homework.C}회` : "",
    homework.pending ? `숙제 제출 전 ${homework.pending}회` : "",
    attendance.late ? `지각 ${attendance.late}회` : "",
  ].filter(Boolean).join(", ");
}

function weeklyReportRecommendedAction(item) {
  const attendance = item.week.attendance;
  if ((attendance.absent + attendance.makeup + attendance.early_leave > 0) && item.homeworkIssueCount > 0) return "수업 참여 사유와 과제 수행 상황을 함께 확인";
  if (attendance.absent + attendance.makeup > 0) return "정규 수업 불참 사유와 보강 상황 확인";
  if (attendance.early_leave > 0) return "조퇴 사유와 다음 수업 참여 상태 확인";
  if (item.homeworkIssueCount > 0) return "과제 이해도와 다음 제출 계획 확인";
  return "지각 원인과 다음 수업 시간 확인";
}

function weeklyReportPersonCard(item, type) {
  if (type === "photo") {
    const titles = [...new Set(item.assignments.map((assignment) => assignment.title))];
    const titleText = titles.slice(0, 2).join(", ") + (titles.length > 2 ? ` 외 ${titles.length - 2}개` : "");
    return `
      <article class="weekly-report-person praise">
        <div class="weekly-report-person-head"><div><strong>${h(item.name)}</strong><span>${h(item.school || "학교 미등록")} · ${h(item.className)}</span></div><span class="weekly-report-badge photo">사진 숙제</span></div>
        <p><b>근거</b> 추가 사진 숙제 ${item.completedCount}개 완료${titleText ? ` · ${h(titleText)}` : ""}</p>
        <p><b>이번 주 첫 완료</b> ${h(weeklyReportFormatDateTime(item.firstCompletedAt))}</p>
        <p><b>추천 행동</b> 자발적으로 추가 학습한 점을 구체적으로 칭찬</p>
      </article>
    `;
  }
  if (type === "praise") {
    const steady = item.praiseType === "steady";
    const reason = steady
      ? `최근 3회 중 숙제 A ${item.recent.homework.A}회, 출결 문제 없음`
      : `이번 주 평가 가능한 숙제 ${item.week.homework.A}회 모두 A, 출결 문제 없음`;
    return `
      <article class="weekly-report-person praise">
        <div class="weekly-report-person-head"><div><strong>${h(item.name)}</strong><span>${h(item.school || "학교 미등록")} · ${h(item.className)}</span></div><span class="weekly-report-badge praise">${steady ? "꾸준한 칭찬" : "이번 주 칭찬"}</span></div>
        <p><b>근거</b> ${h(reason)}</p>
        <p><b>추천 행동</b> 수업 중 구체적으로 칭찬</p>
      </article>
    `;
  }
  const observation = type === "observation";
  return `
    <article class="weekly-report-person ${observation ? "observe" : "urgent"}">
      <div class="weekly-report-person-head"><div><strong>${h(item.name)}</strong><span>${h(item.school || "학교 미등록")} · ${h(item.className)}</span></div><span class="weekly-report-badge ${observation ? "observe" : "urgent"}">${observation ? "관찰" : "바로 확인"}</span></div>
      <p><b>근거</b> ${h(weeklyReportIssueReason(item))}</p>
      <p><b>추천 행동</b> ${h(weeklyReportRecommendedAction(item))}</p>
    </article>
  `;
}

function weeklyReportLimitedList(items, type, limit, expandedKey) {
  if (!items.length) return `<div class="weekly-report-empty">해당하는 학생이 없습니다.</div>`;
  const expanded = expandedKey ? state.weeklyReport.expanded[expandedKey] : false;
  const visible = expanded ? items : items.slice(0, limit);
  const extra = Math.max(0, items.length - limit);
  return `
    <div class="weekly-report-people">${visible.map((item) => weeklyReportPersonCard(item, type)).join("")}</div>
    ${extra ? `<button type="button" class="weekly-report-more" onclick="toggleWeeklyReportList('${expandedKey}')">${expanded ? "우선 명단만 보기" : `전체 보기 · 추가 ${extra}명`}</button>` : ""}
  `;
}

function weeklyReportReadinessMarkup(report) {
  return `
    <section class="weekly-report-section readiness">
      <div class="weekly-report-section-title"><div><span>DATA STATUS</span><h2>데이터 준비 상태</h2></div></div>
      <div class="weekly-report-number-grid">
        <article><strong>${report.targetStudentCount}명</strong><span>전체 분석 대상</span></article>
        <article><strong>${report.studentsWithRecordCount}명</strong><span>개인 기록 있음</span></article>
        <article><strong>${report.studentsWithoutRecordCount}명</strong><span>개인 기록 없음</span></article>
        <article><strong>${report.weekRecordCount}건</strong><span>기간 내 학생 기록</span></article>
      </div>
      <div class="weekly-report-class-grid">
        ${report.classReadiness.map((item) => `
          <article class="${item.unavailable ? "unavailable" : ""}">
            <div><strong>${h(item.className)}</strong><span class="weekly-report-badge ${item.unavailable ? "unknown" : "ready"}">${item.unavailable ? "판단 불가" : "기록 확인"}</span></div>
            <p>최근 입력 ${h(item.latestSessionDate ? weeklyReportFormatDate(item.latestSessionDate) : "없음")} · 기간 내 수업 ${item.periodSessionCount}회</p>
            <p>학생 기록 ${item.periodRecordCount}건 · 기록 확인 학생 ${item.studentsWithRecordCount}/${item.studentCount}명</p>
          </article>
        `).join("")}
      </div>
      <p class="weekly-report-note">개인 기록이 없는 학생은 결석이나 입력 누락으로 단정하지 않고, 바로 확인·관찰·칭찬 판정에서 제외했습니다.</p>
      ${report.photoDataIssueCount || report.invalidLessonRecordCount ? `
        <div class="weekly-report-data-warning">
          <strong>데이터 확인 항목</strong>
          ${report.photoDataIssueCount ? `<span>완료 상태이지만 완료 처리 시각이 없는 사진 숙제 ${report.photoDataIssueCount}건</span>` : ""}
          ${report.invalidLessonRecordCount ? `<span>허용되지 않은 상태값이 있는 이번 주 수업 기록 ${report.invalidLessonRecordCount}건</span>` : ""}
        </div>
      ` : ""}
    </section>
  `;
}

function weeklyReportResultMarkup(report) {
  const provisional = report.range.status === "provisional";
  return `
    <section class="weekly-report-hero ${provisional ? "provisional" : "complete"}">
      <div><span class="weekly-report-status">${provisional ? "잠정 결과" : "완료된 주간 보고서"}</span><h2>${h(weeklyReportFormatDate(report.range.start, true))} ~ ${h(weeklyReportFormatDate(report.range.end, true))}</h2></div>
      <p>${provisional ? `${weeklyReportFormatDate(report.range.effectiveEnd)}까지 입력된 기록으로 계산했습니다.` : "화요일부터 월요일까지 완료된 7일을 집계했습니다."}</p>
    </section>
    ${weeklyReportReadinessMarkup(report)}
    <section class="weekly-report-section urgent-section">
      <div class="weekly-report-section-title"><div><span>CHECK NOW</span><h2>바로 확인</h2></div><strong>총 ${report.immediate.length}명 · 우선 ${Math.min(5, report.immediate.length)}명</strong></div>
      ${weeklyReportLimitedList(report.immediate, "immediate", 5, "immediate")}
    </section>
    <section class="weekly-report-section observe-section">
      <div class="weekly-report-section-title"><div><span>WATCH</span><h2>이번 주 관찰</h2></div><strong>총 ${report.observation.length}명 · 우선 ${Math.min(10, report.observation.length)}명</strong></div>
      ${weeklyReportLimitedList(report.observation, "observation", 10, "observation")}
    </section>
    <section class="weekly-report-section praise-section">
      <div class="weekly-report-section-title"><div><span>ENCOURAGE</span><h2>출결·일반 숙제 칭찬</h2></div><strong>후보 ${report.lessonPraise.length}명 · 최대 5명 표시</strong></div>
      ${weeklyReportLimitedList(report.lessonPraise.slice(0, 5), "praise", 5, "")}
    </section>
    <section class="weekly-report-section photo-praise-section">
      <div class="weekly-report-section-title"><div><span>EXTRA WORK</span><h2>사진 숙제 칭찬</h2></div><strong>완료 학생 ${report.photoPraise.length}명 · 여러 개 완료 ${report.multiplePhotoCompletionCount}명</strong></div>
      <div class="weekly-report-photo-participation">${report.photoClassParticipation.map((item) => `<span>${h(item.className)} 완료 참여 <strong>${item.count}명</strong></span>`).join("")}</div>
      ${report.photoPraise.length ? weeklyReportLimitedList(report.photoPraise.slice(0, 5), "photo", 5, "") : `<div class="weekly-report-empty">이번 주 사진 숙제 완료 학생 없음</div>`}
      <p class="weekly-report-note">사진 숙제 미제출·확인 대기·다시 풀기는 관심·관찰 대상에 포함하지 않았습니다.</p>
    </section>
    <section class="weekly-report-section overview-section">
      <div class="weekly-report-section-title"><div><span>SUMMARY</span><h2>이번 주 전체 요약</h2></div></div>
      <div class="weekly-report-summary-grid">
        <article><span>결석·보강 확인 필요</span><strong>${report.overall.absentOrMakeup}명</strong></article>
        <article><span>지각·조퇴 확인 필요</span><strong>${report.overall.lateOrEarlyLeave}명</strong></article>
        <article><span>일반 숙제 확인 필요</span><strong>${report.overall.homeworkIssue}명</strong></article>
        <article><span>출결·숙제 칭찬 후보</span><strong>${report.overall.lessonPraise}명</strong></article>
        <article><span>사진 숙제 칭찬 후보</span><strong>${report.overall.photoPraise}명</strong></article>
        <article><span>데이터 없는 반</span><strong>${report.overall.unavailableClasses}개</strong></article>
        <article><span>개인 기록 없음</span><strong>${report.overall.studentsWithoutRecord}명</strong></article>
      </div>
    </section>
  `;
}

function manageWeeklyReport() {
  if (state.user?.role !== "admin") return "";
  const reportState = state.weeklyReport;
  const current = currentWeeklyReportRange();
  return `
    <section class="section-head">
      <div><h1>주간 학생관리 보고서</h1><p class="subtle">고1 수학 A·M반에서 이번 주 바로 확인할 학생과 칭찬할 학생을 빠르게 찾습니다.</p></div>
    </section>
    <form class="weekly-report-controls" onsubmit="generateWeeklyReport(event)">
      <div class="field">
        <label for="weeklyReportStart">보고 주간 선택</label>
        <input id="weeklyReportStart" type="date" max="${h(weeklyReportSeoulDateKey())}" value="${h(reportState.periodStart)}" onchange="setWeeklyReportStart(this.value)" />
        <small>선택한 날짜가 속한 화요일~월요일 주간으로 자동 맞춥니다.</small>
      </div>
      <div class="weekly-report-period-preview"><span>집계 기간</span><strong>${h(weeklyReportFormatDate(reportState.periodStart, true))} ~ ${h(weeklyReportFormatDate(reportState.periodEnd, true))}</strong></div>
      <div class="weekly-report-control-actions">
        <button type="button" class="ghost-btn" onclick="setWeeklyReportPreset('complete')">최근 완료 주간</button>
        <button type="button" class="ghost-btn" onclick="setWeeklyReportPreset('current')" ${reportState.periodStart === current.start ? "disabled" : ""}>이번 주 진행 현황</button>
        <button type="submit" class="primary-btn" ${reportState.loading ? "disabled" : ""}>${reportState.loading ? "생성 중" : "보고서 생성"}</button>
      </div>
    </form>
    ${reportState.error ? `<div class="notice error weekly-report-error">${h(reportState.error)}</div>` : ""}
    ${reportState.loading ? `<div class="weekly-report-loading"><strong>주간 보고서를 만드는 중입니다.</strong><span>수업일지와 완료 처리된 사진 숙제만 안전하게 조회하고 있습니다.</span></div>` : ""}
    ${!reportState.loading && reportState.result ? weeklyReportResultMarkup(reportState.result) : ""}
  `;
}

function manageClasses() {
  const edit = state.edit?.type === "class" ? state.data.classes.find((item) => item.id === state.edit.id) : null;
  return adminCrudLayout({
    title: "반 관리",
    description: "학년과 반 이름을 지정해 반을 생성, 수정, 삭제합니다.",
    formTitle: edit ? "반 수정" : "새 반 등록",
    form: `
      <form onsubmit="saveClass(event)">
        <div class="field"><label>학년</label><select id="classGradeLevel" required>${gradeOptions(classGradeLevel(edit) || "고1")}</select></div>
        <div class="field"><label>반 이름</label><input id="className" required value="${h(edit?.name || "")}" /></div>
        <label class="remember-login">
          <input id="classWeeklyReportTarget" type="checkbox" ${edit?.weeklyReportTarget ? "checked" : ""} />
          <span>
            <strong>주간 보고서 대상</strong>
            <small>이 반의 출결·숙제 기록이 주간 보고서에 집계됩니다.</small>
          </span>
        </label>
        ${formButtons("class")}
      </form>
    `,
    table: tableMarkup(
      ["학년", "반 이름", "주간 보고서", "관리"],
      state.data.classes.map((item) => [
        h(classGradeLevel(item) || "미지정"),
        h(item.name),
        // 어느 반이 보고서에 잡히는지 목록에서 바로 보이게 합니다.
        item.weeklyReportTarget ? `<span class="badge">대상</span>` : `<span class="subtle">—</span>`,
        rowButtons(`editItem('class','${item.id}')`, `deleteItem('class','${item.id}')`),
      ]),
    ),
  });
}

function manageVideos() {
  const edit = state.edit?.type === "video" ? state.data.videos.find((item) => item.id === state.edit.id) : null;
  return adminCrudLayout({
    title: "영상 관리",
    description: "반별 수업 영상 링크를 등록합니다.",
    formTitle: edit ? "영상 수정" : "새 영상 등록",
    form: `
      <form onsubmit="saveVideo(event)">
        <div class="field"><label>반 이름</label>${classSelect("videoClassId", edit?.classId)}</div>
        <div class="field"><label>영상 제목</label><input id="videoTitle" required value="${h(edit?.title || "")}" /></div>
        <div class="field"><label>유튜브 일부공개 링크</label><input id="videoUrl" type="url" required value="${h(edit?.url || "")}" /></div>
        <div class="field"><label>등록일</label><input id="videoCreatedAt" type="date" required value="${edit?.createdAt || isoDate(new Date())}" /></div>
        ${formButtons("video")}
      </form>
    `,
    table: tableMarkup(
      ["반", "영상 제목", "등록일", "관리"],
      state.data.videos
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((item) => [
          `<span class="badge">${h(className(item.classId))}</span>`,
          `<a href="${h(item.url)}" target="_blank" rel="noopener">${h(item.title)}</a>`,
          item.createdAt,
          rowButtons(`editItem('video','${item.id}')`, `deleteItem('video','${item.id}')`),
        ]),
    ),
  });
}

function manageHomeworks() {
  const edit = state.edit?.type === "homework" ? state.data.homeworks.find((item) => item.id === state.edit.id) : null;
  const today = isoDate(new Date());
  const formDate = edit?.date || state.homeworkDraftDate || today;
  const showingPast = state.homeworkView === "past";
  const homeworks = state.data.homeworks
    .filter((item) => showingPast ? item.date < today : item.date >= today)
    .sort((a, b) => showingPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  return adminCrudLayout({
    title: "숙제 관리",
    description: "날짜, 숙제 내용, 반 이름을 입력합니다.",
    formTitle: edit ? "숙제 수정" : "새 숙제 등록",
    form: `
      <form onsubmit="saveHomework(event)">
        <div class="field"><label>날짜</label><input id="homeworkDate" type="date" required value="${formDate}" /></div>
        <div class="field"><label>반 이름</label>${classSelect("homeworkClassId", edit?.classId)}</div>
        <div class="field"><label>숙제 내용</label><textarea id="homeworkContent" required>${h(edit?.content || "")}</textarea></div>
        ${formButtons("homework")}
      </form>
    `,
    table: `
      <div class="homework-tabs" aria-label="숙제 기간 선택">
        <button class="${showingPast ? "" : "active"}" onclick="setHomeworkView('upcoming')">예정된 숙제</button>
        <button class="${showingPast ? "active" : ""}" onclick="setHomeworkView('past')">지난 숙제</button>
      </div>
      ${tableMarkup(
        ["날짜", "반", "숙제 내용", "관리"],
        homeworks
        .map((item) => [
          item.date,
          `<span class="badge">${h(className(item.classId))}</span>`,
          h(item.content),
          rowButtons(`editItem('homework','${item.id}')`, `deleteItem('homework','${item.id}')`),
        ]),
      )}
    `,
  });
}

function setHomeworkView(view) {
  state.homeworkView = view === "past" ? "past" : "upcoming";
  state.edit = null;
  state.message = "";
  render();
}

function manageStudents() {
  const edit = state.edit?.type === "student" ? state.data.students.find((item) => item.id === state.edit.id) : null;
  const grades = uniqueValues(state.data.classes.map((item) => classGradeLevel(item)));
  const archived = state.data.students.filter(isStudentArchived).sort((a,b)=>a.name.localeCompare(b.name,"ko"));
  return adminCrudLayout({
    title: "학생 계정 관리",
    description: "학생 정보를 등록하고, 비밀번호는 학생 상세 화면에서 별도로 재설정합니다.",
    formTitle: edit ? "학생 수정" : "새 학생 등록",
    form: `
      <form onsubmit="saveStudent(event)">
        <div class="field"><label>이름</label><input id="studentName" required value="${h(edit?.name || "")}" /></div>
        <div class="field"><label>학교</label><input id="studentSchool" required value="${h(edit?.school || "")}" /></div>
        <div class="field"><label>소속 반</label>${classSelect("studentClassId", edit?.classId)}</div>
        ${edit ? "" : `<div class="field"><label>초기 비밀번호</label><input id="studentPassword" type="password" autocomplete="new-password" required /></div>`}
        ${formButtons("student")}
      </form>
    `,
    table: `
      <div class="student-archive-toolbar">
        <span>재학 학생 ${activeStudents().length}명</span>
        <button class="small-btn" type="button" onclick="toggleArchivedStudents()">${state.showArchivedStudents?"재학 학생만 보기":`보관 학생 보기 (${archived.length})`}</button>
      </div>
      <div class="grade-roster-list">
        ${grades.map((grade) => studentRosterSection(grade)).join("")}
      </div>
      ${state.showArchivedStudents?archivedStudentList(archived):""}
    `,
  });
}

function studentRosterSection(grade) {
  const filters = studentFilterForGrade(grade);
  const classes = state.data.classes.filter((item) => classGradeLevel(item) === grade);
  const classIds = new Set(classes.map((item) => item.id));
  const students = activeStudents().filter((item) => classIds.has(item.classId));
  const schools = uniqueValues(students.map((item) => item.school));
  const filteredStudents = students.filter((item) => {
    if (filters.classIds.length && !filters.classIds.includes(item.classId)) return false;
    if (filters.schools.length && !filters.schools.includes(item.school)) return false;
    return true;
  });

  return `
    <section class="grade-roster">
      <div class="grade-roster-head">
        <div>
          <h2>${h(grade)} 명단</h2>
          <p class="subtle">${filteredStudents.length}명 표시 / 전체 ${students.length}명</p>
        </div>
        <button class="small-btn" onclick="resetStudentGradeFilters(${js(grade)})">필터 초기화</button>
      </div>
      <div class="check-filter-grid">
        <div class="check-filter-group">
          <strong>반별</strong>
          <div class="check-options">
            ${classes.map((item) => checkboxFilter(grade, "classIds", item.id, item.name, filters.classIds.includes(item.id))).join("")}
          </div>
        </div>
        <div class="check-filter-group">
          <strong>학교별</strong>
          ${schoolFilterSelect(grade, schools, filters.schools[0] || "")}
        </div>
      </div>
      ${studentRosterList(filteredStudents)}
    </section>
  `;
}

function studentRosterList(students) {
  if (!students.length) return `<div class="empty">등록된 학생이 없습니다.</div>`;
  return `
    <div class="student-list">
      ${students.map((item) => studentRosterItem(item)).join("")}
    </div>
  `;
}

function studentRosterItem(student) {
  const isOpen = state.openStudentId === student.id;
  return `
    <article class="student-row ${isOpen ? "open" : ""}">
      <button class="student-row-main" onclick="toggleStudentDetail('${student.id}')">
        <span>${h(student.name)}</span>
        <span class="badge">${h(student.school || "학교 미등록")}</span>
      </button>
      ${
        isOpen
          ? `
          <div class="student-detail">
            <dl>
              <div><dt>학교</dt><dd>${h(student.school || "-")}</dd></div>
              <div><dt>반</dt><dd>${h(className(student.classId))}</dd></div>
            </dl>
            <div class="row-actions">
              <button class="small-btn" onclick="openStudentRecords('${student.id}')">기록 관리</button>
              <button class="small-btn" onclick="editItem('student','${student.id}')">수정</button>
              <button class="danger-btn" onclick="archiveStudent('${student.id}')">보관</button>
            </div>
            <form class="password-reset-form" onsubmit="resetStudentPassword(event, '${student.id}')">
              <div class="field">
                <label for="studentPassword-${student.id}">새 비밀번호</label>
                <input id="studentPassword-${student.id}" type="password" autocomplete="new-password" required />
              </div>
              <button class="small-btn" type="submit">비밀번호 재설정</button>
            </form>
          </div>
        `
          : ""
      }
    </article>
  `;
}

function toggleArchivedStudents(){state.showArchivedStudents=!state.showArchivedStudents;state.openStudentId="";render();}

function archivedStudentList(students){
  return `<section class="archived-student-panel"><div class="grade-roster-head"><div><h2>보관 학생</h2><p class="subtle">성적·상담·특이사항 등 기존 기록은 그대로 유지됩니다.</p></div></div>${students.length?`<div class="student-list">${students.map(student=>`<article class="student-row archived"><div class="student-row-main"><span>${h(student.name)}</span><span class="badge">${h(student.school||"학교 미등록")} · ${h(className(student.classId))}</span></div><div class="student-detail archived-actions"><span class="subtle">보관일 ${formatDateTime(student.archivedAt)}</span><div class="row-actions"><button class="small-btn" onclick="openStudentRecords('${student.id}')">기록 보기</button><button class="small-btn" onclick="restoreStudent('${student.id}')">복원</button></div></div></article>`).join("")}</div>`:`<div class="empty">보관된 학생이 없습니다.</div>`}</section>`;
}

async function archiveStudent(studentId){
  const student=state.data.students.find(item=>item.id===studentId);
  if(!student||!confirm(`${student.name} 학생을 보관할까요? 로그인은 중지되며 성적·상담·특이사항 등 기존 기록은 삭제되지 않습니다.`))return;
  try{
    const archivedAt=new Date().toISOString();
    if(supabaseClient){const {error}=await supabaseClient.from("students").update({archived_at:archivedAt}).eq("id",studentId);if(error)throw error;await refreshData();}
    else{student.archivedAt=archivedAt;saveDemoData();}
    state.openStudentId="";state.edit=null;state.message="";render();
  }catch(error){state.message=error.message;render();}
}

async function restoreStudent(studentId){
  const student=state.data.students.find(item=>item.id===studentId);
  if(!student||!confirm(`${student.name} 학생을 재학 학생으로 복원할까요?`))return;
  try{
    if(supabaseClient){const {error}=await supabaseClient.from("students").update({archived_at:null}).eq("id",studentId);if(error)throw error;await refreshData();}
    else{student.archivedAt=null;saveDemoData();}
    state.openStudentId="";state.message="";render();
  }catch(error){state.message=error.message;render();}
}

function checkboxFilter(grade, type, value, label, checked) {
  return `
    <label class="check-pill">
      <input type="checkbox" ${checked ? "checked" : ""} onchange="toggleStudentFilter(${js(grade)}, ${js(type)}, ${js(value)})" />
      <span>${h(label)}</span>
    </label>
  `;
}

function schoolFilterSelect(grade, schools, selected) {
  if (!schools.length) return `<span class="subtle">등록된 학교가 없습니다.</span>`;
  return `
    <select class="school-filter-select" onchange="setStudentSchoolFilter(${js(grade)}, this.value)">
      <option value="">전체 학교</option>
      ${schools.map((school) => `<option value="${h(school)}" ${selected === school ? "selected" : ""}>${h(school)}</option>`).join("")}
    </select>
  `;
}

function openStudentRecords(studentId) {
  state.recordStudentId = studentId;
  state.recordFilters.studentId = studentId;
  state.view = "student-records";
  state.edit = null;
  state.message = "";
  render();
}

function schoolExamSlots() {
  return [
    { semester: "1학기", examType: "중간고사", label: "1학기 중간" },
    { semester: "1학기", examType: "기말고사", label: "1학기 기말" },
    { semester: "2학기", examType: "중간고사", label: "2학기 중간" },
    { semester: "2학기", examType: "기말고사", label: "2학기 기말" },
  ];
}

function schoolYearOptions(selected) {
  const current = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, index) => current + 1 - index)
    .map((year) => `<option value="${year}" ${Number(selected) === year ? "selected" : ""}>${year}학년도</option>`)
    .join("");
}

function gradeOptions(selected) {
  return ["고1", "고2", "고3"].map((grade) => `<option value="${grade}" ${selected === grade ? "selected" : ""}>${grade}</option>`).join("");
}

function schoolScoreClassOptions(gradeLevel, selected, includeAll = false) {
  const classes = state.data.classes.filter((item) => classGradeLevel(item) === gradeLevel);
  return `${includeAll ? `<option value="">전체 반</option>` : ""}${classes
    .map((item) => `<option value="${item.id}" ${selected === item.id ? "selected" : ""}>${h(item.name)}</option>`)
    .join("")}`;
}

function setSchoolScoreView(view) {
  state.schoolScoreView = ["bulk", "student", "compare"].includes(view) ? view : "bulk";
  state.message = "";
  render();
}

function setSchoolScoreCriterion(field, value) {
  if (!(field in state.schoolScoreCriteria)) return;
  state.schoolScoreCriteria[field] = ["schoolYear", "maxScore"].includes(field) ? Number(value) : value;
  if (field === "gradeLevel") state.schoolScoreCriteria.classId = "";
  state.message = "";
  render();
}

function setSchoolReportFilter(field, value) {
  if (!(field in state.schoolReportFilters)) return;
  state.schoolReportFilters[field] = field === "schoolYear" ? Number(value) : value;
  render();
}

function setSchoolCompareFilter(field, value) {
  if (!(field in state.schoolCompareFilters)) return;
  state.schoolCompareFilters[field] = field === "schoolYear" ? Number(value) : value;
  if (field === "gradeLevel") {
    state.schoolCompareFilters.classId = "";
    state.schoolCompareFilters.school = "";
  }
  render();
}

// DB에 (student_id, school_year, grade_level, semester, exam_type) 유일 제약이
// 걸려 있는 조합입니다. 그대로 색인 키로 씁니다.
// schoolYear는 문자열로 넘어오기도 해서 예전 비교식처럼 숫자로 맞춥니다.
function schoolScoreKey(studentId, schoolYear, gradeLevel, semester, examType) {
  return `${studentId}|${Number(schoolYear)}|${gradeLevel}|${semester}|${examType}`;
}

// 성적 비교 화면은 학생마다 시험 4개를 찾습니다. 예전에는 그때마다 전체
// 성적 배열을 선형 탐색해서 학생 200명이면 80만 회였습니다.
//
// find와 동작을 맞추기 위해 같은 키가 여럿이면 먼저 나온 것을 씁니다.
let schoolScoreIndexSource = null;
let schoolScoreIndex = new Map();
function schoolScoreIndexMap() {
  const list = state.data.studentScores || [];
  if (schoolScoreIndexSource !== list) {
    schoolScoreIndex = new Map();
    list.forEach((item) => {
      const key = schoolScoreKey(item.studentId, item.schoolYear, item.gradeLevel, item.semester, item.examType);
      if (!schoolScoreIndex.has(key)) schoolScoreIndex.set(key, item);
    });
    schoolScoreIndexSource = list;
  }
  return schoolScoreIndex;
}

function findSchoolScore(studentId, schoolYear, gradeLevel, semester, examType) {
  return schoolScoreIndexMap().get(schoolScoreKey(studentId, schoolYear, gradeLevel, semester, examType));
}

function manageSchoolScores() {
  const views = [
    ["bulk", "시험별 일괄 입력"],
    ["student", "학생별 성적표"],
    ["compare", "전체 학생 비교"],
  ];
  return `
    <section class="section-head">
      <div><h1>내신 성적</h1><p class="subtle">학년별 네 번의 내신 시험을 빠르게 입력하고 학생별 변화와 전체 성적을 비교합니다.</p></div>
    </section>
    <div class="school-score-tabs">
      ${views.map(([id, label]) => `<button class="${state.schoolScoreView === id ? "active" : ""}" onclick="setSchoolScoreView('${id}')">${label}</button>`).join("")}
    </div>
    ${state.schoolScoreView === "student" ? schoolStudentReportView() : state.schoolScoreView === "compare" ? schoolScoreComparisonView() : schoolScoreBulkView()}
  `;
}

function schoolScoreBulkView() {
  const criteria = state.schoolScoreCriteria;
  const gradeClasses = state.data.classes.filter((item) => classGradeLevel(item) === criteria.gradeLevel);
  // 저장된 반이 더 이상 유효하지 않으면 이번 그리기에만 첫 반을 씁니다.
  // 예전에는 이 값을 criteria에 써넣었습니다. 그리는 행위가 상태를 바꾸면
  // 재렌더 순서에 따라 선생님이 고른 값이 조용히 사라집니다.
  // 아래 코드와 드롭다운 모두 이 지역 변수만 봅니다.
  const classId = gradeClasses.some((item) => item.id === criteria.classId) ? criteria.classId : gradeClasses[0]?.id || "";
  const students = activeStudents()
    .filter((item) => item.classId === classId && studentGrade(item) === criteria.gradeLevel)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return `
    <form class="score-bulk-panel" onsubmit="saveSchoolScoresBulk(event)">
      <div class="score-criteria-grid">
        <div class="field"><label>학년도</label><select onchange="setSchoolScoreCriterion('schoolYear', this.value)">${schoolYearOptions(criteria.schoolYear)}</select></div>
        <div class="field"><label>학년</label><select onchange="setSchoolScoreCriterion('gradeLevel', this.value)">${gradeOptions(criteria.gradeLevel)}</select></div>
        <div class="field"><label>반</label><select onchange="setSchoolScoreCriterion('classId', this.value)" ${gradeClasses.length ? "" : "disabled"}>${schoolScoreClassOptions(criteria.gradeLevel, classId)}</select></div>
        <div class="field"><label>학기</label><select onchange="setSchoolScoreCriterion('semester', this.value)"><option ${criteria.semester === "1학기" ? "selected" : ""}>1학기</option><option ${criteria.semester === "2학기" ? "selected" : ""}>2학기</option></select></div>
        <div class="field"><label>시험 유형</label><select onchange="setSchoolScoreCriterion('examType', this.value)"><option ${criteria.examType === "중간고사" ? "selected" : ""}>중간고사</option><option ${criteria.examType === "기말고사" ? "selected" : ""}>기말고사</option></select></div>
        <div class="field"><label>만점</label><input type="number" min="0.01" step="0.01" value="${criteria.maxScore}" onchange="setSchoolScoreCriterion('maxScore', this.value)" /></div>
      </div>
      <div class="score-bulk-heading">
        <div><strong>${h(className(classId))}</strong><span>${criteria.schoolYear}학년도 · ${criteria.gradeLevel} · ${criteria.semester} ${criteria.examType}</span></div>
        <span>${students.length}명</span>
      </div>
      ${students.length ? `
        <div class="table-scroll score-entry-scroll">
          <table class="score-entry-table">
            <thead><tr><th>학생 이름</th><th>학교</th><th>점수</th><th>등급</th><th>메모</th></tr></thead>
            <tbody>${students.map((student) => {
              const score = findSchoolScore(student.id, criteria.schoolYear, criteria.gradeLevel, criteria.semester, criteria.examType);
              return `<tr class="bulk-score-row" data-student-id="${student.id}">
                <td><strong>${h(student.name)}</strong></td><td>${h(student.school || "-")}</td>
                <td><input class="bulk-score" aria-label="${h(student.name)} 점수" type="number" min="0" max="${criteria.maxScore}" step="0.01" value="${score?.score ?? ""}" placeholder="미입력" /></td>
                <td><input class="bulk-grade" aria-label="${h(student.name)} 등급" value="${h(score?.grade || "")}" placeholder="선택" /></td>
                <td><input class="bulk-memo" aria-label="${h(student.name)} 메모" value="${h(score?.memo || "")}" placeholder="메모" /></td>
              </tr>`;
            }).join("")}</tbody>
          </table>
        </div>
        <div class="score-save-bar"><p>점수·등급·메모 입력 후 Enter를 누르거나 전체 저장을 선택하세요. 메모만 입력해도 저장되며, 빈 점수는 기존 성적을 삭제하지 않습니다.</p><button class="primary-btn" type="submit">전체 저장</button></div>
      ` : `<div class="empty">선택한 학년과 반에 등록된 학생이 없습니다.</div>`}
    </form>
  `;
}

async function saveSchoolScoresBulk(event) {
  event?.preventDefault();
  const criteria = state.schoolScoreCriteria;
  const rows = [...document.querySelectorAll(".bulk-score-row")];
  const records = [];

  for (const row of rows) {
    const rawScore = row.querySelector(".bulk-score").value.trim();
    const grade = row.querySelector(".bulk-grade").value.trim();
    const memo = row.querySelector(".bulk-memo").value.trim();
    if (rawScore === "" && grade === "" && memo === "") continue;

    const existing = findSchoolScore(row.dataset.studentId, criteria.schoolYear, criteria.gradeLevel, criteria.semester, criteria.examType);
    const score = rawScore === "" ? existing?.score ?? null : Number(rawScore);
    if (score != null && (!Number.isFinite(score) || score < 0 || score > Number(criteria.maxScore))) {
      state.message = `점수는 0점 이상 ${criteria.maxScore}점 이하여야 합니다.`;
      render();
      return;
    }
    records.push({
      studentId: row.dataset.studentId,
      schoolYear: Number(criteria.schoolYear),
      gradeLevel: criteria.gradeLevel,
      semester: criteria.semester,
      examType: criteria.examType,
      examName: `${criteria.schoolYear} ${criteria.gradeLevel} ${criteria.semester} ${criteria.examType}`,
      subject: "수학",
      score,
      maxScore: Number(criteria.maxScore),
      grade,
      memo,
    });
  }

  if (!records.length) {
    state.message = "저장할 점수, 등급 또는 메모를 한 명 이상 입력해주세요.";
    render();
    return;
  }

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from("student_scores").upsert(records.map(toDb), {
        onConflict: "student_id,school_year,grade_level,semester,exam_type",
      });
      if (error) throw error;
      await refreshData();
    } else {
      // 여기서도 배열을 새로 만듭니다. 색인이 배열 식별자에 묶여 있어서
      // 제자리로 바꾸면 방금 넣은 성적이 조회되지 않습니다.
      const next = [...(state.data.studentScores || [])];
      const indexByKey = new Map();
      next.forEach((item, index) => {
        const key = schoolScoreKey(item.studentId, item.schoolYear, item.gradeLevel, item.semester, item.examType);
        if (!indexByKey.has(key)) indexByKey.set(key, index);
      });
      records.forEach((record) => {
        const key = schoolScoreKey(record.studentId, record.schoolYear, record.gradeLevel, record.semester, record.examType);
        const index = indexByKey.get(key);
        if (index === undefined) {
          indexByKey.set(key, next.length);
          next.push({ id: uid("s"), ...record });
        } else {
          next[index] = { ...next[index], ...record };
        }
      });
      state.data.studentScores = next;
      saveDemoData();
    }
    state.message = "";
    alert(`${records.length}명의 성적 기록을 저장했습니다.`);
    render();
  } catch (error) {
    state.message = error.message;
    render();
  }
}

function schoolStudentReportView() {
  const filters = state.schoolReportFilters;
  const availableStudents = activeStudents();
  // 저장된 학생이 더 이상 없으면 이번 그리기에만 첫 학생을 씁니다.
  // 상태에 써넣지 않습니다. 아래 코드와 드롭다운 모두 이 지역 변수만 봅니다.
  const studentId = availableStudents.some((item) => item.id === filters.studentId) ? filters.studentId : availableStudents[0]?.id || "";
  const student = state.data.students.find((item) => item.id === studentId);
  const scores = schoolExamSlots().map((slot) => findSchoolScore(studentId, filters.schoolYear, filters.gradeLevel, slot.semester, slot.examType));
  const entered = scores.filter((item) => item && item.score != null);
  const values = entered.map((item) => item.score);
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

  return `
    <section class="school-report-panel">
      <div class="school-report-filters">
        <div class="field"><label>학생</label><select onchange="setSchoolReportFilter('studentId', this.value)">${studentRecordOptions(studentId)}</select></div>
        <div class="field"><label>학년도</label><select onchange="setSchoolReportFilter('schoolYear', this.value)">${schoolYearOptions(filters.schoolYear)}</select></div>
        <div class="field"><label>당시 학년</label><select onchange="setSchoolReportFilter('gradeLevel', this.value)">${gradeOptions(filters.gradeLevel)}</select></div>
      </div>
      <div class="student-report-head"><div><h2>${h(student?.name || "학생 미선택")}</h2><p>${h(student?.school || "학교 미등록")} · ${filters.schoolYear}학년도 ${filters.gradeLevel}</p></div></div>
      <div class="exam-card-grid">${schoolExamSlots().map((slot, index) => schoolExamCard(slot, scores[index], scores[index - 1])).join("")}</div>
      <div class="score-summary-grid">
        <div><span>입력 시험 평균</span><strong>${average == null ? "—" : average.toFixed(1)}</strong></div>
        <div><span>최고점</span><strong>${values.length ? Math.max(...values).toFixed(1) : "—"}</strong></div>
        <div><span>최저점</span><strong>${values.length ? Math.min(...values).toFixed(1) : "—"}</strong></div>
        <div><span>입력 완료</span><strong>${entered.length}/4</strong></div>
      </div>
      ${schoolScoreGraph(scores)}
    </section>
  `;
}

function schoolExamCard(slot, score, previous) {
  const hasScore = score && score.score != null;
  const previousHasScore = previous && previous.score != null;
  const change = hasScore && previousHasScore ? score.score - previous.score : null;
  const changeClass = change == null || change === 0 ? "neutral" : change > 0 ? "up" : "down";
  const changeText = change == null ? "비교 없음" : change === 0 ? "변화 없음" : `${change > 0 ? "+" : ""}${change.toFixed(1)}점`;
  return `<article class="exam-score-card ${hasScore ? "" : "missing"}">
    <div class="exam-card-title"><span>${slot.label}</span><small>${hasScore ? "점수 입력" : score ? "메모 입력" : "미입력"}</small></div>
    <div class="exam-score-value">${hasScore ? `<strong>${score.score}</strong><span>/ ${score.maxScore}</span>` : `<strong>—</strong>`}</div>
    <div class="exam-card-meta"><span>등급 ${h(score?.grade || "—")}</span><span class="score-change ${changeClass}">${changeText}</span></div>
    <p>${score?.memo ? h(score.memo) : "메모 없음"}</p>
  </article>`;
}

function schoolScoreGraph(scores) {
  const width = 720;
  const height = 230;
  const points = scores.map((score, index) => score && score.score != null ? { x: 75 + index * 185, y: 175 - (score.score / score.maxScore) * 125, score } : null);
  const linePoints = points.filter(Boolean).map((point) => `${point.x},${point.y}`).join(" ");
  return `<section class="score-chart"><div class="score-chart-head"><h3>시험별 점수 변화</h3><span>만점 대비 비율 기준</span></div>
    <div class="score-chart-scroll"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="시험별 점수 변화 그래프">
      <line x1="55" y1="50" x2="680" y2="50" class="chart-guide" /><line x1="55" y1="112.5" x2="680" y2="112.5" class="chart-guide" /><line x1="55" y1="175" x2="680" y2="175" class="chart-axis" />
      <text x="18" y="54">100%</text><text x="25" y="116">50%</text><text x="34" y="179">0</text>
      ${linePoints ? `<polyline points="${linePoints}" class="chart-line" />` : ""}
      ${points.map((point, index) => `<text x="${75 + index * 185}" y="210" text-anchor="middle">${schoolExamSlots()[index].label}</text>${point ? `<circle cx="${point.x}" cy="${point.y}" r="6" class="chart-point" /><text x="${point.x}" y="${point.y - 13}" text-anchor="middle" class="chart-value">${point.score.score}</text>` : ""}`).join("")}
    </svg></div>
  </section>`;
}

function schoolScoreComparisonView() {
  const filters = state.schoolCompareFilters;
  const schools = uniqueValues(activeStudents().filter((item) => studentGrade(item) === filters.gradeLevel).map((item) => item.school));
  const students = activeStudents()
    .filter((item) => studentGrade(item) === filters.gradeLevel)
    .filter((item) => !filters.student || item.name.includes(filters.student))
    .filter((item) => !filters.school || item.school === filters.school)
    .filter((item) => !filters.classId || item.classId === filters.classId)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const slots = schoolExamSlots();
  const rows = students.map((student) => {
    const scores = slots.map((slot) => findSchoolScore(student.id, filters.schoolYear, filters.gradeLevel, slot.semester, slot.examType));
    const values = scores.filter((item) => item && item.score != null).map((item) => item.score);
    const average = values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : "—";
    return [h(student.name), h(student.school || "-"), `<span class="badge">${h(className(student.classId))}</span>`, ...scores.map((item) => item && item.score != null ? `${item.score}/${item.maxScore}` : `<span class="score-missing">—</span>`), average];
  });

  return `<section class="score-comparison-panel">
    <div class="score-comparison-filters">
      <div class="field"><label>학년도</label><select onchange="setSchoolCompareFilter('schoolYear', this.value)">${schoolYearOptions(filters.schoolYear)}</select></div>
      <div class="field"><label>학년</label><select onchange="setSchoolCompareFilter('gradeLevel', this.value)">${gradeOptions(filters.gradeLevel)}</select></div>
      <div class="field"><label>학생 이름</label><input value="${h(filters.student)}" placeholder="입력 후 Enter" onchange="setSchoolCompareFilter('student', this.value)" /></div>
      <div class="field"><label>학교</label><select onchange="setSchoolCompareFilter('school', this.value)"><option value="">전체 학교</option>${schools.map((school) => `<option value="${h(school)}" ${filters.school === school ? "selected" : ""}>${h(school)}</option>`).join("")}</select></div>
      <div class="field"><label>반</label><select onchange="setSchoolCompareFilter('classId', this.value)">${schoolScoreClassOptions(filters.gradeLevel, filters.classId, true)}</select></div>
    </div>
    <div class="comparison-heading"><strong>${filters.schoolYear}학년도 ${filters.gradeLevel}</strong><span>${students.length}명</span></div>
    ${tableMarkup(["학생", "학교", "반", "1학기 중간", "1학기 기말", "2학기 중간", "2학기 기말", "평균"], rows)}
  </section>`;
}

function studentRecordOptions(selected, includeAll = false, includeArchived = false) {
  const options = (includeArchived ? state.data.students : activeStudents())
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
    .map((student) => `<option value="${student.id}" ${selected === student.id ? "selected" : ""}>${h(student.name)} · ${h(className(student.classId))}${isStudentArchived(student)?" · 보관":""}</option>`)
    .join("");
  return `${includeAll ? `<option value="">전체 학생</option>` : ""}${options}`;
}

function setRecordFormType(type) {
  state.recordFormType = ["note", "counseling"].includes(type) ? type : "note";
  state.edit = null;
  state.message = "";
  render();
}

function setRecordFilter(field, value) {
  if (!["studentId", "type", "from", "to"].includes(field)) return;
  state.recordFilters[field] = value;
  render();
}

function resetRecordFilters() {
  state.recordFilters = { studentId: "", type: "all", from: "", to: "" };
  render();
}

function studentRecordForm(type, edit) {
  const studentId = edit?.studentId || state.recordStudentId || state.data.students[0]?.id || "";
  const date = edit?.examDate || edit?.recordDate || edit?.counselingDate || isoDate(new Date());
  const common = `
        <div class="field"><label>학생</label><select id="recordStudentId" required>${studentRecordOptions(studentId, false, true)}</select></div>
    <div class="field"><label>날짜</label><input id="recordDate" type="date" required value="${date}" /></div>
  `;

  if (type === "score") {
    return `${common}
      <div class="field"><label>시험명</label><input id="recordExamName" required value="${h(edit?.examName || "")}" /></div>
      <div class="field"><label>과목</label><input id="recordSubject" value="${h(edit?.subject || "수학")}" /></div>
      <div class="record-score-grid">
        <div class="field"><label>점수</label><input id="recordScore" type="number" min="0" step="0.01" required value="${edit?.score ?? ""}" /></div>
        <div class="field"><label>만점</label><input id="recordMaxScore" type="number" min="0.01" step="0.01" required value="${edit?.maxScore ?? 100}" /></div>
      </div>
      <div class="field"><label>등급</label><input id="recordGrade" value="${h(edit?.grade || "")}" /></div>
      <div class="field"><label>메모</label><textarea id="recordMemo">${h(edit?.memo || "")}</textarea></div>`;
  }

  if (type === "note") {
    return `${common}
      <div class="field"><label>분류</label><input id="recordCategory" required value="${h(edit?.category || "학습")}" placeholder="학습, 출결, 생활 등" /></div>
      <div class="field"><label>중요도</label><select id="recordImportance"><option ${edit?.importance !== "중요" ? "selected" : ""}>일반</option><option ${edit?.importance === "중요" ? "selected" : ""}>중요</option></select></div>
      <div class="field"><label>내용</label><textarea id="recordContent" required>${h(edit?.content || "")}</textarea></div>`;
  }

  return `${common}
    <div class="field"><label>상담 대상</label><select id="recordTarget"><option ${edit?.target !== "학부모" ? "selected" : ""}>학생</option><option ${edit?.target === "학부모" ? "selected" : ""}>학부모</option></select></div>
    <div class="field"><label>상담 내용</label><textarea id="recordContent" required>${h(edit?.content || "")}</textarea></div>
    <div class="field"><label>후속 조치</label><textarea id="recordFollowUp">${h(edit?.followUp || "")}</textarea></div>
    <label class="record-check"><input id="recordCompleted" type="checkbox" ${edit?.isCompleted ? "checked" : ""} /> 후속 조치 완료</label>`;
}

function unifiedStudentRecords() {
  return [
    ...(state.data.studentNotes || []).map((item) => ({
      id: item.id, type: "note", studentId: item.studentId, date: item.recordDate,
      title: `${item.category} 특이사항`, summary: item.importance, detail: item.content,
    })),
    ...(state.data.counselingRecords || []).map((item) => ({
      id: item.id, type: "counseling", studentId: item.studentId, date: item.counselingDate,
      title: `${item.target} 상담`, summary: item.isCompleted ? "후속 조치 완료" : "후속 조치 확인 필요",
      detail: `${item.content}${item.followUp ? `\n후속 조치: ${item.followUp}` : ""}`,
    })),
  ];
}

function manageStudentRecords() {
  if (!state.data.students.length) {
    return `<section class="section-head"><div><h1>학생 기록</h1><p class="subtle">먼저 학생을 등록해주세요.</p></div></section><div class="empty">등록된 학생이 없습니다.</div>`;
  }

  const editType = ["note", "counseling"].includes(state.edit?.type) ? state.edit.type : null;
  const type = editType || state.recordFormType;
  const source = type === "score" ? state.data.studentScores : type === "note" ? state.data.studentNotes : state.data.counselingRecords;
  const edit = editType ? source.find((item) => item.id === state.edit.id) : null;
  const labels = { note: "특이사항", counseling: "상담기록" };
  const filters = state.recordFilters;
  const records = unifiedStudentRecords()
    .filter((item) => !filters.studentId || item.studentId === filters.studentId)
    .filter((item) => filters.type === "all" || item.type === filters.type)
    .filter((item) => !filters.from || item.date >= filters.from)
    .filter((item) => !filters.to || item.date <= filters.to)
    .sort((a, b) => b.date.localeCompare(a.date));

  return `
    <section class="section-head">
      <div><h1>학생 기록</h1><p class="subtle">특이사항과 상담기록을 학생별로 기록하고 필요한 조건으로 찾아봅니다.</p></div>
    </section>
    <section class="record-layout">
      <aside class="form-panel">
        <h2>${edit ? `${labels[type]} 수정` : "새 기록 등록"}</h2>
        <div class="field"><label>기록 종류</label><select onchange="setRecordFormType(this.value)" ${edit ? "disabled" : ""}>
          <option value="note" ${type === "note" ? "selected" : ""}>특이사항</option>
          <option value="counseling" ${type === "counseling" ? "selected" : ""}>상담기록</option>
        </select></div>
        <form onsubmit="saveStudentRecord(event, '${type}')">
          ${studentRecordForm(type, edit)}
          ${formButtons(type)}
        </form>
      </aside>
      <section class="record-list-panel">
        <div class="record-filters">
          <select aria-label="학생 필터" onchange="setRecordFilter('studentId', this.value)">${studentRecordOptions(filters.studentId, true, true)}</select>
          <select aria-label="기록 종류 필터" onchange="setRecordFilter('type', this.value)">
            <option value="all">전체 기록</option>
            <option value="note" ${filters.type === "note" ? "selected" : ""}>특이사항</option>
            <option value="counseling" ${filters.type === "counseling" ? "selected" : ""}>상담기록</option>
          </select>
          <input aria-label="시작일" type="date" value="${filters.from}" onchange="setRecordFilter('from', this.value)" />
          <input aria-label="종료일" type="date" value="${filters.to}" onchange="setRecordFilter('to', this.value)" />
          <button class="small-btn" onclick="resetRecordFilters()">필터 초기화</button>
        </div>
        <div class="record-count">총 ${records.length}건</div>
        <div class="record-list">
          ${records.length ? records.map(studentRecordCard).join("") : `<div class="empty">조건에 맞는 기록이 없습니다.</div>`}
        </div>
      </section>
    </section>
  `;
}

function studentRecordCard(record) {
  const labels = { score: "시험점수", note: "특이사항", counseling: "상담" };
  const student = state.data.students.find((item) => item.id === record.studentId);
  return `
    <article class="record-card ${record.type}">
      <div class="record-card-head">
        <div><span class="badge">${labels[record.type]}</span><strong>${h(record.title)}</strong></div>
        <time>${h(record.date)}</time>
      </div>
      <p class="record-student">${h(student?.name || "삭제된 학생")} · ${h(className(student?.classId))}</p>
      <p class="record-summary">${h(record.summary)}</p>
      ${record.detail ? `<p class="record-detail">${h(record.detail).replaceAll("\n", "<br />")}</p>` : ""}
      ${rowButtons(`editItem('${record.type}','${record.id}')`, `deleteItem('${record.type}','${record.id}')`)}
    </article>
  `;
}

function videoViewThreshold() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

function escapeVideoViewSearchPattern(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function rememberVideoViewSearchSelection(input) {
  const fallback = input.value.length;
  videoViewSearchSelection = {
    start: input.selectionStart ?? fallback,
    end: input.selectionEnd ?? fallback,
  };
}

function restoreVideoViewSearchFocus() {
  if (state.view !== "video-views") return;
  requestAnimationFrame(() => {
    const input = document.querySelector("#videoViewStudentSearch");
    if (!input) return;
    const length = input.value.length;
    input.focus({ preventScroll: true });
    input.setSelectionRange(
      Math.min(videoViewSearchSelection.start, length),
      Math.min(videoViewSearchSelection.end, length),
    );
  });
}

function beginVideoViewSearchComposition(input) {
  input.dataset.composing = "1";
  cancelSearchDebounce("videoView");
  rememberVideoViewSearchSelection(input);
}

function queueVideoViewSearch(input) {
  state.videoView.search = input.value;
  state.videoView.page = 1;
  state.videoView.requestId += 1;
  rememberVideoViewSearchSelection(input);
  debounceSearchInput("videoView", input, () => {
    const preserveSearchFocus = document.activeElement === input;
    loadVideoViewPage(1, { preserveSearchFocus });
  });
}

function endVideoViewSearchComposition(input) {
  input.dataset.composing = "";
  queueVideoViewSearch(input);
}

async function loadVideoViewPage(page = state.videoView.page, { preserveSearchFocus = false } = {}) {
  if (state.user?.role !== "admin") return;

  const targetPage = Math.max(1, Number(page) || 1);
  const pageSize = state.videoView.pageSize;
  const requestId = state.videoView.requestId + 1;
  state.videoView.requestId = requestId;
  state.videoView.page = targetPage;
  state.videoView.loading = true;
  state.message = "";
  if (state.view === "video-views") {
    render();
    if (preserveSearchFocus) restoreVideoViewSearchFocus();
  }

  try {
    const search = state.videoView.search.trim();
    let rows = [];
    let total = 0;

    if (supabaseClient) {
      const selectedColumns = search
        ? "id, student_id, video_id, clicked_at, students!inner(id, name)"
        : "id, student_id, video_id, clicked_at";
      let query = supabaseClient
        .from("video_views")
        .select(selectedColumns, { count: "exact" })
        .gte("clicked_at", videoViewThreshold())
        .order("clicked_at", { ascending: false });
      if (search) query = query.ilike("students.name", `%${escapeVideoViewSearchPattern(search)}%`);
      const from = (targetPage - 1) * pageSize;
      const { data, error, count } = await query.range(from, from + pageSize - 1);
      if (error) throw error;
      rows = (data || []).map(normalizeVideoView);
      total = Number(count || 0);
    } else {
      const demoData = loadDemoData();
      const students = (demoData.students || []).map(normalizeStudent);
      const threshold = videoViewThreshold();
      const matchingStudentIds = search
        ? new Set(students
            .filter((student) => student.name.toLocaleLowerCase("ko-KR").includes(search.toLocaleLowerCase("ko-KR")))
            .map((student) => student.id))
        : null;
      const allRows = (demoData.videoViews || [])
        .map(normalizeVideoView)
        .filter((item) => item.clickedAt >= threshold && (!matchingStudentIds || matchingStudentIds.has(item.studentId)))
        .sort((a, b) => b.clickedAt.localeCompare(a.clickedAt));
      total = allRows.length;
      const from = (targetPage - 1) * pageSize;
      rows = allRows.slice(from, from + pageSize);
    }

    if (requestId !== state.videoView.requestId || state.view !== "video-views") return;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    if (targetPage > lastPage) {
      await loadVideoViewPage(lastPage, { preserveSearchFocus });
      return;
    }
    state.data.videoViews = rows;
    state.videoView.total = total;
    state.videoView.page = targetPage;
  } catch (error) {
    if (requestId !== state.videoView.requestId || state.view !== "video-views") return;
    state.data.videoViews = [];
    state.videoView.total = 0;
    state.message = `시청 기록을 불러오지 못했습니다: ${error.message}`;
  }

  if (requestId !== state.videoView.requestId || state.view !== "video-views") return;
  state.videoView.loading = false;
  render();
  if (preserveSearchFocus) restoreVideoViewSearchFocus();
}

async function changeVideoViewPage(delta) {
  if (state.videoView.loading) return;
  const totalPages = Math.max(1, Math.ceil(state.videoView.total / state.videoView.pageSize));
  const nextPage = Math.min(totalPages, Math.max(1, state.videoView.page + Number(delta || 0)));
  if (nextPage === state.videoView.page) return;
  await loadVideoViewPage(nextPage);
}

function manageVideoViews() {
  const view = state.videoView;
  const rows = (state.data.videoViews || []).map((item) => {
    const student = state.data.students.find((studentItem) => studentItem.id === item.studentId);
    const video = state.data.videos.find((videoItem) => videoItem.id === item.videoId);
    return [
      h(formatDateTime(item.clickedAt)),
      h(student?.name || "알 수 없음"),
      `<span class="badge">${h(video?.classId ? className(video.classId) : "알 수 없음")}</span>`,
      h(video?.title || "삭제된 영상"),
    ];
  });
  const totalPages = Math.max(1, Math.ceil(view.total / view.pageSize));
  const displayedPage = Math.min(view.page, totalPages);
  const rangeStart = view.total ? (view.page - 1) * view.pageSize + 1 : 0;
  const rangeEnd = view.total ? Math.min(view.page * view.pageSize, view.total) : 0;
  const previousDisabled = view.loading || view.page <= 1;
  const nextDisabled = view.loading || view.page >= totalPages;
  const listMarkup = view.loading
    ? `<div class="video-view-loading">시청 기록을 불러오는 중입니다.</div>`
    : rows.length
      ? `<div class="table-scroll"><table class="video-view-table"><thead><tr>${["시간", "학생", "반", "영상"].map((head) => `<th>${head}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      : `<div class="empty">조건에 맞는 시청 기록이 없습니다.</div>`;

  return `
    <section class="section-head">
      <div>
        <h1>시청 기록</h1>
        <p class="subtle">최근 30일 동안 학생이 유튜브 이동 버튼을 누른 기록입니다. 유튜브에서 끝까지 시청했는지는 확인할 수 없습니다.</p>
      </div>
    </section>
    <section class="table-panel">
      <div class="video-view-toolbar">
        <div class="video-view-search">
          <label for="videoViewStudentSearch">학생 이름</label>
          <input id="videoViewStudentSearch" type="search" value="${h(view.search)}" placeholder="이름 일부 검색" autocomplete="off" oncompositionstart="beginVideoViewSearchComposition(this)" oncompositionend="endVideoViewSearchComposition(this)" oninput="queueVideoViewSearch(this)" />
        </div>
        <span class="subtle">현재 시각 기준 최근 30일</span>
      </div>
      <div class="hint">영상이 사이트 밖 유튜브에서 재생되기 때문에, 이 화면은 실제 재생 완료가 아니라 학생의 영상 링크 클릭 기록을 보여줍니다.</div>
      ${listMarkup}
      <div class="list-pagination" aria-label="시청 기록 페이지 이동">
        <span>${rangeStart}–${rangeEnd} / 총 ${view.total}건</span>
        <div>
          <button type="button" class="small-btn" onclick="changeVideoViewPage(-1)" ${previousDisabled ? "disabled" : ""}>이전</button>
          <strong>${displayedPage} / ${totalPages} 페이지</strong>
          <button type="button" class="small-btn" onclick="changeVideoViewPage(1)" ${nextDisabled ? "disabled" : ""}>다음</button>
        </div>
      </div>
    </section>
  `;
}

function adminCrudLayout({ title, description, formTitle, form, table }) {
  return `
    <section class="section-head">
      <div>
        <h1>${title}</h1>
        <p class="subtle">${description}</p>
      </div>
    </section>
    <section class="admin-layout">
      <aside class="form-panel">
        <h2>${formTitle}</h2>
        ${form}
      </aside>
      <section class="table-panel">${table}</section>
    </section>
  `;
}

function classSelect(id, selected) {
  return `
    <select id="${id}" required>
      ${state.data.classes.map((item) => `<option value="${item.id}" ${selected === item.id ? "selected" : ""}>${h(item.name)}</option>`).join("")}
    </select>
  `;
}

function formButtons(type) {
  return `
    <div class="form-actions">
      <button class="primary-btn" type="submit">${state.edit?.type === type ? "수정 저장" : "등록"}</button>
      ${state.edit?.type === type ? `<button class="ghost-btn" type="button" onclick="cancelEdit()">취소</button>` : ""}
    </div>
  `;
}

function tableMarkup(headers, rows) {
  if (!rows.length) return `<div class="empty">등록된 항목이 없습니다.</div>`;
  return `
    <div class="table-scroll">
      <table>
        <thead><tr>${headers.map((head) => `<th>${head}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function rowButtons(editAction, deleteAction) {
  return `
    <div class="row-actions">
      <button class="small-btn" onclick="${editAction}">수정</button>
      <button class="danger-btn" onclick="${deleteAction}">삭제</button>
    </div>
  `;
}

function editItem(type, id) {
  state.edit = { type, id };
  if (type === "student") state.openStudentId = "";
  if (["score", "note", "counseling"].includes(type)) state.recordFormType = type;
  render();
}

function cancelEdit() {
  state.edit = null;
  render();
}

async function writeRecord(table, payload, id) {
  if (supabaseClient) {
    const query = id
      ? supabaseClient.from(table).update(toDb(payload)).eq("id", id)
      : supabaseClient.from(table).insert(toDb(payload));
    const { error } = await query;
    if (error) throw error;
    await refreshData();
  } else {
    const localMap = {
      classes: "classes", videos: "videos", homeworks: "homeworks", students: "students",
      student_scores: "studentScores", student_notes: "studentNotes", counseling_records: "counselingRecords",
    };
    const key = localMap[table];
    // 배열을 제자리로 바꾸지 않고 새로 만듭니다.
    // classById / findSchoolScore가 배열 자체를 키로 색인을 캐시하므로,
    // push나 Object.assign으로 몰래 바꾸면 옛 색인이 그대로 남습니다.
    state.data[key] = id
      ? state.data[key].map((item) => (item.id === id ? { ...item, ...payload } : item))
      : [...state.data[key], { id: uid(table[0]), ...payload }];
    saveDemoData();
  }
}

async function deleteRecord(table, id) {
  if (supabaseClient) {
    const { error } = await supabaseClient.from(table).delete().eq("id", id);
    if (error) throw error;
    await refreshData();
  } else {
    const localMap = { student_scores: "studentScores", student_notes: "studentNotes", counseling_records: "counselingRecords" };
    const key = localMap[table] || table;
    if (table === "classes") {
      state.data.videos = state.data.videos.filter((item) => item.classId !== id);
      state.data.homeworks = state.data.homeworks.filter((item) => item.classId !== id);
      state.data.students = state.data.students.filter((item) => item.classId !== id);
    }
    if (table === "students") {
      state.data.studentScores = (state.data.studentScores || []).filter((item) => item.studentId !== id);
      state.data.studentNotes = (state.data.studentNotes || []).filter((item) => item.studentId !== id);
      state.data.counselingRecords = (state.data.counselingRecords || []).filter((item) => item.studentId !== id);
    }
    state.data[key] = state.data[key].filter((item) => item.id !== id);
    saveDemoData();
  }
}

async function deleteItem(type, id) {
  if (type === "student") {
    await archiveStudent(id);
    return;
  }
  if (!confirm("삭제할까요?")) return;
  const map = {
    class: "classes", video: "videos", homework: "homeworks", student: "students",
    score: "student_scores", note: "student_notes", counseling: "counseling_records",
  };
  try {
    await deleteRecord(map[type], id);
    state.edit = null;
    if (type === "student") state.openStudentId = "";
    render();
  } catch (error) {
    state.message = error.message;
    render();
  }
}

async function saveClass(event) {
  event.preventDefault();
  const edit = state.edit?.type === "class" ? state.data.classes.find((item) => item.id === state.edit.id) : null;
  const gradeLevel = document.querySelector("#classGradeLevel").value;
  if (edit && classGradeLevel(edit) !== gradeLevel) {
    const affectedStudentCount = state.data.students.filter((student) => student.classId === edit.id).length;
    const affectedHomeworkCount = state.data.homeworks.filter((homework) => homework.classId === edit.id).length;
    const affectedVideoCount = state.data.videos.filter((video) => video.classId === edit.id).length;
    if (affectedStudentCount + affectedHomeworkCount + affectedVideoCount > 0) {
      const confirmed = confirm(`이 반의 학년을 ${classGradeLevel(edit) || "미지정"}에서 ${gradeLevel}로 변경합니다.\n\n영향 범위\n- 소속 학생 ${affectedStudentCount}명의 현재 학년 분류\n- 일반 숙제 ${affectedHomeworkCount}건의 학년별 표시\n- 영상 ${affectedVideoCount}건의 학생 노출 범위\n\n과거 사진숙제·수업일지·내신 성적 스냅샷은 변경되지 않습니다. 계속할까요?`);
      if (!confirmed) return;
    }
  }
  const payload = {
    name: document.querySelector("#className").value.trim(),
    gradeLevel,
    memo: "",
    weeklyReportTarget: Boolean(document.querySelector("#classWeeklyReportTarget")?.checked),
  };
  await submitRecord("classes", "class", payload);
}

async function saveVideo(event) {
  event.preventDefault();
  const url = document.querySelector("#videoUrl").value.trim();
  // 저장할 때도 막습니다. 학생 화면에서 걸러내면 이미 저장된 뒤라,
  // 선생님은 왜 링크가 안 보이는지 알 수 없습니다.
  if (!safeHttpUrl(url)) {
    state.message = "영상 주소는 http:// 또는 https:// 로 시작해야 합니다.";
    render();
    return;
  }
  const payload = {
    classId: document.querySelector("#videoClassId").value,
    title: document.querySelector("#videoTitle").value.trim(),
    url,
    createdAt: document.querySelector("#videoCreatedAt").value,
  };
  await submitRecord("videos", "video", payload);
}

async function saveHomework(event) {
  event.preventDefault();
  const payload = {
    date: document.querySelector("#homeworkDate").value,
    content: document.querySelector("#homeworkContent").value.trim(),
    classId: document.querySelector("#homeworkClassId").value,
  };
  await submitRecord("homeworks", "homework", payload);
}

async function saveStudentRecord(event, type) {
  event.preventDefault();
  const studentId = document.querySelector("#recordStudentId").value;
  const date = document.querySelector("#recordDate").value;
  let table;
  let payload;

  if (type === "score") {
    table = "student_scores";
    payload = {
      studentId,
      examDate: date,
      examName: document.querySelector("#recordExamName").value.trim(),
      subject: document.querySelector("#recordSubject").value.trim(),
      score: Number(document.querySelector("#recordScore").value),
      maxScore: Number(document.querySelector("#recordMaxScore").value),
      grade: document.querySelector("#recordGrade").value.trim(),
      memo: document.querySelector("#recordMemo").value.trim(),
    };
    if (payload.score > payload.maxScore) {
      state.message = "점수는 만점보다 클 수 없습니다.";
      render();
      return;
    }
  } else if (type === "note") {
    table = "student_notes";
    payload = {
      studentId,
      recordDate: date,
      category: document.querySelector("#recordCategory").value.trim(),
      importance: document.querySelector("#recordImportance").value,
      content: document.querySelector("#recordContent").value.trim(),
    };
  } else {
    table = "counseling_records";
    payload = {
      studentId,
      counselingDate: date,
      target: document.querySelector("#recordTarget").value,
      content: document.querySelector("#recordContent").value.trim(),
      followUp: document.querySelector("#recordFollowUp").value.trim(),
      isCompleted: document.querySelector("#recordCompleted").checked,
    };
  }

  state.recordStudentId = studentId;
  await submitRecord(table, type, payload);
}

async function saveStudent(event) {
  event.preventDefault();
  const payload = {
    name: document.querySelector("#studentName").value.trim(),
    school: document.querySelector("#studentSchool").value.trim(),
    classId: document.querySelector("#studentClassId").value,
  };
  const id = state.edit?.type === "student" ? state.edit.id : null;

  try {
    if (id) {
      await writeRecord("students", payload, id);
    } else {
      const password = document.querySelector("#studentPassword").value;
      if (supabaseClient) {
        const { error } = await supabaseClient.rpc("admin_create_student", {
          student_name: payload.name,
          student_school: payload.school,
          student_class_id: payload.classId,
          initial_password: password,
        });
        if (error) throw error;
        await refreshData();
      } else {
        // 다른 데모 쓰기와 마찬가지로 배열을 새로 만듭니다.
        // 지금은 students를 색인하지 않지만, 한 곳만 제자리로 바꿔두면
        // 나중에 색인을 붙일 때 여기만 조용히 어긋납니다.
        state.data.students = [...state.data.students, { id: uid("s"), ...payload, password }];
        saveDemoData();
      }
    }
    state.edit = null;
    state.openStudentId = "";
    state.message = "";
    render();
  } catch (error) {
    state.message = error.message;
    render();
  }
}

async function resetStudentPassword(event, studentId) {
  event.preventDefault();
  const password = document.querySelector(`#studentPassword-${studentId}`).value;

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.rpc("admin_reset_student_password", {
        target_student_id: studentId,
        new_password: password,
      });
      if (error) throw error;
    } else {
      const student = state.data.students.find((item) => item.id === studentId);
      if (student) student.password = password;
      saveDemoData();
    }
    state.message = "";
    alert("비밀번호를 재설정했습니다.");
    render();
  } catch (error) {
    state.message = error.message;
    render();
  }
}

async function submitRecord(table, type, payload) {
  try {
    const id = state.edit?.type === type ? state.edit.id : null;
    await writeRecord(table, payload, id);
    state.edit = null;
    if (type === "student") state.openStudentId = "";
    state.message = "";
    render();
  } catch (error) {
    state.message = error.message;
    render();
  }
}

window.addEventListener("beforeunload", (event) => {
  if (!state.lessonJournal?.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

init();
