import {httpClient} from './httpClient.js';
const base=(projectId)=>`/projects/fixed-cost/${projectId}/team`;
export const fixedCostProjectTeamApi={
 list:async(projectId)=>(await httpClient.get(base(projectId))).data,
 get:async(projectId,id)=>(await httpClient.get(`${base(projectId)}/${id}`)).data,
 add:async(projectId,payload)=>(await httpClient.post(base(projectId),payload)).data,
 remove:async(projectId,id,payload)=>(await httpClient.patch(`${base(projectId)}/${id}/remove`,payload)).data,
};
