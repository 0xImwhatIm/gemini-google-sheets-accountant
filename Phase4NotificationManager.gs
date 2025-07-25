/**
 * 智慧記帳 GEM - Phase 4 通知管理器
 * 
 * 負責處理 Phase 4 錯誤處理相關的通知和告警
 */

class Phase4NotificationManager {
  constructor() {
    this.notificationHistory = [];
    this.notificationRules = this.loadNotificationRules();
    this.rateLimiter = new Map(); // 防止通知洪水
  }

  /**
   * 發送錯誤通知
   * @param {Object} errorRecord - 錯誤記錄
   * @returns {Object} 發送結果
   */
  async sendErrorNotification(errorRecord) {
    try {
      // 檢查是否需要發送通知
      if (!this.shouldSendNotification(errorRecord)) {
        return {
          sent: false,
          reason: '根據規則不需要發送通知'
        };
      }
      
      // 檢查頻率限制
      if (this.isRateLimited(errorRecord)) {
        return {
          sent: false,
          reason: '通知頻率限制'
        };
      }
      
      // 準備通知內容
      const notification = this.prepareNotification(errorRecord);
      
      // 發送通知
      const result = await this.sendNotification(notification);
      
      // 記錄通知歷史
      this.recordNotification(errorRecord, notification, result);
      
      // 更新頻率限制
      this.updateRateLimit(errorRecord);
      
      return result;
      
    } catch (error) {
      Logger.log(`[Phase4NotificationManager] 發送通知失敗: ${error.toString()}`);
      return {
        sent: false,
        error: error.toString()
      };
    }
  }

  /**
   * 發送關鍵告警
   * @param {Object} errorRecord - 錯誤記錄
   */
  async sendCriticalAlert(errorRecord) {
    const criticalNotification = {
      title: '🚨 智慧記帳 GEM - 關鍵錯誤告警',
      message: this.formatCriticalMessage(errorRecord),
      severity: 'CRITICAL',
      urgent: true,
      errorRecord: errorRecord
    };
    
    // 關鍵告警忽略頻率限制
    const result = await this.sendNotification(criticalNotification);
    
    // 記錄關鍵告警
    this.recordNotification(errorRecord, criticalNotification, result);
    
    return result;
  }

  /**
   * 判斷是否應該發送通知
   */
  shouldSendNotification(errorRecord) {
    const { errorType, severity } = errorRecord;
    
    // 關鍵錯誤總是通知
    if (severity === PHASE4_ERROR_SEVERITY.CRITICAL) {
      return true;
    }
    
    // 高嚴重程度錯誤通知
    if (severity === PHASE4_ERROR_SEVERITY.HIGH) {
      return true;
    }
    
    // 需要人工介入的錯誤通知
    if (errorRecord.resolution && errorRecord.resolution.requiresManualIntervention) {
      return true;
    }
    
    // 檢查特定錯誤類型的規則
    const rule = this.notificationRules[errorType];
    if (rule) {
      return rule.notify;
    }
    
    // 預設不通知低嚴重程度錯誤
    return severity !== PHASE4_ERROR_SEVERITY.LOW;
  }

  /**
   * 檢查頻率限制
   */
  isRateLimited(errorRecord) {
    const key = `${errorRecord.errorType}_${errorRecord.severity}`;
    const now = Date.now();
    const limit = this.getRateLimit(errorRecord);
    
    const lastNotification = this.rateLimiter.get(key);
    if (lastNotification && (now - lastNotification) < limit.interval) {
      return true;
    }
    
    return false;
  }

  /**
   * 獲取頻率限制設定
   */
  getRateLimit(errorRecord) {
    const { severity } = errorRecord;
    
    switch (severity) {
      case PHASE4_ERROR_SEVERITY.CRITICAL:
        return { interval: 0 }; // 無限制
        
      case PHASE4_ERROR_SEVERITY.HIGH:
        return { interval: 5 * 60 * 1000 }; // 5分鐘
        
      case PHASE4_ERROR_SEVERITY.MEDIUM:
        return { interval: 15 * 60 * 1000 }; // 15分鐘
        
      case PHASE4_ERROR_SEVERITY.LOW:
        return { interval: 60 * 60 * 1000 }; // 1小時
        
      default:
        return { interval: 30 * 60 * 1000 }; // 30分鐘
    }
  }

