import { createAppServer } from '../src/server.js';

let appPromise;

export default async function handler(req, res) {
  appPromise ||= createAppServer();
  const {server} = await appPromise;
  server.emit('request', req, res);
}
