# Phase 4 錯誤處理框架監控和維護指南

## 概述

本指南提供 Phase 4 錯誤處理框架的監控策略、維護程序和效能優化建議，幫助您確保系統的長期穩定運行。

---

## 📊 監控指標體系

### 核心監控指標

#### 1. 錯誤處理指標
```javascript
// 獲取錯誤處理統計
function getErrorHandlingMetrics() {
  const stats = phase4ErrorHandler.getErrorStats(24 * 60 * 60 * 1000); // 24小時
  
  return {
    // 基本指標
    totalErrors: stats.totalErrors || 0,
    resolvedErrors: stats.resolvedErrors || 0,
    pendingErrors: stats.pendingErrors || 0,
    
    // 成功率指標
    resolutionRate: stats.totalErrors > 0 ? (stats.resolvedErrors / stats.totalErrors * 100).toFixed(2) : 100,
    
    // 錯誤分布
    errorsByType: stats.errorsByType || {},
    errorsBySeverity: stats.errorsBySeverity || {},
    
    // 處理策略分布
    strategiesUsed: stats.strategiesUsed || {},
    
    // 時間指標
    averageResolutionTime: stats.averageResolutionTime || 0,
    maxResolutionTime: stats.maxResolutionTime || 0
  };
}
```

#### 2. 事務管理指標
```javascript
// 獲取事務管理統計
function getTransactionMetrics() {
  const transactionManager = new Phase4TransactionManager();
  const activeTransactions = transactionManager.getActiveTransactions();
  const transactionLog = transactionManager.getTransactionLog(100);
  
  const completedTransactions = transactionLog.filter(t => t.result === 'COMMITTED');
  const failedTransactions = transactionLog.filter(t => t.result === 'ROLLED_BACK');
  
  return {
    // 活動指標
    activeTransactionCount: activeTransactions.length,
    longestRunningTransaction: activeTransactions.length > 0 ? 
      Math.max(...activeTransactions.map(t => Date.now() - t.startTime)) : 0,
    
    // 成功率指標
    totalTransactions: transactionLog.length,
    successfulTransactions: completedTransactions.length,
    failedTransactions: failedTransactions.length,
    successRate: transactionLog.length > 0 ? 
      (completedTransactions.length / transactionLog.length * 100).toFixed(2) : 100,
    
    // 效能指標
    averageTransactionDuration: completedTransactions.length > 0 ?
      completedTransactions.reduce((sum, t) => sum + (t.duration || 0), 0) / completedTransactions.length : 0,
    
    // 資源使用
    totalOperations: transactionLog.reduce((sum, t) => sum + (t.operations?.length || 0), 0)
  };
}
```

#### 3. 一致性檢查指標
```javascript
// 獲取一致性檢查統計
function getConsistencyMetrics() {
  const checker = new Phase4ConsistencyChecker();
  const recentResults = checker.getRecentCheckResults(10);
  
  if (recentResults.length === 0) {
    return { message: '尚無一致性檢查記錄' };
  }
  
  const latestResult = recentResults[recentResults.length - 1];
  
  return {
    // 最新檢查結果
    lastCheckTime: latestResult.startTime,
    lastCheckDuration: latestResult.duration,
    lastCheckPassed: latestResult.summary.failedChecks === 0,
    
    // 問題統計
    totalInconsistencies: latestResult.summary.totalInconsistencies,
    criticalIssues: latestResult.summary.inconsistencies.filter(i => 
      ['HIGH', 'CRITICAL'].includes(i.severity || 'MEDIUM')).length,
    
    // 趨勢分析
    checksPerformed: recentResults.length,
    averageCheckDuration: recentResults.reduce((sum, r) => sum + (r.duration || 0), 0) / recentResults.length,
    
    // 檢查類型結果
    checkResults: latestResult.checks ? Object.keys(latestResult.checks).reduce((acc, key) => {
      acc[key] = latestResult.checks[key].passed;
      return acc;
    }, {}) : {}
  };
}
```

