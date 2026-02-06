<template>
  <div class="admin-container">
    <div class="admin-card">
      <!-- ✅ 헤더 -->
      <div class="header">
        <h2>유지커피웍스 관리자</h2>
      </div>

      <!-- ✅ 로그인 -->
      <div v-if="!user" class="form-box">
        <input v-model="email" placeholder="이메일" />
        <input v-model="password" type="password" placeholder="비밀번호" />

        <button class="main-btn" @click="login">로그인</button>
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

          <!-- ✅ 현재 노출되는 메뉴 이미지 (캐시 무시 버전) -->
          <div style="text-align:center;">
            <img
              v-if="menuPreviewUrl"
              :src="menuPreviewUrl"
              alt="menu preview"
              style="width: 100%; border-radius: 10px; border: 1px solid #eee;"
            />
          </div>

          <!-- 파일 선택 -->
          <input type="file" @change="handleFile" />

          <!-- 업로드 버튼 -->
          <button class="main-btn" @click="uploadMenu" :disabled="!file">
            메뉴 교체 업로드
          </button>
        </div>

        <!-- ✅ 관리자 관리 탭 -->
        <div v-if="activeTab === 'admin'" class="form-box">
          <input v-model="newAdminEmail" placeholder="추가할 관리자 이메일" />
          <button class="main-btn" @click="addAdmin">관리자 추가</button>
        </div>
      </div>

      <!-- ✅ 메시지 -->
      <p class="message">{{ message }}</p>

      <!-- ✅ 하단 액션 -->
      <div v-if="user" class="bottom-actions">
        <router-link to="/" class="back-link">메뉴로 돌아가기</router-link>
        <button class="logout-btn" @click="logout">로그아웃</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { supabase } from "@/lib/supabase";

/* ------------------------------
   ✅ 상태
------------------------------ */
const email = ref("");
const password = ref("");
const user = ref(null);
const message = ref("");
const activeTab = ref("menu");

/* ------------------------------
   ✅ 로그인 세션 복구 + auth 구독 (중복 등록 방지)
------------------------------ */
let authSub;

onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  user.value = data.session?.user || null;

  const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
    user.value = session?.user || null;
  });

  authSub = sub.subscription;
});

onUnmounted(() => {
  authSub?.unsubscribe();
});

/* ------------------------------
   ✅ 메뉴 업로드 + 캐시 무시 프리뷰
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
  file.value = e.target.files[0];
}

// ✅ 현재 메뉴 이미지 URL (캐시 무시: ?v=timestamp)
const menuPreviewUrl = ref("");

async function refreshMenuPreview() {
  const { data } = supabase.storage.from("menu").getPublicUrl(uploadFileName.value);
  const publicUrl = data?.publicUrl;

  // publicUrl이 있어도 캐시 때문에 안 바뀌니 쿼리로 무조건 bust
  menuPreviewUrl.value = publicUrl ? `${publicUrl}?v=${Date.now()}` : "";
}

// 언어 바뀔 때마다 프리뷰 갱신
const selectedLangWatcher = computed(() => selectedLang.value);
onMounted(() => {
  refreshMenuPreview();
});

// watch를 쓰고 싶으면 아래처럼 (현재는 computed만으로는 감지가 안되므로 watch 권장)
import { watch } from "vue";
watch(selectedLang, () => {
  refreshMenuPreview();
});

/* ------------------------------
   ✅ 로그인 (슈퍼관리자 우선 통과)
------------------------------ */
async function login() {
  message.value = "";

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  });

  if (error) {
    message.value = "❌ 로그인 실패: " + error.message;
    return;
  }

  // ✅ 서버에서 유저 재조회
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const loginUser = userRes?.user;

  if (userErr || !loginUser) {
    message.value = "❌ 유저 정보 조회 실패";
    await supabase.auth.signOut();
    return;
  }

  if (!loginUser.email_confirmed_at) {
    message.value = "❌ 이메일 인증 후 로그인 가능합니다.";
    await supabase.auth.signOut();
    return;
  }

  // ✅ 이미 admin_users에 있으면 바로 통과 (슈퍼관리자)
  const { data: alreadyAdmin, error: adminCheckErr } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", loginUser.email)
    .maybeSingle();

  if (adminCheckErr) {
    message.value = "❌ 관리자 확인 실패: " + adminCheckErr.message;
    await supabase.auth.signOut();
    return;
  }

  if (alreadyAdmin) {
    user.value = loginUser;
    return;
  }

  // ✅ admin_users에 없으면 초대 여부 확인
  const { data: inviteData, error: inviteErr } = await supabase
    .from("admin_invites")
    .select("email, status")
    .eq("email", loginUser.email)
    .maybeSingle();

  if (inviteErr) {
    message.value = "❌ 초대 정보 조회 실패: " + inviteErr.message;
    await supabase.auth.signOut();
    return;
  }

  if (!inviteData || inviteData.status === "revoked") {
    message.value = "❌ 관리자 초대된 계정만 접근 가능합니다.";
    await supabase.auth.signOut();
    return;
  }

  // ✅ 초대된 사람이면 admin_users 등록
  const { error: upsertErr } = await supabase
    .from("admin_users")
    .upsert({ email: loginUser.email }, { onConflict: "email" });

  if (upsertErr) {
    message.value = "❌ 관리자 등록 실패: " + upsertErr.message;
    await supabase.auth.signOut();
    return;
  }

  user.value = loginUser;
}

