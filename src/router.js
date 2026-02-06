import { createRouter, createWebHistory } from "vue-router";

import MenuPage from "@/pages/MenuPage.vue";
import AdminPage from "@/pages/AdminPage.vue";

const routes = [
  {
    path: "/",
    name: "Menu",
    component: MenuPage,
  },
  {
    path: "/admin",
    name: "Admin",
    component: AdminPage,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
