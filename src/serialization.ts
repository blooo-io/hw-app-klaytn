import BigNumber from "bignumber.js";
import BIPPath from "bip32-path";
import { LegacyTransaction } from "caver-js";
import Caver from "caver-js";

const caver = new Caver();

const serializePath = (path: number[]): Buffer => {
  const buf = Buffer.alloc(1 + path.length * 4);
  buf.writeUInt8(path.length, 0);
  for (const [i, num] of path.entries()) {
    buf.writeUInt32BE(num, 1 + i * 4);
  }
  return buf;
};

export const pathToBuffer = (originalPath: string): Buffer => {
  const path = originalPath
    .split("/")
    .map((value) =>
      value.endsWith("'") || value.endsWith("h") ? value : value + "'"
    )
    .join("/");
  const pathNums: number[] = BIPPath.fromString(path).toPathArray();
  return serializePath(pathNums);
};

const serializeNumber = (amount: number | BigNumber | undefined): Buffer => {
  let hex = new BigNumber(amount ?? 0).toString(16);
  hex = hex.length % 2 ? `0${hex}` : hex;
  const len = Math.floor(hex.length / 2);
  if (len > 8) throw "Invalid transaction.";
  const u8 = new Uint8Array(8);
  for (let i = 0; i < len; i += 1)
    u8[len - i - 1] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return Buffer.from(u8);
};

export const serializeLegacyTransaction = (txn: LegacyTransaction): Buffer => {

  const txSerialized = Buffer.concat([
    serializeNumber(parseInt(txn.nonce)),
    serializeNumber(parseInt(txn.gasPrice)),
    serializeNumber(parseInt(txn.gas)),
    serializeNumber(parseInt(txn.value)),
    caver.utils.toBuffer(txn.to),
    Buffer.from([1001]),
  ]);

  return Buffer.from(txSerialized);
};