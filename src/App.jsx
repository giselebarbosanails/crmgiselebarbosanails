import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Agenda from './Agenda.jsx'
import Financeiro from './Financeiro.jsx'

const soDigitos = (t) => (t || '').replace(/\D/g, '')
const zap = (t) => 'https://wa.me/' + soDigitos(t)
const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '')
const fmtTel = (t) => {
  let d = soDigitos(t)
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t || ''
}
const semAcento = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const CAMPOS_CLIENTE = [
  { k: 'nome', l: 'Nome completo', req: true },
  { k: 'telefone', l: 'Telefone / WhatsApp (com DDD)', type: 'tel' },
  { k: 'data_nascimento', l: 'Data de nascimento', type: 'date' },
  { k: 'instagram', l: 'Instagram (opcional)' },
  { k: 'origem', l: 'Como conheceu o estúdio' },
  { k: 'primeiro_atendimento', l: 'Primeiro atendimento', type: 'date' },
  { k: 'ultimo_atendimento', l: 'Último atendimento', type: 'date' },
  { k: 'preferencias', l: 'Preferências de unhas', type: 'area' },
  { k: 'observacoes', l: 'Observações', type: 'area' },
]
const CAMPOS_SERVICO = [
  { k: 'nome', l: 'Nome do serviço', req: true },
  { k: 'descricao', l: 'Descrição', type: 'area' },
  { k: 'preco', l: 'Preço (R$)', type: 'number', step: '0.01', req: true },
  { k: 'duracao_min', l: 'Duração (minutos)', type: 'number', step: '5', req: true },
  { k: 'observacoes', l: 'Observações', type: 'area' },
]

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  async function entrar(e) {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    if (error) setErro('E-mail ou senha incorretos. Confira e tente de novo.')
    setCarregando(false)
  }
  return (
    <main className="login">
      <form onSubmit={entrar}>
        <h1>Studio Nails</h1>
        <p>Entre para ver suas clientes e serviços.</p>
        <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></label>
        <label>Senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" /></label>
        {erro && <p className="erro">{erro}</p>}
        <button className="primario" disabled={carregando}>{carregando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  )
}

function Formulario({ campos, inicial, onSalvar, onCancelar, onArquivar, salvando, erro }) {
  const [v, setV] = useState(inicial)
  const set = (k, val) => setV((o) => ({ ...o, [k]: val }))
  return (
    <div className="fundo" onClick={onCancelar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSalvar(v) }}>
        <h2>{inicial.id ? 'Editar' : 'Cadastrar'}</h2>
        {campos.map((c) => (
          <label key={c.k}>{c.l}
            {c.type === 'area'
              ? <textarea rows="3" value={v[c.k] ?? ''} onChange={(e) => set(c.k, e.target.value)} />
              : <input type={c.type || 'text'} step={c.step} min={c.type === 'number' ? 0 : undefined} required={c.req} value={v[c.k] ?? ''} onChange={(e) => set(c.k, e.target.value)} />}
          </label>
        ))}
        {erro && <p className="erro">{erro}</p>}
        <div className="acoes">
          <button type="button" onClick={onCancelar}>Cancelar</button>
          {inicial.id && <button type="button" className="perigo" onClick={onArquivar}>Arquivar</button>}
          <button className="primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}

function Lista({ tabela, flag, campos, vazio, prepara, linha, novoRotulo, inicialNovo, busque }) {
  const [itens, setItens] = useState([])
  const [busca, setBusca] = useState('')
  const [edit, setEdit] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [arquivadas, setArquivadas] = useState(false)

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase.from(tabela).select('*').eq(flag, !arquivadas).order('nome').limit(5000)
    if (error) setErro('Não foi possível carregar: ' + error.message)
    else { setItens(data); setErro('') }
    setCarregando(false)
  }
  useEffect(() => { carregar() }, [arquivadas])

  async function salvar(v) {
    setSalvando(true)
    setErro('')
    const dados = prepara(v)
    const { id, criado_em, ...resto } = dados
    const q = id ? supabase.from(tabela).update(resto).eq('id', id) : supabase.from(tabela).insert(resto)
    const { error } = await q
    setSalvando(false)
    if (error) return setErro('Não foi possível salvar: ' + error.message)
    setEdit(null)
    carregar()
  }
  async function arquivar() {
    if (!window.confirm('Arquivar este item? Ele sai da lista, mas os dados ficam guardados.')) return
    const { error } = await supabase.from(tabela).update({ [flag]: false }).eq('id', edit.id)
    if (error) return setErro('Não foi possível arquivar: ' + error.message)
    setEdit(null)
    carregar()
  }

  async function restaurar(id) {
    const { error } = await supabase.from(tabela).update({ [flag]: true }).eq('id', id)
    if (error) return setErro('Não foi possível restaurar: ' + error.message)
    carregar()
  }

  const q = semAcento(busca)
  const filtrados = itens.filter((i) => semAcento(i.nome).includes(q) || soDigitos(i.telefone).includes(soDigitos(busca) || '§'))
  return (
    <section>
      <div className="barra">
        <input type="search" placeholder={busque} value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="primario" onClick={() => { setErro(''); setEdit(inicialNovo) }}>{novoRotulo}</button>
      </div>
      <div className="meta">
        <p className="contagem">{carregando ? 'Carregando…' : `${filtrados.length} de ${itens.length}${arquivadas ? ' arquivadas' : ''}`}</p>
        <button className="texto" onClick={() => { setBusca(''); setArquivadas(!arquivadas) }}>{arquivadas ? 'Voltar para as ativas' : 'Ver arquivadas'}</button>
      </div>
      {erro && !edit && <p className="erro">{erro}</p>}
      {!carregando && itens.length === 0 && <p className="vazio">{arquivadas ? 'Nada arquivado por aqui.' : vazio}</p>}
      <ul className="itens">
        {filtrados.map((i) => (
          arquivadas
            ? <li key={i.id} className="arq"><div><strong>{i.nome}</strong></div><button onClick={() => restaurar(i.id)}>Restaurar</button></li>
            : <li key={i.id} onClick={() => { setErro(''); setEdit(i) }}>{linha(i)}</li>
        ))}
      </ul>
      {edit && <Formulario campos={campos} inicial={edit} onSalvar={salvar} onCancelar={() => setEdit(null)} onArquivar={arquivar} salvando={salvando} erro={erro} />}
    </section>
  )
}

