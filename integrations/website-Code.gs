/**
 * GGG Website - Google Apps Script
 *
 * Handles form submissions from the Ginga Global Group website.
 * Writes each submission to a Google Sheet tab named by form type,
 * then forwards to the CRM ingest API.
 *
 * IMPORTANT - before deploying:
 *   1. Set Script Properties (Project Settings -> Script properties):
 *      CRM_INGEST_URL  = https://crm.gingaglobalgroup.com/api/ingest
 *      CRM_INGEST_SECRET = <your INGEST_SECRET from .env.local>
 *      GITHUB_TOKEN    = <your GitHub personal access token>
 *      GITHUB_REPO     = bywillvass/ginga-global-group-site
 *      GITHUB_BLOG_FILE = blog-posts.json
 *      GITHUB_BRANCH   = main
 *   2. Deploy as a Web App (Execute as: Me, Who has access: Anyone).
 *   3. After deploying, update the URL in your website HTML forms.
 *   4. When re-deploying after changes: Deploy -> Manage deployments ->
 *      edit the existing deployment -> choose "New version". The URL
 *      stays the same when you use "New version" on an existing deployment.
 *
 * syncBlogToGitHub: keep this function but delete its time-driven trigger
 * once the CRM blog (Part 10) is live, to prevent overwriting CRM posts.
 * (Apps Script -> Triggers -> delete the trigger for syncBlogToGitHub)
 */

// ---------------------------------------------------------------------------
// doPost - receives form submissions from the website
// ---------------------------------------------------------------------------

/**
 * Entry point for POST requests from the website contact forms.
 * Writes the submission to the appropriate Sheet tab, then forwards to CRM.
 */
function doPost(e) {
  try {
    var params = {};

    // Support both JSON body and url-encoded form data
    if (e.postData && e.postData.type === 'application/json') {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        params = e.parameter || {};
      }
    } else {
      params = e.parameter || {};
    }

    // Honeypot: if the company field has a value this is a bot
    if (params.company) {
      return jsonResponse({ success: false, message: 'Bot detected' });
    }

    var formType = params.formType || params.form_type || 'General';
    var sourcePage = params.SourcePage || params.sourcePage || params.page || '';

    // Write to sheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateTab(ss, formType);
    var rowNumber = appendSubmission(sheet, params);

    // Forward to CRM (in its own try/catch so CRM failure never breaks the response)
    try {
      forwardToCRM(params, formType, rowNumber, sourcePage);
    } catch (crmErr) {
      Logger.log('CRM forward failed (non-fatal): ' + crmErr.toString());
    }

    return jsonResponse({ success: true });

  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return jsonResponse({ success: false, message: 'Server error' });
  }
}

/**
 * Get an existing tab or create a new one named after formType.
 */
function getOrCreateTab(ss, formType) {
  var sheet = ss.getSheetByName(formType);
  if (!sheet) {
    sheet = ss.insertSheet(formType);
  }
  return sheet;
}

/**
 * Append the form parameters as a new row.
 * The first row is used as a header row; missing columns are added automatically.
 * Returns the row number of the new row.
 */
function appendSubmission(sheet, params) {
  // Always include a timestamp
  var allParams = Object.assign({ Timestamp: new Date().toISOString() }, params);

  // Remove honeypot and internal routing fields from stored data
  delete allParams.company;
  delete allParams.formType;
  delete allParams.form_type;

  var keys = Object.keys(allParams);

  // Build or extend the headers row
  var headers;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(keys);
    headers = keys;
  } else {
    var headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    headers = headerRange.getValues()[0];

    // Add any new columns
    for (var i = 0; i < keys.length; i++) {
      if (headers.indexOf(keys[i]) === -1) {
        headers.push(keys[i]);
        sheet.getRange(1, headers.length).setValue(keys[i]);
      }
    }
  }

  // Build the data row in header order
  var row = headers.map(function(h) {
    return allParams[h] !== undefined ? allParams[h] : '';
  });

  sheet.appendRow(row);
  return sheet.getLastRow();
}

/**
 * Forward a form submission to the CRM ingest API.
 * Failures are logged but do not throw (caller wraps in try/catch).
 */
