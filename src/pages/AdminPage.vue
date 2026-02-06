<template>
  <div class="admin-container">
    <div class="admin-card">
      <div class="header">
        <h2>유지커피웍스 관리자</h2>
      </div>

      <!-- ✅ 로그인 -->
      <div v-if="!user" class="form-box">
        <input v-model="email" placeholder="이메일" />
        <input v-model="password" type="password" placeholder="비밀번호" />

        <button class="main-btn" @click="loginWithPassword" :disabled="loading">
          {{ loading ? "로그인 중..." : "로그인" }}
        </button>
      </div>

      <!-- ✅ 로그인 후: 메뉴 관리만 -->
      <div v-else class="form-box">
        <select v-model="selectedLang">
          <option value="korean">🇰🇷 한국어</option>
          <option value="english">🇺🇸 영어</option>
          <option value="japanese">🇯🇵 일본어</option>
          <option value="chinese">🇨🇳 중국어</option>
        </select>

        <p class="file-info">
          파일명: <b>{{ uploadFileName }}</b>
        </p>

        <div style="text-align: center">
          <img
            v-if="menuPreviewUrl"
            :src="menuPreviewUrl"
            alt="menu preview"
            style="width: 100%; border-radius: 10px; border: 1px solid #eee"
            draggable="false"
          />
        </div>

        <input type="file" @change="handleFile" />

        <button class="main-btn" @click="uploadMenu" :disabled="!file || loading">
          {{ loading ? "업로드 중..." : "메뉴 교체" }}
        </button>

        <div class="bottom-actions">
          <router-link to="/" class="back-link">메뉴로 돌아가기</router-link>
          <button class="logout-btn" @click="logout" :disabled="loading">로그아웃</button>
        </div>
      </div>

      <p class="message">{{ message }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { supabase } from "@/lib/supabase";

/* 상태 */
const email = ref("");
const password = ref("");
const user = ref(null);
const message = ref("");
const loading = ref(false);

/* ------------------------------
   ✅ 세션 복구 + Auth 구독
------------------------------ */
let authSub;

onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  user.value = data.session?.user || null;

  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user || null;

    // 로그인되면 프리뷰 준비
    if (user.value) refreshMenuPreview(false);
  });

  authSub = sub.subscription;

  // 첫 진입 시 프리뷰 준비(로그인 상태면)
  if (user.value) await refreshMenuPreview(false);
});

onUnmounted(() => authSub?.unsubscribe());

/* ------------------------------
   ✅ 로그인 (전원 비번)
------------------------------ */
async function loginWithPassword() {
  message.value = "";

  if (!email.value || !password.value) {
    message.value = "❌ 이메일/비밀번호를 입력하세요.";
    return;
  }

  loading.value = true;

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  });

  loading.value = false;

  if (error) {
    message.value = "❌ 로그인 실패: " + error.message;
    return;
  }

  message.value = "✅ 로그인 성공";
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

const previewVersion = ref(0);
const menuPreviewUrl = ref("");

async function refreshMenuPreview(bust = false) {
  if (bust) previewVersion.value = Date.now();

  const { data } = supabase.storage.from("menu").getPublicUrl(uploadFileName.value);
  const publicUrl = data?.publicUrl;

  menuPreviewUrl.value = publicUrl ? `${publicUrl}?v=${previewVersion.value}` : "";
}

watch(selectedLang, async () => {
  await refreshMenuPreview(false);
});

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

  message.value = "✅ 업로드 성공";
  refreshPreview()
  file.value = null;
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

.header {
  margin-bottom: 30px;
}

h2 {
  font-size: 22px;
  font-weight: 700;
}

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

.message {
  margin-top: 15px;
  font-size: 13px;
  color: #444;
}

.bottom-actions {
  margin-top: 15px;
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