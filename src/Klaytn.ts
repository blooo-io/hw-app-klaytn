import Transport from "@ledgerhq/hw-transport";
import { StatusCodes } from "@ledgerhq/errors";
import { pathToBuffer, serializeLegacyTransaction } from "./serialization";
import Caver, { LegacyTransaction } from "caver-js";

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
  SIGN_LEGACY_TRANSACTION: 0x04,
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
    const [ _, major, minor, patch] = await this.sendToDevice(
      INS.GET_VERSION,
      P1_NON_CONFIRM,
      0,
      Buffer.from([])
    );
      console.log("version:", major,minor,patch);
      
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

    const {payloads, txType, chainId, chainIdTruncated} = serializeLegacyTransaction(txn, klay_path);
    console.log("payloads =", payloads);

    let response = await this.sendToDevice(
      INS.SIGN_LEGACY_TRANSACTION,
      P1_FIRST,
      P2_SIGN,
      payloads[0]
    );
  
    for(let i=1; i<payloads.length; i++){
      response = await this.sendToDevice(
        INS.SIGN_LEGACY_TRANSACTION,
        P1_MORE,
        P2_SIGN,
        payloads[i],
      );
    }
    
    if (response.length === 1) throw new Error("User has declined.");

    const signature = response;
    const signatureStr: string = "0x" + response.toString("hex");
    console.log("signature string = ", signatureStr)

    const response_byte: number = response[0];
    let v = "";
    if (chainId.times(2).plus(35).plus(1).gt(255)) {
      const oneByteChainId = (chainIdTruncated * 2 + 35) % 256;

      const ecc_parity = Math.abs(response_byte - oneByteChainId);
      if (txType != null) {
        // For EIP2930 and EIP1559 tx, v is simply the parity.
        v = ecc_parity % 2 == 1 ? "00" : "01";
      } else {
        // Legacy type transaction with a big chain ID
        v = chainId.times(2).plus(35).plus(ecc_parity).toString(16);
      }
    } else {
      v = response_byte.toString(16);
    }
    // Make sure v has is prefixed with a 0 if its length is odd ("1" -> "01").
    if (v.length % 2 == 1) {
      v = "0" + v;
    }

    const r = response.subarray(1, 1 + 32).toString("hex");
    const s = response.subarray(1 + 32, 1 + 32 + 32).toString("hex");

    let signatureData = new caver.wallet.keyring.signatureData([v, r, s])

    txn.appendSignatures(signatureData)
    let signedRawTx = txn.getRawTransaction();

    console.log("signedRawTx =", signedRawTx);
    console.log("v =", v, "\nr =", r, "\ns =", s);
    console.log("recovered pubk:", caver.klay.accounts.recoverTransaction(signedRawTx));

    return {
      signature,
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
