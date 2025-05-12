import { Dictionary } from '@ton/core'
import type { Address, BitString, DictionaryKey, DictionaryValue, Slice } from '@ton/core'
import { parseFormatString } from './fmtstr'

import type { FieldDesc, UnpackResult } from './types'

export function decodeSlice(slice: Slice, fmt: string | FieldDesc[]): UnpackResult {
  const errBrand = Symbol()

  function execute(slice: Slice, instrs: FieldDesc[]) {
    const context = { results: [] }
    instrs.forEach(instr => executeOne(slice, instr, context))
    return context.results
  }

  function executeOne(slice: Slice, instr: FieldDesc, context: { results?: unknown[] } = {}) {
    let result
    try {
      result = executeOneInner(slice, instr)
    } catch (err) {
      if ((err as any)[errBrand]) throw err
      // console.warn('execution failed', slice, instr)
      const _err = new Error('Error parsing the cell: ' + (err as Error).message, { cause: err }) as any
      _err[errBrand] = true
      throw _err
    }
    if (result !== undefined) {
      context.results?.push(result)
    }
    return result
  }

  function executeOneInner(slice: Slice, instr: FieldDesc): unknown {
    switch (instr.type) {
    case 'coins':
      return slice.loadCoins()
    case 'address':
      return slice.loadAddress().toRawString()
    case '?address': {
      const addr = slice.loadMaybeAddress()
      return addr ? addr.toRawString() : null
    }
    case 'boolean':
      return slice.loadBit()
    case 'bits':
      return slice.loadBits(instr.count).toString()
    case 'bytes':
      return slice.loadBits(instr.count * 8).toString()
    case 'int':
      return instr.bits >= 54 ? slice.loadIntBig(instr.bits) : slice.loadInt(instr.bits)
    case 'uint':
      return instr.bits >= 54 ? slice.loadUintBig(instr.bits) : slice.loadUint(instr.bits)
    case 'varint':
      return instr.sizeBytes >= 3 ? slice.loadVarIntBig(instr.sizeBytes) : slice.loadVarInt(instr.sizeBytes)
    case 'varuint':
      return instr.sizeBytes >= 3 ? slice.loadVarUintBig(instr.sizeBytes) : slice.loadVarUint(instr.sizeBytes)
        
    case 'skip':
      executeOne(slice, instr.instr)
      return undefined
    case 'maybe': {
      const some = slice.loadBit()
      return some ? 
        { type: 'maybe', some: true, value: executeOne(slice, instr.instr) } :
        { type: 'maybe', some: false }
    }
    case 'ref': {
      const cell = slice.loadRef()
      if (instr.instr.type != 'group') {
        return executeOne(cell.beginParse(), instr.instr)
      } else if (instr.instr.children.length) {
        return execute(cell.beginParse(), instr.instr.children)
      } else {
        return []
      }
    }
        
    case 'group':
      return execute(slice, instr.children)

    case 'dict': {
      const ctorName = instr.keyType.ctor
      const ktype = Dictionary.Keys[ctorName](instr.keyType.arg)
      // you won't believe that TonCore has no built-in slice/builder value type...
      const vtype = { parse: slice => execute(slice, instr.valueParser) } as DictionaryValue<unknown>
      type TKey = typeof ktype extends DictionaryKey<infer K> ? K : never
      const entries = Array.from(slice.loadDict<TKey, unknown>(ktype, vtype))

      // okay I give up typing
      const keyStringifier: undefined | ((s: any) => string) = (() => {
        switch (ctorName) {
        case 'Address': return (s: Address) => s.toRawString()
        case 'BitString': return (s: BitString) => s.toString()
        // case 'Buffer': throw new Error('Unsupported for now')
        }
      })()

      return {
        type: 'dict',
        keyBits: ktype.bits,
        entries: keyStringifier ? 
          entries.map(([k, v]) => [keyStringifier(k), v]) :
          entries
      }
    }
        
    case 'either': {
      const isSide1 = slice.loadBit()
      return !isSide1 ? 
        { type: 'either', side: 0, value: execute(slice, instr.side0) } :
        { type: 'either', side: 1, value: execute(slice, instr.side1) }
    }

    case 'eitherIndirect': {
      const isIndirect = slice.loadBit()
      let value
      if (!isIndirect) {
        value = execute(slice, instr.content)
      } else {
        const ref = slice.loadRef()
        value = instr.content.length ? execute(ref.beginParse(), instr.content) : []
      }
      return { type: 'either', side: isIndirect ? 1 : 0, value }
    }
        
    case 'tail':
      return slice.loadStringTail()

    case 'endParse':
      slice.endParse()
      return
        
    case 'dump': {
      const { remainingBits, remainingRefs } = slice
      return {
        remainingBits, remainingRefs,
        leftover: slice.loadBits(slice.remainingBits).toString(),
      }
    }
        
    }
    
    throw new Error(`Unknown FieldDesc type "${instr.type}"`)
  }

  const instrs = typeof fmt === 'string' ? parseFormatString(fmt) : fmt
  const unpacked = execute(slice, instrs) as any

  const { remainingBits, remainingRefs } = slice

  return {
    unpacked,
    remainingBits,
    remainingRefs,
  }
}
