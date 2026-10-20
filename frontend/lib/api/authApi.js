// This file is about frontend API client calls for register, login and fetching the current user.
import client from './client';

export const authApi = {
  register: (email, password) => client.post('/auth/register', { email, password }),
  login:    (email, password) => client.post('/auth/login',    { email, password }),
  getMe:    ()                => client.get('/auth/me'),
};
