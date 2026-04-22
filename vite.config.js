import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        list: resolve(__dirname, "list.html"),
        admin: resolve(__dirname, "admin.html"),
        users: resolve(__dirname, "users.html"),
        userleaderboard: resolve(__dirname, "userleaderboard.html"),
      },
    },
  },
});
