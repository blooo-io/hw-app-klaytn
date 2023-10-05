import {
  openTransportReplayer,
  RecordStore,
} from "@ledgerhq/hw-transport-mocker";
import Klaytn from "../src/Klaytn";
import { listen } from "@ledgerhq/logs";
import Caver, { AbstractTransaction, Cancel, FeeDelegatedCancel, FeeDelegatedCancelWithRatio, FeeDelegatedSmartContractDeploy, FeeDelegatedSmartContractDeployWithRatio, FeeDelegatedSmartContractExecution, FeeDelegatedSmartContractExecutionWithRatio, FeeDelegatedValueTransfer, FeeDelegatedValueTransferMemo, FeeDelegatedValueTransferMemoWithRatio, FeeDelegatedValueTransferWithRatio, LegacyTransaction, SmartContractDeploy, SmartContractExecution, ValueTransfer, ValueTransferMemo } from "caver-js";
import { PrivateKey } from "caver-js/types/packages/caver-wallet/src/keyring/privateKey";

listen((log) => console.log(log));

const caver = new Caver();

const DERIVATION = "44'/8217'/0'/0/0";


// Address & key derived with default speculos seed
// Use for test purpose only
const speculosAddress = "0x6E93a3ACfbaDF457F29fb0E57FA42274004c32EA";
const speculosPrivateKey = "0xba988b41f30ab65c5b8df817aa27468292d089db601892b01bccf0028d0d95bb";


const checkSignatureAndAddressMatch = (signedTxn: AbstractTransaction, expectedAddress: string) => {
  let signedRawTx = signedTxn.getRawTransaction();
  const recoveredPubkey = caver.transaction.recoverPublicKeys(signedRawTx);
  const recoveredAddress = caver.utils.publicKeyToAddress(recoveredPubkey[0]);
  expect(recoveredAddress).toEqual(expectedAddress)
}

test("getVersion", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
            => e001000000
            <= 000103019000
        `)
  );
  const klaytn = new Klaytn(transport);
  console.log("getVersion");
  const result = await klaytn.getVersion();
  expect(result).toEqual({
    version: "1.3.1",
  });
});

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

// TODO: CHANGE PATH
test("getAddress with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e002010015058000002c80002019800000000000000000000000
        <= 4104ccbe0eb58bf9ce0e90185de44d91a20902f334ac352e8545e4cbaaf5e3e610d7235f4afb02aaa8cd4bc44a3d80270adacd3b0ea9d48640a6be5d2a0f52d29c0528323043433334356565413746333036633332366435376142444162343434353533326533643465619000
    `)
  );
  const klaytn = new Klaytn(transport);
  console.log("getAddress");
  const { address } = await klaytn.getAddress(DERIVATION, true);
  console.log("ADDRESS = ", address);
  expect(address).toEqual(
    "0x20CC345eeA7F306c326d57aBDAb4445532e3d4ea"
  );
});

