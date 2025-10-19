// Import nodemailer
const nodemailer = require('nodemailer');

// Create a function to send an email
async function sendEmail() {
  try {
    // Create a transporter object using Gmail
    let transporter = nodemailer.createTransport({
      service: 'gmail', // Gmail service
      auth: {
        user: 'swapnil1418331@gmail.com', // Replace with your Gmail account
        pass: 'xmqj moqr hmrf bnvr', // Replace with your Gmail password or App Password
      },
    });

    // Define the email options
    let mailOptions = {
      from: 'swapnil1418331@gmail.com', // Sender address
      to: 'swapnilshinde3470@gmail.com', // List of recipients
      subject: 'Trade signal', // Subject line
      text: 'This email was sent from a Node.js script.', // Plain text body
    };

    // Send the email
    let info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// Call the sendEmail function
sendEmail();
