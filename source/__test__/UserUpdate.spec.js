const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');
const en = require('../locales/en/translation.json');
const vi = require('../locales/vi/translation.json');
const fs = require('fs');
const path = require('path');
const config = require('config');
const { response } = require('express');

const { uploadDir, profileDir } = config;
const profileDirectory = path.join('.', uploadDir, profileDir);

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: { cascade: true } });
});

const activeUser = { username: 'user1', email: 'user1@mail.com', password: 'P4ssword', inactive: false };
const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  return await User.create(user);
};
const putUser = async (id = 5, body = null, options = {}) => {
  let agent = request(app);

  let token;
  if (options.auth) {
    const response = await agent.post('/api/1.0/auth').send(options.auth);
    token = response.body.token;
  }
  agent = request(app).put('/api/1.0/users/' + id);
  if (options.language) {
    agent.set('Accept-Language', options.language);
  }
  if (token) {
    agent.set('Authorization', `Bearer ${token}`);
  }
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent.send(body);
};

const readFileAsBase64 = () => {
  const filePath = path.join('.', '__test__', 'resources', 'test-png.png');
  return fs.readFileSync(filePath, { encoding: 'base64' });
};

describe('User Update', () => {
  it('return forbidden when request sent without basic authorization', async () => {
    const response = await putUser();
    expect(response.status).toBe(403);
  });

  it.each`
    language | message
    ${'vi'}  | ${vi.unauthorized_user_update}
    ${'en'}  | ${en.unauthorized_user_update}
  `(
    'returns error body with $message for unauthorized request when language is $language',
    async ({ language, message }) => {
      const nowInMillis = new Date().getTime();
      const response = await putUser(5, null, { language });
      expect(response.body.path).toBe('/api/1.0/users/5');
      expect(response.body.timestamp).toBeGreaterThan(nowInMillis);
      expect(response.body.message).toBe(message);
    }
  );

  it('returns forbidden when request sent with incorrect email in basic authorization', async () => {
    await addUser();
    const response = await putUser(5, null, { auth: { email: 'user1000@mail.com', password: 'P4ssword' } });
    expect(response.status).toBe(403);
  });
  it('returns forbidden when request sent with incorrect password in basic authorization', async () => {
    await addUser();
    const response = await putUser(5, null, { auth: { email: 'user1@mail.com', password: 'password' } });
    expect(response.status).toBe(403);
  });
  it('returns forbidden when update request is sent with correct credentials but for different user', async () => {
    await addUser();
    const userToBeUpdated = await addUser({ ...activeUser, username: 'user2', mail: 'user2@mail.com' });
    const response = await putUser(userToBeUpdated.id, null, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });
    expect(response.status).toBe(403);
  });
  it('returns forbidden when update request is sent by inactive user with correct credentials for its own user', async () => {
    const inactiveUser = await addUser({ ...activeUser, inactive: true });
    const response = await putUser(inactiveUser.id, null, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });
    expect(response.status).toBe(403);
  });
  it('returns 200 ok when valid update request sent from authorized user', async () => {
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated' };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });
    expect(response.status).toBe(200);
  });
  it('updates username in database when valid update request sent from authorized user', async () => {
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated' };
    await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });
    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser.username).toBe(validUpdate.username);
  });
  it('return 403 when token is not valid', async () => {
    const response = await putUser(5, null, { token: 123 });
    expect(response.status).toBe(403);
  });
  it('saves the user image when update contains image as base64', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });
    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser.image).toBeTruthy();
  });
  it('returns success body having only id, username, email and image', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });
    expect(Object.keys(response.body)).toEqual(['id', 'username', 'email', 'image']);
  });
  it('saves the user image to upload folder and stores filename in user when update has image', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });
    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    const profileImagePath = path.join(profileDirectory, inDBUser.image);
    expect(fs.existsSync(profileImagePath)).toBeTruthy();
  });
  it('remove the old image after user upload new one', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });

    const firstImage = response.body.image;

    await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });

    const profileImagePath = path.join(profileDirectory, firstImage);
    expect(fs.existsSync(profileImagePath)).toBeFalsy();
  });

  it.each`
    language | value             | message
    ${'vi'}  | ${null}           | ${vi.username_null}
    ${'vi'}  | ${'usr'}          | ${vi.username_size}
    ${'vi'}  | ${'a'.repeat(33)} | ${vi.username_size}
    ${'en'}  | ${null}           | ${en.username_null}
    ${'en'}  | ${'usr'}          | ${en.username_size}
    ${'en'}  | ${'a'.repeat(33)} | ${en.username_size}
  `(
    'returns bad request with $message when username is updated with $value when language is set as $language',
    async ({ language, value, message }) => {
      const savedUser = await addUser();
      const invalidUpdate = { username: value };
      const response = await putUser(savedUser.id, invalidUpdate, {
        auth: { email: savedUser.email, password: 'P4ssword' },
        language: language,
      });
      expect(response.status).toBe(400);
      expect(response.body.validationErrors.username).toBe(message);
    }
  );
  it('returns 200 when image size is exactly 2mb', async () => {
    const fileWithSize2MB = 'a'.repeat(1024 * 1024 * 2);
    const base64 = Buffer.from(fileWithSize2MB).toString('base64');
    const savedUser = await addUser();
    const validUpdate = { username: 'updated-user', image: base64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });
    expect(response.status).toBe(200);
  });
  it('returns 400 when image size is exceed 2mb', async () => {
    const fileWithExceeding2MB = 'a'.repeat(1024 * 1024 * 2) + 'a';
    const base64 = Buffer.from(fileWithExceeding2MB).toString('base64');
    const savedUser = await addUser();
    const validUpdate = { username: 'updated-user', image: base64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });
    expect(response.status).toBe(400);
  });
  it('keeps the old image after user only updates username', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });

    const firstImage = response.body.image;

    await putUser(
      savedUser.id,
      { username: 'user1-updated2' },
      {
        auth: { email: savedUser.email, password: 'P4ssword' },
      }
    );

    const profileImagePath = path.join(profileDirectory, firstImage);
    expect(fs.existsSync(profileImagePath)).toBeTruthy();

    const userInDb = await User.findOne({ where: { id: savedUser.id } });
    expect(userInDb.image).toBe(firstImage);
  });

  it.each`
    language | message
    ${'vi'}  | ${vi.profile_image_size}
    ${'vi'}  | ${vi.profile_image_size}
    ${'vi'}  | ${vi.profile_image_size}
    ${'en'}  | ${en.profile_image_size}
    ${'en'}  | ${en.profile_image_size}
    ${'en'}  | ${en.profile_image_size}
  `(
    'returns bad request with $message when username is updated with $value when language is set as $language',
    async ({ language, message }) => {
      const fileWithExceeding2MB = 'a'.repeat(1024 * 1024 * 2) + 'a';
      const base64 = Buffer.from(fileWithExceeding2MB).toString('base64');
      const savedUser = await addUser();
      const validUpdate = { username: 'updated-user', image: base64 };
      const response = await putUser(savedUser.id, validUpdate, {
        auth: { email: savedUser.email, password: 'P4ssword' },
        language,
      });
      expect(response.body.validationErrors.image).toBe(message);
    }
  );
});