#### 4. 恢復機制指標
```javascript
// 獲取恢復機制統計
function getRecoveryMetrics() {
  const recoveryManager = phase4LinkRecoveryManager;
  const stats = recoveryManager.getRecoveryStats(24 * 60 * 60 * 1000); // 24小時
  const activeRecoveries = recoveryManager.getActiveRecoveries();
  
  return {
    // 活動指標
    activeRecoveries: activeRecoveries.length,
    pendingRecoveries: activeRecoveries.filter(r => r.status === 'PENDING_RECOVERY').length,
    
    // 成功率指標
    totalRecoveries: stats.totalRecoveries,
    successfulRecoveries: stats.successfulRecoveries,
    failedRecoveries: stats.failedRecoveries,
    recoverySuccessRate: stats.totalRecoveries > 0 ? 
      (stats.successfulRecoveries / stats.totalRecoveries * 100).toFixed(2) : 100,
    
    // 效能指標
    averageRecoveryDuration: stats.averageDuration,
    
    // 狀態分布
    recoveryStatusDistribution: activeRecoveries.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {})
  };
}
```

#### 5. 通知系統指標
```javascript
// 獲取通知系統統計
function getNotificationMetrics() {
  const notificationManager = new Phase4NotificationManager();
  const stats = notificationManager.getNotificationStats(24 * 60 * 60 * 1000); // 24小時
  
  return {
    // 發送統計
    totalNotifications: stats.total,
    sentNotifications: stats.sent,
    failedNotifications: stats.failed,
    deliveryRate: stats.total > 0 ? (stats.sent / stats.total * 100).toFixed(2) : 100,
    
    // 嚴重程度分布
    notificationsBySeverity: stats.bySeverity,
    
    // 錯誤類型分布
    notificationsByErrorType: stats.byErrorType,
    
    // 發送方式分布
    notificationsByMethod: stats.byMethod
  };
}
```

---

## 📈 監控儀表板

