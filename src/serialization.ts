import BigNumber from "bignumber.js";
import BIPPath from "bip32-path";
import Caver, {
  AbstractTransaction,
  LegacyTransaction,
  ValueTransfer,
  ValueTransferMemo,
} from "caver-js";
import { encode, decode } from "@ethersproject/rlp";

const MAX_CHUNK_SIZE = 255;

const caver = new Caver();

const serializePath = (path: number[]): Buffer => {
  const buf = Buffer.alloc(1 + path.length * 4);
  buf.writeUInt8(path.length, 0);
  for (const [i, num] of path.entries()) {
    buf.writeUInt32BE(num, 1 + i * 4);
  }
  return buf;
};
function doesStringIncludeAnyValueInArray(
  string: string,
  array: string[]
): boolean {
  return array.some((v) => string.includes(v));
}

function decodeTxInfo(rawTx: Buffer, txType: string) {
  const rlpData = rawTx;
  const rlpTx = decode(rlpData).map((hex) => Buffer.from(hex.slice(2), "hex"));
  let chainIdTruncated = 0;
  const rlpDecoded = decode(rlpData);

  let decodedChainId;
  const TRANSACTION_TYPES = [
    "ValueTransfer",
    "ValueTransferMemo",
    "SmartContractDeploy",
    "SmartContractExecution",
    "Cancel",
    "FeeDelegatedValueTransfer",
  ];

  if (doesStringIncludeAnyValueInArray(txType, TRANSACTION_TYPES)) {
    decodedChainId = rlpTx[1];
  } else {
    decodedChainId = rlpTx.length > 6 ? rlpTx[6] : Buffer.from("0x01", "hex");
  }
  const chainIdSrc = decodedChainId;
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
  if (rlpTx.length > 6) {
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
    txType,
    chainId,
    chainIdTruncated,
    vrsOffset,
  };
}

export const serializeSignature = (
  signature: Buffer,
  chainId: BigNumber,
  chainIdTruncated: number,
  txType: string | null
): { v: string; r: string; s: string } => {
  const response_byte: number = signature[0];
  const oneByteChainId = (chainIdTruncated * 2 + 35) % 256;
  const ecc_parity = Math.abs(response_byte - oneByteChainId);
  let v = chainId.times(2).plus(35).plus(ecc_parity).toString(16);

  // Make sure v has is prefixed with a 0 if its length is odd ("1" -> "01").
  if (v.length % 2 == 1) {
    v = "0" + v;
  }
  const r = signature.subarray(1, 1 + 32).toString("hex");
  const s = signature.subarray(1 + 32, 1 + 32 + 32).toString("hex");

  return { v, r, s };
};

export const splitPath = (path: string): number[] => {
  const result: number[] = [];
  const components = path.split("/");
  components.forEach((element) => {
    let number = parseInt(element, 10);
    if (isNaN(number)) {
      return;
    }
    if (element.length > 1 && element[element.length - 1] === "'") {
      number += 0x80000000;
    }
    result.push(number);
  });
  return result;
};

export const pathToBuffer = (originalPath: string): Buffer => {
  const path = originalPath;
  const pathNums: number[] = BIPPath.fromString(path).toPathArray();
  return serializePath(pathNums);
};

const serializeNumber = (amount: number | BigNumber | undefined): Buffer => {
  let hex = new BigNumber(amount ?? 0).toString(16);
  hex = hex.length % 2 ? `0${hex}` : hex;
  const len = Math.floor(hex.length / 2);
  if (len > 8) throw new Error("Invalid transaction.");
  const u8 = new Uint8Array(8);
  for (let i = 0; i < len; i += 1)
    u8[len - i - 1] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return Buffer.from(u8);
};

const serializeTransactionPayloads = (
  path: string,
  rawTx: Buffer,
  vrsOffset: number
): Buffer[] => {
  const paths = splitPath(path);
  let offset = 0;
  const payloads: Buffer[] = [];
  let buffer = Buffer.alloc(
        1 + paths.length * 4
      );
  buffer[0] = paths.length;
  paths.forEach((element, index) => {
    buffer.writeUInt32BE(element, 1 + 4 * index);
  });
  payloads.push(buffer);
  while(offset !== rawTx.length) {
    const first = offset === 0;
    let chunkSize =
      offset + MAX_CHUNK_SIZE > rawTx.length
        ? rawTx.length - offset
        : MAX_CHUNK_SIZE;

    if (vrsOffset != 0 && offset + chunkSize >= vrsOffset) {
      // Make sure that the chunk doesn't end right on the EIP 155 marker if set
      chunkSize = rawTx.length - offset;
    }

    const buffer = Buffer.alloc(
      chunkSize
    );

    rawTx.copy(buffer, 0, offset, offset + chunkSize);

    payloads.push(buffer);
    offset += chunkSize;
  }
  return payloads;
};

export const serializeLegacyTransaction = (
  txn: LegacyTransaction | ValueTransfer,
  path: string
): {
  payloads: Buffer[];
  txType: string | null;
  chainId: BigNumber;
  chainIdTruncated: number;
} => {
  const rawTxHex = txn.getRLPEncodingForSignature();
  const rawTx = Buffer.from(rawTxHex.slice(2), "hex");

  const { vrsOffset, txType, chainId, chainIdTruncated } = decodeTxInfo(
    rawTx,
    txn.type
  );

  const payloads = serializeTransactionPayloads(path, rawTx, vrsOffset);

  return { payloads, txType, chainId, chainIdTruncated };
};

export const serializeKlaytnTransaction = (
  txn: AbstractTransaction,
  path: string
): {
  payloads: Buffer[];
  txType: string | null;
  chainId: BigNumber;
  chainIdTruncated: number;
} => {

  const rlpSig = txn.getRLPEncodingForSignature();

  const rawTx = Buffer.from(rlpSig.slice(2), "hex");

  const { vrsOffset, txType, chainId, chainIdTruncated } = decodeTxInfo(
    rawTx,
    txn.type
  );
  const payloads = serializeTransactionPayloads(path, rawTx, vrsOffset);

  return { payloads, txType, chainId, chainIdTruncated };
};
