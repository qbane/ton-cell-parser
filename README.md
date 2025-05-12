# TON Cell Parser

A flexible, type-aware TON cell parser.

The usage is simple: Paste the content of a cell. Look up the matching specifier for each part, and type them in the format string field in the order they appear in the cell to unpack the data. Inspired by Python's [struct](https://docs.python.org/3/library/struct.html) module.

```js
import { decodeSlice, stringToCell } from '@qbane/ton-cell-parser'

const decoded = decodeSlice(stringToCell('...boc hex or base64...'), '...format string...')
console.log(decoded.unpacked)
```

## Syntax

Comment: Java-style; Use `//` for line comments, `/*` .. `*/` for block comments.

Integral types:

* "xx`b`" = xx bits, defaults to `1`; returns a `BitString`’s string repr.
* "xx`c`" = xx bytes, defaults to `1`; returns a hex string  \
  (technical: does not use `loadBuffer` under the hood because [`Uint8Array#toHex`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toHex) is not popular enough)
* "xx`i`"/"xx`u`" = xx bits as signed/unsigned int, defaults to `32`; returns a number or BigInt when ≥ `54` bits  \
  **XXX**: maybe add type-accurate variants
* "xx`vi`"/"xx`vu`" = xx-bit-length-prefixed signed/unsigned int, xx is required; returns a number or BigInt when ≥ `3` bytes
* `h`/`H` = 16-bit signed/unsigned integer (short; shortcut to `16i`/`16u`)
* `q`/`Q` = 64-bit signed/unsigned BigInt (qword; shortcut to `64i`/`64u`)

Other data types:

* `C` = coins (wire format `4vu`)
* `A` = address (wire format `267b` but with format check -- use `?A` when it is nullable)
* `B` = a single bit, but return the result as boolean
* `(` ... `)` = parse into a sub-array; useful for grouping or acting as a placeholder
* `D{`kkk&ensp;[ `,`vvv ]&ensp;`}` = dict with its key and value (optional) types respectively
* `D*{`kkk&ensp;[ `,`vvv ]&ensp;`}` = dict direct; [see the implementation in @ton/core](https://github.com/ton-core/ton-core/blob/e0ed819973daf0484dfbacd0c30a0dcfe4714f8d/src/dict/Dictionary.ts#L260)
* `E{`xxx`,`yyy`}` = either xxx (0-side) or yyy (1-side)
* `E^{`xxx`}` = either xxx or (ref of xxx)

Trailing:

* `s` = parse the remaining bytes as a UTF-8 string tail; should be invoked at the end of a slice
* “...`_`” = dump all the remaining bits as a bit string for debugging purposes
* “...`$`” = assert the end of a slice (i.e., `endParse`, errs if there is remaining bits/refs to parse)

Modifiers: (Must follow this order, and immediately follows a type specifier)

* “`*`xxx” = read and discard (use `*`xx`b` as a way to skip xx bits)
* “`?`xxx” = maybe xxx
* “`^`xxx” = ref of xxx
* **TODO** “`~(`xxx`)`” = spread the result of slice xxx (e.g., `X ~(YZ) W` -> `[x, y, z, w]`)

## Tutorial

Let's get started by parsing a real-world Jetton transfer message. Take this <a href="https://tonviewer.com/transaction/32767137c6670465b6db6f955705f605ff3198ed21b02b987a4f8652969c0005" target="_blank">Jettons transfer transaction</a> for example. You can see the **internal message** by clicking **Show details**, and then clicking **Copy Raw body** [sic], this copies the body cell as a hex string `b5ee9c72`...

We are going to come up with a format string for decoding this message. According to the [message layout](https://docs.ton.org/v3/guidelines/dapps/asset-processing/jettons#message-layouts), or the [TL-B schema](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md#internal-message-handlers), you can unpack it with the format string as follows:

```java
4c   // op code,              4 bytes; here we expect "0F8A7EA5"
Q    // query_id,             aka uint64 or "64u"
C    // amount,               coins
A    // destination,          address
?A   // response_destination, a "maybe-address" (empty in this case)
?^() // custom_payload,       maybe-ref (also empty in this case)
C    // forward_ton_amount,   coins
```

You can omit all whitespaces and comments, and just type `4cQCA?A?^()C`. This makes your format string more like a cryptic regular expression (so bad).

### Going further

You will notice that the data has not ended yet (if you add `$` at the end you will receive an error). The reason is that this message was meant for swapping on [STON.fi](https://ston.fi) and there was a `forward_payload` left to be parsed. Refer to the message layout it is of an `Either Cell ^Cell` type, but let us pretend that the parser does not know about an `Either` type.

For a fixed message, we can dissect it by using the wire format nonetheless. *Append* the following:

```java
B       // pause here: observe what is parsed
// ^()  // parse the referenced slice (placeholder)
```

The `B` takes a bit. In this case, it's `true` (or a `1` bit), which corresponds to the "right" side of the Either, indicating a `^Cell` follows. Type `^()` to extract the content. You can refer to STON.fi's [documentations](https://docs.ston.fi/document/developer-section/api-reference-v1/router#swap-0x25938561) to figure out a format string such like `4c A C A ?(A)` to be put between the parentheses. This completes the parsing.

