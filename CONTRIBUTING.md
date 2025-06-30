# Contributing to 智慧記帳 GEM

首先，非常感謝您願意花時間為「智慧記帳 GEM」做出貢獻！正是因為有像您一樣熱情的開發者，這個專案才能不斷成長與進化。

我們歡迎任何形式的貢獻，無論是回報一個錯誤、提出一個功能建議，還是直接提交程式碼的改進。

為了讓協作過程更順暢，請您在開始之前，花幾分鐘閱讀以下指南。

## 行為準則 (Code of Conduct)

本專案以及所有參與者都受到我們的 [行為準則 (CODE_OF_CONDUCT.md)](CODE_OF_CONDUCT.md) 的約束。在參與專案貢獻時，即表示您同意遵守其條款。我們的目標是為所有人創造一個友善、互相尊重且富有成效的協作環境。

## 如何貢獻？

### 回報錯誤 (Reporting Bugs)

如果您在使用過程中發現了錯誤，請先在 [GitHub Issues](https://github.com/0xImwhatIm/gemini-google-sheets-accountant/issues) 中搜尋是否已有人回報過相同的問題。

如果沒有，請建立一個新的 Issue，並盡可能提供以下資訊：
* **一個清晰、描述性的標題**，例如：「在處理日本 7-11 的收據時，金額辨識錯誤」。
* **詳細的重現步驟**：
    1.  您使用了哪個功能（例如「拍照記帳」）。
    2.  您輸入的數據是什麼（例如，可以附上已做過去敏處理的收據照片）。
    3.  您預期得到的結果是什麼。
    4.  您實際得到的結果是什麼。
* **相關的錯誤日誌**：請從 Google Apps Script 的「執行紀錄」中，複製相關的錯誤訊息。
* **您的環境資訊**：例如您使用的 iOS 捷徑版本、瀏覽器等。

### 提出功能建議 (Suggesting Enhancements)

我們非常樂意聽到您的新想法！如果您有一個可以讓「智慧記帳 GEM」變得更好的建議，請同樣在 [GitHub Issues](https://github.com/0xImwhatIm/gemini-google-sheets-accountant/issues) 中建立一個新的 Issue。

請在您的建議中詳細說明：
* **您想解決什麼問題？** 例如：「我希望能夠自動處理來自 Amazon JP 的訂單確認郵件。」
* **您建議的解決方案是什麼？** 描述您想像中的功能是如何運作的。
* **這個功能對其他使用者有什麼好處？**

### 貢獻程式碼 (Pull Requests)

如果您希望直接貢獻程式碼來修復錯誤或實現新功能，我們非常歡迎！

**開發流程:**

1.  **Fork 儲存庫**：點擊專案頁面右上角的「Fork」按鈕，將主儲存庫複製一份到您自己的 GitHub 帳戶下。
2.  **Clone 您的 Fork**：將您自己帳戶下的儲存庫 clone 到您的本地電腦。
    ```bash
    git clone [https://github.com/YOUR_USERNAME/gemini-google-sheets-accountant.git](https://github.com/YOUR_USERNAME/gemini-google-sheets-accountant.git)
    ```
3.  **建立新的分支 (Branch)**：請務必為您的修改建立一個新的分支，並給予其有意義的名稱（例如 `fix/receipt-parsing-error` 或 `feat/add-amazon-jp-rule`）。
    ```bash
    git checkout -b feat/add-amazon-jp-rule
    ```
4.  **進行修改**：在您的新分支上，進行程式碼的修改。
5.  **提交您的變更 (Commit)**：在完成修改後，提交您的變更。請務必撰寫清晰、規範的提交訊息。我們遵循 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 規範。
    * `feat:` (新功能)
    * `fix:` (修復錯誤)
    * `docs:` (修改文件)
    * `style:` (程式碼風格調整)
    * `refactor:` (程式碼重構)
    * `test:` (增加測試)
    * `chore:` (建構流程或輔助工具的變動)
    
    範例：
    ```bash
    git commit -m "feat: Add email processing rule for Amazon JP"
    ```
6.  **將您的分支推送到 GitHub**：
    ```bash
    git push origin feat/add-amazon-jp-rule
    ```
7.  **建立 Pull Request (PR)**：回到您在 GitHub 上的儲存庫頁面，您會看到一個建立 Pull Request 的提示。點擊它，並在 PR 的描述中，詳細說明您的修改內容、解決了哪個 Issue (例如 `Closes #42`)。

在您提交 PR 後，專案的核心維護者會盡快進行審查，並與您討論。我們可能會要求您進行一些修改，請保持開放的溝通！

再次感謝您的貢獻！
