import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { brl, hora, ymd, paraInput } from './util'

const STATUS = { agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado', faltou: 'Faltou' }
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const diaLocal = (s) => new Date(s + 'T00:00')

function Modal({ titulo, onClose, children }) {
  return (
    <div className="fundo" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  )
}

function FormAgenda({ inicial, clientes, servicos, onSalvar, onCancelar, erro, busy }) {
  const [v, setV] = useState(inicial)
  const set = (k, val) => setV((o) => ({ ...o, [k]: val }))
  const escolheServico = (id) => {
    const s = servicos.find((x) => x.id === id)
    setV((o) => ({ ...o, servico_id: id, valor: s ? s.preco : o.valor }))
  }
  return (
    <Modal titulo={v.id ? 'Remarcar ou editar' : 'Novo agendamento'} onClose={onCancelar}>
      <form onSubmit={(e) => { e.preventDefault(); onSalvar(v) }}>
        <label>Cliente
          <select required value={v.cliente_id || ''} onChange={(e) => set('cliente_id', e.target.value)}>
            <option value="">Escolha a cliente…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label>Serviço
          <select required value={v.servico_id || ''} onChange={(e) => escolheServico(e.target.value)}>
            <option value="">Escolha o serviço…</option>
            {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </label>
        <label>Data e hora<input type="datetime-local" required value={v.inicio} onChange={(e) => set('inicio', e.target.value)} /></label>
        <label>Valor (R$)<input type="number" min="0" step="0.01" required value={v.valor ?? ''} onChange={(e) => set('valor', e.target.value)} /></label>
        <label>Observações<textarea rows="2" value={v.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></label>
        {erro && <p className="erro">{erro}</p>}
        <div className="acoes">
          <button type="button" onClick={onCancelar}>Voltar</button>
          <button className="primario" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  )
}

function FormPagar({ item, onPagar, onCancelar, erro, busy }) {
  const [forma, setForma] = useState('pix')
  const [valor, setValor] = useState(item.valor)
  return (
    <Modal titulo="Receber pagamento" onClose={onCancelar}>
      <form onSubmit={(e) => { e.preventDefault(); onPagar({ forma, valor }) }}>
        <p>{item.clientes?.nome} · {item.servicos?.nome}</p>
        <label>Forma de pagamento
          <select value={forma} onChange={(e) => setForma(e.target.value)}>
            <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option>
          </select>
        </label>
        <label>Valor recebido (R$)<input type="number" min="0" step="0.01" required value={valor} onChange={(e) => setValor(e.target.value)} /></label>
        {erro && <p className="erro">{erro}</p>}
        <div className="acoes">
          <button type="button" onClick={onCancelar}>Voltar</button>
          <button className="primario" disabled={busy}>{busy ? 'Salvando…' : 'Confirmar pagamento'}</button>
        </div>
      </form>
    </Modal>
  )
}

function FormPadrao({ padrao, onSalvar, onCancelar, erro, busy }) {
  const [rows, setRows] = useState(DIAS.map((_, i) => padrao.find((p) => p.dia_semana === i) || { dia_semana: i, ativo: false, inicio: '08:00', fim: '18:00' }))
  const set = (i, k, val) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: val } : x)))
  return (
    <Modal titulo="Horário habitual" onClose={onCancelar}>
      <p className="contagem">Opcional. Serve só de aviso: ela continua podendo agendar em qualquer horário. Se nenhum dia estiver marcado, não há aviso.</p>
      {rows.map((r, i) => (
        <div className="padrao" key={i}>
          <label className="chk"><input type="checkbox" checked={r.ativo} onChange={(e) => set(i, 'ativo', e.target.checked)} />{DIAS[i]}</label>
          <input type="time" disabled={!r.ativo} value={String(r.inicio).slice(0, 5)} onChange={(e) => set(i, 'inicio', e.target.value)} />
          <input type="time" disabled={!r.ativo} value={String(r.fim).slice(0, 5)} onChange={(e) => set(i, 'fim', e.target.value)} />
        </div>
      ))}
      {erro && <p className="erro">{erro}</p>}
      <div className="acoes">
        <button type="button" onClick={onCancelar}>Voltar</button>
        <button className="primario" disabled={busy} onClick={() => onSalvar(rows)}>Salvar</button>
      </div>
    </Modal>
  )
}

