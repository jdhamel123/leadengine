import { handleRequest } from '../backend/portable-api';

export default {
  async fetch(request:Request){
    return handleRequest(request);
  }
};
