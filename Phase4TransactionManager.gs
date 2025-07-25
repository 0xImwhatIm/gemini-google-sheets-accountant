/**
 * 智慧記帳 GEM - Phase 4 事務管理器
 * 
 * 負責管理 Phase 4 操作的事務性，確保資料一致性
 */

class Phase4TransactionManager {
  constructor() {
    this.activeTransactions = new Map();
    this.transactionLog = [];
    this.maxTransactionTimeout = 300000; // 5分鐘超時
  }

  /**
   * 開始新事務
   * @param {string} operationType - 操作類型
   * @param {Object} context - 事務上下文
   * @returns {string} 事務 ID
   */
  beginTransaction(operationType, context = {}) {
    const transactionId = this.generateTransactionId();
    const startTime = new Date();
    
    const transaction = {
      transactionId: transactionId,
      operationType: operationType,
      startTime: startTime,
      status: 'ACTIVE',
      context: context,
      operations: [],
      snapshots: new Map(),
      rollbackData: []
    };
    
    this.activeTransactions.set(transactionId, transaction);
    
    Logger.log(`[Phase4TransactionManager] 開始事務: ${transactionId} (${operationType})`);
    
    // 設定超時處理
    this.setTransactionTimeout(transactionId);
    
    return transactionId;
  }