/* ------------------------------
   ✅ 로그아웃
------------------------------ */
async function logout() {
  await supabase.auth.signOut();
  user.value = null;
}

/* ------------------------------
   ✅ 업로드 (cacheControl: "0" + 업로드 후 프리뷰 강제 갱신)
------------------------------ */
async function uploadMenu() {
  if (!file.value) return;

  if (!file.value.type.startsWith("image/")) {
    message.value = "❌ 이미지 파일만 업로드 가능합니다.";
    return;
  }

  message.value = "업로드 중...";

  const { error } = await supabase.storage
    .from("menu")
    .upload(uploadFileName.value, file.value, {
      upsert: true,
      cacheControl: "0", // 🔥 캐시 최소화
    });

  if (error) {
    message.value = "❌ 업로드 실패: " + error.message;
    return;
  }

  message.value = "✅ 업로드 성공!";
  file.value = null;

  // ✅ 업로드 후 프리뷰 즉시 갱신 (캐시 bust)
  await refreshMenuPreview();
}

/* ------------------------------
   ✅ 관리자 추가 (배포/로컬 자동 분기 추천)
------------------------------ */
const newAdminEmail = ref("");

async function addAdmin() {
  if (!newAdminEmail.value) {
    message.value = "❌ 이메일 입력하세요.";
    return;
  }

  message.value = "초대 메일 발송 중...";

  const tempPassword = Math.random().toString(36).slice(2) + "A1!";

  const SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;

  const { error } = await supabase.auth.signUp({
    email: newAdminEmail.value,
    password: tempPassword,
    options: {
      emailRedirectTo: `${SITE_URL}/admin`, // ✅ 배포/로컬 자동
    },
  });

  if (error) {
    message.value = "❌ 실패: " + error.message;
    return;
  }

  // ✅ 초대 테이블 기록 (에러 처리 필수)
  const { error: inviteUpsertErr } = await supabase.from("admin_invites").upsert({
    email: newAdminEmail.value,
    status: "pending",
  });

  if (inviteUpsertErr) {
    message.value = "❌ 초대 기록 실패: " + inviteUpsertErr.message;
    return;
  }

  message.value = "✅ 초대 메일 발송 완료 (인증 후 관리자 자동 등록)";
  newAdminEmail.value = "";
}
</script>

<style scoped>
/* (스타일은 네 거 그대로 두면 됨) */
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

.main-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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