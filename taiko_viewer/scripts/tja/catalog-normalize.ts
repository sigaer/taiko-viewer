/** Keep raw files intact; explicit #START markers identify the player side. */
export function normalizeCatalogTja(text: string) {
  return text.replace(/^([\t ]*)#START(?:[\t ]+P([12]))?[\t ]*(?:\/\/[^\r\n]*)?$/gim,
    (_line, indent, player) => `${indent}STYLE:${player ? 'Double' : 'Single'}\n${indent}#START${player ? ' P' + player : ''}`);
}
