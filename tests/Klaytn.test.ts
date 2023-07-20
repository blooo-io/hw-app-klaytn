import {
  openTransportReplayer,
  RecordStore,
} from "@ledgerhq/hw-transport-mocker";
import Klaytn from "../src/Klaytn";
import { listen } from "@ledgerhq/logs";
import Caver, { Cancel, LegacyTransaction, SmartContractDeploy, SmartContractExecution, ValueTransfer, ValueTransferMemo } from "caver-js";

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

test("signValueTransfer with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e008000053058000002c8000201980000000800000008000000008f83b19850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946694d467b419b36fb719e851cd65d54205df7555c4c3018080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: ValueTransfer = caver.transaction.valueTransfer.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: 8217,
  });

  console.log("signValueTransfer");
  console.log("RLP For Sig: ", txnToSign.getRLPEncodingForSignature())

  const { signature, signedTxn } = await klaytn.signValueTransfer(txnToSign);

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

test("signValueTransferMemo with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e010000059058000002c8000201980000000800000008000000010f84119850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946694d467b419b36fb719e851cd65d54205df75558568656c6c6fc4c3018080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: ValueTransferMemo = caver.transaction.valueTransferMemo.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: 8217,
    input: "0x68656c6c6f" // hello
  });

  console.log("signValueTransferMemo");
  console.log("RLP For Sig: ", txnToSign.getRLPEncodingForSignature())

  const { signature, signedTxn } = await klaytn.signValueTransferMemo(txnToSign);

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

test("signSmartContractDeploy with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e028000046058000002c8000201980000000800000008000000028ef19850ba43b7400830493e08080946694d467b419b36fb719e851cd65d54205df75558568656c6c6f8080c4c3018080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: SmartContractDeploy = caver.transaction.smartContractDeploy.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: 8217,
    input: "0x68656c6c6f" // short input
    // real input from https://scope.klaytn.com/tx/0x19b7bad2be2963cba792154e5394cdc545f68ffbf883c25cdd78e96b4a64bf4f?tabId=rawData
    // input: "0x6080604052600560005534801561001557600080fd5b5060405161029c38038061029c8339818101604052810190610037919061007f565b80600081905550506100ac565b600080fd5b6000819050919050565b61005c81610049565b811461006757600080fd5b50565b60008151905061007981610053565b92915050565b60006020828403121561009557610094610044565b5b60006100a38482850161006a565b91505092915050565b6101e1806100bb6000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80630dbe671f14610046578063d732d95514610064578063e8927fbc1461006e575b600080fd5b61004e610078565b60405161005b91906100d7565b60405180910390f35b61006c61007e565b005b6100766100a3565b005b60005481565b60008054146100a15760016000808282546100999190610121565b925050819055505b565b60016000808282546100b59190610155565b92505081905550565b6000819050919050565b6100d1816100be565b82525050565b60006020820190506100ec60008301846100c8565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b600061012c826100be565b9150610137836100be565b92508282101561014a576101496100f2565b5b828203905092915050565b6000610160826100be565b915061016b836100be565b9250827fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff038211156101a05761019f6100f2565b5b82820190509291505056fea264697066735822122011473ea0fe0dcd65952f4315de5458369b91cb3a2f53790f0906775227a6070c64736f6c634300080f00330000000000000000000000000000000000000000000000000000000000000001"
  });

  console.log("signSmartContractDeploy");
  console.log("RLP For Sig: ", txnToSign.getRLPEncodingForSignature())

  const { signature, signedTxn } = await klaytn.signSmartContractDeploy(txnToSign);

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

test("signSmartContractExecution with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e030000059058000002c8000201980000000800000008000000030f84119850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946694d467b419b36fb719e851cd65d54205df75558568656c6c6fc4c3018080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: SmartContractExecution = caver.transaction.smartContractExecution.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: 8217,
    input: "0x68656c6c6f" // short input
    // real input from https://scope.klaytn.com/tx/0x0d9d3b79bd450c073e442776b5cc4ae2144c2b7065990c1e31dfcbe786bdc389?tabId=rawData
    // input: "0x095ea7b3000000000000000000000000f50782a24afcb26acb85d086cf892bfffb5731b5ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  });

  console.log("signSmartContractExecution");
  console.log("RLP For Sig: ", txnToSign.getRLPEncodingForSignature())

  const { signature, signedTxn } = await klaytn.signSmartContractExecution(txnToSign);

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

test("signCancel with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e03800003c058000002c8000201980000000800000008000000038e519850ba43b7400830493e0946694d467b419b36fb719e851cd65d54205df7555c4c3018080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: Cancel = caver.transaction.cancel.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: 8217
  });

  console.log("signCancel");
  console.log("RLP For Sig: ", txnToSign.getRLPEncodingForSignature())

  const { signature, signedTxn } = await klaytn.signCancel(txnToSign);

  const expectedSig = "56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a3";
  let signedRawTx = signedTxn.getRawTransaction();
  const recoveredTx = caver.klay.accounts.recoverTransaction(signedRawTx)

  expect(recoveredTx).toEqual("0x6694d467b419b36fb719E851cD65d54205Df7555")
  expect(signedTxn.nonce).toBe("0x19");
  expect(signedTxn.gas).toBe("0x493e0");
  expect(signedTxn.gasPrice).toBe("0xba43b7400");
  expect(signature.toString("hex")).toEqual(expectedSig);
  expect(Buffer.from(signature as Uint8Array).toString("hex")).toBe(
    expectedSig
  );
});