function forwardToCRM(params, formType, rowNumber, sourcePage) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('CRM_INGEST_URL');
  var secret = props.getProperty('CRM_INGEST_SECRET');

  if (!url || !secret) {
    Logger.log('CRM_INGEST_URL or CRM_INGEST_SECRET not set in Script Properties');
    return;
  }

  // Build the fields object - exclude internal routing/honeypot fields
  var fields = {};
  for (var key in params) {
    if (key === 'company' || key === 'formType' || key === 'form_type' ||
        key === 'SourcePage' || key === 'sourcePage' || key === 'page') {
      continue;
    }
    if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
      fields[key] = params[key];
    }
  }

  var externalId = 'website:' + formType + ':' + rowNumber;

  var payload = {
    leads: [
      {
        external_id: externalId,
        source: 'website',
        form_type: formType,
        source_detail: sourcePage || null,
        submitted_at: new Date().toISOString(),
        fields: fields
      }
    ]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      'x-ingest-secret': secret
    },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code !== 200) {
    Logger.log('CRM ingest returned ' + code + ': ' + response.getContentText());
  }
}

// ---------------------------------------------------------------------------
// doGet - serves blog posts to the website
// ---------------------------------------------------------------------------

/**
 * Returns blog posts as JSON for the website's blog section.
 * Reads from the blog-posts.json file in the GitHub repo.
 */
function doGet(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('GITHUB_TOKEN');
    var repo = props.getProperty('GITHUB_REPO') || 'bywillvass/ginga-global-group-site';
    var file = props.getProperty('GITHUB_BLOG_FILE') || 'blog-posts.json';
    var branch = props.getProperty('GITHUB_BRANCH') || 'main';

    var url = 'https://raw.githubusercontent.com/' + repo + '/' + branch + '/' + file;

    var fetchOptions = { muteHttpExceptions: true };
    if (token) {
      fetchOptions.headers = { Authorization: 'token ' + token };
    }

    var response = UrlFetchApp.fetch(url, fetchOptions);
    var json = response.getContentText();

    // Validate that it's an array
    try {
      var parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) json = '[]';
    } catch (parseErr) {
      json = '[]';
    }

    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('doGet error: ' + err.toString());
    return ContentService.createTextOutput('[]')
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ---------------------------------------------------------------------------
// syncBlogToGitHub - push blog posts from a Sheet tab to GitHub
//
// NOTE: Once the CRM blog (Part 10) is live, delete the time-driven trigger
// for this function so the CRM controls the blog exclusively.
// Apps Script -> Triggers -> delete the syncBlogToGitHub trigger.
// Keep the function itself in this file.
// ---------------------------------------------------------------------------

/**
 * Reads blog posts from the "BlogPosts" sheet tab and commits them to
 * blog-posts.json in the GitHub repo. Called by a time-driven trigger.
 */
function syncBlogToGitHub() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('GITHUB_TOKEN');
  var repo = props.getProperty('GITHUB_REPO') || 'bywillvass/ginga-global-group-site';
  var file = props.getProperty('GITHUB_BLOG_FILE') || 'blog-posts.json';
  var branch = props.getProperty('GITHUB_BRANCH') || 'main';

  if (!token) {
    Logger.log('GITHUB_TOKEN not set - skipping blog sync');
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('BlogPosts');
  if (!sheet) {
    Logger.log('BlogPosts tab not found - skipping blog sync');
    return;
  }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return; // no posts

  var headers = data[0];
  var posts = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var post = {};
    for (var j = 0; j < headers.length; j++) {
      if (headers[j]) post[headers[j]] = row[j];
    }
    // Only include published posts
    if (post.published === true || post.published === 'TRUE' || post.published === 1) {
      posts.push(post);
    }
  }

  var content = JSON.stringify(posts, null, 2);

  // Get current file SHA (required for GitHub update)
  var apiBase = 'https://api.github.com/repos/' + repo + '/contents/' + file;
  var headers_ = {
    Authorization: 'token ' + token,
    Accept: 'application/vnd.github.v3+json'
  };

  var getResp = UrlFetchApp.fetch(apiBase + '?ref=' + branch, {
    headers: headers_,
    muteHttpExceptions: true
  });

  var sha = null;
  if (getResp.getResponseCode() === 200) {
    var fileData = JSON.parse(getResp.getContentText());
    sha = fileData.sha;
  }

  var putBody = {
    message: 'Update blog posts from Apps Script',
    content: Utilities.base64Encode(content),
    branch: branch
  };
  if (sha) putBody.sha = sha;

  var putResp = UrlFetchApp.fetch(apiBase, {
    method: 'PUT',
    headers: headers_,
    payload: JSON.stringify(putBody),
    contentType: 'application/json',
    muteHttpExceptions: true
  });

  var putCode = putResp.getResponseCode();
  if (putCode === 200 || putCode === 201) {
    Logger.log('Blog synced to GitHub successfully');
  } else {
    Logger.log('GitHub sync failed (' + putCode + '): ' + putResp.getContentText());
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