export default function Agenda() {
  const [dia, setDia] = useState(ymd(new Date()))
  const [itens, setItens] = useState([])
  const [semana, setSemana] = useState({})
  const [clientes, setClientes] = useState([])
  const [servicos, setServicos] = useState([])
  const [padrao, setPadrao] = useState([])
  const [modal, setModal] = useState(null)
  const [erro, setErro] = useState('')
  const [busy, setBusy] = useState(false)

  async function carregarBase() {
    const [c, s, p] = await Promise.all([
      supabase.from('clientes').select('id,nome,primeiro_atendimento,ultimo_atendimento').eq('ativa', true).order('nome').limit(5000),
      supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
      supabase.from('horario_padrao').select('*').order('dia_semana'),
    ])
    if (c.error || s.error || p.error) return setErro('Não foi possível carregar os dados: ' + (c.error || s.error || p.error).message)
    setClientes(c.data); setServicos(s.data); setPadrao(p.data)
  }
  async function carregarDia() {
    const a = diaLocal(dia), b = new Date(a)
    b.setDate(b.getDate() + 1)
    const { data, error } = await supabase.from('agendamentos')
      .select('*, clientes(nome,telefone), servicos(nome)')
      .gte('inicio', a.toISOString()).lt('inicio', b.toISOString()).order('inicio')
    if (error) return setErro('Não foi possível carregar a agenda: ' + error.message)
    setErro(''); setItens(data)
    const d0 = new Date(a); d0.setDate(d0.getDate() - d0.getDay())
    const d7 = new Date(d0); d7.setDate(d7.getDate() + 7)
    const w = await supabase.from('agendamentos').select('inicio,status').gte('inicio', d0.toISOString()).lt('inicio', d7.toISOString())
    const cont = {}
    ;(w.data || []).forEach((x) => { if (x.status !== 'cancelado') { const k = ymd(x.inicio); cont[k] = (cont[k] || 0) + 1 } })
    setSemana(cont)
  }
  useEffect(() => { carregarBase() }, [])
  useEffect(() => { carregarDia() }, [dia])

  const base = diaLocal(dia)
  const d0 = new Date(base); d0.setDate(d0.getDate() - d0.getDay())
  const dias = [...Array(7)].map((_, i) => { const d = new Date(d0); d.setDate(d.getDate() + i); return d })
  const mover = (n) => { const d = new Date(base); d.setDate(d.getDate() + n); setDia(ymd(d)) }
  const abrir = (m) => { setErro(''); setModal(m) }

  async function salvar(v) {
    setErro('')
    const sv = servicos.find((s) => s.id === v.servico_id)
    if (!v.cliente_id || !sv || !v.inicio) return setErro('Escolha a cliente, o serviço e o horário.')
    const ini = new Date(v.inicio), fim = new Date(ini.getTime() + sv.duracao_min * 60000)
    setBusy(true)
    const { data: choques } = await supabase.from('agendamentos').select('id,inicio,clientes(nome)')
      .not('status', 'in', '(cancelado,faltou)').lt('inicio', fim.toISOString()).gt('fim', ini.toISOString())
    const choque = (choques || []).find((x) => x.id !== v.id)
    if (choque && !window.confirm(`Esse horário choca com ${choque.clientes?.nome} às ${hora(choque.inicio)}. Agendar mesmo assim?`)) return setBusy(false)
    if (padrao.some((p) => p.ativo)) {
      const p = padrao.find((x) => x.dia_semana === ini.getDay())
      const hm = hora(ini)
      const fora = !p || !p.ativo || hm < String(p.inicio).slice(0, 5) || hm > String(p.fim).slice(0, 5)
      if (fora && !window.confirm('Esse horário está fora do horário habitual. Agendar mesmo assim?')) return setBusy(false)
    }
    const dados = { cliente_id: v.cliente_id, servico_id: v.servico_id, inicio: ini.toISOString(), fim: fim.toISOString(), valor: Number(v.valor || 0), observacoes: v.observacoes || null }
    const { error } = v.id
      ? await supabase.from('agendamentos').update(dados).eq('id', v.id)
      : await supabase.from('agendamentos').insert({ ...dados, status: 'agendado' })
    setBusy(false)
    if (error) return setErro('Não foi possível salvar: ' + error.message)
    setModal(null)
    if (ymd(ini) === dia) carregarDia(); else setDia(ymd(ini))
  }
  async function mudar(id, st) {
    if (st === 'cancelado' && !window.confirm('Cancelar este agendamento?')) return
    const { error } = await supabase.from('agendamentos').update({ status: st }).eq('id', id)
    if (error) return setErro('Não foi possível atualizar: ' + error.message)
    setModal(null); carregarDia()
  }
  async function receber(item, v) {
    setErro('')
    const valor = Number(v.valor)
    if (v.valor === '' || !(valor >= 0)) return setErro('Informe o valor recebido.')
    setBusy(true)
    const data = ymd(item.inicio)
    const r = await supabase.from('pagamentos').insert({ agendamento_id: item.id, cliente_id: item.cliente_id, valor, forma: v.forma, servico_nome: item.servicos?.nome, pago_em: data })
    if (r.error) { setBusy(false); return setErro('Não foi possível registrar: ' + r.error.message) }
    await supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', item.id)
    const cl = clientes.find((c) => c.id === item.cliente_id)
    const up = {}
    if (!cl?.ultimo_atendimento || data > cl.ultimo_atendimento) up.ultimo_atendimento = data
    if (!cl?.primeiro_atendimento) up.primeiro_atendimento = data
    if (Object.keys(up).length) await supabase.from('clientes').update(up).eq('id', item.cliente_id)
    setBusy(false); setModal(null); carregarDia(); carregarBase()
  }
  async function salvarPadrao(rows) {
    setBusy(true)
    const { error } = await supabase.from('horario_padrao').upsert(rows.map((r) => ({ dia_semana: r.dia_semana, ativo: r.ativo, inicio: r.inicio, fim: r.fim })), { onConflict: 'dia_semana' })
    setBusy(false)
    if (error) return setErro('Não foi possível salvar: ' + error.message)
    setModal(null); carregarBase()
  }

  const novo = { inicio: `${dia}T09:00`, valor: '' }
  const x = modal?.x
  return (
    <section>
      <div className="barra">
        <button onClick={() => mover(-1)} aria-label="Dia anterior">‹</button>
        <input type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} />
        <button onClick={() => mover(1)} aria-label="Próximo dia">›</button>
      </div>
      <div className="semana">
        {dias.map((d) => (
          <button key={ymd(d)} className={ymd(d) === dia ? 'ativo' : ''} onClick={() => setDia(ymd(d))}>
            <small>{DIAS[d.getDay()]}</small><strong>{d.getDate()}</strong><span>{semana[ymd(d)] || ''}</span>
          </button>
        ))}
      </div>
      <div className="barra">
        <button className="primario" onClick={() => abrir({ t: 'form', v: novo })}>Novo agendamento</button>
        <button onClick={() => setDia(ymd(new Date()))}>Hoje</button>
        <button onClick={() => abrir({ t: 'padrao' })}>Horário habitual</button>
      </div>
      <p className="contagem">{base.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} · {itens.filter((i) => i.status !== 'cancelado').length} atendimento(s)</p>
      {erro && !modal && <p className="erro">{erro}</p>}
      {itens.length === 0 && <p className="vazio">Nada marcado para este dia. Toque em “Novo agendamento”.</p>}
      <ul className="itens">
        {itens.map((i) => (
          <li key={i.id} onClick={() => abrir({ t: 'ver', x: i })}>
            <div><strong>{hora(i.inicio)}–{hora(i.fim)} · {i.clientes?.nome}</strong><small>{i.servicos?.nome} · {brl(i.valor)}</small></div>
            <span className={'badge ' + i.status}>{STATUS[i.status]}</span>
          </li>
        ))}
      </ul>
      {modal?.t === 'form' && <FormAgenda inicial={modal.v} clientes={clientes} servicos={servicos} onSalvar={salvar} onCancelar={() => setModal(null)} erro={erro} busy={busy} />}
      {modal?.t === 'pagar' && <FormPagar item={x} onPagar={(v) => receber(x, v)} onCancelar={() => setModal(null)} erro={erro} busy={busy} />}
      {modal?.t === 'padrao' && <FormPadrao padrao={padrao} onSalvar={salvarPadrao} onCancelar={() => setModal(null)} erro={erro} busy={busy} />}
      {modal?.t === 'ver' && (
        <Modal titulo={x.clientes?.nome} onClose={() => setModal(null)}>
          <p>{x.servicos?.nome} · {hora(x.inicio)}–{hora(x.fim)} · {brl(x.valor)}</p>
          <p><span className={'badge ' + x.status}>{STATUS[x.status]}</span></p>
          {x.observacoes && <p className="contagem">{x.observacoes}</p>}
          {erro && <p className="erro">{erro}</p>}
          <div className="botoes">
            {x.status === 'agendado' && <button onClick={() => mudar(x.id, 'confirmado')}>Confirmar</button>}
            {['agendado', 'confirmado'].includes(x.status) && <button className="primario" onClick={() => abrir({ t: 'pagar', x })}>Concluir e receber</button>}
            {['agendado', 'confirmado'].includes(x.status) && <button onClick={() => abrir({ t: 'form', v: { ...x, inicio: paraInput(x.inicio) } })}>Remarcar ou editar</button>}
            {['agendado', 'confirmado'].includes(x.status) && <button onClick={() => mudar(x.id, 'faltou')}>Marcar falta</button>}
            {['agendado', 'confirmado'].includes(x.status) && <button className="perigo" onClick={() => mudar(x.id, 'cancelado')}>Cancelar</button>}
            <button onClick={() => setModal(null)}>Fechar</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