  /**
   * 更新頻率限制
   */
  updateRateLimit(errorRecord) {
    const key = `${errorRecord.errorType}_${errorRecord.severity}`;
    this.rateLimiter.set(key, Date.now());
  }

  /**
   * 準備通知內容
   */
  prepareNotification(errorRecord) {
    const notification = {
      title: this.formatTitle(errorRecord),
      message: this.formatMessage(errorRecord),
      severity: errorRecord.severity,
      timestamp: new Date(),
      errorId: errorRecord.errorId,
      errorType: errorRecord.errorType
    };
    
    return notification;
  }

  /**
   * 格式化通知標題
   */
  formatTitle(errorRecord) {
    const severityEmoji = {
      [PHASE4_ERROR_SEVERITY.CRITICAL]: '🚨',
      [PHASE4_ERROR_SEVERITY.HIGH]: '⚠️',
      [PHASE4_ERROR_SEVERITY.MEDIUM]: '⚡',
      [PHASE4_ERROR_SEVERITY.LOW]: 'ℹ️'
    };
    
    const emoji = severityEmoji[errorRecord.severity] || '⚠️';
    const typeText = this.getErrorTypeDisplayName(errorRecord.errorType);
    
    return `${emoji} 智慧記帳 GEM - ${typeText}`;
  }

  /**
   * 格式化通知訊息
   */
  formatMessage(errorRecord) {
    const lines = [];
    
    // 基本資訊
    lines.push(`錯誤類型: ${this.getErrorTypeDisplayName(errorRecord.errorType)}`);
    lines.push(`嚴重程度: ${errorRecord.severity}`);
    lines.push(`發生時間: ${errorRecord.timestamp.toLocaleString('zh-TW')}`);
    lines.push(`錯誤 ID: ${errorRecord.errorId}`);
    
    // 錯誤詳情
    if (errorRecord.originalError) {
      lines.push(`\\n錯誤詳情: ${errorRecord.originalError.toString()}`);
    }
    
    // 處理結果
    if (errorRecord.resolution) {
      lines.push(`\\n處理策略: ${errorRecord.handlingStrategy}`);
      lines.push(`處理結果: ${errorRecord.resolution.success ? '成功' : '失敗'}`);
      
      if (errorRecord.resolution.message) {
        lines.push(`處理訊息: ${errorRecord.resolution.message}`);
      }
      
      if (errorRecord.resolution.requiresManualIntervention) {
        lines.push(`\\n⚠️ 需要人工介入處理`);
        
        if (errorRecord.resolution.reviewInstructions) {
          lines.push(`處理建議:`);
          errorRecord.resolution.reviewInstructions.forEach(instruction => {
            lines.push(`  • ${instruction}`);
          });
        }
      }
    }
    
    // 受影響的記錄
    if (errorRecord.affectedRecords && errorRecord.affectedRecords.length > 0) {
      lines.push(`\\n受影響的記錄:`);
      errorRecord.affectedRecords.forEach(record => {
        lines.push(`  • ${record.type}: ${record.id}`);
      });
    }
    
    return lines.join('\\n');
  }

  /**
   * 格式化關鍵錯誤訊息
   */
  formatCriticalMessage(errorRecord) {
    const lines = [];
    
    lines.push(`🚨 發生關鍵錯誤，需要立即處理！`);
    lines.push(``);
    lines.push(`錯誤類型: ${this.getErrorTypeDisplayName(errorRecord.errorType)}`);
    lines.push(`發生時間: ${errorRecord.timestamp.toLocaleString('zh-TW')}`);
    lines.push(`錯誤 ID: ${errorRecord.errorId}`);
    
    if (errorRecord.originalError) {
      lines.push(``);
      lines.push(`錯誤詳情: ${errorRecord.originalError.toString()}`);
    }
    
    lines.push(``);
    lines.push(`請立即檢查系統狀態並採取適當的修復措施。`);
    
    return lines.join('\\n');
  }

