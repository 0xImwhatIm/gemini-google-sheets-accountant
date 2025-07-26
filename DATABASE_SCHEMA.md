# 智慧記帳 GEM - Google Sheets 資料庫結構說明

## 目的
本文件旨在為 AI 程式設計助理 Kiro 提供「智慧記帳 GEM」專案所使用的 Google Sheets 資料庫的完整結構與欄位說明。所有後端邏輯都圍繞此數據結構進行讀寫操作。

## 總覽 (Overview)
本資料庫由多個工作表 (Worksheets) 組成，每個工作表扮演一個獨立的資料表 (Table) 角色。主要分為兩大模組：

1. **核心記帳模組 (Core Ledger Module)**：用於記錄所有一般性的金融交易
2. **代墊款追蹤器模組 (IOU Tracker Module)**：一個獨立的子系統，用於管理複雜的社交金融關係

---

## 1. 核心記帳模組 (Core Ledger Module)

### 1.1 All Records (主帳本)
此為系統最核心的交易流水帳，記錄所有最終的金融活動。

| 欄位名稱 (Field Name) | 資料類型 (Data Type) | 說明 (Description) |
|---------------------|-------------------|------------------|
| TIMESTAMP | Datetime | 交易發生的精確時間 |
| AMOUNT | Number | 原始交易金額 |
| CURRENCY | String | 原始交易的幣別 (例如：TWD, JPY, USD) |
| EXCHANGE RATE | Number | 相對於 TWD 的匯率 |
| AMOUNT (TWD) | Number | 自動換算為新台幣後的金額 (AMOUNT * EXCHANGE RATE) |
| CATEGORY | String | 交易分類 (例如：食、衣、住、行) |
| ITEM | String | 交易項目或商品名稱的詳細描述 |
| ACCOUNT TYPE | String | 帳戶類型 (例如：私人、公司) |
| Linked_IOU_EventID | String (Foreign Key) | **[關鍵欄位]** 用於關聯至 Events 表的 EventID。若此筆交易為代墊款的總支出，此欄位將記錄對應的事件 ID |
| INVOICE NO. | String | 發票號碼 |
| REFERENCES NO. | String | 其他參考編號 (例如：載具號碼) |
| BUYER NAME | String | 買方名稱 |
| BUYER TAX ID | String | 買方統編 |
| SELLER TAX ID | String | 賣方統編 |
| RECEIPT IMAGE | URL | 原始單據的照片連結 (儲存於 Google Drive) |
| STATUS | String | 紀錄狀態 (例如：待確認、已確認) |
| SOURCE | String | 資料來源 (例如：OCR, 語音, PDF, Email CSV) |
| NOTES | String | 備註。對於代墊款，此處會自動註記個人實際支出 |
| Original Text (OCR) | String | 從 OCR 或其他來源獲取的未處理原始文字 |
| Translation (AI) | String | AI 翻譯或處理後的文字 |
| META_DATA | JSON String | 由 AI 解析出的、未正規化的原始 JSON 數據，用於除錯與追溯 |

---

## 2. 代墊款追蹤器模組 (IOU Tracker Module)
此模組由三個互相連結的資料表組成，共同描述一個完整的代墊款事件。

### 2.1 Events (事件總表)
記錄每一次代墊款事件的總體資訊。

| 欄位名稱 (Field Name) | 資料類型 (Data Type) | 說明 (Description) |
|---------------------|-------------------|------------------|
| EventID | String (Primary Key) | 事件的唯一識別碼，格式為 EVT- 開頭 |
| EventName | String | 使用者輸入的原始語句，作為事件的標題 |
| TotalAmount | Number | 該事件的總金額 |
| EventDate | Datetime | 事件發生的時間 |
| Notes | String | 備註 |

### 2.2 Participants (事件參與者表)
記錄在某個事件中，是誰支付了款項。

| 欄位名稱 (Field Name) | 資料類型 (Data Type) | 說明 (Description) |
|---------------------|-------------------|------------------|
| ParticipantID | String (Primary Key) | 參與者的唯一識別碼 |
| EventID | String (Foreign Key) | 關聯至 Events 表的 EventID |
| PersonName | String | 付款人的姓名 |
| PaidAmount | Number | 該付款人在這個事件中實際支付的總金額 |

### 2.3 Debts (債務明細表)
記錄由一個事件衍生的所有獨立債務關係。這是 IOU 模組的核心。

