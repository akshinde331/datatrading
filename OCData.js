const puppeteer = require('puppeteer');
const { google } = require('googleapis');
const mysql = require('mysql2/promise');
const cron = require('node-cron');

// Database connection details
const dbConfig = {
    host: 'srv1954.hstgr.io',
    user: 'u752316189_akshinde331',
    password: 'Rock_Star331',
    database: 'u752316189_nseoptionchain'
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

// Function to fetch data and store in database using Puppeteer
async function fetchDataAndStoreInDB() {
    let connection;
    let browser;
    try {
        // Establish a connection to the database
        connection = await mysql.createConnection(dbConfig);
        console.log("Database is connected");

        // Start a transaction
        await connection.beginTransaction();

        // Use Puppeteer to fetch the data from NSE, with retry on error
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
        await page.setViewport({ width: 1280, height: 800 });

        const apiUrl = "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY";
        let data = null;
        let attempts = 0;
        while (!data && attempts < 5) {
            try {
                await page.goto('https://www.nseindia.com', { waitUntil: 'domcontentloaded' });
                await new Promise(res => setTimeout(res, 2000));
                data = await page.evaluate(async (apiUrl) => {
                    const response = await fetch(apiUrl, {
                        headers: {
                            'Accept': 'application/json, text/plain, */*',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Referer': 'https://www.nseindia.com/option-chain',
                        },
                        credentials: 'include',
                    });
                    if (!response.ok) throw new Error('Network response was not ok');
                    const json = await response.json();
                    return json.records.data;
                }, apiUrl);
            } catch (fetchErr) {
                attempts++;
                if (attempts < 5) {
                    console.error(`Fetch error (attempt ${attempts}), retrying in 5 seconds...`, fetchErr.message);
                    await new Promise(res => setTimeout(res, 5000));
                } else {
                    throw fetchErr;
                }
            }
        }

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

        const sql_query = `
    INSERT INTO option_chain (
        strikePrice,
        instrumentType,
        expiryDate,
        underlying,
        identifier,
        openInterest,
        changeinOpenInterest,
        pchangeinOpenInterest,
        totalTradedVolume,
        impliedVolatility,
        lastPrice,
        \`change\`,
        \`pChange\`,
        totalBuyQuantity,
        totalSellQuantity,
        bidQty,
        bidprice,
        askQty,
        askPrice,
        underlyingValue
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

for (let info of ocdata) {
    console.log(JSON.stringify(info, null, 2));

    await connection.query(sql_query, [
        info.strikePrice,
        info.instrumentType,
        info.expiryDate,
        info.underlying,        // 👈 required
        info.identifier,        // 👈 required
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
console.log("✅ All data inserted successfully");

        console.log(JSON.stringify(data, null, 2));
        // Call the stored procedure to process the data
        await connection.query('CALL InsertNseOptionChainData()');
        await connection.query('CALL Insert_ChgInOIVolume()');
        //await connection.query('CALL Calculate_ChgInTotalOI()');

        // Commit the transaction
        await connection.commit();
        console.log("Data inserted successfully");

    } catch (err) {
        // Rollback the transaction if there's an error
        if (connection) await connection.rollback();
        console.error(err);
    } finally {
        if (browser) await browser.close();
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
        console.log('In Catch',err);
        
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
        await fetchDataAndStoreInDB();
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



