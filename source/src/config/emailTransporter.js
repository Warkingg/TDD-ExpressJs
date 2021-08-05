const nodemailer = require('nodemailer');
const nodemailerStub = require('nodemailer-stub');
const transtporter = nodemailer.createTransport(nodemailerStub.stubTransport);

module.exports = transtporter;
