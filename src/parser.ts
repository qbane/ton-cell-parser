import { Cell } from '@ton/core'
import { parseFormatString } from './fmtstr'
import type { Infer } from './static'
import type { FieldDesc, UnpackResult } from './types'
import { decodeSlice } from './unpacker'
import { stringToCell } from './utils'

export class Parser<ParserOutput extends unknown[]> {
  constructor(readonly fields: FieldDesc[]) {}

  unpack(input: string | Uint8Array): UnpackResult<ParserOutput> {
    let cell: Cell
    if (typeof input === 'string') {
      cell = stringToCell(input)
    } else {
      if (globalThis.Buffer) {
        input = Buffer.from(input)
      }
      cell = Cell.fromBoc(input as any)[0]
    }
    return decodeSlice(cell.beginParse(), this.fields as any) as UnpackResult<ParserOutput>
  }

  static create<T extends string>(source: T): Parser<string extends T ? unknown[] : Infer<T>> {
    return new Parser<string extends T ? unknown[] : Infer<T>>(parseFormatString(source))
  }
}
