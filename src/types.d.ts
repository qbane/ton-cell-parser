import { Cell, Dictionary, Slice } from '@ton/core'

interface ModifierDesc {
  skip: boolean
  maybe: boolean
  ref: boolean
}

export type SpecifierID = 'int' | 'uint' | 'varint' | 'varuint' | 'bits' | 'bytes' |
  'address' | 'boolean' | 'coins' | 'dict' | 'either' | 'eitherIndirect' | 'tail'

export type Token =
  | { type: 'eof' }
  | { type: ')' | '}' | ',' | '$' | '_' }
  | ({ type: '(' } & ModifierDesc)
  | ({ type: 'specifier', id: SpecifierID } & ModifierDesc)

export interface UnpackResult<T extends unknown[] = unknown[]> {
  unpacked: T
  remainingBits: number
  remainingRefs: number
}

type _DictKeyType = { [k in keyof typeof Dictionary.Keys]:
  { ctor: k } &
  (Parameters<typeof Dictionary.Keys[k]>[0] extends infer Arg ? (
    Arg extends undefined ? { arg?: any } : { arg: Arg }) :
    never) }
export type DictKeyType = _DictKeyType[keyof _DictKeyType]

export type FieldDesc =
  | { type: 'coins' | 'address' | '?address' | 'boolean' | 'tail' | 'endParse' | 'dump' }
  | { type: `${'' | 'u'}int`, bits: number }
  | { type: `var${'' | 'u'}int`, sizeBytes: number }
  | { type: 'bits', count: number }
  | { type: 'bytes', count: number }
  | { type: 'skip' | 'maybe' | 'ref', instr: FieldDesc }
  | { type: 'group', children: FieldDesc[] }
  | { type: 'dict', keyType: DictKeyType, valueParser: FieldDesc[] }
  | { type: 'either', side0: FieldDesc[], side1: FieldDesc[] }
  | { type: 'eitherIndirect', content: FieldDesc[] }
  | { type: void }  // a hack for unhandled types

export { Infer } from './static'

export declare function stringToCell(str: string, CellClass: typeof Cell): Cell
export declare function decodeSlice(slice: Slice, fmt: string | FieldDesc[]): UnpackResult
export declare function parseFormatString(str: string): FieldDesc[]
