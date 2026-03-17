# JSxdb

_**JSxdb**_ is a promise-based and transactional wrapper for indexedDB.

## Example

```javascript
/* serviceworker.js */
import { JSxdb } from "./path/to/jsxdb.js";

// To initialise your database,
// you would normally add this to
// the Service Worker's installation handler:
self.addEventListener("install", async (event) => {
    console.debug("install");

    const db = await JSxdb.init("test.db", {
        1: {
            user: "@id, firstname, lastname",
        },
    });

    db.close();

    // [...]
});
```

```javascript
/* webapp.js */
import { JSxdb } from "./path/to/jsxdb.js";

window.addEventListener("load", async (event) => {
    const db = await JSxdb.init("test.db");

    const [store1] = await db.write("user");

    for await (
        const item of [
            { firstname: "a", lastname: "A" },
            { firstname: "b", lastname: "B" },
            { firstname: "c", lastname: "C" },
        ]
    ) {
        store1.add(item);
    }

    const result = await store1
        .where('firstname', JSxdb.eq('a'))
        .or('lastname', JSxdb.gt('B'))
        .reverse()
        .limit(2)
        .query();

    console.log(result);

    db.close();
});
```
