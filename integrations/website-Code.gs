/**
 * GGG Website - Google Apps Script
 *
 * Receives form submissions, writes to Google Sheets, and forwards to the CRM.
 *
 * Script Properties to set (Project Settings -> Script properties):
 *   CRM_INGEST_URL    = https://crm.gingaglobalgroup.com/api/ingest
 *   CRM_INGEST_SECRET = <your INGEST_SECRET from Vercel env vars>
 *   GITHUB_TOKEN      = <GitHub personal access token, repo scope>
 *
 * When re-deploying after changes:
 *   Deploy -> Manage deployments -> edit existing deployment -> "New version"
 *   The deployment URL does NOT change when you use "New version".
 *
 * Once the CRM blog (Part 10) is live, delete the time-driven trigger for
 * syncBlogToGitHub so the CRM controls the blog exclusively:
 *   Apps Script -> Triggers -> delete the syncBlogToGitHub trigger.
 */

const GITHUB_REPO = 'bywillvass/ginga-global-group-site';
const FILE_PATH = 'blog-posts.json';

function doPost(e) {
  try {
    const data = e.parameter;

    // Honeypot - ignore bot submissions
    if (data.company) {
      return ContentService.createTextOutput(JSON.stringify({ result: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const formType = data.formType || 'General';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(formType);
    if (!sheet) sheet = ss.insertSheet(formType);

    // Write headers on first row if sheet is empty
    if (sheet.getLastRow() === 0) {
      const keys = ['Timestamp', ...Object.keys(data).filter(k => k !== 'formType' && k !== 'company')];
      sheet.appendRow(keys);
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map(h => {
      if (h === 'Timestamp') return new Date();
      return data[h] || '';
    });
    sheet.appendRow(row);
    const rowNumber = sheet.getLastRow();

    // Forward to CRM - never breaks the sheet write or the website response
    forwardToCrm(formType, data, rowNumber);

    return ContentService.createTextOutput(JSON.stringify({ result: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function forwardToCrm(formType, data, rowNumber) {
  try {
    const props = PropertiesService.getScriptProperties();
    const url = props.getProperty('CRM_INGEST_URL');
    const secret = props.getProperty('CRM_INGEST_SECRET');
    if (!url || !secret) return;

    const fields = {};
    Object.keys(data).forEach(k => {
      if (k !== 'formType' && k !== 'company') fields[k] = data[k];
    });

    // external_id must be stable - row number only, no timestamp.
    // Including a timestamp would make the same row create a new lead on each retry.
    const externalId = 'website:' + formType + ':' + rowNumber;

    const payload = {
      leads: [{
        external_id: externalId,
        source: 'website',
        form_type: formType,
        source_detail: data.SourcePage || data.sourcePage || data.page || null,
        submitted_at: new Date().toISOString(),
        fields: fields
      }]
    };

    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-ingest-secret': secret },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    if (res.getResponseCode() !== 200) {
      Logger.log('CRM forward error ' + res.getResponseCode() + ': ' + res.getContentText());
    }
  } catch (err) {
    Logger.log('CRM forward failed: ' + err);
  }
}

// Run once from the editor to test the CRM connection
function testCrmForward() {
  forwardToCrm('Test', {
    'Parent Name': 'Test Parent',
    'Email': 'test-forward@example.com',
    'Player Name': 'Test Player',
    'Birth Year': '2012',
    'SourcePage': '/test'
  }, 0);
}

function doGet(e) {
  try {
    const sheetName = e.parameter.sheet || 'Blog';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON);

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

    return ContentService.createTextOutput(JSON.stringify(rows))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function syncBlogToGitHub() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) { Logger.log('No GITHUB_TOKEN set in Script Properties'); return; }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Blog');
  if (!sheet) { Logger.log('No sheet named Blog'); return; }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const posts = data.slice(1)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] instanceof Date ? row[i].toISOString().split('T')[0] : row[i];
      });
      return obj;
    })
    .filter(p => String(p.Published).toUpperCase() === 'TRUE');

  const json = JSON.stringify(posts, null, 2);
  const encoded = Utilities.base64Encode(Utilities.newBlob(json).getBytes());

  const apiBase = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
  const reqHeaders = {
    'Authorization': 'token ' + token,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  let sha = null;
  const getRes = UrlFetchApp.fetch(apiBase, { headers: reqHeaders, muteHttpExceptions: true });
  if (getRes.getResponseCode() === 200) {
    sha = JSON.parse(getRes.getContentText()).sha;
  }

  const body = { message: 'Update blog-posts.json from Google Sheets', content: encoded };
  if (sha) body.sha = sha;

  const putRes = UrlFetchApp.fetch(apiBase, {
    method: 'PUT',
    headers: reqHeaders,
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  Logger.log(putRes.getResponseCode() === 200 || putRes.getResponseCode() === 201
    ? 'blog-posts.json updated on GitHub'
    : 'Error: ' + putRes.getContentText());
}
