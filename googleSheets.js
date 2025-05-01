import { google } from 'googleapis';
import { readFileSync } from 'fs';

const auth = new google.auth.GoogleAuth({
  // credentials: JSON.parse(process.env.JSON_DATA),
  keyFile: 'ivrsystem-458506-dc3def334de9.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const SHEET_ID = '1XAvYZGSJUWQ4KZCUjKbdQJzAq4Z0bG6_i3n4uS0fPZg';

const getSheetData = async (range) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  return response.data.values;
};

const updateSheetColumn = async (range, value) => {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: value,
    },
  });
};

export { getSheetData, updateSheetColumn };