  /**
   * 獲取錯誤類型顯示名稱
   */
  getErrorTypeDisplayName(errorType) {
    const displayNames = {
      [PHASE4_ERROR_TYPES.NETWORK_ERROR]: '網路錯誤',
      [PHASE4_ERROR_TYPES.API_LIMIT_ERROR]: 'API 限制錯誤',
      [PHASE4_ERROR_TYPES.PERMISSION_ERROR]: '權限錯誤',
      [PHASE4_ERROR_TYPES.SERVICE_UNAVAILABLE_ERROR]: '服務不可用錯誤',
      [PHASE4_ERROR_TYPES.DATA_INCONSISTENCY_ERROR]: '資料不一致錯誤',
      [PHASE4_ERROR_TYPES.DATA_FORMAT_ERROR]: '資料格式錯誤',
      [PHASE4_ERROR_TYPES.DATA_CONFLICT_ERROR]: '資料衝突錯誤',
      [PHASE4_ERROR_TYPES.DATA_INTEGRITY_ERROR]: '資料完整性錯誤',
      [PHASE4_ERROR_TYPES.LEDGER_LINK_ERROR]: '帳本關聯錯誤',
      [PHASE4_ERROR_TYPES.EXPENSE_REALIZATION_ERROR]: '支出真實化錯誤',
      [PHASE4_ERROR_TYPES.AMOUNT_CALCULATION_ERROR]: '金額計算錯誤',
      [PHASE4_ERROR_TYPES.DUPLICATE_DETECTION_ERROR]: '重複檢測錯誤',
      [PHASE4_ERROR_TYPES.INPUT_VALIDATION_ERROR]: '輸入驗證錯誤',
      [PHASE4_ERROR_TYPES.OPERATION_SEQUENCE_ERROR]: '操作序列錯誤',
      [PHASE4_ERROR_TYPES.INSUFFICIENT_PERMISSION_ERROR]: '權限不足錯誤'
    };
    
    return displayNames[errorType] || errorType;
  }

  /**
   * 實際發送通知
   */
  async sendNotification(notification) {
    try {
      // 使用現有的 sendNotification 函數
      if (typeof sendNotification === 'function') {
        sendNotification(
          notification.title,
          notification.message,
          notification.severity
        );
        
        return {
          sent: true,
          method: 'sendNotification',
          timestamp: new Date()
        };
      } else {
        // 降級到 Logger
        Logger.log(`[Phase4Notification] ${notification.title}`);
        Logger.log(`[Phase4Notification] ${notification.message}`);
        
        return {
          sent: true,
          method: 'logger',
          timestamp: new Date()
        };
      }
    } catch (error) {
      Logger.log(`[Phase4NotificationManager] 通知發送失敗: ${error.toString()}`);
      return {
        sent: false,
        error: error.toString()
      };
    }
  }

  /**
   * 記錄通知歷史
   */
  recordNotification(errorRecord, notification, result) {
    const record = {
      timestamp: new Date(),
      errorId: errorRecord.errorId,
      errorType: errorRecord.errorType,
      severity: errorRecord.severity,
      notificationTitle: notification.title,
      sent: result.sent,
      method: result.method,
      error: result.error
    };
    
    this.notificationHistory.push(record);
    
    // 限制歷史記錄數量
    if (this.notificationHistory.length > 1000) {
      this.notificationHistory = this.notificationHistory.slice(-500);
    }
  }

  /**
   * 載入通知規則
   */
  loadNotificationRules() {
    // 預設通知規則
    const defaultRules = {};
    
    // 為每種錯誤類型設定預設規則
    Object.values(PHASE4_ERROR_TYPES).forEach(errorType => {
      defaultRules[errorType] = {
        notify: true,
        methods: ['email'],
        minSeverity: PHASE4_ERROR_SEVERITY.MEDIUM
      };
    });
    
    // 特殊規則
    defaultRules[PHASE4_ERROR_TYPES.NETWORK_ERROR] = {
      notify: false, // 網路錯誤通常會自動重試，不需要立即通知
      methods: ['email'],
      minSeverity: PHASE4_ERROR_SEVERITY.HIGH
    };
    
    defaultRules[PHASE4_ERROR_TYPES.DATA_INCONSISTENCY_ERROR] = {
      notify: true,
      methods: ['email', 'webhook'],
      minSeverity: PHASE4_ERROR_SEVERITY.LOW // 資料不一致問題需要及時關注
    };
    
    return defaultRules;
  }

