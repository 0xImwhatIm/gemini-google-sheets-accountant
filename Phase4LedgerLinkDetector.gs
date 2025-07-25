/**
 * 智慧記帳 GEM - Phase 4 帳本關聯錯誤檢測器
 * 
 * 專門檢測 IOU 記錄與主帳本關聯過程中的各種錯誤
 */

class Phase4LedgerLinkDetector {
  constructor() {
    this.detectionRules = this.loadDetectionRules();
    this.detectionHistory = [];
  }

  /**
   * 檢測帳本關聯錯誤的主要入口點
   * @param {Object} iouData - IOU 資料
   * @param {Object} mainLedgerData - 主帳本資料
   * @param {Object} context - 檢測上下文
   * @returns {Object} 檢測結果
   */
  async detectLinkErrors(iouData, mainLedgerData, context = {}) {
    const detectionId = this.generateDetectionId();
    const startTime = new Date();
    
    const result = {
      detectionId: detectionId,
      startTime: startTime,
      context: context,
      errors: [],
      warnings: [],
      summary: {
        totalChecks: 0,
        errorsFound: 0,
        warningsFound: 0
      }
    };
    
    try {
      Logger.log(`[Phase4LedgerLinkDetector] 開始帳本關聯錯誤檢測: ${detectionId}`);
      
      // 1. 檢測 IOU 記錄與主帳本關聯失敗
      const linkFailureResult = await this.detectLinkFailures(iouData, mainLedgerData);
      this.mergeDetectionResult(result, linkFailureResult);
      
      // 2. 檢測重複關聯問題
      const duplicateResult = await this.detectDuplicateLinks(iouData, mainLedgerData);
      this.mergeDetectionResult(result, duplicateResult);
      
      // 3. 檢測關聯資料格式錯誤
      const formatResult = await this.detectFormatErrors(iouData, mainLedgerData);
      this.mergeDetectionResult(result, formatResult);
      
      // 4. 檢測金額不匹配問題
      const amountResult = await this.detectAmountMismatches(iouData, mainLedgerData);
      this.mergeDetectionResult(result, amountResult);
      
      // 5. 檢測時間戳不一致問題
      const timestampResult = await this.detectTimestampInconsistencies(iouData, mainLedgerData);
      this.mergeDetectionResult(result, timestampResult);
      
      // 6. 檢測狀態不一致問題
      const statusResult = await this.detectStatusInconsistencies(iouData, mainLedgerData);
      this.mergeDetectionResult(result, statusResult);
      
      // 統計結果
      result.summary.errorsFound = result.errors.length;
      result.summary.warningsFound = result.warnings.length;
      result.endTime = new Date();
      result.duration = result.endTime - startTime;
      
      // 記錄檢測歷史
      this.recordDetection(result);
      
      Logger.log(`[Phase4LedgerLinkDetector] 檢測完成: 發現 ${result.summary.errorsFound} 個錯誤, ${result.summary.warningsFound} 個警告`);
      
      return result;
      
    } catch (error) {
      Logger.log(`[Phase4LedgerLinkDetector] 檢測過程發生錯誤: ${error.toString()}`);
      
      result.error = error.toString();
      result.endTime = new Date();
      
      return result;
    }
  }

