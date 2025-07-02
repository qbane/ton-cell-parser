/// <reference types="vitest/globals" />
import { parseFormatString as $, getEmittedTokens } from '../src/fmtstr'

describe('fmtstr', () => {
  it('parses a format string', () => {
    expect($('')).toEqual([])
    expect($('i')).toHaveLength(1)
    expect($('A')).toHaveLength(1)
    expect($('s')).toHaveLength(1)
    expect($('_')).toHaveLength(1)
    expect($('$')).toHaveLength(1)

    expect($('b')[0]).toEqual({ type: 'bits', count: 1 })
    expect($('c')[0]).toEqual({ type: 'bytes', count: 1 })
    expect($('i')[0]).toEqual({ type: 'int', bits: 32 })
    expect($('?A')[0].type).toEqual('?address')
  })

  it('parses a nested group', () => {
    const group = $('((qQhH))')
    assert(group[0].type == 'group')
    assert(group[0].children[0].type == 'group')
    expect(group[0].children[0].children).toHaveLength(4)
  })

  it('errs on unrecognized specifiers', () => {
    expect(() => $('Z')).toThrow()
    expect(() => $('vx')).toThrow()
  })

  it('parses a prefix number', () => {
    expect($('2i')).toHaveLength(1)
    expect(() => $('0i')).toThrow(`Expect a positive number`)
    expect(() => $('9999i')).not.toThrow()
    expect(() => $('10000i')).toThrow()

    expect($('4vi')).toHaveLength(1)
    expect($('4vu')).toHaveLength(1)

    expect(() => $('vi')).toThrow('Must specify length for a variable-length integer')
    expect(() => $('v')).toThrow('Expected "i" or "u" immediately after "v"')

    expect(() => $('42')).toThrow('Unexpected end of a format specifier')
    expect(() => $('42\n')).toThrow('Unexpected end of a format specifier')
  })

  it('errs on some specifiers with unexpected number prefix', () => {
    expect(() => $('1Q')).toThrow()
  })

  it('parses modifiers', () => {
    expect($('*i')).toHaveLength(1)
    expect($('?i')).toHaveLength(1)
    expect($('?A')).toHaveLength(1)
    expect($('^i')).toHaveLength(1)
    expect(() => $('*?^i')).not.toThrow()
    expect(() => $('*?^(i)')).not.toThrow()
    expect(() => $('**i')).toThrow()
    expect(() => $('?*i')).toThrow()
    expect(() => $('^*i')).toThrow()
    expect(() => $('*')).toThrow('Unexpected end of a format specifier')
  })

  it('errs on illegal braced exprs', () => {
    expect(() => $('D')).toThrow()
    expect(() => $('D{')).toThrow()
    expect(() => $('D{}')).toThrow()
    expect(() => $('D{,}')).toThrow()

    expect(() => $('D*')).toThrow()
    expect(() => $('D*X{i}')).toThrow()

    expect(() => $('E{}')).toThrow()
    expect(() => $('E{i}')).toThrow()

    expect(() => $('E^X{')).toThrow()
    expect(() => $('E^X{i,}')).toThrow()
  })

  it('parses dicts', () => {
    expect(() => $('D{i,i}')).not.toThrow()
    expect(() => $('D{i,}')).not.toThrow()
    expect(() => $('D{i}')).not.toThrow()
    expect(() => $('D{9999i}')).not.toThrow()
    expect(() => $('D{A}')).not.toThrow()

    expect(() => $('D{i,i}')).not.toThrow()

    expect(() => $('D{?i}')).toThrow()
    expect(() => $('D^{i}')).toThrow()
    expect(() => $('D{B}')).toThrow()
    expect(() => $('D{4vu}')).toThrow()
    expect(() => $('D{4vu,u}')).toThrow()
    expect(() => $('D{i,i,}')).toThrow()
    expect(() => $('D{i,i,i}')).toThrow()
  })

  it('parse either', () => {
    expect($('E{32i,64u}')[0]).toEqual({
      'type': 'either',
      'side0': [
        {
          'bits': 32,
          'type': 'int',
        },
      ],
      'side1': [
        {
          'bits': 64,
          'type': 'uint',
        },
      ],
    })
    expect(() => $('E{i,}')).not.toThrow()
    expect(() => $('E{,i}')).not.toThrow()
    expect(() => $('E{,}')).not.toThrow()
  })

  it('parses either indirect', () => {
    expect(() => $('E^{i}')).not.toThrow()
    expect(() => $('E^{()}')).not.toThrow()
    expect(() => $('E^{i,}')).toThrow()
    expect(() => $('E^{,i}')).toThrow()
  })

  it('produces a copied list of last emitted token', () => {
    const [ee, rr, tlist] = getEmittedTokens(() => {
      $('()')
      return 123
    })
    expect(ee).toBe(null)
    expect(rr).toBe(123)
    expect(tlist).toHaveLength(2)
  })

  it('produces an incomplete list when parsing errors', () => {
    const [ee, rr, tlist] = getEmittedTokens(() => {
      $('(X)')
      return 456
    })
    expect(ee).toHaveProperty('message', expect.stringContaining('Unexpected character'))
    expect(rr).toBe(undefined)
    expect(tlist).toHaveLength(1)
  })
})
