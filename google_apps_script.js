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

    // 2. Add New Ticket
    if (action === 'add_ticket') {
      const ticketSheet = getOrCreateTicketingSheet(ss);
      ticketSheet.appendRow(rowData);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Ticket added successfully to Google Sheet' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Update Existing Ticket
    else if (action === 'update_ticket') {
      const ticketSheet = getOrCreateTicketingSheet(ss);
      const data = ticketSheet.getDataRange().getValues();
      let updated = false;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === String(ticketId).trim()) {
          const rowNum = i + 1;
          for (let col = 0; col < rowData.length; col++) {
            if (rowData[col] !== undefined && rowData[col] !== null) {
              ticketSheet.getRange(rowNum, col + 1).setValue(rowData[col]);
            }
          }
          updated = true;
          break;
        }
      }

      if (!updated) {
        ticketSheet.appendRow(rowData);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Ticket updated successfully in Google Sheet' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Standard Stock Add
    else if (action === 'add') {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error('Sheet not found: ' + sheetName);
      sheet.appendRow(rowData);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Item added successfully' }))
        .setMimeType(ContentService.MimeType.JSON);
    } 

    // 5. Standard Stock Update
    else if (action === 'update') {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error('Sheet not found: ' + sheetName);
      const data = sheet.getDataRange().getValues();
      let updated = false;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === String(assetId).trim() || String(data[i][1]).trim() === String(assetId).trim()) {
          const rowNum = i + 1;
          for (let col = 0; col < rowData.length; col++) {
            const val = rowData[col];
            if (val !== undefined && val !== null) {
              const cell = sheet.getRange(rowNum, col + 1);
              if (!cell.hasFormula()) {
                cell.setValue(val);
              }
            }
          }
          updated = true;
          break;
        }
      }

      if (!updated) {
        sheet.appendRow(rowData);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Item updated successfully' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 6. Delete Stock Item
    else if (action === 'delete') {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet && assetId) {
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === String(assetId).trim()) {
            sheet.deleteRow(i + 1);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Item deleted' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 7. Delete Ticket
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

    // 8. Add Purchase
    else if (action === 'add_purchase') {
      const purSheet = ss.getSheetByName('Purchases');
      if (purSheet && rowData) {
        purSheet.appendRow(rowData);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Purchase logged' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 9. Add Generator Log
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