| 欄位名稱 (Field Name) | 資料類型 (Data Type) | 說明 (Description) |
|---------------------|-------------------|------------------|
| DebtID | String (Primary Key) | 單筆債務的唯一識別碼 |
| EventID | String (Foreign Key) | 關聯至 Events 表的 EventID |
| Payer | String | 付款人的姓名 |
| Debtor | String | 欠款人的姓名 |
| Amount | Number | 此筆獨立債務的金額 |
| ItemDetail | String | 該筆債務的具體事由 |
| Status | String | 債務狀態，只能是 Unsettled (未結清) 或 Settled (已結清) |
| SettlementDate | Datetime | 債務被結清的時間 |

---

## 3. 系統設定模組 (System Configuration Module)

### 3.1 EmailRules (郵件處理規則表)
定義了自動化郵件處理的規則。

| 欄位名稱 (Field Name) | 資料類型 (Data Type) | 說明 (Description) |
|---------------------|-------------------|------------------|
| Query | String | 符合 Gmail 搜尋語法標準的查詢字串 |
| Type | String | 該郵件的處理類型 (例如：CSV, HTML, PDF) |

### 3.2 Settings (通知設定表)
定義了智慧通報中心的通知規則。

| 欄位名稱 (Field Name) | 資料類型 (Data Type) | 說明 (Description) |
|---------------------|-------------------|------------------|
| Channel | String | 通知渠道 (例如：EMAIL, WEBHOOK) |
| Target | String / URL | 通知的目標地址 (例如：user@example.com 或一個 Webhook URL) |
| Level | String | 觸發通知的嚴重性級別 (例如：ALL, ERROR) |

---

## 4. 程式碼實作對應

### 4.1 All Records 表的欄位索引對應
```javascript
// 標準欄位順序 (0-based index)
const COLUMN_MAPPING = {
  TIMESTAMP: 0,           // A
  AMOUNT: 1,              // B
  CURRENCY: 2,            // C - 重要：只能是 TWD, JPY, USD, EUR, CNY
  EXCHANGE_RATE: 3,       // D
  AMOUNT_TWD: 4,          // E - 由公式計算
  CATEGORY: 5,            // F - 重要：只能是 食、衣、住、行、育、樂、醫療、保險、其他
  ITEM: 6,                // G
  ACCOUNT_TYPE: 7,        // H
  LINKED_IOU_EVENTID: 8,  // I
  INVOICE_NO: 9,          // J
  REFERENCES_NO: 10,      // K
  BUYER_NAME: 11,         // L
  BUYER_TAX_ID: 12,       // M
  SELLER_TAX_ID: 13,      // N
  RECEIPT_IMAGE: 14,      // O
  STATUS: 15,             // P
  SOURCE: 16,             // Q
  NOTES: 17,              // R
  ORIGINAL_TEXT_OCR: 18,  // S
  TRANSLATION_AI: 19,     // T
  META_DATA: 20           // U
};
```

### 4.2 資料驗證規則
```javascript
// 有效的幣別代碼
const VALID_CURRENCIES = ['TWD', 'JPY', 'USD', 'EUR', 'CNY'];

// 有效的類別
const VALID_CATEGORIES = ['食', '衣', '住', '行', '育', '樂', '醫療', '保險', '其他'];

// 有效的帳戶類型
const VALID_ACCOUNT_TYPES = ['私人', '公司'];

// 有效的狀態
const VALID_STATUSES = ['待確認', '已確認', 'Active'];
```

---

## 5. 重要注意事項

### 5.1 欄位對應錯誤的常見問題
- ❌ **錯誤**：C 欄位 (CURRENCY) 填入商品名稱如「飲料」、「咖啡」
- ✅ **正確**：C 欄位只能填入 TWD, JPY, USD, EUR, CNY

- ❌ **錯誤**：F 欄位 (CATEGORY) 填入具體商品名稱
- ✅ **正確**：F 欄位只能填入 食、衣、住、行、育、樂、醫療、保險、其他

### 5.2 公式設定
E 欄位 (AMOUNT TWD) 必須設定為自動計算公式：
```
={"Amount (TWD)"; ARRAYFORMULA(IF(ISBLANK(A2:A),, B2:B * D2:D))}
```

### 5.3 IOU 模組關聯
當一筆交易是代墊款的總支出時：
1. 在 All Records 表的 `Linked_IOU_EventID` 欄位填入對應的 EventID
2. 在 Events 表創建事件記錄
3. 在 Participants 表記錄付款人
4. 在 Debts 表記錄所有債務關係

這個結構確保了資料的完整性和一致性，支援複雜的代墊款追蹤功能。