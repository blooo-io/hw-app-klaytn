import Transport from "@ledgerhq/hw-transport";
import { StatusCodes } from "@ledgerhq/errors";
import { pathToBuffer, serializeLegacyTransaction, serializeSignature, serializeKlaytnTransaction } from "./serialization";
import Caver, { Transaction, LegacyTransaction, ValueTransfer, ValueTransferMemo, SmartContractDeploy, SmartContractExecution, Cancel } from "caver-js";

const P1_NON_CONFIRM = 0x00;
const P1_CONFIRM = 0x01;

const P1_FIRST = 0x00
const P1_MORE = 0x80

const P2_SIGN = 0x00;

const LEDGER_CLA = 0xe0;
const CLA_OFFSET = 0x00;

const INS = {
  GET_VERSION: 0x06,
  GET_ADDR: 0x02,
  SIGN_LEGACY: 0x04,
  SIGN_VALUE_TRANSFER: 0x08,
  SIGN_VALUE_TRANSFER_MEMO: 0x10,
  SIGN_SMART_CONTRACT_DEPLOY: 0x28,
  SIGN_SMART_CONTRACT_EXECUTION: 0x30,
  SIGN_CANCEL: 0x38
};

const klay_path = "44'/8217'/0'/0'/0'";
const caver = new Caver();

/**
 * Helium API
 *
 * @param transport a transport for sending commands to a device
 * @param scrambleKey a scramble key
 *
 * @example
 * import Helium from "@ledgerhq/hw-app-helium";
 * const helium = new Helium(transport);
 */
export default class Klaytn {
  private transport: Transport;

  constructor(
    transport: Transport,
    scrambleKey = "klaytn_default_scramble_key"
  ) {
    this.transport = transport;
    this.transport.decorateAppAPIMethods(
      this,
      ["getVersion", "getAddress", "signLegacyTransaction"],
      scrambleKey
    );
  }

  /**
   * Get application version.
   *
   * @returns version object
   *
   * @example
   * helium.getVersion().then(r => r.version)
   */
  async getVersion(): Promise<{ version: string }> {
    const [_, major, minor, patch] = await this.sendToDevice(
      INS.GET_VERSION,
      P1_NON_CONFIRM,
      0,
      Buffer.from([])
    );
    console.log("version:", major, minor, patch);

    return {
      version: `${major}.${minor}.${patch}`,
    };
  }

  /**
   * Get Helium address (public key) for a BIP32 path.
   *
   * @param path a BIP32 path
   * @param display flag to show display
   * @param accountIndex index of account address
   * @returns an object with the address field
   *
   * @example
   * helium.getAddress("44'/904'/0'/0'/0'").then(r => r.address)
   */
  async getAddress(
    path: string,
    display?: boolean,
    accountIndex = 0
  ): Promise<{ address: string; publicKey: string, chainCode: string | undefined }> {
    const pathBuffer = pathToBuffer(path);

    const addressBuffer = await this.sendToDevice(
      INS.GET_ADDR,
      display ? P1_CONFIRM : P1_NON_CONFIRM,
      accountIndex,
      pathBuffer
    );

    const publicKeyLength = addressBuffer[0];
    const addressLength = addressBuffer[1 + publicKeyLength];

    return {
      publicKey: addressBuffer.subarray(1, 1 + publicKeyLength).toString("hex"),
      address:
        "0x" +
        addressBuffer
          .subarray(
            1 + publicKeyLength + 1,
            1 + publicKeyLength + 1 + addressLength
          )
          .toString("ascii"),
      chainCode: accountIndex
        ? addressBuffer
          .subarray(
            1 + publicKeyLength + 1 + addressLength,
            1 + publicKeyLength + 1 + addressLength + 32
          )
          .toString("hex")
        : undefined,
    };
  }

