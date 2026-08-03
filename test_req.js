require('https').request('https://ugchmuhjzzyofoogprlr.supabase.co/functions/v1/enviar-qr-gerencia', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.SUPABASE_ANON_KEY
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
}).on('error', console.error).end(JSON.stringify({ qrBase64: 'test', conductorNombre: 'test' }));
