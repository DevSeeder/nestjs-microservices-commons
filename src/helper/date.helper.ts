export class DateHelper {
  static getLocaleDateNow(timeZone = 'America/Sao_Paulo') {
    const dateLocal =
      new Date()
        .toLocaleString('en-CA', { timeZone, hour12: false })
        .replace(/, /, 'T') + '.000Z';
    return new Date(dateLocal);
  }

  static getDateNow() {
    return new Date();
  }

  static formatDate(date: Date, format: string): string {
    const dateObj = {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };

    const formatOptions = {
      YYYY: 'year',
      MM: 'month',
      DD: 'day',
      HH: 'hour',
      mm: 'minute',
      ss: 'second',
    };

    let formattedDate = format;
    Object.keys(formatOptions).forEach((option) => {
      formattedDate = formattedDate.replace(
        option,
        String(dateObj[formatOptions[option]]).padStart(2, '0'),
      );
    });

    return formattedDate;
  }
}
