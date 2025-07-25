# Google Apps Script 新手部署指南 - 智慧記帳 GEM V47.0

## 🎯 重要提醒

**⚠️ 部署順序很重要！** 
不是先替換 Code.gs，而是要**先添加依賴檔案，最後才更新 Code.gs**

---

## 📋 完整部署步驟（新手版）

### 🔧 準備工作

#### 步驟 0：開啟您的 Google Apps Script 專案
1. 前往 [script.google.com](https://script.google.com)
2. 找到您現有的智慧記帳專案
3. 點擊進入編輯器

---

### 📁 第一階段：添加配置管理檔案

#### 步驟 1：添加 ConfigManager.gs
1. **在 Google Apps Script 編輯器中**：
   - 點擊左側的「+」號（添加檔案）
   - 選擇「指令碼」
   - 將新檔案命名為：`ConfigManager`（不用加 .gs，系統會自動添加）

2. **複製內容**：
   - 開啟您電腦上的 `ConfigManager.gs` 檔案
   - 全選內容（Ctrl+A）
   - 複製（Ctrl+C）

3. **貼上內容**：
   - 回到 Google Apps Script 編輯器
   - 在新建的 ConfigManager.gs 檔案中
   - 刪除預設內容
   - 貼上複製的內容（Ctrl+V）

4. **儲存**：
   - 按 Ctrl+S 或點擊儲存圖示

#### 步驟 2：添加 config-setup.gs
1. **添加新檔案**：
   - 再次點擊「+」→「指令碼」
   - 命名為：`config-setup`

2. **複製貼上內容**：
   - 開啟您電腦上的 `config-setup.gs` 檔案
   - 複製全部內容
   - 貼上到新建的檔案中
   - 儲存

#### 步驟 3：添加 config-web-ui.gs
1. **添加新檔案**：
   - 點擊「+」→「指令碼」
   - 命名為：`config-web-ui`

2. **複製貼上內容**：
   - 開啟您電腦上的 `config-web-ui.gs` 檔案
   - 複製全部內容
   - 貼上到新建的檔案中
   - 儲存

---

### 🛡️ 第二階段：添加 Phase 4 錯誤處理檔案

**重要：這 8 個檔案必須按順序添加**

#### 步驟 4：添加 Phase4ErrorHandler.gs
1. **添加新檔案**：
   - 點擊「+」→「指令碼」
   - 命名為：`Phase4ErrorHandler`

2. **複製貼上內容**：
   - 開啟您電腦上的 `Phase4ErrorHandler.gs` 檔案
   - 複製全部內容
   - 貼上到新建的檔案中
   - 儲存

#### 步驟 5-11：依序添加其他 Phase 4 檔案
**按照以下順序，重複上述步驟**：
- `Phase4TransactionManager.gs`
- `Phase4ConsistencyChecker.gs`
- `Phase4NotificationManager.gs`
- `Phase4LedgerLinkDetector.gs`
- `Phase4ExpenseRealizationHandler.gs`
- `Phase4LinkRecoveryManager.gs`
- `Phase4ErrorHandlingIntegration.gs`

---

### 📱 第三階段：更新主程式

#### 步驟 12：更新 Code.gs（最後才做！）
1. **找到現有的 Code.gs**：
   - 在左側檔案列表中找到 `Code.gs`
   - 點擊開啟

2. **備份現有內容**（建議）：
   - 全選現有內容（Ctrl+A）
   - 複製（Ctrl+C）
   - 在記事本中貼上並儲存為備份

3. **替換為新內容**：
   - 刪除 Code.gs 中的所有內容
   - 開啟您電腦上的新版 `Code.gs` 檔案
   - 複製全部內容
   - 貼上到 Google Apps Script 的 Code.gs 中
   - 儲存

---

### ✅ 第四階段：驗證和測試

#### 步驟 13：檢查檔案列表
您的 Google Apps Script 專案現在應該有以下檔案：
```
✅ ConfigManager.gs
✅ config-setup.gs
✅ config-web-ui.gs
✅ Phase4ErrorHandler.gs
✅ Phase4TransactionManager.gs
✅ Phase4ConsistencyChecker.gs
✅ Phase4NotificationManager.gs
✅ Phase4LedgerLinkDetector.gs
✅ Phase4ExpenseRealizationHandler.gs
✅ Phase4LinkRecoveryManager.gs
✅ Phase4ErrorHandlingIntegration.gs
✅ Code.gs
```

#### 步驟 14：儲存專案
1. 按 Ctrl+S 確保所有檔案都已儲存
2. 等待「正在儲存...」完成

#### 步驟 15：測試基本功能
1. **選擇測試函數**：
   - 在 Code.gs 中，找到函數下拉選單
   - 選擇 `manualIOSShortcutsTest`

2. **執行測試**：
   - 點擊「執行」按鈕（播放圖示）
   - 第一次執行會要求授權，點擊「檢閱權限」
   - 選擇您的 Google 帳戶
   - 點擊「允許」

3. **查看結果**：
   - 點擊「執行」標籤查看執行日誌
   - 如果看到「✅ 測試完成」表示成功

---

### 🚀 第五階段：部署為網頁應用程式

#### 步驟 16：部署設定
1. **開始部署**：
   - 點擊右上角「部署」按鈕
   - 選擇「新增部署」

2. **選擇類型**：
   - 點擊「類型」旁的齒輪圖示
   - 選擇「網頁應用程式」

3. **設定部署參數**：
   - **說明**：輸入「智慧記帳 GEM V47.0」
   - **執行身分**：選擇「我」
   - **存取權限**：選擇「任何人」

4. **完成部署**：
   - 點擊「部署」
   - **重要**：複製生成的「網頁應用程式 URL」並保存

#### 步驟 17：初始化配置
1. **執行配置精靈**：
   - 在函數下拉選單中選擇 `configSetupWizard`
   - 點擊「執行」
   - 按照提示設定您的 API 金鑰和 Google Sheet ID

---

## 🔍 常見問題和解決方案

### ❌ 「configManager is not defined」錯誤
**原因**：ConfigManager.gs 沒有正確添加或載入
**解決**：
1. 確認 ConfigManager.gs 檔案存在
2. 檢查檔案內容是否完整
3. 重新儲存專案

### ❌ 「phase4ErrorHandler is not defined」錯誤
**原因**：Phase 4 檔案沒有完整添加
**解決**：
1. 檢查是否添加了所有 8 個 Phase 4 檔案
2. 確認檔案名稱正確
3. 重新儲存專案

### ❌ 執行權限錯誤
**原因**：沒有授予必要權限
**解決**：
1. 點擊「檢閱權限」
2. 選擇您的 Google 帳戶
3. 點擊「允許」

### ❌ 部署失敗
**原因**：檔案中有語法錯誤
**解決**：
1. 檢查每個檔案是否完整複製
2. 查看錯誤訊息定位問題
3. 重新複製貼上有問題的檔案

---

## 📞 需要幫助？

### 🆘 如果遇到問題
1. **截圖錯誤訊息**：包含完整的錯誤內容
2. **檢查檔案列表**：確認所有檔案都已添加
3. **查看執行日誌**：點擊「執行」標籤查看詳細日誌
4. **重新按順序部署**：如果問題持續，重新按順序添加檔案

### 📋 部署檢查清單
- [ ] ConfigManager.gs 已添加並儲存
- [ ] config-setup.gs 已添加並儲存
- [ ] config-web-ui.gs 已添加並儲存
- [ ] 8 個 Phase 4 檔案已按順序添加
- [ ] Code.gs 已更新為 V47.0 版本
- [ ] 所有檔案已儲存
- [ ] 測試函數執行成功
- [ ] 已部署為網頁應用程式
- [ ] 已複製並保存部署 URL
- [ ] 已執行配置精靈

**完成以上所有步驟後，您的智慧記帳 GEM V47.0 就可以正常使用了！** 🎉

---

## 🎯 重要提醒

1. **順序很重要**：必須先添加依賴檔案，最後才更新 Code.gs
2. **完整複製**：確保每個檔案的內容都完整複製，不要遺漏
3. **逐步進行**：不要急躁，一步一步按照指南操作
4. **保存備份**：建議先備份現有的 Code.gs 內容
5. **測試驗證**：每個階段完成後都要測試確認

祝您部署順利！🚀