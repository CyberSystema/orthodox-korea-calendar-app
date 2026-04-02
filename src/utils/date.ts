import dayjs from 'dayjs';
import 'dayjs/locale/ko';

export function formatDisplayDate(isoDate: string, language: 'en' | 'ko') {
  return dayjs(isoDate)
    .locale(language)
    .format(language === 'ko' ? 'YYYY년 M월 D일 dddd' : 'dddd, MMMM D, YYYY');
}
