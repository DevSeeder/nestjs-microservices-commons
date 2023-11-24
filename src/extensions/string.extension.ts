declare global {
  interface String {
    capitalize(): string;
    replaceAll(search: string, replacement: string): string;
    capitalizeFirstLetter(): string;
  }
}

String.prototype.capitalize = function () {
  return this.replace(/(^\w{1})|(\s+\w{1})/g, (letter) => letter.toUpperCase());
};

String.prototype.replaceAll = function (search: string, replacement: string) {
  return this.split(search).join(replacement);
};

String.prototype.capitalizeFirstLetter = function (): string {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

export {};
