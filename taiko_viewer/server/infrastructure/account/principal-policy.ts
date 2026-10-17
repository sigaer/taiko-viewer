/** Bot identities and score Sources are separate capability subjects. */
export const validBotPrincipal = (value:unknown):value is string => typeof value==='string' &&
  /^(?:[0-9]{1,128}|onebot_v11:[0-9]{1,128}|qq_official:[A-Za-z0-9_-]{1,128})$/.test(value);
export function validateServicePrincipals(value:unknown){
  if(value==='*')return '*' as const;
  if(!Array.isArray(value)||!value.length||value.length>128||new Set(value).size!==value.length||value.some(item=>!validBotPrincipal(item)))throw new Error('Invalid service principals');
  return Object.freeze([...value].sort()) as readonly string[];
}
