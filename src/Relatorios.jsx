import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { brl, ymd } from './util'

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const feito = (t) => t === 'total' || t === 'restante'

export default function Relatorios() {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    (async () => {
      const h = new Date()
      const ini = new Date(h.getFullYear(), h.getMonth() - 5, 1)
      const [p, g, c] = await Promise.all([
        supabase.from('pagamentos').select('valor,pago_em,tipo,cliente_id,clientes(nome)').gte('pago_em', ymd(ini)).limit(5000),
        supabase.from('agendamentos').select('status,inicio').gte('inicio', ini.toISOString()).limit(5000),
        supabase.from('clientes').select('primeiro_atendimento').gte('primeiro_atendimento', ymd(ini)),
      ])
      const e = p.error || g.error || c.error
      if (e) return setErro('Não foi possível carregar os relatórios: ' + e.message)
      setD({ p: p.data, g: g.data, c: c.data })
    })()
  }, [])
  if (erro) return <p className="erro">{erro}</p>
  if (!d) return <p className="vazio">Carregando…</p>

  const h = new Date()
  const meses = [...Array(6)].map((_, i) => {
    const x = new Date(h.getFullYear(), h.getMonth() - i, 1)
    return { k: ymd(x).slice(0, 7), l: `${MES[x.getMonth()]}/${x.getFullYear()}` }
  })
  const linhas = meses.map((m) => {
    const pm = d.p.filter((i) => i.pago_em.slice(0, 7) === m.k)
    const fat = pm.reduce((t, i) => t + Number(i.valor), 0)
    const at = pm.filter((i) => feito(i.tipo)).length
    const gm = d.g.filter((i) => ymd(i.inicio).slice(0, 7) === m.k)
    const feitos = gm.filter((i) => i.status === 'concluido').length
    const faltas = gm.filter((i) => i.status === 'faltou').length
    return {
      ...m, fat, at,
      ticket: at ? fat / at : 0,
      taxaFalta: feitos + faltas ? Math.round((faltas / (feitos + faltas)) * 100) : null,
      novas: d.c.filter((i) => i.primeiro_atendimento.slice(0, 7) === m.k).length,
    }
  })
  const por = {}
  d.p.forEach((i) => {
    if (!i.cliente_id) return
    const c = (por[i.cliente_id] = por[i.cliente_id] || { n: i.clientes?.nome || 'Cliente', v: 0, q: 0 })
    c.v += Number(i.valor)
    if (feito(i.tipo)) c.q++
  })
  const top = Object.values(por).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 5)
  const atendidas = Object.values(por).filter((x) => x.q > 0)
  const retorno = atendidas.length ? Math.round((atendidas.filter((x) => x.q >= 2).length / atendidas.length) * 100) : null
  const atual = linhas[0], anterior = linhas[1]
  const dif = anterior.fat > 0 ? Math.round(((atual.fat - anterior.fat) / anterior.fat) * 100) : null

  return (
    <section>
      <div className="cards">
        <div><small>Ticket médio (mês)</small><strong>{brl(atual.ticket)}</strong></div>
        <div><small>Taxa de retorno (6 meses)</small><strong>{retorno === null ? '—' : retorno + '%'}</strong></div>
        <div><small>Taxa de faltas (mês)</small><strong>{atual.taxaFalta === null ? '—' : atual.taxaFalta + '%'}</strong></div>
        <div><small>Clientes novas (mês)</small><strong>{atual.novas}</strong></div>
      </div>
      <p className="contagem">{dif === null ? 'Sem faturamento no mês anterior para comparar.' : `Faturamento ${dif >= 0 ? 'subiu' : 'caiu'} ${Math.abs(dif)}% em relação ao mês anterior.`}</p>
      <h3>Comparação entre meses</h3>
      <ul className="itens">
        {linhas.map((l) => (
          <li key={l.k} className="arq">
            <div><strong>{l.l}</strong><small>{l.at} atendimento(s) · ticket {brl(l.ticket)} · faltas {l.taxaFalta === null ? '—' : l.taxaFalta + '%'} · {l.novas} nova(s)</small></div>
            <span>{brl(l.fat)}</span>
          </li>
        ))}
      </ul>
      <h3>Clientes que mais gastam (6 meses)</h3>
      {top.length === 0 && <p className="vazio">Ainda sem pagamentos registrados.</p>}
      <ul className="itens">
        {top.map((c) => (
          <li key={c.n} className="arq"><div><strong>{c.n}</strong><small>{c.q} atendimento(s)</small></div><span>{brl(c.v)}</span></li>
        ))}
      </ul>
      <p className="contagem">Ticket médio = faturamento ÷ atendimentos pagos. Taxa de faltas = faltas ÷ (concluídos + faltas). Clientes novas = primeiro atendimento no mês.</p>
    </section>
  )
}
