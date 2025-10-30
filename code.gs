// --- CONFIGURATION ---
const ADMIN_PASSWORD = "sudeepclinic1"; // This must match the password in your HTML file

// --- MAIN HANDLERS ---

/**
 * Handles GET requests.
 * - If action=getStatus, it returns the registration status as JSON.
 * - Otherwise, it serves the main index.html page.
 */
function doGet(e) {
  const action = e.parameter.action;

  if (action === 'getStatus') {
    const status = getRegistrationStatus();
    return createJsonResponse(status);
  }

  // Default action: Serve the HTML page, removing the Google footer.
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Handles POST requests.
 * - If action=setRegistrationStatus, it updates the global setting.
 * - If action=submitPatient, it handles new patient registration.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'submitPatient'; // Default to patient submission

    if (action === 'setRegistrationStatus') {
      // Admin action to change the status
      if (data.password !== ADMIN_PASSWORD) {
        return createJsonResponse({ result: 'error', message: 'Authentication failed.' });
      }
      setRegistrationStatus(data.isOpen);
      return createJsonResponse({ result: 'success', message: 'Status updated.' });

    } else if (action === 'submitPatient') {
      // Patient submission action
      const status = getRegistrationStatus();
      if (!status.isOpen) {
        return createJsonResponse({ result: 'error', message: 'Registration is currently closed.' });
      }
      // If registration is open, proceed to handle the submission
      return handlePatientSubmission(data);
    }

  } catch (error) {
    return createJsonResponse({ result: 'error', message: error.toString() });
  }
}

// --- CORE LOGIC HELPERS ---

/**
 * Processes a new patient registration. This contains your original submission logic.
 */
function handlePatientSubmission(data) {
  // --- VALIDATION BLOCK ---
  var phone = data.phone;
  var phoneRegex = /^\d{10}$/;
  if (!phoneRegex.test(phone)) {
    return createJsonResponse({
      'result': 'error', 'message': 'Invalid phone number. Please ensure it is exactly 10 digits.'
    });
  }
  // --- END VALIDATION ---

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Patient Data");
  var name = data.name;
  var age = data.age;

  var patientId = getPatientId(sheet, phone, name);
  const timezone = "Asia/Kolkata";
  const format = "dd/MM/yyyy";
  const today = Utilities.formatDate(new Date(), timezone, format);
  var tokenNumber = getNextToken(sheet, today);
  var timestamp = new Date();

  sheet.appendRow([timestamp, patientId, name, phone, age, tokenNumber, today]);

  return createJsonResponse({
    'result': 'success', 'patientId': patientId, 'tokenNumber': tokenNumber
  });
}

// --- ADMIN & STATUS HELPERS ---

/**
 * Gets the current registration status from Script Properties.
 * Defaults to 'true' (open) if not set.
 */
function getRegistrationStatus() {
  const properties = PropertiesService.getScriptProperties();
  const status = properties.getProperty('REGISTRATION_IS_OPEN');
  // Default to open if the property has never been set
  const isOpen = (status === null) ? true : (status === 'true');
  return { isOpen: isOpen };
}

/**
 * Sets the registration status in Script Properties.
 * @param {boolean} isOpen - The new status to set.
 */
function setRegistrationStatus(isOpen) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('REGISTRATION_IS_OPEN', String(isOpen));
}

/**
 * Helper function to create a standardized JSON response.
 */
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// --- YOUR ORIGINAL HELPER FUNCTIONS (UNCHANGED) ---

/**
 * FINAL, MOST ROBUST VERSION of the getPatientId function.
 * This version solves the "Number vs. Text" issue for phone numbers.
 */
function getPatientId(sheet, phone, name) {
  var searchPhone = String(phone).trim();
  var searchName = String(name).toLowerCase().trim();
  var data = sheet.getDataRange().getValues();

  for (var i = data.length - 1; i > 0; i--) {
    var sheetPhone = String(data[i][3]).trim(); // Column D is Phone
    var sheetName = String(data[i][2]).toLowerCase().trim(); // Column C is Name

    if (sheetPhone == searchPhone) {
      if (sheetName == searchName) {
        return data[i][1]; // Column B is PatientID
      }
    }
  }
  return "P_" + (sheet.getLastRow() + 1);
}

/**
 * DETECTIVE VERSION of the getNextToken function.
 * This will log everything to help us debug the date comparison.
 */
function getNextToken(sheet, todayString) {
  const timezone = "Asia/Kolkata";
  const format = "dd/MM/yyyy";
  const data = sheet.getDataRange().getValues();
  let tokenCount = 0;

  // Start from row 2 (index 1) to skip header
  for (let i = 1; i < data.length; i++) {
    const dateFromSheetCell = data[i][6]; // Column G is the Date column

    // Skip empty rows or rows where the date cell is empty
    if (!dateFromSheetCell) {
      continue;
    }

    // The value from the sheet can be a Date object or a string.
    // new Date() handles both cases more reliably than just formatting.
    // We create a new Date object to standardize it before formatting.
    const sheetDate = new Date(dateFromSheetCell);
    const sheetDateString = Utilities.formatDate(sheetDate, timezone, format);

    if (sheetDateString === todayString) {
      tokenCount++;
    }
  }
  return tokenCount + 1;
}
