import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export async function publishRelease({repository, version, commit, token, notes, request=fetch}) {
 assert.equal(repository, 'sigaer/taiko-viewer');
 assert.match(version, /^\d+\.\d+\.\d+$/);
 assert.match(commit, /^[a-f0-9]{40}$/);
 assert.ok(token && notes.trim(), 'Release credentials and notes required');
 const base=`https://api.github.com/repos/${repository}`;
 const call=async(path, method='GET', body)=>request(base+path, {
  method, headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json','content-type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
  ...(body?{body:JSON.stringify(body)}:{}), signal:AbortSignal.timeout(30000)
 });
 const checked=async response=>{if(!response.ok)throw Error(`GitHub release request failed (${response.status})`);return response.json();};
 let ref=(await checked(await call(`/git/ref/tags/${version}`))).object;
 if(ref.type==='tag')ref=(await checked(await call(`/git/tags/${ref.sha}`))).object;
 assert.equal(ref.type,'commit');assert.equal(ref.sha,commit,'Tag must point at verified release commit');
 const existing=await call(`/releases/tags/${version}`);
 if(existing.status===200){
  const release=await existing.json();
  assert.equal(release.tag_name,version);assert.equal(release.draft,false);assert.equal(release.prerelease,false);
  assert.equal(release.body,notes,'Existing release must match reviewed notes; never overwrite');
  return release;
 }
 if(existing.status!==404)throw Error(`GitHub release lookup failed (${existing.status})`);
 return checked(await call('/releases','POST',{
  tag_name:version,target_commitish:commit,name:`Viewer ${version}`,body:notes,draft:false,prerelease:false,make_latest:'true'
 }));
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const pkg=JSON.parse(await readFile(new URL('../../taiko_viewer/package.json',import.meta.url),'utf8'));
 assert.equal(process.env.GITHUB_REF,`refs/tags/${pkg.version}`);
 const notes=await readFile(new URL(`../../docs/releases/${pkg.version}.md`,import.meta.url),'utf8');
 const release=await publishRelease({repository:process.env.GITHUB_REPOSITORY,version:pkg.version,commit:process.env.RELEASE_COMMIT,token:process.env.GITHUB_TOKEN,notes});
 console.log(JSON.stringify({url:release.html_url,tag:release.tag_name,draft:release.draft,prerelease:release.prerelease}));
}
