<template>
  <div class="menu-container">
    <!-- 메뉴 이미지 영역 -->
    <div class="menu-image">
      <!-- 새로고침 버튼 -->
      <button
        @click="refreshButton"
        class="refresh-image-button"
      ></button>

      <!-- 드래그 이미지들 -->
      <div style="margin-top: 20px;">
        <div
          v-for="(image, index) in images"
          :key="index"
          class="draggable-image"
          :style="{ top: image.top + 'px', left: image.left + 'px' }"
          @mousedown="startDrag($event, index)"
          @touchstart="startTouch($event, index)"
        >
          <img
            :src="image.src"
            draggable="false"
            style="width: 100px; height: auto;"
          />
        </div>
      </div>

      <!-- ✅ Supabase 메뉴판 이미지 -->
      <img
        :src="menuUrl"
        alt="Menu Image"
        class="responsive-img"
        draggable="false"
      />

      <!-- 이미지 추가 버튼 -->
      <button
        @click="createImage"
        class="add-image-button hidden-button"
      ></button>
    </div>

    <!-- 언어 선택 버튼 -->
    <div class="buttons adjusted-buttons">
      <button @click="changeLanguage('korean')">🇰🇷 한국어</button>
      <button @click="changeLanguage('english')">🇺🇸 English</button>
      <button @click="changeLanguage('japanese')">🇯🇵 日本語</button>
      <button @click="changeLanguage('chinese')">🇨🇳 中文</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { supabase } from "@/lib/supabase";

/* ✅ 캐시 방지용 버전값 */
const version = ref(Date.now());

/* ✅ 현재 선택된 언어 */
const selectedLanguage = ref("korean");

/* ✅ Supabase Storage에 저장된 파일명 */
const menuFileMap = {
  korean: "menu-korean.jpg",
  english: "menu-english.jpg",
  japanese: "menu-japanese.jpg",
  chinese: "menu-chinese.jpg",
};

/* ✅ Supabase 메뉴 URL 생성 */
const menuUrl = computed(() => {
  const fileName = menuFileMap[selectedLanguage.value];

  const { data } = supabase.storage
    .from("menu")
    .getPublicUrl(fileName);

  /* ✅ version 붙여서 캐시 무효화 */
  return `${data.publicUrl}?v=${version.value}`;
});

/* ✅ 드래그 이미지 배열 */
const images = ref([]);

/* 드래그 상태 */
const dragging = ref(false);
const dragIndex = ref(null);
const offset = reactive({ x: 0, y: 0 });

/* ✅ Supabase에서 최신 version 가져오기 */
onMounted(async () => {
  const { data, error } = await supabase
    .from("menu_settings")
    .select("version")
    .eq("id", "default")
    .single();

  if (!error && data?.version) {
    version.value = data.version;
  }

  /* 이벤트 등록 */
  window.addEventListener("touchmove", onTouchMove);
  window.addEventListener("touchend", endTouch);

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", endDrag);
});

/* ✅ 언어 변경 */
function changeLanguage(lang) {
  selectedLanguage.value = lang;
}

/* ✅ soldout 이미지 추가 */
function createImage() {
  images.value.push({
    src: "/images/soldout.png",
    top: 30,
    left: 250,
  });
}

/* ✅ 드래그 시작 */
function startDrag(event, index) {
  dragging.value = true;
  dragIndex.value = index;

  offset.x = event.offsetX;
  offset.y = event.offsetY;
}

/* ✅ 터치 시작 */
function startTouch(event, index) {
  dragging.value = true;
  dragIndex.value = index;

  const touch = event.touches[0];
  const rect = event.target.getBoundingClientRect();

  offset.x = touch.clientX - rect.left;
  offset.y = touch.clientY - rect.top;
}

/* ✅ 마우스 이동 */
function onMouseMove(event) {
  if (!dragging.value || dragIndex.value === null) return;

  images.value[dragIndex.value].left = event.clientX - offset.x;
  images.value[dragIndex.value].top = event.clientY - offset.y;
}

/* ✅ 터치 이동 */
function onTouchMove(event) {
  if (!dragging.value || dragIndex.value === null) return;

  const touch = event.touches[0];

  images.value[dragIndex.value].left = touch.clientX - offset.x;
  images.value[dragIndex.value].top = touch.clientY - offset.y;
}

/* ✅ 드래그 종료 */
function endDrag() {
  dragging.value = false;
  dragIndex.value = null;
}

/* ✅ 터치 종료 */
function endTouch() {
  dragging.value = false;
  dragIndex.value = null;
}

/* ✅ 새로고침 버튼 */
function refreshButton() {
  version.value = Date.now();
}
</script>

<style scoped>
/* 전체 컨테이너 */
.menu-container {
  width: 100vw;
  height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  background-color: white;
  position: relative;
  touch-action: none;
}

/* 언어 버튼 */
.buttons {
  position: absolute;
  display: flex;
  gap: 10px;
  z-index: 10;
}

.adjusted-buttons {
  right: 3vw;
  padding: 0px 10px;
  border-radius: 10px;
}

.buttons button {
  padding: 5px 8px;
  font-size: 10px;
  cursor: pointer;
  border: none;
  background-color: #333;
  color: white;
  border-radius: 5px;
}

.buttons button:hover {
  background-color: #555;
}

/* 메뉴 이미지 영역 */
.menu-image {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  position: relative;
}

/* 메뉴 이미지 */
.responsive-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: auto;
  user-select: none;
}

/* 새로고침 버튼 */
.refresh-image-button {
  position: fixed;
  top: 65px;
  left: 80px;
  z-index: 5;
  padding: 25px 80px;
  opacity: 0;
  pointer-events: auto;
}

/* 이미지 추가 버튼 */
.add-image-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 20;
  padding: 20px 30px;
}

.hidden-button {
  opacity: 0;
  pointer-events: auto;
}

/* 드래그 이미지 */
.draggable-image {
  position: absolute;
  z-index: 15;
  cursor: grab;
  touch-action: none;
}

@media (orientation: landscape) {
  .adjusted-buttons {
    top: 10px;
    right: 8vw;
  }
}
</style>
