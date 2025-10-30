// --- CONFIGURATION ---
const ADMIN_PASSWORD = "sandeepclinic1"; // This must match the password in your HTML file

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
        const action = data.action;

        switch (action) {
            case 'submitPatient':
                const status = getRegistrationStatus();
                if (!status.isOpen) {
                    return createJsonResponse({ result: 'error', message: 'Registration is currently closed.' });
                }
                return handlePatientSubmission(data);

            case 'validateAdmin':
                // Trim whitespace from the submitted password to prevent copy-paste errors.
                if (data.password && data.password.trim() === ADMIN_PASSWORD) {
                    return createJsonResponse({ result: 'success' });
                } else {
                    return createJsonResponse({ result: 'error', message: 'Invalid password.' });
                }

            case 'setRegistrationStatus':
                // Trim whitespace from the submitted password to prevent copy-paste errors.
                if (!data.password || data.password.trim() !== ADMIN_PASSWORD) {
                    return createJsonResponse({ result: 'error', message: 'Authentication failed.' });
                }
                setRegistrationStatus(data.isOpen);
                return createJsonResponse({ result: 'success', message: 'Status updated.' });

            default:
                return createJsonResponse({ result: 'error', message: 'Invalid action specified.' });
        }
    } catch (error) {
        return createJsonResponse({ result: 'error', message: 'Invalid request data. ' + error.toString() });
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
  var timestamp = new Date(); // This is for column A, storing the full timestamp

  sheet.appendRow([timestamp, patientId, name, phone, age, tokenNumber, new Date()]); // Store a Date object in column G

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
 * Calculates the next available token number for a given date.
 * This version is more robust against different date formats in the sheet.
 * @param {Sheet} sheet The sheet to check for tokens.
 * @param {string} todayString The date string for today in "dd/MM/yyyy" format.
 * @return {number} The next token number.
 */
function getNextToken(sheet, todayString) {
  const timezone = "Asia/Kolkata";
  const format = "dd/MM/yyyy";
  const data = sheet.getDataRange().getValues();
  let tokenCount = 0;

  // Start from row 2 (index 1) to skip header
  for (let i = 1; i < data.length; i++) {
    const dateFromSheetCell = data[i][6]; // Column G is the date

    // Only proceed if the cell in the date column is not empty
    if (dateFromSheetCell && dateFromSheetCell instanceof Date) {
      // Format the date from the sheet to the same "dd/MM/yyyy" format
      const sheetDateString = Utilities.formatDate(dateFromSheetCell, timezone, format);
      
      // If the formatted date from the sheet matches today's date string, increment the count
      if (sheetDateString === todayString) {
        tokenCount++;
      }
    }
  }
  
  return tokenCount + 1;
}
