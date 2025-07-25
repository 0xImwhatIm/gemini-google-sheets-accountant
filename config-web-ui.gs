/**
 * 智慧記帳 GEM - 配置管理 Web 介面
 * 
 * 提供網頁介面來管理系統配置
 */

/**
 * 建立配置管理的 HTML 介面
 */
function createConfigWebUI() {
  const html = HtmlService.createHtmlOutput(getConfigUIHtml())
    .setTitle('智慧記帳 GEM - 配置管理')
    .setWidth(800)
    .setHeight(600);
  
  SpreadsheetApp.getUi().showModalDialog(html, '配置管理介面');
}

/**
 * 獲取配置管理介面的 HTML
 */
function getConfigUIHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>智慧記帳 GEM - 配置管理</title>
  <style>
    body {
      font-family: 'Google Sans', Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f8f9fa;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #4285f4, #34a853);
      color: white;
      padding: 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .tabs {
      display: flex;
      background: #f1f3f4;
      border-bottom: 1px solid #dadce0;
    }
    .tab {
      flex: 1;
      padding: 15px;
      text-align: center;
      cursor: pointer;
      border: none;
      background: none;
      font-size: 14px;
      transition: all 0.3s;
    }
    .tab:hover {
      background: #e8eaed;
    }
    .tab.active {
      background: white;
      border-bottom: 3px solid #4285f4;
      font-weight: 500;
    }
    .tab-content {
      padding: 20px;
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .config-group {
      margin-bottom: 30px;
      border: 1px solid #dadce0;
      border-radius: 8px;
      overflow: hidden;
    }
    .config-group-header {
      background: #f8f9fa;
      padding: 15px;
      font-weight: 500;
      border-bottom: 1px solid #dadce0;
    }
    .config-item {
      padding: 15px;
      border-bottom: 1px solid #f1f3f4;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .config-item:last-child {
      border-bottom: none;
    }
    .config-info {
      flex: 1;
    }
    .config-key {
      font-weight: 500;
      color: #202124;
    }
    .config-description {
      font-size: 12px;
      color: #5f6368;
      margin-top: 4px;
    }
    .config-value {
      flex: 0 0 200px;
      margin-left: 20px;
    }
    .config-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 14px;
    }
    .config-input:focus {
      outline: none;
      border-color: #4285f4;
      box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
    }
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s;
      margin: 5px;
    }
    .btn-primary {
      background: #4285f4;
      color: white;
    }
    .btn-primary:hover {
      background: #3367d6;
    }
    .btn-success {
      background: #34a853;
      color: white;
    }
    .btn-success:hover {
      background: #137333;
    }
    .btn-warning {
      background: #fbbc04;
      color: #202124;
    }
    .btn-warning:hover {
      background: #f9ab00;
    }
    .btn-danger {
      background: #ea4335;
      color: white;
    }
    .btn-danger:hover {
      background: #d33b2c;
    }
    .status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .status-ok { background: #34a853; }
    .status-warning { background: #fbbc04; }
    .status-error { background: #ea4335; }
    .actions {
      padding: 20px;
      background: #f8f9fa;
      border-top: 1px solid #dadce0;
      text-align: center;
    }
    .log-area {
      background: #f8f9fa;
      border: 1px solid #dadce0;
      border-radius: 4px;
      padding: 15px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    .health-check {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .health-item {
      padding: 15px;
      border: 1px solid #dadce0;
      border-radius: 8px;
      background: white;
    }
    .health-item.healthy {
      border-left: 4px solid #34a853;
    }
    .health-item.warning {
      border-left: 4px solid #fbbc04;
    }
    .health-item.error {
      border-left: 4px solid #ea4335;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔧 智慧記帳 GEM 配置管理</h1>
      <p>統一管理系統配置，確保最佳效能與安全性</p>
    </div>
    
    <div class="tabs">
      <button class="tab active" onclick="showTab('overview')">📊 總覽</button>
      <button class="tab" onclick="showTab('system')">⚙️ 系統配置</button>
      <button class="tab" onclick="showTab('business')">💼 業務配置</button>
      <button class="tab" onclick="showTab('user')">👤 使用者配置</button>
      <button class="tab" onclick="showTab('tools')">🛠️ 工具</button>
    </div>
    
    <!-- 總覽頁面 -->
    <div id="overview" class="tab-content active">
      <h3>系統健康狀況</h3>
      <div class="health-check" id="healthCheck">
        <div class="health-item">
          <div class="config-key">載入中...</div>
        </div>
      </div>
      
      <h3>重要配置狀態</h3>
      <div id="importantConfigs">
        載入中...
      </div>
    </div>
    
    <!-- 系統配置頁面 -->
    <div id="system" class="tab-content">
      <div class="config-group">
        <div class="config-group-header">🔌 API 設定</div>
        <div id="systemApiConfigs">載入中...</div>
      </div>
      
      <div class="config-group">
        <div class="config-group-header">📊 效能設定</div>
        <div id="systemPerformanceConfigs">載入中...</div>
      </div>
      
      <div class="config-group">
        <div class="config-group-header">📝 日誌設定</div>
        <div id="systemLoggingConfigs">載入中...</div>
      </div>
    </div>
    
    <!-- 業務配置頁面 -->
    <div id="business" class="tab-content">
      <div class="config-group">
        <div class="config-group-header">💰 財務設定</div>
        <div id="businessFinanceConfigs">載入中...</div>
      </div>
      
      <div class="config-group">
        <div class="config-group-header">🤖 AI 處理設定</div>
        <div id="businessAiConfigs">載入中...</div>
      </div>
      
      <div class="config-group">
        <div class="config-group-header">📋 資料處理設定</div>
        <div id="businessDataConfigs">載入中...</div>
      </div>
    </div>
    
    <!-- 使用者配置頁面 -->
    <div id="user" class="tab-content">
      <div class="config-group">
        <div class="config-group-header">🔔 通知設定</div>
        <div id="userNotificationConfigs">載入中...</div>
      </div>
      
      <div class="config-group">
        <div class="config-group-header">🌍 地區化設定</div>
        <div id="userLocalizationConfigs">載入中...</div>
      </div>
      
      <div class="config-group">
        <div class="config-group-header">⚡ 偏好設定</div>
        <div id="userPreferenceConfigs">載入中...</div>
      </div>
    </div>
    
    <!-- 工具頁面 -->
    <div id="tools" class="tab-content">
      <h3>🔧 配置管理工具</h3>
      
      <div style="margin-bottom: 20px;">
        <button class="btn btn-primary" onclick="runHealthCheck()">🔍 健康檢查</button>
        <button class="btn btn-success" onclick="backupConfigs()">💾 備份配置</button>
        <button class="btn btn-warning" onclick="validateConfigs()">✅ 驗證配置</button>
        <button class="btn btn-primary" onclick="hotReload()">🔄 熱更新</button>
      </div>
      
      <div style="margin-bottom: 20px;">
        <button class="btn btn-primary" onclick="exportConfigs()">📤 匯出配置</button>
        <button class="btn btn-primary" onclick="importConfigs()">📥 匯入配置</button>
        <button class="btn btn-danger" onclick="resetConfigs()">🔄 重置為預設值</button>
      </div>
      
      <h3>📋 操作日誌</h3>
      <div id="logArea" class="log-area">
        準備就緒，等待操作...
      </div>
    </div>
    
    <div class="actions">
      <button class="btn btn-success" onclick="saveAllConfigs()">💾 儲存所有變更</button>
      <button class="btn btn-primary" onclick="refreshData()">🔄 重新載入</button>
      <button class="btn btn-warning" onclick="google.script.host.close()">❌ 關閉</button>
    </div>
  </div>

  <script>
    // 頁面載入時初始化
    window.onload = function() {
      loadAllConfigs();
      runHealthCheck();
    };
    
    // 切換頁籤
    function showTab(tabName) {
      // 隱藏所有頁籤內容
      const contents = document.querySelectorAll('.tab-content');
      contents.forEach(content => content.classList.remove('active'));
      
      // 移除所有頁籤的 active 狀態
      const tabs = document.querySelectorAll('.tab');
      tabs.forEach(tab => tab.classList.remove('active'));
      
      // 顯示選中的頁籤內容
      document.getElementById(tabName).classList.add('active');
      
      // 設定選中的頁籤為 active
      event.target.classList.add('active');
    }
    
    // 載入所有配置
    function loadAllConfigs() {
      log('載入配置中...');
      google.script.run
        .withSuccessHandler(displayConfigs)
        .withFailureHandler(handleError)
        .getAllConfigsForUI();
    }
    
    // 顯示配置
    function displayConfigs(configs) {
      // 實作配置顯示邏輯
      log('配置載入完成');
    }
    
    // 執行健康檢查
    function runHealthCheck() {
      log('執行健康檢查...');
      google.script.run
        .withSuccessHandler(displayHealthCheck)
        .withFailureHandler(handleError)
        .configHealthCheckForUI();
    }
    
    // 顯示健康檢查結果
    function displayHealthCheck(result) {
      const healthDiv = document.getElementById('healthCheck');
      let html = '';
      
      if (result.healthy) {
        html = '<div class="health-item healthy"><div class="config-key">✅ 系統健康狀況良好</div></div>';
      } else {
        html = '<div class="health-item error"><div class="config-key">⚠️ 發現問題</div>';
        result.issues.forEach(issue => {
          html += '<div class="config-description">• ' + issue + '</div>';
        });
        html += '</div>';
      }
      
      healthDiv.innerHTML = html;
      log('健康檢查完成');
    }
    
    // 儲存所有配置
    function saveAllConfigs() {
      log('儲存配置中...');
      // 收集所有變更的配置
      const configs = {};
      const inputs = document.querySelectorAll('.config-input');
      
      inputs.forEach(input => {
        if (input.dataset.changed === 'true') {
          configs[input.dataset.key] = input.value;
        }
      });
      
      if (Object.keys(configs).length === 0) {
        log('沒有變更需要儲存');
        return;
      }
      
      google.script.run
        .withSuccessHandler(() => {
          log('配置儲存成功');
          loadAllConfigs();
        })
        .withFailureHandler(handleError)
        .saveBatchConfigsForUI(configs);
    }
    
    // 備份配置
    function backupConfigs() {
      log('備份配置中...');
      google.script.run
        .withSuccessHandler((result) => {
          log('配置備份完成: ' + result.fileName);
        })
        .withFailureHandler(handleError)
        .backupConfigsForUI();
    }
    
    // 熱更新
    function hotReload() {
      log('執行熱更新...');
      google.script.run
        .withSuccessHandler((success) => {
          if (success) {
            log('熱更新成功');
            loadAllConfigs();
          } else {
            log('熱更新失敗，請檢查配置');
          }
        })
        .withFailureHandler(handleError)
        .hotReloadConfigsForUI();
    }
    
    // 重新載入資料
    function refreshData() {
      log('重新載入資料...');
      loadAllConfigs();
      runHealthCheck();
    }
    
    // 記錄日誌
    function log(message) {
      const logArea = document.getElementById('logArea');
      const timestamp = new Date().toLocaleTimeString();
      logArea.textContent += '[' + timestamp + '] ' + message + '\\n';
      logArea.scrollTop = logArea.scrollHeight;
    }
    
    // 錯誤處理
    function handleError(error) {
      log('錯誤: ' + error.toString());
    }
    
    // 標記輸入框變更
    function markChanged(input) {
      input.dataset.changed = 'true';
      input.style.borderColor = '#fbbc04';
    }
  </script>
</body>
</html>
  `;
}

/**
 * 為 Web UI 提供配置資料
 */
function getAllConfigsForUI() {
  try {
    return configManager.getAll();
  } catch (error) {
    throw new Error('獲取配置失敗: ' + error.toString());
  }
}

/**
 * 為 Web UI 提供健康檢查
 */
function configHealthCheckForUI() {
  try {
    return configHealthCheck();
  } catch (error) {
    throw new Error('健康檢查失敗: ' + error.toString());
  }
}

/**
 * 為 Web UI 儲存批次配置
 */
function saveBatchConfigsForUI(configs) {
  try {
    setBatchConfigs(configs);
    return true;
  } catch (error) {
    throw new Error('儲存配置失敗: ' + error.toString());
  }
}

/**
 * 為 Web UI 備份配置
 */
function backupConfigsForUI() {
  try {
    const fileId = backupConfigs();
    const file = DriveApp.getFileById(fileId);
    return {
      fileId: fileId,
      fileName: file.getName(),
      url: file.getUrl()
    };
  } catch (error) {
    throw new Error('備份配置失敗: ' + error.toString());
  }
}

/**
 * 為 Web UI 執行熱更新
 */
function hotReloadConfigsForUI() {
  try {
    return hotReloadConfigs();
  } catch (error) {
    throw new Error('熱更新失敗: ' + error.toString());
  }
}

/**
 * 在 Google Sheets 中建立配置管理選單
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔧 配置管理')
    .addItem('📊 開啟配置管理介面', 'createConfigWebUI')
    .addSeparator()
    .addItem('🧙‍♂️ 配置設定嚮導', 'configSetupWizard')
    .addItem('🔍 健康檢查', 'configHealthCheck')
    .addItem('💾 備份配置', 'backupConfigs')
    .addSeparator()
    .addItem('📤 匯出配置', 'exportConfigsToJson')
    .addItem('🔄 熱更新', 'hotReloadConfigs')
    .addToUi();
}