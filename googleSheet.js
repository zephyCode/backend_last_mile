import { google } from 'googleapis';

const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8')
);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const SHEET_ID = process.env.SHEET_ID;

const getSheetData = async (range) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: '1XAvYZGSJUWQ4KZCUjKbdQJzAq4Z0bG6_i3n4uS0fPZg',
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
