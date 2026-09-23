module.exports = {
  // 設定 FORGE_BUILD_ID 會打包到 out/<FORGE_BUILD_ID>/ (例: out 裡的 exe 正在執行、不能覆蓋時)
  buildIdentifier: process.env.FORGE_BUILD_ID,
  packagerConfig: {
    asar: false,
    ignore: [
      "^/node_modules/.cache",
      ".*/.idea",
      ".*/.gitignore",
      "^/public",
      "^/resources/.*/.*",
      "^/resources/(?!.*.ico$).*$",
      ".*forge\\.config\\.js",
      "^/.env",
      "^/src",
      "^/app-config.json",
      "^/out",
      "^/docs",
      "^/todolist.json",
      "^/donate.md",
      "^/\\.github",
      "^/yarn-error.log"
    ],
    compression: "maximum",
    icon: "resources/icon.ico"
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip'
    }
  ],
};
