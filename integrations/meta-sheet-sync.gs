/**
 * GGG Meta Ads - Google Sheets sync to CRM
 *
 * Bound to the Google Sheet that receives Meta instant form leads.
 * Reads new rows from each tab and forwards them to the CRM ingest API.
 *
 * Setup (one-time):
 *   1. Open the Google Sheet that receives Meta leads.
 *   2. Extensions -> Apps Script -> paste this file.
 *   3. Set Script Properties (Project Settings -> Script properties):
 *      CRM_INGEST_URL    = https://crm.gingaglobalgroup.com/api/ingest
 *      CRM_INGEST_SECRET = <your INGEST_SECRET from .env.local>
 *   4. Run setupTrigger() once (select it in the function dropdown, click Run).
 *      This creates a time-driven trigger that runs syncNewLeads every 5 minutes.
 *   5. To resend everything (safe - API is idempotent): run backfillAll().
 *
 * Tab naming: each ad form's leads come in on their own tab.
 * Tabs whose name starts with "_" are skipped (use "_Config", "_Notes" etc).
 */

// Script property key prefix for last-processed row per tab
var ROW_KEY_PREFIX = 'lastRow_';

// ---------------------------------------------------------------------------
// syncNewLeads - called by the time-driven trigger every 5 minutes
// ---------------------------------------------------------------------------

/**
 * For every non-underscore tab, reads rows after the last processed row,
 * posts them to /api/ingest in batches of 50, and advances the stored
 * row pointer only after a successful response.
 */
function syncNewLeads() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('CRM_INGEST_URL');
  var secret = props.getProperty('CRM_INGEST_SECRET');

  if (!url || !secret) {
    Logger.log('CRM_INGEST_URL or CRM_INGEST_SECRET not set in Script Properties');
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var tabName = sheet.getName();

    // Skip underscore tabs
    if (tabName.charAt(0) === '_') continue;

    processTab(sheet, tabName, url, secret, props);
  }
}

/**
 * Process one tab: read new rows and send to CRM.
 */
function processTab(sheet, tabName, url, secret, props) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return; // only header or empty

  var propKey = ROW_KEY_PREFIX + tabName;
  var lastProcessed = parseInt(props.getProperty(propKey) || '1', 10);

  // lastProcessed is the last data row we sent (1 = only header, no data sent yet)
  if (lastProcessed >= lastRow) return; // nothing new

  // Read headers from row 1
  var numCols = sheet.getLastColumn();
  if (numCols === 0) return;

  var headerRange = sheet.getRange(1, 1, 1, numCols);
  var headers = headerRange.getValues()[0];

  // Detect Meta lead ID column
  var metaIdCol = -1;
  for (var h = 0; h < headers.length; h++) {
    var hLower = headers[h].toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (hLower === 'id' || hLower === 'leadid' || hLower === 'leadid') {
      metaIdCol = h;
      break;
    }
  }

  var startRow = lastProcessed + 1;
  var BATCH = 50;
  var currentRow = startRow;

  while (currentRow <= lastRow) {
    var endRow = Math.min(currentRow + BATCH - 1, lastRow);
    var numRows = endRow - currentRow + 1;
    var dataRange = sheet.getRange(currentRow, 1, numRows, numCols);
    var rows = dataRange.getValues();

    var leads = [];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var fields = {};
      for (var c = 0; c < headers.length; c++) {
        if (headers[c] && row[c] !== '' && row[c] !== null && row[c] !== undefined) {
          fields[headers[c]] = row[c].toString();
        }
      }

      // Build external_id
      var externalId;
      if (metaIdCol !== -1 && row[metaIdCol]) {
        externalId = 'meta:' + row[metaIdCol].toString();
      } else {
        externalId = 'metasheet:' + tabName + ':' + (currentRow + r);
      }

      leads.push({
        external_id: externalId,
        source: 'meta_instant_form',
        form_type: tabName,
        submitted_at: new Date().toISOString(),
        fields: fields
      });
    }

    if (leads.length === 0) {
      currentRow = endRow + 1;
      continue;
    }

    var payload = JSON.stringify({ leads: leads });
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      headers: { 'x-ingest-secret': secret },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();

    if (code === 200) {
      // Only advance pointer after a successful response
      props.setProperty(propKey, endRow.toString());
      currentRow = endRow + 1;
    } else {
      Logger.log('CRM ingest error for tab "' + tabName + '" rows ' + currentRow +
        '-' + endRow + ': HTTP ' + code + ' - ' + response.getContentText());
      break; // stop processing this tab until next run
    }
  }
}

// ---------------------------------------------------------------------------
// backfillAll - resets stored row pointers and resends everything
// ---------------------------------------------------------------------------

/**
 * Resets the last-processed row for all tabs to 1 (header row),
 * then runs syncNewLeads. Safe to call repeatedly - the API is idempotent.
 */
function backfillAll() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  for (var s = 0; s < sheets.length; s++) {
    var tabName = sheets[s].getName();
    if (tabName.charAt(0) === '_') continue;
    props.setProperty(ROW_KEY_PREFIX + tabName, '1');
  }

  Logger.log('All row pointers reset. Running syncNewLeads...');
  syncNewLeads();
  Logger.log('backfillAll complete.');
}

// ---------------------------------------------------------------------------
// setupTrigger - creates the 5-minute time-driven trigger
// ---------------------------------------------------------------------------

/**
 * Creates a time-driven trigger that calls syncNewLeads every 5 minutes.
 * Removes any duplicate triggers for syncNewLeads first.
 * Run this once after pasting this script.
 */
function setupTrigger() {
  // Remove any existing syncNewLeads triggers
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncNewLeads') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create new 5-minute trigger
  ScriptApp.newTrigger('syncNewLeads')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Trigger created: syncNewLeads runs every 5 minutes.');
}
