import { createApp } from "vue";
import { createI18n } from "vue-i18n";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";

import "./registerServiceWorker";

import en from "./locales/en.json";
import ko from "./locales/ko.json";
import jp from "./locales/jp.json";
import cn from "./locales/cn.json";

/* i18n 설정 */
const i18n = createI18n({
  legacy: false,
  locale: "ko",
  fallbackLocale: "en",
  messages: { en, ko, jp, cn },
});

/* Vue 앱 생성 */
const app = createApp(App);

/* 플러그인 등록 */
app.use(i18n);
app.use(createPinia());
app.use(router);

/* 마운트 */
app.mount("#app");