  /**
   * 檢測 IOU 記錄與主帳本關聯失敗
   */
  async detectLinkFailures(iouData, mainLedgerData) {
    const result = {
      checkName: 'IOU 與主帳本關聯失敗檢測',
      errors: [],
      warnings: []
    };
    
    try {
      // 檢查 IOU 事件是否有對應的主帳本記錄
      if (iouData.events && Array.isArray(iouData.events)) {
        for (const event of iouData.events) {
          const eventId = event.EventID;
          
          // 檢查是否有對應的主帳本記錄
          const linkedRecord = this.findLinkedMainLedgerRecord(eventId, mainLedgerData);
          
          if (!linkedRecord && event.Status === 'Settled') {
            result.errors.push({
              type: 'MISSING_MAIN_LEDGER_LINK',
              severity: 'HIGH',
              eventId: eventId,
              message: '已結算的 IOU 事件缺少對應的主帳本記錄',
              details: {
                eventData: event,
                expectedLinkField: 'IOUEventID'
              }
            });
          }
          
          // 檢查關聯記錄的完整性
          if (linkedRecord) {
            const linkValidation = this.validateLinkIntegrity(event, linkedRecord);
            if (!linkValidation.valid) {
              result.errors.push({
                type: 'INVALID_LINK_INTEGRITY',
                severity: 'MEDIUM',
                eventId: eventId,
                message: '關聯記錄完整性驗證失敗',
                details: linkValidation
              });
            }
          }
        }
      }
      
      // 檢查主帳本記錄是否有對應的 IOU 事件
      if (mainLedgerData.records && Array.isArray(mainLedgerData.records)) {
        for (const record of mainLedgerData.records) {
          const iouEventId = record.IOUEventID;
          
          if (iouEventId) {
            const linkedEvent = this.findLinkedIOUEvent(iouEventId, iouData);
            
            if (!linkedEvent) {
              result.errors.push({
                type: 'ORPHANED_MAIN_LEDGER_RECORD',
                severity: 'HIGH',
                recordId: record.ID,
                message: '主帳本記錄引用了不存在的 IOU 事件',
                details: {
                  recordData: record,
                  missingEventId: iouEventId
                }
              });
            }
          }
        }
      }
      
    } catch (error) {
      result.errors.push({
        type: 'DETECTION_ERROR',
        severity: 'CRITICAL',
        message: '關聯失敗檢測過程發生錯誤',
        error: error.toString()
      });
    }
    
    return result;
  }

  /**
   * 檢測重複關聯問題
   */
  async detectDuplicateLinks(iouData, mainLedgerData) {
    const result = {
      checkName: '重複關聯檢測',
      errors: [],
      warnings: []
    };
    
    try {
      // 檢查是否有多個主帳本記錄關聯到同一個 IOU 事件
      const linkMap = new Map();
      
      if (mainLedgerData.records && Array.isArray(mainLedgerData.records)) {
        for (const record of mainLedgerData.records) {
          const iouEventId = record.IOUEventID;
          
          if (iouEventId) {
            if (linkMap.has(iouEventId)) {
              const existingRecords = linkMap.get(iouEventId);
              existingRecords.push(record);
              
              result.errors.push({
                type: 'DUPLICATE_MAIN_LEDGER_LINK',
                severity: 'HIGH',
                iouEventId: iouEventId,
                message: '多個主帳本記錄關聯到同一個 IOU 事件',
                details: {
                  duplicateRecords: existingRecords,
                  totalDuplicates: existingRecords.length
                }
              });
            } else {
              linkMap.set(iouEventId, [record]);
            }
          }
        }
      }
      
      // 檢查是否有 IOU 事件被多次結算
      if (iouData.events && Array.isArray(iouData.events)) {
        const settledEvents = iouData.events.filter(event => event.Status === 'Settled');
        const eventSettlementMap = new Map();
        
        for (const event of settledEvents) {
          const eventId = event.EventID;
          const settlementDate = event.SettlementDate;
          
          if (eventSettlementMap.has(eventId)) {
            result.warnings.push({
              type: 'MULTIPLE_SETTLEMENT_RECORDS',
              severity: 'MEDIUM',
              eventId: eventId,
              message: 'IOU 事件可能被多次標記為已結算',
              details: {
                previousSettlement: eventSettlementMap.get(eventId),
                currentSettlement: settlementDate
              }
            });
          } else {
            eventSettlementMap.set(eventId, settlementDate);
          }
        }
      }
      
    } catch (error) {
      result.errors.push({
        type: 'DETECTION_ERROR',
        severity: 'CRITICAL',
        message: '重複關聯檢測過程發生錯誤',
        error: error.toString()
      });
    }
    
    return result;
  }

