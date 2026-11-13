import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { ymd } from './util'

const semAcento = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function Datas() {
  const [itens, setItens] = useState([])
  const [busca, setBusca] = useState('')
  const [soFaltando, setSoFaltando] = useState(true)
  const [msg, setMsg] = useState({})
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const hoje = ymd(new Date())

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('clientes').select('id,nome,ultimo_atendimento,data_nascimento').eq('ativa', true).order('nome').limit(5000)
      if (error) setErro('Não foi possível carregar: ' + error.message)
      else setItens(data)
      setCarregando(false)
    })()
  }, [])

  async function mudar(id, campo, valor) {
    if (!valor || valor < '1900-01-01' || valor > hoje) return
    const { error } = await supabase.from('clientes').update({ [campo]: valor }).eq('id', id)
    if (error) return setMsg((m) => ({ ...m, [id]: 'Erro ao salvar: ' + error.message }))
    setItens((l) => l.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)))
    setMsg((m) => ({ ...m, [id]: 'Salvo ✓' }))
  }

  const q = semAcento(busca)
  const lista = itens.filter((c) => semAcento(c.nome).includes(q) && (!soFaltando || !c.ultimo_atendimento || !c.data_nascimento))
  const completas = itens.filter((c) => c.ultimo_atendimento && c.data_nascimento).length

  return (
    <section>
      <div className="barra">
        <input type="search" placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <div className="meta">
        <p className="contagem">{carregando ? 'Carregando…' : `${completas} de ${itens.length} com as duas datas`}</p>
        <button className="texto" onClick={() => setSoFaltando(!soFaltando)}>{soFaltando ? 'Mostrar todas' : 'Só quem falta'}</button>
      </div>
      <p className="contagem">Escolha a data e ela é salva na hora. Para apagar uma data, use a ficha da cliente.</p>
      {erro && <p className="erro">{erro}</p>}
      {!carregando && lista.length === 0 && <p className="vazio">Nenhuma cliente para preencher. 🎉</p>}
      <ul className="itens">
        {lista.map((c) => (
          <li key={c.id} className="dados">
            <strong>{c.nome}</strong>
            <div className="duas">
              <label>Último atendimento<input type="date" min="1900-01-01" max={hoje} defaultValue={c.ultimo_atendimento || ''} onChange={(e) => mudar(c.id, 'ultimo_atendimento', e.target.value)} /></label>
              <label>Aniversário<input type="date" min="1900-01-01" max={hoje} defaultValue={c.data_nascimento || ''} onChange={(e) => mudar(c.id, 'data_nascimento', e.target.value)} /></label>
            </div>
            {msg[c.id] && <small>{msg[c.id]}</small>}
          </li>
        ))}
      </ul>
    </section>
  )
}
