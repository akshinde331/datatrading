const axios = require('axios');
const { google } = require('googleapis');
const mysql = require('mysql2/promise');
const cron = require('node-cron');

// Database connection details
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'root1',
    database: 'nseoptionchaindata'
};


// Define the URL and headers
const url = "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY";
const headers = {
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://www.nseindia.com/", // NSE API may require Referer header
    "Origin": "https://www.nseindia.com" // Sometimes Origin header is also required
};

const cookieUrl = "https://www.nseindia.com/";
const apiUrl = "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY";

// Headers for the initial request to get the cookies
const initialHeaders = {
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://www.nseindia.com/",
    "Origin": "https://www.nseindia.com"
};

// Google Sheets API setup
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = '1Z85_tlFwUpHeqz_jZbXKj7dU7qtJjGpI5H0-2ACWBj8'; // Replace with your Google Sheet ID
const SHEET_RANGE = 'OLDNIFTY!B2'; // Replace with the range you want to update in the Google Sheet

async function authorize() {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json', // Replace with the path to your service account key file
        scopes: SCOPES,
    });
    const authClient = await auth.getClient();
    return google.sheets({ version: 'v4', auth: authClient });
}

// Function to fetch data and store in database

async function fetchNSEData() {
  try {
    // Step 1: Get fresh cookies
    const homepageResp = await axios.get("https://www.nseindia.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br"
      }
    });

    const cookies = homepageResp.headers['set-cookie'];

    // Step 2: Call the NSE API
    const apiResp = await axios.get(
      "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Referer": "https://www.nseindia.com/option-chain",
          "Cookie": cookies.join("; ")
        }
      }
    );

    console.log("✅ Success at:", new Date().toLocaleTimeString());
    console.log(apiResp.data);
    return apiResponse.data.records.data;
    // Schedule next run after 1 minute
    

  } catch (error) {
    console.error("❌ Failed at:", new Date().toLocaleTimeString(),
      "| Status:", error.response?.status, error.response?.statusText);

    // Retry after 1 second
    setTimeout(fetchNSEData, 1000);
  }
}
async function fetchDataAndStoreInDB(data) {
    let connection;
  
   
    try {
         console.log("Data fetched successfully");
        let ocdata = [];
        data.forEach(item => {
            ['CE', 'PE'].forEach(type => {
                if (item[type]) {
                    let info = item[type];
                    info.instrumentType = type;
                    ocdata.push(info);
                }
            });
        });
        console.log("OC Data:", ocdata.length, "records found");
        //console.log(ocdata)
        // Prepare and execute the insert queries
        const sql_query = `INSERT INTO option_chain (strikePrice, instrumentType, expiryDate, openInterest, changeinOpenInterest, pchangeinOpenInterest, totalTradedVolume, impliedVolatility, lastPrice,\`change\`, 
        \`pChange\`, totalBuyQuantity, totalSellQuantity, bidQty, bidprice, askQty, askPrice, underlyingValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        for (let info of ocdata) {
            await connection.query(sql_query, [
                info.strikePrice,
                info.instrumentType,
                info.expiryDate,
                info.openInterest,
                info.changeinOpenInterest,
                info.pchangeinOpenInterest,
                info.totalTradedVolume,
                info.impliedVolatility,
                info.lastPrice,
                info.change,
                info.pChange,
                info.totalBuyQuantity,
                info.totalSellQuantity,
                info.bidQty,
                info.bidprice,
                info.askQty,
                info.askPrice,
                info.underlyingValue
            ]);
        }
        console.log("Data inserted successfully");
        // Call the stored procedure to process the data
        await connection.query('CALL InsertNseOptionChainData()');

        await connection.query('CALL Insert_ChgInOIVolume()');
        //await connection.query('CALL Calculate_ChgInTotalOI()');

        // Commit the transaction
        await connection.commit();
        console.log("Data inserted successfully");
        
         
    
     

    } catch (err) {
        // Rollback the transaction if there's an error
        await connection.rollback();
        console.error(err);
    } finally {
        if (connection) {
            await connection.end();
            console.log("Database connection closed");
        }
    }
}

async function fetchDataFromDB() {
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.query('SELECT * FROM ChgInOIVolume'); // Replace with your query
        return rows;
    } catch (err) {
        console.error('Error fetching data from database:', err);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

async function updateGoogleSheet(data) {
    const sheets = await authorize();
    const values = data.map(row => Object.values(row));
    const resource = {
        values,
    };
    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: SHEET_RANGE,
            valueInputOption: 'RAW',
            resource,
        });
        console.log('Google Sheet updated successfully');
    } catch (err) {
        console.error('Error updating Google Sheet:', err);
    }
}

async function deleteAllRows() {
    let connection;

    try {
        // Establish a connection to the database
        connection = await mysql.createConnection(dbConfig);
        console.log("Database is connected");

        // Start a transaction
        await connection.beginTransaction();

        // Delete all rows from the option_chain table
        await connection.query('DELETE FROM option_chain');

        // Delete all rows from the option_chain table
        await connection.query('DELETE FROM nse_option_chain');
        
        // Commit the transaction
        await connection.commit();
        console.log("All rows deleted successfully");

    } catch (err) {
        // Rollback the transaction if there's an error
        await connection.rollback();
        console.error(err);
    } finally {
        if (connection) {
            await connection.end();
            console.log("Database connection closed");
        }
    }
}
//Run the function
// deleteAllRows()
//     .then(() => {
//         // After deleting all rows, fetch data and store in database
//         fetchDataAndStoreInDB();
//     })
//     .catch(err => {
//         console.error("Error deleting rows:", err);
//     });

// Function to handle the scheduled tasks
async function scheduledTask() {
    try {
        await deleteAllRows();
        const datafromapi = fetchNSEData();
         if (!datafromapi || !Array.isArray(datafromapi) || datafromapi.length === 0) {
        console.error("❌ No valid data from fetchNSEData, aborting DB insert.");
        return; // Do not proceed
    }
        await fetchDataAndStoreInDB(datafromapi);
        const data = await fetchDataFromDB();
        await updateGoogleSheet(data);
    } catch (err) {
        console.error("Error in scheduled task:", err);
    }
}

function getTime() {
    const currentTime = new Date();
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    var time = hours + ":" + minutes;
    console.log(time);
    return time;
}

// // Schedule the task to run every 5 minutes
const time = getTime();
if(time == "16:00"){
    console.log('Process stopped' );
    process.exit(0);
}
console.log('Nifty weekly Schedule the task to run every 5 minutes');
// cron.schedule('*/1 * * * *', scheduledTask);


module.exports = scheduledTask;