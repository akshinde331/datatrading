const cron = require('node-cron');
//const cron = require('node-cron');
const BnOcData = require('./BNOcdata');
const NfOcData_Weekly = require('./OCData');
const nfc =require('./OCData')
const demooc = require('./New_FetchOIData');
const NfOcData_Monthly = require('./NiftyMonthly');


cron.schedule('*/1 * * * *',schedular );
//cron.schedule('*/30 * * * * *', schedular);
async function schedular(){
    //await demooc();
    await NfOcData_Weekly();
    // await NfOcData_Monthly();
    //  await BnOcData();
}

