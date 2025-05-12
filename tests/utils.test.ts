/// <reference types="vitest/globals" />
import { Cell } from '@ton/core'
import { stringToCell } from '../src/utils'

describe('utils', () => {
  it('parses a string of boc', () => {
    expect(stringToCell('b5ee9c724101010100020000004cacb9cd')).toBeInstanceOf(Cell)
    expect(stringToCell('te6cckEBAQEAAgAAAEysuc0=')).toBeInstanceOf(Cell)
  })

  it('bails out on invalid strings', () => {
    expect(() => stringToCell('0x')).toThrow()
    expect(() => stringToCell('0x1234')).toThrow()
  })
})
