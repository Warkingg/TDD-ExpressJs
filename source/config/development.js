module.exports = {
  database: {
    database: 'hoaxify',
    username: 'my-db-user',
    password: 'db-p4ss',
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false,
  },
  mail: {
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'marcelino.kohler27@ethereal.email',
      pass: 'jaSSvFyBd521uNWnyq',
    },
  },
  uploadDir: 'upload-dev',
  profileDir: 'profile',
};
