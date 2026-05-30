# 需求文件

## 簡介

在 V50.1.0 程式碼中發現了一個嚴重的配置錯誤，Google Drive 資料夾 ID 在 CONFIG 區段中配置不正確。目前的實作錯誤地將實際的資料夾 ID 值當作屬性名稱在 `getProperty()` 呼叫中使用，這將導致所有 Google Drive 操作（圖片存檔、檔案歸檔、重複檔案處理）完全失效。

此修正版本 V50.1.1 將解決配置讀取錯誤、移除硬式編碼、統一版本號，並保留所有 Bot 整合功能。

## 需求

### 需求 1：修正配置讀取錯誤

**使用者故事：** 作為系統管理員，我希望 Google Drive 資料夾配置能正確運作，以便所有檔案操作都能正常執行。

#### 驗收標準

1. WHEN 系統讀取資料夾配置 THEN 系統 SHALL 使用正確的屬性名稱而非資料夾 ID 值
2. WHEN 執行 Google Drive 操作 THEN 系統 SHALL 成功存取正確的資料夾
3. WHEN 載入配置 THEN 系統 SHALL 從正確的屬性鍵值中取得資料夾 ID
4. WHEN 呼叫 getProperty() THEN 系統 SHALL 使用 'FOLDER_ID_TO_PROCESS' 而非 '1oRT8W9kzi6j1OBy27ybAZWOlGX1232lp'

### 需求 2：安全性強化 - 移除硬式編碼

**使用者故事：** 作為開發者，我希望移除所有硬式編碼的 ID 和 Token，以提升系統安全性和可維護性。

#### 驗收標準

1. WHEN 定義資料夾 ID 屬性 THEN 系統 SHALL 使用描述性的屬性名稱如 'FOLDER_ID_TO_PROCESS'
2. WHEN 儲存資料夾 ID THEN 它們 SHALL 作為屬性值儲存，而非屬性名稱
3. WHEN 存取資料夾 ID THEN 系統 SHALL 呼叫 `getProperty('FOLDER_ID_TO_PROCESS')` 而非 `getProperty('1oRT8W9kzi6j1OBy27ybAZWOlGX1232lp')`
4. WHEN 配置 CONFIG 物件 THEN 系統 SHALL 完全依賴指令碼屬性中的設定，不使用硬式編碼作為備用值

### 需求 3：版本號統一校準

**使用者故事：** 作為系統維護者，我希望所有檔案的版本號都統一為 V50.1.1，以確保版本一致性。

#### 驗收標準

1. WHEN 更新程式碼 THEN 所有檔案標頭的版本號 SHALL 統一為 V50.1.1
2. WHEN 檢視程式碼註解 THEN 更新日期 SHALL 反映為 2025-10-14
3. WHEN 查看版本資訊 THEN 主要更新說明 SHALL 明確標示修正 V50.1.0 中的配置錯誤
4. WHEN 執行系統 THEN 版本資訊 SHALL 在所有相關檔案中保持一致

### 需求 4：功能完整性保留

**使用者故事：** 作為系統使用者，我希望圖片存檔和檔案操作能可靠運作，以便我的資料得到妥善管理。

#### 驗收標準

1. WHEN 上傳圖片 THEN 圖片 SHALL 被存檔到正確的 Google Drive 資料夾
2. WHEN 需要歸檔檔案 THEN 檔案 SHALL 被移動到適當的歸檔資料夾
3. WHEN 偵測到重複檔案 THEN 重複檔案 SHALL 在指定的重複檔案資料夾中處理
4. WHEN 任何資料夾操作失敗 THEN 系統 SHALL 提供清楚的錯誤訊息指出配置問題

### 需求 5：系統驗證與測試

**使用者故事：** 作為系統維護者，我希望驗證配置修正能正確運作，以確保系統可靠性。

#### 驗收標準

1. WHEN 更新配置 THEN 所有資料夾 ID 參照 SHALL 被驗證
2. WHEN 測試資料夾存取 THEN 每個配置的資料夾 SHALL 都能存取
3. WHEN 部署修正 THEN 現有功能 SHALL 繼續運作不中斷
4. WHEN 發生配置錯誤 THEN 錯誤 SHALL 被記錄並包含具體的資料夾 ID 失敗詳情
5. WHEN 執行 Bot 整合功能 THEN 所有 V50.1.0 的功能 SHALL 完整保留並正常運作