  /**
   * 獲取通知統計
   */
  getNotificationStats(timeRange = 24 * 60 * 60 * 1000) { // 24小時
    const cutoffTime = new Date(Date.now() - timeRange);
    const recentNotifications = this.notificationHistory.filter(n => 
      n.timestamp > cutoffTime
    );
    
    const stats = {
      total: recentNotifications.length,
      sent: recentNotifications.filter(n => n.sent).length,
      failed: recentNotifications.filter(n => !n.sent).length,
      bySeverity: {},
      byErrorType: {},
      byMethod: {}
    };
    
    // 按嚴重程度統計
    recentNotifications.forEach(n => {
      stats.bySeverity[n.severity] = (stats.bySeverity[n.severity] || 0) + 1;
      stats.byErrorType[n.errorType] = (stats.byErrorType[n.errorType] || 0) + 1;
      if (n.method) {
        stats.byMethod[n.method] = (stats.byMethod[n.method] || 0) + 1;
      }
    });
    
    return stats;
  }

  /**
   * 清理舊的通知記錄
   */
  cleanupNotificationHistory(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7天
    const cutoffTime = new Date(Date.now() - maxAge);
    
    this.notificationHistory = this.notificationHistory.filter(record => 
      record.timestamp > cutoffTime
    );
  }
}

// =================================================================================================
// Phase4ErrorLogger - 錯誤日誌管理器
// =================================================================================================

class Phase4ErrorLogger {
  constructor() {
    this.logBuffer = [];
    this.maxBufferSize = 100;
    this.flushInterval = 30000; // 30秒
    this.setupAutoFlush();
  }

  /**
   * 記錄錯誤
   * @param {Object} errorRecord - 錯誤記錄
   */
  async logError(errorRecord) {
    try {
      // 添加到緩衝區
      this.logBuffer.push({
        ...errorRecord,
        loggedAt: new Date()
      });
      
      // 如果緩衝區滿了，立即刷新
      if (this.logBuffer.length >= this.maxBufferSize) {
        await this.flushLogs();
      }
      
    } catch (error) {
      Logger.log(`[Phase4ErrorLogger] 記錄錯誤失敗: ${error.toString()}`);
    }
  }

  /**
   * 更新錯誤記錄
   * @param {Object} errorRecord - 更新的錯誤記錄
   */
  async updateErrorRecord(errorRecord) {
    try {
      // 對於更新操作，直接寫入而不使用緩衝區
      await this.writeErrorToSheet(errorRecord, true);
    } catch (error) {
      Logger.log(`[Phase4ErrorLogger] 更新錯誤記錄失敗: ${error.toString()}`);
    }
  }

  /**
   * 刷新日誌緩衝區
   */
  async flushLogs() {
    if (this.logBuffer.length === 0) {
      return;
    }
    
    try {
      const logsToFlush = [...this.logBuffer];
      this.logBuffer = [];
      
      // 批次寫入
      await this.batchWriteErrors(logsToFlush);
      
    } catch (error) {
      Logger.log(`[Phase4ErrorLogger] 刷新日誌失敗: ${error.toString()}`);
      
      // 如果寫入失敗，將日誌放回緩衝區
      this.logBuffer.unshift(...this.logBuffer);
    }
  }

  /**
   * 批次寫入錯誤記錄
   */
  async batchWriteErrors(errorRecords) {
    try {
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      let errorLogSheet = ss.getSheetByName('Phase4ErrorLog');
      
      // 如果工作表不存在，建立它
      if (!errorLogSheet) {
        errorLogSheet = this.createErrorLogSheet(ss);
      }
      
      // 準備要寫入的資料
      const rows = errorRecords.map(record => this.formatErrorForSheet(record));
      
      if (rows.length > 0) {
        const lastRow = errorLogSheet.getLastRow();
        errorLogSheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
      }
      
    } catch (error) {
      Logger.log(`[Phase4ErrorLogger] 批次寫入錯誤: ${error.toString()}`);
      throw error;
    }
  }

