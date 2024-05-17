import {
  openTransportReplayer,
  RecordStore,
} from "@ledgerhq/hw-transport-mocker";
import Klaytn from "../src/Klaytn";
import { listen } from "@ledgerhq/logs";
import Caver, {
  AbstractTransaction,
  Transaction,
  Cancel,
  FeeDelegatedCancel,
  FeeDelegatedCancelWithRatio,
  FeeDelegatedSmartContractDeploy,
  FeeDelegatedSmartContractDeployWithRatio,
  FeeDelegatedSmartContractExecution,
  FeeDelegatedSmartContractExecutionWithRatio,
  FeeDelegatedValueTransfer,
  FeeDelegatedValueTransferMemo,
  FeeDelegatedValueTransferMemoWithRatio,
  FeeDelegatedValueTransferWithRatio,
  LegacyTransaction,
  SmartContractDeploy,
  SmartContractExecution,
  ValueTransfer,
  ValueTransferMemo,
} from "caver-js";
import { PrivateKey } from "caver-js/types/packages/caver-wallet/src/keyring/privateKey";

listen((log) => console.log(log));

const testnetChainId = 1001; // 0x03e9
const mainnetChainId = 8217; // 0x2019

const CHAIN_ID = testnetChainId;
const CHAIN_ID_HEX = "0x" + CHAIN_ID.toString(16);

const caver = new Caver();

const DERIVATION = "44'/8217'/0'/0/0";

// Address used for testing (default speculos address, pub & priv key)
const test_sender_address = "0x6E93a3ACfbaDF457F29fb0E57FA42274004c32EA";
const test_sender_publicKey =
  "0x31553d8c312ef1668adcf75f179a59accb85ffad9ea2a8ecf91049d9cdafc4706f3eb10091a459826803d353b3e3a98af0e999cd44353879930d8baf0779fde7";
const test_sender_privateKey =
  "0xba988b41f30ab65c5b8df817aa27468292d089db601892b01bccf0028d0d95bb";
const test_receiver_address = "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a";


async function signTransactionWithCaver(
  txn: AbstractTransaction,
  address: string = test_sender_address,
  privateKey: string = test_sender_privateKey
) {
  // create keyring instance
  try {
    caver.wallet.newKeyring(address, privateKey);
  } catch(error){
    if(error instanceof TypeError && !error.message.includes('Duplicate Account')){
      throw error
    }
  }
  txn.signatures = [];
  const signedTxn = await caver.wallet.sign(address, txn);
  const caver_signatures = signedTxn.signatures;
  return caver_signatures;
}

async function performSigningAndValidation(
  apdus: string[],
  txn: AbstractTransaction
) {
    for (let apdu of apdus) {
      let index = apdus.indexOf(apdu);
      if (index % 2 == 0) {
        apdus[index] = `=> ${apdu}`;
      } else {
        apdus[index] = `<= ${apdu}`;
      }
    }
    const transport = await openTransportReplayer(
      RecordStore.fromString(apdus.join("\n"))
    );
    await txn.fillTransaction();
    const klaytn = new Klaytn(transport);
    const { signature, signedTxn } = await klaytn.signTransaction(txn as Transaction);
    await validateTransaction(signedTxn);
}


const validateTransaction = async (
  signedTxn: AbstractTransaction,
  expectedAddress: string = test_sender_address
) => {
  const recoveredAddress = getRecoveredAddressFromSignedTxn(signedTxn);
  const signaturesGeneratedByLedger = signedTxn.signatures;
  const signaturesGeneratedByCaver = await signTransactionWithCaver(signedTxn);
  let secondCheck = (recoveredAddress==expectedAddress);
  if(!secondCheck){
    expect(signaturesGeneratedByLedger).toEqual(signaturesGeneratedByCaver);
  }
  expect(recoveredAddress).toEqual(expectedAddress);

};

const getRecoveredPublicKeyFromSignedTxn = (
  signedTxn: AbstractTransaction,
  index = 0
) => {
  let signedRawTx = signedTxn.getRawTransaction();
  const recoveredPubkey = caver.transaction.recoverPublicKeys(signedRawTx);
  return recoveredPubkey[index];
};

