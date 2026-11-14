import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { ymd } from './util'

const SEG = [
  { id: 'r30', l: 'Sem voltar há 30+ dias', m: 'retorno' },
  { id: 'r45', l: 'Sem voltar há 45+ dias', m: 'retorno' },
  { id: 'r60', l: 'Sem voltar há 60+ dias', m: 'retorno' },
  { id: 'aniv', l: 'Aniversariantes do mês', m: 'aniv' },
  { id: 'freq', l: 'Frequentes (3+ atendimentos em 12 meses)', m: 'novidade' },
  { id: 'insta', l: 'Vieram do Instagram', m: 'promo' },
  { id: 'nunca', l: 'Ainda sem atendimento registrado', m: 'novidade' },
  { id: 'todas', l: 'Todas as clientes', m: 'promo' },
]
const MSG = {
  retorno: 'Oi, {nome}! Tudo bem? Faz um tempinho que não te vejo por aqui. Vamos marcar sua manutenção? 💅',
  promo: 'Oi, {nome}! Tenho uma novidade para você: [escreva aqui a promoção]. Vamos agendar? 💅',
  aniv: 'Parabéns, {nome}! 🎉 Que seu dia seja lindo! Um beijo do estúdio 💅',
  novidade: 'Oi, {nome}! Chegaram novidades no estúdio ✨ Quer conhecer? Me chama aqui!',
}
const dias = (s) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  const h = new Date()
  return Math.round((new Date(h.getFullYear(), h.getMonth(), h.getDate()) - new Date(y, m - 1, d)) / 86400000)
}
const link = (tel, msg) => {
  let d = (tel || '').replace(/\D/g, '')
  if (d.length <= 11) d = '55' + d
  return 'https://wa.me/' + d + '?text=' + encodeURIComponent(msg)
}

export default function Campanhas() {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [seg, setSeg] = useState('r30')
  const [msg, setMsg] = useState(MSG.retorno)
  const [enviados, setEnviados] = useState({})

  useEffect(() => {
    (async () => {
      const h = new Date()
      const a = new Date(h.getFullYear() - 1, h.getMonth(), h.getDate())
      const [c, f, p] = await Promise.all([
        supabase.from('clientes').select('id,nome,telefone,telefone_incompleto,ultimo_atendimento,data_nascimento,origem').eq('ativa', true).order('nome').limit(5000),
        supabase.from('agendamentos').select('cliente_id').in('status', ['agendado', 'confirmado']).gte('inicio', h.toISOString()),
        supabase.from('pagamentos').select('cliente_id,tipo').in('tipo', ['total', 'restante']).gte('pago_em', ymd(a)),
      ])
      const e = c.error || f.error || p.error
      if (e) return setErro('Não foi possível carregar: ' + e.message)
      const q = {}
      p.data.forEach((i) => { if (i.cliente_id) q[i.cliente_id] = (q[i.cliente_id] || 0) + 1 })
      setD({ c: c.data, fut: new Set(f.data.map((x) => x.cliente_id)), q })
    })()
  }, [])

  if (erro) return <p className="erro">{erro}</p>
  if (!d) return <p className="vazio">Carregando…</p>

  const mes = new Date().getMonth() + 1
  const grupo = d.c.filter((c) => {
    const du = c.ultimo_atendimento ? dias(c.ultimo_atendimento) : null
    if (seg === 'r30') return du !== null && du >= 30 && !d.fut.has(c.id)
    if (seg === 'r45') return du !== null && du >= 45 && !d.fut.has(c.id)
    if (seg === 'r60') return du !== null && du >= 60 && !d.fut.has(c.id)
    if (seg === 'aniv') return c.data_nascimento && Number(c.data_nascimento.slice(5, 7)) === mes
    if (seg === 'freq') return (d.q[c.id] || 0) >= 3
    if (seg === 'insta') return /insta/i.test(c.origem || '')
    if (seg === 'nunca') return !c.ultimo_atendimento
    return true
  })
  const comZap = grupo.filter((c) => c.telefone && !c.telefone_incompleto)
  const escolher = (id) => { setSeg(id); setMsg(MSG[SEG.find((s) => s.id === id).m]) }

  return (
    <section>
      <label>Quem vai receber
        <select value={seg} onChange={(e) => escolher(e.target.value)}>
          {SEG.map((s) => <option key={s.id} value={s.id}>{s.l}</option>)}
        </select>
      </label>
      <label>Mensagem (use {'{nome}'} para o primeiro nome da cliente)
        <textarea rows="4" value={msg} onChange={(e) => setMsg(e.target.value)} />
      </label>
      {msg.includes('[escreva') && <p className="erro">Troque o trecho [escreva aqui a promoção] pela sua promoção antes de enviar.</p>}
      <p className="contagem">{grupo.length} cliente(s) neste grupo · {comZap.length} com WhatsApp válido{grupo.length > comZap.length ? ` · ${grupo.length - comZap.length} sem telefone completo` : ''}. Você envia uma de cada vez, tocando em “Enviar”.</p>
      {comZap.length === 0 && <p className="vazio">Ninguém neste grupo por enquanto.</p>}
      <ul className="itens">
        {comZap.map((c) => (
          <li key={c.id} className="arq">
            <div><strong>{c.nome}</strong>{c.ultimo_atendimento && <small>{dias(c.ultimo_atendimento)} dias desde o último atendimento</small>}</div>
            <a className={'zap' + (enviados[c.id] ? ' feito' : '')} href={link(c.telefone, msg.split('{nome}').join(c.nome.split(' ')[0]))} target="_blank" rel="noreferrer" onClick={() => setEnviados((e) => ({ ...e, [c.id]: true }))}>
              {enviados[c.id] ? 'Enviado ✓' : 'Enviar'}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