  /**
   * 記錄操作到事務中
   * @param {string} transactionId - 事務 ID
   * @param {string} operation - 操作描述
   * @param {Object} data - 操作資料
   * @param {Object} snapshot - 操作前快照
   */
  recordOperation(transactionId, operation, data, snapshot = null) {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`事務不存在: ${transactionId}`);
    }
    
    const operationRecord = {
      timestamp: new Date(),
      operation: operation,
      data: data,
      snapshot: snapshot
    };
    
    transaction.operations.push(operationRecord);
    
    // 如果有快照，儲存以供回滾使用
    if (snapshot) {
      transaction.rollbackData.push({
        operation: operation,
        rollbackData: snapshot
      });
    }
    
    Logger.log(`[Phase4TransactionManager] 記錄操作: ${transactionId} - ${operation}`);
  }

  /**
   * 建立資料快照
   * @param {string} sheetName - 工作表名稱
   * @param {Array} recordIds - 記錄 ID 列表
   * @returns {Object} 快照資料
   */
  createSnapshot(sheetName, recordIds = []) {
    try {
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        throw new Error(`工作表不存在: ${sheetName}`);
      }
      
      const snapshot = {
        sheetName: sheetName,
        timestamp: new Date(),
        data: []
      };
      
      if (recordIds.length === 0) {
        // 如果沒有指定記錄 ID，快照整個工作表
        const dataRange = sheet.getDataRange();
        snapshot.data = dataRange.getValues();
        snapshot.range = dataRange.getA1Notation();
      } else {
        // 快照指定的記錄
        const allData = sheet.getDataRange().getValues();
        const header = allData[0];
        
        // 假設第一欄是 ID 欄
        recordIds.forEach(id => {
          const rowIndex = allData.findIndex((row, index) => 
            index > 0 && row[0] === id
          );
          
          if (rowIndex > 0) {
            snapshot.data.push({
              rowIndex: rowIndex + 1, // 1-based
              data: allData[rowIndex]
            });
          }
        });
      }
      
      return snapshot;
    } catch (error) {
      Logger.log(`[Phase4TransactionManager] 建立快照失敗: ${error.toString()}`);
      throw error;
    }
  }

  /**
   * 提交事務
   * @param {string} transactionId - 事務 ID
   * @returns {Object} 提交結果
   */
  async commitTransaction(transactionId) {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`事務不存在: ${transactionId}`);
    }
    
    try {
      // 檢查事務狀態
      if (transaction.status !== 'ACTIVE') {
        throw new Error(`事務狀態無效: ${transaction.status}`);
      }
      
      // 執行提交前驗證
      const validationResult = await this.validateTransactionForCommit(transaction);
      if (!validationResult.valid) {
        throw new Error(`事務驗證失敗: ${validationResult.reason}`);
      }
      
      // 更新事務狀態
      transaction.status = 'COMMITTING';
      transaction.endTime = new Date();
      
      // 執行提交後清理
      await this.performCommitCleanup(transaction);
      
      // 標記為已提交
      transaction.status = 'COMMITTED';
      
      // 從活動事務中移除
      this.activeTransactions.delete(transactionId);
      
      // 記錄到事務日誌
      this.transactionLog.push({
        ...transaction,
        result: 'COMMITTED'
      });
      
      Logger.log(`[Phase4TransactionManager] 事務提交成功: ${transactionId}`);
      
      return {
        success: true,
        transactionId: transactionId,
        operationCount: transaction.operations.length,
        duration: transaction.endTime - transaction.startTime
      };
      
    } catch (error) {
      Logger.log(`[Phase4TransactionManager] 事務提交失敗: ${transactionId} - ${error.toString()}`);
      
      // 提交失敗時自動回滾
      const rollbackResult = await this.rollbackTransaction(transactionId);
      
      return {
        success: false,
        error: error.toString(),
        rollbackResult: rollbackResult
      };
    }
  }

  /**
   * 回滾事務
   * @param {string} transactionId - 事務 ID
   * @returns {Object} 回滾結果
   */
  async rollbackTransaction(transactionId) {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      // 檢查是否在日誌中
      const loggedTransaction = this.transactionLog.find(t => t.transactionId === transactionId);
      if (!loggedTransaction) {
        throw new Error(`事務不存在: ${transactionId}`);
      }
      return {
        success: false,
        reason: '事務已完成，無法回滾'
      };
    }
    
    try {
      Logger.log(`[Phase4TransactionManager] 開始回滾事務: ${transactionId}`);
      
      // 更新事務狀態
      transaction.status = 'ROLLING_BACK';
      
      const rollbackResults = [];
      
      // 按相反順序回滾操作
      for (let i = transaction.rollbackData.length - 1; i >= 0; i--) {
        const rollbackItem = transaction.rollbackData[i];
        
        try {
          const result = await this.performRollbackOperation(rollbackItem);
          rollbackResults.push({
            operation: rollbackItem.operation,
            success: true,
            result: result
          });
        } catch (rollbackError) {
          Logger.log(`[Phase4TransactionManager] 回滾操作失敗: ${rollbackItem.operation} - ${rollbackError.toString()}`);
          rollbackResults.push({
            operation: rollbackItem.operation,
            success: false,
            error: rollbackError.toString()
          });
        }
      }
      
      // 檢查回滾結果
      const failedRollbacks = rollbackResults.filter(r => !r.success);
      const success = failedRollbacks.length === 0;
      
      // 更新事務狀態
      transaction.status = success ? 'ROLLED_BACK' : 'ROLLBACK_FAILED';
      transaction.endTime = new Date();
      
      // 從活動事務中移除
      this.activeTransactions.delete(transactionId);
      
      // 記錄到事務日誌
      this.transactionLog.push({
        ...transaction,
        result: transaction.status,
        rollbackResults: rollbackResults
      });
      
      Logger.log(`[Phase4TransactionManager] 事務回滾${success ? '成功' : '部分失敗'}: ${transactionId}`);
      
      return {
        success: success,
        transactionId: transactionId,
        rollbackResults: rollbackResults,
        failedOperations: failedRollbacks.length,
        details: rollbackResults
      };
      
    } catch (error) {
      Logger.log(`[Phase4TransactionManager] 回滾過程發生錯誤: ${transactionId} - ${error.toString()}`);
      
      transaction.status = 'ROLLBACK_ERROR';
      
      return {
        success: false,
        error: error.toString(),
        transactionId: transactionId
      };
    }
  }

  /**
   * 執行回滾操作
   * @param {Object} rollbackItem - 回滾項目
   * @returns {Object} 回滾結果
   */
  async performRollbackOperation(rollbackItem) {
    const { operation, rollbackData } = rollbackItem;
    
    switch (operation) {
      case 'WRITE_TO_SHEET':
        return await this.rollbackSheetWrite(rollbackData);
        
      case 'UPDATE_SHEET_ROW':
        return await this.rollbackSheetUpdate(rollbackData);
        
      case 'DELETE_SHEET_ROW':
        return await this.rollbackSheetDelete(rollbackData);
        
      default:
        Logger.log(`[Phase4TransactionManager] 未知的回滾操作: ${operation}`);
        return { success: false, reason: '未知操作類型' };
    }
  }

  /**
   * 回滾工作表寫入操作
   */
  async rollbackSheetWrite(rollbackData) {
    try {
      const { sheetName, rowsAdded } = rollbackData;
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        throw new Error(`工作表不存在: ${sheetName}`);
      }
      
      // 刪除新增的行
      if (rowsAdded && rowsAdded > 0) {
        const lastRow = sheet.getLastRow();
        if (lastRow >= rowsAdded) {
          sheet.deleteRows(lastRow - rowsAdded + 1, rowsAdded);
        }
      }
      
      return { success: true, message: `已刪除 ${rowsAdded} 行` };
    } catch (error) {
      throw new Error(`回滾工作表寫入失敗: ${error.toString()}`);
    }
  }

  /**
   * 回滾工作表更新操作
   */
  async rollbackSheetUpdate(rollbackData) {
    try {
      const { sheetName, rowIndex, originalData } = rollbackData;
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        throw new Error(`工作表不存在: ${sheetName}`);
      }
      
      // 恢復原始資料
      if (originalData && rowIndex) {
        sheet.getRange(rowIndex, 1, 1, originalData.length).setValues([originalData]);
      }
      
      return { success: true, message: `已恢復第 ${rowIndex} 行資料` };
    } catch (error) {
      throw new Error(`回滾工作表更新失敗: ${error.toString()}`);
    }
  }

  /**
   * 回滾工作表刪除操作
   */
  async rollbackSheetDelete(rollbackData) {
    try {
      const { sheetName, rowIndex, deletedData } = rollbackData;
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        throw new Error(`工作表不存在: ${sheetName}`);
      }
      
      // 插入新行並恢復資料
      if (deletedData && rowIndex) {
        sheet.insertRowAfter(rowIndex - 1);
        sheet.getRange(rowIndex, 1, 1, deletedData.length).setValues([deletedData]);
      }
      
      return { success: true, message: `已恢復第 ${rowIndex} 行資料` };
    } catch (error) {
      throw new Error(`回滾工作表刪除失敗: ${error.toString()}`);
    }
  }

  /**
   * 驗證事務是否可以提交
   */
  async validateTransactionForCommit(transaction) {
    try {
      // 檢查事務是否超時
      const now = new Date();
      const duration = now - transaction.startTime;
      
      if (duration > this.maxTransactionTimeout) {
        return {
          valid: false,
          reason: `事務超時 (${duration}ms > ${this.maxTransactionTimeout}ms)`
        };
      }
      
      // 檢查是否有操作
      if (transaction.operations.length === 0) {
        return {
          valid: false,
          reason: '事務中沒有任何操作'
        };
      }
      
      // 可以添加更多驗證邏輯
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: `驗證過程發生錯誤: ${error.toString()}`
      };
    }
  }

  /**
   * 執行提交後清理
   */
  async performCommitCleanup(transaction) {
    // 清理臨時資料、快照等
    transaction.snapshots.clear();
    
    // 可以添加其他清理邏輯
  }

  /**
   * 設定事務超時
   */
  setTransactionTimeout(transactionId) {
    setTimeout(() => {
      const transaction = this.activeTransactions.get(transactionId);
      if (transaction && transaction.status === 'ACTIVE') {
        Logger.log(`[Phase4TransactionManager] 事務超時，自動回滾: ${transactionId}`);
        this.rollbackTransaction(transactionId).catch(error => {
          Logger.log(`[Phase4TransactionManager] 超時回滾失敗: ${error.toString()}`);
        });
      }
    }, this.maxTransactionTimeout);
  }

  /**
   * 生成事務 ID
   */
  generateTransactionId() {
    return `P4T-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * 獲取活動事務列表
   */
  getActiveTransactions() {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * 獲取事務日誌
   */
  getTransactionLog(limit = 100) {
    return this.transactionLog.slice(-limit);
  }

  /**
   * 清理過期的事務日誌
   */
  cleanupTransactionLog(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7天
    const cutoffTime = new Date(Date.now() - maxAge);
    
    this.transactionLog = this.transactionLog.filter(transaction => 
      transaction.startTime > cutoffTime
    );
  }
}