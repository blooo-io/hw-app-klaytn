import Transport from "@ledgerhq/hw-transport";
import { StatusCodes } from "@ledgerhq/errors";
import Address from "@helium/address";
import { pathToBuffer, serializeLegacyTransaction } from "./serialization";
import Caver, { LegacyTransaction, SignatureData } from "caver-js";

const P1_NON_CONFIRM = 0x00;
const P1_CONFIRM = 0x01;

const LEDGER_CLA = 0xe0;
const CLA_OFFSET = 0x00;

const INS = {
  GET_VERSION: 0x01,
  GET_ADDR: 0x02,
  SIGN_LEGACY_TRANSACTION: 0x04,
};

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
    const [major, minor, patch] = await this.sendToDevice(
      INS.GET_VERSION,
      P1_NON_CONFIRM,
      0,
      Buffer.from([])
    );
      console.log(major,minor,patch);
      
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
      publicKey: addressBuffer.slice(1, 1 + publicKeyLength).toString("hex"),
      address:
        "0x" +
        addressBuffer
          .slice(
            1 + publicKeyLength + 1,
            1 + publicKeyLength + 1 + addressLength
          )
          .toString("ascii"),
      chainCode: accountIndex
        ? addressBuffer
            .slice(
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
  ): Promise<{ signature: Buffer; txn: LegacyTransaction }> {
    const payload = serializeLegacyTransaction(txn);

    const response = await this.sendToDevice(
      INS.SIGN_LEGACY_TRANSACTION,
      accountIndex,
      CLA_OFFSET,
      payload
    );

    if (response.length === 1) throw "User has declined.";

    console.log("RESPONSE: ", response);
    console.log("LENGTH: ", response.length);
    // const responseDecoded = Caver.abi.
    const responseHex = Caver.utils.bufferToHex(response);
    console.log("GUI: ", responseHex);
    console.log("GUI LENGTH: ", responseHex.length);

    const signature = response;
    // txn.signatures = new SignatureData(signature);

    return {
      signature,
      txn,
    };
  }

  private async sendToDevice(
    instruction: number,
    p1: number,
    p2 = 0x00,
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

    return reply.slice(0, reply.length - 2);
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
