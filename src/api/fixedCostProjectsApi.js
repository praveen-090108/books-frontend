import {httpClient} from './httpClient.js';
export const fixedCostProjectsApi={options:async()=>(await httpClient.get('/projects/fixed-cost/options')).data};