const getRecoveredAddressFromSignedTxn = (signedTxn: AbstractTransaction) => {
  const recoveredPubkey = getRecoveredPublicKeyFromSignedTxn(signedTxn);
  const recoveredAddress = caver.utils.publicKeyToAddress(recoveredPubkey);
  return recoveredAddress;
};

test("getVersion", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
            => e003000000
            <= 0101009000
        `)
  );
  const klaytn = new Klaytn(transport);
  const result = await klaytn.getVersion();
  expect(result).toEqual({
    version: "1.1.0",
  });
});

test("getAddress without display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e005000015058000002c80002019800000000000000000000000
        <= 410431553d8c312ef1668adcf75f179a59accb85ffad9ea2a8ecf91049d9cdafc4706f3eb10091a459826803d353b3e3a98af0e999cd44353879930d8baf0779fde7283645393361334143666261444634353746323966623045353746413432323734303034633332454120dcb69125be45c0042ab9761246917b526bb2b3c5aec55d37e32624ae6c87f2679000
    `)
  );
  const klaytn = new Klaytn(transport);
  const { address } = await klaytn.getAddress(DERIVATION, false);
  expect(address).toEqual(test_sender_address);
});

test("getAddress with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e005010015058000002c80002019800000000000000000000000
        <= 410431553d8c312ef1668adcf75f179a59accb85ffad9ea2a8ecf91049d9cdafc4706f3eb10091a459826803d353b3e3a98af0e999cd44353879930d8baf0779fde7283645393361334143666261444634353746323966623045353746413432323734303034633332454120dcb69125be45c0042ab9761246917b526bb2b3c5aec55d37e32624ae6c87f2679000
        `)
  );
  const klaytn = new Klaytn(transport);
  const { address } = await klaytn.getAddress(DERIVATION, true);
  expect(address).toEqual(test_sender_address);
});

test("signLegacyTransaction with display", async () => {
  const txnToSign: LegacyTransaction =
    caver.transaction.legacyTransaction.create({
      from: test_sender_address,
      to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
      value: 1,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      chainId: CHAIN_ID,
    });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010028e719850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01808203e98080",
      "f68186ff6cd6a5e891b1dc9165ae349a4cda5ad2432a81a541b8189ac8f7b020603f8dc7a0a8120a392982d8bb44be6ea34757d85b366558389e16cc26b67ead729000",
    ],
    txnToSign
  );
});

test("signCancel with display", async () => {
  const txnToSign: Cancel = caver.transaction.cancel.create({
    from: test_sender_address,
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 25,
    chainId: CHAIN_ID,
  });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010029e8a2e13819850ba43b7400830493e0946e93a3acfbadf457f29fb0e57fa42274004c32ea8203e98080",
      "f54990b218171748d7560584301dba0bd65881833ba470c359445a912b4cd2e5921651030334981fba1c1dfeaae639d9e82a6e95359cde1c8ca48319d87f0e67b99000",
    ],
    txnToSign
  );
});

test("signValueTransfer with display", async () => {
  const txnToSign: ValueTransfer = caver.transaction.valueTransfer.create({
    from: test_sender_address,
    to: test_receiver_address,
    value: caver.utils.toPeb("50000000000.000000000000000001", "KLAY"), //0x2b5e3af16b1880000  | 1 klay = 1 * 10 ^18
    gasPrice: 50000000000,
    gas: 300000,
    nonce: 4444,
    chainId: CHAIN_ID,
  });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010050f84eb847f8450882115c850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a8ca18f07d736b90be550000001946e93a3acfbadf457f29fb0e57fa42274004c32ea8203e98080",
      "f543047b1e0e19e2d62364436833d3c8c50f657eea1a96b123c4941b1c3ef64cd8678c708c5c0dd840538f9a9781ec5f99b7a986d091fe5925c45e8b8e8f6751e39000",
    ],
    txnToSign
  );
});

test("signValueTransferMemo with display", async () => {
  const txnToSign: ValueTransferMemo =
    caver.transaction.valueTransferMemo.create({
      from: test_sender_address,
      to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
      value: 1,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      chainId: CHAIN_ID,
      input: "0x68656c6c6f", // hello
    });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010048f846b83ff83d1019850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946e93a3acfbadf457f29fb0e57fa42274004c32ea8568656c6c6f8203e98080",
      "f62541f70b57efb801bff9794d47550ceaf8b436325fbe92f3038d40746bdb18da000b76375d443f984bfc5d8918673460999439a72a7efe2c973285c2e38874149000",
    ],
    txnToSign
  );
});

test("signSmartContractDeploy with display", async () => {
  const txnToSign: SmartContractDeploy =
    caver.transaction.smartContractDeploy.create({
      from: test_sender_address,
      value: 1,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      chainId: CHAIN_ID,
      input: "0x6080604052600560005534801561001557600080fd5b5060405161029c38038061029c8339818101604052810190610037919061007f565b80600081905550506100ac565b600080fd5b6000819050919050565b61005c81610049565b811461006757600080fd5b50565b60008151905061007981610053565b92915050565b60006020828403121561009557610094610044565b5b60006100a38482850161006a565b91505092915050565b6101e1806100bb6000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80630dbe671f14610046578063d732d95514610064578063e8927fbc1461006e575b600080fd5b61004e610078565b60405161005b91906100d7565b60405180910390f35b61006c61007e565b005b6100766100a3565b005b60005481565b60008054146100a15760016000808282546100999190610121565b925050819055505b565b60016000808282546100b59190610155565b92505081905550565b6000819050919050565b6100d1816100be565b82525050565b60006020820190506100ec60008301846100c8565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b600061012c826100be565b9150610137836100be565b92508282101561014a576101496100f2565b5b828203905092915050565b6000610160826100be565b915061016b836100be565b9250827fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff038211156101a05761019f6100f2565b5b82820190509291505056fea264697066735822122011473ea0fe0dcd65952f4315de5458369b91cb3a2f53790f0906775227a6070c64736f6c634300080f00330000000000000000000000000000000000000000000000000000000000000001",
    });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e0060180fff902efb902e7f902e42819850ba43b7400830493e08001946e93a3acfbadf457f29fb0e57fa42274004c32eab902bc6080604052600560005534801561001557600080fd5b5060405161029c38038061029c8339818101604052810190610037919061007f565b80600081905550506100ac565b600080fd5b6000819050919050565b61005c81610049565b811461006757600080fd5b50565b60008151905061007981610053565b92915050565b60006020828403121561009557610094610044565b5b60006100a38482850161006a565b91505092915050565b6101e1806100bb6000396000f3fe608060405234801561001057600080fd5b50600436",
      "9000",
      "e0060280ff106100415760003560e01c80630dbe671f14610046578063d732d95514610064578063e8927fbc1461006e575b600080fd5b61004e610078565b60405161005b91906100d7565b60405180910390f35b61006c61007e565b005b6100766100a3565b005b60005481565b60008054146100a15760016000808282546100999190610121565b925050819055505b565b60016000808282546100b59190610155565b92505081905550565b6000819050919050565b6100d1816100be565b82525050565b60006020820190506100ec60008301846100c8565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000",
      "9000",
      "e0060300f4600052601160045260246000fd5b600061012c826100be565b9150610137836100be565b92508282101561014a576101496100f2565b5b828203905092915050565b6000610160826100be565b915061016b836100be565b9250827fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff038211156101a05761019f6100f2565b5b82820190509291505056fea264697066735822122011473ea0fe0dcd65952f4315de5458369b91cb3a2f53790f0906775227a6070c64736f6c634300080f0033000000000000000000000000000000000000000000000000000000000000000180808203e98080",
      "f5e3ae6405a879f63bc14d1448878e0c1327af4b34cb537c312b732ed94a375a0b70e4868838bccfc9ec3e987abd78bda18c77427d26267ea57b8a35f6c8a4ea989000"
    ],
    txnToSign
  );
});

test("signSmartContractExecution with display", async () => {
  const txnToSign: SmartContractExecution =
    caver.transaction.smartContractExecution.create({
      from: test_sender_address,
      to: test_receiver_address,
      value: 1,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      chainId: CHAIN_ID,
      input: "0x095ea7b3000000000000000000000000f50782a24afcb26acb85d086cf892bfffb5731b5ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    });  
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010088f886b87ff87d3019850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946e93a3acfbadf457f29fb0e57fa42274004c32eab844095ea7b3000000000000000000000000f50782a24afcb26acb85d086cf892bfffb5731b5ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8203e98080",
      "f6c2b1aae8bb4c4e215390ed520f1e0228eba877f28fae42e81cbc70dc99a32a6857e301630e8cf4a8926122b31997243c07c4acfb0c64543e9e7cfe97eedbe09c9000",
    ],
    txnToSign
  );
});

test("signFeeDelegatedValueTransfer with display", async () => {
  const txnToSign: FeeDelegatedValueTransfer =
    caver.transaction.feeDelegatedValueTransfer.create({
      from: test_sender_address,
      to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
      value: 1,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      chainId: CHAIN_ID,
    });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010041f83fb838f70919850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946e93a3acfbadf457f29fb0e57fa42274004c32ea8203e98080",
      "f5879f217f11a38c3b25cb1d89392cf0eb3b39cb10c61ec9b8d12f2c1a120d57c73781e8838d70e54fa3d8e4fe8d421b0954225e78bef0a3cce51c4670bf285adb9000",
    ],
    txnToSign
  );
});

test("signFeeDelegatedValueTransferMemo with display", async () => {
  const txnToSign: FeeDelegatedValueTransferMemo =
    caver.transaction.feeDelegatedValueTransferMemo.create({
      from: test_sender_address,
      to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
      value: 1,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      chainId: CHAIN_ID,
      input: "0x68656c6c6f", // hello
    });
  await performSigningAndValidation(
  [
    "e006008015058000002c80002019800000000000000000000000",
    "9000",
    "e006010048f846b83ff83d1119850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946e93a3acfbadf457f29fb0e57fa42274004c32ea8568656c6c6f8203e98080",
    "f5e63c67f2f2737be306e9c8c9f322eaf095de7f4a1c4a4b91d26a2e9b2378c7023cb82ce994e9d9965a547cff741125f1d37af0d80243996d6cb8cad760c67f1e9000",
  ],
    txnToSign
  );
});

test("signFeeDelegatedSmartContractDeploy with display", async () => {
  const txnToSign: FeeDelegatedSmartContractDeploy =
    caver.transaction.feeDelegatedSmartContractDeploy.create({
      from: test_sender_address,
      value: 1,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      chainId: CHAIN_ID,
      input: "0x68656c6c6f",
    });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010033f2aceb2919850ba43b7400830493e08001946e93a3acfbadf457f29fb0e57fa42274004c32ea8568656c6c6f80808203e98080",
      "f50e33693d6e30af7429df4e193aa4ef992a58a9234e451fe7003afd580dbb6bad37d03b4f5b819ecdeddce4966664ade4ba61a31d495d71830734dadafb663d8d9000",
    ],
    txnToSign
  );
});

test("signFeeDelegatedSmartContractExecution with display", async () => {
  const txnToSign: FeeDelegatedSmartContractExecution =
    caver.transaction.feeDelegatedSmartContractExecution.create({
      from: test_sender_address,
      to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
      value: 1,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      chainId: CHAIN_ID,
      input: "0x68656c6c6f",
    });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010048f846b83ff83d3119850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946e93a3acfbadf457f29fb0e57fa42274004c32ea8568656c6c6f8203e98080",
      "f5c8ae333c094b011f47304ab17bf20b9d97c34c6924148e10ddde14cb7ff0a7497bc789f1016abab21c1e04c6c93d5d225037fde414227f7ee199574e0df8c30f9000",
    ],
    txnToSign
  );
});

test("signFeeDelegatedCancel with display", async () => {
  const txnToSign: FeeDelegatedCancel =
    caver.transaction.feeDelegatedCancel.create({
      from: test_sender_address,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      chainId: CHAIN_ID,
    });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010029e8a2e13919850ba43b7400830493e0946e93a3acfbadf457f29fb0e57fa42274004c32ea8203e98080",
      "f6b644b67bc93b3b238ed0533ce84c9b79caf001e7a0dd75c692deb551848c66dd6a5e019e260725dcfe708263befb2076d948fbc38e747c15d74219c3355957779000",
    ],
    txnToSign
  );
});

test("signFeeDelegatedValueTransferWithRatio with display", async () => {
  const txnToSign: FeeDelegatedValueTransferWithRatio =
    caver.transaction.feeDelegatedValueTransferWithRatio.create({
      from: test_sender_address,
      to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
      value: 1,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      feeRatio: 30,
      chainId: CHAIN_ID,
    });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010043f841b83af8380a19850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946e93a3acfbadf457f29fb0e57fa42274004c32ea1e8203e98080",
      "f5b9e38932bee72d85c35fd9a62d2a9d3e2ce94816a875463e6c685fae94e749497bede1ed2169c2f800e70a1f48ff055578dfdd0d79502e311d0c62a2acb695f39000",
    ],
    txnToSign
  );
});

test("signFeeDelegatedValueTransferMemoWithRatio with display", async () => {
  const txnToSign: FeeDelegatedValueTransferMemoWithRatio =
    caver.transaction.feeDelegatedValueTransferMemoWithRatio.create({
      from: test_sender_address,
      to: "0x0EE56B604c869E3792c99E35C1C424f88F87dC8a",
      value: 1,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      input: "0x68656c6c6f", // hello
      feeRatio: 30,
      chainId: CHAIN_ID,
    });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010049f847b840f83e1219850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946e93a3acfbadf457f29fb0e57fa42274004c32ea8568656c6c6f1e8203e98080",
      "f6bff56a824e861c48fb1f4ac61132f84a876d671bf987627edaddf9c203c574661f7e1eb4c1c6cb7363c83f5c0c1a86450ac11281f11466d1657551deabd6de989000",
    ],
    txnToSign
  );
});

test("signFeeDelegatedSmartContractDeployWithRatio with display", async () => {
  const txnToSign: FeeDelegatedSmartContractDeployWithRatio =
    caver.transaction.feeDelegatedSmartContractDeployWithRatio.create({
      from: test_sender_address,
      value: 1,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      input: "0x68656c6c6f",
      feeRatio: 30,
      chainId: CHAIN_ID,
    });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010034f3adec2a19850ba43b7400830493e08001946e93a3acfbadf457f29fb0e57fa42274004c32ea8568656c6c6f801e808203e98080",
      "f6e9a23a70da3c75f2d6c466eff92e234fd174260fb44f4bf337a40d0b5440453f2c60e3aa5f3fec7d3b724964077c423a4728b129223f50b10bfe5aed939c634a9000",
    ],
    txnToSign
  );
});

test("signFeeDelegatedSmartContractExecutionWithRatio with display", async () => {
  const txnToSign: FeeDelegatedSmartContractExecutionWithRatio =
    caver.transaction.feeDelegatedSmartContractExecutionWithRatio.create({
      from: test_sender_address,
      to: test_receiver_address,
      value: 1,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      input: "0x68656c6c6f",
      feeRatio: 30,
      chainId: CHAIN_ID,
    });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e006010049f847b840f83e3219850ba43b7400830493e0940ee56b604c869e3792c99e35c1c424f88f87dc8a01946e93a3acfbadf457f29fb0e57fa42274004c32ea8568656c6c6f1e8203e98080",
      "f5c0d2dbef6ae59b9320fd7543a8a16d9fd428081c6cb80c14867743462b750c863ff1253aa0ea99e449792dea421a8250a5666e4c2cca01d31b8c1e2a6c5980a09000",
    ],
    txnToSign
  );
});

test("signFeeDelegatedCancelWithRatio with display", async () => {
  const txnToSign: FeeDelegatedCancelWithRatio =
    caver.transaction.feeDelegatedCancelWithRatio.create({
      from: test_sender_address,
      gasPrice: 50000000000,
      gas: 300000,
      nonce: 25,
      feeRatio: 30,
      chainId: CHAIN_ID,
    });
  await performSigningAndValidation(
    [
      "e006008015058000002c80002019800000000000000000000000",
      "9000",
      "e00601002ae9a3e23a19850ba43b7400830493e0946e93a3acfbadf457f29fb0e57fa42274004c32ea1e8203e98080",
      "f5d6a8e83c0c4fb8754775c396f45e3b24acca506204bed289342f02f27586fa075f7bb3274f7872b9eed9ca6e6851c578ecb36547989ef757b853f5877ff5e53d9000",
    ],
    txnToSign
  );
});
