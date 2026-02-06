<template>
  <div class="admin-container">

    <div class="admin-card">
      <!-- ✅ 헤더 -->
      <div class="header">
        <h2>유지커피웍스 관리자</h2>
      </div>

      <!-- ✅ 로그인 (매직링크) -->
      <div v-if="!user" class="form-box">
        <input v-model="email" placeholder="이메일" />

        <button class="main-btn" @click="sendMagicLink" :disabled="loading">
          {{ loading ? "발송 중..." : "로그인 링크 보내기" }}
        </button>

        <p class="hint">메일함에서 로그인 링크를 누르면 자동 로그인됩니다.</p>
      </div>

      <!-- ✅ 로그인 후 -->
      <div v-else>
        <!-- ✅ 탭 버튼 -->
        <div class="tabs">
          <button :class="{ active: activeTab === 'menu' }" @click="activeTab = 'menu'">
            메뉴 관리
          </button>

          <button :class="{ active: activeTab === 'admin' }" @click="activeTab = 'admin'">
            관리자 관리
          </button>
        </div>

        <!-- ✅ 메뉴 관리 탭 -->
        <div v-if="activeTab === 'menu'" class="form-box">
          <!-- 언어 선택 -->
          <select v-model="selectedLang">
            <option value="korean">🇰🇷 한국어</option>
            <option value="english">🇺🇸 영어</option>
            <option value="japanese">🇯🇵 일본어</option>
            <option value="chinese">🇨🇳 중국어</option>
          </select>

          <!-- 파일명 표시 -->
          <p class="file-info">
            파일명:
            <b>{{ uploadFileName }}</b>
          </p>

          <!-- ✅ 현재 노출되는 메뉴 이미지 (새로고침 버튼 때만 캐시 버스트) -->
          <div style="text-align:center;">
            <img
              v-if="menuPreviewUrl"
              :src="menuPreviewUrl"
              alt="menu preview"
              style="width: 100%; border-radius: 10px; border: 1px solid #eee;"
              draggable="false"
            />
          </div>

          <button class="sub-btn" type="button" @click="refreshPreview" :disabled="loading">
            이미지 새로고침
          </button>

          <!-- 파일 선택 -->
          <input type="file" @change="handleFile" />

          <!-- 업로드 버튼 -->
          <button class="main-btn" @click="uploadMenu" :disabled="!file || loading">
            {{ loading ? "업로드 중..." : "메뉴 교체 업로드" }}
          </button>
        </div>

        <!-- ✅ 관리자 관리 탭 -->
        <div v-if="activeTab === 'admin'" class="form-box">
          <p class="hint" v-if="isSuperAdmin">슈퍼관리자 전용: 관리자 이메일 초대</p>
          <p class="hint" v-else>슈퍼관리자만 관리자 추가가 가능합니다.</p>

          <input v-model="newAdminEmail" placeholder="추가할 관리자 이메일" :disabled="!isSuperAdmin" />

          <button class="main-btn" @click="addAdmin" :disabled="!isSuperAdmin || !newAdminEmail || loading">
            {{ loading ? "초대 중..." : "관리자 추가(초대 메일)" }}
          </button>
        </div>
      </div>

      <!-- ✅ 메시지 -->
      <p class="message">{{ message }}</p>

      <!-- ✅ 하단 액션 -->
      <div v-if="user" class="bottom-actions">
        <router-link to="/" class="back-link">메뉴로 돌아가기</router-link>
        <button class="logout-btn" @click="logout" :disabled="loading">로그아웃</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { supabase } from "@/lib/supabase";

/* ------------------------------
   ✅ 상수/상태
------------------------------ */
const SUPER_ADMIN_EMAIL = "nxmdev02@gmail.com";

const email = ref("");
const user = ref(null);
const message = ref("");
const loading = ref(false);

const activeTab = ref("menu");

/* ------------------------------
   ✅ 권한 helper
------------------------------ */
const isSuperAdmin = computed(() => user.value?.email === SUPER_ADMIN_EMAIL);