  /**
   * Sign a Helium `PaymentV2` transaction.
   *
   * @param txn a PaymentV2 transaction
   * @param accountIndex index of account address
   *
   * @returns an object with the signed transaction and signature
   *
   * @example
   * import { PaymentV2 } from '@helium/transactions'
   * const txn = new PaymentV2({ ... })
   * helium.signTransaction(txn).then(r => r.signature)
   */
  async signLegacyTransaction(
    txn: LegacyTransaction,
    accountIndex = 0
  ): Promise<{ signature: Buffer; signedTxn: LegacyTransaction }> {

    const { payloads, txType, chainId, chainIdTruncated } = serializeLegacyTransaction(txn, klay_path);
    console.log("payloads =", payloads);

    let response = await this.sendToDevice(
      INS.SIGN_LEGACY,
      P1_FIRST,
      P2_SIGN,
      payloads[0]
    );

    for (let i = 1; i < payloads.length; i++) {
      response = await this.sendToDevice(
        INS.SIGN_LEGACY,
        P1_MORE,
        P2_SIGN,
        payloads[i],
      );
    }

    if (response.length === 1) throw new Error("User has declined.");

    console.log("signature string = 0x", response.toString("hex"))

    const { v, r, s } = serializeSignature(response, chainId, chainIdTruncated, txType);

    let signatureData = new caver.wallet.keyring.signatureData([v, r, s])

    txn.appendSignatures(signatureData)
    let signedRawTx = txn.getRawTransaction();

    console.log("signedRawTx =", signedRawTx);
    console.log("v =", v, "\nr =", r, "\ns =", s);
    console.log("recovered pubk:", caver.klay.accounts.recoverTransaction(signedRawTx));

    return {
      signature: response,
      signedTxn: txn,
    };
  }

  async signValueTransfer(
    txn: ValueTransfer,
    accountIndex = 0
  ): Promise<{ signature: Buffer; signedTxn: ValueTransfer }> {

    const { payloads, txType, chainId, chainIdTruncated } = serializeKlaytnTransaction(txn, klay_path);
    console.log("payloads =", payloads);

    let response = await this.sendToDevice(
      INS.SIGN_VALUE_TRANSFER,
      P1_FIRST,
      P2_SIGN,
      payloads[0]
    );

    for (let i = 1; i < payloads.length; i++) {
      response = await this.sendToDevice(
        INS.SIGN_VALUE_TRANSFER,
        P1_MORE,
        P2_SIGN,
        payloads[i],
      );
    }

    if (response.length === 1) throw new Error("User has declined.");

    console.log("signature string = 0x", response.toString("hex"))

    const { v, r, s } = serializeSignature(response, chainId, chainIdTruncated, txType);

    let signatureData = new caver.wallet.keyring.signatureData([v, r, s])

    txn.appendSignatures(signatureData)
    let signedRawTx = txn.getRawTransaction();

    console.log("signedRawTx =", signedRawTx);
    console.log("v =", v, "\nr =", r, "\ns =", s);
    console.log("recovered pubk:", caver.klay.accounts.recoverTransaction(signedRawTx));

    return {
      signature: response,
      signedTxn: txn,
    };
  }

  async signValueTransferMemo(
    txn: ValueTransferMemo,
    accountIndex = 0
  ): Promise<{ signature: Buffer; signedTxn: ValueTransferMemo }> {

    const { payloads, txType, chainId, chainIdTruncated } = serializeKlaytnTransaction(txn, klay_path);
    console.log("payloads =", payloads);

    let response = await this.sendToDevice(
      INS.SIGN_VALUE_TRANSFER_MEMO,
      P1_FIRST,
      P2_SIGN,
      payloads[0]
    );

    for (let i = 1; i < payloads.length; i++) {
      response = await this.sendToDevice(
        INS.SIGN_VALUE_TRANSFER_MEMO,
        P1_MORE,
        P2_SIGN,
        payloads[i],
      );
    }

    if (response.length === 1) throw new Error("User has declined.");

    console.log("signature string = 0x", response.toString("hex"))

    const { v, r, s } = serializeSignature(response, chainId, chainIdTruncated, txType);

    let signatureData = new caver.wallet.keyring.signatureData([v, r, s])

    txn.appendSignatures(signatureData)
    let signedRawTx = txn.getRawTransaction();

    console.log("signedRawTx =", signedRawTx);
    console.log("v =", v, "\nr =", r, "\ns =", s);
    console.log("recovered pubk:", caver.klay.accounts.recoverTransaction(signedRawTx));

    return {
      signature: response,
      signedTxn: txn,
    };
  }