  /**
   * 檢測關聯資料格式錯誤
   */
  async detectFormatErrors(iouData, mainLedgerData) {
    const result = {
      checkName: '關聯資料格式檢測',
      errors: [],
      warnings: []
    };
    
    try {
      // 檢查 IOU 事件 ID 格式
      if (iouData.events && Array.isArray(iouData.events)) {
        for (const event of iouData.events) {
          const eventId = event.EventID;
          
          if (!this.isValidEventIdFormat(eventId)) {
            result.errors.push({
              type: 'INVALID_EVENT_ID_FORMAT',
              severity: 'MEDIUM',
              eventId: eventId,
              message: 'IOU 事件 ID 格式無效',
              details: {
                currentFormat: eventId,
                expectedFormat: 'IOU-YYYYMMDD-XXXXXX'
              }
            });
          }
        }
      }
      
      // 檢查主帳本記錄中的 IOU 事件 ID 引用格式
      if (mainLedgerData.records && Array.isArray(mainLedgerData.records)) {
        for (const record of mainLedgerData.records) {
          const iouEventId = record.IOUEventID;
          
          if (iouEventId && !this.isValidEventIdFormat(iouEventId)) {
            result.errors.push({
              type: 'INVALID_REFERENCE_FORMAT',
              severity: 'MEDIUM',
              recordId: record.ID,
              message: '主帳本記錄中的 IOU 事件 ID 引用格式無效',
              details: {
                currentFormat: iouEventId,
                expectedFormat: 'IOU-YYYYMMDD-XXXXXX'
              }
            });
          }
        }
      }
      
      // 檢查金額格式
      if (iouData.events && Array.isArray(iouData.events)) {
        for (const event of iouData.events) {
          const totalAmount = event.TotalAmount;
          
          if (totalAmount !== undefined && !this.isValidAmountFormat(totalAmount)) {
            result.errors.push({
              type: 'INVALID_AMOUNT_FORMAT',
              severity: 'MEDIUM',
              eventId: event.EventID,
              message: 'IOU 事件總金額格式無效',
              details: {
                currentValue: totalAmount,
                expectedType: 'number'
              }
            });
          }
        }
      }
      
    } catch (error) {
      result.errors.push({
        type: 'DETECTION_ERROR',
        severity: 'CRITICAL',
        message: '格式錯誤檢測過程發生錯誤',
        error: error.toString()
      });
    }
    
    return result;
  }

  /**
   * 檢測金額不匹配問題
   */
  async detectAmountMismatches(iouData, mainLedgerData) {
    const result = {
      checkName: '金額不匹配檢測',
      errors: [],
      warnings: []
    };
    
    try {
      if (iouData.events && mainLedgerData.records) {
        for (const event of iouData.events) {
          const eventId = event.EventID;
          const iouTotalAmount = parseFloat(event.TotalAmount) || 0;
          
          // 找到對應的主帳本記錄
          const linkedRecord = this.findLinkedMainLedgerRecord(eventId, mainLedgerData);
          
          if (linkedRecord) {
            const mainLedgerAmount = parseFloat(linkedRecord.Amount) || 0;
            
            // 檢查金額是否匹配（允許小數點誤差）
            if (Math.abs(iouTotalAmount - mainLedgerAmount) > 0.01) {
              result.errors.push({
                type: 'AMOUNT_MISMATCH',
                severity: 'HIGH',
                eventId: eventId,
                message: 'IOU 事件總金額與主帳本記錄金額不匹配',
                details: {
                  iouAmount: iouTotalAmount,
                  mainLedgerAmount: mainLedgerAmount,
                  difference: iouTotalAmount - mainLedgerAmount,
                  tolerance: 0.01
                }
              });
            }
          }
          
          // 檢查 IOU 事件總金額與相關債務總金額是否匹配
          if (iouData.debts && Array.isArray(iouData.debts)) {
            const relatedDebts = iouData.debts.filter(debt => debt.EventID === eventId);
            const debtsTotal = relatedDebts.reduce((sum, debt) => {
              return sum + (parseFloat(debt.Amount) || 0);
            }, 0);
            
            if (Math.abs(iouTotalAmount - debtsTotal) > 0.01) {
              result.errors.push({
                type: 'IOU_INTERNAL_AMOUNT_MISMATCH',
                severity: 'HIGH',
                eventId: eventId,
                message: 'IOU 事件總金額與相關債務總金額不匹配',
                details: {
                  eventAmount: iouTotalAmount,
                  debtsAmount: debtsTotal,
                  difference: iouTotalAmount - debtsTotal,
                  relatedDebtsCount: relatedDebts.length
                }
              });
            }
          }
        }
      }
      
    } catch (error) {
      result.errors.push({
        type: 'DETECTION_ERROR',
        severity: 'CRITICAL',
        message: '金額不匹配檢測過程發生錯誤',
        error: error.toString()
      });
    }
    
    return result;
  }