  /**
   * 寫入單個錯誤記錄到工作表
   */
  async writeErrorToSheet(errorRecord, isUpdate = false) {
    try {
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      let errorLogSheet = ss.getSheetByName('Phase4ErrorLog');
      
      if (!errorLogSheet) {
        errorLogSheet = this.createErrorLogSheet(ss);
      }
      
      if (isUpdate) {
        // 尋找現有記錄並更新
        const data = errorLogSheet.getDataRange().getValues();
        const header = data[0];
        const errorIdIndex = header.indexOf('ErrorID');
        
        for (let i = 1; i < data.length; i++) {
          if (data[i][errorIdIndex] === errorRecord.errorId) {
            const updatedRow = this.formatErrorForSheet(errorRecord);
            errorLogSheet.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
            return;
          }
        }
      }
      
      // 新增記錄
      const row = this.formatErrorForSheet(errorRecord);
      errorLogSheet.appendRow(row);
      
    } catch (error) {
      Logger.log(`[Phase4ErrorLogger] 寫入錯誤記錄失敗: ${error.toString()}`);
      throw error;
    }
  }

  /**
   * 建立錯誤日誌工作表
   */
  createErrorLogSheet(spreadsheet) {
    const sheet = spreadsheet.insertSheet('Phase4ErrorLog');
    
    // 設定標題列
    const headers = [
      'ErrorID', 'Timestamp', 'ErrorType', 'Severity', 'Source', 
      'Status', 'HandlingStrategy', 'Message', 'AffectedRecords', 
      'Resolution', 'LoggedAt', 'UpdatedAt'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // 格式化標題列
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#d32f2f');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    
    // 設定欄寬
    sheet.autoResizeColumns(1, headers.length);
    
    return sheet;
  }

  /**
   * 格式化錯誤記錄為工作表行
   */
  formatErrorForSheet(errorRecord) {
    return [
      errorRecord.errorId || '',
      errorRecord.timestamp || new Date(),
      errorRecord.errorType || '',
      errorRecord.severity || '',
      errorRecord.source || '',
      errorRecord.status || '',
      errorRecord.handlingStrategy || '',
      errorRecord.originalError ? errorRecord.originalError.toString() : '',
      errorRecord.affectedRecords ? JSON.stringify(errorRecord.affectedRecords) : '',
      errorRecord.resolution ? JSON.stringify(errorRecord.resolution) : '',
      errorRecord.loggedAt || new Date(),
      new Date() // UpdatedAt
    ];
  }

  /**
   * 設定自動刷新
   */
  setupAutoFlush() {
    // 注意：在 Google Apps Script 中，setTimeout 可能不可用
    // 這裡提供一個概念性的實作
    try {
      if (typeof setTimeout !== 'undefined') {
        setTimeout(() => {
          this.flushLogs().catch(error => {
            Logger.log(`[Phase4ErrorLogger] 自動刷新失敗: ${error.toString()}`);
          });
          this.setupAutoFlush(); // 重新設定
        }, this.flushInterval);
      }
    } catch (error) {
      // 如果 setTimeout 不可用，依賴手動刷新
      Logger.log(`[Phase4ErrorLogger] 無法設定自動刷新: ${error.toString()}`);
    }
  }

  /**
   * 手動觸發日誌刷新
   */
  async manualFlush() {
    await this.flushLogs();
  }

  /**
   * 獲取錯誤統計
   */
  getErrorStats(timeRange = 24 * 60 * 60 * 1000) { // 24小時
    // 這個方法需要從工作表讀取資料來計算統計
    // 為了效能考慮，這裡提供一個簡化的實作
    return {
      message: '錯誤統計需要從 Phase4ErrorLog 工作表中計算',
      suggestion: '請直接查看 Phase4ErrorLog 工作表獲取詳細統計'
    };
  }
}