const prepCliente = (v) => {
  const o = { ...v }
  for (const k of ['data_nascimento', 'primeiro_atendimento', 'ultimo_atendimento', 'instagram', 'origem', 'preferencias', 'observacoes']) if (!o[k]) o[k] = null
  o.nome = o.nome.trim()
  const d = soDigitos(o.telefone)
  o.telefone = d || null
  o.telefone_incompleto = !!d && !(d.startsWith('55') && d.length >= 12) && d.length < 10
  return o
}
const prepServico = (v) => ({ ...v, nome: v.nome.trim(), preco: Number(v.preco || 0), duracao_min: parseInt(v.duracao_min || 60, 10), descricao: v.descricao || null, observacoes: v.observacoes || null })

export default function App() {
  const [sessao, setSessao] = useState(undefined)
  const [aba, setAba] = useState('agenda')
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (sessao === undefined) return <p className="vazio">Carregando…</p>
  if (!sessao) return <Login />
  return (
    <div className="app">
      <header>
        <h1>Studio Nails</h1>
        <button onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>
      <nav>
        <button className={aba === 'agenda' ? 'ativo' : ''} onClick={() => setAba('agenda')}>Agenda</button>
        <button className={aba === 'clientes' ? 'ativo' : ''} onClick={() => setAba('clientes')}>Clientes</button>
        <button className={aba === 'servicos' ? 'ativo' : ''} onClick={() => setAba('servicos')}>Serviços</button>
        <button className={aba === 'financeiro' ? 'ativo' : ''} onClick={() => setAba('financeiro')}>Financeiro</button>
      </nav>
      {aba === 'agenda' ? <Agenda /> : aba === 'financeiro' ? <Financeiro /> : aba === 'clientes' ? (
        <Lista key="c" tabela="clientes" flag="ativa" campos={CAMPOS_CLIENTE} prepara={prepCliente}
          busque="Buscar cliente" novoRotulo="Nova cliente" inicialNovo={{ nome: '' }}
          vazio="Nenhuma cliente ainda. Toque em “Nova cliente” para cadastrar."
          linha={(c) => (
            <>
              <div><strong>{c.nome}</strong>
                <small>{c.telefone ? fmtTel(c.telefone) : 'sem telefone'}{c.telefone_incompleto ? ' · falta DDD' : ''}{c.ultimo_atendimento ? ` · último: ${dataBR(c.ultimo_atendimento)}` : ''}</small></div>
              {c.telefone && !c.telefone_incompleto && <a className="zap" href={zap(c.telefone)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>WhatsApp</a>}
            </>
          )} />
      ) : (
        <Lista key="s" tabela="servicos" flag="ativo" campos={CAMPOS_SERVICO} prepara={prepServico}
          busque="Buscar serviço" novoRotulo="Novo serviço" inicialNovo={{ nome: '', preco: '', duracao_min: 60 }}
          vazio="Nenhum serviço ainda. Cadastre alongamento, manutenção, esmaltação…"
          linha={(s) => (<div><strong>{s.nome}</strong><small>{brl(s.preco)} · {s.duracao_min} min</small></div>)} />
      )}
    </div>
  )
}
