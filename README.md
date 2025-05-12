# TON Cell Parser

A flexible, type-aware TON cell parser.

The usage is simple: Paste the content of a cell. Look up the matching specifier for each part, and type them in the format string field in the order they appear in the cell to unpack the data. Inspired by Python's [struct](https://docs.python.org/3/library/struct.html) module.

```js
import { decodeSlice, stringToCell } from '@qbane/ton-cell-parser'

const decoded = decodeSlice(stringToCell('...boc hex or base64...'), '...format string...')
console.log(decoded.unpacked)
```
