import { Principal } from "@dfinity/principal";
import { describe, expect, it } from "@jest/globals";
import { AccountIdentifier, SubAccount } from "./account_identifier";

describe("SubAccount", () => {
  it("only accepts 32-byte blobs", () => {
    expect(SubAccount.fromBytes(new Uint8Array([1, 2]))).toBeInstanceOf(Error);
    expect(SubAccount.fromBytes(new Uint8Array(31))).toBeInstanceOf(Error);
    expect(SubAccount.fromBytes(new Uint8Array(33))).toBeInstanceOf(Error);
    expect(SubAccount.fromBytes(new Uint8Array(32))).toBeInstanceOf(SubAccount);
  });

  it("defines ZERO as a 32-byte zeroed array", () => {
    expect(SubAccount.fromID(0).toUint8Array()).toEqual(
      new Uint8Array(32).fill(0),
    );
  });

  it("can be initialized from a principal", () => {
    expect(SubAccount.fromPrincipal(Principal.fromText("aaaaa-aa"))).toEqual(
      SubAccount.fromBytes(new Uint8Array(32).fill(0)),
    );

    expect(
      SubAccount.fromPrincipal(
        Principal.fromText(
          "bl375-kyc3r-uvghl-oqn24-6chib-zxm3v-z3soy-p6ygm-ff5yu-p7kkm-oae",
        ),
      ),
    ).toEqual(
      SubAccount.fromBytes(
        new Uint8Array([
          29, 2, 220, 105, 83, 29, 110, 131, 117, 207, 8, 232, 14, 110, 205,
          215, 59, 147, 176, 255, 96, 204, 41, 123, 138, 63, 234, 83, 28, 2, 0,
          0,
        ]),
      ),
    );

    expect(
      SubAccount.fromPrincipal(
        Principal.fromText("kb4lg-bqaaa-aaaab-qabfq-cai"),
      ),
    ).toEqual(
      SubAccount.fromBytes(
        new Uint8Array([
          10, 0, 0, 0, 0, 0, 48, 0, 75, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ]),
      ),
    );
  });

  it("can be initialized from an ID", () => {
    expect(SubAccount.fromID(0)).toEqual(
      SubAccount.fromBytes(new Uint8Array(32).fill(0)),
    );
    const bytes = new Uint8Array(32).fill(0);
    bytes[31] = 1;
    expect(SubAccount.fromID(1)).toEqual(SubAccount.fromBytes(bytes));
    bytes[31] = 255;
    expect(SubAccount.fromID(255)).toEqual(SubAccount.fromBytes(bytes));
  });

  it("throws an exception if initialized with an ID < 0", () => {
    expect(() => {
      SubAccount.fromID(-1);
    }).toThrow();
  });

  it("throws an exception if initialized with an ID > 255", () => {
    expect(() => {
      SubAccount.fromID(256);
    }).toThrow();
  });
});

describe("AccountIdentifier", () => {
  test("can be initialized from a hex string", () => {
    expect(
      AccountIdentifier.fromHex(
        "d3e13d4777e22367532053190b6c6ccf57444a61337e996242b1abfb52cf92c8",
      ).toHex(),
    ).toBe("d3e13d4777e22367532053190b6c6ccf57444a61337e996242b1abfb52cf92c8");
  });

  test("can be initialized from a principal", () => {
    expect(
      AccountIdentifier.fromPrincipal({
        principal: Principal.fromText(
          "bwz3t-ercuj-owo6s-4adfr-sbu4o-l72hg-kfhc5-5sapm-tj6bn-3scho-uqe",
        ),
      }).toHex(),
    ).toBe("df4ad42194201b15ecbbe66ff68559a126854d8141fd935c5bd53433c2fb28d4");

    expect(
      AccountIdentifier.fromPrincipal({
        principal: Principal.fromText(
          "bwz3t-ercuj-owo6s-4adfr-sbu4o-l72hg-kfhc5-5sapm-tj6bn-3scho-uqe",
        ),
        subAccount: SubAccount.fromID(0),
      }).toHex(),
    ).toBe("df4ad42194201b15ecbbe66ff68559a126854d8141fd935c5bd53433c2fb28d4");
  });

  test("can be initialized from a principal and subaccount", () => {
    expect(
      AccountIdentifier.fromPrincipal({
        principal: Principal.fromText(
          "bwz3t-ercuj-owo6s-4adfr-sbu4o-l72hg-kfhc5-5sapm-tj6bn-3scho-uqe",
        ),
        subAccount: SubAccount.fromID(1),
      }).toHex(),
    ).toBe("16c3ca805340f0e426023bea907488100f93d5e2a654644d5d6881c7a7b2071e");

    expect(
      AccountIdentifier.fromPrincipal({
        principal: Principal.fromText(
          "bwz3t-ercuj-owo6s-4adfr-sbu4o-l72hg-kfhc5-5sapm-tj6bn-3scho-uqe",
        ),
        subAccount: SubAccount.fromID(255),
      }).toHex(),
    ).toBe("f9d8833b97d142d888d00606e2cadec4e70b9798d71c35091a20daaa14082e67");
  });
});
