# 智慧記帳 GEM 變更記錄 V47.3

## [V47.3] - 2025-07-28

### 🆕 新增功能 (Added)
- **商務發票智慧識別系統**
  - J 欄位：統一發票號碼自動識別（格式：2英文+8數字）
  - K 欄位：收據編號智慧提取（支援多種格式）
  - L 欄位：買方名稱自動填入（三聯式發票）
  - M 欄位：買方統一編號識別（8位數字）
  - N 欄位：賣方統一編號提取（商家統編）

- **多語言 OCR 翻譯功能**
  - 自動語言檢測（中文、英文、日文、法文、德文、韓文等）
  - S 欄位：完整 OCR 文字內容記錄
  - T 欄位：外文收據自動翻譯為繁體中文
  - 翻譯狀態追蹤和錯誤處理

- **旅行記帳支援**
  - 商家資訊完整提取（地址、電話、位置）
  - 支援「一張收據一個旅行回憶」概念
  - 外國收據無障礙處理

- **配置管理快速設定**
  - `setupMainLedgerId()` 函數
  - `setupGeminiApiKey()` 函數
  - `checkCurrentConfig()` 配置檢查函數

- **診斷工具增強**
  - `testBusinessInvoiceRecognition()` 商務發票測試
  - `checkBusinessInvoiceColumns()` 欄位對應檢查
  - `validateInvoiceNumber()` 發票號碼格式驗證
  - `validateTaxId()` 統一編號格式驗證

### 🔧 修復 (Fixed)
- **MAIN_LEDGER_ID 重複宣告錯誤**
  - 修復 Code.gs 中的常數重複宣告問題
  - 統一使用 `getConfig()` 函數獲取配置
  - 修復 quick-start.gs 和 fix-existing-data.gs 中的相同問題

- **iOS 捷徑 POST 資料處理**
  - 修復 `e.postData.contents` 未定義錯誤
  - 增強錯誤處理和診斷訊息
  - 完善 JSON 解析錯誤處理

- **ConfigManager 權限問題**
  - 修復 `SpreadsheetApp.openById` 權限不足問題
  - 統一使用 PropertiesService 管理敏感配置
  - 增強容錯機制

### 📊 改進 (Changed)
- **Gemini Vision API Prompt 優化**
  - 增強台灣發票識別規則
  - 改進商務資訊提取邏輯
  - 優化 JSON 回傳格式

- **元數據系統增強**
  - U 欄位包含更豐富的商務資訊
  - 新增翻譯狀態和商務資料標記
  - 改進處理時間和狀態追蹤

- **錯誤處理機制**
  - 更詳細的錯誤訊息
  - 改進診斷資訊輸出
  - 增強容錯和恢復機制

### 🗑️ 移除 (Removed)
- **過時的修復檔案**
  - ConfigManager_Fix.gs
  - ConfigManager_Error_Tracker.gs
  - ConfigManager_Permanent_Fix.gs
  - ConfigManager_Final_Solution.gs
  - Apple_Receipt_Debug_Tool.gs
  - Apple_Receipt_Fixed.gs
  - Email_Receipt_Complete_Solution.gs
  - email-diagnosis-fix.gs
  - V47_AUTHORIZATION_FIX.gs
  - V47_EMAIL_PROCESSING_ENHANCED.gs
  - V47_TRIGGER_UPDATE.gs
  - Sheets_Reorganization_Tool.gs
  - Fix_Missing_Currency_Sheet.gs
  - config-setup.gs（保留 config-setup-clean.gs）

- **過時的文件**
  - USER_MANUAL_V46.1_UPDATE.md
  - RELEASE_NOTES_V46.1.md
  - RELEASE_NOTES_V47.0.md
  - RELEASE_NOTES_V47.1.md
  - V47_URGENT_FIX_GUIDE.md
  - V47_EMAIL_ISSUES_COMPLETE_FIX.md
  - V46_EMAIL_INVOICE_FIX_GUIDE.md
  - QUICK_FIX_GUIDE.md
  - 欄位對應修正指南.md
  - 錯誤排除指南.md
  - 配置方式說明.md

### 🔒 安全性 (Security)
- **敏感資訊保護**
  - 配置資料統一使用 PropertiesService 儲存
  - 移除程式碼中的硬編碼配置
  - 增強 API 金鑰安全管理

### 📈 效能 (Performance)
- **異步翻譯處理**
  - 翻譯功能不阻塞主要記帳流程
  - 改進大量文字處理效能
  - 優化 API 調用頻率

- **快取機制優化**
  - ConfigManager 快取效能提升
  - 減少重複的 Google Sheets 存取
  - 內嵌匯率計算邏輯

### 🧪 測試 (Testing)
- **新增測試函數**
  - 商務發票識別測試
  - iOS 捷徑診斷工具
  - 配置驗證測試
  - 格式驗證函數

### 📚 文件 (Documentation)
- **更新部署指南**
  - 簡化設定流程說明
  - 新增快速設定步驟
  - 更新故障排除指南

- **新增功能說明**
  - 商務發票識別使用指南
  - 多語言翻譯功能說明
  - iOS 捷徑設定更新

---

## 版本比較

### V47.2 → V47.3 主要差異
- ✅ 新增商務發票識別（J/K/L/M/N 欄位）
- ✅ 新增多語言翻譯（S/T 欄位增強）
- ✅ 修復 MAIN_LEDGER_ID 重複宣告錯誤
- ✅ 優化 iOS 捷徑錯誤處理
- ✅ 清理 25 個過時檔案
- ✅ 簡化配置管理流程

### 升級建議
1. **立即升級**：修復了重大的系統啟動問題
2. **功能增強**：大幅提升商務和旅行記帳體驗
3. **維護性**：專案結構更加整潔
4. **穩定性**：錯誤處理更加完善

---

**維護者**：0ximwhatim & Gemini  
**發布日期**：2025-07-28  
**下一版本預告**：V47.4 將專注於效能優化和使用者體驗改進