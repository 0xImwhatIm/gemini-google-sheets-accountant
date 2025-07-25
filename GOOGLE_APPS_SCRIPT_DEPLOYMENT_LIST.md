# Google Apps Script 部署文件清單

## 📋 必須部署的文件

以下是需要複製到 Google Apps Script 專案中的所有文件，按照建議的順序排列：

---

## 🔢 部署順序（重要！）

### 第一批：核心配置和管理
1. **00_ConfigManager.gs** - 配置管理器（最先載入）
2. **01_config-setup.gs** - 配置設定精靈
3. **02_config-web-ui.gs** - 配置網頁界面

### 第二批：Phase 4 錯誤處理框架
4. **03_Phase4ErrorHandler.gs** - 核心錯誤處理器
5. **04_Phase4TransactionManager.gs** - 事務管理器
6. **05_Phase4ConsistencyChecker.gs** - 一致性檢查器
7. **06_Phase4NotificationManager.gs** - 通知管理器
8. **07_Phase4LedgerLinkDetector.gs** - 帳本關聯錯誤檢測器
9. **08_Phase4ExpenseRealizationHandler.gs** - 支出真實化錯誤處理器
10. **09_Phase4LinkRecoveryManager.gs** - 關聯操作恢復管理器
11. **10_Phase4ErrorHandlingIntegration.gs** - 整合管理器

### 第三批：主程式
12. **11_Code.gs** - 主程式（最後載入）

---

## 📁 文件對應表

| 專案中的文件名 | Google Apps Script 中建議的文件名 | 說明 |
|---|---|---|
| ConfigManager.gs | 00_ConfigManager.gs | 配置管理核心 |
| config-setup.gs | 01_config-setup.gs | 配置設定精靈 |
| config-web-ui.gs | 02_config-web-ui.gs | 配置網頁界面 |
| Phase4ErrorHandler.gs | 03_Phase4ErrorHandler.gs | 錯誤處理核心 |
| Phase4TransactionManager.gs | 04_Phase4TransactionManager.gs | 事務管理 |
| Phase4ConsistencyChecker.gs | 05_Phase4ConsistencyChecker.gs | 一致性檢查 |
| Phase4NotificationManager.gs | 06_Phase4NotificationManager.gs | 通知管理 |
| Phase4LedgerLinkDetector.gs | 07_Phase4LedgerLinkDetector.gs | 錯誤檢測 |
| Phase4ExpenseRealizationHandler.gs | 08_Phase4ExpenseRealizationHandler.gs | 支出處理 |
| Phase4LinkRecoveryManager.gs | 09_Phase4LinkRecoveryManager.gs | 恢復管理 |
| Phase4ErrorHandlingIntegration.gs | 10_Phase4ErrorHandlingIntegration.gs | 整合管理 |
| Code.gs | 11_Code.gs | 主程式 |

---

## 🚀 部署步驟