test("signLegacyTransaction with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e00400003d058000002c80002019800000000000000000000000e719850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01808220198080
        <= 55c96aaee6a7858c398d5eb7d5ff79438e3c869705e9467d9d4efca35cd25d91fe35dc83a0ca6655ba9bc7bf7acf6cca29963a3a146a7ab6d543ac544b8419beff9000
    `) //  56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: LegacyTransaction = caver.transaction.legacyTransaction.create({
    from: speculosAddress,
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

  checkSignatureAndAddressMatch(signedTxn, speculosAddress)
});

test("sign ValueTransfer with caver", async () => {
  const txnToSign: ValueTransfer = caver.transaction.valueTransfer.create({
    from: speculosAddress,
    to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: 8217,
  });

  const keyring = caver.wallet.keyring.create(speculosAddress, speculosPrivateKey)
  keyring.getPublicKey()
  console.log("BEFORE SIGN", txnToSign.signatures)
  await txnToSign.sign(keyring)
  console.log("AFTER SIGN", txnToSign.signatures)
})

test("signValueTransfer with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e008000056058000002c80002019800000000000000000000000f83fb838f70819850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946e93a3acfbadf457f29fb0e57fa42274004c32ea8220198080
        <= 555233b91400839ef3b8c7ee6cd7e6197c0a61a0c7a185ea23d2e247241c13aca713478dfe40dab520074930f1ba92d1723bf16c45754a3cf0632450dfeab3c3089000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: ValueTransfer = caver.transaction.valueTransfer.create({
    from: speculosAddress,
    to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: 8217,
  });

  console.log("signValueTransfer");

  const { signature, signedTxn } = await klaytn.signValueTransfer(txnToSign);

  checkSignatureAndAddressMatch(signedTxn, speculosAddress)
});

test("signValueTransferMemo with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e01000005d058000002c80002019800000000000000000000000f846b83ff83d1019850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946e93a3acfbadf457f29fb0e57fa42274004c32ea8568656c6c6f8220198080
        <= 559d244499242cddc7e216701e9de17b54b68185925aebdc7e408c0a5065063fcd53fb93ca8d60b44c71574cb9887d259be88b998b7e6840ae63c006de424a6caf9000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: ValueTransferMemo = caver.transaction.valueTransferMemo.create({
    from: speculosAddress,
    to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: 8217,
    input: "0x68656c6c6f" // hello
  });

  console.log("signValueTransferMemo");

  const { signature, signedTxn } = await klaytn.signValueTransferMemo(txnToSign);

  checkSignatureAndAddressMatch(signedTxn, speculosAddress)
});

test("signSmartContractDeploy with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e028000048058000002c80002019800000000000000000000000f2aceb2819850ba43b7400830493e08001946e93a3acfbadf457f29fb0e57fa42274004c32ea8568656c6c6f80808220198080
        <= 56c7f342d80909caca49a10b6f7456877e7bafa3801389329e31f17e1a07360aef53d1977fdf2a74bd18842543a17b7efa5b0dd6ef62dd1ae6d3c234dd5ec0afe59000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: SmartContractDeploy = caver.transaction.smartContractDeploy.create({
    from: speculosAddress,
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

  checkSignatureAndAddressMatch(signedTxn, speculosAddress)
});

test("signSmartContractExecution with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e03000005d058000002c80002019800000008000000080000000f846b83ff83d3019850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946694d467b419b36fb719e851cd65d54205df75558568656c6c6f8220198080
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
        => e03800003e058000002c80002019800000008000000080000000e8a2e13819850ba43b7400830493e0946694d467b419b36fb719e851cd65d54205df75558220198080
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

test("signFeeDelegatedValueTransfer with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e008010056058000002c80002019800000008000000080000000f83fb838f70919850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946694d467b419b36fb719e851cd65d54205df75558220198080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: FeeDelegatedValueTransfer = caver.transaction.feeDelegatedValueTransfer.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: 8217,
  });

  console.log("signFeeDelegatedValueTransfer");
  // console.log("RLP For Sig: ", txnToSign.getRLPEncodingForSignature())

  const { signature, signedTxn } = await klaytn.signFeeDelegatedValueTransfer(txnToSign);

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

test("signFeeDelegatedValueTransferMemo with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e01001005d058000002c80002019800000008000000080000000f846b83ff83d1119850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946694d467b419b36fb719e851cd65d54205df75558568656c6c6f8220198080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: FeeDelegatedValueTransferMemo = caver.transaction.feeDelegatedValueTransferMemo.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: 8217,
    input: "0x68656c6c6f" // hello
  });

  console.log("signFeeDelegatedValueTransferMemo");
  // console.log("RLP For Sig: ", txnToSign.getRLPEncodingForSignature())

  const { signature, signedTxn } = await klaytn.signFeeDelegatedValueTransferMemo(txnToSign);

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

test("signFeeDelegatedSmartContractDeploy with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e028010048058000002c80002019800000008000000080000000f2aceb2919850ba43b7400830493e08001946694d467b419b36fb719e851cd65d54205df75558568656c6c6f80808220198080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: FeeDelegatedSmartContractDeploy = caver.transaction.feeDelegatedSmartContractDeploy.create({
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

  console.log("signFeeDelegatedSmartContractDeploy");
  // console.log("RLP For Sig: ", txnToSign.getRLPEncodingForSignature())

  const { signature, signedTxn } = await klaytn.signFeeDelegatedSmartContractDeploy(txnToSign);
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

test("signFeeDelegatedSmartContractExecution with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e03001005d058000002c80002019800000008000000080000000f846b83ff83d3119850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946694d467b419b36fb719e851cd65d54205df75558568656c6c6f8220198080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: FeeDelegatedSmartContractExecution = caver.transaction.feeDelegatedSmartContractExecution.create({
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


  console.log("signFeeDelegatedSmartContractDeploy");
  // console.log("RLP For Sig: ", txnToSign.getRLPEncodingForSignature())

  const { signature, signedTxn } = await klaytn.signFeeDelegatedSmartContractExecution(txnToSign);

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

test("signFeeDelegatedCancel with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e03801003e058000002c80002019800000008000000080000000e8a2e13919850ba43b7400830493e0946694d467b419b36fb719e851cd65d54205df75558220198080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: FeeDelegatedCancel = caver.transaction.feeDelegatedCancel.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: 8217,
  });


  console.log("signFeeDelegatedCancel");
  // console.log("RLP For Sig: ", txnToSign.getRLPEncodingForSignature())

  const { signature, signedTxn } = await klaytn.signFeeDelegatedCancel(txnToSign);

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

test("signFeeDelegatedValueTransferWithRatio with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e008020058058000002c80002019800000008000000080000000f841b83af8380a19850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946694d467b419b36fb719e851cd65d54205df75551e8220198080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: FeeDelegatedValueTransferWithRatio = caver.transaction.feeDelegatedValueTransferWithRatio.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    feeRatio: 30,
    chainId: 8217,
  });

  console.log("signFeeDelegatedValueTransferWithRatio");
  // console.log("RLP For Sig: ", txnToSign.getRLPEncodingForSignature())

  const { signature, signedTxn } = await klaytn.signFeeDelegatedValueTransferWithRatio(txnToSign);

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

test("signFeeDelegatedValueTransferMemoWithRatio with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e01002005e058000002c80002019800000008000000080000000f847b840f83e1219850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946694d467b419b36fb719e851cd65d54205df75558568656c6c6f1e8220198080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: FeeDelegatedValueTransferMemoWithRatio = caver.transaction.feeDelegatedValueTransferMemoWithRatio.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    input: "0x68656c6c6f", // hello
    feeRatio: 30,
    chainId: 8217,
  });

  console.log("signFeeDelegatedValueTransferMemoWithRatio");

  const { signature, signedTxn } = await klaytn.signFeeDelegatedValueTransferMemoWithRatio(txnToSign);

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

test("signFeeDelegatedSmartContractDeployWithRatio with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e028020049058000002c80002019800000008000000080000000f3adec2a19850ba43b7400830493e08001946694d467b419b36fb719e851cd65d54205df75558568656c6c6f801e808220198080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: FeeDelegatedSmartContractDeployWithRatio = caver.transaction.feeDelegatedSmartContractDeployWithRatio.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    input: "0x68656c6c6f", // short input
    // real input from https://scope.klaytn.com/tx/0x19b7bad2be2963cba792154e5394cdc545f68ffbf883c25cdd78e96b4a64bf4f?tabId=rawData
    // input: "0x6080604052600560005534801561001557600080fd5b5060405161029c38038061029c8339818101604052810190610037919061007f565b80600081905550506100ac565b600080fd5b6000819050919050565b61005c81610049565b811461006757600080fd5b50565b60008151905061007981610053565b92915050565b60006020828403121561009557610094610044565b5b60006100a38482850161006a565b91505092915050565b6101e1806100bb6000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80630dbe671f14610046578063d732d95514610064578063e8927fbc1461006e575b600080fd5b61004e610078565b60405161005b91906100d7565b60405180910390f35b61006c61007e565b005b6100766100a3565b005b60005481565b60008054146100a15760016000808282546100999190610121565b925050819055505b565b60016000808282546100b59190610155565b92505081905550565b6000819050919050565b6100d1816100be565b82525050565b60006020820190506100ec60008301846100c8565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b600061012c826100be565b9150610137836100be565b92508282101561014a576101496100f2565b5b828203905092915050565b6000610160826100be565b915061016b836100be565b9250827fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff038211156101a05761019f6100f2565b5b82820190509291505056fea264697066735822122011473ea0fe0dcd65952f4315de5458369b91cb3a2f53790f0906775227a6070c64736f6c634300080f00330000000000000000000000000000000000000000000000000000000000000001"
    feeRatio: 30,
    chainId: 8217,
  });

  console.log("signFeeDelegatedSmartContractDeployWithRatio");

  const { signature, signedTxn } = await klaytn.signFeeDelegatedSmartContractDeployWithRatio(txnToSign);

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

test("signFeeDelegatedSmartContractExecutionWithRatio with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e03002005e058000002c80002019800000008000000080000000f847b840f83e3219850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946694d467b419b36fb719e851cd65d54205df75558568656c6c6f1e8220198080
        <= 56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a39000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: FeeDelegatedSmartContractExecutionWithRatio = caver.transaction.feeDelegatedSmartContractExecutionWithRatio.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
    value: 1,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    input: "0x68656c6c6f", // short input
    // real input from https://scope.klaytn.com/tx/0x19b7bad2be2963cba792154e5394cdc545f68ffbf883c25cdd78e96b4a64bf4f?tabId=rawData
    // input: "0x6080604052600560005534801561001557600080fd5b5060405161029c38038061029c8339818101604052810190610037919061007f565b80600081905550506100ac565b600080fd5b6000819050919050565b61005c81610049565b811461006757600080fd5b50565b60008151905061007981610053565b92915050565b60006020828403121561009557610094610044565b5b60006100a38482850161006a565b91505092915050565b6101e1806100bb6000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80630dbe671f14610046578063d732d95514610064578063e8927fbc1461006e575b600080fd5b61004e610078565b60405161005b91906100d7565b60405180910390f35b61006c61007e565b005b6100766100a3565b005b60005481565b60008054146100a15760016000808282546100999190610121565b925050819055505b565b60016000808282546100b59190610155565b92505081905550565b6000819050919050565b6100d1816100be565b82525050565b60006020820190506100ec60008301846100c8565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b600061012c826100be565b9150610137836100be565b92508282101561014a576101496100f2565b5b828203905092915050565b6000610160826100be565b915061016b836100be565b9250827fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff038211156101a05761019f6100f2565b5b82820190509291505056fea264697066735822122011473ea0fe0dcd65952f4315de5458369b91cb3a2f53790f0906775227a6070c64736f6c634300080f00330000000000000000000000000000000000000000000000000000000000000001"
    feeRatio: 30,
    chainId: 8217,
  });

  console.log("signFeeDelegatedSmartContractExecutionWithRatio");

  const { signature, signedTxn } = await klaytn.signFeeDelegatedSmartContractExecutionWithRatio(txnToSign);

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


test("signFeeDelegatedCancelWithRatio with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e03802003f058000002c80002019800000008000000080000000e9a3e23a19850ba43b7400830493e0946694d467b419b36fb719e851cd65d54205df75551e8220198080
        <= 13da838d8473782bcad84567b35555562472e0d36d31a71794ac4ef8e291d1dc1ec069f21019efb391c9dbb8cd8a5ea23a71c424f35255d290a904fd604554089000
    `)
  );
  const klaytn = new Klaytn(transport);
  const txnToSign: FeeDelegatedCancelWithRatio = caver.transaction.feeDelegatedCancelWithRatio.create({
    from: "0x6694d467b419b36fb719E851cD65d54205Df7555",
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    feeRatio: 30,
    chainId: 8217,
  });

  console.log("signFeeDelegatedCancelWithRatio");

  const { signature, signedTxn } = await klaytn.signFeeDelegatedCancelWithRatio(txnToSign);

  const expectedSig = "56efc3f267021a912109919202b8e74e1ddf474486f43d0880bbfa1c1bd54b44f62881888f136d40a9b8e02a792bbf175284fe736ad470fb551ba57751f81717a3";
  let signedRawTx = signedTxn.getRawTransaction();
  console.log("signedRawTx = ", signedRawTx);

  const recoveredPubkey = caver.transaction.recoverPublicKeys(signedRawTx);
  console.log("recoveredPubkey = ", recoveredPubkey)

  const recoveredAddress = caver.utils.publicKeyToAddress(recoveredPubkey[0]);
  console.log("recoveredAddress = ", recoveredAddress);

  expect(recoveredAddress).toEqual("0x6694d467b419b36fb719E851cD65d54205Df7555")
  expect(signedTxn.nonce).toBe("0x19");
  expect(signedTxn.gas).toBe("0x493e0");
  expect(signedTxn.gasPrice).toBe("0xba43b7400");
  expect(signature.toString("hex")).toEqual(expectedSig);
  expect(Buffer.from(signature as Uint8Array).toString("hex")).toBe(
    expectedSig
  );
});