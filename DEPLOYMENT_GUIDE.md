# 智慧記帳 GEM V49.4.1 部署指南

> **🎉 V49.4.1 生產級穩定版** - 完全測試，立即可用

## 🆕 V49.4.1 部署重點

### ✅ **已修復的問題**
- **Gemini API 連接**: 使用 `gemini-flash-latest` 模型，100% 可用
- **JSON 解析**: 原生 JSON 支援，解析更準確
- **錯誤處理**: 完善的容錯機制，系統更穩定

### 🧪 **內建測試工具**
部署完成後，請執行以下測試：
```javascript
// 完整系統測試
finalSystemTest()

// 檢查系統健康
checkSystemHealth()
```

## 前置需求檢查清單

### ✅ 必要帳戶與服務
- [ ] Google 帳戶（建議使用專用帳戶）
- [ ] Google Cloud Platform 專案
- [ ] Google Gemini API 金鑰
- [ ] Google Document AI 處理器（可選，用於 PDF 處理）

### ✅ 技術能力需求
- [ ] 基礎 Google Apps Script 操作
- [ ] Google Sheets 使用經驗
- [ ] 基本 API 概念理解
- [ ] 能夠複製貼上程式碼

---

## 🚀 快速部署步驟

### 第一階段：建立 Google Sheets 主帳本