async function ensureAdminAccess(currentUser) {
  // 0) 슈퍼관리자면 무조건 통과 + admin_users 보장
  if (currentUser.email === SUPER_ADMIN_EMAIL) {
    await supabase.from("admin_users").upsert({ email: currentUser.email }, { onConflict: "email" });
    return true;
  }

  // 1) 이미 admin_users에 있으면 통과
  const { data: adminRow, error: adminErr } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", currentUser.email)
    .maybeSingle();

  if (adminErr) throw adminErr;
  if (adminRow) return true;

  // 2) admin_users 없으면: 초대 상태 확인
  const { data: inviteRow, error: inviteErr } = await supabase
    .from("admin_invites")
    .select("email, status")
    .eq("email", currentUser.email)
    .maybeSingle();

  if (inviteErr) throw inviteErr;

  if (!inviteRow || inviteRow.status === "revoked") {
    return false;
  }

  // 3) 초대된 사용자면: admin_users 등록 + invite accepted 처리
  const { error: upsertErr } = await supabase
    .from("admin_users")
    .upsert({ email: currentUser.email }, { onConflict: "email" });

  if (upsertErr) throw upsertErr;

  await supabase.from("admin_invites").update({ status: "accepted" }).eq("email", currentUser.email);

  return true;
}

/* ------------------------------
   ✅ 세션 복구 + Auth 구독 (로그인 시 권한검증 포함)
------------------------------ */
let authSub;

async function handleAuthedSession(session) {
  const u = session?.user || null;

  if (!u) {
    user.value = null;
    return;
  }

  try {
    const ok = await ensureAdminAccess(u);

    if (!ok) {
      message.value = "❌ 관리자 초대된 계정만 접근 가능합니다.";
      await supabase.auth.signOut();
      user.value = null;
      return;
    }

    user.value = u;
    message.value = "✅ 로그인 성공";

    // 로그인 후 메뉴 프리뷰 갱신(캐시 그대로: 기본은 v=0)
    await refreshMenuPreview(false);

    // URL hash 토큰 제거(깔끔하게)
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  } catch (e) {
    message.value = "❌ 권한 확인 실패";
    await supabase.auth.signOut();
    user.value = null;
  }
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  await handleAuthedSession(data.session);

  const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
    await handleAuthedSession(session);
  });

  authSub = sub.subscription;
});

onUnmounted(() => authSub?.unsubscribe());

/* ------------------------------
   ✅ 매직링크 로그인
------------------------------ */
async function sendMagicLink() {
  message.value = "";

  if (!email.value) {
    message.value = "❌ 이메일 입력하세요.";
    return;
  }

  loading.value = true;

  const SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;

  const { error } = await supabase.auth.signInWithOtp({
    email: email.value,
    options: {
      emailRedirectTo: `${SITE_URL}/admin`,
    },
  });

  loading.value = false;

  if (error) {
    message.value = "❌ 로그인 링크 발송 실패: " + error.message;
    return;
  }

  message.value = "✅ 로그인 링크를 이메일로 보냈습니다. 메일함을 확인하세요.";
}

/* ------------------------------
   ✅ 로그아웃
------------------------------ */
async function logout() {
  loading.value = true;
  await supabase.auth.signOut();
  loading.value = false;

  user.value = null;
  message.value = "로그아웃되었습니다.";
}

/* ------------------------------
   ✅ 메뉴 업로드 + 프리뷰 (새로고침 버튼 눌러야만 캐시 버스트)
------------------------------ */
const file = ref(null);
const selectedLang = ref("korean");

const fileMap = {
  korean: "menu-korean.jpg",
  english: "menu-english.jpg",
  japanese: "menu-japanese.jpg",
  chinese: "menu-chinese.jpg",
};

const uploadFileName = computed(() => fileMap[selectedLang.value]);

function handleFile(e) {
  file.value = e.target.files?.[0] || null;
}

// 프리뷰 URL + 버전(기본 0, 새로고침 버튼 눌렀을 때만 갱신)
const previewVersion = ref(0);
const menuPreviewUrl = ref("");

async function refreshMenuPreview(bust = false) {
  if (bust) previewVersion.value = Date.now();

  const { data } = supabase.storage.from("menu").getPublicUrl(uploadFileName.value);
  const publicUrl = data?.publicUrl;

  menuPreviewUrl.value = publicUrl ? `${publicUrl}?v=${previewVersion.value}` : "";
}

