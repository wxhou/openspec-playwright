// Seed test for the mini-program target.
// HOME_PAGE is resolved from the page manifest (entryPagePath > pages[0]).
import { test, expect } from './wxa-test';

const HOME_PAGE = '__HOME_PAGE__';
// __SKIP_LINE__

test.describe('Mini program smoke tests', () => {
  test('home page opens', async ({ miniProgram }) => {
    await miniProgram.open(HOME_PAGE);
    await expect(miniProgram).toHavePath(HOME_PAGE);
  });
});
