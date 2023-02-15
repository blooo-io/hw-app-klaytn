import BigNumber from "bignumber.js";
import BIPPath from "bip32-path";
import Caver, { LegacyTransaction } from "caver-js";
import { decodeFromRawTransaction } from 'caver-js/packages/caver-klay/caver-klay-accounts/src/makeRawTransaction'
import { encode, decode } from "@ethersproject/rlp";

const caver = new Caver();

const serializePath = (path: number[]): Buffer => {
  const buf = Buffer.alloc(1 + path.length * 4);
  buf.writeUInt8(path.length, 0);
  for (const [i, num] of path.entries()) {
    buf.writeUInt32BE(num, 1 + i * 4);
  }
  return buf;
};

function decodeTxInfo(rawTx: Buffer) {
  const VALID_TYPES = [1, 2];
  const txType = VALID_TYPES.includes(rawTx[0]) ? rawTx[0] : null;
  const rlpData = txType === null ? rawTx : rawTx.slice(1);
  const rlpTx = decode(rlpData).map((hex) => Buffer.from(hex.slice(2), "hex"));
  let chainIdTruncated = 0;
  const rlpDecoded = decode(rlpData);

  let decodedTx;
  if (txType === 2) {
    console.log("EIP1559 txType")
    // EIP1559
    decodedTx = {
      data: rlpDecoded[7],
      to: rlpDecoded[5],
      chainId: rlpTx[0],
    };
  } else if (txType === 1) {
    console.log("EIP2930 txType");
    // EIP2930
    decodedTx = {
      data: rlpDecoded[6],
      to: rlpDecoded[4],
      chainId: rlpTx[0],
    };
  } else {
    console.log("Legacy txType");
    // Legacy tx
    decodedTx = {
      data: rlpDecoded[5],
      to: rlpDecoded[3],
      // Default to 1 for non EIP 155 txs
      chainId: rlpTx.length > 6 ? rlpTx[6] : Buffer.from("0x01", "hex"),
    };
  }

  const chainIdSrc = decodedTx.chainId;
  let chainId = new BigNumber(0);
  if (chainIdSrc) {
    // Using BigNumber because chainID could be any uint256.
    chainId = new BigNumber(chainIdSrc.toString("hex"), 16);
    const chainIdTruncatedBuf = Buffer.alloc(4);
    if (chainIdSrc.length > 4) {
      chainIdSrc.copy(chainIdTruncatedBuf);
    } else {
      chainIdSrc.copy(chainIdTruncatedBuf, 4 - chainIdSrc.length);
    }
    chainIdTruncated = chainIdTruncatedBuf.readUInt32BE(0);
  }

  let vrsOffset = 0;
  if (txType === null && rlpTx.length > 6) {
    const rlpVrs = Buffer.from(encode(rlpTx.slice(-3)).slice(2), "hex");

    vrsOffset = rawTx.length - (rlpVrs.length - 1);

    // First byte > 0xf7 means the length of the list length doesn't fit in a single byte.
    if (rlpVrs[0] > 0xf7) {
      // Increment vrsOffset to account for that extra byte.
      vrsOffset++;

      // Compute size of the list length.
      const sizeOfListLen = rlpVrs[0] - 0xf7;

      // Increase rlpOffset by the size of the list length.
      vrsOffset += sizeOfListLen - 1;
    }
  }

  return {
    decodedTx,
    txType,
    chainId,
    chainIdTruncated,
    vrsOffset,
  };
}


export const splitPath = (path: string): number[] => {
  const result: number[] = [];
  const components = path.split("/");
  components.forEach((element) => {
    let number = parseInt(element, 10);
    if (isNaN(number)) {
      return; // FIXME shouldn't it throws instead?
    }
    if (element.length > 1 && element[element.length - 1] === "'") {
      number += 0x80000000;
    }
    result.push(number);
  });
  return result;
}

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

export const serializeLegacyTransaction = (txn: LegacyTransaction, path: string): { 
  payloads: Buffer[],
  txType: number | null,
  chainId: BigNumber,
  chainIdTruncated: number
} => {
  const rawTxHex = txn.getRLPEncodingForSignature();
  console.log("rawTxHex =", rawTxHex)
  const rawTx = Buffer.from(rawTxHex.slice(2), "hex")
  console.log("rawTx =", rawTx)
  console.log("DECODED TRANSACTION", decodeFromRawTransaction(rawTxHex))

  const { vrsOffset, txType, chainId, chainIdTruncated } = decodeTxInfo(
    rawTx
  );

  const paths = splitPath(path);
  let offset = 0;

  const payloads: Buffer[] = [];
  while (offset !== rawTx.length) {
    console.log("offset =", offset)
    console.log("rawTx.length =", rawTx.length)
    const first = offset === 0;
    const maxChunkSize = first ? 150 - 1 - paths.length * 4 : 150;
    let chunkSize =
      offset + maxChunkSize > rawTx.length
        ? rawTx.length - offset
        : maxChunkSize;

    if (vrsOffset != 0 && offset + chunkSize >= vrsOffset) {
      // Make sure that the chunk doesn't end right on the EIP 155 marker if set
      chunkSize = rawTx.length - offset;
    }

    const buffer = Buffer.alloc(
      first ? 1 + paths.length * 4 + chunkSize : chunkSize
    );

    if (first) {
      buffer[0] = paths.length;
      paths.forEach((element, index) => {
        buffer.writeUInt32BE(element, 1 + 4 * index);
      });
      rawTx.copy(buffer, 1 + 4 * paths.length, offset, offset + chunkSize);
    } else {
      rawTx.copy(buffer, 0, offset, offset + chunkSize);
    }
    payloads.push(buffer);
    offset += chunkSize;
  }

  return {payloads, txType, chainId, chainIdTruncated};
};