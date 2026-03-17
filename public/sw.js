import { JSxdb } from './JSxdb/jsxdb.js';

self.addEventListener('install', async (event) => {
    console.debug('install');

    const db = await JSxdb.init("test.db", {
        1: {
            user: "@id, firstname, lastname"
        }
    });

    db.close();
});