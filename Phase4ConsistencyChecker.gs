/**
 * 智慧記帳 GEM - Phase 4 一致性檢查器
 * 
 * 負責檢查 IOU 帳本與主帳本之間的資料一致性
 */

class Phase4ConsistencyChecker {
  constructor() {
    this.inconsistencyLog = [];
    this.lastCheckTime = null;
    this.checkResults = new Map();
  }

  /**
   * 執行完整的一致性檢查
   * @returns {Object} 檢查結果
   */
  async performFullConsistencyCheck() {
    Logger.log('[Phase4ConsistencyChecker] 開始完整一致性檢查');
    
    const checkId = this.generateCheckId();
    const startTime = new Date();
    
    const results = {
      checkId: checkId,
      startTime: startTime,
      checks: {},
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        inconsistencies: []
      }
    };
    
    try {
      // 1. 檢查 IOU 與主帳本的金額一致性
      results.checks.amountConsistency = await this.checkAmountConsistency();
      
      // 2. 檢查關聯記錄的完整性
      results.checks.linkIntegrity = await this.checkLinkIntegrity();
      
      // 3. 檢查資料格式一致性
      results.checks.formatConsistency = await this.checkFormatConsistency();
      
      // 4. 檢查時間戳一致性
      results.checks.timestampConsistency = await this.checkTimestampConsistency();
      
      // 5. 檢查狀態一致性
      results.checks.statusConsistency = await this.checkStatusConsistency();
      
      // 統計結果
      this.summarizeResults(results);
      
      // 記錄檢查時間
      this.lastCheckTime = new Date();
      results.endTime = this.lastCheckTime;
      results.duration = this.lastCheckTime - startTime;
      
      // 儲存結果
      this.checkResults.set(checkId, results);
      
      Logger.log(`[Phase4ConsistencyChecker] 一致性檢查完成: ${results.summary.passedChecks}/${results.summary.totalChecks} 通過`);
      
      return results;
      
    } catch (error) {
      Logger.log(`[Phase4ConsistencyChecker] 一致性檢查失敗: ${error.toString()}`);
      
      results.error = error.toString();
      results.endTime = new Date();
      
      return results;
    }
  }

  /**
   * 檢查金額一致性
   */
  async checkAmountConsistency() {
    const result = {
      name: '金額一致性檢查',
      passed: true,
      issues: [],
      details: {}
    };
    
    try {
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      const eventsSheet = ss.getSheetByName(IOU_EVENTS_SHEET_NAME);
      const debtsSheet = ss.getSheetByName(IOU_DEBTS_SHEET_NAME);
      const mainSheet = ss.getSheetByName(SHEET_NAME);
      
      if (!eventsSheet || !debtsSheet || !mainSheet) {
        throw new Error('必要的工作表不存在');
      }
      
      // 獲取所有 IOU 事件
      const eventsData = eventsSheet.getDataRange().getValues();
      const eventsHeader = eventsData[0];
      const events = eventsData.slice(1);
      
      // 獲取所有債務記錄
      const debtsData = debtsSheet.getDataRange().getValues();
      const debtsHeader = debtsData[0];
      const debts = debtsData.slice(1);
      
      // 檢查每個事件的金額一致性
      for (const event of events) {
        const eventId = event[eventsHeader.indexOf('EventID')];
        const totalAmount = parseFloat(event[eventsHeader.indexOf('TotalAmount')] || 0);
        
        // 計算相關債務的總金額
        const relatedDebts = debts.filter(debt => 
          debt[debtsHeader.indexOf('EventID')] === eventId
        );
        
        const debtsTotal = relatedDebts.reduce((sum, debt) => {
          return sum + parseFloat(debt[debtsHeader.indexOf('Amount')] || 0);
        }, 0);
        
        // 檢查金額是否一致
        if (Math.abs(totalAmount - debtsTotal) > 0.01) {
          result.passed = false;
          result.issues.push({
            type: 'AMOUNT_MISMATCH',
            eventId: eventId,
            eventAmount: totalAmount,
            debtsAmount: debtsTotal,
            difference: totalAmount - debtsTotal
          });
        }
      }
      
      result.details.eventsChecked = events.length;
      result.details.debtsChecked = debts.length;
      
    } catch (error) {
      result.passed = false;
      result.error = error.toString();
    }
    
    return result;
  }

  /**
   * 檢查關聯記錄完整性
   */
  async checkLinkIntegrity() {
    const result = {
      name: '關聯記錄完整性檢查',
      passed: true,
      issues: [],
      details: {}
    };
    
    try {
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      const eventsSheet = ss.getSheetByName(IOU_EVENTS_SHEET_NAME);
      const participantsSheet = ss.getSheetByName(IOU_PARTICIPANTS_SHEET_NAME);
      const debtsSheet = ss.getSheetByName(IOU_DEBTS_SHEET_NAME);
      
      if (!eventsSheet || !participantsSheet || !debtsSheet) {
        throw new Error('必要的工作表不存在');
      }
      
      // 獲取所有資料
      const eventsData = eventsSheet.getDataRange().getValues();
      const participantsData = participantsSheet.getDataRange().getValues();
      const debtsData = debtsSheet.getDataRange().getValues();
      
      const eventsHeader = eventsData[0];
      const participantsHeader = participantsData[0];
      const debtsHeader = debtsData[0];
      
      const events = eventsData.slice(1);
      const participants = participantsData.slice(1);
      const debts = debtsData.slice(1);
      
      // 檢查每個事件是否有對應的參與者和債務記錄
      for (const event of events) {
        const eventId = event[eventsHeader.indexOf('EventID')];
        
        // 檢查是否有對應的參與者記錄
        const relatedParticipants = participants.filter(p => 
          p[participantsHeader.indexOf('EventID')] === eventId
        );
        
        if (relatedParticipants.length === 0) {
          result.passed = false;
          result.issues.push({
            type: 'MISSING_PARTICIPANTS',
            eventId: eventId,
            message: '事件缺少參與者記錄'
          });
        }
        
        // 檢查是否有對應的債務記錄
        const relatedDebts = debts.filter(d => 
          d[debtsHeader.indexOf('EventID')] === eventId
        );
        
        if (relatedDebts.length === 0) {
          result.passed = false;
          result.issues.push({
            type: 'MISSING_DEBTS',
            eventId: eventId,
            message: '事件缺少債務記錄'
          });
        }
      }
      
      // 檢查孤立的參與者記錄
      for (const participant of participants) {
        const eventId = participant[participantsHeader.indexOf('EventID')];
        const relatedEvent = events.find(e => 
          e[eventsHeader.indexOf('EventID')] === eventId
        );
        
        if (!relatedEvent) {
          result.passed = false;
          result.issues.push({
            type: 'ORPHANED_PARTICIPANT',
            eventId: eventId,
            participantId: participant[participantsHeader.indexOf('ParticipantID')],
            message: '參與者記錄缺少對應的事件'
          });
        }
      }
      
      // 檢查孤立的債務記錄
      for (const debt of debts) {
        const eventId = debt[debtsHeader.indexOf('EventID')];
        const relatedEvent = events.find(e => 
          e[eventsHeader.indexOf('EventID')] === eventId
        );
        
        if (!relatedEvent) {
          result.passed = false;
          result.issues.push({
            type: 'ORPHANED_DEBT',
            eventId: eventId,
            debtId: debt[debtsHeader.indexOf('DebtID')],
            message: '債務記錄缺少對應的事件'
          });
        }
      }
      
      result.details.eventsChecked = events.length;
      result.details.participantsChecked = participants.length;
      result.details.debtsChecked = debts.length;
      
    } catch (error) {
      result.passed = false;
      result.error = error.toString();
    }
    
    return result;
  }

  /**
   * 檢查資料格式一致性
   */
  async checkFormatConsistency() {
    const result = {
      name: '資料格式一致性檢查',
      passed: true,
      issues: [],
      details: {}
    };
    
    try {
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      const debtsSheet = ss.getSheetByName(IOU_DEBTS_SHEET_NAME);
      
      if (!debtsSheet) {
        throw new Error('Debts 工作表不存在');
      }
      
      const debtsData = debtsSheet.getDataRange().getValues();
      const debtsHeader = debtsData[0];
      const debts = debtsData.slice(1);
      
      let formatIssues = 0;
      
      for (let i = 0; i < debts.length; i++) {
        const debt = debts[i];
        const rowIndex = i + 2; // 1-based + header
        
        // 檢查金額格式
        const amount = debt[debtsHeader.indexOf('Amount')];
        if (amount !== '' && (isNaN(parseFloat(amount)) || parseFloat(amount) < 0)) {
          result.passed = false;
          result.issues.push({
            type: 'INVALID_AMOUNT_FORMAT',
            rowIndex: rowIndex,
            value: amount,
            message: '金額格式無效'
          });
          formatIssues++;
        }
        
        // 檢查狀態格式
        const status = debt[debtsHeader.indexOf('Status')];
        const validStatuses = ['Unsettled', 'Settled'];
        if (status && !validStatuses.includes(status)) {
          result.passed = false;
          result.issues.push({
            type: 'INVALID_STATUS_FORMAT',
            rowIndex: rowIndex,
            value: status,
            message: '狀態值無效',
            validValues: validStatuses
          });
          formatIssues++;
        }
        
        // 檢查 ID 格式
        const debtId = debt[debtsHeader.indexOf('DebtID')];
        if (debtId && !debtId.toString().startsWith('DBT-')) {
          result.passed = false;
          result.issues.push({
            type: 'INVALID_ID_FORMAT',
            rowIndex: rowIndex,
            value: debtId,
            message: 'DebtID 格式無效，應以 DBT- 開頭'
          });
          formatIssues++;
        }
      }
      
      result.details.recordsChecked = debts.length;
      result.details.formatIssues = formatIssues;
      
    } catch (error) {
      result.passed = false;
      result.error = error.toString();
    }
    
    return result;
  }

  /**
   * 檢查時間戳一致性
   */
  async checkTimestampConsistency() {
    const result = {
      name: '時間戳一致性檢查',
      passed: true,
      issues: [],
      details: {}
    };
    
    try {
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      const eventsSheet = ss.getSheetByName(IOU_EVENTS_SHEET_NAME);
      const debtsSheet = ss.getSheetByName(IOU_DEBTS_SHEET_NAME);
      
      if (!eventsSheet || !debtsSheet) {
        throw new Error('必要的工作表不存在');
      }
      
      const eventsData = eventsSheet.getDataRange().getValues();
      const debtsData = debtsSheet.getDataRange().getValues();
      
      const eventsHeader = eventsData[0];
      const debtsHeader = debtsData[0];
      
      const events = eventsData.slice(1);
      const debts = debtsData.slice(1);
      
      // 檢查結算時間的合理性
      for (let i = 0; i < debts.length; i++) {
        const debt = debts[i];
        const rowIndex = i + 2;
        
        const status = debt[debtsHeader.indexOf('Status')];
        const settlementDate = debt[debtsHeader.indexOf('SettlementDate')];
        
        // 如果狀態是已結算但沒有結算日期
        if (status === 'Settled' && !settlementDate) {
          result.passed = false;
          result.issues.push({
            type: 'MISSING_SETTLEMENT_DATE',
            rowIndex: rowIndex,
            debtId: debt[debtsHeader.indexOf('DebtID')],
            message: '已結算的債務缺少結算日期'
          });
        }
        
        // 如果狀態是未結算但有結算日期
        if (status === 'Unsettled' && settlementDate) {
          result.passed = false;
          result.issues.push({
            type: 'UNEXPECTED_SETTLEMENT_DATE',
            rowIndex: rowIndex,
            debtId: debt[debtsHeader.indexOf('DebtID')],
            message: '未結算的債務不應有結算日期'
          });
        }
        
        // 檢查結算日期是否在事件日期之後
        if (settlementDate) {
          const eventId = debt[debtsHeader.indexOf('EventID')];
          const relatedEvent = events.find(e => 
            e[eventsHeader.indexOf('EventID')] === eventId
          );
          
          if (relatedEvent) {
            const eventDate = new Date(relatedEvent[eventsHeader.indexOf('EventDate')]);
            const settlementDateTime = new Date(settlementDate);
            
            if (settlementDateTime < eventDate) {
              result.passed = false;
              result.issues.push({
                type: 'INVALID_SETTLEMENT_TIME',
                rowIndex: rowIndex,
                debtId: debt[debtsHeader.indexOf('DebtID')],
                message: '結算日期不能早於事件日期',
                eventDate: eventDate,
                settlementDate: settlementDateTime
              });
            }
          }
        }
      }
      
      result.details.debtsChecked = debts.length;
      
    } catch (error) {
      result.passed = false;
      result.error = error.toString();
    }
    
    return result;
  }

  /**
   * 檢查狀態一致性
   */
  async checkStatusConsistency() {
    const result = {
      name: '狀態一致性檢查',
      passed: true,
      issues: [],
      details: {}
    };
    
    try {
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      const debtsSheet = ss.getSheetByName(IOU_DEBTS_SHEET_NAME);
      
      if (!debtsSheet) {
        throw new Error('Debts 工作表不存在');
      }
      
      const debtsData = debtsSheet.getDataRange().getValues();
      const debtsHeader = debtsData[0];
      const debts = debtsData.slice(1);
      
      // 統計狀態分布
      const statusCounts = {};
      let inconsistentStatuses = 0;
      
      for (let i = 0; i < debts.length; i++) {
        const debt = debts[i];
        const rowIndex = i + 2;
        const status = debt[debtsHeader.indexOf('Status')];
        
        // 統計狀態
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        
        // 檢查狀態值是否有效
        const validStatuses = ['Unsettled', 'Settled'];
        if (status && !validStatuses.includes(status)) {
          result.passed = false;
          result.issues.push({
            type: 'INVALID_STATUS_VALUE',
            rowIndex: rowIndex,
            debtId: debt[debtsHeader.indexOf('DebtID')],
            status: status,
            message: '無效的狀態值'
          });
          inconsistentStatuses++;
        }
      }
      
      result.details.statusDistribution = statusCounts;
      result.details.inconsistentStatuses = inconsistentStatuses;
      result.details.totalRecords = debts.length;
      
    } catch (error) {
      result.passed = false;
      result.error = error.toString();
    }
    
    return result;
  }

  /**
   * 統計檢查結果
   */
  summarizeResults(results) {
    const checks = Object.values(results.checks);
    
    results.summary.totalChecks = checks.length;
    results.summary.passedChecks = checks.filter(c => c.passed).length;
    results.summary.failedChecks = checks.filter(c => !c.passed).length;
    
    // 收集所有不一致問題
    checks.forEach(check => {
      if (!check.passed && check.issues) {
        results.summary.inconsistencies.push(...check.issues);
      }
    });
    
    results.summary.totalInconsistencies = results.summary.inconsistencies.length;
  }

  /**
   * 生成一致性報告
   */
  generateConsistencyReport(checkResults) {
    const report = {
      reportId: this.generateReportId(),
      generatedAt: new Date(),
      checkResults: checkResults,
      recommendations: [],
      autoFixable: [],
      manualReview: []
    };
    
    // 分析問題並生成建議
    if (checkResults.summary.inconsistencies.length > 0) {
      checkResults.summary.inconsistencies.forEach(issue => {
        const recommendation = this.generateRecommendation(issue);
        report.recommendations.push(recommendation);
        
        if (recommendation.autoFixable) {
          report.autoFixable.push(issue);
        } else {
          report.manualReview.push(issue);
        }
      });
    }
    
    return report;
  }

  /**
   * 生成修復建議
   */
  generateRecommendation(issue) {
    const recommendation = {
      issueType: issue.type,
      severity: this.assessIssueSeverity(issue),
      autoFixable: false,
      description: '',
      steps: []
    };
    
    switch (issue.type) {
      case 'AMOUNT_MISMATCH':
        recommendation.severity = 'HIGH';
        recommendation.description = '事件總金額與債務總金額不一致';
        recommendation.steps = [
          '檢查事件記錄的總金額是否正確',
          '檢查相關債務記錄的金額是否正確',
          '重新計算並更正不一致的金額'
        ];
        break;
        
      case 'MISSING_PARTICIPANTS':
        recommendation.severity = 'MEDIUM';
        recommendation.description = '事件缺少參與者記錄';
        recommendation.steps = [
          '檢查事件是否應該有參與者記錄',
          '如果需要，手動添加參與者記錄',
          '確認事件類型是否正確'
        ];
        break;
        
      case 'INVALID_AMOUNT_FORMAT':
        recommendation.severity = 'MEDIUM';
        recommendation.autoFixable = true;
        recommendation.description = '金額格式無效';
        recommendation.steps = [
          '將無效的金額格式轉換為數字',
          '如果無法轉換，設為 0 並標記需要人工確認'
        ];
        break;
        
      case 'MISSING_SETTLEMENT_DATE':
        recommendation.severity = 'LOW';
        recommendation.autoFixable = true;
        recommendation.description = '已結算債務缺少結算日期';
        recommendation.steps = [
          '為已結算的債務添加當前日期作為結算日期',
          '或將狀態改為未結算'
        ];
        break;
        
      default:
        recommendation.severity = 'MEDIUM';
        recommendation.description = '需要人工檢查的問題';
        recommendation.steps = [
          '檢查相關記錄的詳細資訊',
          '根據業務邏輯進行適當的修正'
        ];
    }
    
    return recommendation;
  }

  /**
   * 評估問題嚴重程度
   */
  assessIssueSeverity(issue) {
    const highSeverityTypes = [
      'AMOUNT_MISMATCH',
      'DATA_INTEGRITY_ERROR',
      'ORPHANED_DEBT'
    ];
    
    const mediumSeverityTypes = [
      'MISSING_PARTICIPANTS',
      'INVALID_STATUS_FORMAT',
      'DATA_CONFLICT_ERROR'
    ];
    
    if (highSeverityTypes.includes(issue.type)) {
      return 'HIGH';
    } else if (mediumSeverityTypes.includes(issue.type)) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * 輔助方法
   */
  generateCheckId() {
    return `P4C-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }

  generateReportId() {
    return `P4R-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * 獲取最近的檢查結果
   */
  getRecentCheckResults(limit = 10) {
    const results = Array.from(this.checkResults.values());
    return results.slice(-limit);
  }

  /**
   * 清理舊的檢查結果
   */
  cleanupOldResults(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7天
    const cutoffTime = new Date(Date.now() - maxAge);
    
    for (const [checkId, result] of this.checkResults.entries()) {
      if (result.startTime < cutoffTime) {
        this.checkResults.delete(checkId);
      }
    }
  }
}