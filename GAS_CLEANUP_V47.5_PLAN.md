# 🧹 Google Apps Script V47.5 清理計劃

## 📋 清理目標
配合 V47.5 版本，清理 Google Apps Script 專案中的過時和重複文件。

## ✅ **保留文件清單**

### **核心文件**
- `appsscript.json` - 專案配置文件
- `99_Code.gs` - V47.5 主代碼文件

### **功能文件（根據需要保留）**
- `email-triggers-fixed.gs` - 如果需要 Email 自動處理
- `Water-Bill-Email-Rule.gs` - 如果需要水費帳單處理
- `quick_start.gs` - 如果包含重要初始化邏輯

## 🗑️ **建議刪除文件清單**

### **Phase4 框架文件（已失效）**
- [ ] `04_Phase4ErrorHandler...`
- [ ] `05_Phase4TransactionM...`
- [ ] `06_Phase4Consistency...`
- [ ] `07_Phase4NotificationM...`
- [ ] `08_Phase4LedgerLinkDe...`
- [ ] `09_Phase4ExpenseReali...`
- [ ] `10_Phase4LinkRecovery...`
- [ ] `11_Phase4ErrorHandlingl...`

### **舊配置系統文件**
- [ ] `01_ConfigManager.gs`
- [ ] `02_config-setup-clean.gs`
- [ ] `03_config-web-ui.gs`

### **重複和測試文件**
- [ ] `Apple-Receipt-Complet...`
- [ ] `Apple_Receipt_Debug_T...`
- [ ] `Code_gs_timezone_fix_...`
- [ ] `completeImageAccounti...`
- [ ] `debug-ios-shortcuts.gs`
- [ ] `fix-existing-data.gs`
- [ ] `timezone-aware-date-fi...`

### **重複的 Email 處理文件**
- [ ] `Email-Receipt_Final_Solu...`
- [ ] `Email-Rules-Based-Proc...`
- [ ] `Email_Rules_Based_Proc...`
- [ ] `V47_EMAIL_PROCESSIN...`
- [ ] `email-triggers.gs` (保留 fixed 版本)

### **重複的水費帳單文件**
- [ ] `Water-Bill_Quick_Setup.gs`
- [ ] `Water_Bill_Column_Fix.gs`

## 🚀 **清理步驟**

### **步驟 1：備份重要文件**
在刪除前，確認以下文件的功能是否已整合到 V47.5：
1. 檢查 `email-triggers-fixed.gs` 的功能
2. 檢查 `Water-Bill-Email-Rule.gs` 的功能
3. 檢查 `quick_start.gs` 的內容

### **步驟 2：分批刪除**
建議分批刪除，每次刪除一類文件：

#### **第一批：Phase4 框架文件**
刪除所有 `Phase4` 開頭的文件，因為 V47.5 已完全移除此框架。

#### **第二批：舊配置文件**
刪除 `ConfigManager` 和 `config-` 開頭的文件。

#### **第三批：測試和重複文件**
刪除明顯的測試文件和重複功能文件。

### **步驟 3：功能驗證**
每批刪除後，測試主要功能：
1. 語音記帳功能
2. 圖片記帳功能
3. IOU 代墊款功能
4. Email 自動處理（如果需要）

## ⚠️ **注意事項**

### **刪除前確認**
1. **功能整合**：確認要刪除的文件功能已整合到 V47.5
2. **依賴關係**：檢查是否有其他文件引用要刪除的函數
3. **備份**：建議先在本地備份整個專案

### **安全刪除順序**
1. 先刪除明顯過時的文件（Phase4、舊配置）
2. 再刪除測試和重複文件
3. 最後評估功能文件

### **回滾計劃**
如果刪除後出現問題：
1. Google Apps Script 有版本歷史功能
2. 可以從本地備份恢復
3. 可以從 Git 倉庫恢復

## 📊 **預期效果**

### **清理前**
- 約 25+ 個文件
- 複雜的依賴關係
- 難以維護

### **清理後**
- 約 5-8 個文件
- 清晰的結構
- 易於維護

## 🎯 **建議的最終文件結構**

```
📁 Google Apps Script 專案
├── appsscript.json (專案配置)
├── 99_Code.gs (V47.5 主代碼)
├── email-triggers-fixed.gs (Email 處理，可選)
├── Water-Bill-Email-Rule.gs (水費帳單，可選)
└── quick_start.gs (初始化，可選)
```

## ✅ **清理檢查清單**

- [ ] 備份當前專案
- [ ] 確認 V47.5 功能正常
- [ ] 刪除 Phase4 框架文件
- [ ] 刪除舊配置系統文件
- [ ] 刪除測試和重複文件
- [ ] 驗證核心功能
- [ ] 測試 iOS 捷徑功能
- [ ] 確認 Email 處理（如需要）
- [ ] 文檔更新

---
**重要提醒**：清理是為了簡化維護，但安全第一。建議分步進行，每步都要驗證功能正常。