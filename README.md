<div align=center>
<h1>LOL列隊神器</h1>
</div>

<div align="center">

![Static Badge](https://img.shields.io/badge/react-18.2.0-blue)
![Static Badge](https://img.shields.io/badge/electron-28.3.3-blue)

[![GitHub release](https://img.shields.io/github/v/release/wudishidove/lol_auto_ban_pick?include_prereleases)](https://github.com/wudishidove/lol_auto_ban_pick/releases)
![downloads](https://img.shields.io/github/downloads/wudishidove/lol_auto_ban_pick/total)

</div>

<div align=center>
  <b>列隊等半天，想上廁所又不敢去？</b><br/>
  怕一離開就錯過「接受」、怕回來發現自己的本命被 ban、怕選角時間到被踢出去……<br/>
  別憋了！快來試試 <b>LOL列隊神器</b> 🚽
</div>

[English](./README_en.md) | 中文

## 🚽 你負責上廁所，剩下交給它
- 🚀 **自動接受對戰**：排到了 1 秒內幫你按接受，人不在也不怕被罰
- 🚫 **自動 ban 角**：照你排好的順序自動禁用，第一順位不能 ban 就往下找
- 🎯 **自動預選＋遞補**：開場幫你亮出想玩的英雄，被 ban 被搶就自動換下一隻
- 🔒 **自動鎖角**：剩 1 秒還沒回來？直接幫你鎖，不會因為在洗手就被踢出選角
- 📜 **符文設定檔**：依「路線＋英雄＋對位」自動套用符文，回到座位直接開打
- 🏆 **情報一手掌握**：隊友積分、雙排偵測、列隊規則，選角時就知道隊友底細
- 🎲 **ARAM 自動搶角**：先勾好想要的英雄，隊友一骰出來就幫你換過來
- 🔄 **一鍵更新**：有新版本自動提醒，按一下就更新好

一句話：**讓你列隊時輕鬆上廁所、裝水、泡麵，完全無負擔。** 💧

> 本專案修改自 [jasonwu1994/lol-auto-accept](https://github.com/jasonwu1994/lol-auto-accept)，感謝原作者 **jasonwu1994** 的開源分享。

## ✨ 功能
1. **🚀自動接受對戰**：1秒內會自動接受對戰  
   如果排到對戰且已經自動接受，可以反悔，只需要在程式介面中按下"拒絕對戰"
2. **🏆選角時顯示隊友積分**：如果所在伺服器已不顯示玩家名稱，功能失效
3. **👥顯示雙排玩家**：遊戲中，顯示雙方雙排(多排)玩家，會按照人數排序
4. **📖顯示列隊規則**：遊戲中，顯示雙方玩家列隊規則
5. **🎲隨機單中(ARAM)**：ARAM選角時，可先勾選隊友的英雄，如果英雄被骰出來，幫你自動選取
6. **🪪修改名片**：滑鼠放到自己的頭像上可看到效果
7. **🚫自動禁用英雄**：輪到自己禁用時，依照設定的優先順序自動禁用  
   可設定全局排序或各路線獨立排序(該路線未設定時使用全局排序)  
   可選擇是否跳過隊友預選的英雄，也可以只選取不送出確認，保留反悔空間
8. **🎯自動預選英雄**：選角開場時自動亮出想玩的英雄，同樣支援全局／路線清單  
   可開啟隨機候選，每場從預選池中隨機挑一隻  
   可開啟預選遞補，預選的英雄被禁用(或被選走)時，自動改預選下一順位
9. **🔒自動鎖角**：自動預選成功的那場，輪到你選角且時間剩 1 秒時自動鎖定當下亮著的英雄(中途改選也算)
10. **📜符文設定檔**：進遊戲時自動記錄該場符文，賽後補上對位存成設定檔，也可以從對戰紀錄匯入  
    選角鎖定英雄後，依「路線＋英雄＋對位」自動套用符文設定檔
11. **🔄自動更新**：啟動時(之後每 3 小時)檢查是否有新版本，可在程式內一鍵下載更新

主頁有「自動禁用英雄／自動預選英雄／自動鎖角」的快速開關，英雄清單與細部選項在「選ban角」分頁設定，英雄可用英文名稱搜尋(例: `zed`、`lee sin`)。設定變更會即時存檔。

## 🌟 說明
- **超低CPU使用率**：使用訂閱事件的方式，只有特定事件發生時，程式才會運作，其他時候CPU使用率幾乎為0
- **不干預遊戲內檔案**：不會對遊戲檔案進行注入或修改，保持遊戲純淨
- **安全調用API**：使用與LeagueClient相同的API，安全性高

## 🖥 截圖
<p float="left">
  <img src="resources/github/screenshot/zh/main.jpg" width="48%" />
  <img src="resources/github/screenshot/zh/main_dark.jpg" width="48%" />
</p>
<p float="left">
  <img src="resources/github/screenshot/zh/banpick_ban.jpg" width="48%" />
  <img src="resources/github/screenshot/zh/banpick_pick.jpg" width="48%" />
</p>
<p float="left">
  <img src="resources/github/screenshot/zh/rank.jpg" width="48%" />
  <img src="resources/github/screenshot/zh/duo.jpg" width="48%" />
</p>
<p float="left">
  <img src="resources/github/screenshot/zh/ARAM.jpg" width="48%" />
  <img src="resources/github/screenshot/zh/role.jpg" width="48%" />
</p>
<p float="left">
  <img src="resources/github/screenshot/zh/teammate_rank.jpg" width="48%" />
</p>

## 🔍 FAQ
### 1. 使用後會不會被封鎖帳號？
- 多位用戶使用超過三年，無任何帳號被鎖   
  本人不負任何責任，請自行評估使用風險  
  如有疑慮，請勿使用

### 2. 為什麼功能失效了？
- 功能完全依賴LeagueClient API，如果官方API更新，可能導致部分功能失效

### 3. 如何刪除程式？
- 把資料夾刪除即可，本程式不會在電腦其他地方生成檔案

### 4. 設定檔在哪裡？
- 一般情況不需要動到設定檔
- lol-app-win32-x64\resources\app\app-config.json

## 🎉 結尾
  **如果這個程式對您有幫助，請給個⭐️！**  
  **這是對我最大的鼓勵！**  
  也請不要忘了給[原作者的專案](https://github.com/jasonwu1994/lol-auto-accept)一個⭐️

## ⚖️ 免責聲明
本程式是非官方的第三方工具，僅透過本機的 League Client (LCU) API 與你自己的遊戲客戶端溝通，不會注入或修改任何遊戲檔案。使用風險請自行評估。

> LOL列隊神器 isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

隱私權說明請見 [PRIVACY.md](./PRIVACY.md)。
