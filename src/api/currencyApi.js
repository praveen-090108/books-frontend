import { httpClient } from './httpClient.js';

export const currencyApi = {
  list: async () => {
    const { data } = await httpClient.get('/masters/currencies');
    return data;
  },
};
