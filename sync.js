// Utmost 자동 동기화 — Firebase(프로젝트: yb-evernote) Google 로그인 + Firestore
// 저장 위치: users/{uid}/utmost/{MM-DD} → { memo, memoTs, hl: { 어절키: {c, t} } }
// 보안: yb-evernote 의 Firestore 규칙(허용 계정만, 각자 users/{uid} 만)을 그대로 사용
//
// 충돌을 줄이는 방식
//  - 형광펜: 어절 하나하나가 각자 수정 시각(t)을 가짐 → 두 기기가 다른 어절을 칠해도 모두 보존
//    (지운 것도 c:null 로 시각과 함께 남겨 다른 기기에 전달)
//  - 메모: 마지막으로 맞춘 버전(base) 이후 양쪽에서 모두 고쳤다면 둘 중 하나를 버리지 않고 이어 붙임
//  - 올릴 때는 트랜잭션으로 '읽고-합치고-쓰기'를 한 번에 → 동시에 올려도 덮어쓰기로 사라지지 않음
//  - 실시간 구독(onSnapshot)으로 다른 기기의 변경을 곧바로 받음
import { initializeApp } from './vendor/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut,
} from './vendor/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, onSnapshot, runTransaction } from './vendor/firebase-firestore.js';

// 프로젝트 식별 정보(비밀번호 아님). 데이터 보호는 Firestore 보안 규칙이 담당.
const firebaseConfig = {
  apiKey: 'AIzaSyDed_82FnYLwIu69xiGZ86pu4oOsCHp8h4',
  authDomain: 'yb-evernote.firebaseapp.com',
  projectId: 'yb-evernote',
  storageBucket: 'yb-evernote.firebasestorage.app',
  messagingSenderId: '361528963812',
  appId: '1:361528963812:web:6d63b1dddcb377cd0572f1',
};
const app = initializeApp(firebaseConfig, 'utmost');   // EverNote 로그인과 분리
const auth = getAuth(app);
auth.languageCode = 'ko';
const db = getFirestore(app);

const UT = window.UT;   // index.html 의 로컬 저장소 접근자
let user = null, unsub = null;
const state = { email: null, ready: false, busy: 0, last: null, error: null, connecting: false };
const listeners = new Set();
const emit = () => listeners.forEach((f) => f({ ...state }));
export function onState(f) { listeners.add(f); f({ ...state }); }
export const isOn = () => !!user;

function msg(e) {
  const c = (e && e.code) || '';
  if (c.includes('permission-denied')) return '이 Google 계정은 사용할 수 없습니다(허용 목록 밖).';
  if (c === 'auth/unauthorized-domain') return '현재 주소가 Firebase 승인 도메인에 없습니다.';
  if (c === 'auth/network-request-failed' || c.includes('unavailable') || c === 'auth/internal-error') return '네트워크 연결을 확인해 주십시오.';
  return c || (e && e.message) || '알 수 없는 오류';
}

/* ---------- 합치기 ---------- */
const DIV = (t) => `<div>──── 다른 기기에서 쓴 메모 (${new Date(t).toLocaleString('ko-KR')}) ────</div>`;
function normHL(h, fallbackT) {
  const o = {};
  Object.entries(h || {}).forEach(([k, v]) => {
    if (v && typeof v === 'object') o[k] = { c: v.c ?? null, t: v.t || 0 };
    else o[k] = { c: v || null, t: fallbackT || 0 };          // 이전 형식("y") 호환
  });
  return o;
}
/** 원격 문서 r 을 로컬에 합침. 원격에 없는/더 최신인 로컬 내용이 있으면 true(올려야 함) */
function mergeDay(id, r) {
  UT.flushMemo();
  const L = UT.getDay(id);
  let needPush = false, changed = false;
  // 형광펜: 어절별 최신 시각 우선
  const rh = normHL(r.hl, r.memoTs || r.ts), lh = { ...L.hl };
  new Set([...Object.keys(rh), ...Object.keys(lh)]).forEach((k) => {
    const a = lh[k], b = rh[k];
    if (b && (!a || b.t > a.t)) { lh[k] = b; changed = true; }
    else if (a && (!b || a.t > b.t)) needPush = true;
  });
  if (changed) UT.setHL(id, lh);
  // 메모
  const lt = L.memoTs, rt = r.memoTs || r.ts || 0, base = L.base, lm = L.memo, rm = r.memo || '';
  if (rt > lt) {
    if (lt > base && lm && rm && lm !== rm) {                 // 양쪽 모두 고침 → 이어 붙임
      UT.setMemo(id, lm + DIV(rt) + rm, Date.now()); needPush = true; changed = true;
    } else { UT.setMemo(id, rm, rt); changed = true; }
    UT.setBase(id, rt);
  } else if (lt > rt) {
    if (rt > base && lm && rm && lm !== rm) {
      UT.setMemo(id, lm + DIV(rt) + rm, Date.now()); changed = true;
    }
    UT.setBase(id, rt);
    needPush = true;
  }
  if (changed) UT.refresh(id);
  return needPush;
}

