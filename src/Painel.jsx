import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { brl, ymd, hora, dataBR } from './util'

const ST = { agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado', faltou: 'Faltou' }

const diasDesde = (s) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  const h = new Date()
  return Math.round((new Date(h.getFullYear(), h.getMonth(), h.getDate()) - new Date(y, m - 1, d)) / 86400000)
}
const zapLink = (tel, nome) => {
  let d = (tel || '').replace(/\D/g, '')
  if (d.length <= 11) d = '55' + d
  const msg = `Oi, ${nome.split(' ')[0]}! Tudo bem? Faz um tempinho que não te vejo por aqui. Vamos marcar sua manutenção? 💅`
  return 'https://wa.me/' + d + '?text=' + encodeURIComponent(msg)
}

export default function Painel() {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [faixa, setFaixa] = useState(30)

  async function carregar() {
    const h = new Date()
    const ini = new Date(h.getFullYear(), h.getMonth(), h.getDate())
    const fim = new Date(ini); fim.setDate(fim.getDate() + 1)
    const mes0 = ymd(ini).slice(0, 7) + '-01'
    const mes1 = ymd(new Date(ini.getFullYear(), ini.getMonth() + 1, 1))
    const [c, hoje, fut, p] = await Promise.all([
      supabase.from('clientes').select('id,nome,telefone,telefone_incompleto,ultimo_atendimento').eq('ativa', true).limit(5000),
      supabase.from('agendamentos').select('id,inicio,status,clientes(nome),servicos(nome)').gte('inicio', ini.toISOString()).lt('inicio', fim.toISOString()).order('inicio'),
      supabase.from('agendamentos').select('cliente_id').in('status', ['agendado', 'confirmado']).gte('inicio', h.toISOString()),
      supabase.from('pagamentos').select('valor').gte('pago_em', mes0).lt('pago_em', mes1),
    ])
    const e = c.error || hoje.error || fut.error || p.error
    if (e) return setErro('Não foi possível carregar o painel: ' + e.message)
    setErro('')
    setD({
      clientes: c.data,
      hoje: hoje.data,
      futuras: new Set(fut.data.map((a) => a.cliente_id)),
      fat: p.data.reduce((t, i) => t + Number(i.valor || 0), 0),
    })
  }
  useEffect(() => { carregar() }, [])

  if (erro) return <p className="erro">{erro}</p>
  if (!d) return <p className="vazio">Carregando…</p>

  const retornar = d.clientes
    .filter((c) => c.ultimo_atendimento && !d.futuras.has(c.id))
    .map((c) => ({ ...c, dias: diasDesde(c.ultimo_atendimento) }))
    .filter((c) => c.dias >= 30)
    .sort((a, b) => b.dias - a.dias)
  const n = (min) => retornar.filter((c) => c.dias >= min).length
  const lista = retornar.filter((c) => c.dias >= faixa)
  const hojeValidos = d.hoje.filter((a) => a.status !== 'cancelado' && a.status !== 'faltou')
  const semHistorico = d.clientes.filter((c) => !c.ultimo_atendimento).length

  return (
    <section>
      <div className="cards">
        <div><small>Clientes ativas</small><strong>{d.clientes.length}</strong></div>
        <div><small>Atendimentos hoje</small><strong>{hojeValidos.length}</strong></div>
        <div><small>Faturamento do mês</small><strong>{brl(d.fat)}</strong></div>
        <div><small>Retornos pendentes</small><strong>{n(30)}</strong></div>
      </div>

      <h3>Hoje</h3>
      {d.hoje.length === 0 && <p className="vazio">Nada marcado para hoje.</p>}
      <ul className="itens">
        {d.hoje.map((a) => (
          <li key={a.id} className="arq">
            <div><strong>{hora(a.inicio)} · {a.clientes?.nome || 'Cliente'}</strong><small>{a.servicos?.nome}</small></div>
            <span className={'badge ' + a.status}>{ST[a.status]}</span>
          </li>
        ))}
      </ul>

      <h3>Clientes para retornar</h3>
      <div className="filtros">
        {[30, 45, 60].map((f) => (
          <button key={f} className={faixa === f ? 'ativo' : ''} onClick={() => setFaixa(f)}>{f}+ dias ({n(f)})</button>
        ))}
      </div>
      {lista.length === 0 && <p className="vazio">Nenhuma cliente nesta faixa.</p>}
      <ul className="itens">
        {lista.map((c) => (
          <li key={c.id} className="arq">
            <div><strong>{c.nome}</strong><small>{c.dias} dias sem retornar · último: {dataBR(c.ultimo_atendimento)}</small></div>
            {c.telefone && !c.telefone_incompleto
              ? <a className="zap" href={zapLink(c.telefone, c.nome)} target="_blank" rel="noreferrer">WhatsApp</a>
              : <small>{c.telefone ? 'falta DDD' : 'sem telefone'}</small>}
          </li>
        ))}
      </ul>
      {semHistorico > 0 && <p className="contagem">{semHistorico} cliente(s) ainda sem atendimento registrado não entram nesta lista.</p>}
      <p className="contagem">Quem já tem um agendamento futuro não aparece aqui.</p>
    </section>
  )
}
