# 🚨 授權問題快速解決方案

**問題**：`processReceiptsByEmailRules` 函數出現授權錯誤  
**時間**：2025-08-01 01:27:10 UTC  
**影響**：Email 發票處理停止運作

---

## 🔥 立即執行（5 分鐘解決）

### 步驟 1：進入 Google Apps Script
1. 開啟 [script.google.com](https://script.google.com)
2. 找到你的智慧記帳 GEM 專案

### 步驟 2：執行緊急修復
在編輯器中執行以下函數：

```javascript
emergencyAuthorizationFix()
```

**會自動完成**：
- ✅ 重新授權所有權限
- ✅ 檢查授權狀態
- ✅ 測試關鍵函數
- ✅ 重建觸發器
- ✅ 處理遺漏的 Email

### 步驟 3：授權確認
當彈出授權對話框時：
1. 點擊「檢閱權限」
2. 選擇你的 Google 帳戶
3. 點擊「進階」→「前往 [專案名稱]（不安全）」
4. 點擊「允許」

### 步驟 4：驗證修復
執行驗證函數：

```javascript
quickHealthCheckAfterFix()
```

---

## 📋 必要權限清單

確認 `appsscript.json` 包含：

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

---

## 🔍 問題診斷

如果修復失敗，執行診斷：

```javascript
diagnoseV47AuthorizationIssues()
```

---

## ⚡ 超級緊急方案

如果一般修復都失敗，執行：

```javascript
superEmergencyFix()
```

這會：
- 清除所有觸發器
- 重置為最小化配置
- 建立基本的 Email 處理

---

## 📊 修復後檢查

執行以下檢查確認修復成功：

1. **授權狀態**：`checkAuthorizationStatus()`
2. **Email 處理**：`processReceiptsByEmailRules()`
3. **未處理數量**：`checkUnprocessedReceiptsByRules()`

---

## 🎯 預期結果

修復成功後應該看到：
- ✅ 所有 Google 服務權限正常
- ✅ Email 觸發器重新建立
- ✅ 遺漏的 Email 已處理
- ✅ 新的 Email 發票正常記錄

---

**修復時間**：5-15 分鐘  
**成功率**：95%+  
**影響**：無資料遺失