/* ---------- 올리기 ---------- */
const ref = (id) => doc(db, 'users', user.uid, 'utmost', id);
async function upload(id) {
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(id));
    if (s.exists()) mergeDay(id, s.data());
    const L = UT.getDay(id);
    tx.set(ref(id), { memo: L.memo, memoTs: L.memoTs, hl: L.hl });
  });
  UT.setBase(id, UT.getDay(id).memoTs);
  UT.clearPending(id);
}
const timers = {};
export function push(id) {
  UT.addPending(id);
  if (!user) return;
  clearTimeout(timers[id]);
  timers[id] = setTimeout(() => run(() => upload(id)), 800);
}
async function run(fn) {
  state.busy++; emit();
  try { await fn(); state.last = Date.now(); state.error = null; }
  catch (e) { state.error = msg(e); }
  state.busy--; emit();
}
/** 아직 못 올린 변경을 모두 올림(앱을 다시 열거나 네트워크가 돌아왔을 때) */
export function flushPending() {
  if (!user) return;
  UT.pendingIds().forEach((id) => { clearTimeout(timers[id]); run(() => upload(id)); });
}

/* ---------- 실시간 받기 ---------- */
function subscribe() {
  if (unsub) unsub();
  state.busy++; emit();
  let first = true;
  unsub = onSnapshot(collection(db, 'users', user.uid, 'utmost'), (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) return;
      if (mergeDay(ch.doc.id, ch.doc.data())) push(ch.doc.id);
    });
    if (first) {                                   // 처음 한 번: 로컬에만 있는 날짜도 올림
      first = false; state.busy--;
      const remote = new Set(snap.docs.map((d) => d.id));
      UT.localIds().forEach((id) => { if (!remote.has(id)) push(id); });
      flushPending();
    }
    state.last = Date.now(); state.error = null; emit();
  }, (e) => { if (first) { first = false; state.busy--; } state.error = msg(e); emit(); });
}

/* ---------- 로그인 ---------- */
getRedirectResult(auth).catch((e) => { state.error = msg(e); emit(); });
onAuthStateChanged(auth, (u) => {
  user = u; state.email = u ? u.email : null; state.ready = true; state.connecting = false;
  if (u) subscribe(); else if (unsub) { unsub(); unsub = null; }
  emit();
});
/** 앱 로그인: Google 계정 로그인 + 허용 계정인지 확인 → {ok} | {ok:false,error} | {redirect:true} */
export async function login() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  state.error = null;
  if (!user) {
    state.connecting = true; emit();
    try { await signInWithPopup(auth, p); }
    catch (e) {
      state.connecting = false; emit();
      const fallback = ['auth/popup-blocked', 'auth/operation-not-supported-in-environment', 'auth/web-storage-unsupported'];
      if (fallback.includes(e.code)) {
        try { localStorage.setItem('utmost.redirectLogin', 'true'); } catch (_) {}
        signInWithRedirect(auth, p); return { redirect: true };
      }
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return { ok: false };
      return { ok: false, error: msg(e) };
    }
  }
  const u = auth.currentUser;
  try { await getDoc(doc(db, 'users', u.uid, 'utmost', '01-01')); }
  catch (e) {
    if ((e.code || '').includes('permission-denied')) {
      await disconnect();
      return { ok: false, error: `${u.email} 계정은 사용할 수 없습니다(허용 목록 밖).` };
    }
  }
  return { ok: true, email: u.email };
}
export async function connect() {
  if (user || state.connecting) return;
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  state.connecting = true; state.error = null; emit();
  try {
    await signInWithPopup(auth, p);
  } catch (e) {
    state.connecting = false;
    const fallback = ['auth/popup-blocked', 'auth/operation-not-supported-in-environment', 'auth/web-storage-unsupported'];
    if (fallback.includes(e.code)) return signInWithRedirect(auth, p);
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') state.error = msg(e);
    emit();
  }
}
export async function disconnect() {
  if (unsub) { unsub(); unsub = null; }
  await signOut(auth); state.last = null; state.error = null; emit();
}
window.addEventListener('online', flushPending);
