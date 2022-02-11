/**
 * @jest-environment jsdom
 */

const { testConfig, testAgent } = require("./test_agent");
const nns = require("../../dist"); // in real use cases:  require("@dfinity/nns");
const { AccountIdentifier, LedgerCanister } = nns;

test("Should be able to get a balance", () => {
  jest.setTimeout(300000);
  const ledger = LedgerCanister.create({ agent: testAgent });

  let anAccount = testConfig.accounts[0];
  const accountIdentifier = AccountIdentifier.fromHex(anAccount);

  return ledger
    .accountBalance({ accountIdentifier })
    .then((balance) => console.log(`Balance: ${balance.toE8s()}`));
}, 5000000);
