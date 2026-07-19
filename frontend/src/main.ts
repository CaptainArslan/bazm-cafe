import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "./styles/main.css";

import { VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";

import App from "./App.vue";
import { queryClient } from "./lib/query-client";
import router from "./router";

const app = createApp(App);

app.use(router);
app.use(VueQueryPlugin, { queryClient });

app.mount("#app");
