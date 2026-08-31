const crypto = require("node:crypto");

const BUCKET = "photo-homework-private";
const ADMIN_EMAIL = "tjddls9288@naver.com";
const SESSION_SECONDS = 60 * 60 * 2;
const REMEMBER_SESSION_SECONDS = 60 * 60 * 24 * 30;
const SIGNED_URL_SECONDS = 300;
const STUDENT_PHOTO_PAGE_SIZE = 20;

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`서버 환경변수 ${name}이(가) 설정되지 않았습니다.`);
  return value.trim();
}

function supabaseBaseUrl() {
  const raw = env("SUPABASE_URL");
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return raw
      .replace(/[?#].*$/, "")
      .replace(/\/+(rest\/v1|auth\/v1|storage\/v1|functions\/v1).*$/i, "")
      .replace(/\/+$/, "");
  }
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

function b64(value) {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

function signStudent(student, remember = false) {
  const expiresIn = remember ? REMEMBER_SESSION_SECONDS : SESSION_SECONDS;
  const payload = { sub: student.id, name: student.name, classId: student.class_id, exp: Math.floor(Date.now() / 1000) + expiresIn };
  const encoded = b64(payload);
  const signature = crypto.createHmac("sha256", env("STUDENT_SESSION_SECRET")).update(encoded).digest("base64url");
  return { token: `${encoded}.${signature}`, expiresIn };
}

function verifyStudent(token) {
  if (!token || !token.includes(".")) throw new Error("학생 로그인이 필요합니다.");
  const [encoded, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", env("STUDENT_SESSION_SECRET")).update(encoded).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error("학생 세션이 유효하지 않습니다.");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (!payload.sub || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("학생 세션이 만료되었습니다. 다시 로그인해주세요.");
  return payload;
}

function bearer(event) {
  return String(event.headers.authorization || event.headers.Authorization || "").replace(/^Bearer\s+/i, "");
}

function clientIp(event) {
  const headers = event.headers || {};
  const direct = headers["x-nf-client-connection-ip"] || headers["X-NF-Client-Connection-Ip"];
  if (direct) return String(direct).trim();
  const forwarded = headers["x-forwarded-for"] || headers["X-Forwarded-For"] || "";
  return String(forwarded).split(",")[0].trim() || "unknown";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 로그인 시도 제한은 실패해도 로그인을 막지 않습니다(fail open).
// apply-login-rate-limit.sql을 적용하기 전에 배포되더라도 로그인이
// 전면 중단되지 않도록 하기 위해서입니다. 대신 로그에 남겨서
// 보호가 꺼진 상태를 알아챌 수 있게 합니다.
async function rateCheck(name, ip) {
  try {
    const result = await request("/rest/v1/rpc/login_rate_check", {
      method: "POST",
      body: { p_name: name, p_ip: ip },
    });
    return {
      blocked: Boolean(result?.blocked),
      retryAfter: Math.max(0, Number(result?.retryAfter) || 0),
      delaySeconds: Math.min(3, Math.max(0, Number(result?.delaySeconds) || 0)),
    };
  } catch (error) {
    console.error("[rate-limit] login_rate_check 실패 — 시도 제한이 적용되지 않습니다:", error.message);
    return { blocked: false, retryAfter: 0, delaySeconds: 0 };
  }
}

async function rateRecord(name, ip, success) {
  try {
    await request("/rest/v1/rpc/login_rate_record", {
      method: "POST",
      body: { p_name: name, p_ip: ip, p_success: success },
    });
  } catch (error) {
    console.error("[rate-limit] login_rate_record 실패:", error.message);
  }
}

function requireUuid(value, label = "ID") {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""))) throw new Error(`${label}가 올바르지 않습니다.`);
  return String(value);
}

async function request(path, { method = "GET", body, token, service = true, headers = {} } = {}) {
  const key = service ? env("SUPABASE_SERVICE_ROLE_KEY") : env("SUPABASE_ANON_KEY");
  const response = await fetch(`${supabaseBaseUrl()}${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token || key}`, "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!response.ok) throw new Error(data?.message || data?.error || data?.hint || `서버 요청 실패 (${response.status})`);
  return data;
}

async function requestAll(path, options = {}) {
  const pageSize = 1000;
  const rows = [];
  let offset = 0;
  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const page = await request(`${path}${separator}limit=${pageSize}&offset=${offset}`, options);
    if (!Array.isArray(page)) throw new Error("Supabase list response was not an array.");
    rows.push(...page);
    if (page.length < pageSize) return rows;
    offset += pageSize;
  }
}

async function requestAllForValues(values, buildPath, batchSize = 100) {
  const unique = [...new Set(values.filter(Boolean))];
  const rows = [];
  for (let index = 0; index < unique.length; index += batchSize) {
    rows.push(...await requestAll(buildPath(unique.slice(index, index + batchSize))));
  }
  return rows;
}

async function requestPage(path, { offset = 0, limit = 30, token, service = true } = {}) {
  const key = service ? env("SUPABASE_SERVICE_ROLE_KEY") : env("SUPABASE_ANON_KEY");
  const response = await fetch(`${supabaseBaseUrl()}${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      "Content-Type": "application/json",
      Prefer: "count=exact",
      Range: `${offset}-${offset + Math.max(1, limit) - 1}`,
      "Range-Unit": "items",
    },
  });
  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : [];
  if (!response.ok) throw new Error(data?.message || data?.error || data?.hint || `Server request failed (${response.status})`);
  const contentRange = response.headers.get("content-range") || "";
  const totalPart = contentRange.split("/")[1];
  const total = totalPart && totalPart !== "*" ? Number(totalPart) : (Array.isArray(data) ? data.length : 0);
  return { data: Array.isArray(data) ? data : [], total: Number.isFinite(total) ? total : 0 };
}

function seoulToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function activeStudent(studentId) {
  const rows = await request(`/rest/v1/students?id=eq.${studentId}&select=id,name,school,class_id,archived_at`);
  const student = rows?.[0];
  if (!student || student.archived_at) {
    throw new Error("\ud559\uc0dd \uacc4\uc815 \uc138\uc158\uc744 \uc0ac\uc6a9\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \ub85c\uadf8\uc778\ud574\uc8fc\uc138\uc694.");
  }
  return student;
}

function publicStudent(student) {
  const { archived_at, ...safe } = student;
  return safe;
}

async function requireStudent(event) {
  const session = verifyStudent(bearer(event));
  return { session, student: await activeStudent(session.sub) };
}

async function requireOpenAssignment(studentId, assignmentId, existingAssignment) {
  const assignments = existingAssignment ? [existingAssignment] : await request(
    `/rest/v1/photo_homework_assignments?id=eq.${assignmentId}&student_id=eq.${studentId}&select=id,homework_id,status`
  );
  const assignment = assignments?.[0];
  if (!assignment || assignment.student_id && assignment.student_id !== studentId) {
    throw new Error("\ubc30\uc815\ub41c \uc219\uc81c\uac00 \uc544\ub2d9\ub2c8\ub2e4.");
  }
  const homeworks = await request(`/rest/v1/photo_homeworks?id=eq.${assignment.homework_id}&select=id,period_id`);
  const homework = homeworks?.[0];
  const periods = homework
    ? await request(`/rest/v1/learning_periods?id=eq.${homework.period_id}&select=id,is_active,end_date`)
    : [];
  const period = periods?.[0];
  if (!period || period.is_active !== true || String(period.end_date || "") < seoulToday()) {
    throw new Error("\uc885\ub8cc\ub41c \ud559\uc2b5\uae30\uac04\uc785\ub2c8\ub2e4. \uc0ac\uc9c4\uc744 \ucd94\uac00\ud558\uac70\ub098 \uc0ad\uc81c\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.");
  }
  return { assignment, homework, period };
}

async function requireAdmin(event) {
  const token = bearer(event);
  if (!token) throw new Error("관리자 로그인이 필요합니다.");
  const user = await request("/auth/v1/user", { token, service: false });
  if (String(user.email || "").toLowerCase() !== ADMIN_EMAIL) throw new Error("관리자 권한이 없습니다.");
  return token;
}

async function studentAssignmentForStudent(studentId, assignmentId) {
  const assignments = await request(
    `/rest/v1/photo_homework_assignments?id=eq.${assignmentId}&student_id=eq.${studentId}&select=id,homework_id,assigned_grade_level,assigned_class_id,assigned_class_name,student_name_snapshot,school_snapshot,status,admin_feedback,reviewed_at,created_at`
  );
  const assignment = assignments?.[0];
  if (!assignment) throw new Error("배정된 숙제가 아닙니다.");
  return assignment;
}

async function summarizeStudentAssignments(assignments, studentId) {
  const assignmentIds = assignments.map((assignment) => assignment.id);
  if (!assignmentIds.length) return [];
  const inList = (values) => `(${values.join(",")})`;
  const [photos, rounds] = await Promise.all([
    requestAllForValues(assignmentIds, (ids) =>
      `/rest/v1/photo_submission_photos?assignment_id=in.${inList(ids)}&student_id=eq.${studentId}&deleted_at=is.null&select=assignment_id,uploaded_at`
    ),
    requestAllForValues(assignmentIds, (ids) =>
      `/rest/v1/photo_submission_rounds?assignment_id=in.${inList(ids)}&select=assignment_id,submitted_at`
    ),
  ]);
  const photoCounts = {};
  const roundCounts = {};
  const latestSubmittedAt = {};
  const recordSubmittedAt = (assignmentId, value) => {
    if (value && (!latestSubmittedAt[assignmentId] || String(value) > String(latestSubmittedAt[assignmentId]))) {
      latestSubmittedAt[assignmentId] = value;
    }
  };
  for (const photo of photos) {
    photoCounts[photo.assignment_id] = (photoCounts[photo.assignment_id] || 0) + 1;
    recordSubmittedAt(photo.assignment_id, photo.uploaded_at);
  }
  for (const round of rounds) {
    roundCounts[round.assignment_id] = (roundCounts[round.assignment_id] || 0) + 1;
    recordSubmittedAt(round.assignment_id, round.submitted_at);
  }
  return assignments.map((assignment) => ({
    ...assignment,
    photo_count: photoCounts[assignment.id] || 0,
    round_count: roundCounts[assignment.id] || 0,
    latest_submitted_at: latestSubmittedAt[assignment.id] || null,
  }));
}

async function studentDashboard(studentId) {
  const assignments = await requestAll(
    `/rest/v1/photo_homework_assignments?student_id=eq.${studentId}&select=id,homework_id,assigned_grade_level,assigned_class_id,assigned_class_name,student_name_snapshot,school_snapshot,status,admin_feedback,reviewed_at,created_at&order=created_at.desc`
  );
  const homeworkIds = [...new Set(assignments.map((x) => x.homework_id))];
  if (!assignments.length) return { assignments: [], homeworks: [], periods: [] };
  const inList = (values) => `(${values.join(",")})`;
  const homeworks = await requestAllForValues(homeworkIds, (ids) =>
    `/rest/v1/photo_homeworks?id=in.${inList(ids)}&select=*&order=lesson_date.desc`
  );
  homeworks.sort((a, b) => String(b.lesson_date || "").localeCompare(String(a.lesson_date || "")));
  const periodIds = [...new Set(homeworks.map((x) => x.period_id))];
  const [periods, summarizedAssignments] = await Promise.all([
    requestAllForValues(periodIds, (ids) => `/rest/v1/learning_periods?id=in.${inList(ids)}&select=*`),
    summarizeStudentAssignments(assignments, studentId),
  ]);
  return { assignments: summarizedAssignments, homeworks, periods };
}

function normalizeReviewFilters(raw = {}) {
  const filters = {
    periodId: String(raw.periodId || "").trim(),
    grade: String(raw.grade || "").trim(),
    classId: String(raw.classId || "").trim(),
    homeworkId: String(raw.homeworkId || "").trim(),
    student: String(raw.student || "").trim().slice(0, 100),
    status: String(raw.status || "").trim(),
  };
  if (filters.periodId) requireUuid(filters.periodId, "Period ID");
  if (filters.classId) requireUuid(filters.classId, "Class ID");
  if (filters.homeworkId) requireUuid(filters.homeworkId, "Homework ID");
  if (filters.status && !new Set(["not_submitted", "pending", "completed", "redo"]).has(filters.status)) {
    throw new Error("Invalid submission status.");
  }
  return filters;
}

async function adminReviewList(input, adminToken) {
  const filters = normalizeReviewFilters(input.filters || input || {});
  const requestedPage = Math.max(1, Number.parseInt(input.page, 10) || 1);
  const pageSize = Math.min(30, Math.max(10, Number.parseInt(input.pageSize, 10) || 30));
  const result = await request("/rest/v1/rpc/admin_list_photo_homework_reviews", {
    method: "POST",
    service: false,
    token: adminToken,
    body: {
      target_page: requestedPage,
      target_page_size: pageSize,
      target_period_id: filters.periodId || null,
      target_grade: filters.grade || null,
      target_class_id: filters.classId || null,
      target_homework_id: filters.homeworkId || null,
      target_student: filters.student || null,
      target_status: filters.status || null,
    },
  });
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("제출 확인 목록 응답 형식이 올바르지 않습니다.");
  }
  return {
    items: Array.isArray(result.items) ? result.items : [],
    total: Math.max(0, Number(result.total) || 0),
    page: Math.max(1, Number(result.page) || requestedPage),
    pageSize: Math.min(30, Math.max(10, Number(result.pageSize) || pageSize)),
    pendingCount: Math.max(0, Number(result.pendingCount) || 0),
  };
}

async function signedUrlResultsForPhotos(photos) {
  const urls = {};
  const failedPhotoIds = [];
  const active = photos.filter((photo) => !photo.deleted_at);
  for (let index = 0; index < active.length; index += 8) {
    await Promise.all(active.slice(index, index + 8).map(async (photo) => {
      try {
        urls[photo.id] = await signedDownload(photo.storage_path);
      } catch {
        failedPhotoIds.push(photo.id);
      }
    }));
  }
  return {
    urls,
    failedPhotoIds,
    signedUrlExpiresAt: new Date(Date.now() + SIGNED_URL_SECONDS * 1000).toISOString(),
  };
}

async function signedUrlsForPhotos(photos) {
  const urls = {};
  const active = photos.filter((photo) => !photo.deleted_at);
  for (let index = 0; index < active.length; index += 8) {
    await Promise.all(active.slice(index, index + 8).map(async (photo) => {
      urls[photo.id] = await signedDownload(photo.storage_path);
    }));
  }
  return urls;
}

async function adminReviewDetail(assignmentId) {
  const assignments = await request(`/rest/v1/photo_homework_assignments?id=eq.${assignmentId}&select=*`);
  const assignment = assignments?.[0];
  if (!assignment) throw new Error("Submission was not found.");
  const homeworks = await request(`/rest/v1/photo_homeworks?id=eq.${assignment.homework_id}&select=*`);
  const homework = homeworks?.[0] || null;
  const periods = homework
    ? await request(`/rest/v1/learning_periods?id=eq.${homework.period_id}&select=*`)
    : [];
  const [rounds, photos, deletions] = await Promise.all([
    requestAll(`/rest/v1/photo_submission_rounds?assignment_id=eq.${assignmentId}&select=*&order=round_number.desc`),
    requestAll(`/rest/v1/photo_submission_photos?assignment_id=eq.${assignmentId}&select=*&order=uploaded_at.desc`),
    requestAll(`/rest/v1/photo_deletion_logs?assignment_id=eq.${assignmentId}&select=id,assignment_id,round_number,original_file_name,deleted_at&order=deleted_at.desc`),
  ]);
  return {
    assignment,
    homework,
    period: periods?.[0] || null,
    rounds,
    photos,
    deletions,
    urls: await signedUrlsForPhotos(photos),
  };
}

async function studentAssignmentSummary(studentId, assignmentId) {
  const assignment = await studentAssignmentForStudent(studentId, assignmentId);
  return (await summarizeStudentAssignments([assignment], studentId))[0];
}

async function studentAssignmentDetail(studentId, assignmentId, requestedPage) {
  const assignment = await studentAssignmentForStudent(studentId, assignmentId);
  const pageSize = STUDENT_PHOTO_PAGE_SIZE;
  let page = Math.min(100000, Math.max(1, Number.parseInt(requestedPage, 10) || 1));
  const photoPath = `/rest/v1/photo_submission_photos?assignment_id=eq.${assignmentId}&student_id=eq.${studentId}&deleted_at=is.null&select=id,round_id,assignment_id,storage_path,original_file_name,mime_type,file_size,uploaded_at&order=uploaded_at.desc,id.desc`;
  const [rounds, deletions, initialPhotoPage] = await Promise.all([
    requestAll(`/rest/v1/photo_submission_rounds?assignment_id=eq.${assignmentId}&select=id,assignment_id,round_number,submitted_at&order=round_number.desc`),
    requestAll(`/rest/v1/photo_deletion_logs?assignment_id=eq.${assignmentId}&student_id=eq.${studentId}&select=id,assignment_id,round_number,original_file_name,deleted_at&order=deleted_at.desc`),
    requestPage(photoPath, { offset: (page - 1) * pageSize, limit: pageSize }),
  ]);
  const total = initialPhotoPage.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  let photoPage = initialPhotoPage;
  if (page > totalPages) {
    page = totalPages;
    photoPage = await requestPage(photoPath, { offset: (page - 1) * pageSize, limit: pageSize });
  }
  const signed = await signedUrlResultsForPhotos(photoPage.data);
  const safePhotos = photoPage.data.map(({ storage_path, ...photo }) => photo);
  const latestRoundAt = rounds.reduce((latest, round) =>
    !latest || String(round.submitted_at || "") > String(latest) ? round.submitted_at : latest, null);
  const latestPhotoAt = page === 1 ? safePhotos[0]?.uploaded_at || null : null;
  const latestSubmittedAt = latestPhotoAt && (!latestRoundAt || String(latestPhotoAt) > String(latestRoundAt))
    ? latestPhotoAt
    : latestRoundAt;
  return {
    assignment: {
      ...assignment,
      photo_count: total,
      round_count: rounds.length,
      latest_submitted_at: latestSubmittedAt || null,
    },
    rounds,
    photos: safePhotos,
    deletions,
    urls: signed.urls,
    failedPhotoIds: signed.failedPhotoIds,
    signedUrlExpiresAt: signed.signedUrlExpiresAt,
    page: {
      page,
      pageSize,
      total,
      loaded: safePhotos.length,
      hasMore: page * pageSize < total,
    },
  };
}

async function signedDownload(path) {
  const data = await request(`/storage/v1/object/sign/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", body: { expiresIn: SIGNED_URL_SECONDS } });
  const signed = data.signedURL || data.signedUrl || data.signed_url;
  if (!signed) throw new Error("사진 열람 주소를 만들지 못했습니다.");
  return signed.startsWith("http") ? signed : `${supabaseBaseUrl()}/storage/v1${signed}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST 요청만 허용됩니다." });
  try {
    const input = JSON.parse(event.body || "{}");
    const action = input.action;

    if (action === "student-login") {
      const loginName = String(input.name || "");
      const ip = clientIp(event);

      const gate = await rateCheck(loginName, ip);
      if (gate.blocked) {
        const minutes = Math.max(1, Math.ceil(gate.retryAfter / 60));
        return {
          statusCode: 429,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "Retry-After": String(gate.retryAfter),
          },
          body: JSON.stringify({
            error: `로그인 시도가 너무 많습니다. ${minutes}분 뒤에 다시 시도해주세요.`,
          }),
        };
      }
      // 실패가 쌓인 이름은 응답을 조금씩 늦춰 자동화된 시도를 느리게 만듭니다.
      if (gate.delaySeconds > 0) await sleep(gate.delaySeconds * 1000);

      // service_role로 호출합니다. login_student의 anon 실행 권한을 회수해도
      // 이 경로는 계속 동작하며, 브라우저에서 RPC를 직접 호출할 수 없게 됩니다.
      const rows = await request("/rest/v1/rpc/login_student", { method: "POST", service: true, body: { student_name: input.name, student_password: input.password } });
      const student = rows?.[0];
      if (!student) {
        await rateRecord(loginName, ip, false);
        return json(401, { error: "학생 이름과 비밀번호를 확인해주세요." });
      }
      const verifiedStudent = await activeStudent(student.id);
      await rateRecord(loginName, ip, true);
      const session = signStudent(verifiedStudent, Boolean(input.remember));
      return json(200, { ...session, student: publicStudent(verifiedStudent) });
    }

    if (action === "student-session") {
      const session = verifyStudent(bearer(event));
      const student = await activeStudent(session.sub);
      if (!student) return json(401, { error: "학생 세션이 유효하지 않습니다. 다시 로그인해주세요." });
      return json(200, { student: publicStudent(student) });
    }

    if (action === "student-dashboard") {
      const { student } = await requireStudent(event);
      return json(200, await studentDashboard(student.id));
    }

    if (action === "student-assignment-summary") {
      const { student } = await requireStudent(event);
      requireUuid(input.assignmentId, "숙제 배정 ID");
      return json(200, { assignment: await studentAssignmentSummary(student.id, input.assignmentId) });
    }

    if (action === "student-assignment-detail") {
      const { student } = await requireStudent(event);
      requireUuid(input.assignmentId, "숙제 배정 ID");
      return json(200, await studentAssignmentDetail(student.id, input.assignmentId, input.page));
    }

    if (action === "create-upload-urls") {
      const { student } = await requireStudent(event);
      requireUuid(input.assignmentId, "숙제 배정 ID");
      const files = Array.isArray(input.files) ? input.files : [];
      if (!files.length || files.length > 10) throw new Error("사진은 한 번에 1~10장까지 선택할 수 있습니다.");
      const assignments = await request(`/rest/v1/photo_homework_assignments?id=eq.${input.assignmentId}&student_id=eq.${student.id}&select=id,homework_id,status,student_id`);
      const assignment = assignments[0];
      if (!assignment) throw new Error("배정된 숙제가 아닙니다.");
      if (assignment.status === "completed") throw new Error("확인 완료된 숙제입니다.");
      await requireOpenAssignment(student.id, input.assignmentId, assignment);
      const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
      const urls = [];
      for (const file of files) {
        if (!allowed.has(file.type) || file.size < 1 || file.size > 10485760) throw new Error("허용되지 않은 사진 형식 또는 크기입니다.");
        const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
        const path = `${student.id}/${assignment.homework_id}/${crypto.randomUUID()}.${ext}`;
        const signed = await request(`/storage/v1/object/upload/sign/${BUCKET}/${path}`, { method: "POST", body: {} });
        const signedURL = signed.url || signed.signedURL || signed.signedUrl;
        if (!signedURL) throw new Error("사진 업로드 주소를 만들지 못했습니다.");
        urls.push({ path, token: signed.token, signedUrl: signedURL.startsWith("http") ? signedURL : `${supabaseBaseUrl()}/storage/v1${signedURL}` });
      }
      return json(200, { uploads: urls });
    }

    if (action === "finalize-upload") {
      const { student } = await requireStudent(event);
      requireUuid(input.assignmentId, "숙제 배정 ID");
      const assignments = await request(`/rest/v1/photo_homework_assignments?id=eq.${input.assignmentId}&student_id=eq.${student.id}&select=id,homework_id,status,student_id`);
      const assignment = assignments?.[0];
      if (!assignment) throw new Error("배정된 숙제가 아닙니다.");
      const storagePath = String(input.path || "");
      const expectedPath = new RegExp(`^${student.id}/${assignment.homework_id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`, "i");
      if (!expectedPath.test(storagePath)) throw new Error("잘못된 파일 경로입니다.");
      try {
        await requireOpenAssignment(student.id, input.assignmentId, assignment);
        const head = await fetch(`${supabaseBaseUrl()}/storage/v1/object/${BUCKET}/${storagePath}`, { method: "HEAD", headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}` } });
        if (!head.ok) throw new Error("업로드된 사진을 확인할 수 없습니다.");
        const actualSize = Number(head.headers.get("content-length")) || Number(input.size);
        const actualType = String(head.headers.get("content-type") || input.type).split(";")[0];
        if (actualSize < 1 || actualSize > 10485760 || !["image/jpeg", "image/png", "image/webp"].includes(actualType)) throw new Error("업로드된 파일 형식 또는 크기가 허용 범위를 벗어났습니다.");
        const id = await request("/rest/v1/rpc/server_add_photo", { method: "POST", body: { target_student_id: student.id, target_assignment_id: input.assignmentId, target_storage_path: storagePath, target_original_name: input.originalName, target_mime_type: actualType, target_file_size: actualSize } });
        return json(200, { id });
      } catch (error) {
        let savedPhotos;
        try {
          const params = new URLSearchParams({
            storage_path: `eq.${storagePath}`,
            student_id: `eq.${student.id}`,
            assignment_id: `eq.${input.assignmentId}`,
            deleted_at: "is.null",
            select: "id",
          });
          savedPhotos = await request(`/rest/v1/photo_submission_photos?${params.toString()}`);
        } catch {
          // DB commit 여부를 확인할 수 없으면 메타데이터와 실제 파일의 불일치를 피하기 위해 파일을 남긴다.
          throw error;
        }
        if (savedPhotos?.[0]?.id) return json(200, { id: savedPhotos[0].id });
        await request(`/storage/v1/object/${BUCKET}/${storagePath}`, { method: "DELETE", body: undefined }).catch(() => null);
        throw error;
      }
    }

    if (action === "delete-photo") {
      const { student } = await requireStudent(event);
      requireUuid(input.photoId, "사진 ID");
      const photos = await request(`/rest/v1/photo_submission_photos?id=eq.${input.photoId}&student_id=eq.${student.id}&deleted_at=is.null&select=id,assignment_id`);
      const photo = photos?.[0];
      if (!photo) throw new Error("사진을 찾을 수 없습니다.");
      await requireOpenAssignment(student.id, photo.assignment_id);
      const path = await request("/rest/v1/rpc/server_delete_photo", { method: "POST", body: { target_student_id: student.id, target_photo_id: input.photoId } });
      await request(`/storage/v1/object/${BUCKET}/${path}`, { method: "DELETE", body: undefined });
      return json(200, { ok: true });
    }

    if (action === "student-photo-urls") {
      const { student } = await requireStudent(event);
      const ids = Array.isArray(input.photoIds) ? input.photoIds.slice(0, 50) : [];
      ids.forEach((id) => requireUuid(id, "사진 ID"));
      if (!ids.length) return json(200, { urls: {} });
      const photos = await request(`/rest/v1/photo_submission_photos?id=in.(${ids.join(",")})&student_id=eq.${student.id}&deleted_at=is.null&select=id,storage_path`);
      return json(200, await signedUrlResultsForPhotos(photos));
    }

    if (action === "admin-review-list") {
      const adminToken = await requireAdmin(event);
      return json(200, await adminReviewList(input, adminToken));
    }

    if (action === "admin-review-detail") {
      await requireAdmin(event);
      requireUuid(input.assignmentId, "숙제 배정 ID");
      return json(200, await adminReviewDetail(input.assignmentId));
    }

    if (action === "admin-delete-submission") {
      await requireAdmin(event);
      requireUuid(input.assignmentId, "숙제 배정 ID");
      const assignments = await request(`/rest/v1/photo_homework_assignments?id=eq.${input.assignmentId}&select=id,status,student_id`);
      const assignment = assignments[0];
      if (!assignment) throw new Error("제출 정보를 찾을 수 없습니다.");
      if (assignment.status !== "completed") throw new Error("완료 처리된 제출물만 삭제할 수 있습니다.");

      const [photos, rounds] = await Promise.all([
        requestAll(`/rest/v1/photo_submission_photos?assignment_id=eq.${input.assignmentId}&deleted_at=is.null&select=id,round_id,assignment_id,student_id,storage_path,original_file_name`),
        requestAll(`/rest/v1/photo_submission_rounds?assignment_id=eq.${input.assignmentId}&select=id,round_number`),
      ]);
      const roundById = Object.fromEntries(rounds.map((round) => [round.id, round.round_number]));
      const deletedAt = new Date().toISOString();

      if (photos.length) {
        await request("/rest/v1/photo_deletion_logs", {
          method: "POST",
          body: photos.map((photo) => ({
            photo_id: photo.id,
            assignment_id: photo.assignment_id,
            student_id: photo.student_id,
            round_number: roundById[photo.round_id] || 1,
            original_file_name: photo.original_file_name,
            storage_path: photo.storage_path,
            deleted_at: deletedAt,
          })),
        });
        await request(`/rest/v1/photo_submission_photos?assignment_id=eq.${input.assignmentId}&deleted_at=is.null`, {
          method: "PATCH",
          body: { deleted_at: deletedAt },
        });
        await Promise.all(photos.map((photo) =>
          request(`/storage/v1/object/${BUCKET}/${photo.storage_path}`, { method: "DELETE", body: undefined }).catch(() => null)
        ));
      }

      await request(`/rest/v1/photo_homework_assignments?id=eq.${input.assignmentId}`, {
        method: "PATCH",
        body: { status: "not_submitted", admin_feedback: "", reviewed_at: null },
      });
      return json(200, { ok: true, deleted: photos.length });
    }

    if (action === "admin-photo-urls") {
      await requireAdmin(event);
      const ids = Array.isArray(input.photoIds) ? input.photoIds.slice(0, 100) : [];
      ids.forEach((id) => requireUuid(id, "사진 ID"));
      if (!ids.length) return json(200, { urls: {} });
      const photos = await request(`/rest/v1/photo_submission_photos?id=in.(${ids.join(",")})&deleted_at=is.null&select=id,storage_path`);
      const urls = {};
      for (const photo of photos) urls[photo.id] = await signedDownload(photo.storage_path);
      return json(200, { urls });
    }

    return json(400, { error: "알 수 없는 요청입니다." });
  } catch (error) {
    return json(/로그인|세션|권한/.test(error.message) ? 401 : 400, { error: error.message });
  }
};
