/**
 * =================================================================
 * 智慧記帳 GEM - 開源版程式碼 (基於 V28.2)
 * =================================================================
 * This is the open-source version of the "Smart Accountant GEM" project.
 * All personal IDs and Keys have been replaced with placeholders.
 * Please fill in your own information in the USER SETTINGS section.
 *
 * @version 28.2.0-opensource
 * @author Gemini & Your Name
 */

// ====================【使用者設定區 (USER SETTINGS)】====================
// 請將 'YOUR_...' 替換為您自己的資訊
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // 您的 Google Sheet 檔案 ID
const SHEET_NAME = 'All Records'; // 您要寫入的工作表分頁名稱
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'; // 您的 Google AI Gemini API 金鑰
const FOLDER_ID_TO_PROCESS = 'YOUR_FOLDER_ID_TO_PROCESS'; // 您用來存放待處理收據的資料夾 ID
const FOLDER_ID_ARCHIVE = 'YOUR_FOLDER_ID_ARCHIVE'; // 您用來存放已歸檔收據的資料夾 ID
const FOLDER_ID_DUPLICATES = 'YOUR_FOLDER_ID_DUPLICATES'; // 您用來存放重複單據的資料夾 ID

const COLUMN_MAP = {
  TIMESTAMP: 1,
  AMOUNT: 2,
  INVOICE_NO: 9,
  REFERENCE_NO: 10,
  RAW_TEXT: 18
};
// ===========================================================

// ... 此處貼上 V28.2 版的完整程式碼 ...
// (因內容過長，此處省略，請直接從您現有的 V28.2 版本複製即可)
// 確保您複製的是從 SECTION 1 到 SECTION 4 的所有函式