### 綜合監控儀表板
```javascript
// 生成完整的監控報告
function generateMonitoringDashboard() {
  Logger.log('=== Phase 4 錯誤處理框架監控儀表板 ===');
  Logger.log(`生成時間: ${new Date().toLocaleString('zh-TW')}`);
  Logger.log('');
  
  try {
    // 1. 錯誤處理指標
    Logger.log('📊 錯誤處理指標');
    const errorMetrics = getErrorHandlingMetrics();
    Logger.log(`  總錯誤數: ${errorMetrics.totalErrors}`);
    Logger.log(`  已解決: ${errorMetrics.resolvedErrors}`);
    Logger.log(`  待處理: ${errorMetrics.pendingErrors}`);
    Logger.log(`  解決率: ${errorMetrics.resolutionRate}%`);
    Logger.log(`  平均處理時間: ${errorMetrics.averageResolutionTime}ms`);
    Logger.log('');
    
    // 2. 事務管理指標
    Logger.log('🔄 事務管理指標');
    const transactionMetrics = getTransactionMetrics();
    Logger.log(`  活動事務: ${transactionMetrics.activeTransactionCount}`);
    Logger.log(`  總事務數: ${transactionMetrics.totalTransactions}`);
    Logger.log(`  成功率: ${transactionMetrics.successRate}%`);
    Logger.log(`  平均持續時間: ${transactionMetrics.averageTransactionDuration}ms`);
    Logger.log('');
    
    // 3. 一致性檢查指標
    Logger.log('✅ 一致性檢查指標');
    const consistencyMetrics = getConsistencyMetrics();
    if (consistencyMetrics.message) {
      Logger.log(`  ${consistencyMetrics.message}`);
    } else {
      Logger.log(`  最後檢查: ${consistencyMetrics.lastCheckTime}`);
      Logger.log(`  檢查結果: ${consistencyMetrics.lastCheckPassed ? '通過' : '失敗'}`);
      Logger.log(`  不一致問題: ${consistencyMetrics.totalInconsistencies}`);
      Logger.log(`  關鍵問題: ${consistencyMetrics.criticalIssues}`);
    }
    Logger.log('');
    
    // 4. 恢復機制指標
    Logger.log('🔧 恢復機制指標');
    const recoveryMetrics = getRecoveryMetrics();
    Logger.log(`  活動恢復: ${recoveryMetrics.activeRecoveries}`);
    Logger.log(`  總恢復數: ${recoveryMetrics.totalRecoveries}`);
    Logger.log(`  成功率: ${recoveryMetrics.recoverySuccessRate}%`);
    Logger.log(`  平均恢復時間: ${recoveryMetrics.averageRecoveryDuration}ms`);
    Logger.log('');
    
    // 5. 通知系統指標
    Logger.log('🔔 通知系統指標');
    const notificationMetrics = getNotificationMetrics();
    Logger.log(`  總通知數: ${notificationMetrics.totalNotifications}`);
    Logger.log(`  發送成功: ${notificationMetrics.sentNotifications}`);
    Logger.log(`  發送失敗: ${notificationMetrics.failedNotifications}`);
    Logger.log(`  送達率: ${notificationMetrics.deliveryRate}%`);
    Logger.log('');
    
    // 6. 系統健康狀態
    Logger.log('🏥 系統健康狀態');
    const healthScore = calculateSystemHealthScore({
      errorMetrics,
      transactionMetrics,
      consistencyMetrics,
      recoveryMetrics,
      notificationMetrics
    });
    Logger.log(`  健康評分: ${healthScore.score}/100`);
    Logger.log(`  狀態: ${healthScore.status}`);
    
    if (healthScore.warnings.length > 0) {
      Logger.log('  ⚠️ 警告:');
      healthScore.warnings.forEach(warning => {
        Logger.log(`    - ${warning}`);
      });
    }
    
    Logger.log('');
    Logger.log('=== 監控報告結束 ===');
    
    return {
      errorMetrics,
      transactionMetrics,
      consistencyMetrics,
      recoveryMetrics,
      notificationMetrics,
      healthScore
    };
    
  } catch (error) {
    Logger.log(`❌ 監控儀表板生成失敗: ${error.toString()}`);
    return null;
  }
}
```

### 系統健康評分算法
```javascript
// 計算系統健康評分
function calculateSystemHealthScore(metrics) {
  let score = 100;
  const warnings = [];
  
  // 錯誤處理評分 (30%)
  const errorResolutionRate = parseFloat(metrics.errorMetrics.resolutionRate);
  if (errorResolutionRate < 95) {
    score -= (95 - errorResolutionRate) * 0.6; // 每降低1%扣0.6分
    warnings.push(`錯誤解決率偏低: ${errorResolutionRate}%`);
  }
  
  // 事務管理評分 (25%)
  const transactionSuccessRate = parseFloat(metrics.transactionMetrics.successRate);
  if (transactionSuccessRate < 98) {
    score -= (98 - transactionSuccessRate) * 0.5; // 每降低1%扣0.5分
    warnings.push(`事務成功率偏低: ${transactionSuccessRate}%`);
  }
  
  // 一致性檢查評分 (20%)
  if (!metrics.consistencyMetrics.message && !metrics.consistencyMetrics.lastCheckPassed) {
    score -= 20;
    warnings.push('一致性檢查未通過');
  }
  if (metrics.consistencyMetrics.criticalIssues > 0) {
    score -= metrics.consistencyMetrics.criticalIssues * 5; // 每個關鍵問題扣5分
    warnings.push(`發現 ${metrics.consistencyMetrics.criticalIssues} 個關鍵一致性問題`);
  }
  
  // 恢復機制評分 (15%)
  const recoverySuccessRate = parseFloat(metrics.recoveryMetrics.recoverySuccessRate);
  if (recoverySuccessRate < 90) {
    score -= (90 - recoverySuccessRate) * 0.3; // 每降低1%扣0.3分
    warnings.push(`恢復成功率偏低: ${recoverySuccessRate}%`);
  }
  
  // 通知系統評分 (10%)
  const notificationDeliveryRate = parseFloat(metrics.notificationMetrics.deliveryRate);
  if (notificationDeliveryRate < 95) {
    score -= (95 - notificationDeliveryRate) * 0.2; // 每降低1%扣0.2分
    warnings.push(`通知送達率偏低: ${notificationDeliveryRate}%`);
  }
  
  // 確保評分不低於0
  score = Math.max(0, Math.round(score));
  
  // 確定健康狀態
  let status;
  if (score >= 90) {
    status = '優秀';
  } else if (score >= 80) {
    status = '良好';
  } else if (score >= 70) {
    status = '一般';
  } else if (score >= 60) {
    status = '需要關注';
  } else {
    status = '需要緊急處理';
  }
  
  return {
    score: score,
    status: status,
    warnings: warnings
  };
}
```

