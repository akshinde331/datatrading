const puppeteer = require('puppeteer');
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

// Google Sheets API setup
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = '1Z85_tlFwUpHeqz_jZbXKj7dU7qtJjGpI5H0-2ACWBj8'; // Replace with your Google Sheet ID
const SHEET_RANGE = 'OLDBANKNIFTY!B2'; // Replace with the range you want to update in the Google Sheet

async function authorize() {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json', // Replace with the path to your service account key file
        scopes: SCOPES,
    });
    const authClient = await auth.getClient();
    return google.sheets({ version: 'v4', auth: authClient });
}

// Function to fetch data and store in DB using Puppeteer
async function fetchDataAndStoreInDB() {
    let connection;
    let browser;
    try {
        // Connect to DB
        connection = await mysql.createConnection(dbConfig);
        console.log("Database is connected");
        await connection.beginTransaction();

        // Launch Puppeteer
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
        await page.setViewport({ width: 1280, height: 800 });

        const apiUrl = "https://www.nseindia.com/api/option-chain-indices?symbol=BANKNIFTY";
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

        // Format CE/PE data
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

        // Insert into DB
        const sql_query = `INSERT INTO BN_option_chain_Data 
        (strikePrice, instrumentType, expiryDate, openInterest, changeinOpenInterest, pchangeinOpenInterest, 
        totalTradedVolume, impliedVolatility, lastPrice, \`change\`, \`pChange\`, 
        totalBuyQuantity, totalSellQuantity, bidQty, bidprice, askQty, askPrice, underlyingValue) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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

        // Run SPs
        await connection.query('CALL BN_InsertNseOptionChainData()');
        await connection.query('CALL BN_Insert_ChgInOIVolume()');

        await connection.commit();
        console.log("Data inserted successfully");

    } catch (err) {
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
        const [rows] = await connection.query('SELECT * FROM BN_ChgInOIVolume');
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
    const resource = { values };
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
        connection = await mysql.createConnection(dbConfig);
        console.log("Database is connected");
        await connection.beginTransaction();
        await connection.query('DELETE FROM BN_option_chain_Data');
        await connection.query('DELETE FROM BN_option_chain');
        await connection.commit();
        console.log("All rows deleted successfully");
    } catch (err) {
        await connection.rollback();
        console.error(err);
    } finally {
        if (connection) {
            await connection.end();
            console.log("Database connection closed");
        }
    }
}

// Scheduled Task
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
    var time = hours + ":" + minutes;
    console.log(time);
    return time;
}

const time = getTime();
if(time == "16:00"){
    console.log('Process stopped');
    process.exit(0);
}
console.log("BankNifty Scheduler is set to run every 5 minutes");
// cron.schedule('*/5 * * * *', scheduledTask);

module.exports = scheduledTask;
