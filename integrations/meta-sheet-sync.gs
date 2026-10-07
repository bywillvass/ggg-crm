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
 *
 * Sheet columns used automatically:
 *   created_time  - Meta lead creation timestamp (Unix seconds or date string).
 *                   Used as submitted_at so "New this week" stats are correct.
 *   form_name     - The Meta form name (e.g. "GGG TO GREECE").
 *                   Used as form_type in the CRM instead of the tab name.
 *   campaign_name - Stored as a filterable field in the CRM.
 *   adset_name    - Stored as a filterable field in the CRM.
 *   full_name     - Parent/guardian full name.
 *   email         - Parent email.
 *   phone_number  - Parent phone.
 *   what_is_the_players_name?      - Player full name.
 *   what_year_was_the_player_born? - Player birth year.
 *   what_level_does_the_player_play_at? - Player level.
 *   what_state_are_you_from?       - State (stored on both contact and player).
 */

var ROW_KEY_PREFIX = 'lastRow_';

// ---------------------------------------------------------------------------
// syncNewLeads - called by the time-driven trigger every 5 minutes
// ---------------------------------------------------------------------------
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
    if (tabName.charAt(0) === '_') continue;
    processTab(sheet, tabName, url, secret, props);
  }
}

// ---------------------------------------------------------------------------
// processTab - read new rows from one tab and send to CRM
// ---------------------------------------------------------------------------
function processTab(sheet, tabName, url, secret, props) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var propKey = ROW_KEY_PREFIX + tabName;
  var lastProcessed = parseInt(props.getProperty(propKey) || '1', 10);
  if (lastProcessed >= lastRow) return;

  var numCols = sheet.getLastColumn();
  if (numCols === 0) return;

  // Read headers
  var headers = sheet.getRange(1, 1, 1, numCols).getValues()[0];

  // Find the Meta lead ID column for idempotent external_id
  var metaIdCol = -1;
  for (var h = 0; h < headers.length; h++) {
    var hNorm = headers[h].toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (hNorm === 'id' || hNorm === 'leadid') {
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
    var rows = sheet.getRange(currentRow, 1, numRows, numCols).getValues();

    var leads = [];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var fields = {};

      for (var c = 0; c < headers.length; c++) {
        var hdr = headers[c];
        var val = row[c];
        if (hdr && val !== '' && val !== null && val !== undefined) {
          fields[hdr] = val.toString();
        }
      }

      // --- submitted_at from created_time (fixes "New this week" stats) ---
      // Meta stores created_time as a Unix timestamp (seconds since epoch).
      // Google Sheets may convert it to a formatted string; handle both.
      var submittedAt;
      var rawCreatedTime = fields['created_time'];
      if (rawCreatedTime) {
        var ts = Number(rawCreatedTime);
        if (!isNaN(ts) && ts > 1000000000) {
          // Unix seconds -> milliseconds
          submittedAt = new Date(ts * 1000).toISOString();
        } else {
          var parsed = new Date(rawCreatedTime);
          submittedAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
        }
      } else {
        submittedAt = new Date().toISOString();
      }

      // --- form_type from form_name column (fixes "Sheet1" label) ---
      // Falls back to the tab name if form_name is not in the data.
      var formType = fields['form_name'] || tabName;

      // --- external_id ---
      var externalId;
      if (metaIdCol !== -1 && row[metaIdCol]) {
        externalId = 'meta:' + row[metaIdCol].toString();
      } else {
        externalId = 'metasheet:' + tabName + ':' + (currentRow + r);
      }

      leads.push({
        external_id: externalId,
        source: 'meta_instant_form',
        form_type: formType,
        submitted_at: submittedAt,
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
      props.setProperty(propKey, endRow.toString());
      currentRow = endRow + 1;
    } else {
      Logger.log('CRM ingest error for tab "' + tabName + '" rows ' + currentRow +
        '-' + endRow + ': HTTP ' + code + ' - ' + response.getContentText());
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// backfillAll - reset row pointers and resend everything
// ---------------------------------------------------------------------------
function backfillAll() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  for (var s = 0; s < sheets.length; s++) {
    var tabName = sheets[s].getName();
    if (tabName.charAt(0) === '_') continue;
    props.setProperty(ROW_KEY_PREFIX + tabName, '1');
    Logger.log('Reset row pointer for tab: ' + tabName);
  }

  Logger.log('All row pointers reset. Running syncNewLeads...');
  syncNewLeads();
  Logger.log('backfillAll complete.');
}

// ---------------------------------------------------------------------------
// countLeadsPerTab - diagnostic: how many rows per tab vs what was sent
// ---------------------------------------------------------------------------
function countLeadsPerTab() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var tabName = sheet.getName();
    if (tabName.charAt(0) === '_') continue;

    var lastRow = sheet.getLastRow();
    var dataRows = Math.max(0, lastRow - 1); // subtract header row
    var propKey = ROW_KEY_PREFIX + tabName;
    var lastProcessed = parseInt(props.getProperty(propKey) || '1', 10);
    var sentRows = Math.max(0, lastProcessed - 1);
    var pendingRows = Math.max(0, dataRows - sentRows);

    Logger.log('Tab "' + tabName + '": ' + dataRows + ' total rows, ' +
      sentRows + ' sent to CRM, ' + pendingRows + ' pending');
  }
}

// ---------------------------------------------------------------------------
// setupTrigger - creates the 5-minute time-driven trigger
// ---------------------------------------------------------------------------
function setupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncNewLeads') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('syncNewLeads')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Trigger created: syncNewLeads runs every 5 minutes.');
}
