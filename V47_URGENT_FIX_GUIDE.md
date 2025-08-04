# V47.1 緊急修復指南 - 電子發票觸發器問題

## 🚨 問題現況
根據您提供的錯誤訊息，V47.1 版本有以下問題：
1. **授權錯誤**：`Authorization is required to perform that action` (73次)
2. **Phase4 組件缺失**：`ReferenceError: Phase4TransactionManager is not defined`
3. **觸發器執行失敗**：郵件處理和收據檢查都無法正常執行

## 🎯 立即修復步驟

### 步驟 1：診斷問題
1. 將 `V47_AUTHORIZATION_FIX.gs` 檔案內容複製到您的 Apps Script 專案
2. 執行 `diagnoseV47AuthorizationIssues()` 函數
3. 查看執行記錄，了解具體問題

### 步驟 2：重新授權
1. 執行 `reauthorizeAllPermissions()` 函數
2. **重要**：當系統提示授權時，請點擊「允許」
3. 確保授權以下權限：
   - Gmail 讀取和修改
   - Google Sheets 存取
   - Google Drive 存取
   - 腳本執行權限

### 步驟 3：修復觸發器
1. 執行 `fixAuthorizationIssues()` 函數
2. 這會：
   - 刪除所有現有觸發器
   - 建立新的簡化版觸發器
   - 測試新觸發器功能

### 步驟 4：手動測試
1. 執行 `manualTestTriggerFunctions()` 函數
2. 確認郵件處理和收據檢查功能正常

## 🔧 手動觸發器設定（如果自動修復失敗）

### 刪除現有觸發器
1. 在 Apps Script 編輯器中，點擊左側「觸發條件」
2. 刪除所有現有觸發器

### 建立新觸發器
1. 點擊「新增觸發條件」
2. 設定郵件處理觸發器：
   - 函式：`processAutomatedEmailsSimplified`
   - 事件來源：`時間驅動`
   - 時間型觸發條件：`分鐘計時器`
   - 分鐘間隔：`每 15 分鐘`

3. 設定收據檢查觸發器：
   - 函式：`checkReceiptsFolderSimplified`
   - 事件來源：`時間驅動`
   - 時間型觸發條件：`小時計時器`
   - 小時間隔：`每 1 小時`

## 🛠️ Phase4 組件問題修復

### 檢查缺失的檔案
確認以下檔案存在於您的 Apps Script 專案中：
- [ ] Phase4ErrorHandler.gs
- [ ] **Phase4TransactionManager.gs** ← 重點檢查
- [ ] Phase4ConsistencyChecker.gs
- [ ] Phase4NotificationManager.gs
- [ ] Phase4LedgerLinkDetector.gs
- [ ] Phase4ExpenseRealizationHandler.gs
- [ ] Phase4LinkRecoveryManager.gs
- [ ] Phase4ErrorHandlingIntegration.gs

### 如果檔案缺失
1. 從您的本地檔案中複製對應的 `.gs` 檔案內容
2. 在 Apps Script 中建立新檔案
3. 貼上內容並儲存

### 檔案載入順序問題
如果檔案都存在但仍有錯誤，可能是載入順序問題：
1. 重新命名檔案，確保正確順序：
   ```
   01_Phase4ErrorHandler.gs
   02_Phase4TransactionManager.gs
   03_Phase4ConsistencyChecker.gs
   ...
   ```

## 🚀 臨時解決方案（緊急使用）

如果上述修復仍有問題，可以使用簡化版本：

### 使用簡化版觸發器
觸發器函數改為：
- `processAutomatedEmailsSimplified` (不依賴 Phase4)
- `checkReceiptsFolderSimplified` (不依賴 Phase4)

### 停用 Phase4 功能
在 `Code.gs` 中找到 `withPhase4ErrorHandling` 函數，修改為：
```javascript
function withPhase4ErrorHandling(operation, context = {}, operationName = 'unknown') {
  try {
    Logger.log(`[簡化錯誤處理] 執行操作: ${operationName}`);
    return operation();
  } catch (error) {
    Logger.log(`[簡化錯誤處理] ${operationName} 失敗: ${error.toString()}`);
    throw error;
  }
}
```

## 📊 權限檢查清單

### Gmail 權限
- [ ] 可以搜尋郵件 (`GmailApp.search`)
- [ ] 可以讀取郵件內容
- [ ] 可以標記郵件為已讀

### Google Sheets 權限
- [ ] 可以開啟試算表
- [ ] 可以讀取工作表
- [ ] 可以寫入資料

### Google Drive 權限
- [ ] 可以存取資料夾
- [ ] 可以讀取檔案
- [ ] 可以移動檔案

### 腳本權限
- [ ] 可以建立觸發器
- [ ] 可以執行定時任務
- [ ] 可以存取屬性服務

## 🔍 常見問題解決

### Q1: 授權後仍然失敗
**解決方案：**
1. 完全登出 Google 帳號
2. 重新登入
3. 重新執行授權流程
4. 確認使用的是正確的 Google 帳號

### Q2: Phase4 組件持續缺失
**解決方案：**
1. 檢查檔案名稱是否正確（不要有額外空格）
2. 確認檔案內容完整
3. 嘗試重新建立檔案
4. 檢查是否有語法錯誤

### Q3: 觸發器建立失敗
**解決方案：**
1. 檢查函數名稱是否正確
2. 確認函數可以手動執行
3. 嘗試使用不同的觸發頻率
4. 檢查 Apps Script 配額限制

### Q4: 郵件搜尋失敗
**解決方案：**
1. 確認 Gmail 中有相關郵件
2. 檢查搜尋條件是否正確
3. 嘗試簡化搜尋條件
4. 檢查 Gmail API 配額

## 📈 監控和維護

### 定期檢查
1. **每日檢查**：查看觸發器執行記錄
2. **每週檢查**：執行診斷函數
3. **每月檢查**：檢查處理統計

### 日誌監控
定期查看 Apps Script 執行記錄：
1. 點擊「執行」→「執行記錄」
2. 查看是否有新的錯誤
3. 注意處理數量變化

### 效能優化
1. 限制每次處理的郵件數量
2. 增加錯誤處理和重試機制
3. 定期清理舊的執行記錄

## 🆘 如果問題持續

### 收集診斷資訊
1. 執行 `diagnoseV47AuthorizationIssues()` 的完整輸出
2. 觸發器執行記錄的截圖
3. 檔案列表的截圖
4. 具體的錯誤訊息

### 聯繫支援
提供以上診斷資訊，以便快速定位問題。

### 回退方案
如果問題無法解決，可以考慮：
1. 回退到 V46.1 版本
2. 使用簡化版功能
3. 暫時停用自動處理，改為手動處理

---

## ✅ 修復完成檢查清單

- [ ] 診斷函數執行成功
- [ ] 所有權限已重新授權
- [ ] 觸發器已重新建立
- [ ] 手動測試通過
- [ ] Phase4 組件載入正常
- [ ] 郵件處理功能正常
- [ ] 收據檢查功能正常
- [ ] 執行記錄無錯誤

完成以上檢查後，您的電子發票自動處理功能應該就能正常運作了！

---

**最後更新：** 2025-07-27  
**適用版本：** V47.1  
**緊急程度：** 高