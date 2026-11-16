import { defineSetup } from '@open-wxa/wxa-runner-core/setup';

// Runs before App.onLaunch. An empty setup is valid; add only what the app
// needs. Examples:
//   storage: { token: process.env.WXA_TOKEN }
//   mock: { getLocation: { latitude: 31.23, longitude: 121.47 } }
//   network: { routes: { 'POST **/api/auth/login': { body: { token: '...' } } } }
export default defineSetup({});
