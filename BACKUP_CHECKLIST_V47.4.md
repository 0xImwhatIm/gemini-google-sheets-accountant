# 📦 備份檢查清單 - V47.4 文件清理前備份

**備份日期**：2025-08-05  
**備份目的**：文件清理前的安全備份  
**備份範圍**：完整專案文件夾  

---

## 🎯 **備份策略**

### **方法 1：Git 提交備份（推薦）**
```bash
# 1. 檢查當前狀態
git status

# 2. 添加所有文件到暫存區
git add .

# 3. 提交備份
git commit -m "📦 V47.4 文件清理前完整備份 - 2025-08-05

- 包含所有 105 個文件的完整備份
- 準備進行文件清理，刪除 45 個過時文件
- 保留核心功能：台北自來水帳單處理、時區修復、Phase4 錯誤處理
- 備份文件清單詳見 FILE_CLEANUP_RECOMMENDATIONS.md"

# 4. 創建備份標籤
git tag -a "backup-before-cleanup-v47.4" -m "文件清理前備份點"

# 5. 推送到遠端（如果有）
git push origin main
git push origin --tags
```

### **方法 2：文件夾複製備份**
```bash
# 創建備份文件夾
cp -r . ../智慧記帳-GEM-備份-2025-08-05

# 或者創建壓縮備份
tar -czf ../智慧記帳-GEM-備份-2025-08-05.tar.gz .
```

---

## 📋 **備份檢查清單**

### **✅ 核心系統文件**
- [ ] `Code.gs` - 當前主要代碼文件
- [ ] `Code_gs_V47.4.1_COMPLETE.gs` - 完整版本（最重要）
- [ ] `appsscript.json` - Google Apps Script 配置

### **✅ 當前功能文件**
- [ ] `Water_Bill_Email_Rule.gs` - 台北自來水帳單規則
- [ ] `Water_Bill_Column_Fix.gs` - 水費欄位修正工具
- [ ] `Water_Bill_Quick_Setup.gs` - 水費快速設定
- [ ] `WATER_BILL_EMAIL_SETUP_GUIDE.md` - 設定指南

### **✅ Phase 4 錯誤處理系統**
- [ ] `Phase4ConsistencyChecker.gs`
- [ ] `Phase4ErrorHandler.gs`
- [ ] `Phase4ErrorHandlingIntegration.gs`
- [ ] `Phase4ExpenseRealizationHandler.gs`
- [ ] `Phase4LedgerLinkDetector.gs`
- [ ] `Phase4LinkRecoveryManager.gs`
- [ ] `Phase4NotificationManager.gs`
- [ ] `Phase4TransactionManager.gs`

### **✅ 重要配置文件**
- [ ] `ConfigManager.gs` - 配置管理器
- [ ] `config-setup.gs` - 配置設定
- [ ] `config-web-ui.gs` - 配置 Web UI
- [ ] `.env.example` - 環境變數範例

### **✅ 重要文檔**
- [ ] `README.md` - 專案說明
- [ ] `DEPLOYMENT_GUIDE.md` - 部署指南
- [ ] `CONFIG_MANAGEMENT.md` - 配置管理指南
- [ ] `ERROR_HANDLING_GUIDE.md` - 錯誤處理指南
- [ ] `TESTING_GUIDE.md` - 測試指南
- [ ] `MAINTENANCE_GUIDE.md` - 維護指南

### **✅ 最新版本文檔**
- [ ] `RELEASE_NOTES_V47.4.md` - 最新發布說明
- [ ] `CHANGELOG_V47.4.md` - 最新變更日誌
- [ ] `BACKUP_CHECKLIST_V47.4.md` - 最新備份檢查清單

### **✅ 系統配置**
- [ ] `.gitignore` - Git 忽略文件
- [ ] `LICENSE` - 授權文件
- [ ] `.git/` 文件夾 - Git 版本控制

---

## 🔍 **備份驗證**

### **檢查備份完整性**
```bash
# 檢查文件數量
ls -la | wc -l

# 檢查重要文件是否存在
ls -la Code_gs_V47.4.1_COMPLETE.gs
ls -la Water_Bill_*.gs
ls -la Phase4*.gs

# 檢查文件大小
du -sh .
```

### **測試備份可用性**
```bash
# 如果是 Git 備份，檢查提交歷史
git log --oneline -5

# 如果是文件夾備份，檢查備份文件夾
ls -la ../智慧記帳-GEM-備份-2025-08-05/
```

---

## 🚨 **緊急恢復程序**

### **從 Git 備份恢復**
```bash
# 恢復到備份點
git reset --hard backup-before-cleanup-v47.4

# 或者恢復特定文件
git checkout backup-before-cleanup-v47.4 -- Code_gs_V47.4.1_COMPLETE.gs
```

### **從文件夾備份恢復**
```bash
# 恢復整個文件夾
cp -r ../智慧記帳-GEM-備份-2025-08-05/* .

# 或者恢復特定文件
cp ../智慧記帳-GEM-備份-2025-08-05/Code_gs_V47.4.1_COMPLETE.gs .
```

---

## 📊 **備份統計**

### **文件統計**
- **總文件數**：105 個文件
- **核心代碼文件**：15 個
- **Phase 4 系統文件**：8 個
- **文檔文件**：25 個
- **配置文件**：10 個
- **其他文件**：47 個

### **重要性分級**
- **🔴 關鍵文件**：`Code_gs_V47.4.1_COMPLETE.gs`, `Water_Bill_*.gs`
- **🟡 重要文件**：`Phase4*.gs`, `ConfigManager.gs`
- **🟢 一般文件**：文檔、指南、工具文件

---

## ✅ **備份完成確認**

完成備份後，請確認以下項目：

- [ ] **Git 提交成功**：`git log` 顯示最新的備份提交
- [ ] **標籤創建成功**：`git tag` 顯示備份標籤
- [ ] **重要文件完整**：核心代碼文件都已備份
- [ ] **備份可訪問**：能夠訪問備份位置
- [ ] **恢復程序測試**：測試恢復程序是否可用

---

## 🎯 **備份後的清理計劃**

備份完成後，可以安全執行以下清理步驟：

### **階段 1：安全清理**
```bash
# 刪除明確過時的文件
rm amount-diagnosis-tool.gs csv-amount-fix.gs email-diagnosis-fix.gs
rm timezone-aware-date-fix.gs fix-existing-data.gs
rm WORK_LOG_2025-07-28.md WORK_LOG_2025-08-04*.md
```

### **階段 2：功能清理**
```bash
# 刪除過時的配置管理工具
rm ConfigManager_Error_Tracker.gs ConfigManager_Fix.gs
rm ConfigManager_Final_Solution.gs ConfigManager_Permanent_Fix.gs
```

### **階段 3：文檔清理**
```bash
# 刪除過時的指南文檔
rm V47_URGENT_FIX_GUIDE.md CSV_PARSING_FIX_GUIDE.md
rm TIMEZONE_FIX_DEPLOYMENT_GUIDE.md COMPLETE_FIX_GUIDE_V47.md
```

---

**⚠️ 重要提醒：請在執行任何清理操作前，確保備份已完成並驗證無誤！**

**備份是安全清理的前提，請務必認真執行備份程序。** 🛡️