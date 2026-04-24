import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        list: resolve(__dirname, 'list.html'),
        users: resolve(__dirname, 'users.html'),
        admin: resolve(__dirname, 'admin.html'),
        userleaderboard: resolve(__dirname, 'userleaderboard.html'),
         login: resolve(__dirname, 'login.html'),
          signup: resolve(__dirname, 'signup.html'),
           account: resolve(__dirname, 'account.html'),
           upload: resolve(__dirname, 'upload.html'),
      },
    },
  },
})