  /**
   * 檢測時間戳不一致問題
   */
  async detectTimestampInconsistencies(iouData, mainLedgerData) {
    const result = {
      checkName: '時間戳不一致檢測',
      errors: [],
      warnings: []
    };
    
    try {
      if (iouData.events && mainLedgerData.records) {
        for (const event of iouData.events) {
          const eventId = event.EventID;
          const eventDate = new Date(event.EventDate);
          const settlementDate = event.SettlementDate ? new Date(event.SettlementDate) : null;
          
          // 檢查結算日期是否在事件日期之後
          if (settlementDate && settlementDate < eventDate) {
            result.errors.push({
              type: 'INVALID_SETTLEMENT_TIME',
              severity: 'MEDIUM',
              eventId: eventId,
              message: '結算日期不能早於事件日期',
              details: {
                eventDate: eventDate,
                settlementDate: settlementDate,
                timeDifference: eventDate - settlementDate
              }
            });
          }
          
          // 找到對應的主帳本記錄並檢查時間一致性
          const linkedRecord = this.findLinkedMainLedgerRecord(eventId, mainLedgerData);
          
          if (linkedRecord) {
            const recordDate = new Date(linkedRecord.Date);
            
            // 主帳本記錄日期應該接近結算日期
            if (settlementDate) {
              const timeDiff = Math.abs(recordDate - settlementDate);
              const maxAllowedDiff = 24 * 60 * 60 * 1000; // 1天
              
              if (timeDiff > maxAllowedDiff) {
                result.warnings.push({
                  type: 'TIMESTAMP_INCONSISTENCY',
                  severity: 'LOW',
                  eventId: eventId,
                  message: '主帳本記錄日期與 IOU 結算日期相差較大',
                  details: {
                    recordDate: recordDate,
                    settlementDate: settlementDate,
                    timeDifference: timeDiff,
                    maxAllowed: maxAllowedDiff
                  }
                });
              }
            }
          }
        }
      }
      
    } catch (error) {
      result.errors.push({
        type: 'DETECTION_ERROR',
        severity: 'CRITICAL',
        message: '時間戳不一致檢測過程發生錯誤',
        error: error.toString()
      });
    }
    
    return result;
  }

  /**
   * 檢測狀態不一致問題
   */
  async detectStatusInconsistencies(iouData, mainLedgerData) {
    const result = {
      checkName: '狀態不一致檢測',
      errors: [],
      warnings: []
    };
    
    try {
      if (iouData.events && mainLedgerData.records) {
        for (const event of iouData.events) {
          const eventId = event.EventID;
          const eventStatus = event.Status;
          
          // 檢查已結算事件是否有對應的主帳本記錄
          if (eventStatus === 'Settled') {
            const linkedRecord = this.findLinkedMainLedgerRecord(eventId, mainLedgerData);
            
            if (!linkedRecord) {
              result.errors.push({
                type: 'SETTLED_WITHOUT_MAIN_RECORD',
                severity: 'HIGH',
                eventId: eventId,
                message: '已結算的 IOU 事件缺少對應的主帳本記錄',
                details: {
                  eventStatus: eventStatus,
                  expectedMainRecord: true
                }
              });
            }
          }
          
          // 檢查未結算事件是否錯誤地有主帳本記錄
          if (eventStatus === 'Active') {
            const linkedRecord = this.findLinkedMainLedgerRecord(eventId, mainLedgerData);
            
            if (linkedRecord) {
              result.warnings.push({
                type: 'ACTIVE_WITH_MAIN_RECORD',
                severity: 'MEDIUM',
                eventId: eventId,
                message: '活動中的 IOU 事件已有主帳本記錄',
                details: {
                  eventStatus: eventStatus,
                  unexpectedMainRecord: linkedRecord.ID
                }
              });
            }
          }
          
          // 檢查相關債務的狀態一致性
          if (iouData.debts && Array.isArray(iouData.debts)) {
            const relatedDebts = iouData.debts.filter(debt => debt.EventID === eventId);
            
            for (const debt of relatedDebts) {
              const debtStatus = debt.Status;
              
              // 如果事件已結算，所有相關債務也應該已結算
              if (eventStatus === 'Settled' && debtStatus !== 'Settled') {
                result.errors.push({
                  type: 'DEBT_STATUS_INCONSISTENCY',
                  severity: 'MEDIUM',
                  eventId: eventId,
                  debtId: debt.DebtID,
                  message: '已結算事件的相關債務狀態不一致',
                  details: {
                    eventStatus: eventStatus,
                    debtStatus: debtStatus,
                    expectedDebtStatus: 'Settled'
                  }
                });
              }
            }
          }
        }
      }
      
    } catch (error) {
      result.errors.push({
        type: 'DETECTION_ERROR',
        severity: 'CRITICAL',
        message: '狀態不一致檢測過程發生錯誤',
        error: error.toString()
      });
    }
    
    return result;
  }

