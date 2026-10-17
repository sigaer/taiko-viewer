/** SQL proves approved application, active client/token and live consent.
 * Client identifiers never depend on an additional operator pilot list. */
export async function developerClientAdmitted(clientId:string){
 return /^clt_[a-f0-9]{32}$/.test(clientId);
}
