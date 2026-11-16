// Stable import surface for the mini-program fixture.
// Specs import from './wxa-test'; upgrade @open-wxa/wxa-runner-playwright
// here instead of touching every spec.
export { test, expect } from '@open-wxa/wxa-runner-playwright';
export type { WxaOptions } from '@open-wxa/wxa-runner-playwright';
