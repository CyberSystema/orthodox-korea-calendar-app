import type { LiturgicalDay } from './types';

export const seededLiturgicalDays: LiturgicalDay[] = [
  {
    dateISO: '2026-04-07',
    fast: false,
    cheese: false,
    fish: true,
    presanctified: false,
    saintBasil: false,
    divineLiturgy: true,
    readings: ['Hebrews 2:11-18', 'Luke 1:24-38'],
    celebrations: [
      {
        id: 'annunciation-main',
        title: {
          en: 'Annunciation of the Theotokos',
          ko: '성모 희보 대축일',
        },
        highRank: true,
        feast: true,
        readings: ['Hebrews 2:11-18', 'Luke 1:24-38'],
        tone: '4',
      },
    ],
  },
  {
    dateISO: '2026-04-12',
    fast: false,
    cheese: false,
    fish: true,
    presanctified: false,
    saintBasil: false,
    divineLiturgy: true,
    readings: ['Philippians 4:4-9', 'John 12:1-18'],
    celebrations: [
      {
        id: 'palm-sunday-main',
        title: {
          en: 'Palm Sunday',
          ko: '종려주일',
        },
        highRank: true,
        feast: true,
        readings: ['Philippians 4:4-9', 'John 12:1-18'],
      },
    ],
  },
  {
    dateISO: '2026-04-19',
    fast: false,
    cheese: false,
    fish: false,
    presanctified: false,
    saintBasil: true,
    divineLiturgy: true,
    readings: ['Acts 1:1-8', 'John 1:1-17'],
    celebrations: [
      {
        id: 'pascha-main',
        title: {
          en: 'Holy Pascha: Resurrection of Christ',
          ko: '거룩한 파스카: 그리스도의 부활',
        },
        highRank: true,
        feast: true,
        tone: '1',
        matinsGospel: 'Mark 16:1-8',
      },
    ],
  },
  {
    dateISO: '2026-04-23',
    fast: false,
    cheese: false,
    fish: false,
    presanctified: false,
    saintBasil: false,
    divineLiturgy: true,
    readings: ['2 Timothy 2:1-10', 'John 15:17-16:2'],
    celebrations: [
      {
        id: 'st-george-main',
        title: {
          en: 'Great-Martyr George the Trophy-Bearer',
          ko: '대순교자 승리자 게오르기오스',
        },
        highRank: true,
      },
    ],
  },
  {
    dateISO: '2026-05-28',
    fast: false,
    cheese: false,
    fish: false,
    presanctified: false,
    saintBasil: false,
    divineLiturgy: true,
    readings: ['Acts 1:1-12', 'Luke 24:36-53'],
    celebrations: [
      {
        id: 'ascension-main',
        title: {
          en: 'Ascension of the Lord',
          ko: '주 승천 축일',
        },
        highRank: true,
        feast: true,
      },
    ],
  },
];
