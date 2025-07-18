## 版本 V43.0 更新說明

**版本標題：進階解析版 (Advanced Parsing Edition)**

此版本為一次重大的功能更新，專注於解決執行超時問題，並大幅強化對真實世界中複雜 HTML 格式的解析能力。

### ✨ 主要功能與修正 / Major Features & Fixes

* **[新增] PDF 處理升級**
    * `processPdf` 函式現在具備偵測**加密 PDF 檔案**的能力。
    * 當偵測到加密檔案時，會立即停止處理並將其移至錯誤資料夾，有效避免了因嘗試讀取加密內容而導致的執行超時問題。

* **[強化] HTML 解析能力**
    * 大幅強化了 `callGeminiForNormalization` 的 AI Prompt，新增了專門處理**中華電信電子郵件**這類複雜表格佈局 (table-based layout) HTML 的規則與範例。
    * 現在能更準確地從混亂的 HTML 標籤中提取出關鍵的帳務資訊。

* **[修正] 附件格式相容性**
    * 修正了 `processAutomatedEmails` 函式，使其能夠正確辨識並處理以 `.htm` 為副檔名的附件，提升了對舊式電子郵件格式的相容性。
