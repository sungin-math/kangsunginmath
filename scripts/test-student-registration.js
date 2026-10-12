const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(process.argv[2] || path.join(__dirname, "../public/app.js"), "utf8");
const start = source.indexOf("async function saveStudent(event) {");
const end = source.indexOf("async function resetStudentPassword(", start);
assert.ok(start >= 0 && end > start, "학생 등록 함수가 있어야 합니다.");

function setup({ demo = false, edit = false, rpcError = null, pending = null } = {}) {
  const fields = {
    "#studentName": { value: " 등록검증 " },
    "#studentSchool": { value: " 검증학교 " },
    "#studentClassId": { value: "class-test" },
    ...(!edit && { "#studentPassword": { value: "test-password" } }),
  };
  const calls = [];
  const state = { edit: edit ? { type: "student", id: "existing-student" } : null,
    formBusy: "", data: { students: [] }, message: "", openStudentId: "existing-student" };
  const context = vm.createContext({
    state,
    document: { querySelector: (selector) => fields[selector] || null },
    // 실제 app()의 innerHTML 교체처럼 입력한 값이 빈 입력칸으로 바뀝니다.
    render() { for (const field of Object.values(fields)) field.value = ""; },
    supabaseClient: demo ? null : { async rpc(name, payload) {
      calls.push({ name, payload });
      if (pending) await pending;
      return { error: rpcError };
    } },
    async refreshData() { calls.push({ name: "refreshData" }); },
    async writeRecord(table, payload, id) { calls.push({ name: "writeRecord", table, payload, id }); },
    uid: () => "new-student",
    saveDemoData() { calls.push({ name: "saveDemoData" }); },
    duplicateRecordMessage: () => "",
  });
  vm.runInContext(source.slice(start, end), context);
  return { state, fields, calls, save: () => context.saveStudent({ preventDefault() {} }) };
}

test("화면을 다시 그린 뒤에도 RPC에 초기 비밀번호와 학생 정보를 전달합니다", async () => {
  const app = setup();
  await app.save();
  const rpc = app.calls.find((call) => call.name === "admin_create_student");
  assert.equal(rpc.payload.initial_password, "test-password");
  assert.equal(rpc.payload.student_name, "등록검증");
  assert.equal(rpc.payload.student_school, "검증학교");
  assert.equal(rpc.payload.student_class_id, "class-test");
  assert.equal(app.calls.filter((call) => call.name === "refreshData").length, 1);
  assert.equal(app.state.formBusy, "");
});

test("데모 등록도 입력한 비밀번호를 저장합니다", async () => {
  const app = setup({ demo: true });
  await app.save();
  assert.equal(app.state.data.students.length, 1);
  assert.equal(app.state.data.students[0].password, "test-password");
  assert.equal(app.calls[0].name, "saveDemoData");
});

test("기존 학생 수정은 비밀번호 입력칸 없이 처리합니다", async () => {
  const app = setup({ edit: true });
  await app.save();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].name, "writeRecord");
  assert.equal(app.calls[0].id, "existing-student");
  assert.equal(app.calls[0].payload.name, "등록검증");
  assert.equal(app.state.edit, null);
});

test("느린 저장 중 다시 눌러도 등록 RPC를 한 번만 호출합니다", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const app = setup({ pending });
  const first = app.save();
  assert.equal(app.state.formBusy, "student");
  await app.save();
  assert.equal(app.calls.length, 1);
  finish();
  await first;
  assert.equal(app.state.formBusy, "");
});

test("서버 오류는 표시하고 저장 잠금을 해제합니다", async () => {
  const app = setup({ rpcError: { message: "등록 처리 오류" } });
  await app.save();
  assert.equal(app.state.message, "등록 처리 오류");
  assert.equal(app.state.formBusy, "");
  assert.equal(app.calls.some((call) => call.name === "refreshData"), false);
});