### 步驟 1：準備 Google Apps Script 專案
1. 前往 [Google Apps Script](https://script.google.com/)
2. 點擊「新增專案」
3. 將專案命名為「智慧記帳 GEM V47.0」

### 步驟 2：刪除預設文件
1. 刪除預設的 `Code.gs` 文件（我們會用自己的版本）

### 步驟 3：按順序添加文件
**重要：必須按照上述順序添加文件，以確保依賴關係正確！**

1. **添加 ConfigManager.gs**
   - 點擊「+」→「腳本」
   - 命名為 `00_ConfigManager.gs`
   - 複製 `ConfigManager.gs` 的完整內容

2. **添加 config-setup.gs**
   - 點擊「+」→「腳本」
   - 命名為 `01_config-setup.gs`
   - 複製 `config-setup.gs` 的完整內容

3. **依此類推...**
   - 按照上述順序逐一添加所有文件

### 步驟 4：驗證文件順序
確保 Google Apps Script 編輯器中的文件順序如下：
```
00_ConfigManager.gs
01_config-setup.gs
02_config-web-ui.gs
03_Phase4ErrorHandler.gs
04_Phase4TransactionManager.gs
05_Phase4ConsistencyChecker.gs
06_Phase4NotificationManager.gs
07_Phase4LedgerLinkDetector.gs
08_Phase4ExpenseRealizationHandler.gs
09_Phase4LinkRecoveryManager.gs
10_Phase4ErrorHandlingIntegration.gs
11_Code.gs
```

### 步驟 5：儲存專案
1. 按 `Ctrl+S` 或點擊「儲存」
2. 確認所有文件都已正確儲存

---

## ⚙️ 部署配置

### 步驟 1：設定觸發器（可選）
如果需要定時執行功能：
1. 點擊「觸發器」圖示
2. 添加觸發器
3. 選擇函數和執行頻率

### 步驟 2：部署為網頁應用程式
1. 點擊「部署」→「新增部署」
2. 選擇類型：「網頁應用程式」
3. 設定：
   - **執行身分**：我
   - **存取權限**：任何人
4. 點擊「部署」
5. **重要**：複製生成的網頁應用程式 URL

### 步驟 3：設定權限
1. 首次執行時會要求授權
2. 點擊「檢閱權限」
3. 選擇您的 Google 帳戶
4. 點擊「允許」

---

## 🧪 部署後測試

### 基本功能測試
在 Google Apps Script 編輯器中執行以下函數：

1. **測試配置管理器**
   ```javascript
   function testConfig() {
     const configManager = new ConfigManager();
     configManager.set('test.key', 'test.value');
     const value = configManager.get('test.key');
     console.log('Config test result:', value);
   }
   ```

2. **測試 iOS 捷徑 API**
   ```javascript
   manualIOSShortcutsTest();
   ```

3. **測試錯誤處理**
   ```javascript
   manualErrorHandlingTest();
   ```

### API 端點測試
使用您的部署 URL 測試：

1. **語音記帳測試**
   ```
   https://script.google.com/macros/s/YOUR_ID/exec?endpoint=voice&text=我買了咖啡花150元
   ```

2. **基本連接測試**
   ```
   https://script.google.com/macros/s/YOUR_ID/exec
   ```

---

## 🔧 可選文件

以下文件可以選擇性部署，用於測試和開發：

| 文件名 | 用途 | 是否必需 |
|---|---|---|
| config-tests.gs | 配置系統測試 | 可選 |
| quick-start.gs | 快速開始指南 | 可選 |
| setup-sheets-template.gs | Google Sheets 範本設定 | 建議 |

---

## ⚠️ 重要注意事項

### 文件順序的重要性
- **必須按照數字前綴順序**：Google Apps Script 按字母順序載入文件
- **依賴關係**：後面的文件依賴前面的文件中定義的類別和函數
- **錯誤順序的後果**：如果順序錯誤，會出現「未定義」錯誤

### 常見錯誤
1. **ReferenceError: ConfigManager is not defined**
   - 原因：ConfigManager.gs 沒有最先載入
   - 解決：確保 ConfigManager.gs 的文件名以 `00_` 開頭

2. **ReferenceError: phase4ErrorHandler is not defined**
   - 原因：Phase 4 文件載入順序錯誤
   - 解決：檢查所有 Phase 4 文件的數字前綴順序

3. **部署失敗**
   - 原因：文件中有語法錯誤
   - 解決：逐一檢查每個文件的語法

---

## 📞 需要幫助？

### 部署問題排除
1. **檢查文件順序**：確保按照建議的數字前綴命名
2. **檢查語法錯誤**：Google Apps Script 會顯示語法錯誤
3. **檢查權限設定**：確保已授予必要的權限
4. **檢查 API 金鑰**：確保 Gemini API 金鑰有效

### 聯繫支援
- 📖 查看 `DEPLOYMENT_GUIDE.md` 獲取更詳細的部署說明
- 🐛 如果遇到問題，請提供具體的錯誤訊息
- 💬 加入用戶社群獲取即時幫助

---

## ✅ 部署檢查清單

部署完成後，請確認以下項目：

- [ ] 所有 12 個文件都已正確添加
- [ ] 文件順序符合建議的數字前綴
- [ ] 專案已成功儲存
- [ ] 已部署為網頁應用程式
- [ ] 已獲取部署 URL
- [ ] 基本功能測試通過
- [ ] API 端點測試成功
- [ ] iOS 捷徑設定完成
- [ ] 所有功能正常運作

完成以上檢查後，您的智慧記帳 GEM V47.0 就可以正式使用了！🎉