---

## 🔔 告警規則

### 告警閾值設定
```javascript
const PHASE4_ALERT_THRESHOLDS = {
  // 錯誤處理告警
  errorResolutionRate: {
    warning: 95,    // 解決率低於95%警告
    critical: 90    // 解決率低於90%嚴重告警
  },
  
  // 事務管理告警
  transactionSuccessRate: {
    warning: 98,    // 成功率低於98%警告
    critical: 95    // 成功率低於95%嚴重告警
  },
  
  activeTransactionCount: {
    warning: 5,     // 活動事務超過5個警告
    critical: 10    // 活動事務超過10個嚴重告警
  },
  
  // 一致性檢查告警
  inconsistencyCount: {
    warning: 1,     // 發現1個不一致問題警告
    critical: 5     // 發現5個不一致問題嚴重告警
  },
  
  // 恢復機制告警
  recoverySuccessRate: {
    warning: 90,    // 恢復成功率低於90%警告
    critical: 80    // 恢復成功率低於80%嚴重告警
  },
  
  // 通知系統告警
  notificationDeliveryRate: {
    warning: 95,    // 送達率低於95%警告
    critical: 90    // 送達率低於90%嚴重告警
  }
};
```

### 自動告警檢查
```javascript
// 執行告警檢查
function performAlertCheck() {
  const dashboard = generateMonitoringDashboard();
  if (!dashboard) return;
  
  const alerts = [];
  
  // 檢查錯誤處理告警
  const errorRate = parseFloat(dashboard.errorMetrics.resolutionRate);
  if (errorRate < PHASE4_ALERT_THRESHOLDS.errorResolutionRate.critical) {
    alerts.push({
      level: 'CRITICAL',
      message: `錯誤解決率嚴重偏低: ${errorRate}%`,
      metric: 'errorResolutionRate',
      value: errorRate
    });
  } else if (errorRate < PHASE4_ALERT_THRESHOLDS.errorResolutionRate.warning) {
    alerts.push({
      level: 'WARNING',
      message: `錯誤解決率偏低: ${errorRate}%`,
      metric: 'errorResolutionRate',
      value: errorRate
    });
  }
  
  // 檢查事務管理告警
  const transactionRate = parseFloat(dashboard.transactionMetrics.successRate);
  if (transactionRate < PHASE4_ALERT_THRESHOLDS.transactionSuccessRate.critical) {
    alerts.push({
      level: 'CRITICAL',
      message: `事務成功率嚴重偏低: ${transactionRate}%`,
      metric: 'transactionSuccessRate',
      value: transactionRate
    });
  }
  
  const activeTransactions = dashboard.transactionMetrics.activeTransactionCount;
  if (activeTransactions >= PHASE4_ALERT_THRESHOLDS.activeTransactionCount.critical) {
    alerts.push({
      level: 'CRITICAL',
      message: `活動事務數量過多: ${activeTransactions}`,
      metric: 'activeTransactionCount',
      value: activeTransactions
    });
  }
  
  // 檢查一致性告警
  if (dashboard.consistencyMetrics.criticalIssues >= PHASE4_ALERT_THRESHOLDS.inconsistencyCount.critical) {
    alerts.push({
      level: 'CRITICAL',
      message: `發現多個關鍵一致性問題: ${dashboard.consistencyMetrics.criticalIssues}`,
      metric: 'criticalInconsistencies',
      value: dashboard.consistencyMetrics.criticalIssues
    });
  }
  
  // 發送告警
  if (alerts.length > 0) {
    sendAlerts(alerts);
  }
  
  return alerts;
}

// 發送告警通知
function sendAlerts(alerts) {
  const criticalAlerts = alerts.filter(a => a.level === 'CRITICAL');
  const warningAlerts = alerts.filter(a => a.level === 'WARNING');
  
  if (criticalAlerts.length > 0) {
    const message = `🚨 Phase 4 系統嚴重告警\n\n${criticalAlerts.map(a => `• ${a.message}`).join('\n')}`;
    
    // 發送緊急通知
    if (typeof sendNotification === 'function') {
      sendNotification('Phase 4 系統嚴重告警', message, 'CRITICAL');
    }
  }
  
  if (warningAlerts.length > 0) {
    const message = `⚠️ Phase 4 系統警告\n\n${warningAlerts.map(a => `• ${a.message}`).join('\n')}`;
    
    // 發送警告通知
    if (typeof sendNotification === 'function') {
      sendNotification('Phase 4 系統警告', message, 'WARNING');
    }
  }
}
```

