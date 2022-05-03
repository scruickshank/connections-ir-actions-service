const compare = require('../src/compare');

const currentDoc = require('../tests/fakeRedis.json');
const incomingDoc = require('../tests/sns.json');
const updater = require('../src/update');

async function Test() {
    await updater.UpdateDocument(incomingDoc, currentDoc);
}

Test();