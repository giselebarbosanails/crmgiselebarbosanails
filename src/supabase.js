import { createClient } from '@supabase/supabase-js'
// A chave "publishable" é pública por design: quem protege os dados é o login + RLS.
export const supabase = createClient(
  'https://bkxphwwkvaurgvuawokt.supabase.co',
  'sb_publishable_MMVdhiA59VQRmmV0FNb0bQ_fK-APae8'
)
