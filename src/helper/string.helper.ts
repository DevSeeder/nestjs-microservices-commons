export class StringHelper {
  static capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  static generateRandomString(length) {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      randomString += charset[randomIndex];
    }

    return randomString;
  }

  static replaceTemplateObject(str: string, data: object) {
    if (!str || !data || !Object.keys(data).length) return str;

    return str.replace(/\$\{(\w+)\}/g, (match, token) => data[token] || match);
  }

  static extractKey(
    str: string,
    pattern: RegExp,
    matchIndex = 1
  ): string | null {
    const match = str.match(pattern);
    return match ? match[matchIndex] : null;
  }
}
