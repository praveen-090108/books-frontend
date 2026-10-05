import {httpClient} from './httpClient.js';

const base=(projectId)=>`/projects/fixed-cost/${projectId}/profitability`;
export const fixedCostProjectProfitabilityApi={
  calculate:async(projectId)=>(await httpClient.get(base(projectId))).data,
  monthResources:async(projectId,yearMonth)=>(await httpClient.get(`${base(projectId)}/${yearMonth}/resources`)).data,
};
