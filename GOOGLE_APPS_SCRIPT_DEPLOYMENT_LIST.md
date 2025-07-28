# Google Apps Script 部署檔案清單

## 📋 必要部署檔案

以下是智慧記帳 GEM V47.0 需要部署到 Google Apps Script 的所有檔正確**：

---

## 🔢 部署順序（重要！）

### 第一階段：核心配置和基
```
1. ConfigManager.gs          - 配置管
2. config-setup.gs          - 配置設定精靈

4. config-tests.gs    選）
```

### 第二階段：Phase 4 錯誤處理框架
```
5. Phase4ErrorHandler.gs              - 核心錯誤處理器
6. Phase4TransactionManager.gs        - 事務管理器
7. Phase4ConsistencyChecker.gs        - 一致性檢查器
8. Phase4NotificationManager.gs       - 通知管理器
測器
10. Phase4E理器
11. Phase4LinkRecoveryManager.
器
```

### 第三階段：主程
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

###s

- **必要性**：gs 依賴此檔案

  - 配置讀取和寫入
  - 快取管理
  - 類型轉換
  - 預設值處理

#### config-setp.gs
- **用途**：配置設定精靈，引導用戶初始化配置

- **功能**：
  - 引導式配置設定
 金鑰驗證
  - Google Sheet 連接測試

#### config-web-ui.gs
- **用途**：提供網頁界面管理配置

- **功能**：
  - 網頁配置界面
  - 即時配置更新
  - 配置匯出/匯入

#### config-tests.gs
- **用途**：配置系統測試
 開發和測試用
- **功能**：
  - 配置系統單元測試
  -測試
  - 效能測試

### 🛡️ Phase 4 錯誤處理框架

#### Phase4ErrorHandler.gs
- **用途**：核心錯誤處理器
- **必要性**：**必須部署** - 其他 Phase 4 組件的基礎
- **功能**：
  - 智慧錯誤檢測
  - 錯誤分類和處理
  - 自動恢復機制

###
器
- **必要性**：**必
- **功能**：
  - 事務開始/提交/回滾
點管理
  -發控制

#### Phasegs
器
- **必要性**：**必須部署**
- **功能**：
  - 資料一致性檢查
  - 完整性驗證
  - 修復建議

#### Phase4Notific
- **用途**：通知管理器
- **必要性**：**必須部署誤通知和狀態回報
- **功能
  - 智慧通知分發
  - 通知優先級管理
  - 多通道支援


- **用途**：帳本關聯誤檢測器
- **必要性**：**必
- **功能**：
  - 帳本關聯錯誤檢測
  - 資料關聯性
式識別

ndler.gs
- **用途**：支出實化錯誤處理器
支出處理需要
- **功能**：
  - 支出真實化處理
誤恢復機制
  - 資料同步

#### Phase4LinkRecoveryManr.gs
- **用途**：關聯操作恢復管理器
- **必要性**：**必須部署** - 操作恢復需要
- **功能**：
  - 操作恢復管理
  - 狀態追蹤
  - 自動

#### Phase4ErrorHandn.gs
- **用途**：整合管理器
- **必要性**：**必須部署** - 統合所有 Ph能
- **功能
 - 組件整合
  - 統一介面
  - 生命週期管理

### 📱式

#### Code.gs
- **用途**：主程式，包所有核心功能
署** - 系統核心
- **功能**：
  - iO
  - 語音記帳處理
  - 圖片理
代墊款處理
  - 所有業務邏輯

### 🚀 輔助工具

gs
- *工具

- **功能**：
函數
  - 系統驗證
生成

#### setup-sh.gs
- **用途**：Google Sheets 範本設定
- **必要性**：**可選** - 自動建立工作表結構
- **功能**：
的工作表
  -
格式

---

## 🚀 部署步驟

### 1. 開啟 Google Apps Script
m)
2. 點擊「新增專案」
3. 將專案命名為「智慧記帳 GEM V47.0」

### 2. 按順序添加檔案


1. **刪除預設的 Code.gs**（暫時）
2. **添加 ConfigManager.gs**：
」
   - 命名為「Co」
   - 複製貼上 Config的內容

案**：
   加所有檔案
與清單一致


   - 添加主程式檔案
   - 確保所有依賴檔案都已添加

### 3. 儲存和部署
1. **儲存專案**：Ctrl+S 或點擊儲存圖示
*：
   - 點擊「」
   - 類型選擇「網頁應用程式」
   - 執行身分：「我」
   - 存取權限：「任何人」
點擊「部署」

置
1. **執行配置精靈

   configSetup
```
2. **測試系統**：
   ```javascript
   manualIOSSt()
   ```

---

## ⚠️ 重要注意事項


- **ConfigManager.gs** 必須最先部署hase 4 🎉有功能了！** EM V47.0 的所以開始使用智慧記帳 G署完成後，您就可

**部錄部署 URL [ ] 已記API
- 捷徑  ] 已測試 iOS
- [ [ ] 已測試基本功能izard()
-onfigSetupW執行 c
- [ ] 已署為網頁應用程式 已部存
- [ ]案已儲
- [ ] 專（最後）已部署Code.gs  [ ] 署
-e 4 檔案已按順序部8 個 Phas所有 部署
- [ ] i.gs 已ig-web-u] conf [ 
-up.gs 已部署-set [ ] config已部署
-.gs gergManaonfi

- [ ] C✅ 部署檢查清單

## 

--- 聯繫開發團隊入技術支援群組
- 📧
- 💬 加誤🐛 回報部署問題和錯署指南
- .md` 詳細部ENT_GUIDEOYM `DEPL- 📖 查看取幫助
## 獲執行日誌

#s Script 的 Appoogle查 G行日誌**：檢4. **查看執確
**：確保部署權限正設定**檢查權限整無誤
3. *：確保複製貼上完2. **檢查檔案內容*順序部署
清單**：確保按照檔案順序
1. **檢查## 如果遇到問題部署支援

#---

## 📞 


```imageint=c?endpo_ID/exeOURm/macros/s/Yoogle.cot.grip://sctpsn）
POST htmaST 工具如 Post要 PO
# 圖片記帳測試（需
0元啡花15t=我買了咖texoint=voice&/exec?endpR_IDos/s/YOU/macrcomript.google.tps://sc測試
GET ht 語音記帳`bash
#測試
``API 端點# 

##`st()
``essingTealImageProc圖片處理
manu 4. 測試)

//t(esutsTlIOSShortc
manuaiOS 捷徑 API/ 3. 測試 

/ngTest()HandlimanualError4 錯誤處理
試 Phase )

// 2. 測R_ID'N_LEDGEr.get('MAIgManage試配置管理
confi// 1. 測ipt
`javascr試
``

### 基本功能測 部署後測試---

## 🧪

成多個檔案檔案過大，需要拆分如果
- 100KB**單一檔案限制：** Script gle Apps制
- Goo

### 檔案大小限按照清單順序重新部署
   - 解決：案部署順序錯誤 原因：檔義」錯誤**
   - **「函數未定

3.有 Phase 4 檔案 解決：按順序部署所整部署
   -件未完原因：Phase 4 組d」**
   - defineler is not ErrorHand. **「phase4部署

2 最先anager.gsConfigM - 解決：確保 錯誤
  未部署或順序ger.gs ：ConfigMana 原因」**
   -finedr is not deigManage. **「conf誤
1

### 常見錯s** 必須最後部署de.g署
- **CoCode.gs 之前部** 必須在 組件
- **P