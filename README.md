# friend-association

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

#Project Setup
npm install
```
# 安装必要依赖
npm install quasar @quasar/extras
npm install socket.io-client pinia
npm install @vueuse/core # 实用工具库

# 安装PWA支持
npm install vite-plugin-pwa
```

#后端项目搭建
cd backend
npm init -y

```
# 安装后端依赖
npm install express socket.io sqlite3 jsonwebtoken
npm install multer bcryptjs uuid
npm install nodemon --save-dev

#启动项目
#前端
npm run dev
#后端
cd backend
npm run dev
