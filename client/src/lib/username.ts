import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";

export function generateUsername(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    separator: "",
    style: "capital",
    length: 3,
  });
}
