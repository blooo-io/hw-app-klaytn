import {
  openTransportReplayer,
  RecordStore,
} from "@ledgerhq/hw-transport-mocker";
import Klaytn from "../src/Klaytn";
import { listen } from "@ledgerhq/logs";
import Caver, { LegacyTransaction } from "caver-js";

listen((log) => console.log(log));

test("getVersion", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
            => e006000000
            <= 0e010a029000
        `)
  );
  const klaytn = new Klaytn(transport);
  console.log("getVersion");
  const result = await klaytn.getVersion();
  expect(result).toEqual({
    version: "1.10.2",
  });
});

const caver = new Caver();
const bobB58 = "13M8dUbxymE3xtiAXszRkGMmezMhBS8Li7wEsMojLdb4Sdxc4wc";
const aliceB58 = "148d8KTRcKA5JKPekBcKFd4KfvprvFRpjGtivhtmRmnZ8MFYnP3";
const susanB58 = "139Qksd9iF2UBoV4tckS3z4Dw5135t5bKdQ8gubmD2a27AQpdfC";

const DERIVATION = "44'/8217'/0'/0'/0'";

test("getAddress without display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e002000015058000002c80002019800000008000000080000000
        <= 41042b3a9c2bcd329eb3bcbc40e3bba8b87234c1b34fa81b252361db15f290f70e39374f0e52870e588b25b992d7304d5e8c1f5ccf01b7dc67b8d3503c120ff1227128363639346434363762343139623336666237313945383531634436356435343230354466373535359000
    `)
  );
  const klaytn = new Klaytn(transport);
  console.log("getAddress");
  const { address } = await klaytn.getAddress(DERIVATION, false);
  expect(address).toEqual(
    "0x6694d467b419b36fb719E851cD65d54205Df7555"
  );
});

test("getAddress with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e002010015058000002c80002019800000008000000080000000
        <= 41042b3a9c2bcd329eb3bcbc40e3bba8b87234c1b34fa81b252361db15f290f70e39374f0e52870e588b25b992d7304d5e8c1f5ccf01b7dc67b8d3503c120ff1227128363639346434363762343139623336666237313945383531634436356435343230354466373535359000
    `)
  );
  const klaytn = new Klaytn(transport);
  console.log("getAddress");
  const { address } = await klaytn.getAddress(DERIVATION, true);
  console.log("ADDRESS = ", address);
  expect(address).toEqual(
    "0x6694d467b419b36fb719E851cD65d54205Df7555"
  );
});

test("signLegacyTransaction with display", async () => {
  // => e004000023e2198203e8830493e09418e9ee49ee911f2c49b7b6efa5d2607e4f46c0b51580018080
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e00400003d058000002c80002019800000008000000080000000e719850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01808220198080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: LegacyTransaction = caver.transaction.legacyTransaction.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: 8217,
  });

  console.log("signLegacyTransaction");
  console.log(txnToSign);
  console.log("RLP Encoding:", txnToSign.getRLPEncoding())
  console.log("RLP For Sig: ", txnToSign.getRLPEncodingForSignature())

  const { signature, signedTxn } = await klaytn.signLegacyTransaction(txnToSign);

  const expectedSig = "56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a3";
  let signedRawTx = signedTxn.getRawTransaction();
  const recoveredTx = caver.klay.accounts.recoverTransaction(signedRawTx)

  expect(recoveredTx).toEqual("0x6694d467b419b36fb719E851cD65d54205Df7555")
  expect(signedTxn.value).toBe('0x1');
  expect(signedTxn.nonce).toBe("0x19");
  expect(signedTxn.gas).toBe("0x493e0");
  expect(signedTxn.gasPrice).toBe("0xba43b7400");
  expect(signature.toString("hex")).toEqual(expectedSig);
  expect(Buffer.from(signature as Uint8Array).toString("hex")).toBe(
    expectedSig
  );
});