  async signSmartContractDeploy(
    txn: SmartContractDeploy,
    accountIndex = 0
  ): Promise<{ signature: Buffer; signedTxn: SmartContractDeploy }> {

    const { payloads, txType, chainId, chainIdTruncated } = serializeKlaytnTransaction(txn, klay_path);
    console.log("payloads =", payloads);

    let response = await this.sendToDevice(
      INS.SIGN_SMART_CONTRACT_DEPLOY,
      P1_FIRST,
      P2_SIGN,
      payloads[0]
    );

    for (let i = 1; i < payloads.length; i++) {
      response = await this.sendToDevice(
        INS.SIGN_SMART_CONTRACT_DEPLOY,
        P1_MORE,
        P2_SIGN,
        payloads[i],
      );
    }

    if (response.length === 1) throw new Error("User has declined.");

    console.log("signature string = 0x", response.toString("hex"))

    const { v, r, s } = serializeSignature(response, chainId, chainIdTruncated, txType);

    let signatureData = new caver.wallet.keyring.signatureData([v, r, s])

    txn.appendSignatures(signatureData)
    let signedRawTx = txn.getRawTransaction();

    console.log("signedRawTx =", signedRawTx);
    console.log("v =", v, "\nr =", r, "\ns =", s);
    console.log("recovered pubk:", caver.klay.accounts.recoverTransaction(signedRawTx));

    return {
      signature: response,
      signedTxn: txn,
    };
  }

  async signSmartContractExecution(
    txn: SmartContractExecution,
    accountIndex = 0
  ): Promise<{ signature: Buffer; signedTxn: SmartContractExecution }> {

    const { payloads, txType, chainId, chainIdTruncated } = serializeKlaytnTransaction(txn, klay_path);
    console.log("payloads =", payloads);

    let response = await this.sendToDevice(
      INS.SIGN_SMART_CONTRACT_EXECUTION,
      P1_FIRST,
      P2_SIGN,
      payloads[0]
    );

    for (let i = 1; i < payloads.length; i++) {
      response = await this.sendToDevice(
        INS.SIGN_SMART_CONTRACT_EXECUTION,
        P1_MORE,
        P2_SIGN,
        payloads[i],
      );
    }

    if (response.length === 1) throw new Error("User has declined.");

    console.log("signature string = 0x", response.toString("hex"))

    const { v, r, s } = serializeSignature(response, chainId, chainIdTruncated, txType);

    let signatureData = new caver.wallet.keyring.signatureData([v, r, s])

    txn.appendSignatures(signatureData)
    let signedRawTx = txn.getRawTransaction();

    console.log("signedRawTx =", signedRawTx);
    console.log("v =", v, "\nr =", r, "\ns =", s);
    console.log("recovered pubk:", caver.klay.accounts.recoverTransaction(signedRawTx));

    return {
      signature: response,
      signedTxn: txn,
    };
  }

  async signCancel(
    txn: Cancel,
    accountIndex = 0
  ): Promise<{ signature: Buffer; signedTxn: Cancel }> {

    const { payloads, txType, chainId, chainIdTruncated } = serializeKlaytnTransaction(txn, klay_path);
    console.log("payloads =", payloads);

    let response = await this.sendToDevice(
      INS.SIGN_CANCEL,
      P1_FIRST,
      P2_SIGN,
      payloads[0]
    );

    for (let i = 1; i < payloads.length; i++) {
      response = await this.sendToDevice(
        INS.SIGN_CANCEL,
        P1_MORE,
        P2_SIGN,
        payloads[i],
      );
    }

    if (response.length === 1) throw new Error("User has declined.");

    console.log("signature string = 0x", response.toString("hex"))

    const { v, r, s } = serializeSignature(response, chainId, chainIdTruncated, txType);

    let signatureData = new caver.wallet.keyring.signatureData([v, r, s])

    txn.appendSignatures(signatureData)
    let signedRawTx = txn.getRawTransaction();

    console.log("signedRawTx =", signedRawTx);
    console.log("v =", v, "\nr =", r, "\ns =", s);
    console.log("recovered pubk:", caver.klay.accounts.recoverTransaction(signedRawTx));

    return {
      signature: response,
      signedTxn: txn,
    };
  }

  private async sendToDevice(
    instruction: number,
    p1: number,
    p2: number = 0x00,
    payload: Buffer
  ) {
    const acceptStatusList = [StatusCodes.OK];
    const reply = await this.transport.send(
      LEDGER_CLA,
      instruction,
      p1,
      p2,
      payload,
      acceptStatusList
    );

    this.throwOnFailure(reply);

    return reply.subarray(0, reply.length - 2);
  }

  private throwOnFailure(reply: Buffer) {
    // transport makes sure reply has a valid length
    const status = reply.readUInt16BE(reply.length - 2);

    switch (status) {
      default:
        return;
    }
  }
}
