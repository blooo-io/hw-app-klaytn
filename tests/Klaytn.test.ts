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
            => e001000000
            <= 0102039000
        `)
  );
  const klaytn = new Klaytn(transport);
  const result = await klaytn.getVersion();
  expect(result).toEqual({
    version: "1.2.3",
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
        <= 4104d2ca9905ce8e697c7623650b22b7783a21c4d6a08f7438744498a86ea8c3ea5702f0f3af50d6b02cef415aaaff49ab2f4d9606bbb44ee75f8d7c623a01cfc51828653430456638363844383042394543386443353637314546633430323131323561656631343430339000
    `)
  );
  const klaytn = new Klaytn(transport);
  const { address } = await klaytn.getAddress(DERIVATION, false);
  expect(address).toEqual(
    "0xe40Ef868D80B9EC8dC5671EFc4021125aef14403"
  );
});

test("getAddress with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e002010015058000002c80002019800000008000000080000000
        <= 4104d2ca9905ce8e697c7623650b22b7783a21c4d6a08f7438744498a86ea8c3ea5702f0f3af50d6b02cef415aaaff49ab2f4d9606bbb44ee75f8d7c623a01cfc51828653430456638363844383042394543386443353637314546633430323131323561656631343430339000
    `)
  );
  const klaytn = new Klaytn(transport);
  const { address } = await klaytn.getAddress(DERIVATION, true);
  expect(address).toEqual(
    "0xe40Ef868D80B9EC8dC5671EFc4021125aef14403"
  );
});

test("signLegacyTransaction with display", async () => {
  const transport = await openTransportReplayer(
    RecordStore.fromString(`
        => e0040000351900000000000000e803000000000000e093040000000000010000000000000018e9ee49ee911f2c49b7b6efa5d2607e4f46c0b5e9
        <= 0a21011a7cb93f11c575248e8c381aefce9af49154960321856511343eb98c135f25e812280a2101351a71c22fefec2231936ad2826b217ece39d9f77fc6c49639926299c38692951080c2d72f18b8910220192a407a59cc2dc8e340d65a38ee7baf4dd03b5be7d02cf2b4a0ff7c21ce07a01c73543b93a5a2d36811bd11d09205696bacea8250a7ff404cabdecb3bbbd0f7a152069000
    `)
  );
  const klaytn = new Klaytn(transport);

  const txnToSign = caver.transaction.legacyTransaction.create({
    from: "0xDd6dcc0c221EcC96b4d09B683e2beB49d75D16c8",
    to: "0x18E9Ee49Ee911F2C49B7b6eFA5d2607e4F46C0B5",
    value: 1,
    gasPrice: 1000,
    gas: 300000,
    nonce: 25,
  });

  console.log(txnToSign);

  const { signature, txn } = await klaytn.signLegacyTransaction(txnToSign);

  const expectedSig =
    "7a59cc2dc8e340d65a38ee7baf4dd03b5be7d02cf2b4a0ff7c21ce07a01c73543b93a5a2d36811bd11d09205696bacea8250a7ff404cabdecb3bbbd0f7a15206";
  expect(txn.value).toBe('0x1');
  expect(txn.nonce).toBe("0x19");
  expect(txn.gas).toBe("0x493e0");
  expect(txn.gasPrice).toBe("0x3e8");
  expect(signature.toString("hex")).toEqual(expectedSig);
  expect(Buffer.from(signature as Uint8Array).toString("hex")).toBe(
    expectedSig
  );
});
