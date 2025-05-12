import { GreaterThanOrEqual, Merge } from 'type-fest'
import { BuildTuple, Whitespace } from 'type-fest/source/internal'

type TrimWS<S extends string> =
  S extends `${Whitespace}${infer R}` ? (
    R extends `${Whitespace}${infer RR}` ? (
      RR extends `${Whitespace}${infer RRR}` ? (
        RRR extends `${Whitespace}${infer RRRR}` ? TrimWS<RRRR> : RRR
      ) : RR) : R) : S

export type Trim<S extends string> =
  S extends `/*${string}*/${infer R}` ? Trim<R> :
  S extends `//${string}${'\r' | '\n'}${infer R}` ? Trim<R> :
  S extends `//${string}` ? '' :
  S extends `${Whitespace}${string}` ? (TrimWS<S> extends infer R extends string ? Trim<R> : never) :
  S

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

type ParseInteger<S extends string> = S extends `${infer N extends number}` ? N : never

type _MapIntLikeSpecifier<S extends string, BitLengthLimit extends number> =
  S extends '' ? number :
  string extends S ? (bigint | number) :
  ParseInteger<S> extends number ?
    (GreaterThanOrEqual<ParseInteger<S>, BitLengthLimit> extends true ? bigint : number) :
  never

type MapIntSpecifier<S extends string> = _MapIntLikeSpecifier<S, 54>
type MapVarIntSpecifier<S extends string> = _MapIntLikeSpecifier<S, 3>

type MapMaybeSpecifier<X> =
  (string | null) extends X ? X : (
  | { type: 'maybe', some: false }
  | { type: 'maybe', some: true, value : X })

type MapDictSpecifier<K, V, D = false> =
  K extends [infer BitLength, infer KeyType] ? {
    type: 'dict',
    keyBits: BitLength,
    entries: [KeyType, V][]
  } & (D extends true ? {direct: true} : {}) :
  never

type MapEitherSpecifier<X, Y> = X extends unknown ? (
  | { type: 'either', side: 0, value: X }
  | { type: 'either', side: 1, value: Y }) :
  never

type MapEitherIndirectSpecifier<X> = X extends unknown ? { type: 'either', side: 0 | 1, value: X } : never

interface DumpObject {
  leftover: string
}

// roll our own to maximize range support at 999 (type-fest dies at 250)
type Multiply8<N extends number> = [
  ...BuildTuple<N>, ...BuildTuple<N>, ...BuildTuple<N>, ...BuildTuple<N>,
  ...BuildTuple<N>, ...BuildTuple<N>, ...BuildTuple<N>, ...BuildTuple<N>]['length']

type SplitSpecifierLeadingNum<T extends string, Snum extends string = ''> =
  T extends `${infer N extends Digit}${infer R}` ? SplitSpecifierLeadingNum<R, `${Snum}${N}`> :
  [Snum, T]

type ParseStaticSizedSpecifier<T extends string> =
  SplitSpecifierLeadingNum<T> extends [infer Snum extends string, infer R extends string] ?
    ParseStaticSizedSpecifierInner<R, Snum> : never

// for the diverging behavior of "maybe address" being mapped to (string | null)
declare const ADDRESS_TYPE_BRAND: unique symbol

type ParseStaticSizedSpecifierInner<T extends string, Snum extends string = ''> =
  T extends `${infer C}${infer R}` ? ((
    C extends 'i' | 'u' ? [Snum extends '' ? 32 : ParseInteger<Snum>, MapIntSpecifier<Snum>] :
    C extends 'b'       ? [Snum extends '' ? 1 : ParseInteger<Snum>, string] :
    C extends 'c'       ? [Multiply8<Snum extends '' ? 1 : ParseInteger<Snum>>, string] :
    C extends 'h' | 'H' ? (Snum extends '' ? [16, number] : []) :
    C extends 'q' | 'Q' ? (Snum extends '' ? [64, bigint] : []) :
    C extends 'A'       ? (Snum extends '' ? [267, typeof ADDRESS_TYPE_BRAND] : []) :
    C extends 'B'       ? (Snum extends '' ? [1, boolean] : []) :
    []
  ) extends [infer BitLen extends number, infer ValueType] ?
    // force BitLen to be const
    number extends BitLen ? never : [BitLen, ValueType, R] :
    []) :
  []


type ModifierDesc = {
  skip?: true,
  maybe?: true,
  ref?: true,
}

type ModParseSpecs = [['*', { skip: true }], ['?', { maybe: true }], ['^', { ref: true }]]

type TryConsume<T extends string, Pat extends string> =
  T extends `${Pat}${infer R}` ? [true, R] : [false, T]

type ParseModifiers<T extends string, CharSpecs extends [string, ModifierDesc][] = ModParseSpecs, Acc extends Record<string, true> = {}> =
  CharSpecs extends [infer CSH extends [string, ModifierDesc], ...infer CST extends [string, ModifierDesc][]] ? (
    TryConsume<T, CSH[0]> extends [true, infer Rest extends string] ?
      ParseModifiers<Rest, CST, Merge<Acc, CSH[1]>> :
      ParseModifiers<T, CST, Acc>) :
  [Acc, T]