  /**
   * 輔助方法：找到關聯的主帳本記錄
   */
  findLinkedMainLedgerRecord(eventId, mainLedgerData) {
    if (!mainLedgerData.records || !Array.isArray(mainLedgerData.records)) {
      return null;
    }
    
    return mainLedgerData.records.find(record => record.IOUEventID === eventId);
  }

  /**
   * 輔助方法：找到關聯的 IOU 事件
   */
  findLinkedIOUEvent(eventId, iouData) {
    if (!iouData.events || !Array.isArray(iouData.events)) {
      return null;
    }
    
    return iouData.events.find(event => event.EventID === eventId);
  }

  /**
   * 輔助方法：驗證關聯完整性
   */
  validateLinkIntegrity(iouEvent, mainRecord) {
    const validation = {
      valid: true,
      issues: []
    };
    
    // 檢查 ID 匹配
    if (iouEvent.EventID !== mainRecord.IOUEventID) {
      validation.valid = false;
      validation.issues.push('事件 ID 不匹配');
    }
    
    // 檢查金額匹配
    const iouAmount = parseFloat(iouEvent.TotalAmount) || 0;
    const mainAmount = parseFloat(mainRecord.Amount) || 0;
    
    if (Math.abs(iouAmount - mainAmount) > 0.01) {
      validation.valid = false;
      validation.issues.push('金額不匹配');
    }
    
    return validation;
  }

  /**
   * 輔助方法：檢查事件 ID 格式
   */
  isValidEventIdFormat(eventId) {
    if (!eventId || typeof eventId !== 'string') {
      return false;
    }
    
    // 檢查是否符合 IOU-YYYYMMDD-XXXXXX 格式
    const pattern = /^IOU-\d{8}-[A-Z0-9]{6}$/;
    return pattern.test(eventId);
  }

  /**
   * 輔助方法：檢查金額格式
   */
  isValidAmountFormat(amount) {
    if (amount === null || amount === undefined || amount === '') {
      return true; // 空值是允許的
    }
    
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && isFinite(numAmount) && numAmount >= 0;
  }

  /**
   * 輔助方法：合併檢測結果
   */
  mergeDetectionResult(mainResult, subResult) {
    if (subResult.errors) {
      mainResult.errors.push(...subResult.errors);
    }
    
    if (subResult.warnings) {
      mainResult.warnings.push(...subResult.warnings);
    }
    
    mainResult.summary.totalChecks++;
  }

  /**
   * 輔助方法：記錄檢測歷史
   */
  recordDetection(result) {
    this.detectionHistory.push({
      detectionId: result.detectionId,
      timestamp: result.startTime,
      errorsFound: result.summary.errorsFound,
      warningsFound: result.summary.warningsFound,
      duration: result.duration
    });
    
    // 限制歷史記錄數量
    if (this.detectionHistory.length > 100) {
      this.detectionHistory = this.detectionHistory.slice(-50);
    }
  }

  /**
   * 輔助方法：生成檢測 ID
   */
  generateDetectionId() {
    return `P4LD-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * 輔助方法：載入檢測規則
   */
  loadDetectionRules() {
    return {
      enableAmountValidation: true,
      enableTimestampValidation: true,
      enableFormatValidation: true,
      enableStatusValidation: true,
      amountTolerance: 0.01,
      timestampTolerance: 24 * 60 * 60 * 1000 // 1天
    };
  }

  /**
   * 獲取檢測統計
   */
  getDetectionStats(timeRange = 24 * 60 * 60 * 1000) { // 24小時
    const cutoffTime = new Date(Date.now() - timeRange);
    const recentDetections = this.detectionHistory.filter(d => 
      d.timestamp > cutoffTime
    );
    
    return {
      totalDetections: recentDetections.length,
      totalErrors: recentDetections.reduce((sum, d) => sum + d.errorsFound, 0),
      totalWarnings: recentDetections.reduce((sum, d) => sum + d.warningsFound, 0),
      averageDuration: recentDetections.length > 0 
        ? recentDetections.reduce((sum, d) => sum + d.duration, 0) / recentDetections.length 
        : 0
    };
  }
}

// 全域實例
const phase4LedgerLinkDetector = new Phase4LedgerLinkDetector();