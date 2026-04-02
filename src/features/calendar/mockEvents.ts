import type { LiturgicalEvent } from './types';

export const seededLiturgicalEvents: LiturgicalEvent[] = [
  {
    id: 'annunciation-2026',
    dateISO: '2026-04-07',
    rank: 'great-feast',
    recurrence: 'none',
    title: {
      en: 'Annunciation of the Theotokos',
      ko: '성모 희보 대축일',
    },
    summary: {
      en: 'Commemoration of the Annunciation to the Virgin Mary.',
      ko: '천사가 성모 마리아에게 수태를 알린 사건을 기념합니다.',
    },
    details: {
      en: 'One of the Great Feasts in the Orthodox liturgical year. Divine Liturgy and festal hymns are served.',
      ko: '정교회 전례력의 대축일 중 하나로, 성찬예배와 축일 찬송이 봉헌됩니다.',
    },
  },
  {
    id: 'palm-sunday-2026',
    dateISO: '2026-04-12',
    rank: 'major-feast',
    recurrence: 'none',
    title: {
      en: 'Palm Sunday',
      ko: '종려주일',
    },
    summary: {
      en: 'Entry of our Lord into Jerusalem.',
      ko: '주님의 예루살렘 입성을 기념합니다.',
    },
    details: {
      en: 'Begins Holy Week and celebrates Christ received with palms and praise.',
      ko: '성주간이 시작되며, 종려나무 가지로 주님을 맞이한 사건을 기념합니다.',
    },
  },
  {
    id: 'pascha-2026',
    dateISO: '2026-04-19',
    rank: 'great-feast',
    recurrence: 'none',
    title: {
      en: 'Holy Pascha',
      ko: '부활 대축일',
    },
    summary: {
      en: 'Feast of the Resurrection of Christ.',
      ko: '그리스도의 부활을 기념하는 가장 큰 축일입니다.',
    },
    details: {
      en: 'The Feast of Feasts. Midnight service and Paschal Divine Liturgy are celebrated with joy.',
      ko: '축일 중의 축일로, 자정예배와 부활 성찬예배를 기쁨으로 봉헌합니다.',
    },
  },
  {
    id: 'st-george-2026',
    dateISO: '2026-04-23',
    rank: 'commemoration',
    recurrence: 'none',
    title: {
      en: 'Great-Martyr George',
      ko: '대순교자 게오르기오스',
    },
    summary: {
      en: 'Commemoration of Saint George the Trophy-Bearer.',
      ko: '승리자 성 게오르기오스를 기념합니다.',
    },
    details: {
      en: 'A beloved saint in many Orthodox communities. Services include special hymns and readings.',
      ko: '여러 정교회 공동체에서 공경받는 성인으로, 특별 찬송과 독서가 포함됩니다.',
    },
  },
  {
    id: 'ascension-2026',
    dateISO: '2026-05-28',
    rank: 'major-feast',
    recurrence: 'none',
    title: {
      en: 'Ascension of the Lord',
      ko: '주 승천 축일',
    },
    summary: {
      en: 'Commemoration of Christ ascending into heaven.',
      ko: '주님의 승천을 기념합니다.',
    },
    details: {
      en: 'Celebrated forty days after Pascha, proclaiming Christ enthroned in glory.',
      ko: '부활 후 40일째 기념하며, 영광 중에 오르신 그리스도를 선포합니다.',
    },
  },
  {
    id: 'admin-draft-sample-2026',
    dateISO: '2026-06-03',
    rank: 'commemoration',
    isAdminDraft: true,
    recurrence: 'none',
    title: {
      en: '[Draft] Parish Pilgrimage Day',
      ko: '[초안] 본당 순례의 날',
    },
    summary: {
      en: 'Draft event pending admin review and publication.',
      ko: '관리자 검토 및 게시 대기 중인 초안 행사입니다.',
    },
    details: {
      en: 'This event is visible only in admin workflows and should not be shown to all users after publication filter is enabled.',
      ko: '이 행사는 관리자 워크플로에서만 보이며, 게시 필터 적용 후 일반 사용자에게는 노출되지 않습니다.',
    },
  },
];