---

## 🛠️ 定期維護任務

### 日常維護清單
```javascript
// 每日維護任務
function performDailyMaintenance() {
  Logger.log('=== Phase 4 每日維護開始 ===');
  
  const tasks = [
    { name: '系統健康檢查', func: generateMonitoringDashboard },
    { name: '告警檢查', func: performAlertCheck },
    { name: '日誌輪轉檢查', func: checkLogRotation },
    { name: '活動事務檢查', func: checkActiveTransactions }
  ];
  
  const results = [];
  
  tasks.forEach(task => {
    try {
      Logger.log(`執行: ${task.name}`);
      const result = task.func();
      results.push({ name: task.name, success: true, result: result });
      Logger.log(`✅ ${task.name} 完成`);
    } catch (error) {
      results.push({ name: task.name, success: false, error: error.toString() });
      Logger.log(`❌ ${task.name} 失敗: ${error.toString()}`);
    }
  });
  
  Logger.log('=== Phase 4 每日維護結束 ===');
  return results;
}

// 每週維護任務
function performWeeklyMaintenance() {
  Logger.log('=== Phase 4 每週維護開始 ===');
  
  const tasks = [
    { name: '完整一致性檢查', func: () => new Phase4ConsistencyChecker().performFullConsistencyCheck() },
    { name: '錯誤日誌清理', func: cleanupOldErrorLogs },
    { name: '恢復狀態清理', func: cleanupOldRecoveryStates },
    { name: '效能分析', func: performPerformanceAnalysis }
  ];
  
  const results = [];
  
  tasks.forEach(task => {
    try {
      Logger.log(`執行: ${task.name}`);
      const result = task.func();
      results.push({ name: task.name, success: true, result: result });
      Logger.log(`✅ ${task.name} 完成`);
    } catch (error) {
      results.push({ name: task.name, success: false, error: error.toString() });
      Logger.log(`❌ ${task.name} 失敗: ${error.toString()}`);
    }
  });
  
  Logger.log('=== Phase 4 每週維護結束 ===');
  return results;
}
```

