import { httpClient } from './httpClient.js';

export const customerApi = {
  findAll: async () => {
    const { data } = await httpClient.get('/customers');
    return data;
  },
};
