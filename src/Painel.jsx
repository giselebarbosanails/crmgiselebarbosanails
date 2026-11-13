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

const zapMsg = (tel, msg) => {
  let d = (tel || '').replace(/\D/g, '')
  if (d.length <= 11) d = '55' + d
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
    const sem0 = new Date(ini); sem0.setDate(sem0.getDate() - sem0.getDay())
    const sem7 = new Date(sem0); sem7.setDate(sem7.getDate() + 7)
    const ult30 = new Date(ini); ult30.setDate(ult30.getDate() - 30)
    const [c, hoje, fut, p, sem, fal] = await Promise.all([
      supabase.from('clientes').select('id,nome,telefone,telefone_incompleto,ultimo_atendimento,data_nascimento').eq('ativa', true).limit(5000),
      supabase.from('agendamentos').select('id,inicio,status,clientes(nome),servicos(nome)').gte('inicio', ini.toISOString()).lt('inicio', fim.toISOString()).order('inicio'),
      supabase.from('agendamentos').select('cliente_id').in('status', ['agendado', 'confirmado']).gte('inicio', h.toISOString()),
      supabase.from('pagamentos').select('valor,pago_em').gte('pago_em', mes0).lt('pago_em', mes1),
      supabase.from('agendamentos').select('id', { count: 'exact', head: true }).in('status', ['agendado', 'confirmado', 'concluido']).gte('inicio', sem0.toISOString()).lt('inicio', sem7.toISOString()),
      supabase.from('agendamentos').select('id,inicio,status,cliente_id,clientes(nome,telefone,telefone_incompleto)').in('status', ['cancelado', 'faltou']).gte('inicio', ult30.toISOString()).order('inicio', { ascending: false }),
    ])
    const e = c.error || hoje.error || fut.error || p.error || sem.error || fal.error
    if (e) return setErro('Não foi possível carregar o painel: ' + e.message)
    setErro('')
    setD({
      clientes: c.data,
      hoje: hoje.data,
      futuras: new Set(fut.data.map((a) => a.cliente_id)),
      fat: p.data.reduce((t, i) => t + Number(i.valor || 0), 0),
      fatHoje: p.data.filter((i) => i.pago_em === ymd(ini)).reduce((t, i) => t + Number(i.valor || 0), 0),
      semana: sem.count || 0,
      faltas: fal.data,
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
  const mesAtual = new Date().getMonth() + 1
  const diaAtual = new Date().getDate()
  const aniv = d.clientes
    .filter((c) => c.data_nascimento && Number(c.data_nascimento.slice(5, 7)) === mesAtual)
    .sort((a, b) => Number(a.data_nascimento.slice(8, 10)) - Number(b.data_nascimento.slice(8, 10)))
  const faltas = d.faltas.filter((a, i, arr) => !d.futuras.has(a.cliente_id) && arr.findIndex((b) => b.cliente_id === a.cliente_id) === i)
  const semHistorico = d.clientes.filter((c) => !c.ultimo_atendimento).length

  return (
    <section>
      <div className="cards">
        <div><small>Clientes ativas</small><strong>{d.clientes.length}</strong></div>
        <div><small>Atendimentos hoje</small><strong>{hojeValidos.length}</strong></div>
        <div><small>Faturamento do mês</small><strong>{brl(d.fat)}</strong></div>
        <div><small>Retornos pendentes</small><strong>{n(30)}</strong></div>
        <div><small>Faturamento de hoje</small><strong>{brl(d.fatHoje)}</strong></div>
        <div><small>Atendimentos na semana</small><strong>{d.semana}</strong></div>
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

      <h3>Aniversariantes do mês</h3>
      {aniv.length === 0 && <p className="vazio">Nenhuma aniversariante neste mês com data cadastrada. Preencha a data de nascimento na ficha das clientes.</p>}
      <ul className="itens">
        {aniv.map((c) => {
          const dia = Number(c.data_nascimento.slice(8, 10))
          return (
            <li key={c.id} className="arq">
              <div><strong>{c.nome}</strong><small>{dia === diaAtual ? 'Hoje! 🎉' : `Dia ${dia}`}</small></div>
              {c.telefone && !c.telefone_incompleto && <a className="zap" href={zapMsg(c.telefone, `Parabéns, ${c.nome.split(' ')[0]}! 🎉 Que seu dia seja lindo! Um beijo do estúdio 💅`)} target="_blank" rel="noreferrer">Parabenizar</a>}
            </li>
          )
        })}
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
      <h3>Faltaram ou cancelaram (30 dias)</h3>
      {faltas.length === 0 && <p className="vazio">Ninguém para reagendar.</p>}
      <ul className="itens">
        {faltas.map((a) => (
          <li key={a.id} className="arq">
            <div><strong>{a.clientes?.nome || 'Cliente'}</strong><small>{a.status === 'faltou' ? 'Faltou' : 'Cancelou'} em {dataBR(ymd(a.inicio))}</small></div>
            {a.clientes?.telefone && !a.clientes.telefone_incompleto && <a className="zap" href={zapMsg(a.clientes.telefone, `Oi, ${a.clientes.nome.split(' ')[0]}! Vamos remarcar seu horário? 💅`)} target="_blank" rel="noreferrer">Reagendar</a>}
          </li>
        ))}
      </ul>

      {semHistorico > 0 && <p className="contagem">{semHistorico} cliente(s) ainda sem atendimento registrado não entram nesta lista.</p>}
      <p className="contagem">Quem já tem um agendamento futuro não aparece aqui.</p>
    </section>
  )
}
