/**
 * Google Apps Script for Puthuppadi Grama Panchayath IT Stock Register & Ticketing System
 * 
 * HOW TO DEPLOY:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1TU8KfFDau1e5A9WdNQ7qG8d5Jt4_9th-dbJjya70YoE/edit
 * 2. In the top menu, click 'Extensions' > 'Apps Script'.
 * 3. Delete existing code, paste this entire file.
 * 4. Click 'Deploy' > 'Manage deployments' > Edit (Pencil icon) > New Version > Deploy.
 */

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ensure Ticketing_System sheet exists with headers
    getOrCreateTicketingSheet(ss);

    const sheetsToExport = [
      'Dashboard', 'Register-PC', 'Register-Monitor', 'Register-K&M', 
      'Other_Equipments', 'Register-PTR', 'Complaint_Register', 
      'Ticketing_System', 'Generator', 'Employee_list', 'Purchases', 'ip_address'
    ];

    const result = {};
    sheetsToExport.forEach(name => {
      const sheet = ss.getSheetByName(name);
      if (sheet) {
        const data = sheet.getDataRange().getValues();
        result[name] = data;
      }
    });

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const sheetName = postData.sheet;
    const rowData = postData.data;
    const assetId = postData.assetId;
    const ticketId = postData.ticketId;
    const empData = postData.employee;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Update Employee List (Seat, Name, Designation, Office)
    if (action === 'update_employee' || (empData && empData.seat)) {
      const empSheet = ss.getSheetByName('Employee_list');
      if (empSheet && empData && empData.seat) {
        const empRange = empSheet.getDataRange().getValues();
        let foundRow = -1;
        let lastFilledRow = 1;
        let maxSl = 0;

        for (let r = 1; r < empRange.length; r++) {
          const rowSeat = String(empRange[r][1] || '').trim();
          const rowName = String(empRange[r][2] || '').trim();
          const rawSl = String(empRange[r][0] || '').replace(/[^0-9]/g, '');
          const rowSl = parseInt(rawSl, 10);
          if (!isNaN(rowSl) && rowSl > maxSl) maxSl = rowSl;

          if (rowSeat !== '' || rowName !== '') {
            lastFilledRow = r + 1;
          }

          if (rowSeat !== '' && rowSeat.toUpperCase() === String(empData.seat).trim().toUpperCase()) {
            foundRow = r + 1;
            break;
          }
        }

        if (foundRow !== -1) {
          // Update existing staff
          if (empData.name !== undefined && empData.name !== null) empSheet.getRange(foundRow, 3).setValue(empData.name);
          if (empData.designation !== undefined && empData.designation !== null) empSheet.getRange(foundRow, 4).setValue(empData.designation);
          if (empData.office !== undefined && empData.office !== null) empSheet.getRange(foundRow, 5).setValue(empData.office);
        } else if (action === 'update_employee') {
          // Add new staff directly at next available row
          const insertRow = lastFilledRow + 1;
          const nextSl = maxSl > 0 ? maxSl + 1 : lastFilledRow;
          empSheet.getRange(insertRow, 1, 1, 5).setValues([[
            nextSl,
            empData.seat,
            empData.name || '',
            empData.designation || '',
            empData.office || 'PGP OFFICE'
          ]]);
        }
      }
      if (action === 'update_employee') {
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Employee updated in Google Sheet' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 2. Add / Update Ticket
    if (action === 'add_ticket' || action === 'update_ticket') {
      const ticketSheet = getOrCreateTicketingSheet(ss);
      writeTicketRowSafely(ticketSheet, rowData, ticketId);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Ticket saved successfully in Google Sheet' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Add or Update Standard Stock Item (Formula-Protected & Smart Slot Finder)
    else if (action === 'add' || action === 'update') {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error('Sheet not found: ' + sheetName);
      
      const targetRow = writeStockRowSafely(sheet, rowData, assetId);

      // If PC marked as Working, clean up stale closed complaint entries from Complaint_Register Column A
      if (sheetName === 'Register-PC' && assetId) {
        cleanClosedComplaintsInSheet(ss, assetId, rowData[15]);
      }

      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        message: 'Item synchronized successfully at row ' + targetRow 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Delete Stock Item (Safely clears non-formula data so row can be reused without breaking VLOOKUP)
    else if (action === 'delete') {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet && assetId) {
        clearStockRowSafely(sheet, assetId);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Item removed from Google Sheet' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 5. Delete Ticket
    else if (action === 'delete_ticket') {
      const ticketSheet = getOrCreateTicketingSheet(ss);
      if (ticketSheet && ticketId) {
        const data = ticketSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === String(ticketId).trim()) {
            ticketSheet.deleteRow(i + 1);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Ticket deleted' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 6. Add Purchase
    else if (action === 'add_purchase') {
      const purSheet = ss.getSheetByName('Purchases');
      if (purSheet && rowData) {
        purSheet.appendRow(rowData);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Purchase logged' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 7. Add Generator Log
    else if (action === 'add_generator') {
      const genSheet = ss.getSheetByName('Generator');
      if (genSheet && rowData) {
        genSheet.appendRow(rowData);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Generator log saved' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Operation completed' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Helper to safely write stock items into Google Sheets without breaking existing formulas
 * and without appending below empty formula template rows.
 */
function writeStockRowSafely(sheet, rowData, assetId) {
  const data = sheet.getDataRange().getValues();
  let targetRow = -1;

  // 1. Search for existing item by Asset ID -> Update that row
  if (assetId) {
    const searchId = String(assetId).trim().toUpperCase();
    for (let i = 1; i < data.length; i++) {
      const col0 = String(data[i][0] || '').trim().toUpperCase();
      if (col0 === searchId) {
        targetRow = i + 1;
        break;
      }
    }
  }

  // 2. If new item, find the FIRST available row where Column A (Asset ID) is blank
  if (targetRow === -1) {
    for (let i = 1; i < data.length; i++) {
      const col0 = String(data[i][0] || '').trim();
      if (!col0 || col0 === '#N/A' || col0 === '') {
        targetRow = i + 1;
        break;
      }
    }
  }

  // 3. If no empty slot found, append at the end of sheet
  if (targetRow === -1) {
    targetRow = data.length + 1;
  }

  // 4. Set values cell-by-cell, protecting formulas (VLOOKUP, etc.) from being overwritten
  for (let col = 0; col < rowData.length; col++) {
    const val = rowData[col];
    if (val !== undefined && val !== null) {
      const cell = sheet.getRange(targetRow, col + 1);
      if (!cell.hasFormula()) {
        cell.setValue(val);
      }
    }
  }

  return targetRow;
}

/**
 * Safely clears an item's data while keeping formulas intact for future re-use
 */
function clearStockRowSafely(sheet, assetId) {
  const data = sheet.getDataRange().getValues();
  const searchId = String(assetId).trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    const col0 = String(data[i][0] || '').trim().toUpperCase();
    if (col0 === searchId) {
      const rowNum = i + 1;
      const numCols = data[i].length;
      for (let col = 0; col < numCols; col++) {
        const cell = sheet.getRange(rowNum, col + 1);
        if (!cell.hasFormula()) {
          cell.setValue('');
        }
      }
      break;
    }
  }
}

/**
 * Helper to safely write tickets to Ticketing_System sheet
 */
function writeTicketRowSafely(sheet, rowData, ticketId) {
  const data = sheet.getDataRange().getValues();
  let targetRow = -1;

  if (ticketId) {
    const tid = String(ticketId).trim().toUpperCase();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim().toUpperCase() === tid) {
        targetRow = i + 1;
        break;
      }
    }
  }

  if (targetRow === -1) {
    sheet.appendRow(rowData);
    return;
  }

  for (let col = 0; col < rowData.length; col++) {
    const val = rowData[col];
    if (val !== undefined && val !== null) {
      sheet.getRange(targetRow, col + 1).setValue(val);
    }
  }
}

/**
 * Helper to ensure the Ticketing_System sheet exists with standard columns & formatting
 */
function getOrCreateTicketingSheet(ss) {
  let sheet = ss.getSheetByName('Ticketing_System');
  if (!sheet) {
    sheet = ss.insertSheet('Ticketing_System');
    const headers = [
      'Ticket ID', 'Vendor Call / CSP No', 'Asset ID', 'Item Details', 
      'Office Section', 'Reported By', 'Category', 'Priority', 
      'Fault Description', 'Service Provider', 'Date Logged', 
      'Vendor Call Date', 'Attended Date', 'Technician Name', 
      'Technician Contact', 'Parts Replaced', 'Resolution Work Done', 
      'Status', 'Closed Date', 'Turnaround (Days)', 'Remarks'
    ];
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1e3a8a');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * If a PC is marked Working, remove its Asset ID from Complaint_Register Column A
 * so the MATCH formula in Register-PC Column 18 correctly returns FALSE.
 */
function cleanClosedComplaintsInSheet(ss, assetId, isWorkingVal) {
  try {
    const compSheet = ss.getSheetByName('Complaint_Register');
    if (!compSheet) return;
    const isWork = (isWorkingVal === 1 || isWorkingVal === true || isWorkingVal === '1' || String(isWorkingVal).toLowerCase() === 'working');
    if (!isWork) return;

    const data = compSheet.getDataRange().getValues();
    const searchId = String(assetId).trim().toUpperCase();

    for (let i = 1; i < data.length; i++) {
      const col0 = String(data[i][0] || '').trim().toUpperCase();
      if (col0 === searchId) {
        // Clear Column A so the MATCH formula in Register-PC immediately turns FALSE/Working
        compSheet.getRange(i + 1, 1).setValue('');
      }
    }
  } catch (e) {}
}
