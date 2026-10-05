import {httpClient} from './httpClient.js';
const base=(projectId)=>`/projects/fixed-cost/${projectId}/milestones`;
export const projectMilestonesApi={
 list:async(projectId)=>(await httpClient.get(base(projectId))).data,
 get:async(projectId,id)=>(await httpClient.get(`${base(projectId)}/${id}`)).data,
 create:async(projectId,payload)=>(await httpClient.post(base(projectId),payload)).data,
 update:async(projectId,id,payload)=>(await httpClient.put(`${base(projectId)}/${id}`,payload)).data,
 changeStatus:async(projectId,id,payload)=>(await httpClient.patch(`${base(projectId)}/${id}/status`,payload)).data,
 remove:async(projectId,id)=>httpClient.delete(`${base(projectId)}/${id}`),
};
