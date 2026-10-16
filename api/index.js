import { createAppServer } from '../src/server.js';

let appPromise;

export default async function handler(req, res) {
  appPromise ||= createAppServer();
  const {handler: requestHandler} = await appPromise;
  await requestHandler(req, res);
}
