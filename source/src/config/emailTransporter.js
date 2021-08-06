const nodemailer = require('nodemailer');;

const transtporter = nodemailer.createTransport({
  host: 'localhost',
  port: 8587,
  tls: {
    rejectUnauthorized: false,
  },
});

module.exports = transtporter;