type MapValueType<X, Mods extends ModifierDesc> =
  Mods extends { skip: true } ? undefined :
  Mods extends { maybe: true } ? MapMaybeSpecifier<X> :
  X

type ParseSpecifier<T extends string> =
  ParseModifiers<T> extends [infer Mods extends ModifierDesc, infer R extends string] ? (
    SplitSpecifierLeadingNum<R> extends [infer Snum extends string, infer RR extends string] ? (
      ParseSpecifierInner<RR, Mods, Snum> extends [infer X, infer RRR extends string] ?
        [MapValueType<X, Mods>, RRR] :
        []) :
    never) :
  never

// TODO: custom mapper
type ParseSpecifierInner<T extends string, Mods extends ModifierDesc = {}, Snum extends string = ''> =
  ParseStaticSizedSpecifierInner<T, Snum> extends
    [infer _BitLen extends number, infer ValueType, infer R extends string] ? (
      ValueType extends typeof ADDRESS_TYPE_BRAND ?
        [Mods extends { maybe: true } ? (string | null) : string, R] :
      [ValueType, R]) :
  T extends `v${'i' | 'u'}${infer R}` ? [MapVarIntSpecifier<Snum>, R] :
  T extends `C${infer R}` ? (Snum extends '' ? [bigint, R] : []) :
  T extends `s${infer R}` ? (Snum extends '' ? [string, R] : []) :
  T extends `_${infer R}` ? (Snum extends '' ? [DumpObject, R] : []) :

  ParseSequence<T, ['(', {type: 'expr'}, ')']> extends
    [[infer X], infer R] ? [X, R] :

  ParseSequence<T, ['D{', {type: 'staticSpec'}, '}']> extends
    [[infer X], infer R] ? [MapDictSpecifier<X, []>, R] :
  ParseSequence<T, ['D{', {type: 'staticSpec'}, ',', {type: 'expr'}, '}']> extends
    [[infer X, infer Y], infer R] ? [MapDictSpecifier<X, Y>, R] :

  // error recovery: merely type the dict as never when the parse fail, do not invalidate the whole expr
  // TODO: generalizing arg list parsing to simplify the usage
  ParseSequence<T, ['D{', {type: 'expr'}, '}']> extends
    [infer _, infer R] ? [never, R] :
  ParseSequence<T, ['D{', {type: 'expr'}, ',', {type: 'expr'}, '}']> extends
    [infer _, infer R] ? [never, R] :

  // FIXME: should make a concise construct to allow "D{ | D*{"
  ParseSequence<T, ['D*{', {type: 'staticSpec'}, '}']> extends
    [[infer X], infer R] ? [MapDictSpecifier<X, [], true>, R] :
  ParseSequence<T, ['D*{', {type: 'staticSpec'}, ',', {type: 'expr'}, '}']> extends
    [[infer X, infer Y], infer R] ? [MapDictSpecifier<X, Y, true>, R] :
  ParseSequence<T, ['D*{', {type: 'expr'}, '}']> extends
    [infer _, infer R] ? [never, R] :
  ParseSequence<T, ['D*{', {type: 'expr'}, ',', {type: 'expr'}, '}']> extends
    [infer _, infer R] ? [never, R] :

  ParseSequence<T, ['E{', {type: 'expr'}, ',', {type: 'expr'}, '}']> extends
    [[infer X, infer Y], infer R] ? [MapEitherSpecifier<X, Y>, R] :
  ParseSequence<T, ['E^{', {type: 'expr'}, '}']> extends
    [[infer X], infer R] ? [MapEitherIndirectSpecifier<X>, R] :
  []

type ParserRule =
  | string
  | { type: 'expr' }
  | { type: 'staticSpec' }

// allow whitespaces after each item
type ParseSequence<T extends string, Seq extends ParserRule[], Results extends unknown[] = []> =
  Seq extends [infer Rule, ...infer SeqRest extends ParserRule[]] ? (
    Rule extends string ? (
      T extends `${Rule}${infer R}` ?
        ParseSequence<Trim<R>, SeqRest, Results> : []) :
    Rule extends { type: 'expr' } ? (
      ParseExpr<T> extends [infer X, infer R extends string] ?
        ParseSequence<Trim<R>, SeqRest, [...Results, X]> : []) :
    Rule extends { type: 'staticSpec' } ? (
      ParseStaticSizedSpecifier<T> extends [infer BL extends number, infer VT, infer R extends string] ?
        ParseSequence<Trim<R>, SeqRest, [...Results, [BL, VT]]> : []) :
    []
  ) :
  [Results, T]

type ParseTerm<T extends string> =
  ParseSpecifier<Trim<T>> extends [infer ValueType, infer R extends string] ?
    [ValueType, R] :
    []

export type ParseExpr<T extends string, Results extends unknown[] = []> =
  // TODO: force it end parsing
  T extends `$${infer R}` ? ParseExpr<R, Results> :

  ParseTerm<T> extends [infer X, infer R extends string] ? (
    // must not distribute X; would cause combinatorial explosion
    undefined extends X ?
      ParseExpr<R, Results> :
      ParseExpr<R, [...Results, X]>) :
  [Results, T]

export type Infer<T extends string> =
  ParseExpr<T> extends [infer X, infer R extends string] ? (
    Trim<R> extends '' ? X : never
  ) :
  never
