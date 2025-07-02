import type { DictKeyType, FieldDesc, SpecifierID, Token } from './types'

type EmittedTokens = { pos: number, token: Token }[]

let _saveEmittedTokens = false
const _emittedTokens = [] as EmittedTokens

export function getEmittedTokens<T>(cb: () => T): 
  [unknown, undefined, EmittedTokens] | [null, T, EmittedTokens] {

  _saveEmittedTokens = true
  let result: T = undefined as any
  let error
  let tokens: EmittedTokens
  try {
    result = cb()
  } catch (err) {
    error = err
  } finally {
    tokens = _emittedTokens.slice()
    _emittedTokens.length = 0
    _saveEmittedTokens = false
  } 
  return error !== undefined ? 
    [error as unknown, undefined, tokens] : 
    [null, result, tokens]
}

class FormatStringParseError extends Error {
  constructor(
    message: string,
    readonly pos: [number, number]) {
    super(message)
  }
}

export function parseFormatString(str: string) {
  let pos = 0
  let token: Token = { type: 'eof' }

  function search(regex: RegExp, start: number) {
    regex.lastIndex = start
    const mat = regex.exec(str)
    return mat ? start + mat[0].length : -1
  }

  function error(message: string, posStart: number = pos, posEnd: number = posStart) {
    return new FormatStringParseError(message, [posStart, posEnd])
  }

  function next() {
    // intercept the lexer to pull out the token stream
    if (_saveEmittedTokens && token.type != 'eof') _emittedTokens.push({ pos, token })

    const start = search(/(\s|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)*/y, pos)
    if (start == str.length) return (token = { type: 'eof' })

    pos = start

    if (')},$_'.includes(str[pos])) {
      return (token = { type: str[pos++] } as Token)
    }

    const mods = { skip: false, maybe: false, ref: false }
    if (str[pos] == '*') { pos++; mods.skip = true }
    if (str[pos] == '?') { pos++; mods.maybe = true }
    if (str[pos] == '^') { pos++; mods.ref = true }
    if (pos < str.length && '*?^'.indexOf(str[pos]) >= 0) {
      throw error(`Sorry, modifiers must follow the order "*?^" for now.`, start, pos)
    }

    const posNumStart = pos
    let num: number | null = null
    if (str[pos] >= '0' && str[pos] <= '9') {
      const end = search(/\d+/y, pos)  // must match
      num = Number.parseInt(str.slice(pos, end))
      if (num == 0) {
        throw error('Expect a positive number.', pos, end)
      } else if (num > 9999) {
        throw error(`Integer exceeding 9999 is too large: "${str.slice(pos, end)}".`, pos, end)
      }
      pos = end
    }

    if (pos == str.length || str[pos].match(/\s/)) {
      throw error(`Unexpected end of a format specifier "${str.slice(start, pos)}".`, start, pos)
    }

    // bail out when num is not null
    function assertNoNum(posFmt: number = pos) {
      if (num != null) {
        throw error(`This format specifier "${str[posFmt]}" does not support a number prefix.`, posNumStart, posFmt + 1)
      }
    }

    function setSpecifierToken(newPos: number, id: SpecifierID, tok?: {}) {
      pos = newPos
      return (token = { type: 'specifier', id, ...tok, ...mods })
    }

    switch (str[pos]) {
    case 'A': assertNoNum(); return setSpecifierToken(pos + 1, 'address')
    case 'C': assertNoNum(); return setSpecifierToken(pos + 1, 'coins')
    case 'B': assertNoNum(); return setSpecifierToken(pos + 1, 'boolean')
    case 'D':
    case 'E': {
      const posFmtStart = pos
      let id = str[pos++]

      if (id == 'D' && str[pos] == '*') {
        id = 'D*'
        pos++
      } else if (id == 'E' && str[pos] == '^') {
        id = 'E^'
        pos++
      }
      const tt = ({ D: 'dict', 'D*': 'dictDirect', E: 'either', 'E^': 'eitherIndirect' } as const)[id]!

      if (str[pos] != '{') {
        const alt = id == 'D' ? '*' : '^'
        throw error(`Expected "{" or "${alt}{" immediately after "${id}"`, posFmtStart, pos)
      }
      assertNoNum()
      return setSpecifierToken(pos + 1, tt)
    }

    case 's': assertNoNum(); return setSpecifierToken(pos + 1, 'tail')

    case 'h': assertNoNum(); return setSpecifierToken(pos + 1, 'int', { bits: 16 })
    case 'H': assertNoNum(); return setSpecifierToken(pos + 1, 'uint', { bits: 16 })
    case 'q': assertNoNum(); return setSpecifierToken(pos + 1, 'int', { bits: 64 })
    case 'Q': assertNoNum(); return setSpecifierToken(pos + 1, 'uint', { bits: 64 })

    case 'b': return setSpecifierToken(pos + 1, 'bits',  { count: num ?? 1 })
    case 'c': return setSpecifierToken(pos + 1, 'bytes', { count: num ?? 1 })
    case 'i': return setSpecifierToken(pos + 1, 'int',  { bits: num ?? 32 })
    case 'u': return setSpecifierToken(pos + 1, 'uint', { bits: num ?? 32 })
    case 'v': {
      const tt =
        str[pos + 1] == 'i' ? 'varint' :
        str[pos + 1] == 'u' ? 'varuint' :
        null

      if (tt == null) {
        throw error('Expected "i" or "u" immediately after "v"')
      }
      if (num == null) {
        throw error('Must specify length for a variable-length integer', pos, pos + 2)
      }
      return setSpecifierToken(pos + 2, tt, { sizeBytes: num })
    }

    case '(': assertNoNum(); pos++; return (token = { type: '(', ...mods })
    }

    throw error(`Unexpected character ${JSON.stringify(str[pos])}.`)
  }

  function accept(tp: Token['type']) {
    if (token.type == tp) {
      next()
      return true
    }
    return false
  }

  function expect(tp: Token['type']) {
    if (token.type == tp) {
      return next()
    }
    throw error(`Unexpected token type; expected ${tp} but got ${token.type}.`)
  }

  function parseDictKeyTypeArg(): DictKeyType {
    const { id, skip, maybe, ref, ...rest } = token as any
    expect('specifier')
    if (skip || maybe || ref) {
      throw error('Cannot apply modifiers on a dict key type.')
    }
    switch (id) {
    case 'int':
      return { ctor: rest.bits >= 54 ? 'BigInt' : 'Int', arg: rest.bits }
    case 'uint':
      return { ctor: rest.bits >= 54 ? 'BigUint' : 'Uint', arg: rest.bits }
    case 'bytes':
      return { ctor: 'BitString', arg: rest.count * 8 }
    case 'bits':
      return { ctor: 'BitString', arg: rest.count }
    case 'address':
      return { ctor: 'Address' }
    }
    throw error(`Unsupported key type "${id}"`)
  }

  function parseDictDef(base: {direct: boolean}): FieldDesc {
    const keyType = parseDictKeyTypeArg()
    let valueParser: FieldDesc[] = []
    if (accept(',')) {
      valueParser = parseSlice('}')
    }
    expect('}')
    return { type: 'dict', ...base, keyType, valueParser }
  }

  function parseEitherDef(base: {}): FieldDesc {
    const side0 = parseSlice(',')
    expect(',')
    const side1 = parseSlice('}')
    expect('}')
    return { type: 'either', ...base, side0, side1 }
  }

  function parseEitherIndirectDef(base: {}): FieldDesc {
    const content = parseSlice('}')
    expect('}')
    return { type: 'eitherIndirect', ...base, content }
  }

  function parseSlice(stop?: Token['type']): FieldDesc[] {
    const list: FieldDesc[] = []
    while ((stop == null || token.type != stop) && token.type != 'eof') {
      let instr: FieldDesc

      const { type: tokenType, skip, maybe, ref, ...rest } = token as any

      if (accept('(')) {
        const children = parseSlice(')')
        instr = { type: 'group', ...rest, children }
        expect(')')
      } else if (accept('$')) {
        list.push({ type: 'endParse' })
        break
      } else if (accept('_')) {
        list.push({ type: 'dump' })
        break
      } else {
        expect('specifier')
        const { id, ...specRest } = rest
        if (id == 'dict' || id == 'dictDirect') {
          instr = parseDictDef({...specRest, direct: id == 'dictDirect'})
        } else if (id == 'either') {
          instr = parseEitherDef(specRest)
        } else if (id == 'eitherIndirect') {
          instr = parseEitherIndirectDef(specRest)
        } else {
          instr = { type: id, ...specRest }
        }
      }

      if (ref) instr = { type: 'ref', instr }
      if (maybe) {
        if (tokenType == 'specifier' && instr.type == 'address') {
          // specialize it because "loadMaybeAddress" is different from other maybes
          instr.type = '?address'
        } else {
          instr = { type: 'maybe', instr }
        }
      }
      if (skip) instr = { type: 'skip', instr }
      list.push(instr)
    }
    return list
  }

  next()
  const result = parseSlice()
  // the TS compiler is clever enough to deduce that this does not happen!
  // if (token.type != 'eof') {
  //   throw error(`Expected input end but met token "${token.type}".`)
  // }
  return result
}
