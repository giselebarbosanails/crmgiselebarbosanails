import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { brl, ymd, dataBR } from './util'
import Relatorios from './Relatorios.jsx'

const FORMA = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' }
const soma = (l) => l.reduce((t, i) => t + Number(i.valor || 0), 0)

function Resumo() {
  const [mes, setMes] = useState(ymd(new Date()).slice(0, 7))
  const [pag, setPag] = useState([])
  const [des, setDes] = useState([])
  const [erro, setErro] = useState('')
  const [novo, setNovo] = useState(null)
  const [busy, setBusy] = useState(false)

  async function carregar() {
    if (!mes) return
    const [y, m] = mes.split('-').map(Number)
    const a = mes + '-01', b = ymd(new Date(y, m, 1))
    const [p, d] = await Promise.all([
      supabase.from('pagamentos').select('*, clientes(nome)').gte('pago_em', a).lt('pago_em', b).order('pago_em', { ascending: false }),
      supabase.from('despesas').select('*').gte('data', a).lt('data', b).order('data', { ascending: false }),
    ])
    if (p.error || d.error) return setErro('Não foi possível carregar: ' + (p.error || d.error).message)
    setErro(''); setPag(p.data); setDes(d.data)
  }
  useEffect(() => { carregar() }, [mes])

  async function salvarDespesa(e) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.from('despesas').insert({ descricao: novo.descricao.trim(), categoria: novo.categoria || null, valor: Number(novo.valor), data: novo.data })
    setBusy(false)
    if (error) return setErro('Não foi possível salvar: ' + error.message)
    setNovo(null); carregar()
  }
  async function apagar(id) {
    if (!window.confirm('Apagar esta despesa?')) return
    const { error } = await supabase.from('despesas').delete().eq('id', id)
    if (error) return setErro('Não foi possível apagar: ' + error.message)
    carregar()
  }

  const fat = soma(pag), dsp = soma(des)
  const porForma = Object.entries(FORMA).map(([k, n]) => [n, soma(pag.filter((p) => p.forma === k))])
  const srv = {}
  pag.forEach((p) => { const n = p.servico_nome || 'Sem serviço'; srv[n] = srv[n] || { q: 0, v: 0 }; if (p.tipo === 'total' || p.tipo === 'restante') srv[n].q++; srv[n].v += Number(p.valor) })
  const ranking = Object.entries(srv).filter(([, r]) => r.q > 0).sort((a, b) => b[1].v - a[1].v)

  return (
    <section>
      <div className="barra">
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        <button className="primario" onClick={() => setNovo({ descricao: '', categoria: '', valor: '', data: ymd(new Date()) })}>Nova despesa</button>
      </div>
      {erro && !novo && <p className="erro">{erro}</p>}
      <div className="cards">
        <div><small>Faturamento</small><strong>{brl(fat)}</strong></div>
        <div><small>Despesas</small><strong>{brl(dsp)}</strong></div>
        <div><small>Lucro estimado</small><strong>{brl(fat - dsp)}</strong></div>
      </div>
      <h3>Por forma de pagamento</h3>
      <ul className="itens">{porForma.map(([n, v]) => <li key={n} className="arq"><strong>{n}</strong><span>{brl(v)}</span></li>)}</ul>
      <h3>Serviços mais vendidos</h3>
      {ranking.length === 0 && <p className="vazio">Sem atendimentos pagos neste mês.</p>}
      <ul className="itens">{ranking.map(([n, r]) => <li key={n} className="arq"><div><strong>{n}</strong><small>{r.q} atendimento(s)</small></div><span>{brl(r.v)}</span></li>)}</ul>
      <h3>Recebimentos</h3>
      <ul className="itens">{pag.map((p) => <li key={p.id} className="arq"><div><strong>{p.clientes?.nome || 'Cliente'}</strong><small>{dataBR(p.pago_em)} · {p.servico_nome} · {FORMA[p.forma]}{p.tipo === 'sinal' ? ' · sinal' : p.tipo === 'devolucao' ? ' · devolução' : ''}</small></div><span>{brl(p.valor)}</span></li>)}</ul>
      <h3>Despesas</h3>
      {des.length === 0 && <p className="vazio">Nenhuma despesa neste mês.</p>}
      <ul className="itens">{des.map((d) => <li key={d.id} className="arq"><div><strong>{d.descricao}</strong><small>{dataBR(d.data)}{d.categoria ? ' · ' + d.categoria : ''}</small></div><span>{brl(d.valor)} <button onClick={() => apagar(d.id)} aria-label="Apagar despesa">✕</button></span></li>)}</ul>
      {novo && (
        <div className="fundo" onClick={() => setNovo(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={salvarDespesa}>
            <h2>Nova despesa</h2>
            <label>Descrição<input required value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} /></label>
            <label>Categoria (opcional)<input value={novo.categoria} onChange={(e) => setNovo({ ...novo, categoria: e.target.value })} /></label>
            <label>Valor (R$)<input type="number" min="0" step="0.01" required value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} /></label>
            <label>Data<input type="date" required value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} /></label>
            {erro && <p className="erro">{erro}</p>}
            <div className="acoes"><button type="button" onClick={() => setNovo(null)}>Voltar</button><button className="primario" disabled={busy}>Salvar</button></div>
          </form>
        </div>
      )}
    </section>
  )
}

export default function Financeiro() {
  const [vista, setVista] = useState('mes')
  return (
    <>
      <div className="filtros">
        <button className={vista === 'mes' ? 'ativo' : ''} onClick={() => setVista('mes')}>Mês</button>
        <button className={vista === 'rel' ? 'ativo' : ''} onClick={() => setVista('rel')}>Relatórios</button>
      </div>
      {vista === 'mes' ? <Resumo /> : <Relatorios />}
    </>
  )
}
