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
* "xx`c`" = xx bytes, defaults to `1`; returns a hex string
  (technical: does not use `loadBuffer` under the hood because [`Uint8Array#toHex`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toHex) is not popular enough)
* "xx`i`"/"xx`u`" = xx bits as signed/unsigned int, defaults to `32`; returns a number or BigInt when ≥ `54` bits
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
