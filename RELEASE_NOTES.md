### 版本 V39.2 更新說明 | Release Notes for Version V39.2

**版本標題：** `API 契約修正與命名慣例統一 (API Contract Revision & Naming Convention Unification)`

此版本根據優良的 API 設計實踐，對圖片上傳的參數名稱進行了修正，以提升整個專案的一致性與可讀性。這是一個小但重要的更新，建議所有使用者升級以獲得最佳體驗。

---

#### ✨ 主要功能與修正 / Major Features & Fixes

* **[API 變更] 統一命名慣例 (Naming Convention Unification):**
    * 為了與專案中其他參數 (`voice_text`, `target_sheet_id`) 的 `snake_case` 命名風格保持一致，圖片上傳時接收的參數已從 `image_base64` **正式修正為 `image_base_64`**。
    * 此修正使我們的 API 契約更加清晰、專業且易於維護。

#### 🚀 改善 / Improvements

* **可讀性與一致性:** 統一的命名風格使得新加入的開發者能更快地理解程式碼與 API 結構。
* **穩定性:** 繼承了 V39.1 版本的「兩段式 AI」架構，對 AI 輸出的不穩定格式有著極高的容錯能力。

#### ⚠️ 重大變更 / Breaking Changes

* **[必要操作] 客戶端更新:** 所有呼叫圖片上傳功能的客戶端（例如您的 iOS 捷徑、或其他腳本），**必須**將其傳送的 JSON 資料中的 `image_base64` 欄位，**修改為 `image_base_64`**，否則圖片上傳將會失敗並回報 `缺少 image_base_64 參數` 的錯誤。
