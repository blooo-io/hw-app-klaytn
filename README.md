<img src="https://user-images.githubusercontent.com/211411/34776833-6f1ef4da-f618-11e7-8b13-f0697901d6a8.png" height="100" />

[Github](https://github.com/blooo-io/)

## @blooo/hw-app-klaytn

Ledger Hardware Wallet Klaytn JavaScript bindings.

## API

#### Table of Contents

- [Klaytn](#klaytn)
  - [Parameters](#parameters)
    - [Examples](#examples)
  - [Basic Information Methods](#basic-information-methods)
    - [getVersion()](#getversion)
      - [Examples](#examples-1)
    - [getAddress()](#getaddress)
      - [Parameters](#parameters-1)
      - [Examples](#examples-2)
  - [Transaction signing methods](#transaction-signing-methods)
    - [Parameters](#parameters-2)
    - [Examples](#examples-3)

## Klaytn

Klaytn API

### Parameters

- `transport`. A transport for sending commands to a device
- `scrambleKey`. A scramble key (optional, default `"klaytn_default_scramble_key"`)

#### Examples

```javascript
import Klaytn from "blooo/hw-app-klaytn";
const klaytn = new Klaytn(transport);
```

### Basic Information methods

#### getVersion()

Get application version.

##### Examples

```javascript
klaytn.getVersion().then((r) => r.version);
```

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<{version: [string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)}>** version object

#### getAddress

Get Klaytn address (public key) for a BIP32 path.

##### Parameters

- `path` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** a BIP32 path without the address index
- `display` **[boolean](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** flag to show display (default)
- `accountIndex` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** index of account address (optional, default `0`)

##### Examples

```javascript
klaytn.getAddress("44'/8217'/0'/0/", false, 0).then((r) => r.address);
```

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<{address: [string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String), publicKey: [string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String), chainCode: [string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) | [undefined](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined)}>** an object with the address field

### Transaction Signing Method

To sign a Klaytn transaction use the method: **signTransaction** .

#### Parameters

- `txn`. A **[caver transaction](https://archive-docs.klaytn.foundation/content/dapp/sdk/caver-js/api-references/caver.transaction)**.
- `accountIndex` index of account address (optional, default `0`)

##### Examples

```javascript
import Caver from "caver-js";

const caver = new Caver();

const accountIndex = 1;

const txn = caver.transaction.valueTransfer.create({
  from: "enter address here",
  to: "enter address here",
  value: 1,
  gasPrice: 50000000000,
  gas: 300000,
  nonce: 1,
  chainId: 1001,
});

klaytn.signTransaction(txn, accountIndex).then((r) => r.signature);
```

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<{signature: \[[v](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/string),[r](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/string),[s](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/string)\], signedTxn: [caver transaction](https://archive-docs.klaytn.foundation/content/dapp/sdk/caver-js/api-references/caver.transaction).}>** an object with the signed transaction and signature
