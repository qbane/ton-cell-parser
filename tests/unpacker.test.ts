/// <reference types="vitest/globals" />
import { Address, Builder, Dictionary } from '@ton/core'
import { decodeSlice } from '../src/unpacker'

const ZERO_ADDRESS = new Address(0, Buffer.from(new Uint8Array(32)))

describe('unpacker', () => {
  it('parses incomplete bytes', () => {
    const builder = new Builder()
    builder.storeBit(1)
    builder.storeBit(0)
    builder.storeBit(1)
    builder.storeUint(42, 8)
    expect(decodeSlice(builder.asSlice(), '11b$').unpacked[0]).toMatchInlineSnapshot(`"A55_"`)
    expect(decodeSlice(builder.asSlice(), '*B B *B 8i$').unpacked).toEqual([false, 42])
    expect(() => decodeSlice(builder.asSlice(), 's')).toThrow(`Invalid string length: 11`)
  })

  it('returns a 54-bit int as bigint', () => {
    const builder = new Builder()
    builder.storeUint(2n ** 53n - 1n, 53)
    builder.storeUint(2n ** 54n - 1n, 54)
    expect(decodeSlice(builder.asSlice(), '53i54i').unpacked).toEqual([-1, -1n])
  })

  it('unpacks a 256-bit number with var(u)int', () => {
    const builder = new Builder()
    const sm = 1234
    const p = 2n ** 256n - 232n - 977n
    builder.storeVarUint(sm, 2)
    builder.storeVarUint(p, 6)
    expect(decodeSlice(builder.asSlice(), '2vu6vu$').unpacked).toEqual([sm, p])
    expect(decodeSlice(builder.asSlice(), '2vi6vi$').unpacked).toEqual([sm, -232n - 977n])
  })

  it('unpacks a maybe', () => {
    const builder = new Builder()
    builder.storeMaybeCoins(1)
    builder.storeMaybeCoins(null)
    expect(decodeSlice(builder.asSlice(), '?C?C').unpacked).toEqual([
      { type: 'maybe', some: true, value: 1n },
      { type: 'maybe', some: false },
    ])
  })

  it('unpacks a ref', () => {
    const builder = new Builder()
    builder.storeRef(new Builder().storeCoins(1))
    expect(decodeSlice(builder.asSlice(), '^C').unpacked).toEqual([1n])
    // grouping should work as well
    expect(decodeSlice(builder.asSlice(), '^(C)').unpacked).toEqual([[1n]])
  })

  it('unpacks a either', () => {
    const builder0 = new Builder()
    builder0.storeBit(false)
    builder0.storeCoins(1n)
    expect(decodeSlice(builder0.asSlice(), 'E{C,}$').unpacked[0])
      .toEqual({ type: 'either', side: 0, value: [1n] })

    const builder1 = new Builder()
    builder1.storeBit(true)
    builder1.storeCoins(1n)
    expect(decodeSlice(builder1.asSlice(), 'E{,C}$').unpacked[0])
      .toEqual({ type: 'either', side: 1, value: [1n] })
  })

  it('unpacks a either indirect', () => {
    const builder0 = new Builder()
    builder0.storeBit(false)
    builder0.storeCoins(1n)
    expect(decodeSlice(builder0.asSlice(), 'E^{C}$').unpacked[0])
      .toEqual({ type: 'either', side: 0, value: [1n] })

    const builder1 = new Builder()
    builder1.storeBit(true)
    builder1.storeRef(new Builder().storeCoins(1))
    expect(decodeSlice(builder1.asSlice(), 'E^{C}$').unpacked[0])
      .toEqual({ type: 'either', side: 1, value: [1n] })

    // empty ref should not trigger a begin parse
    const builder1e = new Builder()
    builder1e.storeBit(true)
    builder1e.storeRef(new Builder())
    expect(decodeSlice(builder1e.asSlice(), 'E^{}$').unpacked[0])
      .toEqual({ type: 'either', side: 1, value: [] })
  })

  it('parses a maybe address', () => {
    const builder = new Builder()
    builder.storeAddress(null)

    expect(() => decodeSlice(builder.asSlice(), 'A')).toThrow()
    expect(decodeSlice(builder.asSlice(), '?A$').unpacked).toEqual([null])

    const builderWithAddr = new Builder()
    builderWithAddr.storeAddress(ZERO_ADDRESS)
    expect(decodeSlice(builderWithAddr.asSlice(), '?A$').unpacked[0]).toEqual('0:' + '0'.repeat(64))
  })

  it('parses a dict', () => {
    const builder = new Builder()
    const dict = Dictionary.empty(Dictionary.Keys.Address(), Dictionary.Values.Cell())
    dict.set(ZERO_ADDRESS, new Builder().storeCoins(1n).asCell())
    builder.storeDict(dict)

    const dictUnpacked: any = decodeSlice(builder.asSlice(), 'D{A,^C}$').unpacked[0]
    expect(dictUnpacked.keyBits).toEqual(267)
  })

  it('emits a single error upon fault in a nested structure', () => {
    // create a nested slice
    const parent = new Builder()
    const child = new Builder()
    child.storeUint(42, 8)
    parent.storeBuilder(child)

    const sl = parent.asSlice()
    expect(() => decodeSlice(sl, '(8u$)$')).not.toThrow()
    expect(() => decodeSlice(sl, '(C)')).toThrow(
      expect.objectContaining({ cause: expect.anything() }))
  })

  it('errs on an unrecognized field desc', () => {
    expect(() => decodeSlice(new Builder().storeCoins(1).asSlice(), [{type: 'xxx'}] as any))
      .toThrow('Unknown FieldDesc type "xxx"')
  })
})
