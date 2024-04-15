import handlebars from "handlebars";

export function render(template: string, context: object): string {
  return handlebars.compile(template, { noEscape: true })(context);
}
