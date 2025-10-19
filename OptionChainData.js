const axios = require('axios');
const mysql = require('mysql2/promise');

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
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
};

// Function to fetch data and store in database
async function fetchDataAndStoreInDB() {
    try {
        const response = await axios.get(url, { headers });
        const data = response.data.records.data;

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
         console.log(ocdata)
        // Connect to the database
       // const connection = await mysql.createConnection(dbConfig);

        // Insert data into the table
    //     const insertQuery = `
    //         INSERT INTO option_chain (strikePrice, expiryDate, underlying, identifier, openInterest, changeinOpenInterest, pchangeinOpenInterest, totalTradedVolume, impliedVolatility, lastPrice, \`change\`, pChange, totalBuyQuantity, totalSellQuantity, bidQty, bidprice, askQty, askPrice, underlyingValue, instrumentType)
    //         VALUES ?
    //     `;
    //     const values = ocdata.map(item => [
    //         item.strikePrice,
    //         item.expiryDate,
    //         item.underlying,
    //         item.identifier,
    //         item.openInterest,
    //         item.changeinOpenInterest,
    //         item.pchangeinOpenInterest,
    //         item.totalTradedVolume,
    //         item.impliedVolatility,
    //         item.lastPrice,
    //         item.change,
    //         item.pChange,
    //         item.totalBuyQuantity,
    //         item.totalSellQuantity,
    //         item.bidQty,
    //         item.bidprice,
    //         item.askQty,
    //         item.askPrice,
    //         item.underlyingValue,
    //         item.instrumentType
    //     ]);

    //     await connection.query(insertQuery, [values]);

    //     console.log("Data successfully inserted into the database");

    //     // Close the connection
    //     await connection.end();
    // } catch (error) {
    //     console.error("Error fetching or storing data:", error);
    // }


            // Connect to the database
        
    
            // Insert data into the table
            let connection;
           
                // Connect to the database
                connection = await mysql.createConnection(dbConfig);
                console.log("Connected to the database");
        
                // Insert data into the table
                const insertQuery = `
                    INSERT INTO option_chain (strikePrice)
                    VALUES (110)
                `;
                const [result] = await connection.execute(insertQuery);
        
                // Log the result to ensure the query was executed
                console.log("Insert result:", result);
        
                // Check if rows were affected
                if (result.affectedRows > 0) {
                    console.log("Data successfully inserted into the database");
                } else {
                    console.log("No rows were inserted");
                }
        
            } catch (error) {
                console.error("Error inserting data:", error);
            } finally {
                if (connection) {
                    // Close the connection
                    await connection.end();
                    console.log("Database connection closed");
                }
            }
    }


// Run the function
fetchDataAndStoreInDB();
