import fetch from 'node-fetch';
import twilio from 'twilio';
import reader from 'xlsx';
import dotenv from 'dotenv';
import { getSheetData, updateSheetColumn } from './googleSheets.js';
dotenv.config();


const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const arr = [];

// const readFile = (path) => {
//   const file = reader.readFile(path);
//   let data = [];
//   const sheets = file.SheetNames;

//   // Logic for one sheet only for testing purposes.
//   const temp = reader.utils.sheet_to_json(file.Sheets[sheets[0]]);
//   temp.forEach((res) => data.push(res));

//   // Logic for multiple sheets in the excel file.
//   // for (let i = 0; i < sheets.length; i++) {
//   //   const temp = reader.utils.sheet_to_json(file.Sheets[sheets[i]]);
//   //   temp.forEach((res) => data.push(res));
//   // }
//   return data;
// };

const safeWriteFile = (workBook, path, retries = 5, delayMs = 1000) => {
  return new Promise((resolve, reject) => {
    const attempt = (count) => {
      try {
        reader.writeFile(workBook, path);
        resolve();
      } catch (err) {
        if (count <= 0) {
          reject(err);
        } else {
          console.warn(`Write failed, retrying... (${retries - count + 1})`);
          setTimeout(() => attempt(count - 1), delayMs);
        }
      }
    };
    attempt(retries);
  });
};



const readFile = async () => {
  const values = await getSheetData('Sheet1!A1:G'); // Update range as needed
  const headers = values[0];
  const data = values.slice(1).map(row => {
    const rowObj = {};
    headers.forEach((header, index) => {
      rowObj[header] = row[index];
    });
    return rowObj;
  });
  return data;
};

const writeFile = async (col, rowCount, value) => {
  const range = `Sheet1!${col}2:${col}${rowCount + 1}`;
  const values = Array(rowCount).fill([value]);
  await updateSheetColumn(range, values);
};



const getUserDTMFResponse = async (callSid) => {
  const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);

  try {
    const document = await client.sync
      .services(process.env.SYNC_SERVICE_SID)
      .documents(callSid)
      .fetch();

    return document.data.digit;
  } catch (error) {
    console.error("Error fetching Sync document:", error.message);
    return null;
  }
};



const makeIVRCall = async (caller, receiver) => {
  const accountSid = process.env.ACCOUNT_SID;
  const authToken = process.env.AUTH_TOKEN;
  const client = twilio(accountSid, authToken);

  let formattedReceiver = receiver;
  if (!receiver.startsWith('+')) {
    formattedReceiver = '+91' + receiver;
  }

  try {
    const call = await client.calls.create({
      from: caller,
      to: formattedReceiver,
      url: "https://ivrcall-3848.twil.io/ivr-start",
      statusCallback: "https://ivrcall-3848.twil.io/ivr-status",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    });
    console.log(`Call initiated to ${formattedReceiver} | SID: ${call.sid}`);
    return call.sid;
  } catch (err) {
    console.error(`Failed to call ${formattedReceiver}:`, err.message);
    return null;
  }
};


const callPassengersRepeatedly = async () => {
  const data = await readFile(); 
  for (let i = 0; i < data.length; i++) {
    const itr = data[i];
    if (itr.Call_Attempt_Success == 'Yes') {
      console.log(itr.Passenger_Name + ' is already called successfully...');
      continue;
    }
    const contact = itr.Passenger_Contact;
    console.log(`Calling ${i + 1} number ${contact}...`);
    const sid = await makeIVRCall('+1908320-8102', contact);
    if (sid) {
      const status = await getFinalStatus(sid);
      if (status === 'completed') {
        await writeFile('G', data.length, 'Yes');
      }
      arr.push({ status: status, receiver: contact });
    }
    if (i === data.length - 1) break;
    await delay(15000);
  }
  console.log('All calls completed.');
  return arr;
};



const getFinalStatus = async (callSid) => {
  const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
  const finalStates = ['completed', 'failed', 'busy', 'no-answer', 'canceled'];

  for (let i = 0; i < 10; i++) {  // Check every 5s up to 50s
    const call = await client.calls(callSid).fetch();
    console.log(`Checking status... Current: ${call.status}`);
    if (finalStates.includes(call.status)) {
      console.log(`Final status for ${callSid}: ${call.status}`);
      return call.status;
    }
    await delay(5000);
  }

  console.warn(`Final status not reached within expected time for ${callSid}`);
  return null;
};

const convertExcelTimeToString = (excelTime) => {
  const totalMinutes = Math.round(excelTime * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  return `${hh}:${mm}`;
};

const parseDateTime = (dateString, timeString) => {
  let landingDateTime;
  if (!isNaN(dateString)) {
    landingDateTime = new Date((dateString - 25569) * 86400 * 1000);
  } else if (typeof dateString === 'string' && dateString.indexOf('-') > -1) {
    landingDateTime = new Date(`${dateString} ${timeString}`);
  } else {
    const dateParts = dateString.split('/');
    if (dateParts.length === 3) {
      const formattedDateString = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]} ${timeString}`;
      landingDateTime = new Date(formattedDateString);
    }
  }
  if (isNaN(landingDateTime)) {
    console.error("Invalid date/time format:", `${dateString} ${timeString}`);
    return null;
  }
  return landingDateTime;
};

const cleanPhoneNumber = (number) => {
  return number.toString().replace(/[^0-9]/g, '');
};

// console.log(cleanPhoneNumber('a7500155011'));

const scheduleCallsBasedOnLandingTime = async () => {
  const data = readFile("./MOCK_DATAa.xlsx");
  const currentTime = new Date();

  for (let i = 0; i < data.length; i++) {
    const passenger = data[i];
    const contact = cleanPhoneNumber(passenger.phone_number);
    const arrivalDate = passenger.flight_arrival_date;
    const rawTime = passenger.flight_arrival_time;

    if (!arrivalDate || !rawTime) {
      continue;
    }
    const timeStr = typeof rawTime === 'number'
      ? convertExcelTimeToString(rawTime)
      : rawTime;

    const landingDateTime = parseDateTime(arrivalDate, timeStr);
    console.log(landingDateTime);

    if (!landingDateTime) {
      continue
    }

    const timeDifferenceInMinutes = (landingDateTime - currentTime) / (1000 * 60);

    if (timeDifferenceInMinutes <= 15 && timeDifferenceInMinutes >= 0) {
      const sid = await makeIVRCall("+1908320-8102", contact);
      if (sid) {
        const status = await getFinalStatus(sid);
        arr.push({ status: status, receiver: contact });
      }
      await delay(7000);
    }
  }
  console.log('All eligible calls completed.');
  return arr;
};


export { callPassengersRepeatedly, makeIVRCall, scheduleCallsBasedOnLandingTime };