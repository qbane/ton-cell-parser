import { BuildTuple } from 'type-fest/source/internal'
import { Infer } from '../src/static'

describe('static', () => {
  it('infers integral types', () => {
    assertType<Infer<'i i i'>>([1, 2, 3])
    assertType<Infer<'1i2i 3i  3vi 53i54i'>>([1, 2, 3, 3n, 53, 54n])
    assertType<Infer<'1i(2i(3i)4i(5i6i))C'>>([1, [2, [3], 4, [5, 6]], 7n])
  })

  it('infers either types', () => {
    assertType<Infer<'E{16i, A}'>[]>([
      [{ type: 'either', side: 0, value: [123] }],
      [{ type: 'either', side: 1, value: ['asd'] }]
    ])
    assertType<Infer<'E^{C}'>>([{ type: 'either', side: 0, value: [123n] }])
  })

  it('skips a field according to the modifier', () => {
    assertType<Infer<'?16i*16i'>>([{ type: 'maybe', some: false }])
  })

  it('does not exhabit combinatorial explosions on maybes', () => {
    // should not distribute to 2^40 choices
    assertType<
      Infer<'?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A?A'>>
      (new Array(40).fill(null) as BuildTuple<40, null>)
  })


  it('infers dicts', () => {
    assertType<Infer<'D{16i,}'>>([{
      type: 'dict',
      keyBits: 16,
      entries: [[1, []]],
    }])

    assertType<Infer<'D{16i}'>>([{
      type: 'dict',
      keyBits: 16,
      entries: [[1, []]],
    }])

    assertType<Infer<'D*{16i,}'>>([{
      type: 'dict',
      direct: true,
      keyBits: 16,
      entries: [[1, []]],
    }])

    assertType<
      Infer<'  D{     256i , D{ 16i , 3i }   }  '>
    >([{
      type: 'dict',
      keyBits: 256,
      entries: [
        [1n, [
          {
            type: 'dict',
            keyBits: 16,
            entries: [[2, [3]], [4, [5]]]
          }
        ]]
      ]
    }])
  })

  it('works on real-world cells', () => {
    assertType<Infer<`cBC^(AC)
    24uBB
    24u
    32c
    ^(
      ^(D{256b,CC}uuCCCBC)
      ^(D{256b,CC}uuCCCBC)
    )
    CC24u
    Cc6c
    ^(
      A48uA48uA
      ^(AA A )
    )
    ^(^()^()^())
    `>>([
      "00",
      false,
      944614808025117n,
      [
        "0:6e2215cd36459ff405bd9a234635348efee159db77a37c85ab89e5e07b97fbdf",
        967477506146730n
      ],
      2982,
      false,
      true,
      0,
      "C56B4CDE540D531B8121DF3A2212A4EECD76F03C9F839E80CB065A74F7F7E9BA",
      [
        [
          {
            "type": "dict",
            "keyBits": 256,
            "entries": []
          },
          38,
          0,
          0n,
          0n,
          0n,
          false,
          0n
        ],
        [
          {
            "type": "dict",
            "keyBits": 256,
            "entries": [
              [
                "46391D70A8914F5696C73B139B4804E475B7D38B34539838BA0DD8C91586912A",
                [
                  942508368946942n,
                  167522427809n
                ]
              ]
            ]
          },
          37,
          1,
          942508368946942n,
          942675891374751n,
          0n,
          false,
          0n
        ]
      ],
      1000000000n,
      2000000000000000n,
      2684355,
      0n,
      "FF",
      "000000000000",
      [
        "0:3d273667ea94250b16a8d14630d30ba6bd46a6ac4a588a833f0aabdd9879a30f",
        0,
        "0:3d273667ea94250b16a8d14630d30ba6bd46a6ac4a588a833f0aabdd9879a30f",
        281474976710655,
        "0:3d273667ea94250b16a8d14630d30ba6bd46a6ac4a588a833f0aabdd9879a30f",
        [
          "0:3d273667ea94250b16a8d14630d30ba6bd46a6ac4a588a833f0aabdd9879a30f",
          "0:3d273667ea94250b16a8d14630d30ba6bd46a6ac4a588a833f0aabdd9879a30f",
          "0:1753bb31bf950b8c815784219990818a91e4ca227298f007968adcd95d789a53"
        ]
      ],
      [
        [],
        [],
        []
      ]
    ])
  })
})
