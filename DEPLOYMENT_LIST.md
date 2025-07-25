# Google Apps Script 部署檔案清單

## 📋 必要部署檔案

以下是智慧記帳 GEM V47.0 需要部署到 Google Apps Script 的所有檔案，**請按照順序部署以確保依賴關係正確**：

---

## 🔢 部署順序（重要！）

### 第一階段：核心配置和基礎設施
```
1. ConfigManager.gs          - 配置管理器（最先部署）
2. config-setup.gs          - 配置設定精靈
3. config-web-ui.gs         - 配置網頁界面
4. config-tests.gs          - 配置測試（可選）
```

### 第二階段：Phase 4 錯誤處理框架
```
5. Phase4ErrorHandler.gs              - 核心錯誤處理器
6. Phase4TransactionManager.gs        - 事務管理器
7. Phase4ConsistencyChecker.gs        - 一致性檢查器
8. Phase4NotificationManager.gs       - 通知管理器
9. Phase4LedgerLinkDetector.gs        - 帳本關聯錯誤檢測器
10. Phase4ExpenseRealizationHandler.gs - 支出真實化錯誤處理器
11. Phase4LinkRecoveryManager.gs       - 關聯操作恢復管理器
12. Phase4ErrorHandlingIntegration.gs  - 整合管理器
```

### 第三階段：主程式
```
13. Code.gs                  - 主程式（最後部署）
```

### 第四階段：輔助工具（可選）
```
14. quick-start.gs           - 快速開始工具
15. setup-sheets-template.gs - 工作表範本設定
```

---

## 📁 檔案說明

### 🔧 核心配置檔案

#### ConfigManager.gs ⭐ 必須
- **用途**：統一配置管理，支援動態配置和快取
- **必要性**：**必須部署** - Code.gs 依賴此檔案
- **功能**：配置讀取/寫入、快取管理、類型轉換

#### config-setup.gs ⭐ 強烈建議
- **用途**：配置設定精靈，引導用戶初始化配置
- **必要性**：**強烈建議** - 首次部署時必需
- **功能**：引導式配置設定、API 金鑰驗證

#### config-web-ui.gs 📱 建議
- **用途**：提供網頁界面管理配置
- **必要性**：**建議部署** - 方便配置管理
- **功能**：網頁配置界面、即時配置更新

### 🛡️ Phase 4 錯誤處理框架（全部必須）

所有 8 個 Phase 4 檔案都是**必須部署**的，它們提供：
- 智慧錯誤檢測和處理
- 事務管理和資料一致性
- 自動恢復機制
- 通知和監控功能

### 📱 主程式

#### Code.gs ⭐ 必須
- **用途**：主程式，包含所有核心功能
- **功能**：iOS 捷徑 API、語音/圖片記帳、IOU 處理

---

## 🚀 快速部署步驟

### 1. 建立新專案
1. 前往 [script.google.com](https://script.google.com)
2. 點擊「新增專案」
3. 命名為「智慧記帳 GEM V47.0」

### 2. 按順序添加檔案
**⚠️ 重要：請嚴格按照順序添加！**

1. **刪除預設 Code.gs**（暫時）
2. **添加 ConfigManager.gs**（第一個）
3. **添加 config-setup.gs**
4. **添加 config-web-ui.gs**
5. **添加 8 個 Phase 4 檔案**（按順序）
6. **最後添加 Code.gs**（最後一個）

### 3. 部署為網頁應用程式
1. 點擊「部署」→「新增部署」
2. 類型：「網頁應用程式」
3. 執行身分：「我」
4. 存取權限：「任何人」
5. 點擊「部署」

### 4. 初始化配置
```javascript
// 執行配置精靈
configSetupWizard()

// 測試系統
manualIOSShortcutsTest()
```

---

## ⚠️ 常見錯誤和解決方案

### 「configManager is not defined」
- **原因**：ConfigManager.gs 未部署或順序錯誤
- **解決**：確保 ConfigManager.gs 最先部署

### 「phase4ErrorHandler is not defined」
- **原因**：Phase 4 組件未完整部署
- **解決**：按順序部署所有 8 個 Phase 4 檔案

### 「函數未定義」錯誤
- **原因**：檔案部署順序錯誤
- **解決**：按照清單順序重新部署

---

## ✅ 部署檢查清單

- [ ] ConfigManager.gs 已部署（第1個）
- [ ] config-setup.gs 已部署
- [ ] config-web-ui.gs 已部署
- [ ] 8個 Phase 4 檔案已按順序部署
- [ ] Code.gs 已部署（最後1個）
- [ ] 專案已儲存
- [ ] 已部署為網頁應用程式
- [ ] 已執行 configSetupWizard()
- [ ] 已測試基本功能
- [ ] 已記錄部署 URL

**部署完成後，您就可以開始使用智慧記帳 GEM V47.0 了！** 🎉