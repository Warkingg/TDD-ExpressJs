const express = require('express');
const User = require('./user/User');
const bcrypt = require('bcrypt');

const app = express();

app.use(express.json());

app.post('/api/1.0/users', (req, res) => {
  bcrypt.hash(req.body.password, 10).then((hash) => {
    /** 
     * Method 1: hash password
     const user = Object.assign({}, req.body, { password: hash });
    */

    /** 
    * Method 2: hash password
    const user = {
      username: req.body.username,
      email: req.body.email,
      password: hash,
    };
    */
    // Method 0: hash password
    const user = { ...req.body, password: hash };
    User.create(user).then(() => {
      return res.send({ message: 'User created' });
    });
  });
});

module.exports = app;
