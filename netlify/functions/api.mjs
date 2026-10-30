import {getStore} from '@netlify/blobs';
import seed from '../lib/seed.mjs';
import {createHandler} from '../lib/core.mjs';
export default createHandler({
  seed,
  getPassword: () => process.env.AMZ_ADMIN_PASSWORD,
  getStores: () => ({
    prices: getStore({name:'amz-prix',consistency:'strong'}),
    security: getStore({name:'amz-securite',consistency:'strong'})
  })
});
export const config = {path:['/api/catalogue','/api/login','/api/prix','/api/logout']};
