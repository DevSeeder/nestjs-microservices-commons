export class DateHelper {
  static getDateNow(timeZone = 'America/Sao_Paulo') {
    const dateLocal =
      new Date()
        .toLocaleString('en-CA', { timeZone, hour12: false })
        .replace(/, /, 'T') + '.000Z';
    return new Date(dateLocal);
  }
}