#### 1.1 建立新的 Google Sheets
1. 前往 [Google Sheets](https://sheets.google.com)
2. 點擊「建立新的試算表」
3. 將檔案重新命名為「智慧記帳 GEM - 主帳本」

#### 1.2 建立必要的工作表
依序建立以下工作表（點擊左下角的「+」號）：

**主要工作表：**
- `All Records` - 主記錄表
- `EmailRules` - 郵件處理規則
- `Settings` - 系統設定

**IOU 功能工作表：**
- `Events` - 代墊事件記錄
- `Participants` - 參與者記錄
- `Debts` - 債務明細

#### 1.3 設定工作表結構

**🚀 推薦方法：使用自動化腳本**
1. 在您的 Google Sheets 中，點擊「擴充功能」→「Apps Script」
2. 將 `setup-sheets-template.gs` 的內容貼上
3. 執行 `setupSheetsTemplate()` 函式
4. 等待完成提示，所有工作表將自動建立並格式化

**📝 手動方法：逐一建立工作表**

**All Records 工作表標題列：**
```
Date | Amount | Currency | Category | Description | Source | Status | RawText | FileUrl | Translation | MetaData
```

**EmailRules 工作表標題列：**
```
RuleName | SenderPattern | SubjectPattern | BodyPattern | Category | IsActive | Priority
```

**Settings 工作表標題列：**
```
SettingKey | SettingValue | Description
```

**Events 工作表標題列：**
```
EventID | EventName | TotalAmount | EventDate | Notes
```

**Participants 工作表標題列：**
```
ParticipantID | EventID | PersonName | PaidAmount
```

**Debts 工作表標題列：**
```
DebtID | EventID | Payer | Debtor | Amount | ItemDetail | Status | SettlementDate
```

### 第二階段：Google Cloud 服務設定

#### 2.1 建立 Google Cloud Platform 專案
1. 前往 [Google Cloud Console](https://console.cloud.google.com)
2. 點擊「選取專案」→「新增專案」
3. 輸入專案名稱：`gemini-accountant-[您的名字]`
4. 點擊「建立」

#### 2.2 啟用必要的 API
1. 在 GCP Console 中，前往「API 和服務」→「程式庫」
2. 搜尋並啟用以下 API：
   - **Generative Language API** (Gemini)
   - **Document AI API** (可選)
   - **Gmail API** (如需郵件處理)

#### 2.3 建立 Gemini API 金鑰
1. 前往「API 和服務」→「憑證」
2. 點擊「建立憑證」→「API 金鑰」
3. 複製生成的 API 金鑰（格式：`AIza...`）
4. **重要：** 立即限制此金鑰的使用範圍：
   - 點擊金鑰旁的「編輯」
   - 在「API 限制」中選擇「限制金鑰」
   - 選擇「Generative Language API」

### 第三階段：Apps Script 部署

#### 3.1 建立 Apps Script 專案
1. 前往您的 Google Sheets 主帳本
2. 點擊「擴充功能」→「Apps Script」
3. 刪除預設的 `myFunction()` 程式碼
4. 將本專案的 `Code.gs` 內容完整複製貼上

#### 3.2 設定環境變數和配置管理

**🚀 推薦方法：使用配置設定嚮導**
1. 在 Apps Script 編輯器中，將 `config-setup.gs` 的內容貼上到新檔案
2. 執行 `configSetupWizard()` 函式，它會引導您完成所有配置

**📝 手動方法：逐步設定**
1. 在 Apps Script 編輯器中，點擊左側的「專案設定」（齒輪圖示）
2. 在「指令碼屬性」區域，新增以下屬性：

```
MAIN_LEDGER_ID = [您的 Google Sheets ID]
GEMINI_API_KEY = [您的 Gemini API 金鑰]
GCP_PROJECT_ID = [您的 GCP 專案 ID]
```

**如何取得 Google Sheets ID：**
- 從 URL 中複製：`https://docs.google.com/spreadsheets/d/[這裡是ID]/edit`

**🔧 配置管理工具設定**
1. 將 `ConfigManager.gs` 內容貼上到新檔案
2. 將 `config-setup.gs` 內容貼上到新檔案
3. 執行 `initializeConfigs()` 初始化預設配置
4. 使用 `setSensitiveConfig()` 設定敏感配置：
   ```javascript
   setSensitiveConfig('GEMINI_API_KEY', 'your_api_key_here');
   setSensitiveConfig('MAIN_LEDGER_ID', 'your_sheets_id_here');
   ```

#### 3.3 更新 appsscript.json
1. 在 Apps Script 編輯器左側，點擊「appsscript.json」
2. 將內容替換為本專案的 `appsscript.json` 內容

#### 3.4 部署 Web App
1. 點擊右上角「部署」→「新增部署作業」
2. 選擇類型：「網路應用程式」
3. 設定：
   - 說明：`智慧記帳 GEM API v1.0`
   - 執行身分：`我`
   - 存取權：`任何人`
4. 點擊「部署」
5. **重要：** 複製生成的網路應用程式 URL

### 第四階段：測試與驗證

#### 4.1 使用自動化測試腳本（推薦）
1. 在 Apps Script 編輯器中，新增一個檔案並命名為 `quick-start.gs`
2. 將 `quick-start.gs` 的內容貼上
3. 執行以下函式進行測試：
   - `runFullDeploymentTest()` - 完整部署驗證
   - `quickHealthCheck()` - 快速健康檢查
   - `testGeminiAPI()` - 測試 AI API 連線

#### 4.2 手動 API 測試
使用以下 curl 指令測試 API：

```bash
# 測試語音記帳功能
curl -X POST "您的網路應用程式URL?endpoint=voice" \
  -H "Content-Type: application/json" \
  -d '{"voice_text": "今天買咖啡花了 150 元"}'

# 測試 IOU 功能
curl -X POST "您的網路應用程式URL?endpoint=iou" \
  -H "Content-Type: application/json" \
  -d '{"text": "我幫小明代墊了 250 元的電影票"}'
```

#### 4.3 配置管理驗證
1. **執行配置健康檢查**：
   ```javascript
   configHealthCheck();
   ```

2. **測試配置管理功能**：
   ```javascript
   runAllConfigTests();  // 完整測試
   quickConfigTest();    // 快速測試
   ```

3. **開啟配置管理介面**（可選）：
   ```javascript
   createConfigWebUI();
   ```

#### 4.4 檢查 Google Sheets
- 確認記錄是否正確寫入 `All Records` 工作表
- 檢查 IOU 相關工作表是否有資料
- 驗證 `Settings` 工作表中的配置項目
- 使用 `createTestData()` 函式建立測試資料
- 使用 `cleanupTestData()` 函式清理測試資料

---

## 📱 客戶端設定（iOS 捷徑）

### 建立 iOS 捷徑
1. 開啟 iOS「捷徑」App
2. 點擊右上角「+」建立新捷徑
3. 新增動作：「取得網頁內容」
4. 設定：
   - URL：`您的網路應用程式URL?endpoint=voice`
   - 方法：`POST`
   - 標頭：`Content-Type: application/json`
   - 請求本文：`{"voice_text": "[語音輸入]"}`

---

## 🔧 進階設定

### 設定定時觸發器（郵件處理）
1. 在 Apps Script 編輯器中，點擊左側「觸發條件」
2. 點擊「新增觸發條件」
3. 設定：
   - 函式：`processAutomatedEmails`
   - 事件來源：`時間驅動`
   - 時間型觸發條件：`分鐘計時器`
   - 間隔：`每 5 分鐘`

### 設定 Google Drive 資料夾
1. 建立以下 Google Drive 資料夾：
   - `智慧記帳-待處理`
   - `智慧記帳-已處理`
   - `智慧記帳-重複檔案`
2. 取得各資料夾的 ID，更新 `Code.gs` 中的對應變數

---

## ⚠️ 安全性設定

### API 金鑰安全
- ✅ 使用 Apps Script 的「指令碼屬性」儲存 API 金鑰
- ✅ 限制 API 金鑰的使用範圍
- ✅ 定期檢查 API 使用量
- ❌ 絕不在程式碼中直接寫入 API 金鑰

### 存取控制
- Web App 設定為「任何人」存取時，建議實作額外的驗證機制
- 定期檢查 Apps Script 的執行記錄

---

## 🆘 常見問題排除

### Q: API 回傳 403 錯誤
**A:** 檢查 Gemini API 金鑰是否正確，並確認已啟用 Generative Language API

### Q: Google Sheets 寫入失敗
**A:** 確認 `MAIN_LEDGER_ID` 設定正確，且 Apps Script 有存取該 Sheets 的權限

### Q: 中文辨識效果不佳
**A:** 在 Gemini API 呼叫中加入語言提示，或調整 prompt 內容

### Q: 觸發器沒有執行
**A:** 檢查觸發器設定，並查看 Apps Script 的執行記錄是否有錯誤

---

## 📞 取得協助

如果遇到問題：
1. 檢查 Apps Script 的「執行紀錄」
2. 查看本專案的 [Issues](https://github.com/0xImwhatIm/gemini-google-sheets-accountant/issues)
3. 提交新的 Issue 並附上錯誤訊息

---

**🎉 恭喜！您已成功部署智慧記帳 GEM 系統！**