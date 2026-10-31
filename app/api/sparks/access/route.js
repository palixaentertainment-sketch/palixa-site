import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export async function GET(request) {
  if (process.env.SPARKS_ADMIN_ONLY !== 'true' || process.env.PAYSTACK_TEST_MODE !== 'true') return NextResponse.json({ enabled: false }, { status: 404 });
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const h=request.headers.get('authorization')||'', token=h.startsWith('Bearer ')?h.slice(7):'';
  if (!url||!anon||!service||!token) return NextResponse.json({enabled:false},{status:401});
  const userClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await userClient.auth.getUser(token);
  if(error||!data?.user?.id) return NextResponse.json({enabled:false},{status:401});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profile,error:profileError}=await admin.from('profiles').select('role,status').eq('id',data.user.id).maybeSingle();
  const enabled=!profileError&&profile?.role==='admin'&&profile?.status==='active';
  return NextResponse.json({enabled,testing:enabled});
}
