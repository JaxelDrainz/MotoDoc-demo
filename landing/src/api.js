export async function api(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, { method, credentials:'same-origin', signal,
      headers: body !== undefined ? {'Content-Type':'application/json','X-MotoDoc-Request':'1'} : {},
      ...(body !== undefined ? {body:JSON.stringify(body)} : {}),
    });
  } catch(error) {
    if(error.name==='AbortError') throw error;
    throw new Error('MotoDoc could not connect. Please try again.');
  }
  const data = await response.json().catch(()=>({error:'The MotoDoc server is unavailable.'}));
  if(!response.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'),{status:response.status});
  return data;
}
