const nodemailer = require('nodemailer');
const config = require('config');

const mailConfig = config.get('mail');

const transtporter = nodemailer.createTransport({ ...mailConfig });

module.exports = transtporter;
