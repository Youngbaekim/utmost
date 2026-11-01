// Utmost cloud sync — Firebase (project: yb-evernote), Google 로그인 + Firestore
// 저장 위치: users/{uid}/utmost/{MM-DD}  →  { memo, hl, ts }
// 보안: yb-evernote 의 Firestore 규칙(허용 계정만, 각자 users/{uid} 만)을 그대로 사용
import { initializeApp } from './vendor/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut,
} from './vendor/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, setDoc } from './vendor/firebase-firestore-lite.js';

// 프로젝트 식별 정보(비밀번호 아님). 데이터 보호는 Firestore 보안 규칙이 담당.
const firebaseConfig = {
  apiKey: 'AIzaSyDed_82FnYLwIu69xiGZ86pu4oOsCHp8h4',
  authDomain: 'yb-evernote.firebaseapp.com',
  projectId: 'yb-evernote',
  storageBucket: 'yb-evernote.firebasestorage.app',
  messagingSenderId: '361528963812',
  appId: '1:361528963812:web:6d63b1dddcb377cd0572f1',
};

const app = initializeApp(firebaseConfig, 'utmost');   // 이름을 따로 두어 EverNote 로그인과 분리
const auth = getAuth(app);
auth.languageCode = 'ko';
const db = getFirestore(app);

const UT = window.UT;            // index.html 이 제공하는 로컬 저장소 접근자
let user = null;
const state = { email: null, busy: false, last: null, error: null, ready: false };
const listeners = new Set();
const emit = () => listeners.forEach((f) => f({ ...state }));
export function onState(f) { listeners.add(f); f({ ...state }); }

function msg(e) {
  const c = (e && e.code) || '';
  if (c.includes('permission-denied')) return '이 Google 계정은 허용 목록에 없습니다.';
  if (c === 'auth/unauthorized-domain') return '현재 주소가 Firebase 승인 도메인에 없습니다.';
  if (c === 'auth/network-request-failed' || c.includes('unavailable')) return '네트워크에 연결할 수 없습니다.';
  if (c === 'auth/internal-error') return '로그인 서버에 연결하지 못했습니다(auth/internal-error). 네트워크 상태를 확인해 주십시오.';
  return c || (e && e.message) || '알 수 없는 오류';
}

getRedirectResult(auth).catch((e) => { state.error = msg(e); emit(); });
onAuthStateChanged(auth, (u) => {
  user = u; state.email = u ? u.email : null; state.ready = true; emit();
  if (u) syncAll();
});

export async function connect() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  state.error = null; emit();
  try {
    await signInWithPopup(auth, p);
  } catch (e) {
    const fallback = ['auth/popup-blocked', 'auth/operation-not-supported-in-environment', 'auth/web-storage-unsupported'];
    if (fallback.includes(e.code)) return signInWithRedirect(auth, p);
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    state.error = msg(e); emit();
  }
}
export async function disconnect() { await signOut(auth); state.last = null; state.error = null; emit(); }

const ref = (id) => doc(db, 'users', user.uid, 'utmost', id);
async function write(id) {
  const d = UT.getDay(id);
  await setDoc(ref(id), { memo: d.memo || '', hl: d.hl || {}, ts: d.ts || Date.now() });
}

/** 전체 동기화: 날짜별로 더 최근에 고친 쪽(ts)이 이김 */
export async function syncAll() {
  if (!user || state.busy) return;
  state.busy = true; state.error = null; emit();
  try {
    const snap = await getDocs(collection(db, 'users', user.uid, 'utmost'));
    const remote = {};
    snap.forEach((d) => { remote[d.id] = d.data(); });
    const ids = new Set([...Object.keys(remote), ...UT.localIds()]);
    const up = []; let changed = false;
    ids.forEach((id) => {
      const r = remote[id], l = UT.getDay(id);
      const lt = l.ts || 0, rt = (r && r.ts) || 0;
      if (rt > lt) { UT.setDay(id, { memo: r.memo || '', hl: r.hl || {}, ts: rt }); changed = true; }
      else if (lt > rt) up.push(id);
    });
    await Promise.all(up.map(write));
    state.last = Date.now();
    if (changed) UT.refresh();
  } catch (e) { state.error = msg(e); }
  state.busy = false; emit();
}

/** 하루치 변경을 잠시 모아서 올림 */
const timers = {};
export function push(id) {
  if (!user) return;
  clearTimeout(timers[id]);
  timers[id] = setTimeout(async () => {
    try { await write(id); state.last = Date.now(); state.error = null; }
    catch (e) { state.error = msg(e); }
    emit();
  }, 1200);
}
export const isOn = () => !!user;