// 언어 바꾸면 "같은 v"로만 갱신(캐시 버스트는 새로고침 버튼에서만)
async function onChangeLang() {
  await refreshMenuPreview(false);
}

async function refreshPreview() {
  await refreshMenuPreview(true);
}

async function uploadMenu() {
  if (!file.value) return;

  if (!file.value.type?.startsWith("image/")) {
    message.value = "❌ 이미지 파일만 업로드 가능합니다.";
    return;
  }

  loading.value = true;
  message.value = "업로드 중...";

  const { error } = await supabase.storage.from("menu").upload(uploadFileName.value, file.value, {
    upsert: true,
    cacheControl: "0",
  });

  loading.value = false;

  if (error) {
    message.value = "❌ 업로드 실패: " + error.message;
    return;
  }

  message.value = "✅ 업로드 성공! (이미지 새로고침 버튼을 누르면 최신으로 보입니다)";
  file.value = null;
}

/* selectedLang 변화 감지: watch 없이도 간단히 */
const _origSetter = selectedLang.value;
Object.defineProperty(selectedLang, "value", {
  get() {
    return _origSetter;
  },
  set(v) {
    // eslint-disable-next-line no-param-reassign
    selectedLang._value = v;
    onChangeLang();
  },
});

/* ------------------------------
   ✅ 관리자 추가(초대): 슈퍼관리자만
------------------------------ */
const newAdminEmail = ref("");

async function addAdmin() {
  if (!user.value?.email || user.value.email !== SUPER_ADMIN_EMAIL) {
    message.value = "❌ 슈퍼관리자만 관리자 추가가 가능합니다.";
    return;
  }

  if (!newAdminEmail.value) {
    message.value = "❌ 이메일 입력하세요.";
    return;
  }

  loading.value = true;
  message.value = "초대 메일 발송 중...";

  // 1) 초대 테이블 기록
  const { error: inviteErr } = await supabase.from("admin_invites").upsert(
    { email: newAdminEmail.value, status: "pending" },
    { onConflict: "email" }
  );

  if (inviteErr) {
    loading.value = false;
    message.value = "❌ 초대 기록 실패: " + inviteErr.message;
    return;
  }

  // 2) 매직링크 발송
  const SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;

  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email: newAdminEmail.value,
    options: { emailRedirectTo: `${SITE_URL}/admin` },
  });

  loading.value = false;

  if (otpErr) {
    message.value = "❌ 초대 메일 발송 실패: " + otpErr.message;
    return;
  }

  message.value = "✅ 초대 메일 발송 완료 (메일 링크로 로그인하면 자동 등록됩니다)";
  newAdminEmail.value = "";
}
</script>

<style scoped>
.admin-container {
  width: 100vw;
  height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f7f7f7;
}

.admin-card {
  width: 400px;
  background: white;
  padding: 30px;
  border-radius: 18px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}

/* 헤더 */
.header {
  margin-bottom: 50px;
}

h2 {
  font-size: 22px;
  font-weight: 700;
}

/* 탭 */
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 15px;
}

.tabs button {
  flex: 1;
  padding: 10px;
  border: none;
  cursor: pointer;
  border-radius: 10px;
  background: #eee;
  font-size: 13px;
}

.tabs button.active {
  background: #333;
  color: white;
}

/* 폼 */
.form-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

input,
select {
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.file-info {
  font-size: 13px;
  color: #444;
}

.main-btn {
  padding: 10px;
  border-radius: 8px;
  border: none;
  background: #333;
  color: white;
  cursor: pointer;
}

.sub-btn {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}

.main-btn:disabled,
.sub-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hint {
  font-size: 12px;
  color: #666;
}

.message {
  margin-top: 15px;
  font-size: 13px;
  color: #444;
}

/* 하단 액션 */
.bottom-actions {
  margin-top: 25px;
  display: flex;
  justify-content: center;
  gap: 14px;
}

.back-link {
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  text-decoration: none;
  background: #fff;
  color: #333;
  transition: 0.2s;
}

.back-link:hover {
  background: #333;
  color: white;
}

.logout-btn {
  padding: 8px 14px;
  border-radius: 10px;
  border: none;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  background: #fff;
  color: #c0392b;
  transition: 0.2s;
}

.logout-btn:hover {
  background: #c0392b;
  color: white;
}
</style>