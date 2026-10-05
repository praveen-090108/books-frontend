import { httpClient } from './httpClient.js';

export const recordsApi = {
  list: async ({ module, type, page = 0, size = 10, sort = 'recordDate,desc', search = '', status = '', secondaryStatus = '', category = '', department = '', partyName = '', dateFrom = '', dateTo = '', dueDateFrom = '', dueDateTo = '', paymentState = '', overdue = '' }) => {
    const { data } = await httpClient.get(`/records/${module}/${type}`, {
      params: { page, size, sort, search, status, secondaryStatus, category, department, partyName, dateFrom, dateTo, dueDateFrom, dueDateTo, paymentState, overdue },
      // Paged database queries can exceed the short interaction timeout while
      // the local Spring/JPA runtime is warming up. Do not abort a healthy
      // request and replace it with the misleading "backend could not load"
      // state.
      timeout: 60000,
    });
    return data;
  },
  summary: async ({ module, type, search = '', status = '', secondaryStatus = '', category = '', partyName = '', dateFrom = '', dateTo = '', dueDateFrom = '', dueDateTo = '', paymentState = '', overdue = '' }) => {
    const { data } = await httpClient.get(`/records/${module}/${type}/summary`, {
      params: { search, status, secondaryStatus, category, partyName, dateFrom, dateTo, dueDateFrom, dueDateTo, paymentState, overdue },
    });
    return data;
  },
  get: async ({ module, type, id }) => {
    const { data } = await httpClient.get(`/records/${module}/${type}/${id}`);
    return data;
  },
  create: async ({ module, type, payload }) => {
    const { data } = await httpClient.post(`/records/${module}/${type}`, payload);
    return data;
  },
  update: async ({ module, type, id, payload }) => {
    const { data } = await httpClient.put(`/records/${module}/${type}/${id}`, payload);
    return data;
  },
  remove: async ({ module, type, id }) => {
    await httpClient.delete(`/records/${module}/${type}/${id}`);
  },
};