### 清理和優化工具
```javascript
// 清理舊的錯誤日誌
function cleanupOldErrorLogs(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30天
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const errorLogSheet = ss.getSheetByName('Phase4ErrorLog');
    
    if (!errorLogSheet) return { cleaned: 0, message: '錯誤日誌工作表不存在' };
    
    const data = errorLogSheet.getDataRange().getValues();
    const header = data[0];
    const timestampIndex = header.indexOf('Timestamp');
    
    if (timestampIndex === -1) return { cleaned: 0, message: '找不到時間戳欄位' };
    
    const cutoffTime = new Date(Date.now() - maxAge);
    let cleanedCount = 0;
    
    // 從後往前刪除，避免索引問題
    for (let i = data.length - 1; i >= 1; i--) {
      const timestamp = new Date(data[i][timestampIndex]);
      if (timestamp < cutoffTime) {
        errorLogSheet.deleteRow(i + 1);
        cleanedCount++;
      }
    }
    
    return { cleaned: cleanedCount, message: `已清理 ${cleanedCount} 條舊日誌` };
  } catch (error) {
    return { cleaned: 0, error: error.toString() };
  }
}

// 清理舊的恢復狀態
function cleanupOldRecoveryStates() {
  try {
    phase4LinkRecoveryManager.cleanupOldResults();
    return { success: true, message: '恢復狀態清理完成' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// 效能分析
function performPerformanceAnalysis() {
  const analysis = {
    timestamp: new Date(),
    metrics: {}
  };
  
  try {
    // 分析錯誤處理效能
    const errorMetrics = getErrorHandlingMetrics();
    analysis.metrics.errorHandling = {
      averageResolutionTime: errorMetrics.averageResolutionTime,
      maxResolutionTime: errorMetrics.maxResolutionTime,
      resolutionRate: errorMetrics.resolutionRate
    };
    
    // 分析事務管理效能
    const transactionMetrics = getTransactionMetrics();
    analysis.metrics.transactions = {
      averageDuration: transactionMetrics.averageTransactionDuration,
      successRate: transactionMetrics.successRate,
      activeCount: transactionMetrics.activeTransactionCount
    };
    
    // 分析一致性檢查效能
    const consistencyMetrics = getConsistencyMetrics();
    analysis.metrics.consistency = {
      averageCheckDuration: consistencyMetrics.averageCheckDuration,
      lastCheckPassed: consistencyMetrics.lastCheckPassed
    };
    
    Logger.log('效能分析完成:', JSON.stringify(analysis, null, 2));
    return analysis;
  } catch (error) {
    analysis.error = error.toString();
    return analysis;
  }
}
```

---

## 📅 監控時程表

### 自動化監控時程
```javascript
// 設定定期監控觸發器
function setupMonitoringTriggers() {
  // 刪除現有觸發器
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction().includes('phase4') || 
        trigger.getHandlerFunction().includes('monitoring')) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 每小時執行告警檢查
  ScriptApp.newTrigger('performAlertCheck')
    .timeBased()
    .everyHours(1)
    .create();
  
  // 每日執行維護任務
  ScriptApp.newTrigger('performDailyMaintenance')
    .timeBased()
    .everyDays(1)
    .atHour(2) // 凌晨2點執行
    .create();
  
  // 每週執行深度維護
  ScriptApp.newTrigger('performWeeklyMaintenance')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(3) // 週日凌晨3點執行
    .create();
  
  Logger.log('✅ 監控觸發器設定完成');
}
```

---

## 📋 監控檢查清單

### 每日檢查項目
- [ ] 系統健康評分是否正常（≥80分）
- [ ] 是否有新的嚴重錯誤
- [ ] 活動事務數量是否正常（<5個）
- [ ] 通知系統是否正常運作
- [ ] 錯誤日誌是否有異常增長

### 每週檢查項目
- [ ] 執行完整一致性檢查
- [ ] 檢查錯誤趨勢是否有惡化
- [ ] 清理過期的日誌和狀態資料
- [ ] 檢查系統效能是否有下降
- [ ] 驗證恢復機制是否正常

### 每月檢查項目
- [ ] 全面的效能基準測試
- [ ] 檢查配置是否需要調整
- [ ] 評估監控閾值是否合適
- [ ] 檢查文檔是否需要更新
- [ ] 規劃系統優化和升級

---

**重要提醒：**
- 監控數據應定期備份和分析
- 異常情況應及時處理，不要累積問題
- 定期檢查監控系統本身的健康狀態
- 根據業務變化調整監控策略和閾值