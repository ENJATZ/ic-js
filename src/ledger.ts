import { Actor, Agent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory as certifiedIdlFactory } from "../candid/nns_dapp.certified.idl";
import { NNSDappService } from "../candid/nns_dapp.idl";
import {
  CreateSubAccountResponse,
  SubAccountDetails,
} from "../candid/nns_dappTypes";
import {
  AccountBalanceRequest,
  BlockHeight as PbBlockHeight,
  ICPTs,
  Memo,
  Payment,
  SendRequest,
} from "../proto/ledger_pb";
import { AccountIdentifier } from "./account_identifier";
import { MAINNET_LEDGER_CANISTER_ID } from "./constants/canister_ids";
import { ICP } from "./icp";
import { BlockHeight } from "./types/common";
import {
  Fetcher,
  InsufficientFunds,
  InvalidSender,
  LedgerCanisterOptions,
  TransferError,
  TxCreatedInFuture,
  TxDuplicate,
  TxTooOld,
} from "./types/ledger";
import { defaultAgent } from "./utils/agent.utils";
import { queryCall, updateCall } from "./utils/proto.utils";

export class LedgerCanister {
  private constructor(
    private readonly agent: Agent,
    private readonly canisterId: Principal,
    private readonly updateFetcher: Fetcher,
    private readonly queryFetcher: Fetcher
  ) {}

  public static create(options: LedgerCanisterOptions = {}) {
    return new LedgerCanister(
      options.agent ?? defaultAgent(),
      options.canisterId ?? MAINNET_LEDGER_CANISTER_ID,
      options.updateCallOverride ?? updateCall,
      options.queryCallOverride ?? queryCall
    );
  }

  /**
   * Returns the balance of the specified account identifier.
   *
   * If `certified` is true, the request is fetched as an update call, otherwise
   * it is fetched using a query call.
   */
  public accountBalance = async ({
    accountIdentifier,
    certified = true,
  }: {
    accountIdentifier: AccountIdentifier;
    certified?: boolean;
  }): Promise<ICP> => {
    const callMethod = certified ? this.updateFetcher : this.queryFetcher;

    const request = new AccountBalanceRequest();
    request.setAccount(accountIdentifier.toProto());
    const responseBytes = await callMethod(
      this.agent,
      this.canisterId,
      "account_balance_pb",
      request.serializeBinary()
    );

    if (responseBytes instanceof Error) {
      // An error is never expected from this endpoint.
      throw Error;
    }

    return ICP.fromE8s(
      BigInt(ICPTs.deserializeBinary(new Uint8Array(responseBytes)).getE8s())
    );
  };

  /**
   * Creates a subaccount with the name and returns the Subaccount details
   *
   * TODO: Does this belong here in the "LedgerCanister"
   * TODO: Error messages
   * TODO: Why is calling to `add_account` needed?
   */
  public createSubaccount = async ({
    subAccountName,
  }: {
    subAccountName: string;
  }): Promise<SubAccountDetails> => {
    const service: NNSDappService = Actor.createActor<NNSDappService>(
      certifiedIdlFactory,
      {
        agent: this.agent,
        canisterId: this.canisterId,
      }
    );

    const MAX_TRIES = 2;
    const counter = 0;
    let response: CreateSubAccountResponse = await service.create_sub_account(
      subAccountName
    );
    while (response.AccountNotFound === null && counter < MAX_TRIES) {
      // I was getting a `AccountNotFound` error until `add_account` was called at least once.
      // Why?
      await service.add_account();
      response = await service.create_sub_account(subAccountName);
    }
    const { NameTooLong, SubAccountLimitExceeded, Ok } = response;

    if (NameTooLong === null) {
      // Which is the character?
      throw new Error(`Error, name ${subAccountName} is too long`);
    }

    if (SubAccountLimitExceeded === null) {
      // Which is the limit of subaccounts?
      throw new Error(`Error, name ${subAccountName} is too long`);
    }

    return Ok;
  };

  /**
   * Transfer ICP from the caller to the destination `accountIdentifier`.
   * Returns the index of the block containing the tx if it was successful.
   *
   * TODO: support remaining options (subaccounts, memos, etc.)
   */
  public transfer = async ({
    to,
    amount,
    memo,
  }: {
    to: AccountIdentifier;
    amount: ICP;
    memo?: bigint;
  }): Promise<BlockHeight | TransferError> => {
    const request = new SendRequest();
    request.setTo(to.toProto());

    const payment = new Payment();
    payment.setReceiverGets(amount.toProto());
    request.setPayment(payment);

    if (memo) {
      const memo = new Memo();
      memo.setMemo(memo.toString());
      request.setMemo(memo);
    }

    const responseBytes = await this.updateFetcher(
      this.agent,
      this.canisterId,
      "send_pb",
      request.serializeBinary()
    );

    if (responseBytes instanceof Error) {
      if (responseBytes.message.includes("Reject code: 5")) {
        // Match against the different error types.
        // This string matching is fragile. It's a stop-gap solution until
        // we migrate to the candid interface.

        if (responseBytes.message.match(/Sending from (.*) is not allowed/)) {
          return new InvalidSender();
        }

        {
          const m = responseBytes.message.match(
            /transaction.*duplicate.* in block (\d+)/
          );
          if (m && m.length > 1) {
            return new TxDuplicate(BigInt(m[1]));
          }
        }

        {
          const m = responseBytes.message.match(
            /debit account.*, current balance: (\d*(\.\d*)?)/
          );
          if (m && m.length > 1) {
            const balance = ICP.fromString(m[1]);
            if (balance instanceof ICP) {
              return new InsufficientFunds(balance);
            }
          }
        }

        if (responseBytes.message.includes("is in future")) {
          return new TxCreatedInFuture();
        }

        {
          const m = responseBytes.message.match(/older than (\d+)/);
          if (m && m.length > 1) {
            return new TxTooOld(Number.parseInt(m[1]));
          }
        }
      }

      // Unknown error. Throw as-is.
      throw responseBytes;
    }

    // Successful tx. Return the block height.
    return BigInt(PbBlockHeight.deserializeBinary(responseBytes).getHeight());
  };
}
